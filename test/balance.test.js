// The water balance, the advice and the reading of the configuration.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, advise, applyDay, applyWatering, localDay, FLOOR } from '../src/balance.js';
import { normalizeConfig, parseDecimal, CROP_KC } from '../src/config.js';

const lawn = { kc: 0.85, reserve: 25, rate: 10 };

test('a dry day subtracts Kc × ET0', () => {
  assert.equal(applyDay(0, { et0: 4, rain: 0 }, lawn), -3.4);
  assert.equal(applyDay(-3.4, { et0: 4, rain: 0 }, lawn), -6.8);
});

test('rain fills the deficit, then the reserve up to its cap', () => {
  assert.equal(applyDay(-6.8, { et0: 2, rain: 5 }, lawn), -3.5);
  assert.equal(applyDay(-2.7, { et0: 1, rain: 40 }, lawn), 25);
  // A storm on a zone without reserve keeps nothing.
  assert.equal(applyDay(0, { et0: 1, rain: 40 }, { ...lawn, reserve: 0 }), 0);
  // The reserve is spent before any watering is advised.
  assert.equal(applyDay(25, { et0: 5, rain: 0 }, lawn), 20.8);
});

test('a heat wave accumulates the deficit, floored at the feature bounds', () => {
  let balance = 0;
  for (let day = 0; day < 10; day += 1) {
    balance = applyDay(balance, { et0: 7.2, rain: 0 }, { ...lawn, kc: 1 });
  }
  assert.equal(balance, -72);
  assert.equal(applyDay(-FLOOR + 1, { et0: 7, rain: 0 }, lawn), -FLOOR);
});

test('watering brings the balance back to 0, or adds the amount given', () => {
  assert.equal(applyWatering(-12.4, null, lawn), 0);
  assert.equal(applyWatering(8, null, lawn), 8, 'a full ration keeps the reserve');
  assert.equal(applyWatering(-12.4, 5, lawn), -7.4);
  assert.equal(applyWatering(-12.4, 50, lawn), 25, 'capped by the reserve');
});

test('the advice: water, time from the rate, cancelled by the forecast rain', () => {
  const dry = { rainToday: 0, rainThreshold: 5 };
  assert.deepEqual(advise(-12.4, lawn, dry), { water: 12.4, duration: 75, skipped: false });
  assert.deepEqual(advise(3, lawn, dry), { water: 0, duration: 0, skipped: false });
  assert.deepEqual(advise(-12.4, { ...lawn, rate: null }, dry), {
    water: 12.4,
    duration: null,
    skipped: false,
  });
  const wet = { rainToday: 6.2, rainThreshold: 5 };
  assert.deepEqual(advise(-12.4, lawn, wet), { water: 0, duration: 0, skipped: true });
  assert.equal(advise(-12.4, lawn, { rainToday: 6.2, rainThreshold: 0 }).skipped, false);
  assert.equal(advise(-12.4, lawn, { rainToday: null, rainThreshold: 5 }).skipped, false);
});

test('local days follow the Gladys time zone and the calendar', () => {
  assert.deepEqual(localDay(new Date('2026-11-13T23:30:00Z'), 'Europe/Paris'), {
    day: '2026-11-14',
    hour: 0,
  });
  assert.deepEqual(localDay(new Date('2026-11-13T23:30:00Z'), 'America/New_York'), {
    day: '2026-11-13',
    hour: 18,
  });
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('the configuration reads decimals with a comma and derives the rate', () => {
  assert.equal(parseDecimal('7,5'), 7.5);
  assert.equal(parseDecimal(''), null);
  assert.ok(Number.isNaN(parseDecimal('abc')));
  const config = normalizeConfig({
    zone_1_name: 'Pelouse',
    zone_2_name: 'Potager',
    zone_2_crop: 'vegetables',
    zone_2_flow: '12',
    zone_2_area: '80',
    zone_3_name: 'Haie',
    zone_3_crop: 'shrubs',
    zone_3_kc: '0,4',
    zone_3_rate: '4',
    zone_3_flow: '12',
    zone_3_area: '80',
    zone_4_name: 'Massif',
    zone_4_rate: 'dix',
    rain_threshold: '2,5',
  });
  assert.deepEqual(
    config.zones.map(({ slot, kc, rate, reserve }) => ({ slot, kc, rate, reserve })),
    [
      { slot: 1, kc: CROP_KC.lawn, rate: null, reserve: 25 },
      { slot: 2, kc: 1, rate: 9, reserve: 25 },
      { slot: 3, kc: 0.4, rate: 4, reserve: 25 },
    ],
  );
  assert.deepEqual(config.invalid, [4]);
  assert.equal(config.rainThreshold, 2.5);
  assert.equal(config.calcHour, 5);
  assert.equal(config.language, 'fr');
});
