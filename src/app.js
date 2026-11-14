// -----------------------------------------------------------------------------
// Every SDK handler, and the loop that reads Open-Meteo, keeps the water
// balance of every zone and publishes the advice.
//
// `createApp(gladys, options)` takes the SDK client (the real one in index.js,
// the SDK's fake Gladys in the tests), an injectable clock and fetch: nothing
// here reads the current time directly.
// -----------------------------------------------------------------------------

import { logger as defaultLogger } from '@gladysassistant/integration-sdk';
import { normalizeConfig, parseDecimal } from './config.js';
import { addDays, advise, applyDay, applyWatering, localDay } from './balance.js';
import { buildDevices, zoneIds, zoneStates } from './devices.js';
import { fetchDaily } from './openmeteo.js';
import { STATUS, TEXT, allLanguages } from './i18n.js';
import { createStore } from './store.js';
import { buildWidget, rowValue, WATERED_ACTION, WIDGET_KEY } from './widget.js';

export const TRIGGER_KEY = 'watering_advised';
export const SCENE_ACTION_KEY = 'zone_watered';
// The trigger fires when the day is computed, up to 2 hours after the
// configured hour (a late forecast); later, the day passes without it.
const FIRE_WINDOW_HOURS = 2;
// Open-Meteo updates its models every few hours: one reading every 3 hours.
const REFRESH_MS = 3 * 3600 * 1000;
const RETRY_MS = 15 * 60000;
const LOCATION_RETRY_MS = 10 * 60000;
const LOCATION_REFRESH_MS = 60 * 60000;
const HEARTBEAT_MS = 6 * 3600 * 1000;

export function createApp(
  gladys,
  {
    now = () => new Date(),
    dataDir = '/data',
    logger = defaultLogger,
    tickMs = 5 * 60000,
    fetchImpl = globalThis.fetch,
    timeZone = process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone,
  } = {},
) {
  const store = createStore(dataDir, logger);
  let config = normalizeConfig();
  let location = null; // null: not read yet, false: no located house
  let lastLocationAttempt = 0;
  let forecast = null; // { days, day, at }: the last daily series and when it was read
  let lastFetchAttempt = 0;
  let apiFailing = false;
  let lastStatus = null;
  let timer = null;
  let queue = Promise.resolve();
  let weather = null;
  const advice = new Map(); // slot -> advice of the last computation

  // A failure repeated every cycle writes one line, then one on recovery.
  function failureLog(what) {
    let last = null;
    return {
      fail(err) {
        if (err.message !== last) {
          logger.warn(`${what} failed: ${err.message}`);
        }
        last = err.message;
      },
      ok() {
        if (last !== null) {
          logger.info(`${what} works again`);
        }
        last = null;
      },
    };
  }
  const housesLog = failureLog('Reading the houses');
  const forecastLog = failureLog('Reading Open-Meteo');
  const statesLog = failureLog('Publishing the states');
  const eventsLog = failureLog('Firing the watering trigger');
  const computeLog = failureLog('Computing the advice');

  async function loadLocation() {
    lastLocationAttempt = now().getTime();
    let houses;
    try {
      houses = await gladys.getHouses();
      housesLog.ok();
    } catch (err) {
      // A transient failure keeps the location already known.
      housesLog.fail(err);
      if (location === null) {
        location = false;
      }
      return;
    }
    const house = (houses ?? []).find(
      (h) => Number.isFinite(h?.latitude) && Number.isFinite(h?.longitude),
    );
    const found = house ? { latitude: house.latitude, longitude: house.longitude } : null;
    const moved =
      found &&
      location &&
      (found.latitude !== location.latitude || found.longitude !== location.longitude);
    if ((found && !location) || moved) {
      logger.info(`House located (${house.name ?? house.selector}), computing the advice`);
      forecast = null; // another place: read again
    } else if (!found && location !== false) {
      logger.info('No located house in Gladys yet, retrying every 10 minutes');
    }
    location = found ?? false;
  }

  async function reportStatus() {
    let message = null;
    if (!location) {
      message = STATUS.noLocation;
    } else if (config.invalid.length > 0) {
      const slots = config.invalid.join(', ');
      message = Object.fromEntries(
        Object.entries(STATUS.invalid).map(([lang, text]) => [
          lang,
          text.replace('{slots}', slots),
        ]),
      );
    } else if (apiFailing) {
      message = STATUS.apiError;
    }
    const key = JSON.stringify(message);
    if (key === lastStatus) {
      return;
    }
    lastStatus = key;
    if (message) {
      await gladys.setConnectionStatus(false, message);
    } else {
      await gladys.setConnectionStatus(true);
    }
  }

  async function refreshForecast(date, day) {
    const due = !forecast || forecast.day !== day || date.getTime() - forecast.at >= REFRESH_MS;
    if (!due || (apiFailing && date.getTime() - lastFetchAttempt < RETRY_MS)) {
      return;
    }
    lastFetchAttempt = date.getTime();
    try {
      const days = await fetchDaily(location, timeZone, { fetchImpl });
      forecast = { days, day, at: date.getTime() };
      apiFailing = false;
      forecastLog.ok();
    } catch (err) {
      apiFailing = true;
      forecastLog.fail(err);
    }
  }

  /** Add the days not yet counted, up to yesterday, to every zone balance. */
  function updateBalances(day, hour) {
    const state = store.state;
    const yesterday = addDays(day, -1);
    const first = state.lastDay === null;
    if (first) {
      state.lastDay = addDays(yesterday, -1);
    }
    // The first start counts yesterday at once; then once a day, at the hour.
    if ((!first && hour < config.calcHour) || state.lastDay >= yesterday) {
      return false;
    }
    let next = addDays(state.lastDay, 1);
    const known = Object.keys(forecast.days).sort();
    if (known.length > 0 && next < known[0]) {
      logger.warn(`No weather data from ${next} to ${addDays(known[0], -1)}: days skipped`);
      next = known[0];
    }
    let changed = false;
    while (next <= yesterday && forecast.days[next]) {
      for (const zone of config.zones) {
        const balance = state.balances[zone.slot] ?? 0;
        state.balances[zone.slot] = applyDay(balance, forecast.days[next], zone);
      }
      state.lastDay = next;
      next = addDays(next, 1);
      changed = true;
    }
    if (changed) {
      logger.debug(`Water balances up to ${state.lastDay}: ${JSON.stringify(state.balances)}`);
    }
    return changed;
  }

  const createdIds = () => new Set((gladys.devices ?? []).map((d) => d.external_id));

  /** The name the user gave the device in Gladys, else the configured one. */
  function displayName(zone) {
    const id = zoneIds(gladys, zone.slot).device;
    return (gladys.devices ?? []).find((d) => d.external_id === id)?.name || zone.name;
  }

  const balanceOf = (zone) => store.state.balances[zone.slot] ?? 0;

  async function compute() {
    const date = now();
    const age = date.getTime() - lastLocationAttempt;
    if (age >= (location ? LOCATION_REFRESH_MS : LOCATION_RETRY_MS)) {
      await loadLocation();
    }
    if (!location) {
      await reportStatus();
      return;
    }
    const { day, hour } = localDay(date, timeZone);
    await refreshForecast(date, day);
    await reportStatus();
    if (!forecast) {
      return;
    }
    let dirty = false;
    // Only a series read today tells what yesterday really was.
    if (forecast.day === day) {
      dirty = updateBalances(day, hour);
    }
    const yesterday = addDays(day, -1);
    weather = {
      et0Yesterday: forecast.days[yesterday]?.et0 ?? null,
      et0Today: forecast.days[day]?.et0 ?? null,
      rainToday: forecast.days[day]?.rain ?? null,
    };
    advice.clear();
    for (const zone of config.zones) {
      advice.set(
        zone.slot,
        advise(balanceOf(zone), zone, {
          rainToday: weather.rainToday,
          rainThreshold: config.rainThreshold,
        }),
      );
    }

    const created = createdIds();
    const zones = config.zones.filter((zone) => created.has(zoneIds(gladys, zone.slot).device));
    const states = zones.flatMap((zone) =>
      zoneStates(gladys, zone, balanceOf(zone), advice.get(zone.slot), weather),
    );
    if (states.length > 0) {
      try {
        await gladys.publishChangedStates(states, { heartbeat: HEARTBEAT_MS });
        statesLog.ok();
      } catch (err) {
        statesLog.fail(err);
      }
    }

    const state = store.state;
    if (state.lastDay === yesterday && state.adviceDay !== day && hour >= config.calcHour) {
      state.adviceDay = day;
      dirty = true;
      if (hour - config.calcHour < FIRE_WINDOW_HOURS) {
        await fireAdvice(zones);
      }
    }
    if (dirty) {
      await store.save();
    }
  }

  async function fireAdvice(zones) {
    for (const zone of zones) {
      const zoneAdvice = advice.get(zone.slot);
      if (zoneAdvice.water <= 0) {
        continue;
      }
      const data = {
        device: zoneIds(gladys, zone.slot).device,
        zone: displayName(zone),
        water_mm: zoneAdvice.water,
        duration_minutes: zoneAdvice.duration ?? 0,
      };
      try {
        await gladys.publishSceneEvent(TRIGGER_KEY, data);
        logger.debug(`Trigger ${TRIGGER_KEY}: ${data.zone}, ${data.water_mm} mm`);
        eventsLog.ok();
      } catch (err) {
        eventsLog.fail(err);
      }
    }
  }

  // One computation at a time: the loop, a poll, an action and a config
  // change can meet.
  function serialize(task) {
    const run = queue.then(task);
    queue = run.catch(() => {});
    return run;
  }

  function tick() {
    return serialize(compute)
      .then(() => computeLog.ok())
      .catch((err) => computeLog.fail(err));
  }

  function startLoop() {
    stopLoop();
    timer = setInterval(() => tick(), tickMs);
    timer.unref?.();
  }

  function stopLoop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  async function publishDevices() {
    await gladys.publishDiscoveredDevices(buildDevices(gladys, config));
  }

  /** Mark zones watered: `amount` mm, or a full ration (null). */
  async function markWatered(zones, amount, origin) {
    await serialize(async () => {
      for (const zone of zones) {
        store.state.balances[zone.slot] = applyWatering(balanceOf(zone), amount, zone);
      }
      await store.save();
    });
    const what = amount === null ? 'full ration' : `${amount} mm`;
    logger.info(`${zones.map((z) => z.name).join(', ')} watered (${what}) from ${origin}`);
    await tick();
    gladys.requestWidgetRefresh(WIDGET_KEY);
  }

  // --- Handlers ----------------------------------------------------------------

  gladys.onScanRequest(async () => {
    await publishDevices();
  });

  // Fallback only: the devices are published with should_poll: false.
  gladys.onPoll(async () => {
    await tick();
  });

  gladys.onSetValue(async (device, feature) => {
    throw new Error(`The irrigation sensors are read-only (${feature.external_id})`);
  });

  // The states of a feature not yet created were dropped by Gladys: the SDK
  // forgets them on creation, so the next computation sends everything again.
  gladys.onDeviceCreated(async () => {
    await tick();
    gladys.requestWidgetRefresh(WIDGET_KEY);
  });
  gladys.onDeviceUpdated(async () => gladys.requestWidgetRefresh(WIDGET_KEY));
  gladys.onDeviceDeleted(async () => gladys.requestWidgetRefresh(WIDGET_KEY));

  gladys.onConfigUpdated(async (raw) => {
    logger.info('Configuration updated');
    config = normalizeConfig(raw);
    await serialize(async () => {
      // A slot emptied forgets its balance: a new zone there starts afresh.
      const slots = new Set(config.zones.map((zone) => String(zone.slot)));
      for (const slot of Object.keys(store.state.balances)) {
        if (!slots.has(slot)) {
          delete store.state.balances[slot];
        }
      }
      await store.save();
    });
    await publishDevices();
    // The occasion to read the house again, in case its coordinates changed.
    lastLocationAttempt = 0;
    await tick();
    gladys.requestWidgetRefresh(WIDGET_KEY);
  });

  gladys.onAction('preview', async () => {
    await tick();
    if (!location) {
      return STATUS.noLocation;
    }
    if (config.zones.length === 0) {
      return allLanguages(TEXT, 'noZone');
    }
    if (!weather) {
      return allLanguages(TEXT, 'waiting');
    }
    return Object.fromEntries(
      Object.keys(TEXT).map((lang) => [
        lang,
        config.zones
          .map((zone) => `${displayName(zone)}: ${rowValue(advice.get(zone.slot), lang)}`)
          .join(' · '),
      ]),
    );
  });

  gladys.onSceneAction(SCENE_ACTION_KEY, async (fields = {}) => {
    let zones = config.zones;
    if (fields.device) {
      zones = config.zones.filter((zone) => zoneIds(gladys, zone.slot).device === fields.device);
      if (zones.length === 0) {
        throw new Error(`Unknown irrigation zone ${fields.device}`);
      }
    }
    const amount = parseDecimal(fields.amount);
    if (Number.isNaN(amount)) {
      throw new Error(`Unreadable amount of water: ${fields.amount}`);
    }
    await markWatered(zones, amount, 'a scene');
    return { zones: zones.length };
  });

  gladys.onWidgetGet(WIDGET_KEY, async ({ settings, language }) =>
    buildWidget({
      rows: config.zones
        .filter((zone) => advice.has(zone.slot))
        .map((zone) => ({
          slot: zone.slot,
          name: displayName(zone),
          advice: advice.get(zone.slot),
        })),
      weather,
      noLocation: location === false,
      noZone: config.zones.length === 0,
      language,
      settings,
    }),
  );

  gladys.onWidgetAction(WIDGET_KEY, async (actionKey) => {
    const slot = Number(WATERED_ACTION.exec(actionKey)?.[1]);
    const zone = config.zones.find((z) => z.slot === slot);
    if (!zone) {
      throw new Error(`Unknown widget action ${actionKey}`);
    }
    await markWatered([zone], null, 'the widget');
    return allLanguages(TEXT, 'wateredDone');
  });

  gladys.on('connected', async () => {
    config = normalizeConfig(await gladys.getConfig());
    await store.load();
    await publishDevices();
    await tick();
    startLoop();
  });

  gladys.on('disconnected', () => stopLoop());

  return {
    tick,
    stop: stopLoop,
    get store() {
      return store.state;
    },
    get advice() {
      return advice;
    },
  };
}
