// -----------------------------------------------------------------------------
// The water balance of a zone (the "bucket" of the Home Assistant
// smart_irrigation component), in mm of water:
//
//   balance(day) = min(reserve, balance(day - 1) + rain(day) - Kc × ET0(day))
//
// A negative balance is the water the soil lacks: the amount to bring. A
// positive balance is water kept in the soil, capped by the zone reserve. The
// deficit is floored at -FLOOR mm (the bounds of the device feature).
// -----------------------------------------------------------------------------

export const FLOOR = 500;
export const MAX_DURATION = 1440;

export const round1 = (value) => Math.round(value * 10) / 10;

/** The balance after one day of rain and evapotranspiration. */
export function applyDay(balance, { et0, rain }, { kc, reserve }) {
  const next = balance + rain - kc * et0;
  return round1(Math.min(reserve, Math.max(-FLOOR, next)));
}

/** The balance once the zone was watered: `amount` mm, or a full ration (back to 0). */
export function applyWatering(balance, amount, { reserve }) {
  if (amount === null || amount === undefined) {
    return Math.max(0, balance);
  }
  return round1(Math.min(reserve, balance + amount));
}

/**
 * Today's advice for a zone.
 * @param {number} balance in mm
 * @param {{ rate: number|null }} zone application rate in mm/h
 * @param {{ rainToday: number|null, rainThreshold: number }} weather
 * @returns {{ water: number, duration: number|null, skipped: boolean }}
 *   `water` in mm, `duration` in minutes (null without a known rate),
 *   `skipped`: watering cancelled by the forecast rain.
 */
export function advise(balance, zone, { rainToday, rainThreshold }) {
  const deficit = balance < 0 ? round1(-balance) : 0;
  const skipped =
    deficit > 0 && rainThreshold > 0 && rainToday !== null && rainToday >= rainThreshold;
  const water = skipped ? 0 : deficit;
  // The epsilon absorbs float noise (2.1 / 3 × 60 = 42.000…01); a day at most.
  const duration = zone.rate
    ? Math.min(MAX_DURATION, Math.max(0, Math.ceil((water / zone.rate) * 60 - 1e-9)))
    : null;
  return { water, duration, skipped };
}

// --- Local calendar days, as "YYYY-MM-DD" strings -------------------------------

/** The local day and hour of a date in a time zone. */
export function localDay(date, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

/** The day `offset` days after `day`. */
export function addDays(day, offset) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
}
