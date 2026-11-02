import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchMetnoAviation, parseMetnoXml, normalizeMetnoReport, metnoSourceUrl, METNO_PROVIDER } from '../web/js/metno-source.js';
import { fetchBrowserAviation, mergeObservationHistory } from '../web/js/aviation-source.js';
import { summarizeMetar } from '../web/js/reports.js';
import { readAviationCache, writeAviationCache, AVIATION_CACHE_KEY } from '../web/js/aviation-cache.js';
const NOW = Date.parse('2026-11-02T09:00:00Z'), retrievedAt = new Date(NOW).toISOString();
const envelope = rows => `<metno:aviationProducts xmlns:metno="http://api.met.no" xmlns:gml="http://www.opengis.net/gml/3.2">${rows.join('')}</metno:aviationProducts>`;
function metar(station = 'LOWW', at = '2026-11-02T08:50:00', code = '020850Z', type = 'AUTO') {
  return `<metno:meteorologicalAerodromeReport><metno:icaoAirportIdentifier>${station}</metno:icaoAirportIdentifier><metno:validTime><gml:TimeInstant><gml:timePosition>${at}</gml:timePosition></gml:TimeInstant></metno:validTime><metno:metarType>${type}</metno:metarType><metno:metarText>${station} ${code} 34003KT 9999 OVC037/// 05/03 Q1029=</metno:metarText></metno:meteorologicalAerodromeReport>`;
}
function taf(station = 'LOWW', text = `${station} 020800Z 0209/0315 34004KT 9999 BKN040 TEMPO 0210/0212 BKN009=`, type = '') {
  return `<metno:terminalAerodromeForecast><metno:icaoAirportIdentifier>${station}</metno:icaoAirportIdentifier><metno:issuedTime><gml:TimeInstant><gml:timePosition>2026-11-02T08:00:00</gml:timePosition></gml:TimeInstant></metno:issuedTime><metno:validPeriod><gml:beginPosition>2026-11-02T09:00:00</gml:beginPosition><gml:endPosition>2026-11-03T15:00:00</gml:endPosition></metno:validPeriod><metno:tafType>${type}</metno:tafType><metno:tafText>${text}</metno:tafText></metno:terminalAerodromeForecast>`;
}
const response = (body, headers = {}, status = 200) => ({ ok: status === 200, status, headers: new Headers(headers), text: async () => body });
function storage() { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }; }
function fixtureFetcher(requests = []) {
  return async (url, options) => {
    requests.push({ url, options }); const u = new URL(url);
    if (u.hostname === 'api.met.no') return response(u.pathname.endsWith('metar.xml') ? envelope([metar('LKCS'), metar('LOWL'), metar('LOWW'), metar('LOWW', '2026-11-01T22:20:00', '012220Z'), metar('LOWW', '2026-11-01T20:00:00', '012000Z')]) : envelope([taf('LKCS'), taf('LOWL'), taf('LOWW')]), { 'Content-Type': 'text/xml' });
    if (u.searchParams.get('action') === 'list') return response(JSON.stringify({ status: 'success', files: [
      { filename: 'LKCS_METAR.txt', format: 'txt', updated: '2026-11-02T08:32:01Z' },
      { filename: 'LKCS_TAF.txt', format: 'txt', updated: '2026-10-05T22:08:01Z' },
      { filename: 'LKAA_SIGMET.txt', format: 'txt', updated: '2026-10-26T14:30:01Z' },
    ] }));
    return response({
      'LKCS_METAR.txt': 'METAR LKCS 020830Z AUTO 34003KT 9999 OVC030 05/03 Q1029=',
      'LKCS_TAF.txt': 'TAF AMD LKCS 052206Z 0522/0606 CNL=',
      'LKAA_SIGMET.txt': 'LKAA SIGMET U02 VALID 261435/261535 LKPW- LKAA PRAHA FIR SEV TURB FCST FL280/350 STNR WKN=',
    }[u.searchParams.get('file')]);
  };
}

test('dated XML preserves exact provider TAC, separate AUTO qualifier and real UTC observation time', () => {
  const item = parseMetnoXml(envelope([metar()]), { kind: 'metar', retrievedAt })[0];
  assert.equal(item.provider, METNO_PROVIDER); assert.equal(item.raw, 'LOWW 020850Z 34003KT 9999 OVC037/// 05/03 Q1029=');
  assert.equal(item.source.reportType, 'AUTO'); assert.equal(item.observedAt, '2026-11-02T08:50:00.000Z');
  assert.equal(item.sourceUpdatedAt, null); assert.equal(item.sourceFilename, null); assert.equal(item.receivedAt, null);
  const summary = summarizeMetar(item); assert.equal(summary.ceiling.valueFtAgl, 3700); assert.match(summary.warnings.join(' '), /AUTO/);
  const forecast = parseMetnoXml(envelope([taf('LOWW', undefined, 'AMD')]), { kind: 'taf', retrievedAt })[0];
  assert.equal(forecast.amended, true); assert.equal(forecast.issuedAt, '2026-11-02T08:00:00.000Z'); assert.equal(forecast.validTo, '2026-11-03T15:00:00.000Z');
});

test('XML cannot invent dates, station identities, unsafe source URLs or silently repair a malformed archive', () => {
  const xml = envelope([metar()]), opts = { kind: 'metar', retrievedAt };
  for (const bad of [xml.replace('020850Z', '020830Z'), xml.replace('LOWW 020850Z', 'TAF LOWW 020850Z'), xml.replace('2026-11-02T08:50:00', '2026-02-31T08:50:00'), xml.replace('2026-11-02T08:50:00', '2026-11-03T08:50:00'), xml.replace('LOWW</', 'LKCS</'), xml.replace('http://api.met.no', 'https://untrusted.example'), xml.replace('</metno:validTime>', '</metno:wrongTime>'), xml.replace('LOWW 020850Z', '&external; 020850Z'), '<!DOCTYPE x [<!ENTITY external SYSTEM "file:///etc/passwd">]>' + xml, '<html><body>Failed request</body></html>', xml + xml]) assert.throws(() => parseMetnoXml(bad, opts));
  assert.throws(() => parseMetnoXml(xml, { ...opts, sourceUrl: metnoSourceUrl('metar') + '&callback=alert' }));
  assert.throws(() => parseMetnoXml(xml, { ...opts, sourceUrl: metnoSourceUrl('metar').replace('api.met.no', 'untrusted.example') }));
  assert.throws(() => parseMetnoXml(envelope([metar('KJFK')]), opts));
});

test('a year-boundary XML date is used literally and TAC validity must match the full dates', () => {
  const item = parseMetnoXml(envelope([metar('LOWL', '2026-12-31T23:50:00', '312350Z')]), { kind: 'metar', retrievedAt: '2027-01-01T00:00:00Z' })[0];
  assert.equal(item.observedAt, '2026-12-31T23:50:00.000Z');
  const xml = envelope([taf()]);
  assert.throws(() => parseMetnoXml(xml.replace('0209/0315', '0209/0415'), { kind: 'taf', retrievedAt }));
  assert.throws(() => parseMetnoXml(xml.replace('2026-11-03T15:00:00', '2026-11-02T08:00:00'), { kind: 'taf', retrievedAt }));
});

test('two simple CORS requests obey minimum reuse and later Expires without resetting retrieval timestamps', async () => {
  const cache = new Map(), requests = []; let at = NOW, active = 0, peak = 0;
  const fetcher = async (url, options) => {
    requests.push({ url, options }); active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 2)); active--;
    return response(new URL(url).pathname.endsWith('metar.xml') ? envelope([metar()]) : envelope([taf()]), { 'Content-Type': 'text/xml', Expires: new Date(NOW + 600000).toUTCString() });
  };
  const first = await fetchMetnoAviation({ fetcher, now: () => at, cache });
  assert.equal(peak, 2); assert.equal(requests.length, 2);
  assert.ok(requests.every(({ options }) => options.credentials === 'omit' && options.mode === 'cors' && options.cache === 'default' && !options.headers));
  at += 360000; const cached = await fetchMetnoAviation({ fetcher, now: () => at, cache });
  assert.equal(requests.length, 2); assert.equal(cached.metar.retrievedAt, first.metar.retrievedAt);
  at = NOW + 600001; await fetchMetnoAviation({ fetcher, now: () => at, cache }); assert.equal(requests.length, 4);
});

test('supplement failure is cached briefly and retained reports preserve actual source/retrieval times', async () => {
  const previous = { metar: { items: parseMetnoXml(envelope([metar()]), { kind: 'metar', retrievedAt }) } }, cache = new Map();
  let count = 0; const fetcher = async () => { count++; return response('', {}, 503); };
  const failed = await fetchMetnoAviation({ fetcher, previous, cache, now: NOW });
  assert.equal(failed.metar.items[0].retrievedAt, retrievedAt); assert.equal(failed.metar.items[0].transportStatus, 'stale'); assert.equal(failed.metar.transportStatus, 'unavailable');
  await fetchMetnoAviation({ fetcher, previous, cache, now: NOW + 60000 }); assert.equal(count, 2);
});

test('merged current rows preserve primary Czech cancellation while genuine foreign reports and archive fill gaps', async () => {
  const snapshot = await fetchBrowserAviation({ fetcher: fixtureFetcher(), now: NOW, cache: new Map() });
  assert.equal(snapshot.provider, 'chmi-swim+metno'); assert.match(snapshot.supplementWarning, /nahrazeno/);
  assert.equal(snapshot.metar.items.find(item => item.station === 'LKCS').provider, 'chmi-swim');
  assert.equal(snapshot.metar.items.find(item => item.station === 'LKCS').observedAt, '2026-11-02T08:30:00.000Z');
  assert.equal(snapshot.metar.items.find(item => item.station === 'LOWL').provider, METNO_PROVIDER);
  assert.equal(snapshot.taf.items.find(item => item.station === 'LOWW').provider, METNO_PROVIDER);
  const cancelled = snapshot.taf.items.find(item => item.station === 'LKCS'); assert.equal(cancelled.cancelled, true); assert.equal(cancelled.issuedAt, '2026-10-05T22:06:00.000Z');
  assert.equal(snapshot.metar.coverageComplete, false); assert.ok(snapshot.metar.missingStations.includes('LKHS')); assert.equal(snapshot.sigmet.coverageComplete, false); assert.equal(snapshot.sigmet.currentMessageCount, 0);
  assert.equal(snapshot.metar.historyMethod, 'source-archive-and-browser'); assert.equal(snapshot.metar.historyPartial, true);
  assert.ok(snapshot.metar.history.some(item => item.station === 'LOWW' && item.observedAt === '2026-11-01T22:20:00.000Z'));
  assert.ok(!snapshot.metar.history.some(item => item.observedAt === '2026-11-01T20:00:00.000Z'));
  assert.ok(!snapshot.metar.error.includes(snapshot.supplementWarning)); assert.ok(!snapshot.metar.historyError.includes(snapshot.supplementWarning));
});

test('mixed cache restores both exact providers as unconfirmed, rejects altered provenance and keeps older valid storage', async () => {
  const target = storage(), snapshot = await fetchBrowserAviation({ fetcher: fixtureFetcher(), now: NOW, cache: new Map() });
  assert.equal(writeAviationCache(snapshot, { storage: target, now: NOW }).ok, true);
  const original = target.getItem(AVIATION_CACHE_KEY), restored = readAviationCache({ storage: target, now: NOW + 60000 });
  assert.ok(restored); assert.equal(restored.provider, 'chmi-swim+metno'); assert.equal(restored.metar.historyMethod, 'source-archive-and-browser');
  const extra = restored.metar.items.find(item => item.provider === METNO_PROVIDER); assert.equal(extra.observedAt, '2026-11-02T08:50:00.000Z'); assert.equal(extra.transportStatus, 'stale'); assert.equal(extra.retrievedAt, retrievedAt);
  for (const mutate of [item => { item.sourceUrl += '&callback=bad'; }, item => { item.observedAt = '2026-11-02T08:40:00.000Z'; }, item => { item.sourceFilename = 'invented.txt'; }, item => { item.sourceUpdatedAt = retrievedAt; }, item => { item.source.reportType = 'UNSUPPORTED'; }]) {
    const changed = structuredClone(snapshot); mutate(changed.metar.items.find(item => item.provider === METNO_PROVIDER));
    assert.equal(writeAviationCache(changed, { storage: target, now: NOW }).ok, false); assert.equal(target.getItem(AVIATION_CACHE_KEY), original);
  }
});

test('failed primary retrieval from a mixed snapshot cannot borrow the newer supplement retrieval time', async () => {
  const snapshot = await fetchBrowserAviation({ fetcher: fixtureFetcher(), now: NOW, cache: new Map() });
  const primaryTime = snapshot.metar.items.find(item => item.provider === 'chmi-swim').retrievedAt;
  snapshot.metar.retrievedAt = '2026-11-02T09:04:00.000Z';
  const result = await fetchBrowserAviation({ fetcher: async () => response('', {}, 503), previous: snapshot, now: NOW + 600000, cache: new Map() });
  const item = result.metar.items.find(item => item.provider === 'chmi-swim'); assert.equal(item.retrievedAt, primaryTime);
  assert.notEqual(result.metar.retrievedAt, snapshot.metar.retrievedAt); assert.equal(result.metar.transportStatus, 'unavailable');
});

test('oversized, redirected and aborted provider responses do not become valid weather', async () => {
  const cache = new Map();
  const huge = await fetchMetnoAviation({ now: NOW, cache, fetcher: async () => response('', { 'Content-Length': '1000001' }) });
  assert.equal(huge.metar.status, 'unavailable'); assert.match(huge.metar.error, /limit/);
  const redirect = await fetchMetnoAviation({ now: NOW, cache: new Map(), fetcher: async () => ({ ...response(envelope([metar()])), url: 'https://untrusted.example/data.xml' }) });
  assert.equal(redirect.metar.status, 'unavailable');
  const controller = new AbortController(); controller.abort(new Error('cancelled'));
  await assert.rejects(fetchMetnoAviation({ now: NOW, cache: new Map(), signal: controller.signal, fetcher: async () => { throw controller.signal.reason; } }), /cancelled/);
  const item = parseMetnoXml(envelope([metar()]), { kind: 'metar', retrievedAt })[0];
  assert.throws(() => normalizeMetnoReport({ ...item, reportType: 'AUTO', sourceUrl: 'javascript:alert(1)' }));
});


test('a genuine correction wins a same-time history sample even after a later uncorrected retrieval', () => {
  const original = parseMetnoXml(envelope([metar()]), { kind: 'metar', retrievedAt: '2026-11-02T09:00:00Z' })[0];
  const corrected = normalizeMetnoReport({ ...original, raw: original.raw.replace('34003KT', '35005KT'), reportType: 'COR', retrievedAt: '2026-11-02T08:55:00Z' });
  const merged = mergeObservationHistory([corrected], [original], NOW);
  assert.equal(merged.length, 1); assert.equal(merged[0].corrected, true); assert.match(merged[0].raw, /35005KT/);
});

test('successful supplement transport cannot make retained failed-primary reports look freshly confirmed', async () => {
  const previous = await fetchBrowserAviation({ fetcher: fixtureFetcher(), now: NOW, cache: new Map() });
  const successful = fixtureFetcher();
  const snapshot = await fetchBrowserAviation({ previous, now: NOW + 600000, cache: new Map(), fetcher: async (url, options) => new URL(url).hostname === 'swim.chmi.cz' ? response('', {}, 503) : successful(url, options) });
  assert.equal(snapshot.metar.transportStatus, 'partial');
  const retained = snapshot.metar.items.find(item => item.provider === 'chmi-swim');
  assert.equal(retained.transportStatus, 'stale'); assert.equal(retained.retrievedAt, retrievedAt);
  assert.match(retained.refreshError, /HTTP 503/);
});
