// The Open-Meteo client, on responses recorded from the real API.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildUrl, fetchDaily, parseDaily } from '../src/openmeteo.js';
import { fixture } from './helpers/world.js';

test('the request asks for daily ET0 and rain, seven days back, in the Gladys time zone', () => {
  const url = new URL(buildUrl({ latitude: 50.62931, longitude: 3.057256 }, 'Europe/Paris'));
  assert.equal(url.origin + url.pathname, 'https://api.open-meteo.com/v1/forecast');
  assert.equal(url.searchParams.get('daily'), 'et0_fao_evapotranspiration,precipitation_sum');
  assert.equal(url.searchParams.get('past_days'), '7');
  assert.equal(url.searchParams.get('latitude'), '50.6293');
  assert.equal(url.searchParams.get('timezone'), 'Europe/Paris');
});

test('the recorded answers parse into daily ET0 and rain (Toulouse, Lille)', async () => {
  const toulouse = parseDaily(await fixture('open-meteo-toulouse'));
  assert.equal(Object.keys(toulouse).length, 9);
  assert.deepEqual(toulouse['2026-11-12'], { et0: 0.78, rain: 2.4 });
  const lille = parseDaily(await fixture('open-meteo-lille'));
  assert.deepEqual(lille['2026-11-10'], { et0: 0.62, rain: 10.6 });
});

test('a day without value is left out, a body without daily data is an error', () => {
  const days = parseDaily({
    daily: {
      time: ['2026-07-01', '2026-07-02'],
      et0_fao_evapotranspiration: [5.1, null],
      precipitation_sum: [0, 0],
    },
  });
  assert.deepEqual(Object.keys(days), ['2026-07-01']);
  assert.throws(() => parseDaily({ error: true }), /without daily data/);
});

test('HTTP and network errors say what happened', async () => {
  const badRequest = async () => ({
    ok: false,
    status: 400,
    json: async () => ({ error: true, reason: 'Latitude must be in range of -90 to 90°.' }),
  });
  await assert.rejects(
    fetchDaily({ latitude: 0, longitude: 0 }, 'UTC', { fetchImpl: badRequest }),
    /HTTP 400: Latitude must be/,
  );
  const offline = async () => {
    throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } });
  };
  await assert.rejects(
    fetchDaily({ latitude: 0, longitude: 0 }, 'UTC', { fetchImpl: offline }),
    /unreachable \(ENOTFOUND\)/,
  );
});
