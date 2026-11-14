// -----------------------------------------------------------------------------
// Dashboard widget "irrigation": today's ET0 and rain, every zone with the
// water to bring and the advised time, and one button per zone to mark it
// watered (each block can be hidden from the widget settings).
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { TEXT, STATUS, pick, formatNumber } from './i18n.js';

export const WIDGET_KEY = 'irrigation';
export const WATERED_ACTION = /^watered_(\d)$/;

export function rowValue(advice, language) {
  const t = pick(TEXT, language);
  if (advice.skipped) {
    return t.rain;
  }
  if (advice.water === 0) {
    return t.noWater;
  }
  const water = `${formatNumber(advice.water, language)} mm`;
  return advice.duration !== null ? `${water} · ${advice.duration} min` : water;
}

/**
 * @param {{ rows: Array<{ slot: number, name: string, advice: object }>,
 *   weather: { et0Today: number|null, rainToday: number|null }|null,
 *   noLocation?: boolean, noZone?: boolean, language: string, settings: object }} input
 *   `weather` is null until the first forecast.
 */
export function buildWidget({
  rows,
  weather,
  noLocation = false,
  noZone = false,
  language,
  settings = {},
}) {
  const t = pick(TEXT, language);
  const components = [];
  if (noLocation) {
    components.push({ type: 'text', variant: 'body', text: pick(STATUS.noLocation, language) });
    return { ttl_seconds: 300, components };
  }
  if (noZone) {
    components.push({ type: 'text', variant: 'body', text: t.noZone });
    return { ttl_seconds: 300, components };
  }
  if (!weather) {
    components.push({ type: 'text', variant: 'caption', text: t.waiting });
    return { ttl_seconds: 60, components };
  }
  if (settings.show_weather !== false && weather.et0Today !== null) {
    const rain = weather.rainToday ?? 0;
    components.push({
      type: 'text',
      variant: 'caption',
      text: t.weatherLine
        .replace('{et0}', formatNumber(weather.et0Today, language))
        .replace('{rain}', formatNumber(rain, language)),
    });
  }
  components.push({
    type: 'status',
    items: rows.map(({ name, advice }) => ({
      label: name.slice(0, 40),
      value: rowValue(advice, language).slice(0, 40),
      icon: advice.skipped ? 'cloud-rain' : advice.water > 0 ? 'droplet' : 'check-circle',
      color: advice.water > 0 ? WIDGET_COLORS.WARNING : WIDGET_COLORS.SUCCESS,
    })),
  });
  if (settings.show_buttons !== false) {
    for (const { slot, name } of rows) {
      components.push({
        type: 'button',
        label: t.wateredButton.replace('{name}', name).slice(0, 40),
        icon: 'droplet',
        style: 'secondary',
        // One key per zone: the core drops a button whose key is taken.
        action: { key: `watered_${slot}` },
      });
    }
  }
  return { ttl_seconds: 300, components };
}
