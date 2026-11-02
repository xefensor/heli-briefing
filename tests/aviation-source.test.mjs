import test from 'node:test';
import assert from 'node:assert/strict';
import { AVIATION_API, fetchAviation, parseTacReport, mergeObservationHistory } from '../web/js/aviation-source.js';
import { reportState } from '../web/js/briefing.js';
import { summarizeMetar, summarizeTaf } from '../web/js/reports.js';

const NOW = Date.parse('2026-11-02T09:00:00Z');
const entry = (filename, updated = '2026-11-02T08:32:01Z', extra = {}) => ({ filename, format: 'txt', updated, ...extra });
const metar = 'METAR LKCS 020830Z AUTO 34003KT 320V020 9999 FEW012/// OVC037/// 05/03 Q1029=';
const taf = 'TAF LKPR 020800Z 0209/0315 34004KT 9999 BKN040 TEMPO 0302/0310 9999 SCT040 PROB40 TEMPO 0302/0310 BKN009 TEMPO 0209/0224 02006KT BECMG 0310/0312 04009KT=';
function parsed(kind, raw, filename, updated = '2026-11-02T08:32:01Z', retrievedAt = '2026-11-02T09:00:00Z') {
  return parseTacReport({ kind, raw, filename, updated, retrievedAt, sourceUrl: `${AVIATION_API}?action=get&file=${filename}&format=txt` });
}
function response(body, { status = 200, url = '' } = {}) {
  return { ok: status >= 200 && status < 300, status, url, headers: new Headers(), text: async () => typeof body === 'string' ? body : JSON.stringify(body) };
}
function source(files, bodies, requests = [], failures = new Set()) {
  return async (url, options) => {
    requests.push({ url, options });
    const parameters = new URL(url).searchParams;
    if (parameters.get('action') === 'list') return response({ status: 'success', created: '2026-11-02T09:00:00Z', files });
    const file = parameters.get('file');
    if (failures.has(file)) return response('', { status: 503 });
    assert.ok(Object.hasOwn(bodies, file), `Unexpected source request ${file}`);
    return response(bodies[file]);
  };
}

test('direct TAC retains the local station observation, qualifiers and source date independently of retrieval', () => {
  const item = parsed('metar', metar, 'LKCS_METAR.txt');
  assert.equal(item.observedAt, '2026-11-02T08:30:00.000Z');
  assert.equal(item.issuedAt, null);
  assert.equal(item.receivedAt, null);
  assert.equal(item.sourceUpdatedAt, '2026-11-02T08:32:01Z');
  assert.equal(item.retrievedAt, '2026-11-02T09:00:00Z');
  assert.match(item.timeReference, /katalogu/);
  const summary = summarizeMetar(item);
  assert.equal(summary.wind.speedKt, 3);
  assert.equal(summary.visibility.qualifier, 'at-least');
  assert.equal(summary.ceiling.valueFtAgl, 3700);
  assert.equal(item.raw, metar);
});

test('old cancelled TAF and expired SIGMET retain their actual catalogue month instead of becoming November products', () => {
  const cancelled = parsed('taf', 'TAF AMD LKCS 052206Z 0522/0606 CNL=', 'LKCS_TAF.txt', '2026-10-05T22:08:01Z');
  assert.equal(cancelled.issuedAt, '2026-10-05T22:06:00.000Z');
  assert.equal(cancelled.validFrom, '2026-10-05T22:00:00.000Z');
  assert.equal(cancelled.validTo, '2026-10-06T06:00:00.000Z');
  assert.equal(cancelled.cancelled, true);
  assert.match(reportState(cancelled, NOW).label, /CNL/);
  const sigmet = parsed('sigmet', 'LKAA SIGMET U02 VALID 261435/261535 LKPW- LKAA PRAHA FIR SEV TURB FCST FL280/350 STNR WKN=', 'LKAA_SIGMET.txt', '2026-10-26T14:30:01Z');
  assert.equal(sigmet.issuedAt, null);
  assert.equal(sigmet.validFrom, '2026-10-26T14:35:00.000Z');
  assert.equal(sigmet.validTo, '2026-10-26T15:35:00.000Z');
  assert.match(reportState(sigmet, NOW).label, /Po platnosti/);
});

test('date resolution handles year rollover and explicit 24-hour TAF endpoints without overflowing impossible dates', () => {
  const report = parsed('metar', 'METAR LKPR 312350Z 00000KT CAVOK 01/00 Q1020=', 'LKPR_METAR.txt', '2027-01-01T00:01:00Z');
  assert.equal(report.observedAt, '2026-12-31T23:50:00.000Z');
  const forecast = parsed('taf', 'TAF LKPR 312300Z 0100/0124 00000KT CAVOK=', 'LKPR_TAF.txt', '2026-12-31T23:02:00Z');
  assert.equal(forecast.validFrom, '2027-01-01T00:00:00.000Z');
  assert.equal(forecast.validTo, '2027-01-02T00:00:00.000Z');
  assert.equal(parsed('metar', 'METAR LKPR 310830Z 00000KT CAVOK=', 'LKPR_METAR.txt', '2026-03-01T09:00:00Z').observedAt, null);
  assert.equal(parsed('metar', metar, 'LKCS_METAR.txt', null).observedAt, null);
  assert.equal(parsed('metar', metar, 'LKCS_METAR.txt', '2026-11-05T08:32:01Z').observedAt, null);
});

test('all original TAF change periods survive direct-source normalization', () => {
  const item = parsed('taf', taf, 'LKPR_TAF.txt', '2026-11-02T08:22:01Z');
  assert.equal(item.validFrom, '2026-11-02T09:00:00.000Z');
  assert.equal(item.validTo, '2026-11-03T15:00:00.000Z');
  const summary = summarizeTaf(item);
  assert.deepEqual(summary.periods.map(period => period.type), ['BASE', 'TEMPO', 'PROB', 'TEMPO', 'BECMG']);
  assert.equal(summary.periods[2].probability, 40);
  assert.equal(summary.periods[3].end, '2026-11-03T00:00:00.000Z');
  assert.equal(item.raw, taf);
});

test('a station mismatch is rejected and unsafe catalogue download URLs cannot redirect source requests', async () => {
  assert.throws(() => parsed('metar', metar, 'LKPR_METAR.txt'), /Identita/);
  const requests = [];
  const snapshot = await fetchAviation({ now: () => NOW, fetcher: source([
    entry('LKCS_METAR.txt', undefined, { download_url: 'https://untrusted.example/exfil' }),
    entry('../LKPR_METAR.txt'), entry('KJFK_METAR.txt'), entry('LKCS_METAR.xml', undefined, { format: 'iwxxm' }),
  ], { 'LKCS_METAR.txt': metar }, requests) });
  assert.equal(requests.length, 2);
  assert.ok(requests.every(request => new URL(request.url).origin === 'https://swim.chmi.cz'));
  assert.ok(requests.every(request => request.options.credentials === 'omit' && request.options.mode === 'cors' && request.options.cache === 'no-cache'));
  assert.equal(snapshot.metar.items[0].station, 'LKCS');
  assert.ok(snapshot.metar.missingStations.includes('LOWL'));
  assert.ok(snapshot.metar.missingStations.includes('LOWW'));
  assert.ok(snapshot.metar.missingStations.includes('LKHS'));
  assert.equal(snapshot.metar.coverageComplete, false);
  assert.equal(snapshot.metar.status, 'partial');
});

test('report downloads are bounded to two concurrent requests and successful empty scopes remain unavailable', async () => {
  const files = [entry('LKCS_METAR.txt'), entry('LKPR_METAR.txt'), entry('LKPR_TAF.txt')];
  const bodies = { 'LKCS_METAR.txt': metar, 'LKPR_METAR.txt': metar.replaceAll('LKCS', 'LKPR'), 'LKPR_TAF.txt': taf };
  const inner = source(files, bodies); let active = 0, peak = 0;
  const snapshot = await fetchAviation({ now: () => NOW, fetcher: async (url, options) => {
    if (new URL(url).searchParams.get('action') === 'list') return inner(url, options);
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 3));
    try { return await inner(url, options); } finally { active--; }
  } });
  assert.equal(peak, 2);
  assert.equal(snapshot.metar.items.length, 2);
  assert.equal(snapshot.taf.items.length, 1);
  assert.equal(snapshot.sigmet.status, 'unavailable');
  assert.equal(snapshot.sigmet.coverageComplete, false);
  assert.equal(snapshot.sigmet.coverageStatus, 'unknown');
});

test('an expired latest SIGMET never establishes current warning coverage or all-clear', async () => {
  const snapshot = await fetchAviation({ now: () => NOW, fetcher: source([
    entry('LKAA_SIGMET.txt', '2026-10-26T14:30:01Z'),
  ], { 'LKAA_SIGMET.txt': 'LKAA SIGMET U02 VALID 261435/261535 LKPW- LKAA PRAHA FIR SEV TURB FCST FL280/350 STNR WKN=' }) });
  assert.equal(snapshot.sigmet.transportStatus, 'ok');
  assert.equal(snapshot.sigmet.status, 'partial');
  assert.equal(snapshot.sigmet.currentMessageCount, 0);
  assert.equal(snapshot.sigmet.coverageComplete, false);
  assert.equal(snapshot.sigmet.coverageStatus, 'unknown');
  assert.match(snapshot.sigmet.error, /neprokazuje úplný/);
  assert.equal(snapshot.sigmet.items.length, 1);
  assert.match(reportState(snapshot.sigmet.items[0], NOW).label, /Po platnosti/);
});

test('catalogue failure retains only genuine previous direct-source records with their original retrieval time', async () => {
  const previous = { metar: { provider: 'chmi-swim', retrievedAt: '2026-11-02T08:35:00Z', items: [parsed('metar', metar, 'LKCS_METAR.txt', undefined, '2026-11-02T08:35:00Z')] }, taf: { items: [{ provider: 'awc', station: 'LOWL', raw: 'TAF LOWL 020800Z 0209/0315 CAVOK=' }] } };
  const snapshot = await fetchAviation({ now: () => NOW, previous, fetcher: async () => response('', { status: 503 }) });
  assert.equal(snapshot.metar.status, 'stale');
  assert.equal(snapshot.metar.retrievedAt, '2026-11-02T08:35:00Z');
  assert.equal(snapshot.metar.items[0].retrievedAt, '2026-11-02T08:35:00Z');
  assert.equal(snapshot.taf.status, 'unavailable');
  assert.equal(snapshot.taf.items.length, 0);
  assert.equal(snapshot.metar.historyMethod, 'browser-observed');
  assert.equal(snapshot.metar.historyStatus, 'stale');
});

test('a failed individual file preserves that source report rather than making another station its substitute', async () => {
  const previousItem = parsed('metar', metar, 'LKCS_METAR.txt', undefined, '2026-11-02T08:35:00Z');
  const snapshot = await fetchAviation({ now: () => NOW, previous: { metar: { provider: 'chmi-swim', items: [previousItem], retrievedAt: previousItem.retrievedAt } },
    fetcher: source([entry('LKCS_METAR.txt'), entry('LKPR_METAR.txt')], { 'LKPR_METAR.txt': metar.replaceAll('LKCS', 'LKPR') }, [], new Set(['LKCS_METAR.txt'])) });
  const retained = snapshot.metar.items.find(item => item.station === 'LKCS');
  assert.equal(retained.retrievedAt, previousItem.retrievedAt);
  assert.equal(retained.transportStatus, 'stale');
  assert.equal(snapshot.metar.status, 'partial');
  assert.equal(snapshot.metar.items.find(item => item.station === 'LKPR').retrievedAt, '2026-11-02T09:00:00.000Z');
});

test('browser-observed history deduplicates corrections and keeps gaps, rejecting nil, future and old observations', () => {
  const item = parsed('metar', metar, 'LKCS_METAR.txt');
  const corrected = { ...item, raw: metar.replace('METAR ', 'METAR COR ').replace('34003KT', '34005KT'), corrected: true, sourceUpdatedAt: '2026-11-02T08:34:00Z' };
  const old = { ...item, observedAt: '2026-11-01T20:59:00Z' };
  const future = { ...item, observedAt: '2026-11-02T09:01:00Z' };
  const nil = { ...item, raw: 'METAR LKCS 020830Z NIL=', nil: true };
  const history = mergeObservationHistory([item, old, future, nil], [corrected], NOW);
  assert.equal(history.length, 1);
  assert.equal(history[0].corrected, true);
  assert.match(history[0].raw, /34005KT/);
});

test('history is labelled partial prospective collection, not a downloaded twelve-hour archive', async () => {
  const snapshot = await fetchAviation({ now: () => NOW, fetcher: source([entry('LKCS_METAR.txt')], { 'LKCS_METAR.txt': metar }) });
  assert.equal(snapshot.metar.history.length, 1);
  assert.equal(snapshot.metar.historyStatus, 'partial');
  assert.equal(snapshot.metar.historyPartial, true);
  assert.equal(snapshot.metar.historyWindowFrom, '2026-11-01T21:00:00.000Z');
  assert.match(snapshot.metar.historyError, /neposkytuje/);
});

test('aborted work propagates cancellation and malformed catalogue data cannot look like empty weather', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(fetchAviation({ now: () => NOW, signal: controller.signal, fetcher: async (_url, { signal }) => { signal.throwIfAborted(); return response({}); } }), error => error.name === 'AbortError');
  const malformed = await fetchAviation({ now: () => NOW, fetcher: async () => response({ status: 'success', files: 'not an array' }) });
  assert.equal(malformed.metar.status, 'unavailable');
  assert.equal(malformed.sigmet.coverageComplete, false);
  assert.match(malformed.metar.error, /Katalog/);
});
