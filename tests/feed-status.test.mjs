import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeFeedState } from '../web/js/feed-status.js';

const NOW = Date.parse('2026-11-02T14:00:00Z');
const loaded = (overrides = {}) => ({ status: 'ok', transportStatus: 'ok', retrievedAt: '2026-11-02T13:59:00Z', coverageComplete: true, items: [], ...overrides });
const state = feed => summarizeFeedState(feed, { now: NOW });

test('fresh missing coverage is not retained or stale data', () => {
  for (const coverage of [
    { status: 'partial' },
    { coverageComplete: false },
    { coverageStatus: 'partial' },
    { missingStations: ['LKHS'] },
    { missingFirs: ['LOVV'] },
  ]) {
    assert.deepEqual(state(loaded(coverage)), {
      label: 'Neúplné pokrytí', attention: true, missing: true, retained: false, old: false, unavailable: false, transportPartial: false,
    });
  }
});

test('a partly failed refresh can still contain fresh reports', () => {
  const result = state(loaded({ status: 'partial', transportStatus: 'partial', coverageComplete: false, items: [{ station: 'LKCS', transportStatus: 'ok' }] }));
  assert.equal(result.label, 'Část obnovy selhala');
  assert.equal(result.transportPartial, true);
  assert.equal(result.missing, true);
  assert.equal(result.retained, false);
  assert.equal(result.old, false);
});

test('actual retained items remain explicit in a feed with a recent successful part', () => {
  const result = state(loaded({ status: 'partial', transportStatus: 'partial', items: [{ transportStatus: 'ok' }, { transportStatus: 'stale' }] }));
  assert.equal(result.label, 'Místní kopie · obnova nepotvrzena');
  assert.equal(result.retained, true);
  assert.equal(result.transportPartial, true);
  assert.equal(result.old, false);
});

test('feed stale status and restored feed/items identify retained data without consulting error prose', () => {
  for (const evidence of [
    { status: 'stale', transportStatus: 'unavailable' },
    { transportStatus: 'stale' },
    { restoredFromCache: true },
    { items: [{ restoredFromCache: true }] },
  ]) {
    const result = state(loaded(evidence));
    assert.equal(result.retained, true);
    assert.equal(result.label, 'Místní kopie · obnova nepotvrzena');
  }
});

test('missing or invalid retrieval times are unconfirmed, without inventing a retained copy', () => {
  for (const retrievedAt of [undefined, null, '', ' ', 'not-a-time', NaN, Infinity]) {
    const result = state(loaded({ retrievedAt }));
    assert.equal(result.old, true);
    assert.equal(result.attention, true);
    assert.equal(result.retained, false);
    assert.equal(result.label, 'Aktuálnost načtení neověřena');
  }
});

test('retrieval age uses the supplied clock and the strict one-hour boundary', () => {
  const atHour = state(loaded({ retrievedAt: new Date(NOW - 3600000).toISOString() }));
  const beyondHour = state(loaded({ retrievedAt: new Date(NOW - 3600001).toISOString() }));
  assert.equal(atHour.old, false);
  assert.equal(atHour.label, 'Načteno');
  assert.equal(beyondHour.old, true);
  assert.equal(beyondHour.retained, false);
  const zero = summarizeFeedState(loaded({ retrievedAt: 0 }), { now: 0 });
  assert.equal(zero.old, false);
  assert.equal(zero.label, 'Načteno');
});

test('an unavailable feed is distinct from an empty successful response', () => {
  for (const feed of [null, undefined, loaded({ status: 'unavailable', transportStatus: 'unavailable', retrievedAt: null })]) {
    const result = state(feed);
    assert.equal(result.unavailable, true);
    assert.equal(result.label, 'Nedostupný zdroj');
    assert.equal(result.attention, true);
  }
  assert.equal(state(loaded({ items: [] })).unavailable, false);
  assert.equal(state(loaded({ items: [] })).label, 'Načteno');
});

test('source-specific error text and bulletin issue/observation dates do not become transport states', () => {
  const feed = loaded({ error: 'stale missing expired unavailable', items: [{ issuedAt: '2020-01-01T00:00:00Z', observedAt: '2020-01-01T00:00:00Z', cancelled: true, nil: true }] });
  const before = structuredClone(feed);
  assert.deepEqual(state(feed), {
    label: 'Načteno', attention: false, missing: false, retained: false, old: false, unavailable: false, transportPartial: false,
  });
  assert.deepEqual(feed, before);
});
