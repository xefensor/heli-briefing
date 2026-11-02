import test from 'node:test';
import assert from 'node:assert/strict';
import { createBriefingSnapshot, renderBriefingHtml, renderBriefingText } from '../web/js/archive.js';
import { sourceReview, reportProviderName, reportSources, observationHistoryInfo, renderAviationAttribution } from '../web/js/handoff.js';
import { createBrowserCameras, fetchBrowserCameras } from '../web/js/cameras.js';
import { createBrowserCharts, captureCharts } from '../web/js/aviation-charts.js';
import { fetchSigmetImage, SIGMET_IMAGE_URL } from '../web/js/sigmet-image-source.js';
import { parseLowCloudFiles, LOW_CLOUD_PAGE } from '../web/js/lowcloud-file-source.js';
import { createProcessedCeilingSource, PROCESSED_CEILING_ORIGIN } from '../web/js/processed-ceiling-source.js';
import { fixtureTiff, fixtureCell } from './processed-geotiff-fixtures.mjs';

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

test('confirmed original camera views freeze only source links and preserve unknown exposure and file buckets',async()=>{
  const value=input();let requests=0;
  value.cameras=await fetchBrowserCameras({now:()=>Date.parse(NOW),loadImage:async(url,{id})=>{
    requests+=1;
    if(id==='churanov'&&!url.includes('latest_thumb.jpg'))throw new Error('Full image unavailable');
    return {width:1280,height:720};
  }});
  const original=value.cameras.items[0].imageUrl;
  value.cameras.items[2].status='stale';value.cameras.items[2].error='Obnova obrazu selhala.';
  const snapshot=createBriefingSnapshot(value),html=renderBriefingHtml(snapshot),text=renderBriefingText(snapshot),review=sourceReview(snapshot).find(row=>row.name==='Kamery ČHMÚ');
  assert.equal(requests,5);
  assert.equal(value.cameras.items[0].imageUrl,original);
  assert.equal(snapshot.cameras.items[0].imageUrl,null);
  assert.equal(snapshot.cameras.items[0].onlineImageUrl,original);
  assert.equal(snapshot.cameras.items[0].onlineOnly,true);
  assert.equal(snapshot.cameras.items[0].observedAt,null);
  assert.equal(snapshot.cameras.items[0].fileBucketAt,'2026-11-02T10:00:00.000Z');
  assert.equal(snapshot.cameras.items[1].variant,'thumbnail');
  assert.equal(snapshot.cameras.items[1].fileBucketAt,null);
  assert.ok(snapshot.cameras.items.every(item=>item.imageDataUrl===null));
  assert.equal(createBriefingSnapshot({...value,cameras:snapshot.cameras}).cameras.items[0].onlineImageUrl,original);
  assert.equal(review.tone,'warn');assert.match(review.text,/3 \/ 3 původních pohledů potvrzeně načteno online/);
  assert.match(review.text,/Čas pořízení není ověřen/);
  assert.match(html,/href="https:\/\/webcams\.ventusky\.com\/data\/55\/186428055\/hour\/20261102_1000\.jpg\?t=\d+"/);
  assert.match(html,/Obnova obrazu selhala/);
  assert.match(html,/Hodinová složka souboru [^<]+ UTC · není čas pořízení/);
  assert.match(html,/Zdrojový soubor: malý náhled/);
  assert.match(text,/hodinová složka souboru 2\.11\.2026 10:00 UTC \(není čas pořízení\)/);
  assert.match(text,/poslední potvrzené načtení 2\.11\.2026 10:15 UTC/);
  assert.match(text,/pouze malý náhled/);
  assert.doesNotMatch(html,/<img[^>]+src="https?:|<canvas|<iframe|<script/);
});

test('frozen camera capture rejects invented exposure, pixel bytes and a different image host',async()=>{
  const value=input();value.cameras=await fetchBrowserCameras({now:()=>Date.parse(NOW),loadImage:async()=>({width:1280,height:720})});
  const original=structuredClone(value.cameras);
  value.cameras.items[0].observedAt=NOW;
  assert.throws(()=>createBriefingSnapshot(value),/původ|čas|obraz/);
  value.cameras=structuredClone(original);value.cameras.items[0].imageDataUrl=png;
  assert.throws(()=>createBriefingSnapshot(value),/původ|čas|obraz/);
  value.cameras=structuredClone(original);value.cameras.items[0].imageUrl=value.cameras.items[0].imageUrl.replace('webcams.ventusky.com','webcams.ventusky.com.evil.example');
  assert.throws(()=>createBriefingSnapshot(value),/kamerový obraz/);
});

function nativeEuPoint(){
  const cell={lat:48.95,lon:14.43,index:824,gridUuid:'832c1507fbc73eb384139890094d2c60',elevationMsl:null};
  const runTime='2026-11-02T06:00:00Z',validAt='2026-11-02T10:00:00Z',retrievedAt='2026-11-02T10:14:00Z';
  return {
    model:'ICON-EU',product:'CEILING',units:'m MSL',status:'available',valueMsl:880,cell,distanceKm:0.5,runTime,validAt,retrievedAt,
    sourceUrl:'https://opendata.dwd.de/weather/nwp/v1/m/icon-eu/p/CEILING/',attribution:'DWD · CC BY 4.0',
    documentationUrl:'https://www.dwd.de/SharedDocs/downloads/DE/modelldokumentationen/nwv/icon/icon_dbbeschr_aktuell.pdf?view=nasPublication',
    definition:'První výška nad mořem s pokrytím nad 50 %, bez konvektivní složky.',
    stale:false,error:'Část hodin nemá definovanou hodnotu.',
    series:{times:[validAt,'2026-11-02T11:00:00Z','2026-11-02T12:00:00Z'],values:[880,null,0]},
    regional:{model:'ICON-EU',product:'CEILING',units:'m MSL',runTime,validAt,retrievedAt,gridUuid:cell.gridUuid,bounds:[[48,13],[50,16]],totalCells:20,subset:true,
      nodes:[{lat:cell.lat,lon:cell.lon,index:cell.index,valueMsl:880},{lat:49.1,lon:14.5,index:825,valueMsl:null},{lat:49.2,lon:14.6,index:826,valueMsl:0}],
      selectedCell:{...cell,valueMsl:880}},
  };
}

test('native ICON-EU export freezes its actual series and regional cell map with independent source clocks and MSL reference',()=>{
  const value=input();value.clouds=nativeEuPoint();
  const snapshot=createBriefingSnapshot(value),html=renderBriefingHtml(snapshot),text=renderBriefingText(snapshot),review=sourceReview(snapshot).find(row=>row.name==='ICON-EU CEILING');
  assert.equal(snapshot.clouds.model,'ICON-EU');assert.equal(snapshot.clouds.series.values[1],null);assert.equal(snapshot.clouds.series.values[2],0);
  assert.equal(snapshot.clouds.cell.elevationMsl,null);assert.equal(snapshot.clouds.regional.gridUuid,snapshot.clouds.cell.gridUuid);
  assert.equal(review.tone,'warn');assert.match(review.text,/Část hodin nemá definovanou hodnotu/);
  assert.match(html,/DWD ICON-EU CEILING/);assert.doesNotMatch(html,/DWD ICON-D2 CEILING/);
  assert.match(html,/880 m MSL/);assert.match(html,/nikoli AGL a nikoli pozorovaný ceiling METAR/);
  assert.match(html,/2\.11\.2026 06:00 UTC \/ 2\.11\.2026 10:14 UTC/);
  assert.match(html,/832c1507fbc73eb384139890094d2c60/);
  assert.match(html,/href="https:\/\/www\.dwd\.de\/SharedDocs\/downloads\/DE\/modelldokumentationen\/nwv\/icon\/icon_dbbeschr_aktuell\.pdf\?view=nasPublication"/);
  assert.match(html,/<figure class="native-ceiling-map"/);
  assert.equal((html.match(/data-cell-index=/g)||[]).length,3);
  assert.match(html,/native-ceiling-node--missing/);assert.match(html,/3 \/ 20 skutečných buněk/);
  assert.match(html,/není to mapa nízké oblačnosti ČHMÚ/);
  assert.match(text,/2\.11\.2026 12:00 UTC · 0 m MSL/);assert.match(text,/Regionální mapa ICON-EU CEILING/);
  assert.doesNotMatch(html,/<image|<img[^>]+src="https?:|<iframe|<script/);
});

test('regional ceiling cannot borrow a different run, valid time, UUID or selected cell value when captured or rendered',()=>{
  for(const mutate of [
    data=>{data.regional.runTime='2026-11-02T05:00:00Z';},
    data=>{data.regional.validAt='2026-11-02T11:00:00Z';},
    data=>{data.regional.gridUuid='932c1507fbc73eb384139890094d2c60';},
    data=>{data.regional.selectedCell.valueMsl=1700;},
    data=>{data.regional.nodes[0].valueMsl=1700;},
  ]){
    const value=input();value.clouds=nativeEuPoint();mutate(value.clouds);
    assert.throws(()=>createBriefingSnapshot(value),/CEILING/);
    const snapshot=structuredClone(createBriefingSnapshot({...input(),clouds:nativeEuPoint()}));mutate(snapshot.clouds);
    assert.throws(()=>renderBriefingHtml(snapshot),/CEILING/);
  }
});

test('a missing selected native hour retains the genuine partial series without a borrowed point value or regional map',()=>{
  const value=input();value.clouds=nativeEuPoint();
  Object.assign(value.clouds,{status:'outside-horizon',valueMsl:null,validAt:null,stale:true,error:'Vybraná hodina se ve zdroji nepodařila načíst.'});
  delete value.clouds.regional;
  const snapshot=createBriefingSnapshot(value),html=renderBriefingHtml(snapshot),text=renderBriefingText(snapshot),review=sourceReview(snapshot).find(row=>row.name==='ICON-EU CEILING');
  assert.equal(review.tone,'warn');assert.doesNotMatch(review.text,/880 m MSL/);
  assert.match(html,/Pro vybraný čas není dostupný nativní výstup/);
  assert.match(html,/Vybraná hodina se ve zdroji nepodařila načíst/);
  assert.match(html,/Hodinové hodnoty ICON-EU CEILING/);
  assert.doesNotMatch(html,/<figure class="native-ceiling-map"/);
  assert.match(text,/Samostatný ICON-EU CEILING: nedostupný/);
  assert.match(text,/2\.11\.2026 10:00 UTC · 880 m MSL/);
  assert.match(text,/2\.11\.2026 12:00 UTC · 0 m MSL/);
});

const loadMap=async()=>({width:2000,height:1100});
test('SIGMET/AIREP image evidence stays online-only and separate from the structured warning inventory in every output',async()=>{
  const value=input();value.charts=directSwl();value.charts.sigmetImage=await fetchSigmetImage({now:()=>Date.parse(NOW),loadImage:loadMap});
  const imageUrl=value.charts.sigmetImage.imageUrl,snapshot=createBriefingSnapshot(value);
  assert.equal(snapshot.charts.sigmetImage.imageUrl,null);assert.equal(snapshot.charts.sigmetImage.onlineImageUrl,imageUrl);
  assert.equal(snapshot.charts.sigmetImage.onlineOnly,true);assert.equal(snapshot.charts.sigmetImage.imageDataUrl,null);
  assert.equal(snapshot.charts.sigmetImage.coverageComplete,false);
  for(const key of ['issuedAt','validFrom','validTo','observedAt','updatedAt'])assert.equal(snapshot.charts.sigmetImage[key],null);
  assert.equal(value.charts.sigmetImage.imageUrl,imageUrl);
  assert.equal(createBriefingSnapshot({...value,charts:snapshot.charts}).charts.sigmetImage.onlineImageUrl,imageUrl);
  assert.equal(reportSources(snapshot),'ČHMÚ MET-SWIM');
  for(const mode of ['full','reports']){
    const html=renderBriefingHtml(snapshot,{mode}),text=renderBriefingText(snapshot,{mode}),row=sourceReview(snapshot,{mode}).find(row=>row.name==='Mapa SIGMET / AIREP');
    assert.equal(row.tone,'warn');assert.match(row.text,/úplnost pokrytí nejsou ověřeny/);
    assert.ok(html.includes(`href="${imageUrl}"`));assert.doesNotMatch(html,/<img[^>]+src="https?:|<iframe|<script/);
    assert.match(html,/Prázdná mapa[^<]*nepotvrzuj/);
    assert.match(text,/MAPA SIGMET \/ AIREP · POUZE ONLINE/);
    assert.match(text,/Čas načtení není vydáním ani platností/);
    assert.match(text,/Úplnost pokrytí SIGMET\/AIREP není potvrzena/);
    assert.match(text,/ŘLP ČR · meteorologická data ČHMÚ/);
    assert.ok(text.includes(imageUrl));
  }
});

test('failed SIGMET map renewal retains the actual older load time while a first failure claims no loaded image',async()=>{
  const value=input();value.charts=directSwl();
  const previous=await fetchSigmetImage({now:()=>Date.parse(NOW),loadImage:loadMap});
  value.createdAt='2026-11-02T11:15:00Z';
  value.charts.sigmetImage=await fetchSigmetImage({previous,now:()=>Date.parse(value.createdAt),loadImage:async()=>{throw Error('offline');}});
  let snapshot=createBriefingSnapshot(value),text=renderBriefingText(snapshot),html=renderBriefingHtml(snapshot);
  assert.equal(snapshot.charts.sigmetImage.status,'stale');assert.equal(snapshot.charts.sigmetImage.retrievedAt,NOW);
  assert.equal(snapshot.charts.sigmetImage.checkedAt,'2026-11-02T11:15:00.000Z');
  assert.match(text,/Poslední potvrzené načtení 2\.11\.2026 10:15 UTC · obnova selhala/);
  assert.match(text,/Kontrola obnovy 2\.11\.2026 11:15 UTC/);
  assert.match(text,/zdrojová adresa může nyní ukazovat jiný obraz/);
  assert.doesNotMatch(html,/Samostatná aktuální mapa|<img[^>]+src="https?:/);
  value.charts.sigmetImage=await fetchSigmetImage({now:()=>Date.parse(value.createdAt),loadImage:async()=>{throw Error('offline');}});
  snapshot=createBriefingSnapshot(value);
  const row=sourceReview(snapshot).find(row=>row.name==='Mapa SIGMET / AIREP');
  assert.equal(snapshot.charts.sigmetImage.retrievedAt,null);assert.equal(snapshot.charts.sigmetImage.onlineImageUrl,undefined);
  assert.match(row.text,/Načtení nepotvrzeno/);assert.doesNotMatch(row.text,/Poslední potvrzené načtení/);
  assert.ok(renderBriefingHtml(snapshot,{mode:'reports'}).includes(`href="${SIGMET_IMAGE_URL}"`));
});

test('SIGMET image export rejects fabricated validity, completeness, embedded bytes and malformed captured proof',async()=>{
  const original=await fetchSigmetImage({now:()=>Date.parse(NOW),loadImage:loadMap});
  for(const mutate of [
    image=>{image.issuedAt=NOW;},image=>{image.validTo=NOW;},image=>{image.coverageComplete=true;},
    image=>{image.imageDataUrl=png;},image=>{image.imageUrl='https://meteo.rlp.cz.evil.example/sigmetmap.png';},
  ]){
    const value=input();value.charts=directSwl();value.charts.sigmetImage=structuredClone(original);mutate(value.charts.sigmetImage);
    assert.throws(()=>createBriefingSnapshot(value),/SIGMET/);
  }
  const snapshot=createBriefingSnapshot({...input(),charts:{...directSwl(),sigmetImage:original}});
  for(const mutate of [image=>{image.retrievedAt=null;},image=>{image.confirmedBy=null;},image=>{image.width=10;}]){
    const edited=structuredClone(snapshot);mutate(edited.charts.sigmetImage);
    assert.throws(()=>renderBriefingHtml(edited),/SIGMET/);
  }
});

test('historical charts without a SIGMET image remain readable without inventing map availability',()=>{
  const value=input();value.charts=directSwl();delete value.charts.sigmetImage;
  const snapshot=createBriefingSnapshot(value);
  assert.equal(snapshot.charts.sigmetImage,undefined);
  assert.equal(sourceReview(snapshot).find(row=>row.name==='Mapa SIGMET / AIREP'),undefined);
  assert.doesNotMatch(renderBriefingHtml(snapshot,{mode:'reports'}),/class="sigmet-image-evidence"/);
  assert.doesNotMatch(renderBriefingText(snapshot),/MAPA SIGMET \/ AIREP · POUZE ONLINE/);
});

const localPng='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAPklEQVR4nO3BMQEAAADCoPVPbQsvoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgKcBnKQAAaZ1lY4AAAAASUVORK5CYII=';
async function localCharts(names=['202611020900.png','202611021200.png']){
  const files=names.map(name=>new File([Buffer.from(localPng.split(',')[1],'base64')],name,{type:'image/png',lastModified:0}));
  const parsed=await parseLowCloudFiles(files,{now:NOW,decodeImage:async(_bytes,{width,height})=>({width,height})});
  return {...directSwl(),lowCloud:{delivery:'local-file',status:'manual',frames:parsed.frames,importedAt:parsed.importedAt,error:null,sourceUrl:LOW_CLOUD_PAGE,projection:'EPSG:3857',bounds:[10.5,47.766666666667,20.316666666667,51.366666666667]}};
}

test('local low-cloud attachment embeds only the selected PNG and keeps import time separate from its unverified filename time',async()=>{
  const value=input();value.charts=await localCharts();let requests=0;
  const prepared=await captureCharts(value.charts,value.state.time,{fetcher:async()=>{requests++;throw Error('Unexpected fetch');}});
  const snapshot=createBriefingSnapshot(value),html=renderBriefingHtml(snapshot),text=renderBriefingText(snapshot),frame=snapshot.charts.selectedLow;
  assert.equal(requests,0);assert.equal(value.charts.lowCloud.frames.length,2);assert.equal(snapshot.charts.lowCloud.frames.length,0);
  assert.equal(frame.originalFileName,'202611020900.png');assert.equal(prepared.selectedLow.originalFileName,frame.originalFileName);
  assert.equal(frame.validAt,'2026-11-02T09:00:00.000Z');assert.equal(frame.importedAt,NOW);
  assert.equal(frame.issuedAt,null);assert.equal(frame.retrievedAt,null);assert.equal(frame.validityConfirmed,false);
  assert.equal(frame.timeBasis,'filename-unverified');assert.equal(frame.imageDataUrl,localPng);
  assert.equal(snapshot.state.time,NOW);assert.equal(createBriefingSnapshot({...value,charts:prepared}).charts.selectedLow.imageDataUrl,localPng);
  assert.equal(sourceReview(snapshot).find(row=>row.name==='Nízká oblačnost ČHMÚ').tone,'warn');
  assert.equal(html.split(`src="${localPng}"`).length-1,1);
  assert.match(html,/Platnost z názvu souboru není nezávisle ověřena/);
  assert.match(text,/Čas v názvu souboru 2\.11\.2026 09:00 UTC není ověřenou platností/);
  assert.match(text,/Nahráno 2\.11\.2026 10:15 UTC; původní vydání a stažení nejsou známy/);
  assert.match(text,/Soubor se sám neaktualizuje/);
  assert.doesNotMatch(html,/<img[^>]+src="https?:|<iframe|<script/);
  assert.doesNotMatch(renderBriefingHtml(snapshot,{mode:'reports'}),/Místní soubor uživatele|src="data:image/);
});

test('manual low-cloud export cannot upgrade filename time to verified validity or retrieval evidence',async()=>{
  const original=await localCharts();
  for(const mutate of [frame=>{frame.validityConfirmed=true;},frame=>{frame.retrievedAt=NOW;},frame=>{frame.validAt=NOW;},frame=>{frame.imageDataUrl=png;}]){
    const value=input();value.charts=structuredClone(original);mutate(value.charts.lowCloud.frames[0]);
    assert.throws(()=>createBriefingSnapshot(value),/Místní|místní|PNG/);
  }
});

test('a missing local low-cloud slot does not inherit a distant imported image',async()=>{
  const value=input();value.state.time='2026-11-02T12:00:00Z';value.charts=await localCharts(['202611020900.png','202611021500.png']);
  const snapshot=createBriefingSnapshot(value),html=renderBriefingHtml(snapshot),text=renderBriefingText(snapshot);
  assert.equal(snapshot.charts.selectedLow,null);assert.equal(snapshot.charts.lowCloud.importedAt,NOW);
  assert.match(text,/Pro čas přehledu není vybraný rámec v dosahu 90 minut/);
  assert.match(html,/Jiná hodina ji nenahrazuje/);
  assert.doesNotMatch(html,/<img[^>]+src="data:image\/png/);
});

async function processedInput({missing=[],omit=[],unknownRun=false}={}){
  const runId='2026110209_2026110211_2026110206',point=fixtureCell(0,0),selectedTime='2026-11-02T11:37:00Z';
  const filename=hour=>`ceiling_${runId}_h${String(hour).padStart(2,'0')}m00.tif`;
  const frames=Array.from({length:6},(_,hour)=>({filename:filename(hour),hour,minute:0,minutesOffset:hour*60,source:hour<2?'RUC':hour<4?'D2':'EU'})).filter(frame=>!omit.includes(frame.hour));
  const latest={run_id:runId,timestamp:'2026-11-02T12:00:00Z',viewers:{ceiling:`viewers/ceiling-viewer-${runId}.html`}};
  const html=`<script>window.ICON_CONFIG={frames:${JSON.stringify(frames)},baseTime:'2026-11-02T11:00:00Z',cogBaseUrl:'${PROCESSED_CEILING_ORIGIN}/cog',runId:'${runId}',productType:'ceiling'};</script>${unknownRun?'':'<footer>D2 2026-11-02 09Z · RUC 2026-11-02 11Z · EU 2026-11-02 06Z</footer>'}`;
  const source=createProcessedCeilingSource({now:()=>Date.parse('2026-11-02T12:37:00Z'),fetchImpl:async url=>{
    if(String(url).endsWith('/latest.json'))return new Response(JSON.stringify(latest),{headers:{'content-type':'application/json'}});
    if(String(url).includes('/viewers/'))return new Response(html,{headers:{'content-type':'text/html'}});
    const hour=Number(/_h(\d+)m00\.tif$/.exec(url)[1]);
    return new Response(fixtureTiff({values:Array.from({length:16},(_,index)=>index===0&&missing.includes(hour)?NaN:hour*100+index)}),{headers:{'content-type':'image/tiff'}});
  }});
  const value=input();value.createdAt='2026-11-02T12:37:00Z';value.state={...value.state,lat:point.lat,lon:point.lon,time:selectedTime};
  value.processedCeiling=await source.load({...point,selectedTime});
  return value;
}

test('processed AGL export preserves mixed per-frame models/runs and nulls independently of native MSL data',async()=>{
  const value=await processedInput({missing:[1],omit:[3]});
  value.clouds={model:'ICON-D2',product:'CEILING',units:'m MSL',status:'available',valueMsl:960,validAt:'2026-11-02T12:00:00Z',runTime:'2026-11-02T09:00:00Z',retrievedAt:'2026-11-02T12:30:00Z',series:{times:['2026-11-02T12:00:00Z'],values:[960]}};
  const snapshot=createBriefingSnapshot(value),html=renderBriefingHtml(snapshot),text=renderBriefingText(snapshot);
  assert.equal(snapshot.processedCeiling.units,'ft AGL');assert.equal(snapshot.processedCeiling.selectedStatus,'missing');
  assert.deepEqual(snapshot.processedCeiling.series.values,[0,null,200,null,400,500]);
  assert.equal(snapshot.processedCeiling.series.frames[2].model,'ICON-D2');
  assert.equal(snapshot.processedCeiling.series.frames[4].model,'ICON-EU');
  assert.equal(snapshot.processedCeiling.series.frames[2].runTime,'2026-11-02T09:00:00.000Z');
  assert.equal(snapshot.clouds.units,'m MSL');assert.equal(snapshot.clouds.valueMsl,960);
  assert.equal(sourceReview(snapshot).find(row=>row.name==='ClearToFly · CEILING (ft AGL)').tone,'warn');
  assert.match(html,/ClearToFly/);assert.match(html,/ft AGL/);assert.match(html,/DWD ICON-D2 CEILING/);assert.match(html,/960 m MSL/);
  assert.match(text,/ZPRACOVANÝ CEILING · ClearToFly · ft AGL/);
  assert.match(text,/2\.11\.2026 11:00 UTC · 0 ft AGL/);
  assert.match(text,/ICON-D2 · běh 2\.11\.2026 09:00 UTC/);
  assert.match(text,/ICON-EU · běh 2\.11\.2026 06:00 UTC/);
  assert.match(text,/převod na AGL, použitý terén a podmínky poskytovatele nejsou v přehledu ověřeny/);
  assert.ok(html.includes(`href="${snapshot.processedCeiling.sourceUrl}"`));
  assert.doesNotMatch(html,/<img[^>]+src="https?:|<image|<iframe|<script/);
  assert.doesNotMatch(renderBriefingHtml(snapshot,{mode:'reports'}),/ClearToFly|ZPRACOVANÝ CEILING/);
  value.processedCeiling.series.values[0]=999;assert.equal(snapshot.processedCeiling.series.values[0],0);
});

test('processed source reference time remains separate when the provider has not identified a model run',async()=>{
  const value=await processedInput({unknownRun:true}),snapshot=createBriefingSnapshot(value),text=renderBriefingText(snapshot);
  assert.equal(snapshot.processedCeiling.runTime,null);
  assert.ok(snapshot.processedCeiling.series.frames.every(frame=>frame.runTime===null));
  assert.equal(snapshot.processedCeiling.providerReferenceTime,'2026-11-02T11:00:00.000Z');
  assert.match(text,/Referenční čas poskytovatele 2\.11\.2026 11:00 UTC není během modelu/);
  assert.match(text,/ICON-D2-RUC · běh čas neuveden/);
  assert.doesNotMatch(text,/ICON-D2-RUC · běh 2\.11\.2026 11:00 UTC/);
});

test('processed source capture rejects a different context, unit or raster quantity while preserving an equivalent cached request',async()=>{
  const value=await processedInput();
  assert.doesNotThrow(()=>createBriefingSnapshot({...value,state:{...value.state,time:'2026-11-02T11:36:00Z'}}));
  for(const state of [{...value.state,lat:value.state.lat+.1},{...value.state,time:'2026-11-02T11:29:00Z'},{...value.state,time:'2026-11-02T11:45:00Z'},{...value.state,time:'2026-11-02T12:36:00Z'}])assert.throws(()=>createBriefingSnapshot({...value,state}),/CEILING|míst|čas|kontext/);
  for(const mutate of [data=>{data.units='m MSL';},data=>{data.product='CLCL';},data=>{data.regional.units='m MSL';},data=>{data.series.frames[0].validAt='2026-11-02T10:00:00Z';}]){
    const edited=structuredClone(value);mutate(edited.processedCeiling);
    assert.throws(()=>createBriefingSnapshot(edited),/CEILING|ceiling|rastr|ClearToFly/);
  }
});
