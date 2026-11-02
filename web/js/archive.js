import { renderAstronomyChart } from './astronomy-view.js';
import {renderReportPack,renderSourceReview,selectedForecastLines,formatBriefingText,reportSources,reportProviderName,reportTransportNote,reportCoverageNotes,observationHistoryInfo,renderAviationAttribution} from './handoff.js';
import {renderProfile,profileAt} from './profile.js';
import {renderSatellite,satelliteState} from './satellite.js';
import { renderChart, escapeHtml as esc } from './charts.js';
import { formatNumber, formatTime, formatCoordinates, reportState } from './briefing.js';
import { nearestTimeIndex } from './weather.js';
import { summarizeMetar, summarizeTaf, formatReportSummary } from './reports.js';
import { observationSeries } from './observations.js';
import { CLOUD_STATUS_LABELS } from './clouds.js';
import { validateRouteBundle, renderRouteBriefing, ROUTE_PRINT_CSS } from './route.js';
import { SECTION_PRINT_CSS } from './section.js';
import { validateCameras, captureCameras, renderCameras, CAMERAS_PRINT_CSS } from './cameras.js';
import { validateCharts, selectedLowCloud, renderAviationCharts, CHARTS_PRINT_CSS } from './aviation-charts.js';
import { validateNativeCeilingRegional, renderNativeCeilingMap } from './native-ceiling-map.js';
import { validateProcessedCeiling, renderProcessedCeiling, PROCESSED_CEILING_PRINT_CSS } from './processed-ceiling-view.js';

export const ARCHIVE_KEY = 'heli-briefing-archive-v1';
export const ARCHIVE_MAX_ITEMS = 10;
export const ARCHIVE_MAX_BYTES = 5_000_000;
export const ARCHIVE_DB_MAX_BYTES = 20_000_000;
const MODELS = new Set(['aladin', 'icon', 'ecmwf']);
const ZONES = new Set(['UTC', 'Europe/Prague']);
const HOUR = 3_600_000;
const SECRET_KEY = /^(?:api[-_]?key|access[-_]?token|authorization|password|secret|credential|signedurl)$/i;
const SECRET_QUERY = /(?:api[-_]?key|token|auth|password|secret|signature|credential)|^(?:key|sig)$/i;
const FIELDS = [
  ['wind', 'Vítr 10 m', 'kt'], ['gust', 'Nárazy', 'kt'], ['direction', 'Směr', '°'],
  ['visibility', 'Dohlednost', 'm'], ['cloudLow', 'Nízká oblačnost', '%'],
  ['cloudMid', 'Střední oblačnost', '%'], ['cloudHigh', 'Vysoká oblačnost', '%'],
  ['precipitation', 'Srážky za předchozí hodinu', 'mm'], ['temperature', 'Teplota 2 m', '°C'],
  ['dewpoint', 'Rosný bod 2 m', '°C'], ['pressure', 'Tlak MSL', 'hPa'],
  ['wind925', 'Vítr 925 hPa', 'kt'], ['height925', 'Hladina 925 hPa', 'm MSL'],
  ['humidity', 'Vlhkost 2 m', '%'],
];
const CHARTS = [
  ['Vítr a nárazy', 'kt', [['wind', 'Vítr', '#287b8c'], ['gust', 'Nárazy', '#a16a19']], 0],
  ['Modelová dohlednost', 'km', [['visibility', 'Dohlednost', '#287b8c']], 0, undefined, 1000],
  ['Oblačnost podle vrstev', '%', [['cloudLow', 'Nízká', '#287b8c'], ['cloudMid', 'Střední', '#a16a19'], ['cloudHigh', 'Vysoká', '#866aa3']], 0, 100],
  ['Hodinové srážky', 'mm', [['precipitation', 'Úhrn', '#647aab']], 0],
  ['Teplota a rosný bod', '°C', [['temperature', 'Teplota', '#a16a19'], ['dewpoint', 'Rosný bod', '#287b8c']]],
  ['Tlak na hladině moře', 'hPa', [['pressure', 'MSL', '#866aa3']]],
  ['Vítr v tlakové hladině 925 hPa', 'kt', [['wind925', '925 hPa', '#647aab']], 0],
  ['Relativní vlhkost', '%', [['humidity', 'Vlhkost', '#287b8c']], 0, 100],
];

export class ArchiveError extends Error {
  constructor(message, code = 'archive') { super(message); this.name = 'ArchiveError'; this.code = code; }
}

function safeUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    url.username = '';
    url.password = '';
    for (const key of [...url.searchParams.keys()]) if (SECRET_QUERY.test(key)) url.searchParams.delete(key);
    if (SECRET_QUERY.test(url.hash)) url.hash = '';
    return url.href;
  } catch { return null; }
}

function cloneValue(value, seen = new WeakSet(), depth = 0) {
  if (depth > 40) throw new ArchiveError('Data briefingu jsou příliš vnořená.', 'invalid');
  if (value == null) return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  if (typeof value === 'string') return /^https?:\/\//i.test(value) ? safeUrl(value) : value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'object') throw new ArchiveError('Briefing obsahuje nepodporovaná data.', 'invalid');
  if (seen.has(value)) throw new ArchiveError('Briefing obsahuje kruhový odkaz.', 'invalid');
  seen.add(value);
  let result;
  if (Array.isArray(value)) result = value.map((item) => cloneValue(item, seen, depth + 1));
  else {
    if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new ArchiveError('Briefing obsahuje nepodporovaný objekt.', 'invalid');
    result = Object.fromEntries(Object.entries(value).filter(([key, item]) => !SECRET_KEY.test(key) && item !== undefined)
      .map(([key, item]) => [key, cloneValue(item, seen, depth + 1)]));
  }
  seen.delete(value);
  return result;
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function iso(value, label) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new ArchiveError(`${label}: neplatný čas.`, 'invalid');
  return new Date(value).toISOString();
}

function stateValue(state) {
  if (!state || typeof state !== 'object' || !Number.isFinite(state.lat) || state.lat < -90 || state.lat > 90 ||
      !Number.isFinite(state.lon) || state.lon < -180 || state.lon > 180 || !MODELS.has(state.model) || !ZONES.has(state.timezone)) {
    throw new ArchiveError('Briefing nemá platné místo, model nebo časové pásmo.', 'invalid');
  }
  return { ...cloneValue(state), name: String(state.name || 'Vybrané místo').slice(0, 140), time: iso(state.time, 'Čas přehledu'), hours: [24, 48, 72].includes(state.hours) ? state.hours : 48 };
}

function validateForecast(data, state, expectedModel) {
  if (!data) return;
  if (data.model !== expectedModel || !Array.isArray(data.times) || !data.times.length || data.times.length > 400 || !data.hourly) {
    throw new ArchiveError('Předpověď neodpovídá vybranému modelu nebo nemá časovou osu.', 'context');
  }
  if (data.requestedLocation && (data.requestedLocation.lat !== state.lat || data.requestedLocation.lon !== state.lon)) {
    throw new ArchiveError('Předpověď patří jinému místu. Nejdřív dokonči načítání.', 'context');
  }
  data.times.forEach((time, index) => {
    iso(time, 'Čas předpovědi');
    if (index && Date.parse(time) <= Date.parse(data.times[index - 1])) throw new ArchiveError('Časová osa předpovědi není uspořádaná.', 'invalid');
  });
}

function fingerprint(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function validRaster(value) {
  if (typeof value !== 'string' || value.length > 4_000_000 || !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z\d+/]+={0,2}$/.test(value)) return null;
  try {
    const [prefix, encoded] = value.split(',');
    const head = atob(encoded.slice(0, 40));
    const valid = prefix.startsWith('data:image/png;') ? head.startsWith('\x89PNG\r\n\x1a\n') : prefix.startsWith('data:image/jpeg;') ? head.startsWith('\xff\xd8\xff') : head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP';
    return valid ? value : null;
  } catch { return null; }
}
const radarDisplayOnly=radar=>radar?.displayOnly===true||radar?.imageFetchStatus==='unsupported-cors';

/** Capture metadata only for a CORS-inaccessible chart, with no image request. */
function chartsForCapture(charts,time){
  if(!charts)return null;
  validateCharts(charts,{captured:false});
  const captured=cloneValue(charts);
  for(const item of [captured.swl,captured.sigmetImage].filter(Boolean))if(item.displayOnly===true){
    if(item.imageUrl){item.onlineImageUrl=item.imageUrl;item.onlineOnly=true;}
    item.imageUrl=null;item.imagePath=null;item.imageDataUrl=null;
  }
  if(captured.lowCloud.delivery==='local-file'){
    captured.selectedLow=captured.lowCloud.frames.length?selectedLowCloud(captured,time):captured.selectedLow||null;
    captured.lowCloud={...captured.lowCloud,frames:[]};
  }
  validateCharts(captured,{captured:true});
  return captured;
}

/** A regional field cannot acquire the selected point's model, run or grid identity. */
function validateCapturedCloud(cloud){
  if(!cloud?.regional)return;
  let regional;
  try{regional=validateNativeCeilingRegional(cloud.regional);}catch(error){throw new ArchiveError(`Neplatná regionální mapa CEILING: ${error.message}`,'invalid');}
  const sameTime=(a,b)=>Number.isFinite(Date.parse(a))&&Date.parse(a)===Date.parse(b);
  if(cloud.model!==regional.model||cloud.product!==regional.product||cloud.units!==regional.units||!sameTime(cloud.runTime,regional.runTime)||!sameTime(cloud.validAt,regional.validAt)||!sameTime(cloud.retrievedAt,regional.retrievedAt)||cloud.cell?.gridUuid!==regional.gridUuid){
    throw new ArchiveError('Regionální CEILING neodpovídá modelu, běhu, platnosti nebo nativní síti vybraného bodu.','context');
  }
  const selected=[regional.selectedCell,regional.nodes.find(node=>node.index===cloud.cell.index)].filter(Boolean);
  if(selected.some(node=>node.index!==cloud.cell.index||node.lat!==cloud.cell.lat||node.lon!==cloud.cell.lon||node.valueMsl!==cloud.valueMsl))throw new ArchiveError('Regionální CEILING neodpovídá hodnotě nebo buňce vybraného bodu.','context');
}

function validateProcessedContext(data,state){
  if(!data)return;
  try{validateProcessedCeiling(data);}catch(error){throw new ArchiveError(`Neplatný zpracovaný CEILING: ${error.message}`,'invalid');}
  const requested=Date.parse(data.request.selectedTime),selected=Date.parse(state.time),quarter=time=>Math.ceil(time/900000-.5)*900000;
  if(data.request.lat!==state.lat||data.request.lon!==state.lon||Math.floor(requested/HOUR)!==Math.floor(selected/HOUR)||Math.ceil(requested/HOUR-.5)!==Math.ceil(selected/HOUR-.5)||quarter(requested)!==quarter(selected))throw new ArchiveError('Zpracovaný CEILING patří jinému místu nebo času přehledu.','context');
}

/** Freeze data actually available now. Creation time never replaces source times. */
export function createBriefingSnapshot({ state, forecast = null, comparison = null, aviation = null, astronomy = null, notes = '', clouds = null, processedCeiling = null, satellite = null, route = null, cameras = null, charts = null, sourceErrors = null, radarImageDataUrl = null, createdAt = new Date().toISOString() } = {}) {
  const context = stateValue(state);
  validateForecast(forecast, context, context.model);
  if (comparison) validateForecast(comparison, context, context.compare);
  if (route) validateRouteBundle(route, [context.model, ...(context.compare && context.compare !== context.model ? [context.compare] : [])]);
  validateCapturedCloud(clouds);
  const capturedProcessed=processedCeiling?cloneValue(processedCeiling):null;
  validateProcessedContext(capturedProcessed,context);
  const capturedCameras=cameras?captureCameras(cameras):null;
  const capturedCharts=chartsForCapture(charts,context.time);
  if (charts?.selectedLow && Math.abs(Date.parse(charts.selectedLow.validAt)-Date.parse(context.time))>90*60000) throw new ArchiveError('Mapa nízké oblačnosti patří jinému času přehledu.','context');
  const body = cloneValue({ schemaVersion: 1, createdAt: iso(createdAt, 'Uložení briefingu'), state: context, forecast, comparison, aviation, astronomy, clouds, processedCeiling:capturedProcessed, satellite, route, cameras:capturedCameras, charts:capturedCharts, sourceErrors, notes: String(notes), radarImageDataUrl: radarDisplayOnly(aviation?.radar)?null:validRaster(radarImageDataUrl) });
  if(radarDisplayOnly(body.aviation?.radar))body.aviation.radar.imageDataUrl=null;
  // Keep a captured image once, alongside the metadata that identifies it.
  if (body.radarImageDataUrl && body.aviation?.radar?.imageDataUrl === body.radarImageDataUrl) delete body.aviation.radar.imageDataUrl;
  const id = `briefing-${body.createdAt.replace(/[^\d]/g, '')}-${fingerprint(JSON.stringify(body))}`;
  const title = `${context.name} · ${forecast?.label || context.model.toUpperCase()} · ${formatTime(context.time, context.timezone, true)} ${context.timezone === 'UTC' ? 'UTC' : 'CZ'}`;
  return deepFreeze({ id, title, ...body });
}

function validateSnapshot(snapshot) {
  if (!snapshot || snapshot.schemaVersion !== 1 || typeof snapshot.id !== 'string' || !/^briefing-[\d]+-[a-f\d]{8}$/.test(snapshot.id)) {
    throw new ArchiveError('Tento záznam není podporovaný uložený briefing.', 'invalid');
  }
  iso(snapshot.createdAt, 'Uložení briefingu');
  stateValue(snapshot.state);
  validateForecast(snapshot.forecast, snapshot.state, snapshot.state.model);
  if (snapshot.comparison) validateForecast(snapshot.comparison, snapshot.state, snapshot.state.compare);
  if (snapshot.route) validateRouteBundle(snapshot.route, [snapshot.state.model, ...(snapshot.state.compare && snapshot.state.compare !== snapshot.state.model ? [snapshot.state.compare] : [])]);
  if (snapshot.cameras) validateCameras(snapshot.cameras,{captured:true});
  if (snapshot.charts) validateCharts(snapshot.charts, { captured: true });
  validateCapturedCloud(snapshot.clouds);
  validateProcessedContext(snapshot.processedCeiling,snapshot.state);
  if (snapshot.charts?.selectedLow && Math.abs(Date.parse(snapshot.charts.selectedLow.validAt)-Date.parse(snapshot.state.time))>90*60000) throw new ArchiveError('Mapa nízké oblačnosti patří jinému času přehledu.','context');
  return snapshot;
}

export function briefingFilename(snapshot, {mode='full'}={}) {
  if (!['full','reports'].includes(mode)) throw new ArchiveError('Neznámý druh výstupu.','invalid');
  validateSnapshot(snapshot);
  const place = snapshot.state.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z\d]+/g, '-').replace(/^-|-$/g, '').slice(0, 55) || 'misto';
  return `heli-briefing-${place}-${snapshot.createdAt.slice(0, 16).replace(/[-:T]/g, '')}Z${mode==='reports'?'-metar-taf':''}.html`;
}

function storageOrThrow(storage) {
  if (storage) return storage;
  try { if (globalThis.localStorage) return globalThis.localStorage; } catch { /* Browser can deny storage. */ }
  throw new ArchiveError('Místní archiv není dostupný. Briefing můžeš stáhnout jako HTML.', 'storage');
}

function readArchive(storage) {
  let raw;
  try { raw = storage.getItem(ARCHIVE_KEY); } catch { throw new ArchiveError('Místní archiv nelze přečíst.', 'storage'); }
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    if (!value || value.schemaVersion !== 1 || !Array.isArray(value.items) || value.items.length > ARCHIVE_MAX_ITEMS) throw new Error('shape');
    value.items.forEach(validateSnapshot);
    return value.items;
  } catch { throw new ArchiveError('Uložený archiv je poškozený nebo z jiné verze. Nebyl přepsán.', 'corrupt'); }
}

function metadata(items) {
  return items.map((item) => ({ id: item.id, title: item.title, createdAt: item.createdAt, state: cloneValue(item.state), model: item.forecast?.label || item.state.model }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function storageBytes(serialized) {
  // Browsers can count localStorage as UTF-16 while UTF-8 exports use different
  // sizes. Use the larger estimate and still surface any actual quota failure.
  return Math.max(serialized.length * 2, new TextEncoder().encode(serialized).length);
}

/** Atomic browser database archive; legacy localStorage is copied once, never erased. */
async function databaseArchive(transform) {
  const db = await new Promise((resolve,reject) => {
    const request = indexedDB.open('heli-briefing-archive',1);
    request.onupgradeneeded = () => request.result.createObjectStore('archive');
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
    request.onerror = () => reject(new ArchiveError('Databázový archiv nelze otevřít. HTML můžeš stáhnout z náhledu.','storage'));
    request.onblocked = () => reject(new ArchiveError('Aktualizaci archivu blokuje jiná karta. Zavři starší karty briefingu.','storage'));
  });
  return new Promise((resolve,reject) => {
    const transaction = db.transaction('archive','readwrite'), store = transaction.objectStore('archive');
    const request = store.get('briefings'); let output, failure;
    request.onsuccess = () => {
      try {
        const envelope = request.result;
        let items;
        if (envelope === undefined) {
          try { items = readArchive(storageOrThrow()); } catch (error) { if (error.code === 'corrupt') throw error; items = []; }
        } else {
          if (envelope.schemaVersion !== 1 || !Array.isArray(envelope.items) || envelope.items.length > ARCHIVE_MAX_ITEMS) throw new ArchiveError('Databázový archiv je poškozený; nebyl přepsán.','corrupt');
          items = envelope.items; items.forEach(validateSnapshot);
        }
        const result = transform(items); output = result.result;
        if (envelope === undefined || result.items) store.put({schemaVersion:1,items:result.items || items},'briefings');
      } catch (error) { failure = error; transaction.abort(); }
    };
    transaction.oncomplete = () => { db.close(); resolve(output); };
    transaction.onabort = transaction.onerror = () => { db.close(); reject(failure || new ArchiveError('Archiv nebyl změněn: prohlížeč zápis odmítl nebo nemá místo. HTML stáhni z náhledu.','storage-write')); };
  });
}

export function fitDatabaseArchive(snapshot, previous) {
  const items = [cloneValue(snapshot), ...previous.filter(item=>item.id!==snapshot.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))].slice(0,ARCHIVE_MAX_ITEMS);
  while(new TextEncoder().encode(JSON.stringify(items)).length>ARCHIVE_DB_MAX_BYTES && items.length>1) items.pop();
  if(new TextEncoder().encode(JSON.stringify(items)).length>ARCHIVE_DB_MAX_BYTES) throw new ArchiveError('Briefing přesahuje 20 MB archivu. Stáhni jej jako HTML.','too-large');
  return items;
}

export function listBriefings(storage) { return !storage && globalThis.indexedDB ? databaseArchive(items=>({result:metadata(items)})) : metadata(readArchive(storageOrThrow(storage))); }

export function loadBriefing(id, storage) {
  if (!storage && globalThis.indexedDB) return databaseArchive(items=>({result:items.find(item=>item.id===id) ? deepFreeze(cloneValue(items.find(item=>item.id===id))) : null}));
  const found = readArchive(storageOrThrow(storage)).find((item) => item.id === id);
  return found ? deepFreeze(cloneValue(found)) : null;
}

/** Keep at most ten snapshots and five megabytes. A failed write preserves storage. */
export function saveBriefing(snapshot, storage) {
  validateSnapshot(snapshot);
  if (!storage && globalThis.indexedDB) return databaseArchive(previous=>{const items=fitDatabaseArchive(snapshot,previous);return {items,result:metadata(items)};});
  const target = storageOrThrow(storage);
  const old = readArchive(target).filter((item) => item.id !== snapshot.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const items = [cloneValue(snapshot), ...old].slice(0, ARCHIVE_MAX_ITEMS);
  let serialized = JSON.stringify({ schemaVersion: 1, items });
  while (storageBytes(serialized) > ARCHIVE_MAX_BYTES && items.length > 1) {
    items.pop();
    serialized = JSON.stringify({ schemaVersion: 1, items });
  }
  if (storageBytes(serialized) > ARCHIVE_MAX_BYTES) throw new ArchiveError('Briefing je pro místní archiv příliš velký. Stáhni ho jako HTML.', 'too-large');
  try { target.setItem(ARCHIVE_KEY, serialized); }
  catch { throw new ArchiveError('V prohlížeči není místo nebo je ukládání blokované. Briefing stáhni jako HTML.', 'storage-write'); }
  return metadata(items);
}

export function deleteBriefing(id, storage) {
  if (!storage && globalThis.indexedDB) {
    // A migrated legacy copy must not survive an explicit browser-archive deletion.
    // Remove it first: a failed database transaction still retains the primary copy.
    deleteBriefing(id, storageOrThrow());
    return databaseArchive(previous=>{const items=previous.filter(item=>item.id!==id);return {items,result:metadata(items)};});
  }
  const target = storageOrThrow(storage);
  const items = readArchive(target).filter((item) => item.id !== id);
  try { target.setItem(ARCHIVE_KEY, JSON.stringify({ schemaVersion: 1, items })); }
  catch { throw new ArchiveError('Záznam se nepodařilo odstranit z místního archivu.', 'storage-write'); }
  return metadata(items);
}

const number = (value, unit = '', digits = 1) => `${formatNumber(value, digits)}${value == null ? '' : ` ${unit}`}`;
const sourceLink = (url, text = 'Otevřít zdroj') => { const safe = safeUrl(url); return safe ? `<a href="${esc(safe)}" target="_blank" rel="noopener noreferrer">${esc(text)} ↗</a>` : '<span>Odkaz na zdroj nedostupný</span>'; };
function stamp(value, zone) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'neuvedeno';
  const year = new Intl.DateTimeFormat('cs-CZ', { timeZone: zone, year: 'numeric' }).format(new Date(value));
  return `${formatTime(value, zone, true).replace(' ', `${year} `)} ${zone === 'UTC' ? 'UTC' : 'CZ'}`;
}
function datasetTimes(snapshot) {
  const times = snapshot.forecast?.times || [];
  if (!times.length) return [];
  const reference = Date.parse(snapshot.createdAt);
  const selected = Date.parse(snapshot.state.time);
  let start = Math.max(Date.parse(times[0]), Math.floor(reference / HOUR) * HOUR);
  if (selected < start || selected > start + (snapshot.state.hours - 1) * HOUR) start = Math.max(Date.parse(times[0]), selected - Math.floor(snapshot.state.hours / 3) * HOUR);
  return times.filter((time) => Date.parse(time) >= start && Date.parse(time) < start + snapshot.state.hours * HOUR);
}
function valueAt(data, key, time) {
  if (!data) return null;
  const index = nearestTimeIndex(data.times, time);
  return index >= 0 ? data.hourly[key]?.[index] ?? null : null;
}

function forecastProvenance(data, zone) {
  if (!data) return '<p class="attention">Předpověď v okamžiku uložení nebyla dostupná.</p>';
  const status = data.transport?.stale ? `<p class="attention">Uložena starší předpověď po neúspěšné obnově. ${esc(data.transport.error?.message || '')}</p>` : '';
  return `${status}<dl class="metadata"><dt>Model / poskytovatel</dt><dd>${esc(data.label || data.model)} · ${esc(data.provider)} · ${esc(data.apiModel || '')}</dd><dt>Staženo</dt><dd>${esc(stamp(data.retrievedAt, zone))}</dd><dt>Běh modelu</dt><dd>${esc(data.runTime ? stamp(data.runTime, zone) : 'API jej neuvádí; čas stažení jej nenahrazuje')}</dd><dt>Dostupná platnost</dt><dd>${esc(stamp(data.validFrom, zone))} – ${esc(stamp(data.validTo, zone))}</dd><dt>Výstupní bod / výška API</dt><dd>${esc(number(data.grid?.lat, '°', 5))}, ${esc(number(data.grid?.lon, '°', 5))} · ${esc(number(data.grid?.elevation, 'm', 0))}</dd></dl><p>${sourceLink(data.docsUrl, 'Dokumentace dat')} · ${sourceLink(data.sourceUrl, 'Přesný dotaz na zdroj')}</p>`;
}

function forecastCharts(snapshot) {
  const times = datasetTimes(snapshot);
  const data = snapshot.forecast;
  const compare = snapshot.comparison;
  if (!data) return '';
  return `<div class="charts">${CHARTS.map(([title, unit, fields, min, max, divisor = 1]) => {
    const series = fields.map(([key, label, color]) => ({ key, label, color, unit, values: times.map((time) => { const v = valueAt(data, key, time); return v == null ? null : v / divisor; }) }));
    if (compare) for (const [key, label] of fields) series.push({ key: `compare-${key}`, label: `${compare.label} · ${label}`, color: '#985b82', unit, dash: true, values: times.map((time) => { const v = valueAt(compare, key, time); return v == null ? null : v / divisor; }) });
    return `<article class="chart"><h3>${esc(title)}</h3>${renderChart({ times, series, selectedTime: snapshot.state.time, timezone: snapshot.state.timezone, min, max, height: 250, yLabel: unit })}<p class="legend">${series.map((item) => `${esc(item.label)}${item.dash ? ' (přerušovaně)' : ''}`).join(' · ')}</p></article>`;
  }).join('')}</div>`;
}

function exactForecastTable(data, times, zone) {
  if (!data) return '';
  const rows = times.map((time) => `<tr><th scope="row">${esc(stamp(time, zone))}</th>${FIELDS.map(([key]) => `<td>${esc(number(valueAt(data, key, time), '', ['direction', 'humidity', 'visibility', 'height925', 'cloudLow', 'cloudMid', 'cloudHigh'].includes(key) ? 0 : 1))}</td>`).join('')}</tr>`).join('');
  return `<h3>Přesné hodnoty · ${esc(data.label || data.model)}</h3><p class="small">Jednotky jsou v záhlaví. Nárazy a srážky platí pro předchozí hodinu končící uvedeným časem. Pomlčka znamená nedostupnou hodnotu.</p><div class="table-scroll"><table class="exact"><thead><tr><th>Platnost</th>${FIELDS.map(([, label, unit]) => `<th>${esc(label)}<br>${esc(unit)}</th>`).join('')}</tr></thead><tbody>${rows || '<tr><td colspan="15">Pro vybrané období nejsou data.</td></tr>'}</tbody></table></div>`;
}

function aviationSection(snapshot, key, title) {
  const section = snapshot.aviation?.[key];
  const zone = snapshot.state.timezone;
  if (!section) return `<section><h2>${title}</h2><p class="attention">Zdroj nebyl při uložení k dispozici.</p></section>`;
  const retrieved=Date.parse(section.retrievedAt),created=Date.parse(snapshot.createdAt);
  const warning = ['stale', 'unavailable'].includes(section.status) || !Number.isFinite(retrieved) || retrieved>created+300000 || created-retrieved>HOUR;
  const coverage=reportCoverageNotes(snapshot,key);
  const items = Array.isArray(section.items) ? section.items : [];
  const rendered = items.map((item) => {
    const state = reportState(item, key === 'metar' ? Date.parse(snapshot.createdAt) : Date.parse(snapshot.state.time));
    let decoded = '';
    if (key === 'metar') {
      const summary = summarizeMetar(item);
      decoded = `<p>${esc(formatReportSummary(summary))}</p>${summary.warnings?.length ? `<p class="small">${esc(summary.warnings.join(' '))}</p>` : ''}`;
    }
    if (key === 'taf') {
      const taf = summarizeTaf(item, { selectedTime: snapshot.state.time });
      decoded = (taf.periods?.length ? `<table><thead><tr><th>Skupina</th><th>Platnost</th><th>Výslovně uvedené podmínky</th></tr></thead><tbody>${taf.periods.map((period) => `<tr${period.selected ? ' class="selected"' : ''}><td>${esc(period.label || period.type)}</td><td>${esc(stamp(period.start, zone))} – ${esc(stamp(period.end, zone))}</td><td>${esc(formatReportSummary(period))}${period.unknownTokens?.length ? ` · nerozpoznáno: ${esc(period.unknownTokens.join(' '))}` : ''}</td></tr>`).join('')}</tbody></table><p class="small">Změnové skupiny popisují jen výslovně uvedené údaje. TEMPO / PROB nejsou stálou předpovědí celého intervalu.</p>` : '') + (taf.warnings?.length ? `<p class="small">${esc(taf.warnings.join(' '))}</p>` : '');
    }
    const transport=reportTransportNote(item);
    return `<article class="report"><h3>${esc(item.station || item.fir || item.id)} · ${esc(state.label)}</h3><p class="small">${esc(reportProviderName(snapshot,key,item))} · pozorováno: ${esc(stamp(item.observedAt, zone))} · vydáno: ${esc(stamp(item.issuedAt, zone))}${item.validFrom || item.validTo ? ` · platnost ${esc(stamp(item.validFrom, zone))} – ${esc(stamp(item.validTo, zone))}` : ''}${item.retrievedAt?` · tato zpráva stažena ${esc(stamp(item.retrievedAt,zone))}`:''}</p>${transport?`<p class="attention">${esc(transport)}</p>`:''}${decoded}<pre>${esc(item.raw || 'Originální text nedostupný.')}</pre></article>`;
  }).join('');
  const empty = section.status === 'empty' ? 'Zdroj v uloženém balíčku nevrátil žádnou zprávu. To nepotvrzuje nepřítomnost nebezpečného počasí.' : 'V tomto balíčku nejsou žádné zprávy.';
  return `<section><h2>${title}</h2><p class="small">${esc(reportProviderName(snapshot,key))} · staženo: ${esc(stamp(section.retrievedAt, zone))} · stav při uložení: ${esc(section.status)} · ${sourceLink(section.sourceUrl)}${section.supplementSourceUrl?` · ${sourceLink(section.supplementSourceUrl,'MET Norway · původní data')}`:''}</p>${warning ? `<p class="attention">Aktuálnost zdroje nebyla při uložení potvrzena. ${esc(section.error || '')}</p>` : ''}${coverage.map(note=>`<p class="attention">${esc(note)}</p>`).join('')}${rendered || `<p>${empty}</p>`}${section.missingStations?.length ? `<p class="small">V balíčku chybí stanice: ${esc(section.missingStations.join(', '))}. Nevytváříme náhradní zprávy.</p>` : ''}</section>`;
}

function astronomySection(snapshot) {
  const a = snapshot.astronomy;
  if (!a) return '<section><h2>Světlo a astronomie</h2><p>Výpočet nebyl uložen.</p></section>';
  const zone = snapshot.state.timezone;
  const events = [['Civilní svítání', a.dawn], ['Východ Slunce', a.sunrise], ['Západ Slunce', a.sunset], ['Civilní soumrak', a.dusk], ['Východ Měsíce', a.moonrise], ['Západ Měsíce', a.moonset]];
  return `<section><h2>Světlo a astronomie</h2><div class="events">${events.map(([name, time]) => `<div><span>${name}</span><strong>${time ? esc(stamp(time, zone)) : 'bez události'}</strong></div>`).join('')}</div><p>Délka dne ${esc(number(a.dayLengthHours, 'h'))} · Slunce ${esc(number(a.sunAltitude, '°'))} · Měsíc ${esc(number(a.moonAltitude, '°'))} · ${esc(a.phaseLabel)} · osvětleno ${esc(number(a.moonFraction == null ? null : a.moonFraction * 100, '%'))} kotouče.</p><p class="small">${esc(a.source || 'Místní výpočet')} · denní události pro den UTC ${esc(String(a.dayStart || '').slice(0, 10))}; polohy pro ${esc(stamp(a.selectedInstant || snapshot.state.time, zone))}. Osvětlený podíl kotouče není měření světla na zemi.</p>${renderAstronomyChart(a,snapshot.state.time,zone,900)}</section>`;
}

function imagerySection(snapshot) {
  const radar = snapshot.aviation?.radar;
  const raster = radarDisplayOnly(radar)?null:validRaster(snapshot.radarImageDataUrl);
  const imageTime = radar?.imageObservedAt || radar?.observedAt;
  return `<section><h2>Regionální obrazové zdroje</h2>${radar ? `<p>ČHMÚ radar · poslední pozorování ${esc(stamp(radar.observedAt, snapshot.state.timezone))} · stav ${esc(radar.status)} · ${sourceLink(radar.url||radar.sourceUrl, 'Původní snímek')}.</p>` : '<p>Radarový zdroj nebyl při uložení k dispozici.</p>'}${raster ? `<p><strong>Vložený snímek: ${esc(stamp(imageTime, snapshot.state.timezone))}</strong> · ${sourceLink(radar?.imageUrl || radar?.url, 'Zdroj vloženého snímku')}</p><img class="radar-image" src="${raster}" alt="Radarový snímek zachycený při uložení briefingu">` : radarDisplayOnly(radar)?`<p class="attention">${radar.url&&Number.isFinite(Date.parse(radar.observedAt))?'Radar byl v prohlížeči dostupný pouze pro zobrazení online.':'Radarový obraz nebyl při uložení potvrzeně načten.'} Zdroj nepovoluje čtení obrazových dat přes CORS; v tomto offline souboru není snímek vložen. Zachovány jsou dostupné časy a zdrojové odkazy.</p>`:'<p class="small">Mapové dlaždice ani radarový obraz nejsou v tomto souboru vložené. Uloženy jsou časy a odkazy; soubor je při otevření nenačítá.</p>'}<p class="small">Radar je pozorování, nezávislé na modelu a hodině předpovědi. Případná animace ani mapové dlaždice se do uloženého souboru živě nenačítají.</p></section>`;
}

function nativeCloudSection(snapshot) {
  const cloud = snapshot.clouds;
  if (!cloud) return '<section><h2>Nezávislý nativní cloudový produkt</h2><p class="attention">Nativní produkt CEILING nebyl při uložení k dispozici.</p></section>';
  if (!['ICON-D2','ICON-EU'].includes(cloud.model) || cloud.product !== 'CEILING' || cloud.units !== 'm MSL') {
    return '<section><h2>Cloudový produkt</h2><p class="attention">Uložený produkt nemá ověřitelný model, parametr a výškovou referenci; hodnoty nejsou interpretovány.</p></section>';
  }
  const zone = snapshot.state.timezone, label=`DWD ${cloud.model} CEILING`;
  const times = Array.isArray(cloud.series?.times) ? cloud.series.times : [];
  const values = Array.isArray(cloud.series?.values) ? cloud.series.values : [];
  const status = CLOUD_STATUS_LABELS[cloud.status] || (cloud.status==='stale'?'Starší nativní výstup; obnova nebyla potvrzena.':'Stav nativního produktu není znám.');
  const graph = renderChart({ times, series: [{ key: 'native-ceiling', label, color: '#866aa3', values, unit: 'm MSL' }], selectedTime: snapshot.state.time, timezone: zone, height: 250, yLabel: 'm MSL' });
  const definition=cloud.definition||'Výška, kde velkoprostorové/podmřížkové pokrytí oblačností při pohledu vzhůru poprvé přesahuje 50 %; bez konvektivní složky.';
  const map=cloud.regional?`<h3>Regionální nativní pole · ${esc(cloud.regional.model)}</h3>${renderNativeCeilingMap(cloud.regional,{lat:snapshot.state.lat,lon:snapshot.state.lon,timezone:zone,width:760,selectedCell:cloud.cell?{...cloud.cell,valueMsl:cloud.valueMsl}:undefined})}<p class="small">Tato mapa zobrazuje nativní CEILING ${esc(cloud.model)} v metrech MSL. Jde o samostatný modelový produkt; není to mapa nízké oblačnosti ČHMÚ. Barevné buňky nejsou měřený ceiling ani výška nad místním terénem.</p>`:'';
  return `<section><h2>Nezávislý cloudový produkt · ${esc(label)}</h2><p><strong>${esc(number(cloud.valueMsl, 'm MSL', 0))}</strong> · ${esc(status)}</p>${cloud.stale || cloud.error ? `<p class="attention">${cloud.stale ? 'Uložen starší nativní výstup; obnova nebyla potvrzena. ' : ''}${esc(cloud.error || '')}</p>` : ''}<p class="small">Tento produkt má vlastní model a běh. Není součástí zvolené povrchové předpovědi ${esc(snapshot.forecast?.label || snapshot.state.model)} a přepnutí této předpovědi jej nepřejmenovává.</p><dl class="metadata"><dt>Definice</dt><dd>${esc(definition)}</dd><dt>Výšková reference</dt><dd>Metry nad hladinou moře (MSL), nikoli AGL a nikoli pozorovaný ceiling METAR.</dd><dt>Platnost vzorku</dt><dd>${esc(stamp(cloud.validAt, zone))}</dd><dt>Běh / staženo</dt><dd>${esc(stamp(cloud.runTime, zone))} / ${esc(stamp(cloud.retrievedAt, zone))}</dd><dt>Nejbližší nativní buňka</dt><dd>${cloud.cell ? `${esc(number(cloud.cell.lat, '° N', 5))}, ${esc(number(cloud.cell.lon, '° E', 5))} · vzdálenost ${esc(number(cloud.distanceKm, 'km'))} · terén modelu ${esc(number(cloud.cell.elevationMsl, 'm MSL', 0))}` : 'nedostupná'}</dd>${cloud.cell?.index!=null?`<dt>Index buňky / UUID sítě</dt><dd>${esc(String(cloud.cell.index))} / ${esc(cloud.cell.gridUuid||'neuvedeno')}</dd>`:''}</dl><p class="small">${esc(cloud.attribution||'DWD')} · ${sourceLink(cloud.sourceUrl, 'Nativní zdroj DWD')}${cloud.documentationUrl?` · ${sourceLink(cloud.documentationUrl,'Definice produktu DWD')}`:''}</p><div class="chart">${graph}</div>${map}<p class="small">Chybějící nebo nedefinovaný CEILING není potvrzení jasné oblohy. Výšky nejsou převáděny na AGL.</p><details class="exact-appendix"><summary>Hodinové hodnoty ${esc(cloud.model)} CEILING · příloha</summary><table><thead><tr><th>Platnost</th><th>${esc(cloud.model)} CEILING · m MSL</th></tr></thead><tbody>${times.map((time, index) => `<tr><td>${esc(stamp(time, zone))}</td><td>${esc(number(values[index] ?? null, '', 0))}</td></tr>`).join('') || '<tr><td colspan="2">Nativní hodinová řada není dostupná.</td></tr>'}</tbody></table></details></section>`;
}

function observationHistorySection(snapshot) {
  const metar = snapshot.aviation?.metar;
  const stations = [...new Set((metar?.history || []).map((item) => item.station).filter(Boolean))].sort();
  const zone = snapshot.state.timezone;
  const status = metar?.historyStatus || 'unavailable';
  const history=observationHistoryInfo(snapshot),browserObserved=history?.kind==='browser';
  const stale = status === 'stale' || status === 'unavailable' || !metar?.historyRetrievedAt || Date.parse(snapshot.createdAt) - Date.parse(metar.historyRetrievedAt) > HOUR;
  const tables = stations.map((station) => {
    const series = observationSeries(snapshot.aviation, station, Date.parse(snapshot.createdAt));
    if (!series.items.length) return '';
    return `<article class="report"><h3>${esc(station)} · ${series.items.length} skutečných pozorování</h3><table><thead><tr><th>Čas pozorování</th><th>Dohlednost</th><th>Ceiling · ft AGL</th><th>Vítr · kt</th></tr></thead><tbody>${series.items.map((item, index) => {
      const summary = summarizeMetar(item);
      return `<tr><td>${esc(stamp(item.observedAt, zone))}${reportTransportNote(item)?`<br><span class="attention">${esc(reportTransportNote(item))}</span>`:''}</td><td>${esc(summary.visibility?.text || '—')}</td><td>${esc(number(series.ceiling[index], '', 0))}${series.ceiling[index] == null ? ` · ${esc(summary.ceiling?.status === 'cavok' ? 'CAVOK' : summary.ceiling?.status === 'unknown' ? 'výška neznámá' : 'nenahlášen')}` : ''}</td><td>${esc(number(series.wind[index], '', 0))}</td></tr>`;
    }).join('')}</tbody></table></article>`;
  }).join('');
  const station=stations.includes(snapshot.state.historyStation)?snapshot.state.historyStation:stations[0];
  const series=station?observationSeries(snapshot.aviation,station,Date.parse(snapshot.createdAt)):null;
  const graphs=series?.times.length?`<h3>${esc(station)} · skutečná pozorování stanice</h3><div class="charts">${[
    ['Pozorovaná dohlednost','km',series.visibility.map(value=>value===null?null:value/1000),'#287b8c'],
    ['Pozorovaný ceiling / VV','ft AGL',series.ceiling,'#866aa3']
  ].map(([title,unit,values,color])=>`<article class="chart"><h3>${title}</h3>${renderChart({times:series.times,series:[{label:station,values,color,unit,pointsOnly:true}],selectedTime:null,timezone:zone,height:250,min:0,yLabel:unit})}</article>`).join('')}</div>`:'';
  return `<section><h2>${esc(history?.title||`Historie pozorování METAR · ${Number.isFinite(metar?.historyHours) ? metar.historyHours : 12} h`)}</h2><p class="small">${browserObserved?'Poslední načtení zdroje':'Historie stažena'} ${esc(stamp(metar?.historyRetrievedAt, zone))} · stav ${esc(status)} · ${esc(reportProviderName(snapshot,'metar'))}. Každý řádek je skutečná zpráva dané stanice, nikoli měření v bodě vybraném na mapě.</p>${history?`<p class="${history.partial?'attention':'small'}">${esc(history.text)}</p>`:''}${stale ? `<p class="attention">Aktuálnost historického balíčku nebyla při uložení potvrzena. ${esc(metar?.historyError || '')}</p>` : metar?.historyError?`<p class="small">${esc(metar.historyError)}</p>`:''}${metar?.historyLimitReached ? '<p class="attention">Zdroj dosáhl limitu odpovědi; historie nemusí pokrývat celé požadované období.</p>' : ''}${graphs}<details class="exact-appendix"><summary>Jednotlivá pozorování všech stanic · příloha</summary>${tables || '<p>Historická pozorování nejsou v uloženém balíčku dostupná. Žádné hodnoty nebyly vytvořeny.</p>'}</details><p class="small">Dohlednost může být dolní nebo horní mez, nikoli přesná hodnota (např. ≥ 10 km). Pomlčka u ceilingu nerozlišuje jasnou oblohu od chybějící výšky bez původní zprávy. Mezi pozorováními nejsou dopočítána data. Původní historické zprávy jsou zachovány v podkladových datech tohoto souboru.</p></section>`;
}

function savedSourceErrors(snapshot) {
  if (!snapshot.sourceErrors || typeof snapshot.sourceErrors !== 'object') return '';
  const errors = Object.entries(snapshot.sourceErrors).filter(([, error]) => error);
  return errors.length ? `<section><h2>Neúspěšné obnovy při uložení</h2>${errors.map(([source, error]) => `<p class="attention">${esc(source)}: ${esc(typeof error === 'object' ? error.message || 'Zdroj nebyl dostupný.' : error)}</p>`).join('')}</section>` : '';
}

function rawDataAppendix(snapshot) {
  const historyCount = Array.isArray(snapshot.aviation?.metar?.history) ? snapshot.aviation.metar.history.length : 0;
  const data = { ...snapshot, cameras: snapshot.cameras ? {...snapshot.cameras,items:snapshot.cameras.items.map(item=>({...item,imageDataUrl:item.imageDataUrl ? '[Fotografie vložena samostatně v dokumentu]' : null}))} : null, charts: snapshot.charts ? {...snapshot.charts,swl:{...snapshot.charts.swl,imageDataUrl:snapshot.charts.swl.imageDataUrl ? '[Mapa vložena samostatně v dokumentu]' : null},selectedLow:snapshot.charts.selectedLow ? {...snapshot.charts.selectedLow,imageDataUrl:snapshot.charts.selectedLow.imageDataUrl ? '[Mapa vložena samostatně v dokumentu]' : null} : null} : null, satellite: snapshot.satellite ? {...snapshot.satellite,imageDataUrl:satelliteState(snapshot.satellite,Date.parse(snapshot.createdAt)).image?'[Obraz vložen samostatně v dokumentu]':null} : null, radarImageDataUrl: snapshot.radarImageDataUrl&&!radarDisplayOnly(snapshot.aviation?.radar) ? '[Rasterový obraz je vložen samostatně v tomto dokumentu.]' : null };
  return `<section class="data-appendix"><h2>Podkladová data briefingu</h2><p class="small">Úplný uložený kontext, původní datové položky a časy včetně ${historyCount} historických pozorování METAR. Tyto podklady zůstávají součástí souboru i bez připojení.</p><details><summary>Zobrazit úplná uložená data</summary><pre id="briefing-data">${esc(JSON.stringify(data, null, 2))}</pre></details></section>`;
}

const CSS = `.handoff-review ul{list-style:none;padding:0}.handoff-review li{padding:7px 10px;margin:5px 0;font-size:13px}.point-summary li{margin:7px 0}.exact-appendix{background:white;padding:18px 22px;border:1px solid #dce4ea}.exact-appendix summary{cursor:pointer;font-weight:bold}.bulletin-station{border-top:1px solid #dce4ea;padding:12px 0;break-inside:avoid}.bulletin-station pre{font-size:13px;margin:6px 0}.reports-only main{max-width:1000px}.reports-only .report-pack h2{margin-top:20px}@media print{.exact-appendix,.data-appendix{display:none!important}.handoff-review li{font-size:9px;padding:3px 6px}.bulletin-station{padding:7px 0}.bulletin-station pre{font-size:12px;background:white;padding:0;line-height:1.45}.reports-only .frozen{font-size:9px}.reports-only section{padding:8px 0}.reports-only h3{font-size:12px}} :root{--line:#cad4dc;--amber:#995900;--chart-cyan:#12657a;--chart-amber:#995900;--chart-blue:#345ca5;--text:#172c3c;--muted:#556b7b;--surface-alt:#f6f8fa}.profile-svg{width:100%;max-width:700px;height:auto;font:14px Arial}.profile-table small{display:block}.profile-note,.profile-empty{font-size:13px}.satellite-figure{margin:12px 0}.satellite-image{position:relative}.satellite-image img{display:block;width:100%}.satellite-city,.satellite-point{position:absolute;color:white;background:#152c3de6;padding:1px 4px;font-size:11px}.satellite-point{width:12px;height:12px;padding:0;border:2px solid white;border-radius:50%;background:#e9a63d}.satellite-point span{display:none}.satellite-credit,.satellite-explanation,figcaption{font-size:12px} :root{color-scheme:light;font-family:Arial,Helvetica,sans-serif;color:#172c3c;background:#f2f5f7}*{box-sizing:border-box}body{margin:0;font-size:14px;line-height:1.5}main{max-width:1300px;margin:auto;padding:30px}header{padding:22px 26px;background:#132b3a;color:#f5f8fb;border-bottom:4px solid #88b9c6}h1{margin:2px 0 12px;font-size:29px}h2{font-size:19px;border-bottom:1px solid #dce4ea;padding-bottom:8px}h3{font-size:14px;margin:8px 0}p{margin:7px 0}.kicker{font-size:11px;letter-spacing:.13em;text-transform:uppercase}.frozen{padding:10px 14px;border:1px solid #88b9c6;background:#fff4df;margin:16px 0}section{background:#fff;border:1px solid #dce4ea;border-radius:5px;padding:18px 22px;margin:16px 0}.metadata{display:grid;grid-template-columns:minmax(150px,1fr) 4fr;gap:3px 14px;font-size:12px}.metadata dt{font-weight:bold}.metadata dd{margin:0;overflow-wrap:anywhere}.charts{display:grid;grid-template-columns:1fr;gap:14px}.chart{border:1px solid #d6ded8;padding:10px 13px;break-inside:avoid;min-width:0}.chart svg{width:100%;max-width:1000px;margin:auto;height:auto;color:#526764}.chart svg text{font:16px monospace}.legend,.small{font-size:13px;color:#556b7b}.attention{padding:9px 12px;background:#fff0d5;border-left:3px solid #a56720}.notes{white-space:pre-wrap;overflow-wrap:anywhere}.report{border-top:1px solid #ccd7cf;padding:12px 0;break-inside:avoid}.report:first-of-type{border-top:0}pre{white-space:pre-wrap;overflow-wrap:anywhere;padding:10px;background:#f1f4ef;font:14px/1.55 monospace}table{border-collapse:collapse;width:100%;margin:8px 0;font-size:11px}th,td{border:1px solid #cbd5cd;padding:5px 6px;text-align:left;vertical-align:top}th{background:#f6f8fa}.selected{background:#fff5df}.table-scroll{overflow:auto}.exact{font-size:9px;min-width:1100px}.exact td{text-align:right;font-variant-numeric:tabular-nums}.exact th{font-size:9px}.events{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.events span,.events strong{display:block}.events span{font-size:11px;color:#556b7b}.radar-image{display:block;max-width:100%;max-height:500px;margin:auto}a{color:#0d6577}footer{padding:10px 5px;font-size:11px;color:#556b7b}.data-appendix pre{max-height:600px;overflow:auto}.break-before{break-before:page}@media(max-width:650px){main{padding:12px}header,section{padding:15px}.charts{grid-template-columns:1fr}.metadata{display:block}.metadata dd{margin-bottom:7px}.events{grid-template-columns:1fr 1fr}h1{font-size:24px}}@media print{@page{size:A4 portrait;margin:12mm}html,body{background:white;font-size:12px}main{padding:0;max-width:none}header{background:white;color:#172c3c;padding:0 0 8px}h1{font-size:22px}h2{font-size:15px}section{border:0;padding:8px 0;margin:8px 0}.charts{gap:8px}.chart{padding:5px}.chart svg text{font-size:16px}.metadata{font-size:10px}.small,.legend{font-size:10px}.report{break-inside:avoid}pre{font-size:12px}table{font-size:10px}.exact{min-width:0;font-size:6.5px;table-layout:fixed}.exact th,.exact td{padding:3px 2px;overflow-wrap:anywhere}.exact th{font-size:6px}.events{grid-template-columns:repeat(3,1fr)}.table-scroll{overflow:visible}a{color:inherit}.frozen{padding:6px 9px}}@media print{:root{background:white}.reports-only footer{font-size:10px}.reports-only .small{font-size:10px}}`;

/** Standalone HTML has no script, live request, remote CSS, font, image or iframe. */
export function renderBriefingText(snapshot,{mode='full'}={}) {
  validateSnapshot(snapshot);
  if (!['full','reports'].includes(mode)) throw new ArchiveError('Neznámý druh výstupu.','invalid');
  return formatBriefingText(cloneValue(snapshot),{mode});
}

export function renderBriefingHtml(snapshot, {mode='full'}={}) {
  if (!['full','reports'].includes(mode)) throw new ArchiveError('Neznámý druh výstupu.','invalid');
  validateSnapshot(snapshot);
  snapshot = cloneValue(snapshot);
  const zone = snapshot.state.timezone;
  const times = datasetTimes(snapshot);
  const inspectedIndex = snapshot.forecast ? nearestTimeIndex(snapshot.forecast.times, snapshot.state.time) : -1;
  const sample = inspectedIndex >= 0 ? snapshot.forecast.times[inspectedIndex] : null;
  const notes = snapshot.notes?.trim() ? esc(snapshot.notes) : 'Bez poznámek.';
  return `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'"><meta name="referrer" content="no-referrer"><title>${esc(snapshot.title)} · uložený briefing</title><style>${CSS}${ROUTE_PRINT_CSS}${SECTION_PRINT_CSS}${CAMERAS_PRINT_CSS}${CHARTS_PRINT_CSS}${PROCESSED_CEILING_PRINT_CSS}</style></head><body class="${mode==='reports'?'reports-only':'full-briefing'}"><main><header><div class="kicker">Heli Briefing · ${mode==='reports'?'METAR / TAF pro předání':'uložený datový snímek'}</div><h1>${esc(snapshot.state.name)}</h1><p>Čas přehledu: <strong>${esc(stamp(snapshot.state.time, zone))}</strong> · ${esc(formatCoordinates(snapshot.state.lat, snapshot.state.lon, 5))}${mode==='full'?` · rozsah ${snapshot.state.hours} h`:''}</p><p>Uloženo ${esc(stamp(snapshot.createdAt, zone))} · ID ${esc(snapshot.id)}</p></header><p class="frozen">Tento soubor zachycuje data dostupná při uložení a sám se neaktualizuje. Čas uložení nenahrazuje čas pozorování, vydání ani platnosti. Stav a stáří zpráv jsou hodnoceny pro uložený kontext.</p>${renderSourceReview(snapshot,{mode})}<section><h2>Poznámky k briefingu</h2><div class="notes">${notes}</div></section>${mode==='reports'?renderReportPack(snapshot):`<section class="point-summary"><h2>Vybraný hodinový vzorek</h2><ul>${selectedForecastLines(snapshot).map(line=>`<li>${esc(line)}</li>`).join('')}</ul></section><section><h2>Modelová předpověď</h2>${forecastProvenance(snapshot.forecast, zone)}${snapshot.comparison ? `<h3>Porovnání</h3>${forecastProvenance(snapshot.comparison, zone)}` : ''}<p class="small">Nejbližší hodinový vzorek pro číselné hodnoty: ${esc(stamp(sample, zone))}. Grafy uchovávají jednotlivé časy a mezery; oblačnost v procentech není základna ani ceiling. Tlaková hladina 925 hPa není pevná výška AGL.</p>${forecastCharts(snapshot)}</section><section><h2>Výškový profil · ${esc(snapshot.forecast?.label || snapshot.state.model)}</h2><p>Vzorek ${esc(stamp(profileAt(snapshot.forecast,snapshot.state.time).validAt,zone))} · výšky MSL</p>${renderProfile(snapshot.forecast,snapshot.state.time)}</section><section><h2>Satelitní obraz · GeoColour</h2>${renderSatellite(snapshot.satellite,{...snapshot.state,now:Date.parse(snapshot.createdAt),error:snapshot.sourceErrors?.satellite})}</section>${snapshot.route ? `<section><h2>Počasí v bodech plánované trasy</h2>${renderRouteBriefing(snapshot.route,{zone})}</section>` : ''}<section><h2>Kamery · ${snapshot.cameras?.delivery==='browser-direct'?'oficiální zdroje a samostatný online pohled':'zachycené snímky'}</h2>${renderCameras(snapshot.cameras,{...snapshot.state,now:Date.parse(snapshot.createdAt),error:snapshot.cameras?.transportError})}</section><section><h2>${snapshot.charts?.sigmetImage?'SWL, SIGMET/AIREP a nízká oblačnost':'SWL a nízká oblačnost'} · ${snapshot.charts?.delivery==='browser-direct'?'oficiální zdroje ČHMÚ':'zachycené mapy ČHMÚ'}</h2>${renderAviationCharts(snapshot.charts,{...snapshot.state,error:snapshot.charts?.transportError})}</section>${nativeCloudSection(snapshot)}${snapshot.processedCeiling?`<section><h2>Zpracovaný CEILING · ft AGL</h2>${renderProcessedCeiling(snapshot.processedCeiling,{...snapshot.state,width:760})}<p class="small">${sourceLink(snapshot.processedCeiling.sourceUrl,'Zpracovaný rastr vybraného snímku')}</p></section>`:''}${savedSourceErrors(snapshot)}${aviationSection(snapshot, 'metar', 'Pozorování METAR')}${observationHistorySection(snapshot)}${aviationSection(snapshot, 'taf', 'Regionální předpovědi TAF')}${aviationSection(snapshot, 'sigmet', 'SIGMET · uložený regionální balíček')}${astronomySection(snapshot)}${imagerySection(snapshot)}<details class="exact-appendix"><summary>Přesná hodinová data předpovědi · příloha pro čtení</summary><p>Příloha zůstává v HTML souboru; standardní tisk ji vynechává.</p>${exactForecastTable(snapshot.forecast, snapshot.forecast?.times || [], zone)}${exactForecastTable(snapshot.comparison, snapshot.comparison?.times || [], zone)}</details>${rawDataAppendix(snapshot)}`}<footer><p>Počasí: Open-Meteo / ČHMÚ / DWD / ECMWF · ${sourceLink('https://creativecommons.org/licenses/by/4.0/', 'CC BY 4.0')}. Zprávy: ${esc(reportSources(snapshot))}. Radar: ČHMÚ. Astronomie: ${esc(snapshot.astronomy?.source || 'neuvedena')}.</p>${renderAviationAttribution(snapshot)}<p>Pomlčky označují nedostupná data; žádné hodnoty nebyly vytvořeny jako náhrada. Původní zprávy a platnost mají přednost před stručným výkladem. Vývojová verze nepředstavuje rozhodnutí o provedení letu.</p></footer></main></body></html>`;
}
