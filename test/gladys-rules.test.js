// -----------------------------------------------------------------------------
// Conformity with the Gladys core, on every device discovered: four zones of
// every type, with and without a rate, in the four languages of the names.
//
// The table (test/fixtures/gladys-feature-table.json) is extracted from the
// core code: a category/type couple missing there shows as "undefined" or
// without icon in Gladys, a poll frequency outside its list is a 400 on
// discovery, a feature without min/max is a 422 on "Add to Gladys".
// Do not loosen this test to make it pass: fix the integration.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createWorld } from './helpers/world.js';

const table = JSON.parse(
  await readFile(new URL('./fixtures/gladys-feature-table.json', import.meta.url), 'utf8'),
);

const FOUR = {
  zone_1_name: 'Pelouse',
  zone_1_rate: '10',
  zone_2_name: 'Potager',
  zone_2_crop: 'vegetables',
  zone_2_flow: '12',
  zone_2_area: '80',
  zone_3_name: 'Massif',
  zone_3_crop: 'flowers',
  zone_3_reserve: 0,
  zone_4_name: 'Haie',
  zone_4_crop: 'shrubs',
  zone_4_kc: '0,4',
};

const scenarios = [
  { label: 'French names', config: FOUR },
  { label: 'English names', config: { ...FOUR, language: 'en' } },
  { label: 'German names', config: { ...FOUR, language: 'de' } },
  { label: 'Spanish names', config: { ...FOUR, language: 'es' } },
];

for (const scenario of scenarios) {
  test(`every discovered device follows the Gladys rules (${scenario.label})`, async () => {
    const { gladys } = await createWorld({ config: scenario.config });
    const devices = gladys.fake.discoveredDevices;
    assert.equal(devices.length, 4);
    assert.equal(new Set(devices.map((d) => d.external_id)).size, 4, 'unique device ids');

    for (const device of devices) {
      const where = device.name;

      // should_poll: true if and only if poll_frequency is provided, in ms.
      if (device.poll_frequency === undefined) {
        assert.notEqual(device.should_poll, true, `${where}: should_poll without poll_frequency`);
      } else {
        assert.equal(device.should_poll, true, `${where}: poll_frequency without should_poll`);
        assert.ok(
          table.poll_frequencies_ms.includes(device.poll_frequency),
          `${where}: poll_frequency ${device.poll_frequency} is not one of ${table.poll_frequencies_ms}`,
        );
      }

      assert.ok(device.features.length > 0, `${where}: no feature`);
      const externalIds = new Set();
      const names = new Set();
      for (const feature of device.features) {
        const at = `${where} / ${feature.name}`;
        const pair = table.pairs[`${feature.category}/${feature.type}`];
        assert.ok(pair, `${at}: ${feature.category}/${feature.type} is not a couple Gladys knows`);
        assert.ok(
          pair.label_en && pair.label_fr && pair.icon,
          `${at}: couple without label or icon`,
        );

        assert.equal(typeof feature.min, 'number', `${at}: min must be a number`);
        assert.equal(typeof feature.max, 'number', `${at}: max must be a number`);
        assert.ok(
          Number.isFinite(feature.min) && Number.isFinite(feature.max),
          `${at}: finite min/max`,
        );
        assert.ok(feature.min <= feature.max, `${at}: min > max`);
        assert.equal(typeof feature.read_only, 'boolean', `${at}: read_only must be a boolean`);
        assert.equal(
          typeof feature.has_feedback,
          'boolean',
          `${at}: has_feedback must be a boolean`,
        );
        if (feature.unit !== undefined) {
          assert.ok(table.units.includes(feature.unit), `${at}: unknown unit ${feature.unit}`);
        }

        assert.ok(!externalIds.has(feature.external_id), `${at}: duplicate external_id`);
        externalIds.add(feature.external_id);
        assert.ok(!names.has(feature.name), `${at}: duplicate feature name on the device`);
        names.add(feature.name);
      }
    }
  });
}

test('every state published fits its feature', async () => {
  const { gladys, advance } = await createWorld({ config: FOUR });
  // Two days, every 30 minutes, and a watering.
  for (let i = 0; i < 96; i += 1) {
    await advance(30);
  }
  await gladys.fake.sceneAction('zone_watered', { amount: '40' });
  const features = new Map(
    gladys.fake.discoveredDevices.flatMap((d) => d.features).map((f) => [f.external_id, f]),
  );
  for (const state of gladys.fake.states) {
    const feature = features.get(state.device_feature_external_id);
    assert.ok(feature, `state on an unknown feature ${state.device_feature_external_id}`);
    if (feature.category === 'text') {
      assert.ok(typeof state.text === 'string' && state.text.length > 0, 'a text is never empty');
    } else {
      assert.ok(
        state.state >= feature.min && state.state <= feature.max,
        `${feature.name}: ${state.state} outside ${feature.min}-${feature.max}`,
      );
    }
  }
});
