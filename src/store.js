// -----------------------------------------------------------------------------
// What the integration remembers across restarts, in /data/state.json:
//   - the water balance of every zone, in mm, keyed by slot;
//   - the last local day added to the balances;
//   - the last day the "watering advised" trigger was handled, so a restart
//     never fires it twice.
// -----------------------------------------------------------------------------

import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function createStore(dataDir, logger) {
  const file = path.join(dataDir, 'state.json');
  let state = { balances: {}, lastDay: null, adviceDay: null };

  return {
    get state() {
      return state;
    },

    async load() {
      try {
        const saved = JSON.parse(await readFile(file, 'utf8'));
        const balances = {};
        for (const [slot, value] of Object.entries(saved.balances ?? {})) {
          if (Number.isFinite(value)) {
            balances[slot] = value;
          }
        }
        state = {
          balances,
          lastDay: DAY.test(saved.lastDay) ? saved.lastDay : null,
          adviceDay: DAY.test(saved.adviceDay) ? saved.adviceDay : null,
        };
      } catch (err) {
        if (err.code !== 'ENOENT') {
          logger.warn(`Cannot read ${file}, starting afresh: ${err.message}`);
        }
      }
    },

    async save() {
      try {
        await mkdir(dataDir, { recursive: true });
        await writeFile(`${file}.tmp`, JSON.stringify(state));
        await rename(`${file}.tmp`, file);
      } catch (err) {
        logger.warn(`Cannot write ${file}: ${err.message}`);
      }
    },
  };
}
