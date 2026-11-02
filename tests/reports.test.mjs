import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeMetar, summarizeTaf, formatReportSummary } from '../web/js/reports.js';
import { renderMetarSummary, renderTafPeriods, renderReportGuide } from '../web/js/report-views.js';

const metar = (body, source = {}) => ({ raw: `METAR LKCS 011200Z ${body}`, source });
const taf = (body, extra = {}) => ({ raw: `TAF LKCS 011100Z 0112/0212 ${body}`,
  validFrom: '2026-11-01T12:00:00Z', validTo: '2026-11-02T12:00:00Z', ...extra });

test('observed ceiling uses lowest BKN/OVC, not FEW or SCT cloud bases', () => {
  const summary = summarizeMetar(metar('02005KT 6000 FEW002 SCT006 BKN012 OVC025 04/02 Q1027'));
  assert.equal(summary.ceiling.valueFtAgl, 1200);
  assert.equal(summary.ceiling.status, 'reported');
  assert.equal(summary.clouds[0].baseFtAgl, 200);
  const scattered = summarizeMetar(metar('02005KT 9999 FEW002 SCT006 04/02 Q1027'));
  assert.equal(scattered.ceiling.valueFtAgl, null);
  assert.equal(scattered.ceiling.status, 'not-reported');
  assert.match(formatReportSummary(scattered), /žádná uvedená BKN\/OVC\/VV/);
  assert.match(formatReportSummary(scattered), /FEW 200 ft AGL/);
});

test('vertical visibility and unknown cloud heights remain distinct from no ceiling', () => {
  const reported = summarizeMetar(metar('00000KT 0300 FG VV002 00/00 Q1030'));
  assert.equal(reported.ceiling.valueFtAgl, 200);
  assert.equal(reported.clouds[0].verticalVisibility, true);
  const unknown = summarizeMetar(metar('00000KT 0300 FG VV/// 00/00 Q1030'));
  assert.equal(unknown.ceiling.status, 'unknown');
  assert.equal(unknown.ceiling.valueFtAgl, null);
  const mixed = summarizeMetar(metar('02005KT 4000 BKN/// OVC020 04/02 Q1027'));
  assert.equal(mixed.ceiling.valueFtAgl, null);
  assert.equal(mixed.ceiling.status, 'unknown');
  assert.equal(mixed.warnings.length, 1);
});

test('automatic METAR cloud-type slashes retain known layer height and explicitly unknown types', () => {
  const item = metar('AUTO 34003KT 320V020 9999 FEW012/// OVC037/// 05/03 Q1029');
  const summary = summarizeMetar(item);
  assert.equal(summary.ceiling.status, 'reported');
  assert.equal(summary.ceiling.valueFtAgl, 3700);
  assert.equal(summary.clouds[0].baseFtAgl, 1200);
  assert.equal(summary.clouds[1].type, null);
  assert.equal(summary.clouds[1].typeUnknown, true);
  assert.equal(summary.clouds[1].code, 'OVC037///');
  assert.match(summary.warnings.join(' '), /Druh.*není určen/);
  assert.match(renderMetarSummary(item), /3.?700 ft AGL/);
  const missingHeight = summarizeMetar(metar('00000KT 0300 FG BKN////// OVC037/// 00/00 Q1030'));
  assert.equal(missingHeight.clouds[0].baseFtAgl, null);
  assert.equal(missingHeight.clouds[0].typeUnknown, true);
  assert.equal(missingHeight.clouds[0].code, 'BKN//////');
  assert.equal(missingHeight.ceiling.status, 'unknown');
  assert.equal(missingHeight.ceiling.valueFtAgl, null);
  const forecast = summarizeTaf(taf('34003KT 9999 OVC037/// TEMPO 0118/0206 BKN//////'));
  assert.equal(forecast.periods[0].ceiling.valueFtAgl, 3700);
  assert.equal(forecast.periods[1].ceiling.status, 'unknown');
  assert.equal(forecast.periods[0].clouds[0].typeUnknown, true);
  assert.match(forecast.warnings.join(' '), /Druh.*není určen/);
});

test('CAVOK and 9999 preserve 10 km lower bound despite AWC statute-mile rounding', () => {
  for (const token of ['CAVOK', '9999']) {
    const summary = summarizeMetar(metar(`VRB02KT ${token} 04/02 Q1027`, { visib: '6+' }));
    assert.equal(summary.visibility.metres, 10000);
    assert.equal(summary.visibility.qualifier, 'at-least');
    assert.match(summary.visibility.text, /≥ 10 km/);
  }
  const cavok = summarizeMetar(metar('VRB02KT CAVOK 04/02 Q1027'));
  assert.equal(cavok.ceiling.status, 'cavok');
  assert.equal(cavok.ceiling.valueFtAgl, null);
  assert.doesNotMatch(formatReportSummary(cavok), /neomezen/);
});

test('metric, fractional SM and upper/lower visibility bounds decode without precision claims', () => {
  assert.deepEqual(summarizeMetar(metar('02005KT 0000 FG VV001 00/00 Q1030')).visibility,
    { metres: 50, qualifier: 'less-than', code: '0000', source: 'raw', text: '< 50 m' });
  const fractional = summarizeMetar(metar('02005KT 1 1/2SM BR BKN006 00/00 Q1030'));
  assert.equal(fractional.visibility.metres, 1.5 * 1609.344);
  assert.equal(summarizeMetar(metar('02005KT M1/4SM FG VV001')).visibility.qualifier, 'less-than');
  assert.equal(summarizeMetar(metar('02005KT P6SM SCT030')).visibility.qualifier, 'greater-than');
  assert.equal(summarizeMetar(metar('02005KT 4000NDV BR BKN006')).visibility.metres, 4000);
});

test('genuine zeros survive wind, gust, cloud base, temperature and source-only visibility', () => {
  const summary = summarizeMetar(metar('00000G00KT BKN000 00/00 Q1030', { visib: 0 }));
  assert.equal(summary.wind.direction, 0);
  assert.equal(summary.wind.speedKt, 0);
  assert.equal(summary.wind.gustKt, 0);
  assert.equal(summary.temperature, 0);
  assert.equal(summary.dewpoint, 0);
  assert.equal(summary.ceiling.valueFtAgl, 0);
  assert.equal(summary.visibility.metres, 0);
  assert.match(formatReportSummary(summary), /Ceiling 0 ft AGL/);
});

test('VRB, wind units, negative temperatures, pressure and raw-body boundaries are respected', () => {
  const summary = summarizeMetar(metar('VRB02KT 9999 SCT030 M01/M03 Q1027 TEMPO 0400 FG VV001'));
  assert.equal(summary.wind.variable, true);
  assert.equal(summary.wind.direction, null);
  assert.equal(summary.wind.gustKt, null);
  assert.equal(summary.temperature, -1);
  assert.equal(summary.dewpoint, -3);
  assert.equal(summary.pressureHpa, 1027);
  assert.equal(summary.visibility.metres, 10000);
  assert.equal(summary.ceiling.valueFtAgl, null);
  const metricWind = summarizeMetar(metar('18010MPS 9999 SCT030'));
  assert.ok(Math.abs(metricWind.wind.speedKt - 19.438444924406) < 1e-9);
  assert.ok(Math.abs(summarizeMetar(metar('18010KT P6SM CLR A2992')).pressureHpa - 1013.207) < 0.01);
});

test('unknown weather remains literal and unknown values do not become benign defaults', () => {
  const summary = summarizeMetar(metar('AUTO', { wxString: 'XX', wspd: null, temp: null, dewp: null, altim: null }));
  assert.equal(summary.wind, null);
  assert.equal(summary.visibility.metres, null);
  assert.equal(summary.temperature, null);
  assert.equal(summary.pressureHpa, null);
  assert.equal(summary.ceiling.status, 'unknown');
  assert.deepEqual(summary.wx, [{ code: 'XX', description: 'XX' }]);
  assert.match(formatReportSummary(summary), /XX/);
  const invalid = summarizeMetar(metar('99905KT', { clouds: [{cover: 'BKN',base: -100}] }));
  assert.equal(invalid.wind, null);
  assert.equal(invalid.ceiling.valueFtAgl, null);
  assert.equal(invalid.ceiling.status, 'unknown');
});

test('NIL, cancellation and missing reports never produce decoded weather', () => {
  for (const [raw, status] of [['TAF LKCS 011100Z 0112/0212 NIL', 'nil'], ['TAF AMD LKCS 011100Z 0112/0212 CNL', 'cancelled']]) {
    const result = summarizeTaf({ raw, source: { fcsts: [{ wspd: 1, visib: '6+' }] } });
    assert.equal(result.status, status);
    assert.equal(result.periods.length, 0);
  }
  assert.equal(summarizeMetar({ raw: 'METAR LKCS 011200Z NIL', source: { wspd: 2, temp: 5 } }).wind, null);
  assert.equal(summarizeMetar(null).status, 'unavailable');
});

test('TAF change groups use only explicit fields, ignoring source-carried conditions', () => {
  const item = taf('05005KT 9999 SCT012 BKN030 BECMG 0116/0118 SCT030 TEMPO 0118/0122 1200 BR BCFG SCT004',
    { source: { fcsts: [{ wspd: 5, wdir: 50, visib: '6+' }, { wspd: 5, wdir: 50, visib: '6+' }] } });
  const result = summarizeTaf(item, { selectedTime: '2026-11-01T17:00:00Z' });
  assert.equal(result.periods.length, 3);
  const [base, change, temporary] = result.periods;
  assert.equal(base.end, '2026-11-01T16:00:00.000Z');
  assert.equal(change.type, 'BECMG');
  assert.equal(change.wind, null);
  assert.equal(change.visibility.metres, null);
  assert.equal(change.ceiling.status, 'not-reported');
  assert.equal(change.selected, true);
  assert.equal(temporary.wind, null);
  assert.equal(temporary.visibility.metres, 1200);
  assert.equal(temporary.selected, false);
  assert.ok(result.warnings.some((warning) => warning.includes('Neuvedené podmínky')));
  assert.ok(result.warnings.some((warning) => warning.includes('BECMG')));
});

test('TAF PROB/TEMPO and FM intervals remain separate and selected overlap is half-open', () => {
  const result = summarizeTaf(taf('05005KT 9999 SCT025 PROB30 TEMPO 0118/0206 2000 BR BKN003 FM020600 27008KT 9999 SCT020'),
    { selectedTime: '2026-11-02T06:00:00Z' });
  assert.equal(result.periods[1].type, 'PROB');
  assert.equal(result.periods[1].probability, 30);
  assert.match(result.periods[1].label, /přechodně/);
  assert.equal(result.periods[1].selected, false);
  assert.equal(result.periods[2].selected, true);
  assert.equal(result.periods[0].end, '2026-11-02T06:00:00.000Z');
  assert.equal(result.periods[2].end, '2026-11-02T12:00:00Z');
});

test('TAF month/year rollover and 24-hour ending resolve from report validity only', () => {
  const result = summarizeTaf({ raw: 'TAF LKCS 311100Z 3112/0118 03005KT 9999 SCT020 TEMPO 3121/3124 2000 BR BKN004 FM010600 27005KT 9999 SCT030',
    validFrom: '2026-12-31T12:00:00Z', validTo: '2027-01-01T18:00:00Z' });
  assert.equal(result.periods[1].start, '2026-12-31T21:00:00.000Z');
  assert.equal(result.periods[1].end, '2027-01-01T00:00:00.000Z');
  assert.equal(result.periods[2].start, '2027-01-01T06:00:00.000Z');
  const noAnchor = summarizeTaf({ raw: 'TAF LKCS 011100Z 0112/0212 02005KT 9999 SCT030 TEMPO 0118/0206 2000 BR' });
  assert.equal(noAnchor.periods[1].start, null);
  assert.equal(noAnchor.periods[1].end, null);
  assert.ok(noAnchor.warnings.some((warning) => warning.includes('ověřitelnou platnost')));
});

test('amended TAF retains supplementary raw groups and literal weather', () => {
  const result = summarizeTaf(taf('05005KT 9999 SCT025 TX09/0115Z TN03/0204Z PROB40 0200/0206 -DZ SCT012 BKN014',
    { raw: 'TAF AMD LKCS 011100Z 0112/0212 05005KT 9999 SCT025 TX09/0115Z TN03/0204Z PROB40 0200/0206 -DZ SCT012 BKN014', amended: true }));
  assert.ok(result.periods[0].unknownTokens.includes('TX09/0115Z'));
  assert.equal(result.periods[1].probability, 40);
  assert.deepEqual(result.periods[1].wx, [{ code: '-DZ', description: 'slabé mrholení' }]);
  assert.equal(result.periods[1].ceiling.valueFtAgl, 1400);
});

test('METAR summary HTML is escaped and retains literal unknown weather and actual bounds', () => {
  const html = renderMetarSummary(metar('VRB02KT 9999 FEW002 BKN012 00/M01 Q1030', { wxString: '<img src=x onerror=alert(1)>' }), {timezone:'UTC'});
  assert.match(html, /metar-summary/);
  assert.match(html, /≥ 10 km/);
  assert.match(html, /1(?:&nbsp;|\s| )200 ft AGL/);
  assert.match(html, /FEW 200 ft AGL/);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
  assert.match(html, /ft AGL/);
});

test('TAF period HTML preserves conditional scope, selected overlap and unknown escaped groups', () => {
  const item = taf('05005KT 9999 SCT025 TEMPO 0118/0206 2000 BR BKN003 <script>alert(1)</script>');
  const html = renderTafPeriods(item, { selectedTime: '2026-11-01T19:00:00Z', timezone:'UTC' });
  assert.match(html, /taf-periods/);
  assert.match(html, /data-selected="true"/);
  assert.match(html, /Chybějící položky nejsou doplněny/);
  assert.match(html, /TEMPO/);
  assert.match(html, /Další původní skupiny/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /1\.11\. 18:00 UTC/);
});


test('compact report layout preserves all conditional periods and exceptional warnings',()=>{
 const item=taf('05005KT 9999 SCT025 BECMG 0118/0120 30004KT PROB30 TEMPO 0120/0206 2000 BR BKN/// <script>unknown</script>');
 const full=renderTafPeriods(item,{selectedTime:'2026-11-01T21:00:00Z'});
 const compact=renderTafPeriods(item,{selectedTime:'2026-11-01T21:00:00Z',compact:true});
 assert.equal((compact.match(/class="taf-period"/g)||[]).length,(full.match(/class="taf-period"/g)||[]).length);
 assert.match(compact,/PROB30 TEMPO/);assert.match(compact,/&lt;script&gt;/);assert.doesNotMatch(compact,/<script>/);
 assert.match(compact,/neznám|neznámá|neznámou/);
 assert.match(renderReportGuide(),/Chybějící položky nejsou doplněny/);
 const metarHtml=renderMetarSummary(metar('VRB02KT 0400 FG VV/// 00/00 Q1030'),{compact:true});
 assert.match(metarHtml,/Výška neznámá/);assert.match(metarHtml,/report-warnings/);
});
