import test from 'node:test';
import assert from 'node:assert/strict';
import { observationSeries } from '../web/js/observations.js';

const sample = (time, raw, extra = {}) => ({ station: 'LKPR', observedAt: time, raw, ...extra });
test('observed history keeps visibility bounds and missing ceilings distinct from zero', () => {
  const result = observationSeries({ metar: { history: [
    sample('2026-11-01T12:00:00Z', 'METAR LKPR 011200Z 02000KT 9999 SCT010 08/02 Q1029'),
    sample('2026-11-01T12:30:00Z', 'METAR LKPR 011230Z 02000KT 0500 VV000 08/02 Q1029'),
  ] } }, 'LKPR', Date.parse('2026-11-01T13:00:00Z'));
  assert.deepEqual(result.visibility, [10000, 500]);
  assert.deepEqual(result.visibilityQualifiers, ['at-least', 'reported']);
  assert.deepEqual(result.ceiling, [null, 0]);
  assert.deepEqual(result.wind, [0, 0]);
});
test('history excludes other stations, future anomalies and absent reports and chooses a correction', () => {
  const old = sample('2026-11-01T12:00:00Z', 'METAR LKPR 011200Z 00000KT 0500 BKN010 08/02 Q1029');
  const correction = { ...old, corrected: true, raw: 'METAR COR LKPR 011200Z 00000KT 1000 BKN012 08/02 Q1029' };
  const result = observationSeries({ metar: { history: [
    old, { ...old, station: 'LOWL' }, { ...old, observedAt: '2026-11-02T12:00:00Z' },
    { ...old, nil: true }, correction,
  ] } }, 'LKPR', Date.parse('2026-11-01T13:00:00Z'));
  assert.equal(result.times.length, 1);
  assert.equal(result.visibility[0], 1000);
  assert.equal(result.ceiling[0], 1200);
});
