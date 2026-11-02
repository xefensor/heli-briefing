import { mountWorkspaceNavigation } from './workspace-nav.js';
import { renderAstronomyChart } from './astronomy-view.js';
import {renderProfile, profileAt} from './profile.js';
import {renderSatellite, satelliteState} from './satellite.js';
import { MODELS, fetchForecast, nearestTimeIndex } from './weather.js';
import { renderChart, escapeHtml as esc } from './charts.js';
import { getAstronomy } from './astro.js';
import { formatNumber as num, formatTime as clock, ageLabel, reportState, toDateTimeInput, fromDateTimeInput, parseSharedState, sharedSearch, formatCoordinates, haversineKm } from './briefing.js';
import { mountPlaceControls } from './place-controls.js';
import { mountRouteWorkspace } from './route-controls.js';
import { readPlaces } from './places.js';
import { mountImagery } from './imagery-controls.js';
import { renderMetarSummary, renderTafPeriods, renderReportGuide } from './report-views.js';
import { summarizeMetar } from './reports.js';
import { observationSeries } from './observations.js';
import { createMonitor } from './monitor.js';
import { queryClouds, CLOUD_STATUS_LABELS } from './clouds.js';
import { fetchBrowserAviation } from './aviation-source.js';
import { readAviationCache, writeAviationCache } from './aviation-cache.js';
import { fetchSatellite } from './satellite-source.js';
import { fetchRadar } from './radar-source.js';
import { createBriefingSnapshot, renderBriefingHtml, renderBriefingText, briefingFilename, saveBriefing, listBriefings, loadBriefing, deleteBriefing } from './archive.js';
import { reportProviderName } from './handoff.js';

const $ = (id) => document.getElementById(id);
const plotWidth = (id, offset = 32) => Math.max(320, Math.min(1000, ($(id)?.clientWidth || 720) - offset));
const PLACES = {
  lkcs: { name: 'Planá · České Budějovice', lat: 48.9463, lon: 14.4294 },
  lkhs: { name: 'Hosín · České Budějovice', lat: 49.0400, lon: 14.4967 },
  sumava: { name: 'Šumava · Kvilda', lat: 49.0197, lon: 13.5794 },
};
const STATIONS = [
  { id: 'LKCS', name: 'České Budějovice', lat: 48.9463, lon: 14.4294 },
  { id: 'LKHS', name: 'Hosín', lat: 49.0400, lon: 14.4967 },
  { id: 'LKPR', name: 'Praha / Ruzyně', lat: 50.1008, lon: 14.26 },
  { id: 'LKKB', name: 'Praha / Kbely', lat: 50.1214, lon: 14.5436 },
  { id: 'LKPD', name: 'Pardubice', lat: 50.0134, lon: 15.7386 },
  { id: 'LKTB', name: 'Brno / Tuřany', lat: 49.1513, lon: 16.6944 },
  { id: 'LKKV', name: 'Karlovy Vary', lat: 50.2028, lon: 12.9149 },
  { id: 'LOWL', name: 'Linz', lat: 48.2332, lon: 14.1875 },
  { id: 'LOWW', name: 'Wien', lat: 48.1103, lon: 16.5697 },
];
let navigationSearch = location.search;
const shared = parseSharedState(location.search);
const state = {
  place: 'lkcs', ...PLACES.lkcs, model: 'aladin', compare: '', hours: 48,
  timezone: 'Europe/Prague', time: new Date().toISOString(), ...shared,
};
if (shared.lat != null || shared.lon != null) state.place = 'custom';
if (state.compare === state.model) state.compare = '';
let forecast = null;
let comparison = null;
let aviation = readAviationCache();
let controller = null;
let requestId = 0;
let map = null;
let pointMarker = null;
let radarLayer = null;
let stationsLayer = null;
let routeLayer = null;
let lowCloudLayer = null;
let lowCloudPath = null;
let preparing = false;
let loadError = null;
let loading = false;
let compareError = null;
let aviationRequestId = 0;
let aviationLoadError = null;
let aviationLoading = false;
let historyCacheError = null;
let radarProduct = null;
let radarPending = null;
let radarHistoryLoaded = false;
let radarLoading = false;
let radarError = null;
let radarUrl = null;
const radarFailures = new Map();
let clouds = null;
let cloudError = null;

let liveMode = !shared.time;
let monitor = null;
let historyStation = '';
let radarIndex = -1;
let radarPlaying = false;
let radarTimer = null;
let reportView = 'both';
let previewSnapshot = null;
let previewMode = 'full';
let satellite = null;
let satelliteError = null;
let satelliteSequence = 0;

const definition = (model = state.model) => MODELS.find((m) => m.id === model);
const fullTime = (iso) => `${clock(iso, state.timezone, true)} ${state.timezone === 'UTC' ? 'UTC' : 'CZ'}`;
const at = (data, key, instant = state.time) => {
  if (!data) return null;
  const index = nearestTimeIndex(data.times, instant);
  return index < 0 ? null : data.hourly[key]?.[index] ?? null;
};
const v = (value, unit = '', digits = 0) => `${num(value, digits)}${value == null ? '' : ` ${unit}`}`;

function persist(key, value) {
  try { localStorage.setItem(`heli-${key}`, value); } catch { /* Private storage may be disabled. */ }
}
function restore(key) {
  try { return localStorage.getItem(`heli-${key}`); } catch { return null; }
}
document.documentElement.dataset.theme = restore('theme') || 'light';
$('notes').value = restore('notes') || '';
reportView = ['both', 'summary', 'raw'].includes(restore('report-view')) ? restore('report-view') : 'both';
const placeControls = mountPlaceControls({ getCurrent: () => state, onChoose: choosePlace });
const routeWorkspace = mountRouteWorkspace({ getContext: () => state,
  getChoices: () => [...Object.values(PLACES), ...(readPlaces({ getItem: key => localStorage.getItem(key) }).places || [])],
  getClouds: () => ({ clouds, cloudError }), onGeometry: drawRoute,
  onInspect: point => { choosePlace(point.lat, point.lon, point.name); if (point.passageAt) selectTime(point.passageAt); $('forecast-panel').scrollIntoView({ behavior: 'smooth' }); },
  onMap: points => { if (map && points.length) map.fitBounds(points.map(point => [point.lat, point.lon]), { padding: [25, 25], maxZoom: 11 }); $('region-panel').scrollIntoView({ behavior: 'smooth' }); },
});

const imagery = mountImagery({ getContext: () => state, onLowCloud: showLowCloudMap });
function showLowCloudMap(frame, focus = false) {
  if (!map || !window.L) return;
  if (!frame?.imagePath) { lowCloudLayer?.remove(); lowCloudLayer = null; lowCloudPath = null; $('map-layer-note').textContent = ''; return; }
  if (frame.imagePath !== lowCloudPath) {
    lowCloudLayer?.remove(); $('radar-toggle').checked = false; stopRadar(); radarLayer?.remove(); renderRadar();
    lowCloudLayer = window.L.imageOverlay(frame.imagePath, [[47.766666666667,10.5],[51.366666666667,20.316666666667]], {opacity:.75,alt:`Předpověď nízké oblačnosti ČHMÚ pro ${fullTime(frame.validAt)}`,attribution:'Nízká oblačnost: ČHMÚ · CC BY 4.0'}).addTo(map); lowCloudPath = frame.imagePath;
  }
  $('map-layer-note').textContent = `PŘEDPOVĚĎ ČHMÚ nízké oblačnosti · mapa pro ${fullTime(frame.validAt)} · radar je vypnutý. Výšky podle legendy v hFT AMSL.`;
  if (focus) $('region-panel').scrollIntoView({behavior:'smooth'});
}

function writeUrl() {
  const url = new URL(location.href);
  url.search = sharedSearch(state, { live: liveMode });
  history.replaceState(null, '', url);
  navigationSearch = url.search;
}

function updateControls() {
  placeControls.update();
  routeWorkspace.sync();
  imagery.sync();
  updateOutputAvailability();
  document.querySelectorAll('[data-model]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.model === state.model)));
  document.querySelectorAll('[data-hours]').forEach((button) => button.setAttribute('aria-pressed', String(Number(button.dataset.hours) === state.hours)));
  if (document.activeElement !== $('inspection-time')) $('inspection-time').value = toDateTimeInput(state.time, state.timezone);
  $('input-zone').textContent = state.timezone === 'UTC' ? 'UTC' : 'CZ';
  $('zone').textContent = state.timezone === 'UTC' ? 'UTC' : 'CZ';
  $('zone').setAttribute('aria-label', state.timezone === 'UTC' ? 'UTC: zobrazit časy v českém místním čase' : 'CZ: zobrazit časy v UTC');
  syncThemeControl();
  $('compare').value = state.compare;
  [...$('compare').options].forEach((option) => { option.disabled = option.value === state.model; });
  $('selected-label').textContent = fullTime(state.time);
  $('live-mode').textContent = liveMode ? 'Živě' : 'Připnuto';
  $('live-mode').setAttribute('aria-label',liveMode ? 'Živě: pozastavit čas a ponechat aktuální výběr' : 'Připnuto: obnovit živý čas, vrátit se na Teď');
  $('live-mode').dataset.live = String(liveMode);
  $('live-mode').setAttribute('aria-pressed', String(liveMode));
  document.querySelectorAll('[data-report-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.reportView === reportView)));
  $('place-title').textContent = state.name;
  $('context-line').textContent = `${formatCoordinates(state.lat, state.lon)} · ${definition().label} · ${fullTime(state.time)}`;
  $('windy-link').href = `https://www.windy.com/?${state.lat.toFixed(4)},${state.lon.toFixed(4)},9`;
  if (forecast) {
    $('time-slider').max = String(forecast.times.length - 1);
    const index = nearestTimeIndex(forecast.times, state.time);
    $('time-slider').value = String(Math.max(0, index));
    $('time-slider').disabled = !forecast.validFrom;
    $('time-slider').setAttribute('aria-valuetext', fullTime(state.time));
    $('inspection-time').min = toDateTimeInput(forecast.times[0], state.timezone);
    $('inspection-time').max = toDateTimeInput(forecast.times.at(-1), state.timezone);
  }
  $('print-context').textContent = `${state.name} · ${state.lat.toFixed(4)}, ${state.lon.toFixed(4)} · ${definition().label} · čas přehledu ${fullTime(state.time)} · sestaveno ${fullTime(new Date().toISOString())}`;
  document.title = `${state.name} · Heli Briefing`;
}

function renderSummary() {
  const data = forecast;
  const pair = (first, second, unit, digits = 0) => `${num(first, digits)} / ${num(second, digits)}${first == null && second == null ? '' : ` ${unit}`}`;
  const cells = [
    ['Vítr / nárazy', pair(at(data, 'wind'), at(data, 'gust'), 'kt'), `Směr ${v(at(data, 'direction'), '°')} · 10 m nad povrchem`],
    ['Dohlednost', v(at(data, 'visibility') == null ? null : at(data, 'visibility') / 1000, 'km', 1), 'Modelový odhad v místě'],
    ['Nízká oblačnost', v(at(data, 'cloudLow'), '%'), 'Pokrytí · neurčuje ceiling'],
    ['Teplota / rosný bod', pair(at(data, 'temperature'), at(data, 'dewpoint'), '°C', 1), 'Modelové hodnoty ve 2 m'],
    ['Srážky', v(at(data, 'precipitation'), 'mm', 1), 'Úhrn za předchozí hodinu'],
    ['Tlak MSL', v(at(data, 'pressure'), 'hPa'), 'Modelový tlak na hladině moře'],
  ];
  const sampleIndex = data ? nearestTimeIndex(data.times,state.time) : -1;
  $('summary-context').textContent = `${definition().label} · ${sampleIndex < 0 ? 'hodinový vzorek nedostupný' : `hodinový vzorek ${fullTime(data.times[sampleIndex])}`}`;
  $('summary').innerHTML = cells.map(([label, value, sub]) => `<div class="summary-cell"><span class="label">${esc(label)}</span><strong class="value">${esc(value)}</strong><span class="sub">${esc(sub)}</span></div>`).join('');
}

function renderStatus() {
  const banner = $('weather-status');
  let text;
  if (loading) {
    banner.dataset.state = 'loading';
    text = `Načítám ${definition().label} pro ${state.name}…`;
  } else if (loadError) {
    banner.dataset.state = 'error';
    text = `${definition().label}: ${loadError}. Zkus Obnovit nebo zvol jiný model.`;
  } else if (!forecast?.validFrom) {
    banner.dataset.state = 'error';
    text = 'Zdroj odpověděl, ale pro toto místo a období neposkytl hodnoty. Zvol jiné místo nebo model.';
  } else if (forecast.transport.stale) {
    banner.dataset.state = 'stale';
    text = `Obnova se nezdařila. Zobrazuji dříve stažená data stejného místa a modelu (${fullTime(forecast.retrievedAt)}). ${forecast.transport.error?.message || ''}`;
  } else if (nearestTimeIndex(forecast.times, state.time) < 0 || at(forecast, 'temperature') == null) {
    banner.dataset.state = 'stale';
    text = 'Vybraný čas nemá dostupnou předpověď tohoto modelu. Prázdné hodnoty nejsou nulové počasí; uprav čas nebo model.';
  } else {
    banner.dataset.state = 'ready';
    const sampleTime = forecast.times[nearestTimeIndex(forecast.times, state.time)];
    text = `Modelová předpověď · ${definition().label} · výstup ${forecast.resolution} · nejbližší hodinový vzorek ${fullTime(sampleTime)}. Letištní pozorování a radar mají vlastní čas.`;
  }
  banner.textContent = text;
  if (!forecast) {
    $('forecast-meta').textContent = loading ? 'Čekám na odpověď zdroje…' : 'Předpověď není k dispozici. Regionální zprávy a astronomické výpočty zůstávají dostupné.';
    return;
  }
  const height = at(forecast, 'height925');
  $('forecast-meta').textContent = `${forecast.provider} · staženo ${fullTime(forecast.retrievedAt)} · dostupné do ${forecast.validTo ? fullTime(forecast.validTo) : '—'} · běh modelu API neuvádí${height == null ? '' : ` · hladina 925 hPa: ${num(height)} m MSL`}.`;
}

const CHARTS = [
  { id: 'wind', title: 'Přízemní vítr a nárazy', unit: 'kt', fields: [['wind', 'Vítr', 'var(--chart-cyan)'], ['gust', 'Nárazy', 'var(--chart-amber)']], min: 0, note: 'Vítr v 10 m. Nárazy jsou maximum za předchozí hodinu.' },
  { id: 'visibility', title: 'Modelová dohlednost', unit: 'km', fields: [['visibility', 'Dohlednost', 'var(--chart-cyan)']], min: 0, divisor: 1000, note: 'Modelová hodnota; letištní pozorování najdeš ve zprávách níže.' },
  { id: 'clouds', title: 'Oblačnost podle vrstev', unit: '%', fields: [['cloudLow', 'Nízká', 'var(--chart-cyan)'], ['cloudMid', 'Střední', 'var(--chart-amber)'], ['cloudHigh', 'Vysoká', 'var(--chart-purple)']], min: 0, max: 100, note: 'Podíl pokrytí jednotlivých vrstev. Není to základna oblačnosti ani ceiling.' },
  { id: 'rain', title: 'Hodinové srážky', unit: 'mm', fields: [['precipitation', 'Úhrn', 'var(--chart-blue)']], min: 0, note: 'Úhrn za hodinu končící uvedeným časem; nejde o radarové měření.' },
  { id: 'temperature', title: 'Teplota a rosný bod', unit: '°C', fields: [['temperature', 'Teplota', 'var(--chart-amber)'], ['dewpoint', 'Rosný bod', 'var(--chart-cyan)']], note: 'Modelové hodnoty ve 2 m nad povrchem.' },
  { id: 'pressure', title: 'Tlak na hladině moře', unit: 'hPa', fields: [['pressure', 'MSL', 'var(--chart-purple)']], note: 'Modelový redukovaný tlak; není to měřený QNH ani QFE.' },
  { id: 'upper', title: 'Vítr v hladině 925 hPa', unit: 'kt', fields: [['wind925', '925 hPa', 'var(--chart-blue)']], min: 0, note: 'Tlaková hladina, nikoli pevná výška AGL. U ICON-D2 je 925 hPa interpolována poskytovatelem; ECMWF 9 km tento výstup neposkytuje.' },
  { id: 'humidity', title: 'Relativní vlhkost', unit: '%', fields: [['humidity', 'Vlhkost', 'var(--chart-cyan)']], min: 0, max: 100, note: 'Modelová vlhkost ve 2 m; sama neurčuje mlhu ani podmínky letu.' },
];

function chartTimes() {
  if (!forecast) return [];
  const now = Date.now();
  const selected = Date.parse(state.time);
  let start = Math.max(Date.parse(forecast.times[0]), Math.floor(now / 3600000) * 3600000);
  if (selected < start || selected > start + (state.hours - 1) * 3600000) start = Math.max(Date.parse(forecast.times[0]), selected - Math.floor(state.hours / 3) * 3600000);
  return forecast.times.filter((time) => Date.parse(time) >= start && Date.parse(time) < start + state.hours * 3600000);
}

function renderCharts() {
  const focusedChart=document.activeElement?.closest('[data-chart-card]')?.dataset.chartCard;
  const times = chartTimes();
  if (!forecast) {
    $('charts').innerHTML = CHARTS.map((chart) => `<article class="chart-card"><h3 class="chart-title">${chart.title}</h3><div class="empty-state">${loading ? 'Načítání…' : 'Zdroj není dostupný'}</div></article>`).join('');
    $('comparison').hidden = true;
    return;
  }
  $('charts').innerHTML = CHARTS.map((chart) => {
    const get = (data, field, time) => { const value = at(data, field, time); return value == null ? null : value / (chart.divisor || 1); };
    const series = chart.fields.map(([key, label, color]) => ({ key, label, color, unit: chart.unit, values: times.map((time) => get(forecast, key, time)) }));
    if (comparison) for (const [key, label] of chart.fields) series.push({ key: `compare-${key}`, label: `${comparison.label} · ${label}`, color: 'var(--chart-purple)', dash: true, unit: chart.unit, values: times.map((time) => get(comparison, key, time)) });
    const selectedValues = chart.fields.map(([key, label]) => `${label}: ${v(get(forecast, key, state.time), chart.unit, ['temperature', 'visibility', 'rain'].includes(chart.id) ? 1 : 0)}`).join(' · ');
    const sampleIndex = nearestTimeIndex(forecast.times, state.time);
    const sampleLabel = sampleIndex < 0 ? 'Mimo časovou osu' : `Vzorek ${fullTime(forecast.times[sampleIndex])}`;
    return `<article class="chart-card" data-chart-card="${chart.id}"><div class="chart-reading"><div class="chart-header"><h3 class="chart-title">${chart.title}</h3></div><div class="chart-value">${esc(selectedValues)}</div><p class="chart-sample">${esc(sampleLabel)}</p><p class="chart-hover-value" hidden></p><p class="chart-note">${chart.note}</p></div><div class="chart-surface" tabindex="0" role="group" aria-label="${esc(chart.title)}. ${esc(sampleLabel)}. Šipkami změň hodinu.">${renderChart({ times, series, selectedTime: state.time, timezone: state.timezone, width: plotWidth('charts', innerWidth >= 1250 ? 218 : 32), height: 180, yLabel: chart.unit, min: chart.min, max: chart.max })}</div><div class="chart-legend">${series.map((s) => `<span><i class="${s.dash ? 'dashed' : ''}" style="background:${s.color};color:${s.color}"></i>${esc(s.label)}${s.dash ? ' · přerušovaně' : ''}</span>`).join('')}</div></article>`;
  }).join('');
  if(focusedChart) $('charts').querySelector(`[data-chart-card="${focusedChart}"] .chart-surface`)?.focus({preventScroll:true});
  $('comparison').hidden = !state.compare;
  if (state.compare) $('comparison').innerHTML = comparison
    ? `<div class="comparison-item"><strong>${esc(forecast.label)}</strong> ${esc(v(at(forecast, 'wind'), 'kt'))} · ${esc(v(at(forecast, 'visibility') == null ? null : at(forecast, 'visibility') / 1000, 'km', 1))}</div><div class="comparison-item"><strong>${esc(comparison.label)} · přerušovaně</strong> ${esc(v(at(comparison, 'wind'), 'kt'))} · ${esc(v(at(comparison, 'visibility') == null ? null : at(comparison, 'visibility') / 1000, 'km', 1))}${comparison.transport.stale ? ' · STARŠÍ CACHE' : ''}</div>`
    : `<p>${esc(compareError ? `Porovnání není dostupné: ${compareError}` : 'Načítání druhého modelu…')}</p>`;
}

function renderAstronomy() {
  const astro = getAstronomy({ lat: state.lat, lon: state.lon, date: new Date(state.time) });
  const event = (time) => time ? clock(time.toISOString(), state.timezone) : 'bez události';
  const moonFocused = $('astronomy').contains(document.activeElement);
  const moonOpen = Boolean($('astronomy').querySelector('details[open]'));
  $('astronomy').innerHTML = `<div class="light-grid">${[['Svítání · civilní', astro.dawn], ['Východ Slunce', astro.sunrise], ['Západ Slunce', astro.sunset], ['Soumrak · civilní', astro.dusk]].map(([label, value]) => `<div class="light-item"><span class="label">${label}</span><strong>${event(value)}</strong></div>`).join('')}</div><p class="panel-meta">Délka dne ${v(astro.dayLengthHours, 'h', 1)} · Slunce nyní ve vybraném čase ${v(astro.sunAltitude, '°', 1)}${astro.alwaysUp ? ' · Slunce celý den nad obzorem' : astro.alwaysDown ? ' · Slunce celý den pod obzorem' : ''}.</p><details class="report-details"${moonOpen ? ' open' : ''}><summary>Měsíc a podrobnosti</summary><div class="light-grid"><div class="light-item"><span class="label">Fáze</span><strong>${esc(astro.phaseLabel)}</strong></div><div class="light-item"><span class="label">Osvětlená část kotouče</span><strong>${v(astro.moonFraction * 100, '%')}</strong></div><div class="light-item"><span class="label">Východ Měsíce</span><strong>${event(astro.moonrise)}</strong></div><div class="light-item"><span class="label">Západ Měsíce</span><strong>${event(astro.moonset)}</strong></div></div><p class="chart-caption">Výška Měsíce ${v(astro.moonAltitude, '°', 1)}. Osvětlený podíl kotouče není měření světla na zemi.</p></details><p class="chart-caption">Výpočty SunCalc pro den ${clock(astro.dayStart.toISOString(), 'UTC', true).split(' ')[0]} UTC; události zobrazeny v ${state.timezone === 'UTC' ? 'UTC' : 'českém místním čase'}. Polohy odpovídají času přehledu.</p>${renderAstronomyChart(astro,state.time,state.timezone,plotWidth('astronomy'))}`;
  if(moonFocused) $('astronomy').querySelector('summary')?.focus({preventScroll:true});
}

function renderReportFreshness() {
  if (!aviation) return;
  const feeds=[['METAR',aviation.metar],['TAF',aviation.taf]];
  $('reports-meta').textContent = `${aviation.sourceName || 'ČHMÚ MET-SWIM'} · METAR stažen ${aviation.metar?.retrievedAt?fullTime(aviation.metar.retrievedAt):'neuvedeno'} · TAF stažen ${aviation.taf?.retrievedAt?fullTime(aviation.taf.retrievedAt):'neuvedeno'}. Přímá obnova po 5 min; rozhoduje čas a platnost zprávy.`;
  const alerts=feeds.filter(([,feed])=>!feed||!feed.retrievedAt||Date.now()-Date.parse(feed.retrievedAt)>3600000||['stale','unavailable'].includes(feed.status)||feed.transportStatus==='partial');
  const coverage=feeds.filter(([,feed])=>feed?.missingStations?.length).map(([name,feed])=>`<p class="source-coverage"><strong>${name} · neúplné pokrytí</strong> · zdroj neposkytl ${esc(feed.missingStations.join(', '))}. Stanice zůstávají v přehledu; dostupnost ověř u původního zdroje.</p>`).join('');
  $('reports-status').innerHTML=(aviationLoading?'<p class="source-coverage">Obnovuji zprávy přímo u poskytovatelů…</p>':'')+(aviationLoadError?`<p class="feed-error">Obnova zpráv nebyla potvrzena: ${esc(aviationLoadError)}. Zachovány jsou původní časy.</p>`:'')+alerts.map(([name,feed])=>`<p class="feed-error"><strong>${name} · ${!feed||feed.status==='unavailable'?'zdroj nedostupný':'obnova není úplná / zachována starší data'}</strong> · ${feed?.retrievedAt?`staženo ${esc(fullTime(feed.retrievedAt))}`:'čas stažení chybí'}. ${esc(feed?.error||'Ověř původní zprávy u zdroje.')}</p>`).join('')+coverage+(aviation.supplementWarning?`<p class="section-note">${esc(aviation.supplementWarning)}</p>`:'')+(historyCacheError?`<p class="source-coverage">Místní historie: ${esc(historyCacheError)}. Aktuální zprávy zůstávají dostupné.</p>`:'');
}

function renderNearbyObservations() {
  if(!aviation) return;
  const stations=[...STATIONS].sort((a,b)=>haversineKm(state.lat,state.lon,a.lat,a.lon)-haversineKm(state.lat,state.lon,b.lat,b.lon)).slice(0,3);
  const feed=aviation.metar;
  const old=!feed?.retrievedAt||Date.now()-Date.parse(feed.retrievedAt)>3600000;
  const warning=aviationLoadError||old||['stale','unavailable'].includes(feed?.status)||feed?.transportStatus==='partial'?'<p class="nearby-source-warning">METAR · obnova nepotvrzena. Zachovány původní časy; <a href="#reports-panel">ověřit zprávy →</a></p>':'';
  $('nearby-observations').innerHTML=warning+stations.map(station=>{
    const item=aviation.metar?.items?.find(item=>item.station===station.id), summary=item?summarizeMetar(item):null;
    const available=summary?.status==='available', wind=available?summary.wind:null, ceiling=summary?.ceiling;
    const c=ceiling?.status==='reported'?`${num(ceiling.valueFtAgl)} ft AGL`:ceiling?.status==='cavok'?'CAVOK':ceiling?.status==='not-reported'?'neuveden':'—';
    return `<a class="nearby-item" href="#station-${station.id}"><span class="nearby-title"><strong>${station.id} · ${esc(station.name)}</strong><small>${num(haversineKm(state.lat,state.lon,station.lat,station.lon))} km</small></span>${item?`<span class="nearby-values"><span>Vítr <strong>${wind?esc(`${wind.variable?'VRB':v(wind.direction,'°')} / ${v(wind.speedKt,'kt')}`):'—'}</strong></span><span>Dohlednost <strong>${esc(available?summary.visibility.text:'—')}</strong></span><span>Ceiling <strong>${esc(c)}</strong></span></span><span class="nearby-time">${item.observedAt?esc(fullTime(item.observedAt)):'Čas neuveden'} · <span data-age="${esc(item.observedAt||'')}">${esc(ageLabel(item.observedAt))}</span> · <span data-report-status="METAR" data-report-id="${esc(item.id)}" data-tone="${esc(reportState(item).tone)}">${esc(reportState(item).tone==='neutral'?'Pozorování':reportState(item).label)}</span></span>`:'<span class="nearby-time">Tento zdroj METAR neposkytl · ověřit u zdroje</span>'}</a>`;
  }).join('');
}

function renderStationOverview() {
  if (!aviation) return;
  $('station-overview').innerHTML = `<table class="station-overview"><caption>Regionální stanice · pozorování na letišti, nikoli ve vybraném bodě</caption><thead><tr><th>Stanice / vzdálenost</th><th>METAR / čas</th><th>Vítr</th><th>Dohlednost</th><th>Ceiling · ft AGL</th><th>TAF pro čas přehledu</th></tr></thead><tbody>${[...STATIONS].sort((a,b) => haversineKm(state.lat,state.lon,a.lat,a.lon)-haversineKm(state.lat,state.lon,b.lat,b.lon)).map(station => {
    const metar = aviation.metar?.items?.find(item => item.station === station.id);
    const taf = aviation.taf?.items?.find(item => item.station === station.id);
    const summary = metar ? summarizeMetar(metar) : null;
    const wind = summary?.status === 'available' ? summary.wind : null;
    const ceiling = summary?.ceiling;
    const status = reportState(taf, Date.parse(state.time));
    return `<tr><th scope="row"><a href="#station-${station.id}">${station.id} · ${esc(station.name)}</a><small>${num(haversineKm(state.lat,state.lon,station.lat,station.lon))} km od bodu</small></th><td>${metar ? `<span data-age="${esc(metar.observedAt || '')}">${esc(ageLabel(metar.observedAt))}</span><small>${metar.observedAt ? esc(fullTime(metar.observedAt)) : 'Čas neuveden'}</small><span class="tag" data-report-status="METAR" data-report-id="${esc(metar.id)}" data-tone="${esc(reportState(metar).tone)}">${esc(reportState(metar).label)}</span>` : 'Nedostupný'}</td><td>${wind ? esc(`${wind.variable ? 'VRB' : v(wind.direction,'°')} / ${v(wind.speedKt,'kt')}${wind.gustKt == null ? '' : ` G ${v(wind.gustKt,'kt')}`}`) : '—'}</td><td>${esc(summary?.status === 'available' ? summary.visibility.text : '—')}</td><td>${esc(ceiling?.status === 'reported' ? num(ceiling.valueFtAgl) : ceiling?.status === 'cavok' ? 'CAVOK' : ceiling?.status === 'not-reported' ? 'BKN/OVC/VV neuvedeno' : '—')}</td><td>${taf ? `<span class="tag" data-report-status="TAF" data-report-id="${esc(taf.id)}" data-tone="${esc(status.tone)}">${esc(status.label)}</span>` : 'Nedostupný'}</td></tr>`;
  }).join('')}</tbody></table>`;
}

function renderReports() {
  if (!aviation) return;
  renderReportFreshness();
  renderNearbyObservations();
  $('report-guide').innerHTML = renderReportGuide();
  const focusedStation = document.activeElement?.closest('[data-station]')?.dataset.station;
  const itemHtml = (item, type) => {
    if (!item) return `<div class="report-block report-block--${type.toLowerCase()}"><span class="source-badge">${type}</span><p class="muted">Tento zdroj zprávu neposkytl. Dostupnost ověř u původního zdroje; neznamená to dobré počasí.</p></div>`;
    const status = reportState(item, type === 'TAF' ? Date.parse(state.time) : Date.now());
    const instant = type === 'METAR' ? item.observedAt : item.issuedAt;
    const validity = type === 'TAF' && item.validFrom && item.validTo ? ` · platnost ${fullTime(item.validFrom)}–${fullTime(item.validTo)}` : '';
    const retained = item.transportStatus === 'stale' || item.restoredFromCache ? '<p class="feed-error">Zachovaná zpráva z místní paměti / po chybě obnovy; její původní čas zůstává uveden.</p>' : '';
    const summary = type === 'METAR' ? renderMetarSummary(item, { timezone: state.timezone, compact:true }) : renderTafPeriods(item, { selectedTime: state.time, timezone: state.timezone, compact:true });
    return `<div class="report-block report-block--${type.toLowerCase()}"><div class="report-block-header"><span class="source-badge">${type}</span><span class="tag" data-report-status="${type}" data-report-id="${esc(item.id)}" data-tone="${esc(status.tone)}">${esc(type === 'METAR' && status.tone === 'neutral' ? 'Pozorování' : status.label)}${type === 'TAF' ? ' · pro čas přehledu' : ''}</span></div><p class="station-meta">${esc(reportProviderName({aviation},type.toLowerCase(),item))} · ${instant ? esc(fullTime(instant)) : 'Čas zprávy nedostupný'}${instant ? ` · <span data-age="${esc(instant)}">${esc(ageLabel(instant))}</span>` : ''}${esc(validity)}</p>${retained}<div${reportView === 'raw' ? ' hidden' : ''}>${summary}</div><pre class="report-raw"${reportView === 'summary' ? ' hidden' : ''}>${esc(item.raw || 'Zdroj neposkytl originální text.')}</pre></div>`;
  };
  $('reports').innerHTML = STATIONS.map(station => {
    const metar = aviation.metar?.items?.find(item => item.station === station.id);
    const taf = aviation.taf?.items?.find(item => item.station === station.id);
    const distance = haversineKm(state.lat, state.lon, station.lat, station.lon);
    return `<article class="station-card" id="station-${station.id}"><div class="station-title"><button type="button" class="station-pick" data-station="${station.id}" title="Vybrat místo předpovědi ${station.id}"><strong>${station.id}</strong> ${station.name}</button><span class="muted">${num(distance)} km od bodu</span></div><div class="station-bulletins">${itemHtml(metar, 'METAR')}${itemHtml(taf, 'TAF')}</div>${!metar || !taf ? `<p class="station-source-link"><a href="https://aviationweather.gov/data/metar/?id=${station.id}" target="_blank" rel="noopener noreferrer">${station.id} · ověřit další hlášení u AWC ↗</a></p>` : ''}</article>`;
  }).join('');
  if(focusedStation) $('reports').querySelector(`[data-station="${focusedStation}"]`)?.focus({preventScroll:true});
  renderStationOverview();
  renderSigmets();
  renderRadar();
}

function renderHistory() {
  const section = aviation?.metar;
  const available = STATIONS.filter(station => section?.history?.some(item => item.station === station.id));
  if (!available.some(station => station.id === historyStation)) historyStation = [...available].sort((a, b) => haversineKm(state.lat, state.lon, a.lat, a.lon) - haversineKm(state.lat, state.lon, b.lat, b.lon))[0]?.id || '';
  $('history-station').innerHTML = available.map(station => `<option value="${station.id}">${station.id} · ${station.name}</option>`).join('');
  $('history-station').value = historyStation;
  $('history-station').disabled = !available.length;
  if (!section?.history?.length || !historyStation) {
    $('history-meta').textContent = `Historie není dostupná. ${section?.historyError || ''}`;
    $('observation-history').innerHTML = '<p class="empty-state">Žádná dostupná historická pozorování; hodnoty se nevytvářejí.</p>';
    return;
  }
  const series = observationSeries(aviation, historyStation);
  const station = STATIONS.find(item => item.id === historyStation);
  const historyOrigin = section.historyMethod === 'source-archive-and-browser' ? 'archiv MET Norway + místní pozorování · pokrytí není úplné' : section.historyMethod === 'browser-observed' ? 'částečná historie zachycená tímto prohlížečem' : 'historie zdroje';
  $('history-meta').textContent = `${historyStation} · ${num(haversineKm(state.lat, state.lon, station.lat, station.lon))} km od vybraného bodu · ${series.times.length} pozorování · ${historyOrigin} · poslední příjem ${fullTime(section.historyRetrievedAt)}${section.historyStatus === 'stale' ? ' · obnova selhala, starší historie' : ''}${section.historyError ? ` · ${section.historyError.replace(/[.!?]\s*$/,'')}` : ''}${section.historyLimitReached ? ' · zdroj dosáhl limitu odpovědi; rozsah nemusí být úplný' : ''}. Jde o počasí na stanici, nikoli měření ve vybraném bodě.`;
  $('observation-history').innerHTML = [
    { title: 'Pozorovaná dohlednost', values: series.visibility.map(value => value === null ? null : value / 1000), unit: 'km', color: 'var(--chart-cyan)', note: 'Body jsou skutečná pozorování, bez spojování intervalů. 9999 a CAVOK jsou dolní mez ≥10 km, v grafu umístěná na 10 km; další meze podle originálu.' },
    { title: 'Pozorovaný ceiling / VV', values: series.ceiling, unit: 'ft AGL', color: 'var(--chart-amber)', note: 'Nejnižší uvedená BKN/OVC nebo vertikální dohlednost VV. Mezery zahrnují zprávy bez číselného ceilingu; neznamenají 0 ft.' },
  ].map(chart => `<article class="chart-card"><div class="chart-header"><h3 class="chart-title">${chart.title}</h3><span class="chart-unit">${chart.unit}</span></div><div class="chart-surface">${renderChart({ times: series.times, series: [{ label: historyStation, color: chart.color, values: chart.values, unit: chart.unit, pointsOnly: true }], selectedTime: null, timezone: state.timezone, width: plotWidth('observation-history'), height: 210, yLabel: chart.unit, min: 0 })}</div><p class="chart-caption">${chart.note}</p></article>`).join('');
}

function renderSigmets() {
  const focusedId=document.activeElement?.closest('[data-sigmet-id]')?.dataset.sigmetId;
  const openStates=new Map([...$('sigmets').querySelectorAll('[data-sigmet-id]')].map(node=>[node.dataset.sigmetId,node.open]));
  const section = aviation?.sigmet;
  if (!section) { $('significant-status').textContent='SIGMET · zdroj nedostupný'; $('significant-status').dataset.tone='warn'; $('sigmets').innerHTML = '<p class="feed-error">SIGMET není k dispozici.</p>'; return; }
  const active = (section.items || []).filter((item) => item.validFrom && item.validTo && Date.parse(item.validFrom) <= Date.parse(state.time) && Date.parse(item.validTo) > Date.parse(state.time) && !item.cancelled && !item.nil);
  const old = !section.retrievedAt || Date.now() - Date.parse(section.retrievedAt) > 60 * 60000;
  const status = (section.coverageComplete === false ? `<p class="source-coverage">Úplné aktuální pokrytí SIGMET není potvrzeno. ${esc(section.error || 'Katalog posledních souborů nedokládá nepřítomnost výstrah.')}</p>` : '') + (['stale', 'unavailable'].includes(section.status) ? `<p class="feed-error">Zdroj SIGMET je ${section.status === 'stale' ? 'starší po chybě obnovy' : 'nedostupný'}. ${esc(section.error || '')}</p>` : '') + (old || aviationLoadError ? '<p class="feed-error">Aktuálnost balíčku SIGMET není potvrzena.</p>' : '');
  const unknown = (section.items || []).filter((item) => !item.validFrom || !item.validTo).length;
  const uncertain = old || aviationLoadError || ['stale','unavailable'].includes(section.status) || section.coverageComplete === false || unknown;
  const future = Date.parse(state.time)>Date.now()+3600000;
  $('significant-status').textContent = future ? 'SIGMET · budoucí stav nelze určit' : uncertain ? 'SIGMET · ověřit aktuálnost' : active.length ? `SIGMET · ${active.length} pro čas přehledu` : 'SIGMET · 0 v balíčku pro tento čas';
  $('significant-status').dataset.tone = uncertain || future || active.length ? 'warn' : 'neutral';
  $('sigmets').innerHTML = status + (active.length ? active.map((item) => `<details class="report-details" data-sigmet-id="${esc(item.id || `${item.fir}:${item.validFrom}`)}" open><summary>${esc(item.fir || 'SIGMET')} · ${esc(fullTime(item.validTo))}</summary><pre class="report-raw">${esc(item.raw)}</pre></details>`).join('') : `<p class="muted">Načtené soubory neobsahují SIGMET s platností pro vybraný čas. Pokrytí FIR LKAA / LOVV / EDMM / LZBB není úplné. Ověř aktuální zdroj; nejde o potvrzení bez výstrah.</p>`) + ((section.items || []).some(item => !active.includes(item)) ? `<details class="report-details"><summary>Další zprávy zdroje · mimo vybranou platnost nebo neznámý čas</summary>${(section.items || []).filter(item=>!active.includes(item)).map(item=>`<p class="station-meta">${esc(item.fir || 'SIGMET')} · ${item.validFrom?esc(fullTime(item.validFrom)):'počátek neuveden'}–${item.validTo?esc(fullTime(item.validTo)):'konec neuveden'} · ${esc(reportState(item,Date.parse(state.time)).label)}</p><pre class="report-raw">${esc(item.raw)}</pre>`).join('')}</details>` : '') + (unknown ? `<p class="feed-error">${unknown} zpráv má neznámou platnost; nelze určit překryv.</p>` : '') + (Date.parse(state.time) > Date.now() + 3600000 ? '<p class="chart-caption">Aktuální balíček nepředpovídá, jaké výstrahy budou vydány v budoucnu.</p>' : '') + `<p class="chart-caption">SIGMET stažen ${section.retrievedAt ? esc(fullTime(section.retrievedAt)) : '—'}.</p>`;
  $('sigmets').insertAdjacentHTML('beforeend','<p class="chart-caption"><a href="https://meteo.rlp.cz/sigmetmap.png" target="_blank" rel="noopener noreferrer">ŘLP · původní mapa SIGMET / AIREP ↗</a> · samostatný online zdroj; ověř čas aktualizace v mapě. Její otevření nepotvrzuje úplnost načtených zpráv.</p>');
  for(const node of $('sigmets').querySelectorAll('[data-sigmet-id]')) { if(openStates.has(node.dataset.sigmetId)) node.open=openStates.get(node.dataset.sigmetId); if(node.dataset.sigmetId===focusedId) node.querySelector('summary')?.focus({preventScroll:true}); }
}

function drawRoute(points) {
  if (!map || !window.L) return;
  routeLayer?.remove();
  const L = window.L;
  routeLayer = L.layerGroup();
  if (points.length > 1) L.polyline(points.map(point => [point.lat, point.lon]), { color: '#a86b13', weight: 3, dashArray: '7 6' }).bindTooltip('Spojnice zadaných bodů · není ověřenou letovou trasou').addTo(routeLayer);
  points.forEach((point, index) => L.circleMarker([point.lat, point.lon], { radius: 6, color: '#a86b13', fillColor: '#fff', fillOpacity: 1, weight: 3 }).bindTooltip(`${index + 1}. ${esc(point.name)}`).addTo(routeLayer));
  routeLayer.addTo(map);
}

function initMap() {
  if (!window.L) { $('region-map').innerHTML = '<p class="empty-state">Mapovou knihovnu se nepodařilo načíst. Místo lze stále vybrat v záhlaví.</p>'; return; }
  const L = window.L;
  map = L.map('region-map', { scrollWheelZoom: false }).setView([state.lat, state.lon], 8);
  const base = L.tileLayer('https://ags.cuzk.gov.cz/arcgis1/rest/services/ZTM_WM/MapServer/tile/{z}/{y}/{x}', { minZoom: 6, maxZoom: 18, updateWhenIdle: true, keepBuffer: 1, attribution: '<a href="https://geoportal.gov.cz/php/micka/record/basic/CZ-CUZK-AGS-ZTM-MERCATOR">ČÚZK – on-line</a> · <a href="https://cuzk.gov.cz/Predpisy/Podminky-poskytovani-prostor-dat-a-sitovych-sluzeb/Podminky-poskytovani-sitovych-sluzeb-CUZK.aspx">Podmínky</a>' }).addTo(map);
  base.on('tileerror', () => { $('map-caption').textContent = 'Podkladovou mapu se nepodařilo načíst. ZTM ČÚZK pokrývá Česko; bod předpovědi lze vybrat i v záhlaví.'; });
  pointMarker = L.circleMarker([state.lat, state.lon], { radius: 8, color: '#b57722', fillColor: '#f3d497', fillOpacity: 1, weight: 3 }).addTo(map).bindTooltip('Vybrané místo předpovědi');
  stationsLayer = L.layerGroup(STATIONS.map((station) => L.circleMarker([station.lat, station.lon], { radius: 4, color: '#1e6465', fillColor: '#d7edeb', fillOpacity: 1, weight: 1.5 }).bindTooltip(`${station.id} · ${station.name}`).on('click', (event) => { L.DomEvent.stopPropagation(event); choosePlace(station.lat, station.lon, `${station.id} · ${station.name}`); }))).addTo(map);
  map.on('click', (event) => choosePlace(event.latlng.lat, event.latlng.lng, `Bod ${formatCoordinates(event.latlng.lat, event.latlng.lng, 3)}`));
  drawRoute(routeWorkspace.points());
}

function radarFrames() {
  const radar = radarProduct || aviation?.radar;
  return radar?.frames?.length ? radar.frames : radar?.url ? [{ url: radar.url, observedAt: radar.observedAt }] : [];
}

function stopRadar() {
  radarPlaying = false;
  if (radarTimer !== null) clearTimeout(radarTimer);
  radarTimer = null;
  $('radar-play').textContent = 'Přehrát';
  $('radar-play').setAttribute('aria-pressed', 'false');
}

function playRadar() {
  const frames = radarFrames();
  if (frames.length < 2 || !map || !$('radar-toggle').checked) return;
  radarPlaying = true;
  $('radar-play').textContent = 'Pozastavit';
  $('radar-play').setAttribute('aria-pressed', 'true');
  const next = () => {
    if (!radarPlaying || document.visibilityState !== 'visible') { stopRadar(); return; }
    radarIndex = (radarIndex + 1) % radarFrames().length;
    renderRadar();
    radarTimer = setTimeout(next, radarIndex === radarFrames().length - 1 ? 1500 : 700);
  };
  next();
}

function renderRadar() {
  const radar = radarProduct || aviation?.radar;
  const frames = radarFrames();
  if (!frames.length || !radar?.bounds || !map) {
    stopRadar();
    if (radarLayer && map) map.removeLayer(radarLayer);
    radarLayer = null;
    radarUrl = null;
    $('radar-legend').innerHTML = '';
    $('radar-toggle').disabled = false;
    $('radar-time').textContent = radarLoading ? 'Načítám snímky přímo u ČHMÚ…' : radarError ? `Radar: ${radarError}` : 'Radar načteš zapnutím vrstvy.';
    $('radar-playback').hidden = true;
    return;
  }
  if (radarIndex < 0 || radarIndex >= frames.length) radarIndex = frames.length - 1;
  const frame = frames[radarIndex];
  $('radar-toggle').disabled = false;
  $('radar-playback').hidden = false;
  $('radar-play').disabled = radarLoading || frames.length < 2;
  $('radar-index').max = String(frames.length - 1);
  $('radar-index').value = String(radarIndex);
  $('radar-index').setAttribute('aria-valuetext', fullTime(frame.observedAt));
  const stale = radar.status === 'stale' || Date.now() - Date.parse(radar.observedAt) > 20 * 60000;
  $('radar-time').textContent = `${fullTime(frame.observedAt)} · ${radarIndex + 1}/${frames.length}${stale ? ' · poslední dostupný snímek je starší / obnova nepotvrzena' : ''}${radar.error ? ` · ${radar.error}` : ''}`;
  $('map-caption').textContent = `Podklad ZTM ČÚZK pokrývá Česko. Radar: přímé načítání ${frames.length} skutečně dostupných snímků; mezery nejsou doplněny. ${radarLoading ? 'Obnovuji… ' : ''}${radar.displayOnly ? 'Do offline výstupu se zachová čas a odkaz; zdroj nepovoluje vložení obrazu. ' : ''}Nezávisí na vybrané hodině předpovědi.`;
  if (radarFailures.has(frame.url)) {
    if (radarLayer) map.removeLayer(radarLayer);
    radarLayer = null;
    radarUrl = null;
    $('radar-time').textContent = `Snímek ${fullTime(frame.observedAt)} se nepodařilo načíst. Zkus Obnovit nebo jiný snímek.`;
    return;
  }
  if (radarUrl === frame.url && radarLayer) return;
  if (radarLayer) map.removeLayer(radarLayer);
  const layer = window.L.imageOverlay(frame.url, radar.bounds, { opacity: 0.65, attribution: 'Radar: ČHMÚ · CC BY 4.0', interactive: false });
  radarLayer = layer;
  radarUrl = frame.url;
  layer.on('error', () => { if (radarLayer !== layer) return; stopRadar(); radarFailures.set(frame.url, true); $('radar-time').textContent = `Snímek ${fullTime(frame.observedAt)} se nepodařilo načíst. Zkus Obnovit nebo jiný snímek.`; map.removeLayer(layer); radarLayer = null; radarUrl = null; });
  if ($('radar-toggle').checked) radarLayer.addTo(map);
  if ($('radar-legend').querySelector('img')?.getAttribute('src') !== radar.legendUrl) $('radar-legend').innerHTML = radar.legendUrl ? `<img src="${esc(radar.legendUrl)}" alt="Barevná stupnice radarové odrazivosti dBZ a orientační intenzity srážek mm/h" loading="lazy"><p class="chart-caption">ČHMÚ · pseudo-CAPPI 2 km. Bez obrazu nelze usuzovat na nepřítomnost srážek.</p>` : '';
}

function updateOutputAvailability() {
  const busy = preparing || loading || aviationLoading;
  for (const id of ['prepare-output','save-briefing']) {
    $(id).disabled = busy;
    $(id).title = aviationLoading ? 'Čekám na přímé načtení leteckých zpráv.' : loading ? 'Čekám na předpověď.' : 'Otevřít zachycený briefing';
  }
}

async function loadRadar(full = false, outerSignal = null) {
  if (radarPending) {
    await radarPending;
    if (full && !radarHistoryLoaded && !outerSignal?.aborted) return loadRadar(true, outerSignal);
    return {ok:!radarError,error:radarError};
  }
  const oldFrames=radarFrames(), selected=oldFrames[radarIndex], latestSelected=radarIndex<0||radarIndex>=oldFrames.length-1;
  radarLoading=true; radarError=null; renderRadar();
  const work=(async()=>{
    try {
      const signal=outerSignal?AbortSignal.any([outerSignal,AbortSignal.timeout(35000)]):AbortSignal.timeout(35000);
      const payload=await fetchRadar({signal,previous:radarProduct,frameLimit:full||radarHistoryLoaded?24:4});
      radarProduct=payload;
      if(aviation) aviation.radar=payload;
      radarHistoryLoaded=radarHistoryLoaded||full;
      radarIndex=latestSelected?-1:payload.frames.findIndex(frame=>frame.observedAt===selected?.observedAt);
      radarError=['unavailable','stale'].includes(payload.status)?payload.error||'Nový snímek není potvrzen.':null;
      return {ok:!radarError,error:radarError};
    }catch(error){radarError=error.message;return {ok:false,error:error.message};}
    finally {radarLoading=false;renderRadar();}
  })();
  radarPending=work;
  try{return await work;}finally{if(radarPending===work)radarPending=null;}
}

async function loadAviation(force = false, outerSignal = null) {
  const id = ++aviationRequestId;
  aviationLoading=true; updateOutputAvailability(); renderReportFreshness();
  try {
    const signal = outerSignal ? AbortSignal.any([outerSignal, AbortSignal.timeout(60000)]) : AbortSignal.timeout(60000);
    const payload = await fetchBrowserAviation({previous:aviation,signal});
    if (id !== aviationRequestId) return { ok: true };
    payload.radar=radarProduct;
    aviation = payload;
    const failed=['metar','taf'].filter(key=>payload[key]?.transportStatus!=='ok');
    aviationLoadError=failed.length?failed.map(key=>`${key.toUpperCase()}: ${payload[key]?.error||'obnova nebyla úplná'}`).join(' '):null;
    const cached=writeAviationCache(payload); historyCacheError=cached.ok?null:cached.error;
    renderReports(); renderHistory();
    return {ok:!aviationLoadError,error:aviationLoadError};
  } catch (error) {
    if (id !== aviationRequestId || outerSignal?.aborted) return { ok: false, error: 'Požadavek byl zrušen.' };
    aviationLoadError = error.message;
    if (aviation) {
      for(const key of ['metar','taf','sigmet']) if(aviation[key]) aviation[key]={...aviation[key],status:'stale',transportStatus:'unavailable',error:error.message};
      renderReports();
    } else {
      $('reports-status').innerHTML = `<p class="feed-error">Zprávy se nepodařilo načíst: ${esc(error.message)}. Použij oficiální zdroj.</p>`;
      $('reports-meta').textContent = 'Zprávy nedostupné. Žádné náhradní zprávy se nevytvářejí.';
      $('sigmets').innerHTML = '<p class="feed-error">Aktuální SIGMET není potvrzen.</p>';
      $('nearby-observations').innerHTML='<p class="nearby-source-warning">Regionální pozorování nejsou dostupná. Žádné náhradní zprávy se nevytvářejí.</p>';
      $('significant-status').textContent='SIGMET · aktuálnost nepotvrzena'; $('significant-status').dataset.tone='warn';
    }
    renderHistory(); return {ok:false,error:error.message};
  } finally {if(id===aviationRequestId){aviationLoading=false;updateOutputAvailability();renderReportFreshness();}}
}

async function loadForecast(force = false, outerSignal = null) {
  const id = ++requestId;
  if (controller) controller.abort();
  controller = new AbortController();
  const signal = outerSignal ? AbortSignal.any([controller.signal, outerSignal]) : controller.signal;
  const keep = forecast?.model === state.model && forecast?.requestedLocation?.lat === state.lat && forecast?.requestedLocation?.lon === state.lon && Date.now() - Date.parse(forecast.retrievedAt) < 6 * 3600000;
  if (!keep) forecast = null;
  if (!keep || comparison?.model !== state.compare) comparison = null;
  loadError = null;
  compareError = null;
  loading = true;
  updateControls();
  renderSummary();
  renderStatus();
  if (!keep) renderCharts();
  renderVerticalProfile();
  const params = { lat: state.lat, lon: state.lon, signal, force };
  const [main, other] = await Promise.allSettled([
    fetchForecast({ ...params, model: state.model }),
    state.compare ? fetchForecast({ ...params, model: state.compare }) : Promise.resolve(null),
  ]);
  if (id !== requestId) return { ok: true };
  loading = false;
  if (main.status === 'fulfilled') forecast = main.value;
  else if (main.reason?.name !== 'AbortError') loadError = main.reason?.message || 'Zdroj není dostupný';
  if (other.status === 'fulfilled') comparison = other.value;
  else if (other.reason?.name !== 'AbortError') compareError = other.reason?.message || 'Zdroj není dostupný';
  renderContext();
  const failure = main.status === 'rejected' ? main.reason : forecast?.transport?.error;
  return { ok: Boolean(forecast && !loadError && !forecast.transport.stale), error: failure?.message || loadError, retryAt: failure?.retryAt ? Date.parse(failure.retryAt) : undefined };
}

const CLOUD_BROWSER_LIMIT = 'Přímý zdroj DWD neposkytuje tomuto webu přístup k nativním datům. CEILING zde není načítán; hodnotu nenahrazujeme pokrytím oblačnosti ani odhadem.';
clouds = {schemaVersion:1,status:'unavailable',model:'ICON-D2',product:'CEILING',units:'m MSL',points:[],frames:[],runTime:null,retrievedAt:null,sourceUrl:'https://opendata.dwd.de/weather/nwp/v1/m/icon-d2/p/CEILING/',error:CLOUD_BROWSER_LIMIT};

function renderVerticalProfile() {
  const result=profileAt(forecast,state.time);
  $('profile-meta').textContent = `${definition().label} · ${result.validAt ? `vzorek ${fullTime(result.validAt)}` : 'hodinový vzorek není dostupný'}${forecast?.retrievedAt ? ` · staženo ${fullTime(forecast.retrievedAt)}` : ''}${forecast?.transport?.stale ? ' · STARŠÍ PŘEDPOVĚĎ' : ''}. ${state.model==='icon'?'925 a 800 hPa jsou interpolovány poskytovatelem mezi sousedními hladinami.':''}`;
  $('profile').innerHTML=renderProfile(forecast,state.time,{width:plotWidth('profile',40)});
}
function renderSatellitePanel() {
  const html=renderSatellite(satellite,{...state,error:satelliteError});
  $('satellite').innerHTML=html;
  $('satellite-enlarge').disabled=!satelliteState(satellite).image;
  if ($('satellite-dialog').open) $('satellite-large').innerHTML=html;
}
async function loadSatellite(force=false,signal) {
  const sequence=++satelliteSequence;
  try {
    const data=await fetchSatellite({signal});
    if(sequence!==satelliteSequence||signal?.aborted)return {ok:false};
    if(satelliteState(satellite).image&&Date.parse(satellite.observedAt)>Date.parse(data.observedAt)) {
      satelliteError='Nejnovější rámec nebyl potvrzen; zachován novější skutečný snímek z tohoto prohlížeče.';
      satellite={...satellite,status:'stale'};renderSatellitePanel();return {ok:false,error:satelliteError};
    }
    satellite=data;satelliteError=null;renderSatellitePanel();return {ok:true};
  }catch(error){if(signal?.aborted)return {ok:false};if(sequence===satelliteSequence){satelliteError=error.message;if(satellite)satellite={...satellite,status:'stale'};renderSatellitePanel();}return {ok:false,error:error.message};}
}

function selectedClouds() {
  return queryClouds(clouds, { lat: state.lat, lon: state.lon, time: state.time });
}

function renderClouds() {
  routeWorkspace.sync();
  renderVerticalProfile();
  renderSatellitePanel();
  const result = selectedClouds();
  $('cloud-reading').innerHTML = `${esc(num(result.valueMsl))} <span>m MSL</span>`;
  $('cloud-status').textContent = `${CLOUD_STATUS_LABELS[result.status] || 'Nedostupný výstup.'}${result.stale ? ' Běh je starší nebo jeho obnova selhala.' : ''}${cloudError ? ` Obnova: ${cloudError}` : result.error ? ` ${result.error}` : ''}`;
  $('cloud-status').dataset.state = result.stale || cloudError || result.status !== 'available' ? 'attention' : 'ready';
  $('cloud-meta').textContent = result.runTime ? `DWD · ICON-D2 · nativní síť · běh ${fullTime(result.runTime)} · vzorek ${result.validAt ? fullTime(result.validAt) : '—'} · staženo ${fullTime(result.retrievedAt)}${result.cell ? ` · buňka ${result.cell.lat.toFixed(4)}, ${result.cell.lon.toFixed(4)} (${num(result.distanceKm, 2)} km od bodu), terén modelu ${v(result.cell.elevationMsl, 'm MSL')}` : ''}.` : 'V této čistě prohlížečové verzi je produkt nedostupný. Letištní pozorovaný ceiling je ve zprávách; nemá stejný význam jako modelový CEILING.';
  const start = Date.parse(chartTimes()[0] || new Date(Math.floor(Date.now() / 3600000) * 3600000).toISOString());
  const indices = result.series.times.map((time, index) => ({ time, index })).filter(item => Date.parse(item.time) >= start && Date.parse(item.time) < start + state.hours * 3600000);
  $('cloud-chart').innerHTML = result.status === 'unavailable' ? '<p class="source-unavailable">Nativní modelový graf není dostupný. <a href="https://opendata.dwd.de/weather/nwp/v1/m/icon-d2/p/CEILING/" target="_blank" rel="noopener noreferrer">Původní data DWD ↗</a></p>' : renderChart({ times: indices.map(item => item.time), series: [{ label: 'ICON-D2 · CEILING', color: 'var(--chart-amber)', unit: 'm MSL', values: indices.map(item => result.series.values[item.index]) }], selectedTime: state.time, timezone: state.timezone, width: plotWidth('cloud-chart'), height: 210, yLabel: 'm MSL', min: 0 });
}

function updatePreview() {
  if (!previewSnapshot) return;
  const when=iso=>`${clock(iso,previewSnapshot.state.timezone,true)} ${previewSnapshot.state.timezone==='UTC'?'UTC':'CZ'}`;
  $('preview-context').textContent=`${previewSnapshot.state.name} · přehled ${when(previewSnapshot.state.time)} · zachyceno ${when(previewSnapshot.createdAt)} · zdroje se v tomto náhledu neobnovují`;
  $('preview-feedback').textContent=previewMode==='reports'?'Výpis obsahuje originální METAR, TAF a SIGMET včetně platnosti a chybějících zpráv.':'Celý briefing obsahuje grafy, pozorování, obrazové zdroje a poznámky. Přesná hodinová příloha zůstává v HTML, standardní tisk ji vynechá.';
  $('copy-fallback').hidden=true;
  $('preview-print').disabled=true;
  $('saved-preview-frame').srcdoc=renderBriefingHtml(previewSnapshot,{mode:previewMode});
  document.querySelectorAll('[data-output-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.outputMode===previewMode)));
}
function openPreview(snapshot) {
  previewSnapshot=snapshot;previewMode='full';updatePreview();
  $('saved-preview').showModal();
}
$('saved-preview-frame').addEventListener('load',()=>{
  const body=$('saved-preview-frame').contentDocument?.body;
  $('preview-print').disabled=!body||body.classList.contains('reports-only')!==(previewMode==='reports');
});

function downloadBriefing(snapshot, mode='full') {
  const html = renderBriefingHtml(snapshot,{mode});
  const href = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = href;
  link.download = briefingFilename(snapshot,{mode});
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 60000);
}

async function renderArchive() {
  try {
    const items = await listBriefings();
    $('archive-list').innerHTML = items.length ? items.map(item => `<article class="archive-item"><div class="archive-item-title">${esc(item.title)}</div><p class="archive-item-meta">Uloženo ${esc(fullTime(item.createdAt))} · data a poznámky zachyceny v souboru</p><div class="archive-buttons"><button class="button button-quiet" type="button" data-archive-open="${esc(item.id)}">Zobrazit</button><button class="button button-quiet" type="button" data-archive-download="${esc(item.id)}">Stáhnout HTML</button><button class="button button-quiet" type="button" data-archive-remove="${esc(item.id)}" aria-label="Odstranit místní briefing ${esc(item.title)}">Odebrat z prohlížeče</button></div></article>`).join('') : '<p class="muted">Zatím žádný uložený briefing.</p>';
  } catch (error) { $('archive-status').textContent = error.message; }
}

async function saveCurrentBriefing() {
  if (preparing) return;
  stopRadar();
  if (loading || aviationLoading) { $('archive-status').textContent = 'Předpověď nebo letecké zprávy se právě obnovují. Počkej na dokončení a potom připrav briefing.'; return; }
  const radar = radarProduct || aviation?.radar;
  const frame = radarFrames()[radarIndex];
  const imageMatches = radar?.imageFetchStatus === 'ok' && radar.imageObservedAt === (frame?.observedAt || radar.observedAt) && radar.imageUrl === (frame?.url || radar.url);
  let capturedAviation = aviation;
  if (aviation && frame) {
    capturedAviation = structuredClone(aviation);
    capturedAviation.radar.latestObservedAt = radar.observedAt;
    capturedAviation.radar.url = frame.url;
    capturedAviation.radar.observedAt = frame.observedAt;
    capturedAviation.radar.selectedFrame = frame;
  }
  try {
    preparing = true;
    $('prepare-output').disabled = true; $('save-briefing').disabled = true;
    $('archive-status').textContent = 'Připravuji zachycený briefing a obrazové zdroje…';
    const baseSnapshot = createBriefingSnapshot({ state: {...state, historyStation}, route: routeWorkspace.snapshot(), forecast, comparison, aviation: capturedAviation, astronomy: getAstronomy({ lat: state.lat, lon: state.lon, date: new Date(state.time) }), notes: $('notes').value, clouds: selectedClouds(), satellite, radarImageDataUrl: imageMatches ? radar.imageDataUrl : null, sourceErrors: { forecast: loadError, aviation: aviationLoadError, comparison: compareError, clouds: cloudError, satellite: satelliteError } });
    const capturedImages = await imagery.capture(baseSnapshot.state.time);
    const snapshot = createBriefingSnapshot({...baseSnapshot, ...capturedImages, createdAt:new Date().toISOString()});
    let storageError = null;
    try { await saveBriefing(snapshot); } catch (error) { storageError = error.message; }
    openPreview(snapshot);
    $('archive-status').textContent = `Briefing zachycen ${fullTime(snapshot.createdAt)} a otevřen k prohlédnutí. HTML stáhneš nebo vytiskneš z náhledu. ${storageError ? `Místní archiv: ${storageError}` : 'Kopie je uložena také v tomto prohlížeči.'}${radar && !imageMatches ? ' Vybraný radarový obraz není vložen; zachovány jsou jeho čas a zdroj.' : ''}`;
    renderArchive();
  } catch (error) { $('archive-status').textContent = `Briefing se nepodařilo uložit: ${error.message}`; } finally { preparing = false; updateOutputAvailability(); }
}

function tickFreshness(nowMs, status) {
  const previousSample = forecast ? nearestTimeIndex(forecast.times, state.time) : -1;
  if (liveMode && document.activeElement !== $('inspection-time')) {
    state.time = new Date(nowMs).toISOString();
    updateControls();
    renderSummary();
    renderStatus();
    renderAstronomy();
    renderClouds();
    if (forecast && previousSample !== nearestTimeIndex(forecast.times, state.time)) {
      renderCharts();
      if (aviation) renderReports();
    }
  }
  document.querySelectorAll('[data-age]').forEach(element => { element.textContent = ageLabel(element.dataset.age, nowMs); });
  document.querySelectorAll('[data-report-status]').forEach(element => {
    const type = element.dataset.reportStatus;
    const item = aviation?.[type === 'METAR' ? 'metar' : 'taf']?.items?.find(report => String(report.id) === element.dataset.reportId);
    const result = reportState(item, type === 'TAF' ? Date.parse(state.time) : nowMs);
    element.textContent = `${type === 'METAR' && result.tone === 'neutral' ? 'Pozorování' : result.label}${type === 'TAF' ? ' · pro čas přehledu' : ''}`;
    element.dataset.tone = result.tone;
  });
  document.querySelectorAll('[data-period-start]').forEach(row => {
    const start = Date.parse(row.dataset.periodStart);
    const end = Date.parse(row.dataset.periodEnd);
    const selected = Number.isFinite(start) && Number.isFinite(end) && Date.parse(state.time) >= start && Date.parse(state.time) < end;
    row.dataset.selected = String(selected);
    const label = row.querySelector('.taf-selected-label');
    if (label) label.hidden = !selected;
  });
  if (!liveMode || document.activeElement === $('inspection-time')) renderSatellitePanel();
  renderReportFreshness();
  if (aviation) { renderSigmets(); renderRadar(); }
  const minutes = status.nextRefreshAt === null ? null : Math.max(0, Math.ceil((status.nextRefreshAt - nowMs) / 60000));
  $('freshness-meta').textContent = !status.online ? 'Offline · automatické požadavky jsou pozastavené. Zobrazená data si uchovávají původní časy.' : !status.visible ? 'Automatická kontrola se obnoví po návratu na stránku.' : status.refreshing ? 'Obnovuji data přímo u poskytovatelů…' : `Přímé zdroje · předpověď po 10 min · pozorování po 5 min · další kontrola ${minutes === 0 ? 'nyní' : `za ${minutes ?? '—'} min`}${status.products.forecast.error || status.products.aviation.error ? ' · poslední obnova měla chybu; časy zdrojů zůstávají původní' : ''}.`;
}

function renderContext() {
  updateControls();
  renderSummary();
  renderStatus();
  renderCharts();
  renderAstronomy();
  renderClouds();
  if (aviation) renderReports();
  writeUrl();
}

function selectTime(iso, follow = false) {
  const activeChart=document.activeElement?.closest('[data-chart-card]')?.dataset.chartCard;
  if (!Number.isFinite(Date.parse(iso))) return;
  liveMode = follow;
  monitor?.setLive(follow);
  state.time = new Date(iso).toISOString();
  renderContext();
  const selectedCard=activeChart?$('charts').querySelector(`[data-chart-card="${activeChart}"]`):null;
  $('selection-announcement').textContent = selectedCard ? `${selectedCard.querySelector('.chart-title').textContent}: ${selectedCard.querySelector('.chart-value').textContent}. ${selectedCard.querySelector('.chart-sample').textContent}.` : `${definition().label}, čas přehledu ${fullTime(state.time)}, ${follow?'živě':'připnuto'}.`;
}

function choosePlace(lat, lon, name, place = 'custom') {
  Object.assign(state, { lat, lon, name, place });
  if (pointMarker) { pointMarker.setLatLng([lat, lon]); map.panTo([lat, lon]); }
  renderAstronomy();
  renderClouds();
  if (aviation) { renderReports(); renderHistory(); }
  writeUrl();
  loadForecast();
}

$('radar-toggle').addEventListener('change',()=>{if($('radar-toggle').checked) imagery.hideLowCloud();});
$('models').addEventListener('click', (event) => {
  const model = event.target.closest('[data-model]')?.dataset.model;
  if (!model || model === state.model) return;
  if (state.compare === model) state.compare = state.model;
  state.model = model;
  loadForecast();
});
$('location').addEventListener('change', (event) => {
  if (event.target.value === 'edit') { placeControls.update(); placeControls.open(); return; }
  if (event.target.value.startsWith('point:')) { placeControls.choose(event.target.value); return; }
  const place = PLACES[event.target.value];
  if (place) choosePlace(place.lat, place.lon, place.name, event.target.value);
});
$('inspection-time').addEventListener('change', (event) => {
  const iso = fromDateTimeInput(event.target.value, state.timezone);
  if (iso) { event.target.setCustomValidity(''); selectTime(iso); }
  else { event.target.setCustomValidity('Tento čas neexistuje nebo není platný. Ověř změnu letního času.'); event.target.reportValidity(); }
});
$('now').addEventListener('click', () => selectTime(new Date().toISOString(), true));
$('live-mode').addEventListener('click', () => selectTime(liveMode ? state.time : new Date().toISOString(), !liveMode));
$('time-slider').addEventListener('input', (event) => { if (forecast) selectTime(forecast.times[Number(event.target.value)]); });
$('horizon').addEventListener('click', (event) => { const hours = Number(event.target.closest('[data-hours]')?.dataset.hours); if ([24, 48, 72].includes(hours)) { state.hours = hours; renderContext(); } });
$('compare').addEventListener('change', (event) => { state.compare = event.target.value; loadForecast(); });
$('zone').addEventListener('click', () => { state.timezone = state.timezone === 'UTC' ? 'Europe/Prague' : 'UTC'; renderContext(); if (aviation) { renderReports(); renderHistory(); } });
$('refresh').addEventListener('click', () => { void monitor.refresh('manual'); });
function syncThemeControl(){
 const dark=document.documentElement.dataset.theme==='dark';
 $('theme').setAttribute('aria-pressed',String(dark));
 $('theme').setAttribute('aria-label',dark?'Přepnout denní vzhled':'Přepnout noční vzhled');
 $('theme').title=dark?'Denní vzhled':'Noční vzhled';
}
$('theme').addEventListener('click', () => { const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = theme; persist('theme', theme); syncThemeControl(); });
$('notes').addEventListener('input', (event) => persist('notes', event.target.value));
$('print').addEventListener('click', () => { stopRadar(); $('print-notes').textContent = $('notes').value; updateControls(); window.print(); });
$('share').addEventListener('click', async () => {
  const url = new URL(location.href);
  url.search = sharedSearch(state);
  $('share-feedback').textContent = '';
  $('share-fallback').hidden = true;
  try { await navigator.clipboard.writeText(url.href); $('share-feedback').textContent = 'Odkaz s pevným časem byl zkopírován. Data se po otevření načtou znovu; nejde o uložený briefing.'; }
  catch { $('share-link').value = url.href; $('share-fallback').hidden = false; $('share-feedback').textContent = 'Prohlížeč nepovolil kopírování. Zkopíruj připravený odkaz s pevným časem.'; $('share-link').focus(); $('share-link').select(); }
});
function previewChartTime(time) {
  for (const card of $('charts').querySelectorAll('[data-chart-card]')) {
    const label = card.querySelector('.chart-hover-value');
    const svg = card.querySelector('svg');
    svg?.querySelector('.chart-preview-cursor')?.remove();
    if (!label) continue;
    label.hidden = !time;
    if (!time || !svg || !forecast) continue;
    const chart = CHARTS.find(item => item.id === card.dataset.chartCard);
    label.textContent = `Náhled ${clock(time,state.timezone)} · ` + chart.fields.map(([key,name]) => {
      const value = at(forecast,key,time);
      return `${name}: ${v(value == null ? null : value / (chart.divisor || 1),chart.unit,1)}`;
    }).join(' · ');
    const hit = [...svg.querySelectorAll('[data-time]')].find(element => element.dataset.time === time);
    if (!hit) continue;
    const line = document.createElementNS('http://www.w3.org/2000/svg','line');
    const x = Number(hit.getAttribute('x')) + Number(hit.getAttribute('width')) / 2;
    for (const [key,value] of Object.entries({x1:x,x2:x,y1:Number(svg.dataset.plotTop)||18,y2:Number(svg.dataset.plotBottom)||140,class:'chart-preview-cursor',stroke:'var(--teal)','stroke-width':1.5,'pointer-events':'none'})) line.setAttribute(key,value);
    svg.append(line);
  }
}
$('charts').addEventListener('pointermove', event => { if (event.pointerType === 'touch') return; const time = event.target.closest('[data-time]')?.dataset.time; previewChartTime(time || null); });
$('charts').addEventListener('pointerleave', () => previewChartTime(null));
$('charts').addEventListener('click', (event) => { const time = event.target.closest('[data-time]')?.dataset.time; if (time) selectTime(time); });
$('charts').addEventListener('keydown', (event) => {
  if (!forecast || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  const id = event.target.closest('[data-chart-card]')?.dataset.chartCard;
  const index = Math.max(0, nearestTimeIndex(forecast.times, state.time));
  selectTime(forecast.times[Math.max(0, Math.min(forecast.times.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)))]);
  if (id) document.querySelector(`[data-chart-card="${id}"] .chart-surface`)?.focus({ preventScroll: true });
});
$('reports').addEventListener('click', (event) => { const station = STATIONS.find((s) => s.id === event.target.closest('[data-station]')?.dataset.station); if (station) choosePlace(station.lat, station.lon, `${station.id} · ${station.name}`); });
$('gps').addEventListener('click', () => {
  if (!navigator.geolocation) { $('map-caption').textContent = 'Tento prohlížeč polohu neposkytuje.'; return; }
  $('gps').disabled = true;
  navigator.geolocation.getCurrentPosition((position) => { $('gps').disabled = false; choosePlace(position.coords.latitude, position.coords.longitude, 'Moje poloha'); }, () => { $('gps').disabled = false; $('map-caption').textContent = 'Polohu se nepodařilo získat. Vyber místo v mapě nebo záhlaví.'; }, { timeout: 10000, maximumAge: 60000 });
});
$('radar-toggle').addEventListener('change', event => { if (!map) return; if (event.target.checked) { const frame = radarFrames()[radarIndex]; if (frame) radarFailures.delete(frame.url); renderRadar(); if (radarLayer) radarLayer.addTo(map); void loadRadar(radarHistoryLoaded); } else { stopRadar(); if (radarLayer) map.removeLayer(radarLayer); } });
$('radar-play').addEventListener('click', async () => {if(radarPlaying){stopRadar();return;}if(!radarHistoryLoaded){$('radar-play').disabled=true;await loadRadar(true);}playRadar();});
$('radar-index').addEventListener('input', event => { stopRadar(); radarIndex = Number(event.target.value); renderRadar(); });
$('radar-latest').addEventListener('click', () => { stopRadar(); radarIndex = -1; renderRadar(); void loadRadar(radarHistoryLoaded); });
$('history-station').addEventListener('change', event => { historyStation = event.target.value; renderHistory(); });
$('report-view').addEventListener('click', event => { const view = event.target.closest('[data-report-view]')?.dataset.reportView; if (!['both', 'summary', 'raw'].includes(view)) return; reportView = view; persist('report-view', view); updateControls(); renderReports(); });
$('save-briefing').addEventListener('click', saveCurrentBriefing);
$('prepare-output').addEventListener('click',saveCurrentBriefing);
$('archive-list').addEventListener('click', async event => {
  try {
    const openId = event.target.closest('[data-archive-open]')?.dataset.archiveOpen;
    const downloadId = event.target.closest('[data-archive-download]')?.dataset.archiveDownload;
    const removeId = event.target.closest('[data-archive-remove]')?.dataset.archiveRemove;
    if (openId) { const snapshot=await loadBriefing(openId); if (!snapshot) throw new Error('Briefing už není v archivu.'); openPreview(snapshot); }
    if (downloadId) { const snapshot = await loadBriefing(downloadId); if (!snapshot) throw new Error('Briefing už není v archivu.'); downloadBriefing(snapshot); }
    if (removeId) { await deleteBriefing(removeId); await renderArchive(); $('archive-status').textContent = 'Místní kopie odebrána. Již stažený soubor zůstává zachován.'; }
  } catch (error) { $('archive-status').textContent = error.message; }
});
$('satellite-enlarge').addEventListener('click',()=>{renderSatellitePanel();$('satellite-large').innerHTML=$('satellite').innerHTML;$('satellite-dialog').showModal();});
$('satellite-close').addEventListener('click',()=>$('satellite-dialog').close());
$('preview-close').addEventListener('click', () => $('saved-preview').close());
$('preview-download').addEventListener('click', () => { if (previewSnapshot) downloadBriefing(previewSnapshot,previewMode); });
$('output-mode').addEventListener('click',event=>{const mode=event.target.closest('[data-output-mode]')?.dataset.outputMode;if(!['full','reports'].includes(mode)||mode===previewMode)return;previewMode=mode;updatePreview();});
$('preview-copy').addEventListener('click',async()=>{
  if(!previewSnapshot)return;
  const text=renderBriefingText(previewSnapshot,{mode:previewMode});
  try{await navigator.clipboard.writeText(text);$('preview-feedback').textContent='Text zachyceného briefingu zkopírován. Sám se neaktualizuje.';}
  catch{$('copy-fallback').hidden=false;$('copy-text').value=text;$('copy-text').focus();$('copy-text').select();$('copy-text').scrollTop=0;$('preview-feedback').textContent='Prohlížeč nepovolil přístup ke schránce. Zkopíruj vybraný text ručně.';}
});
$('preview-print').addEventListener('click', () => $('saved-preview-frame').contentWindow?.print());
$('cloud-chart').addEventListener('click', event => { const time = event.target.closest('[data-time]')?.dataset.time; if (time) selectTime(time); });
window.addEventListener('beforeprint', () => { stopRadar(); $('print-notes').textContent = $('notes').value; updateControls(); });
window.addEventListener('popstate', () => { if (location.search !== navigationSearch) location.reload(); });

$('radar-toggle').checked = true;
updateControls();
renderSummary();
renderAstronomy();
document.querySelectorAll('[data-boot-controls]').forEach(group=>{group.disabled=false;});
mountWorkspaceNavigation();
initMap();
renderArchive();
renderClouds();
if(aviation){renderReports();renderHistory();}
monitor = createMonitor({
  onTick: tickFreshness,
  onRefresh: async ({ forecast: refreshForecast, aviation: refreshAviation, signal, reason }) => {
    if (reason === 'manual') radarFailures.clear();
    const tasks = [];
    if (refreshForecast) { tasks.push(loadForecast(true, signal).then(result => ['forecast', result])); void routeWorkspace.refresh(reason === 'manual'); }
    if (refreshAviation) tasks.push(Promise.all([loadAviation(true, signal), loadSatellite(true, signal), imagery.refresh(true, signal), $('radar-toggle').checked?loadRadar(radarHistoryLoaded,signal):Promise.resolve({ok:true})]).then(([reports,image,extra,radar])=>['aviation',reports.ok&&image.ok&&extra.ok&&radar.ok?{ok:true}:{ok:false,error:reports.error||image.error||extra.error||radar.error}]));
    return Object.fromEntries(await Promise.all(tasks));
  },
});
monitor.setLive(liveMode);
monitor.start();
void monitor.refresh('initial');
document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') stopRadar(); void monitor.wake('visibility'); });
window.addEventListener('focus', () => { void monitor.wake('focus'); });
window.addEventListener('online', () => { void monitor.wake('online'); });
window.addEventListener('offline', () => { void monitor.wake('offline'); });
window.addEventListener('pagehide', () => { stopRadar(); monitor.stop(); routeWorkspace.stop(); });
window.addEventListener('pageshow', () => { if (!monitor.getState().active) { monitor.start(); void monitor.wake('pageshow'); void routeWorkspace.refresh(); } });

let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { renderCharts(); renderClouds(); renderAstronomy(); if (aviation) renderHistory(); map?.invalidateSize(); }, 180); });
