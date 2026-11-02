import test from 'node:test';
import assert from 'node:assert/strict';
import { createBriefingSnapshot, renderBriefingHtml, renderBriefingText } from '../web/js/archive.js';
import { sourceReview, reportProviderName, reportSources, observationHistoryInfo, renderAviationAttribution } from '../web/js/handoff.js';
import { createBrowserCameras } from '../web/js/cameras.js';
import { createBrowserCharts } from '../web/js/aviation-charts.js';

const NOW = '2026-11-02T10:15:00.000Z';
const SWIM = 'https://swim.chmi.cz/api.php?action=list&format=txt';
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6g0gAAAAASUVORK5CYII=';
function report() {
  return {
    id: 'metar:LKCS:2026-11-02T10:00:00Z', kind: 'metar', provider: 'chmi-swim', station: 'LKCS',
    raw: 'METAR LKCS 021000Z VRB02KT 9999 FEW014/// OVC035/// 09/06 Q1026=',
    observedAt: '2026-11-02T10:00:00.000Z', issuedAt: null, validFrom: null, validTo: null,
    retrievedAt: '2026-11-02T10:05:00.000Z', sourceUrl: 'https://swim.chmi.cz/api.php?action=get&file=LKCS_METAR.txt&format=txt', source: {},
  };
}
function input() {
  return {
    state: { name: 'Planá', lat: 48.9463, lon: 14.4294, model: 'aladin', compare: '', time: NOW, hours: 24, timezone: 'UTC' },
    createdAt: NOW,
    aviation: {
      schemaVersion: 1, provider: 'chmi-swim', sourceName: 'ČHMÚ MET-SWIM · přímý požadavek prohlížeče', generatedAt: NOW,
      metar: { provider: 'chmi-swim', status: 'partial', transportStatus: 'ok', coverageComplete: false, coverageStatus: 'partial', retrievedAt: NOW, sourceUrl: SWIM, requestedStations: ['LKCS', 'LKHS', 'LOWL', 'LOWW'], missingStations: ['LKHS', 'LOWL', 'LOWW'], items: [report()] },
      taf: { provider: 'chmi-swim', status: 'partial', transportStatus: 'ok', coverageComplete: false, coverageStatus: 'partial', retrievedAt: NOW, sourceUrl: SWIM, requestedStations: ['LKCS', 'LOWL'], missingStations: ['LOWL'], items: [] },
      sigmet: { provider: 'chmi-swim', status: 'partial', transportStatus: 'ok', coverageComplete: false, coverageStatus: 'unknown', retrievedAt: NOW, sourceUrl: SWIM, firScope: ['LKAA', 'LOVV', 'EDMM', 'LZBB'], missingFirs: ['LOVV', 'EDMM', 'LZBB'], items: [] },
    },
  };
}

test('direct SWIM output uses actual provider and warns on partial transport/coverage despite a fresh fetch', () => {
  const snapshot = createBriefingSnapshot(input());
  const full = renderBriefingHtml(snapshot), compact = renderBriefingHtml(snapshot, { mode: 'reports' }), text = renderBriefingText(snapshot);
  for (const output of [full, compact, text]) {
    assert.match(output, /ČHMÚ MET-SWIM/);
    assert.doesNotMatch(output, /NOAA Aviation Weather Center/);
    assert.match(output, /LKHS, LOWL, LOWW/);
    assert.match(output, /Úplnost aktuálního inventáře SIGMET není prokázána/);
    assert.match(output, /chybějící zprávy nejsou nahrazeny/);
  }
  assert.equal(sourceReview(snapshot).find(row => row.name === 'METAR').tone, 'warn');
  assert.equal(sourceReview(snapshot).find(row => row.name === 'SIGMET').tone, 'warn');
  assert.match(full, /href="https:\/\/swim\.chmi\.cz\/api\.php\?/);
});

test('SIGMET inventory stays unknown even when a successfully retrieved current message is present', () => {
  const value = input();
  value.aviation.sigmet.status = 'ok';
  value.aviation.sigmet.items = [{ provider: 'chmi-swim', id: 'sigmet:LKAA:1', kind: 'sigmet', fir: 'LKAA', raw: 'LKAA SIGMET 1 VALID 021000/021400 LKPR- LKAA PRAHA FIR MOD ICE FCST=', validFrom: '2026-11-02T10:00:00Z', validTo: '2026-11-02T14:00:00Z', issuedAt: null }];
  const snapshot = createBriefingSnapshot(value);
  const row = sourceReview(snapshot).find(row => row.name === 'SIGMET');
  assert.equal(row.tone, 'warn');
  assert.match(row.text, /1 zpráv/);
  assert.match(row.text, /Úplnost/);
  assert.match(renderBriefingText(snapshot, { mode: 'reports' }), /VALID 021000\/021400/);
});

test('retained per-report failures preserve the individual retrieval time in full and compact output', () => {
  const value = input();
  Object.assign(value.aviation.metar.items[0], { retrievedAt: '2026-11-02T07:30:00Z', transportStatus: 'stale', refreshError: '<script>offline</script>' });
  const snapshot = createBriefingSnapshot(value);
  const html = renderBriefingHtml(snapshot), compact = renderBriefingHtml(snapshot, { mode: 'reports' }), text = renderBriefingText(snapshot);
  for (const output of [html, compact]) {
    assert.match(output, /Starší zachovaná zpráva/);
    assert.match(output, /2\.11\.2026 07:30 UTC/);
    assert.match(output, /&lt;script&gt;offline/);
    assert.doesNotMatch(output, /<script>/);
  }
  assert.match(text, /Starší zachovaná zpráva/);
  assert.match(text, /Tato zpráva stažena 2\.11\.2026 07:30 UTC/);
  assert.match(sourceReview(snapshot).find(row => row.name === 'METAR').text, /1 zpráv zachováno/);
});

test('browser-observed history is explicitly prospective and partial rather than a downloaded twelve-hour archive', () => {
  const value = input();
  Object.assign(value.aviation.metar, { history: [report()], historyMethod: 'browser-observed', historyPartial: true, historyHours: 12, historyStatus: 'ok', historyRetrievedAt: NOW });
  const snapshot = createBriefingSnapshot(value);
  const html = renderBriefingHtml(snapshot), text = renderBriefingText(snapshot);
  assert.match(html, /Pozorování METAR zachycená prohlížečem · neúplná historie/);
  assert.match(html, /neposkytuje počáteční dvanáctihodinový archiv/);
  assert.doesNotMatch(html, /Historie pozorování METAR · 12 h/);
  assert.match(text, /Neúplná historie/);
  assert.match(html, /3.?500|3500/);
});

test('display-only radar never becomes an embedded offline image, even if legacy bytes are accidentally supplied', () => {
  const value = input();
  value.aviation.radar = { status: 'ok', displayOnly: true, imageFetchStatus: 'unsupported-cors', observedAt: '2026-11-02T10:10:00Z', retrievedAt: NOW, url: 'https://opendata.chmi.cz/actual-radar.png', imageDataUrl: png };
  value.radarImageDataUrl = png;
  const snapshot = createBriefingSnapshot(value);
  assert.equal(snapshot.radarImageDataUrl, null);
  assert.equal(snapshot.aviation.radar.imageDataUrl, null);
  const html = renderBriefingHtml(snapshot), text = renderBriefingText(snapshot);
  assert.match(html, /Zdroj nepovoluje čtení obrazových dat přes CORS/);
  assert.match(html, /2\.11\.2026 10:10 UTC/);
  assert.match(html, /href="https:\/\/opendata\.chmi\.cz\/actual-radar\.png"/);
  assert.doesNotMatch(html, /<img class="radar-image"|Vložený snímek:/);
  assert.match(text, /pouze online, obraz kvůli CORS není vložen/);
});

test('legacy NOAA archives retain their provider and offline embedded radar', () => {
  const value = input();
  delete value.aviation.provider; delete value.aviation.sourceName;
  for (const key of ['metar', 'taf', 'sigmet']) {
    delete value.aviation[key].provider;
    value.aviation[key].sourceUrl = `https://aviationweather.gov/api/data/${key}`;
    for (const item of value.aviation[key].items) { delete item.provider; item.sourceUrl = value.aviation[key].sourceUrl; }
  }
  value.aviation.radar = { status: 'ok', observedAt: '2026-11-02T10:10:00Z', imageObservedAt: '2026-11-02T10:10:00Z', imageUrl: 'https://opendata.chmi.cz/actual-radar.png' };
  value.radarImageDataUrl = png;
  const snapshot = createBriefingSnapshot(value);
  assert.equal(reportProviderName(snapshot, 'metar'), 'NOAA Aviation Weather Center');
  assert.match(renderBriefingText(snapshot), /Zdroj zpráv: NOAA Aviation Weather Center/);
  assert.match(renderBriefingHtml(snapshot), /Vložený snímek: 2\.11\.2026 10:10 UTC/);
  assert.ok(renderBriefingHtml(snapshot).includes(`src="${png}"`));
});

test('display-only capability without a confirmed frame never claims a radar image was loaded', () => {
  const value = input();
  value.aviation.radar = { status: 'unavailable', displayOnly: true, imageFetchStatus: 'unsupported-cors', observedAt: null, retrievedAt: null, url: null, sourceUrl: 'https://opendata.chmi.cz/radar/' };
  const snapshot = createBriefingSnapshot(value), html = renderBriefingHtml(snapshot), text = renderBriefingText(snapshot);
  assert.match(html, /Radarový obraz nebyl při uložení potvrzeně načten/);
  assert.doesNotMatch(html, /Radar byl v prohlížeči dostupný/);
  assert.match(text, /obraz nebyl potvrzeně načten/);
  assert.equal(sourceReview(snapshot).find(row => row.name === 'Radar ČHMÚ').tone, 'warn');
});

test('mixed archived provider identity follows each report instead of the current global provider', () => {
  const value = input();
  Object.assign(value.aviation.metar.items[0], { provider: 'noaa-awc', sourceUrl: 'https://aviationweather.gov/api/data/metar' });
  const snapshot = createBriefingSnapshot(value);
  assert.equal(reportProviderName(snapshot, 'metar', snapshot.aviation.metar.items[0]), 'NOAA Aviation Weather Center');
  assert.match(reportSources(snapshot), /ČHMÚ MET-SWIM/);
  assert.match(reportSources(snapshot), /NOAA Aviation Weather Center/);
});

test('new municipal video remains online-only and original blocked products retain official links without remote loads', () => {
  const value = input(); value.cameras = createBrowserCameras(); value.charts = createBrowserCharts();
  const snapshot = createBriefingSnapshot(value), html = renderBriefingHtml(snapshot), text = renderBriefingText(snapshot);
  assert.match(html, /https:\/\/stream\.c-budejovice\.cz\/webkamera-4-radnice\.html/);
  assert.match(html, /přesný čas pořízení není poskytován/);
  assert.match(html, /https:\/\/www\.chmi\.cz\/letectvi\/predpovedi-pro-letani\/swl-mapa/);
  assert.match(html, /https:\/\/www\.chmi\.cz\/letectvi\/predpovedi-pro-letani\/predpoved-nizke-oblacnosti/);
  assert.doesNotMatch(html, /<iframe|<video|<img[^>]+src="https?:/);
  assert.match(text, /MĚSTSKÁ KAMERA · SAMOSTATNÝ POHLED/);
  assert.match(text, /přesný čas pořízení není poskytován; video není v uloženém souboru/);
  assert.equal(snapshot.cameras.onlineViewer.observedAt, null);
  assert.equal(snapshot.cameras.onlineViewer.captured, false);
});

function metnoReport(){
  return {
    ...report(),id:'metar:LOWL:2026-11-02T10:00:00Z',provider:'metno-tafmetar',station:'LOWL',
    raw:'LOWL 021000Z AUTO VRB02KT 9999 OVC035 09/06 Q1026=',
    sourceUrl:'https://api.met.no/weatherapi/tafmetar/1.0/metar.xml?icao=LOWL',
    sourceFilename:null,sourceUpdatedAt:null,source:{reportType:'AUTO'},
  };
}

test('MET Norway supplemental reports keep exact raw text and distinct provider identity without duplicate footer names',()=>{
  const value=input();
  value.aviation.provider='chmi-swim+metno';
  value.aviation.sourceName='ČHMÚ MET-SWIM + MET Norway · přímé požadavky prohlížeče';
  value.aviation.metar.provider='chmi-swim+metno';
  value.aviation.taf.provider='chmi-swim+metno';
  value.aviation.metar.items.push(metnoReport());
  value.aviation.metar.supplementSourceUrl=metnoReport().sourceUrl;
  value.aviation.metar.missingStations=['LKHS','LOWW'];
  value.aviation.supplementWarning='MET Norway · informace poskytovatele zachovaná z adaptéru.';
  value.aviation.attribution='ČHMÚ · Aeronautical Meteorological Service; doplňková data MET Norway (CC BY 4.0 / NLOD 2.0).';
  value.aviation.supplementDocumentationUrl='https://api.met.no/weatherapi/tafmetar/1.0/documentation';
  value.aviation.supplementLicenceUrl='https://api.met.no/doc/License';
  value.aviation.supplementTermsUrl='https://api.met.no/doc/TermsOfService';
  const snapshot=createBriefingSnapshot(value);
  assert.equal(reportProviderName(snapshot,'metar',snapshot.aviation.metar.items[0]),'ČHMÚ MET-SWIM');
  assert.equal(reportProviderName(snapshot,'metar',snapshot.aviation.metar.items[1]),'MET Norway');
  assert.equal(reportProviderName(snapshot,'metar'),'ČHMÚ MET-SWIM + MET Norway');
  assert.equal(reportSources(snapshot),'ČHMÚ MET-SWIM / MET Norway');
  const html=renderBriefingHtml(snapshot),compact=renderBriefingHtml(snapshot,{mode:'reports'}),text=renderBriefingText(snapshot);
  for(const output of [html,compact,text]){
    assert.match(output,/MET Norway/);
    assert.match(output,/LOWL 021000Z AUTO VRB02KT/);
    assert.doesNotMatch(output,/METAR LOWL 021000Z/);
    assert.match(output,/informace poskytovatele zachovaná z adaptéru/);
  }
  for(const output of [html,compact]){
    assert.match(output,/href="https:\/\/api\.met\.no\/weatherapi\/tafmetar\/1\.0\/metar\.xml\?icao=LOWL"/);
    assert.match(output,/MET Norway \(CC BY 4\.0 \/ NLOD 2\.0\)/);
    for(const url of [value.aviation.supplementDocumentationUrl,value.aviation.supplementLicenceUrl,value.aviation.supplementTermsUrl])assert.equal(output.split(`href="${url}"`).length-1,1,`${url} is linked once`);
  }
  assert.equal(snapshot.aviation.metar.items[1].observedAt,'2026-11-02T10:00:00.000Z');
});

test('captured provider credit escapes markup and removes unsafe link schemes and credentials',()=>{
  const html=renderAviationAttribution({aviation:{
    attribution:'MET Norway <img src=x onerror=alert(1)>',
    supplementDocumentationUrl:'javascript:alert(1)',
    supplementLicenceUrl:'https://name:secret@api.met.no/doc/License?api_key=private&version=4',
    supplementTermsUrl:'https://api.met.no/doc/TermsOfService',
  }});
  assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html,/href="https:\/\/api\.met\.no\/doc\/License\?version=4"/);
  assert.doesNotMatch(html,/<img|href="javascript:|secret|private|name:|api_key/);
  assert.match(html,/rel="noopener noreferrer"/);
});

test('source archive plus browser history is partial but does not claim the archive is unavailable',()=>{
  const value=input();
  Object.assign(value.aviation.metar,{
    provider:'chmi-swim+metno',history:[{...metnoReport(),id:'metar:LOWL:older',observedAt:'2026-11-02T09:00:00Z'}],
    historyMethod:'source-archive-and-browser',historyPartial:true,historyHours:12,historyStatus:'partial',historyRetrievedAt:NOW,
    historyError:'Archiv poskytovatele a pozorování prohlížeče mohou mít mezery.',
  });
  const snapshot=createBriefingSnapshot(value),info=observationHistoryInfo(snapshot),html=renderBriefingHtml(snapshot),text=renderBriefingText(snapshot);
  assert.equal(info.kind,'combined');assert.equal(info.partial,true);
  assert.match(html,/Historie METAR · archiv zdroje a zachycení prohlížeče/);
  assert.match(html,/Skutečné archivní zprávy poskytovatele/);
  assert.match(text,/Pokrytí stanic a časů může být neúplné/);
  assert.doesNotMatch(html,/Zdroj neposkytuje počáteční dvanáctihodinový archiv/);
  assert.doesNotMatch(text,/pouze skutečné zprávy zachycené tímto prohlížečem/);
  assert.match(html,/2\.11\.2026 09:00 UTC/);
  assert.match(html,/Archiv poskytovatele a pozorování prohlížeče mohou mít mezery/);
  assert.equal(sourceReview(snapshot).find(row=>row.name==='Historie METAR').tone,'warn');
});

function directSwl(){
  const charts=createBrowserCharts();
  charts.status='ok';charts.retrievedAt='2026-11-02T10:05:00Z';
  charts.swl={status:'ok',imageUrl:'https://meteo.rlp.cz/swlmap.png?t=1762077900000',sourceUrl:'https://meteo.rlp.cz/swlmap.png',pageUrl:'https://www.chmi.cz/letectvi/predpovedi-pro-letani/swl-mapa',documentationUrl:'https://meteo.rlp.cz/swldoc.pdf',attribution:'ČHMÚ · distribuce ŘLP ČR',displayOnly:true,confirmedBy:'image-load',retrievedAt:'2026-11-02T10:05:00Z',checkedAt:NOW,attemptedAt:NOW,issuedAt:null,validFrom:null,validTo:null,validityStatus:'unverified',timeEvidence:'image-heading',imagePath:null,imageDataUrl:null,width:1800,height:1200,error:null};
  return charts;
}

test('display-only SWL captures a link and genuine load time without remote loads or invented forecast validity',()=>{
  const value=input();value.charts=directSwl();
  const snapshot=createBriefingSnapshot(value),html=renderBriefingHtml(snapshot),text=renderBriefingText(snapshot),review=sourceReview(snapshot).find(row=>row.name==='SWL ČHMÚ');
  assert.equal(snapshot.charts.swl.imageUrl,null);
  assert.equal(snapshot.charts.swl.onlineImageUrl,value.charts.swl.imageUrl);
  assert.equal(snapshot.charts.swl.onlineOnly,true);
  assert.equal(snapshot.charts.swl.imageDataUrl,null);
  assert.equal(snapshot.charts.swl.issuedAt,null);assert.equal(snapshot.charts.swl.validFrom,null);assert.equal(snapshot.charts.swl.validTo,null);
  assert.equal(snapshot.charts.swl.retrievedAt,'2026-11-02T10:05:00Z');
  assert.equal(value.charts.swl.imageUrl,'https://meteo.rlp.cz/swlmap.png?t=1762077900000');
  assert.equal(review.tone,'warn');
  assert.match(review.text,/ČHMÚ · distribuce ŘLP ČR/);
  assert.match(review.text,/čti v záhlaví mapy v UTC/);
  assert.doesNotMatch(review.text,/pokrývá čas přehledu/);
  assert.match(html,/href="https:\/\/meteo\.rlp\.cz\/swlmap\.png\?t=1762077900000"/);
  assert.doesNotMatch(html,/<img[^>]+src="https?:|<iframe|<script/);
  assert.match(text,/tento čas není vydáním ani platností/);
  assert.match(text,/vztah k času přehledu není strojově ověřen/);
});

test('SWL snapshot rejects forged normalized time, embedded bytes and arbitrary remote image URLs',()=>{
  let value=input();value.charts=directSwl();value.charts.swl.issuedAt=NOW;
  assert.throws(()=>createBriefingSnapshot(value),/SWL|platnost|Neplatný/);
  value=input();value.charts=directSwl();value.charts.swl.validFrom='2026-11-02T10:00:00Z';value.charts.swl.validTo='2026-11-02T11:00:00Z';
  assert.throws(()=>createBriefingSnapshot(value),/SWL|platnost|Neplatný/);
  value=input();value.charts=directSwl();value.charts.swl.imageDataUrl=png;
  assert.throws(()=>createBriefingSnapshot(value),/SWL|vložen|obraz/);
  value=input();value.charts=directSwl();value.charts.swl.imageUrl='https://meteo.rlp.cz.evil.example/swlmap.png';
  assert.throws(()=>createBriefingSnapshot(value),/SWL|Neplatný/);
});

test('legacy embedded SWL retains its actual issue and validity interval',()=>{
  const value=input();
  value.charts={schemaVersion:1,swl:{status:'ok',issuedAt:'2026-11-02T09:00:00Z',validFrom:'2026-11-02T10:00:00Z',validTo:'2026-11-02T11:00:00Z',retrievedAt:'2026-11-02T10:05:00Z',imageDataUrl:png,width:100,height:100},lowCloud:{status:'empty',frames:[]}};
  const snapshot=createBriefingSnapshot(value),html=renderBriefingHtml(snapshot),review=sourceReview(snapshot).find(row=>row.name==='SWL ČHMÚ');
  assert.equal(snapshot.charts.swl.issuedAt,'2026-11-02T09:00:00Z');
  assert.equal(snapshot.charts.swl.validFrom,'2026-11-02T10:00:00Z');
  assert.equal(review.tone,'neutral');
  assert.match(review.text,/Vložená mapa pokrývá čas přehledu/);
  assert.ok(html.includes(`src="${png}"`));
});
