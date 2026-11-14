// A fake Gladys (the SDK's own) around the application, with a settable clock,
// a fake Open-Meteo answering real recorded responses, a temporary /data and a
// logger that records what it writes.

import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { createApp } from '../../src/app.js';
import { buildDevices } from '../../src/devices.js';
import { normalizeConfig } from '../../src/config.js';

export const TOULOUSE = {
  id: 'h1',
  name: 'Home',
  selector: 'home',
  latitude: 43.6047,
  longitude: 1.4442,
};

export async function fixture(name) {
  return JSON.parse(await readFile(new URL(`../fixtures/${name}.json`, import.meta.url), 'utf8'));
}

export function recordingLogger() {
  const lines = [];
  const log = (level) => (message) => lines.push({ level, message: String(message) });
  return {
    lines,
    debug: log('debug'),
    info: log('info'),
    warn: log('warn'),
    error: log('error'),
  };
}

/**
 * @param {{ config?: object, houses?: object[], at?: string, created?: boolean,
 *   dataDir?: string, response?: object }} options `created`: the devices are
 *   already added in Gladys; `response`: the Open-Meteo body (Toulouse,
 *   recorded on 2026-11-14, by default).
 */
export async function createWorld({
  config = { zone_1_name: 'Pelouse', zone_1_rate: '10' },
  houses = [TOULOUSE],
  at = '2026-11-14T03:00:00Z',
  created = true,
  dataDir,
  response,
} = {}) {
  const clock = { now: new Date(at) };
  const api = { body: response ?? (await fixture('open-meteo-toulouse')), fail: null, urls: [] };
  const fetchImpl = async (url) => {
    api.urls.push(url);
    if (api.fail) {
      throw Object.assign(new TypeError('fetch failed'), { cause: { code: api.fail } });
    }
    return { ok: true, status: 200, json: async () => structuredClone(api.body) };
  };
  const dir = dataDir ?? (await mkdtemp(path.join(tmpdir(), 'arrosage-')));
  // The devices as Gladys stores them once added (same ids as discovery).
  const scratch = createFakeGladys();
  const devices = created ? buildDevices(scratch, normalizeConfig(config)) : [];
  const gladys = createFakeGladys({ config, houses, devices });
  const logger = recordingLogger();
  const app = createApp(gladys, {
    now: () => clock.now,
    dataDir: dir,
    logger,
    fetchImpl,
    timeZone: 'Europe/Paris',
  });
  await gladys.connect();
  app.stop(); // the tests drive the loop by hand
  const advance = async (minutes) => {
    clock.now = new Date(clock.now.getTime() + minutes * 60000);
    await app.tick();
  };
  return { gladys, app, clock, logger, api, dataDir: dir, advance };
}
