// The whole application against the SDK's fake Gladys and recorded Open-Meteo
// answers: balances, advice, trigger, scene action, widget, failures, quiet
// logs. The clock is injected; the local days are those of Europe/Paris.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createWorld, fixture } from './helpers/world.js';
import { zoneIds } from '../src/devices.js';
import { STATUS } from '../src/i18n.js';

async function savedState(state) {
  const dir = await mkdtemp(path.join(tmpdir(), 'arrosage-'));
  await writeFile(path.join(dir, 'state.json'), JSON.stringify(state));
  return dir;
}

const lastState = (gladys, slot, key) => gladys.fake.lastState(zoneIds(gladys, slot).feature(key));

test('the first start counts yesterday and publishes the advice (Toulouse, real data)', async () => {
  const { gladys, app, api } = await createWorld();
  // 13/11: 0.2 mm of rain, ET0 0.91 mm × Kc 0.85 = 0.77 mm: 0.6 mm short.
  assert.equal(lastState(gladys, 1, 'balance'), -0.6);
  assert.equal(lastState(gladys, 1, 'water'), 0.6);
  assert.equal(lastState(gladys, 1, 'duration'), 4, '0.6 mm at 10 mm/h, rounded up');
  assert.equal(lastState(gladys, 1, 'et0-yesterday'), 0.9);
  assert.equal(lastState(gladys, 1, 'et0-today'), 1.1);
  assert.equal(lastState(gladys, 1, 'rain-today'), 1.4);
  assert.equal(app.store.lastDay, '2026-11-13');
  assert.deepEqual(gladys.fake.connectionStatus, { connected: true });
  assert.equal(api.urls.length, 1);
  assert.match(api.urls[0], /latitude=43\.6047&longitude=1\.4442/);
  assert.deepEqual(
    gladys.fake.discoveredDevices.map((d) => d.name),
    ['Pelouse'],
  );
});

test('the trigger fires once at the computation hour, never twice after a restart', async () => {
  const { gladys, advance, dataDir } = await createWorld();
  assert.equal(gladys.fake.sceneEvents.length, 0, 'not before 5:00');
  await advance(60); // 05:00 local
  assert.deepEqual(gladys.fake.sceneEvents, [
    {
      key: 'watering_advised',
      data: {
        device: zoneIds(gladys, 1).device,
        zone: 'Pelouse',
        water_mm: 0.6,
        duration_minutes: 4,
      },
    },
  ]);
  await advance(5);
  await advance(5);
  assert.equal(gladys.fake.sceneEvents.length, 1);
  const restarted = await createWorld({ at: '2026-11-14T04:20:00Z', dataDir });
  assert.equal(restarted.gladys.fake.sceneEvents.length, 0);
  assert.equal(lastState(restarted.gladys, 1, 'balance'), -0.6, 'balance kept on restart');
});

test('a start long after the computation hour does not fire the trigger', async () => {
  const { gladys, advance, app } = await createWorld({ at: '2026-11-14T13:00:00Z' });
  await advance(5);
  assert.equal(gladys.fake.sceneEvents.length, 0);
  assert.equal(app.store.adviceDay, '2026-11-14');
});

test('the days missed while stopped are counted on the next computation', async () => {
  const dataDir = await savedState({ balances: { 1: -2 }, lastDay: '2026-11-09' });
  const { gladys, app, advance } = await createWorld({ dataDir });
  assert.equal(app.store.lastDay, '2026-11-09', 'waits for the computation hour');
  await advance(60);
  // 10/11 to 13/11, Kc 0.85: -3.4, -4.6, -2.9, -3.5 mm.
  assert.equal(app.store.lastDay, '2026-11-13');
  assert.equal(lastState(gladys, 1, 'balance'), -3.5);
  assert.equal(gladys.fake.sceneEvents[0].data.water_mm, 3.5);
});

test('a downtime longer than the history skips the unknown days, with one warning', async () => {
  const dataDir = await savedState({ balances: { 1: -1 }, lastDay: '2026-10-01' });
  const { app, advance, logger } = await createWorld({ dataDir });
  await advance(60);
  assert.equal(app.store.lastDay, '2026-11-13');
  const warnings = logger.lines.filter((l) => l.level === 'warn');
  assert.equal(warnings.length, 1);
  assert.match(warnings[0].message, /from 2026-10-02 to 2026-11-06/);
});

test('a typo in a zone keeps its balance until fixed', async () => {
  const dataDir = await savedState({ balances: { 1: -7 }, lastDay: '2026-11-13' });
  const { gladys, app } = await createWorld({ dataDir });
  await gladys.fake.configUpdated({ zone_1_name: 'Pelouse', zone_1_area: '12a' });
  assert.equal(app.store.balances[1], -7);
  assert.equal(gladys.fake.connectionStatus.connected, false);
  await gladys.fake.configUpdated({ zone_1_name: 'Pelouse', zone_1_rate: '10' });
  assert.equal(lastState(gladys, 1, 'balance'), -7);
  assert.deepEqual(gladys.fake.connectionStatus, { connected: true });
});

test('a day missing from the series is skipped once the trigger window is over', async () => {
  const body = await fixture('open-meteo-toulouse');
  const index = body.daily.time.indexOf('2026-11-13');
  body.daily.et0_fao_evapotranspiration[index] = null;
  const dataDir = await savedState({ balances: { 1: -1 }, lastDay: '2026-11-11' });
  const { app, advance, logger } = await createWorld({ dataDir, response: body });
  await advance(60); // 05:00: 12/11 counted, 13/11 awaited
  assert.equal(app.store.lastDay, '2026-11-12');
  await advance(120); // 07:00
  assert.equal(app.store.lastDay, '2026-11-13');
  assert.ok(logger.lines.some((l) => /No weather data for 2026-11-13/.test(l.message)));
});

test('the next day is counted the next morning from a fresh reading', async () => {
  const { gladys, app, api, advance } = await createWorld();
  await advance(24 * 60); // 15/11, 04:00
  assert.equal(app.store.lastDay, '2026-11-13', 'not before 5:00');
  assert.ok(api.urls.length >= 2, 'read again on a new day');
  await advance(60);
  // 14/11 (recorded as the forecast): -0.6 + 1.4 - 0.9 = -0.1 mm.
  assert.equal(app.store.lastDay, '2026-11-14');
  assert.equal(lastState(gladys, 1, 'balance'), -0.1);
});

test('rain forecast above the threshold cancels the watering and the trigger', async () => {
  const { gladys, advance, app } = await createWorld({
    config: { zone_1_name: 'Pelouse', zone_1_rate: '10', rain_threshold: '1' },
  });
  await advance(60);
  assert.equal(lastState(gladys, 1, 'water'), 0);
  assert.equal(lastState(gladys, 1, 'duration'), 0);
  assert.equal(lastState(gladys, 1, 'balance'), -0.6, 'the deficit stays in the balance');
  assert.equal(gladys.fake.sceneEvents.length, 0);
  assert.equal(app.advice.get(1).skipped, true);
});

test('a big rain fills the reserve, which then holds back the advice (Lille, real data)', async () => {
  const dataDir = await savedState({ balances: { 1: -3 }, lastDay: '2026-11-08' });
  const { gladys, advance } = await createWorld({
    response: await fixture('open-meteo-lille'),
    config: { zone_1_name: 'Massif', zone_1_crop: 'flowers', zone_1_reserve: 5 },
    dataDir,
  });
  await advance(60);
  // 10/11: 10.6 mm, capped at 5 mm of reserve, then three dry-ish days.
  const balance = lastState(gladys, 1, 'balance');
  assert.ok(balance > 3 && balance <= 5, `balance ${balance}`);
  assert.equal(lastState(gladys, 1, 'water'), 0);
  assert.equal(gladys.fake.lastState(zoneIds(gladys, 1).feature('duration')), undefined);
  assert.equal(gladys.fake.sceneEvents.length, 0);
});

test('the "zone watered" scene action resets a zone, or adds the amount given', async () => {
  const config = {
    zone_1_name: 'Pelouse',
    zone_1_rate: '10',
    zone_2_name: 'Potager',
    zone_2_crop: 'vegetables',
  };
  const { gladys, dataDir } = await createWorld({ config });
  assert.equal(lastState(gladys, 2, 'balance'), -0.7, 'Kc 1 for a vegetable garden');
  const potager = zoneIds(gladys, 2).device;
  let ack = await gladys.fake.sceneAction('zone_watered', { device: potager, amount: '0,4' });
  assert.equal(ack.success, true, ack.error);
  assert.deepEqual(ack.data.outputs, { zones: 1 });
  assert.equal(lastState(gladys, 2, 'balance'), -0.3);
  assert.equal(lastState(gladys, 1, 'balance'), -0.6, 'the other zone is untouched');
  ack = await gladys.fake.sceneAction('zone_watered', {});
  assert.equal(ack.success, true, ack.error);
  assert.equal(lastState(gladys, 1, 'water'), 0);
  assert.equal(lastState(gladys, 2, 'water'), 0);
  const saved = JSON.parse(await readFile(path.join(dataDir, 'state.json'), 'utf8'));
  assert.deepEqual(saved.balances, { 1: 0, 2: 0 });
  ack = await gladys.fake.sceneAction('zone_watered', { device: potager, amount: 'beaucoup' });
  assert.equal(ack.success, false);
});

test('the widget lists the zones and marks one watered from its button', async () => {
  const config = {
    zone_1_name: 'Pelouse',
    zone_1_rate: '10',
    zone_3_name: 'Haie',
    zone_3_crop: 'shrubs',
  };
  const { gladys } = await createWorld({ config });
  const ack = await gladys.fake.widgetGet('irrigation', { settings: {}, language: 'fr' });
  assert.equal(ack.success, true, ack.error);
  const content = ack.data.content;
  assert.doesNotThrow(() => validateWidgetContent(content));
  assert.deepEqual(
    content.components.map((c) => c.type),
    ['text', 'status', 'button', 'button'],
  );
  assert.equal(content.components[0].text, "Aujourd'hui : ET0 1,1 mm · pluie 1,4 mm");
  assert.deepEqual(
    content.components[1].items.map((i) => [i.label, i.value]),
    [
      ['Pelouse', '0,6 mm · 4 min'],
      ['Haie', '0,3 mm'],
    ],
  );
  assert.deepEqual(content.components[3].action, { key: 'watered_3' });

  const action = await gladys.fake.widgetAction('irrigation', 'watered_3', {});
  assert.equal(action.success, true, action.error);
  assert.equal(lastState(gladys, 3, 'water'), 0);
  assert.equal(lastState(gladys, 1, 'water'), 0.6);

  const hidden = await gladys.fake.widgetGet('irrigation', {
    settings: { show_weather: false, show_buttons: false },
    language: 'en',
  });
  assert.deepEqual(
    hidden.data.content.components.map((c) => c.type),
    ['status'],
  );
});

test('Open-Meteo down: one warning, a status message, recovery after 15 minutes', async () => {
  const { gladys, api, advance, logger } = await createWorld({ created: true });
  api.fail = 'ENOTFOUND';
  await advance(3 * 60);
  assert.deepEqual(gladys.fake.connectionStatus, {
    connected: false,
    message: STATUS.apiError,
  });
  const calls = api.urls.length;
  await advance(5);
  assert.equal(api.urls.length, calls, 'no retry before 15 minutes');
  await advance(5);
  assert.equal(logger.lines.filter((l) => l.level === 'warn').length, 1);
  api.fail = null;
  await advance(10);
  assert.deepEqual(gladys.fake.connectionStatus, { connected: true });
  assert.ok(logger.lines.some((l) => l.level === 'info' && /works again/.test(l.message)));
});

test('a status Gladys refuses does not hold back the advice, and is sent again', async () => {
  const { gladys, api, advance, logger } = await createWorld();
  const original = gladys.setConnectionStatus.bind(gladys);
  let refuse = true;
  gladys.setConnectionStatus = async (...args) => {
    if (refuse) {
      throw new Error('HTTP 400');
    }
    return original(...args);
  };
  api.fail = 'ENOTFOUND';
  await advance(3 * 60);
  await advance(60); // 07:00, the computation went on
  assert.equal(lastState(gladys, 1, 'water'), 0.6);
  assert.equal(logger.lines.filter((l) => /Reporting the status/.test(l.message)).length, 1);
  refuse = false;
  await advance(5);
  assert.deepEqual(gladys.fake.connectionStatus.message, STATUS.apiError);
});

test('no located house: a status message, no request to Open-Meteo', async () => {
  const { gladys, api } = await createWorld({ houses: [] });
  assert.deepEqual(gladys.fake.connectionStatus, {
    connected: false,
    message: STATUS.noLocation,
  });
  assert.equal(api.urls.length, 0);
});

test('a normal cycle publishes only what changed and writes nothing at info level', async () => {
  const { gladys, advance, logger } = await createWorld();
  const infoBefore = logger.lines.filter((l) => l.level === 'info').length;
  const before = gladys.fake.states.length;
  for (let i = 0; i < 12; i += 1) {
    await advance(5);
  }
  assert.equal(gladys.fake.states.length, before, 'nothing changed in an hour');
  assert.equal(logger.lines.filter((l) => l.level === 'info').length, infoBefore);
  assert.equal(logger.lines.filter((l) => l.level === 'warn' || l.level === 'error').length, 0);
});

test('the states of a device added later are published on its creation', async () => {
  const { gladys } = await createWorld({ created: false });
  assert.equal(gladys.fake.states.length, 0, 'nothing for a device not added');
  const [device] = gladys.fake.discoveredDevices;
  gladys.fake.devices = [device];
  await gladys.fake.deviceCreated(device);
  assert.equal(lastState(gladys, 1, 'water'), 0.6);
  assert.ok(gladys.fake.widgetRefreshes.includes('irrigation'));
});

test('the preview action sums up every zone', async () => {
  const { gladys } = await createWorld();
  const ack = await gladys.fake.action('preview', {});
  assert.equal(ack.success, true, ack.error);
  const message = ack.data.message;
  assert.equal(message.fr, 'Pelouse: 0,6 mm · 4 min');
  assert.equal(message.en, 'Pelouse: 0.6 mm · 4 min');
});
