// -----------------------------------------------------------------------------
// Integration configuration: defaults (mirroring the manifest `default`s) and
// normalization, so the rest of the code never deals with strings or holes.
//
// The zones live in four fixed slots (zone_1_* … zone_4_*): the slot number is
// the stable id of the device, whatever name the user types later. A zone
// exists when its name is filled in.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];
export const ZONE_SLOTS = [1, 2, 3, 4];

// Crop coefficients (Kc) of the zone types: mid-season values of FAO-56
// (table 12, turf and vegetables) and of the landscape coefficients used for
// gardens (ornamental beds, established shrubs). A typed Kc wins.
export const CROP_KC = {
  lawn: 0.85,
  vegetables: 1,
  flowers: 0.75,
  shrubs: 0.5,
};

export const DEFAULT_CONFIG = {
  language: 'fr',
  rain_threshold: '5',
  calc_hour: 5,
  zone_1_crop: 'lawn',
  zone_1_reserve: 25,
  zone_2_crop: 'lawn',
  zone_2_reserve: 25,
  zone_3_crop: 'lawn',
  zone_3_reserve: 25,
  zone_4_crop: 'lawn',
  zone_4_reserve: 25,
};

/**
 * Read a decimal typed by the user ("12", "7,5"): null when empty,
 * NaN when unreadable.
 */
export function parseDecimal(raw) {
  if (raw === undefined || raw === null) {
    return null;
  }
  const text = String(raw).trim().replace(',', '.');
  if (text === '') {
    return null;
  }
  return /^\d+(\.\d+)?$/.test(text) ? Number(text) : NaN;
}

function clampInteger(value, fallback, min, max) {
  const number = Number(value);
  if (value === undefined || value === null || value === '' || !Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(number)));
}

/**
 * Application rate of a zone, in mm/h: the typed rate, else the flow spread
 * over the area (1 L on 1 m² is 1 mm).
 */
function applicationRate(rate, flow, area) {
  if (rate !== null) {
    return rate > 0 ? rate : null;
  }
  if (flow !== null && area !== null && flow > 0 && area > 0) {
    return (flow * 60) / area;
  }
  return null;
}

/**
 * Merge the user config with the defaults and parse the zones.
 * @returns {{ language: string, rainThreshold: number, calcHour: number,
 *   zones: Array<{ slot: number, name: string, crop: string, kc: number,
 *   rate: number|null, reserve: number }>, invalid: number[] }}
 *   `rate` in mm/h (null: unknown, no advised duration); `invalid`: the slots
 *   whose numbers cannot be read, left out.
 */
export function normalizeConfig(raw = {}) {
  const merged = { ...DEFAULT_CONFIG, ...raw };
  const zones = [];
  const invalid = [];
  for (const slot of ZONE_SLOTS) {
    const name = String(merged[`zone_${slot}_name`] ?? '').trim();
    if (name === '') {
      continue;
    }
    const crop = merged[`zone_${slot}_crop`] in CROP_KC ? merged[`zone_${slot}_crop`] : 'lawn';
    const kc = parseDecimal(merged[`zone_${slot}_kc`]);
    const rate = parseDecimal(merged[`zone_${slot}_rate`]);
    const flow = parseDecimal(merged[`zone_${slot}_flow`]);
    const area = parseDecimal(merged[`zone_${slot}_area`]);
    if ([kc, rate, flow, area].some((value) => Number.isNaN(value)) || kc > 2) {
      invalid.push(slot);
      continue;
    }
    zones.push({
      slot,
      name,
      crop,
      kc: kc ?? CROP_KC[crop],
      rate: applicationRate(rate, flow, area),
      reserve: clampInteger(merged[`zone_${slot}_reserve`], 25, 0, 200),
    });
  }
  const threshold = parseDecimal(merged.rain_threshold);
  return {
    language: LANGUAGES.includes(merged.language) ? merged.language : DEFAULT_CONFIG.language,
    // 0: the forecast rain never cancels the watering; unreadable: the default.
    rainThreshold: Number.isFinite(threshold) ? threshold : Number(DEFAULT_CONFIG.rain_threshold),
    calcHour: clampInteger(merged.calc_hour, DEFAULT_CONFIG.calc_hour, 0, 23),
    zones,
    invalid,
  };
}
