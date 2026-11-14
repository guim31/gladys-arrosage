// -----------------------------------------------------------------------------
// One Gladys device per zone, all features read-only sensors.
//
// `should_poll: false`: the values move a few times a day and the container
// recomputes them itself (src/app.js); `onPoll` stays a fallback.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as C,
  DEVICE_FEATURE_TYPES as T,
  DEVICE_FEATURE_UNITS as U,
} from '@gladysassistant/integration-sdk';
import { NAMES, pick } from './i18n.js';
import { FLOOR, round1 } from './balance.js';

export const DEVICE_TYPE = 'zone';

export function zoneIds(gladys, slot) {
  return gladys.externalIds(DEVICE_TYPE, `slot-${slot}`);
}

function feature(ids, key, name, category, type, extra) {
  return {
    name,
    external_id: ids.feature(key),
    category,
    type,
    read_only: true,
    has_feedback: false,
    keep_history: true,
    ...extra,
  };
}

export function buildDevice(gladys, zone, language) {
  const ids = zoneIds(gladys, zone.slot);
  const n = pick(NAMES, language);
  const depth = [C.LEVEL_SENSOR, T.LEVEL_SENSOR.LIQUID_DEPTH];
  const daily = [C.PRECIPITATION_SENSOR, T.SENSOR.DECIMAL];
  const perDay = { unit: U.MILLIMETER_PER_DAY };
  return {
    name: zone.name,
    external_id: ids.device,
    should_poll: false,
    features: [
      feature(ids, 'water', n.water, ...depth, { unit: U.MM, min: 0, max: FLOOR }),
      feature(ids, 'duration', n.duration, C.DURATION, T.DURATION.INTEGER, {
        unit: U.MINUTES,
        min: 0,
        max: 1440,
      }),
      // Signed: symmetric bounds, so that a gauge puts 0 in the middle.
      feature(ids, 'balance', n.balance, ...depth, { unit: U.MM, min: -FLOOR, max: FLOOR }),
      feature(ids, 'et0-yesterday', n.et0Yesterday, ...daily, { ...perDay, min: 0, max: 20 }),
      feature(ids, 'et0-today', n.et0Today, ...daily, { ...perDay, min: 0, max: 20 }),
      feature(ids, 'rain-today', n.rainToday, ...daily, { ...perDay, min: 0, max: 500 }),
    ],
  };
}

export function buildDevices(gladys, config) {
  return config.zones.map((zone) => buildDevice(gladys, zone, config.language));
}

/**
 * States of a zone device. `advice` from src/balance.js; `weather` holds the
 * ET0 and rain of yesterday and today (null: not known yet, nothing sent).
 */
export function zoneStates(gladys, zone, balance, advice, weather) {
  const ids = zoneIds(gladys, zone.slot);
  const states = [
    { device_feature_external_id: ids.feature('water'), state: advice.water },
    { device_feature_external_id: ids.feature('balance'), state: balance },
  ];
  // No rate configured: no duration rather than a misleading 0.
  if (advice.duration !== null) {
    states.push({ device_feature_external_id: ids.feature('duration'), state: advice.duration });
  }
  const optional = [
    ['et0-yesterday', weather.et0Yesterday],
    ['et0-today', weather.et0Today],
    ['rain-today', weather.rainToday],
  ];
  for (const [key, value] of optional) {
    if (value !== null) {
      states.push({ device_feature_external_id: ids.feature(key), state: round1(value) });
    }
  }
  return states;
}
