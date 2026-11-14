// -----------------------------------------------------------------------------
// Open-Meteo forecast API (free, no key, non-commercial use): the daily
// reference evapotranspiration (ET0, FAO-56 Penman-Monteith) and the daily
// precipitation sum, for the last seven days and the next two.
// https://open-meteo.com/en/docs
// -----------------------------------------------------------------------------

export const API_URL = 'https://api.open-meteo.com/v1/forecast';
export const PAST_DAYS = 7;
const TIMEOUT_MS = 20000;

export function buildUrl({ latitude, longitude }, timeZone) {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    daily: 'et0_fao_evapotranspiration,precipitation_sum',
    past_days: String(PAST_DAYS),
    forecast_days: '2',
    timezone: timeZone || 'auto',
  });
  return `${API_URL}?${params}`;
}

/**
 * The daily series by local day: { "2026-07-01": { et0, rain } }. A day the
 * model has no value for is left out.
 */
export function parseDaily(body) {
  const daily = body?.daily;
  if (!daily || !Array.isArray(daily.time)) {
    throw new Error('Open-Meteo answered without daily data');
  }
  const days = {};
  daily.time.forEach((day, index) => {
    const et0 = daily.et0_fao_evapotranspiration?.[index];
    const rain = daily.precipitation_sum?.[index];
    if (Number.isFinite(et0) && Number.isFinite(rain)) {
      days[day] = { et0, rain };
    }
  });
  return days;
}

export async function fetchDaily(location, timeZone, { fetchImpl = globalThis.fetch } = {}) {
  let response;
  try {
    response = await fetchImpl(buildUrl(location, timeZone), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const reason = err?.name === 'TimeoutError' ? 'timeout' : err?.cause?.code || err?.message;
    throw new Error(`Open-Meteo unreachable (${reason})`, { cause: err });
  }
  if (!response.ok) {
    let detail = '';
    try {
      detail = (await response.json())?.reason ?? '';
    } catch {
      // Not JSON: the status says enough.
    }
    throw new Error(`Open-Meteo HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
  }
  return parseDaily(await response.json());
}
