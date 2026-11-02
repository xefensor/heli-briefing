import test from 'node:test';
import assert from 'node:assert/strict';
import { adjacentProcessedTime } from '../web/js/processed-ceiling-controls.js';

const hours = [11, 12, 13, 14, 15, 16].map(hour => `2026-11-02T${hour}:00:00.000Z`);

test('processed chart arrows use the nearest loaded hour and break half-hour ties earlier', () => {
  assert.equal(adjacentProcessedTime(hours, '2026-11-02T12:30:00Z', 1), hours[2]);
  assert.equal(adjacentProcessedTime(hours, '2026-11-02T12:30:00Z', -1), hours[0]);
  assert.equal(adjacentProcessedTime(hours, '2026-11-02T12:30:01Z', 1), hours[3]);
  assert.equal(adjacentProcessedTime(hours, '2026-11-02T12:30:01Z', -1), hours[1]);
  assert.equal(adjacentProcessedTime(hours, '2026-11-02T13:00:00Z', -1), hours[1]);
});

test('arrow stepping remains within actual samples and does not fabricate a gap or extra hour', () => {
  assert.equal(adjacentProcessedTime(hours, hours[0], -1), hours[0]);
  assert.equal(adjacentProcessedTime(hours, hours.at(-1), 1), hours.at(-1));
  const partial = [hours[0], hours[2], hours[4]];
  assert.equal(adjacentProcessedTime(partial, hours[2], 1), hours[4]);
  assert.equal(adjacentProcessedTime(partial, hours[2], -1), hours[0]);
  assert.equal(adjacentProcessedTime([hours[0]], hours[0], 1), hours[0]);
});

test('unavailable or malformed chart axes cannot produce a selection', () => {
  for (const times of [[], null, {}, ['not a date'], [hours[1], hours[0]], [hours[0], hours[0]]]) assert.equal(adjacentProcessedTime(times, hours[0], 1), null);
  assert.equal(adjacentProcessedTime(hours, 'not a date', 1), null);
  assert.equal(adjacentProcessedTime(hours, hours[0], 0), null);
});
