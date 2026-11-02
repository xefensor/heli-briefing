import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAviation, parseTacReport } from '../web/js/aviation-source.js';
import { AVIATION_CACHE_KEY, AVIATION_CACHE_MAX_BYTES, readAviationCache, writeAviationCache } from '../web/js/aviation-cache.js';

const NOW = Date.parse('2026-11-02T09:00:00Z');
const METAR = 'METAR LKCS 020830Z AUTO 34003KT 9999 OVC037/// 05/03 Q1029=';
const CANCELLED = 'TAF AMD LKCS 052206Z 0522/0606 CNL=';
const SIGMET = 'LKAA SIGMET U02 VALID 261435/261535 LKPW- LKAA PRAHA FIR SEV TURB FCST FL280/350 STNR WKN=';
function storage() {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}
async function fixture({ previous = null, time = NOW, metar = METAR } = {}) {
  const files = [
    { filename: 'LKCS_METAR.txt', format: 'txt', updated: '2026-11-02T08:32:01Z' },
    { filename: 'LKCS_TAF.txt', format: 'txt', updated: '2026-10-05T22:08:01Z' },
    { filename: 'LKAA_SIGMET.txt', format: 'txt', updated: '2026-10-26T14:30:01Z' },
  ];
  const bodies = { 'LKCS_METAR.txt': metar, 'LKCS_TAF.txt': CANCELLED, 'LKAA_SIGMET.txt': SIGMET };
  return fetchAviation({ previous, now: () => time, fetcher: async url => ({ ok: true, headers: new Headers(), text: async () => new URL(url).searchParams.get('action') === 'list' ? JSON.stringify({ status: 'success', files }) : bodies[new URL(url).searchParams.get('file')] }) });
}
function historical(at, station = 'LKCS') {
  const date = new Date(at), ddhhmm = date.toISOString().replace(/[-:T]/g, '').slice(6, 12);
  const filename = `${station}_METAR.txt`;
  return parseTacReport({ kind: 'metar', raw: `METAR ${station} ${ddhhmm}Z 00000KT CAVOK 05/03 Q1029=`, filename, updated: new Date(at + 30000).toISOString(), retrievedAt: new Date(NOW).toISOString(), sourceUrl: `https://swim.chmi.cz/api.php?action=get&file=${filename}&format=txt` });
}

test('restoring a direct cache preserves original evidence times and never establishes live transport', async () => {
  const target = storage(), snapshot = await fixture();
  snapshot.radar = { imageDataUrl: 'data:image/png;base64,not-cached', frames: [] };
  assert.deepEqual(writeAviationCache(snapshot, { storage: target, now: () => NOW }), { ok: true });
  const encoded = target.getItem(AVIATION_CACHE_KEY);
  assert.ok(!encoded.includes('imageDataUrl'));
  assert.ok(!encoded.includes('radar'));
  const restored = readAviationCache({ storage: target, now: () => NOW + 600000 });
  assert.equal(restored.generatedAt, snapshot.generatedAt);
  assert.equal(restored.cacheSavedAt, '2026-11-02T09:00:00.000Z');
  assert.equal(restored.restoredAt, '2026-11-02T09:10:00.000Z');
  for (const kind of ['metar', 'taf', 'sigmet']) {
    assert.equal(restored[kind].status, 'stale');
    assert.equal(restored[kind].transportStatus, 'stale');
    assert.equal(restored[kind].retrievedAt, snapshot[kind].retrievedAt);
    assert.equal(restored[kind].items[0].retrievedAt, snapshot[kind].items[0].retrievedAt);
    assert.equal(restored[kind].items[0].raw, snapshot[kind].items[0].raw);
    assert.equal(restored[kind].items[0].restoredFromCache, true);
    assert.equal(restored[kind].items[0].transportStatus, 'stale');
    assert.match(restored[kind].error, /živá obnova/);
  }
  assert.equal(restored.taf.items[0].issuedAt, '2026-10-05T22:06:00.000Z');
  assert.equal(restored.taf.items[0].cancelled, true);
  assert.equal(restored.sigmet.items[0].validTo, '2026-10-26T15:35:00.000Z');
  assert.equal(restored.sigmet.coverageComplete, false);
  assert.equal(restored.metar.historyStatus, 'stale');
  assert.equal(restored.metar.history[0].restoredFromCache, true);
  assert.equal(restored.metar.historyMethod, 'browser-observed');
  assert.ok(restored.metar.missingStations.includes('LOWW'));
});

test('only actual recent observations survive retention, with a maximum of 400 distinct source samples', async () => {
  const target = storage(), snapshot = await fixture();
  snapshot.metar.history = Array.from({ length: 500 }, (_, index) => historical(NOW - (600 - index) * 60000));
  snapshot.metar.history.push(historical(NOW - 13 * 3600000), historical(NOW + 60000));
  assert.equal(writeAviationCache(snapshot, { storage: target, now: NOW }).ok, true);
  const restored = readAviationCache({ storage: target, now: NOW });
  assert.equal(restored.metar.history.length, 400);
  assert.equal(new Set(restored.metar.history.map(item => `${item.station}:${item.observedAt}`)).size, 400);
  assert.ok(restored.metar.history.every(item => Date.parse(item.observedAt) >= NOW - 12 * 3600000 && Date.parse(item.observedAt) <= NOW));
  assert.equal(restored.metar.historyLimitReached, true);
  const aged = readAviationCache({ storage: target, now: NOW + 13 * 3600000 });
  assert.equal(aged.metar.history.length, 0);
  assert.equal(aged.metar.historyStatus, 'unavailable');
  assert.equal(aged.metar.items[0].observedAt, snapshot.metar.items[0].observedAt);
  assert.equal(aged.taf.items[0].raw, CANCELLED);
});

test('a fresh direct fetch can merge restored history while retaining the source coverage gap', async () => {
  const target = storage(), old = await fixture();
  writeAviationCache(old, { storage: target, now: NOW });
  const previous = readAviationCache({ storage: target, now: NOW + 60000 });
  const updated = await fixture({ previous, time: NOW + 60000, metar: METAR.replace('020830Z', '020832Z') });
  assert.equal(updated.metar.history.length, 2);
  assert.equal(updated.metar.transportStatus, 'ok');
  assert.equal(updated.metar.coverageComplete, false);
  assert.equal(writeAviationCache(updated, { storage: target, now: NOW + 60000 }).ok, true);
  const restored = readAviationCache({ storage: target, now: NOW + 60000 });
  assert.equal(restored.metar.history.length, 2);
  assert.equal(restored.metar.items[0].observedAt, '2026-11-02T08:32:00.000Z');
});

test('invalid providers, source URLs, report identities and embedded payloads cannot overwrite genuine cache', async () => {
  const target = storage(), valid = await fixture();
  writeAviationCache(valid, { storage: target, now: NOW });
  const original = target.getItem(AVIATION_CACHE_KEY);
  const mutations = [
    value => { value.provider = 'awc'; },
    value => { value.metar.sourceUrl = 'https://untrusted.example/api.php?action=list&format=txt'; },
    value => { value.metar.items[0].sourceUrl = 'https://swim.chmi.cz@untrusted.example/api.php?action=get&file=LKCS_METAR.txt&format=txt'; },
    value => { value.metar.items[0].sourceUrl += '&callback=bad'; },
    value => { value.metar.items[0].observedAt = '2026-11-02T08:31:00.000Z'; },
    value => { value.metar.items[0].station = 'LKPR'; },
    value => { value.metar.items[0].imageDataUrl = 'data:image/png;base64,payload'; },
    value => { value.metar.history[0].source = { image: 'private' }; },
    value => { value.sigmet.coverageComplete = true; },
    value => { value.generatedAt = '2026-02-31T09:00:00Z'; },
    value => { value.generatedAt = '2026-11-03T09:00:00Z'; },
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(valid); mutate(changed);
    assert.equal(writeAviationCache(changed, { storage: target, now: NOW }).ok, false);
    assert.equal(target.getItem(AVIATION_CACHE_KEY), original);
  }
  const malformed = JSON.parse(original); malformed.aviation.metar.items[0].sourceUrl = 'javascript:alert(1)';
  target.setItem(AVIATION_CACHE_KEY, JSON.stringify(malformed));
  assert.equal(readAviationCache({ storage: target, now: NOW }), null);
});

test('the byte budget rejects large valid reports before replacing an older snapshot', async () => {
  const target = storage(), valid = await fixture();
  writeAviationCache(valid, { storage: target, now: NOW });
  const original = target.getItem(AVIATION_CACHE_KEY), large = structuredClone(valid);
  large.metar.history = Array.from({ length: 30 }, (_, index) => {
    const item = historical(NOW - (index + 1) * 60000);
    return parseTacReport({ kind: 'metar', raw: `${item.raw.slice(0, -1)} RMK ${'A'.repeat(30000)}=`, filename: item.sourceFilename, updated: item.sourceUpdatedAt, sourceUrl: item.sourceUrl, retrievedAt: item.retrievedAt });
  });
  const result = writeAviationCache(large, { storage: target, now: NOW });
  assert.equal(result.ok, false);
  assert.match(result.error, /750 kB/);
  assert.equal(target.getItem(AVIATION_CACHE_KEY), original);
  target.setItem(AVIATION_CACHE_KEY, 'x'.repeat(AVIATION_CACHE_MAX_BYTES + 1));
  assert.equal(readAviationCache({ storage: target, now: NOW }), null);
});

test('unavailable or malformed storage is graceful, and a transient empty failure does not erase saved evidence', async () => {
  const valid = await fixture(), denied = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } };
  assert.equal(readAviationCache({ storage: denied, now: NOW }), null);
  assert.equal(writeAviationCache(valid, { storage: denied, now: NOW }).ok, false);
  assert.equal(readAviationCache({ storage: null, now: NOW }), null);
  assert.equal(writeAviationCache(valid, { storage: null, now: NOW }).ok, false);
  const target = storage(); target.setItem('heli-briefing.aviation.v1', JSON.stringify(valid));
  assert.equal(readAviationCache({ storage: target, now: NOW }), null);
  target.setItem(AVIATION_CACHE_KEY, '{malformed');
  assert.equal(readAviationCache({ storage: target, now: NOW }), null);
  writeAviationCache(valid, { storage: target, now: NOW });
  const original = target.getItem(AVIATION_CACHE_KEY), empty = structuredClone(valid);
  for (const kind of ['metar', 'taf', 'sigmet']) { empty[kind].items = []; empty[kind].status = 'unavailable'; empty[kind].transportStatus = 'unavailable'; }
  empty.metar.history = [];
  assert.equal(writeAviationCache(empty, { storage: target, now: NOW }).ok, false);
  assert.equal(target.getItem(AVIATION_CACHE_KEY), original);
});
