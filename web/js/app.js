import { MODELS, fetchForecast, nearestTimeIndex } from './weather.js';
import { renderChart, escapeHtml as esc } from './charts.js';
import { getAstronomy } from './astro.js';
import { formatNumber as num, formatTime as clock, ageLabel, reportState, toDateTimeInput, fromDateTimeInput, parseSharedState, haversineKm } from './briefing.js';

const $ = (id) => document.getElementById(id);
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
const shared = parseSharedState(location.search);
const state = {
  place: 'lkcs', ...PLACES.lkcs, model: 'aladin', compare: '', hours: 48,
  timezone: 'Europe/Prague', time: new Date().toISOString(), ...shared,
};
if (shared.lat != null || shared.lon != null) state.place = 'custom';
if (state.compare === state.model) state.compare = '';
let forecast = null;
let comparison = null;
let aviation = null;
let controller = null;
let requestId = 0;
let map = null;
let pointMarker = null;
let radarLayer = null;
let stationsLayer = null;
let loadError = null;
let loading = false;
let compareError = null;
let aviationRequestId = 0;
let aviationLoadError = null;
let radarUrl = null;

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

function writeUrl() {
  const url = new URL(location.href);
  url.search = new URLSearchParams({ lat: state.lat.toFixed(5), lon: state.lon.toFixed(5), name: state.name, model: state.model, compare: state.compare, time: state.time, hours: String(state.hours), timezone: state.timezone }).toString();
  history.replaceState(null, '', url);
}

function updateControls() {
  $('location').value = state.place;
  $('location').querySelector('[value="custom"]').hidden = state.place !== 'custom';
  $('location').querySelector('[value="custom"]').textContent = state.name;
  document.querySelectorAll('[data-model]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.model === state.model)));
  document.querySelectorAll('[data-hours]').forEach((button) => button.setAttribute('aria-pressed', String(Number(button.dataset.hours) === state.hours)));
  $('inspection-time').value = toDateTimeInput(state.time, state.timezone);
  $('input-zone').textContent = state.timezone === 'UTC' ? 'UTC' : 'CZ';
  $('zone').textContent = `Čas: ${state.timezone === 'UTC' ? 'UTC' : 'CZ'}`;
  $('compare').value = state.compare;
  [...$('compare').options].forEach((option) => { option.disabled = option.value === state.model; });
  $('selected-label').textContent = fullTime(state.time);
  $('place-title').textContent = state.name;
  $('context-line').textContent = `${state.lat.toFixed(4)}° N, ${state.lon.toFixed(4)}° E · ${definition().label} · ${fullTime(state.time)}`;
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
  { id: 'upper', title: 'Vítr v hladině 925 hPa', unit: 'kt', fields: [['wind925', '925 hPa', 'var(--chart-blue)']], min: 0, note: 'Tlaková hladina, nikoli pevná výška AGL. U ICON-D2 není 925 hPa nativní hladina; ECMWF 9 km tento výstup neposkytuje.' },
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
    return `<article class="chart-card" data-chart-card="${chart.id}"><div class="chart-header"><h3 class="chart-title">${chart.title}</h3><span class="chart-unit">${chart.unit}</span></div><div class="chart-value">${esc(selectedValues)}</div><div class="chart-surface" tabindex="0" role="group" aria-label="${esc(chart.title)}. ${esc(sampleLabel)}. Šipkami změň hodinu.">${renderChart({ times, series, selectedTime: state.time, timezone: state.timezone, height: 250, yLabel: chart.unit, min: chart.min, max: chart.max })}</div><div class="chart-legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.label)}${s.dash ? ' · přerušovaně' : ''}</span>`).join('')}</div><p class="chart-caption">${esc(sampleLabel)}. ${chart.note}</p></article>`;
  }).join('');
  $('comparison').hidden = !state.compare;
  if (state.compare) $('comparison').innerHTML = comparison
    ? `<div class="comparison-item"><strong>${esc(forecast.label)}</strong> ${esc(v(at(forecast, 'wind'), 'kt'))} · ${esc(v(at(forecast, 'visibility') == null ? null : at(forecast, 'visibility') / 1000, 'km', 1))}</div><div class="comparison-item"><strong>${esc(comparison.label)} · přerušovaně</strong> ${esc(v(at(comparison, 'wind'), 'kt'))} · ${esc(v(at(comparison, 'visibility') == null ? null : at(comparison, 'visibility') / 1000, 'km', 1))}${comparison.transport.stale ? ' · STARŠÍ CACHE' : ''}</div>`
    : `<p>${esc(compareError ? `Porovnání není dostupné: ${compareError}` : 'Načítání druhého modelu…')}</p>`;
}

function renderAstronomy() {
  const astro = getAstronomy({ lat: state.lat, lon: state.lon, date: new Date(state.time) });
  const event = (time) => time ? clock(time.toISOString(), state.timezone) : 'bez události';
  $('astronomy').innerHTML = `<div class="light-grid">${[['Svítání · civilní', astro.dawn], ['Východ Slunce', astro.sunrise], ['Západ Slunce', astro.sunset], ['Soumrak · civilní', astro.dusk]].map(([label, value]) => `<div class="light-item"><span class="label">${label}</span><strong>${event(value)}</strong></div>`).join('')}</div><p class="panel-meta">Délka dne ${v(astro.dayLengthHours, 'h', 1)} · Slunce nyní ve vybraném čase ${v(astro.sunAltitude, '°', 1)}${astro.alwaysUp ? ' · Slunce celý den nad obzorem' : astro.alwaysDown ? ' · Slunce celý den pod obzorem' : ''}.</p><details class="report-details"><summary>Měsíc a podrobnosti</summary><div class="light-grid"><div class="light-item"><span class="label">Fáze</span><strong>${esc(astro.phaseLabel)}</strong></div><div class="light-item"><span class="label">Osvětlená část kotouče</span><strong>${v(astro.moonFraction * 100, '%')}</strong></div><div class="light-item"><span class="label">Východ Měsíce</span><strong>${event(astro.moonrise)}</strong></div><div class="light-item"><span class="label">Západ Měsíce</span><strong>${event(astro.moonset)}</strong></div></div><p class="chart-caption">Výška Měsíce ${v(astro.moonAltitude, '°', 1)}. Osvětlený podíl kotouče není měření světla na zemi.</p></details><p class="chart-caption">Výpočty SunCalc pro den ${clock(astro.dayStart.toISOString(), 'UTC', true).split(' ')[0]} UTC; události zobrazeny v ${state.timezone === 'UTC' ? 'UTC' : 'českém místním čase'}. Polohy odpovídají času přehledu.</p>`;
}

function renderReports() {
  if (!aviation) return;
  const sections = [aviation.metar, aviation.taf].filter(Boolean);
  const ages = sections.map((s) => s.retrievedAt ? fullTime(s.retrievedAt) : 'nedostupné');
  $('reports-meta').textContent = `NOAA Aviation Weather Center · METAR stažen ${ages[0] || '—'} · TAF stažen ${ages[1] || '—'}. Statický balíček se obnovuje plánovanou úlohou přibližně po 20 minutách; rozhoduje čas uvnitř zprávy.`;
  const oldSnapshot = sections.some((s) => !s.retrievedAt || Date.now() - Date.parse(s.retrievedAt) > 60 * 60000);
  $('reports-status').innerHTML = (aviationLoadError ? `<p class="feed-error">Obnova balíčku selhala: ${esc(aviationLoadError)}. Zachovány původní časy zpráv.</p>` : '') + (oldSnapshot ? '<p class="feed-error">Balíček nebyl úspěšně obnoven nejméně hodinu. Ověř zprávy přímo u zdroje; plánovaná úloha mohla být zpožděna.</p>' : '') + sections.filter((s) => ['stale', 'unavailable'].includes(s.status)).map((s) => `<p class="feed-error">${esc(s.status === 'stale' ? 'Obnova zdroje selhala; zachovány starší zprávy.' : 'Zdroj zpráv není dostupný.')} ${esc(s.error || '')}</p>`).join('');
  const itemHtml = (item, type) => {
    if (!item) return `<div class="report-block"><span class="source-badge">${type}</span><p class="muted">V tomto balíčku není zpráva; dostupnost ověř u zdroje. Neznamená to dobré počasí.</p></div>`;
    const status = reportState(item, type === 'TAF' ? Date.parse(state.time) : Date.now());
    const instant = type === 'METAR' ? item.observedAt : item.issuedAt;
    const validity = type === 'TAF' && item.validFrom && item.validTo ? ` · platnost ${fullTime(item.validFrom)}–${fullTime(item.validTo)}` : '';
    const source = item.source || {};
    const metarReadings = type === 'METAR' ? [
      typeof source.wspd === 'number' ? `Vítr ${source.wdir === 'VRB' ? 'VRB' : v(source.wdir, '°')} / ${v(source.wspd, 'kt')}${source.wgst == null ? '' : `, nárazy ${v(source.wgst, 'kt')}`}` : '',
      typeof source.temp === 'number' ? `T ${v(source.temp, '°C', 1)} / Td ${v(source.dewp, '°C', 1)}` : '',
    ].filter(Boolean).join(' · ') : '';
    return `<div class="report-block"><div class="station-meta"><span class="source-badge">${type}</span><span class="tag" data-tone="${esc(status.tone)}">${esc(status.label)}${type === 'TAF' ? ' · pro čas přehledu' : ''}</span></div><p class="station-meta">${instant ? esc(fullTime(instant)) : 'Čas zprávy nedostupný'}${instant ? ` · ${esc(ageLabel(instant))}` : ''}${esc(validity)}</p><pre class="report-raw">${esc(item.raw || 'Zdroj neposkytl originální text.')}</pre>${metarReadings ? `<p class="station-readings">${esc(metarReadings)}</p>` : ''}</div>`;
  };
  $('reports').innerHTML = STATIONS.map((station) => {
    const metar = aviation.metar?.items?.find((i) => i.station === station.id);
    const taf = aviation.taf?.items?.find((i) => i.station === station.id);
    const distance = haversineKm(state.lat, state.lon, station.lat, station.lon);
    return `<article class="station-card"><div class="station-title"><button type="button" class="station-pick" data-station="${station.id}" title="Vybrat místo předpovědi ${station.id}"><strong>${station.id}</strong> ${station.name}</button><span class="muted">${num(distance)} km</span></div>${itemHtml(metar, 'METAR')}${itemHtml(taf, 'TAF')}</article>`;
  }).join('');
  renderSigmets();
  renderRadar();
}

function renderSigmets() {
  const section = aviation?.sigmet;
  if (!section) { $('sigmets').innerHTML = '<p class="feed-error">SIGMET není k dispozici.</p>'; return; }
  const active = (section.items || []).filter((item) => item.validFrom && item.validTo && Date.parse(item.validFrom) <= Date.parse(state.time) && Date.parse(item.validTo) > Date.parse(state.time) && !item.cancelled && !item.nil);
  const old = !section.retrievedAt || Date.now() - Date.parse(section.retrievedAt) > 60 * 60000;
  const status = (['stale', 'unavailable'].includes(section.status) ? `<p class="feed-error">Zdroj SIGMET je ${section.status === 'stale' ? 'starší po chybě obnovy' : 'nedostupný'}. ${esc(section.error || '')}</p>` : '') + (old || aviationLoadError ? '<p class="feed-error">Aktuálnost balíčku SIGMET není potvrzena.</p>' : '');
  const unknown = (section.items || []).filter((item) => !item.validFrom || !item.validTo).length;
  $('sigmets').innerHTML = status + (active.length ? active.map((item) => `<details class="report-details" open><summary>${esc(item.fir || 'SIGMET')} · ${esc(fullTime(item.validTo))}</summary><pre class="report-raw">${esc(item.raw)}</pre></details>`).join('') : `<p class="muted">V balíčku není SIGMET s platností pro vybraný čas a FIR LKAA / LOVV / EDMM / LZBB. Ověř aktuální zdroj; nejde o potvrzení bez výstrah.</p>`) + (unknown ? `<p class="feed-error">${unknown} zpráv má neznámou platnost; nelze určit překryv.</p>` : '') + (Date.parse(state.time) > Date.now() + 3600000 ? '<p class="chart-caption">Aktuální balíček nepředpovídá, jaké výstrahy budou vydány v budoucnu.</p>' : '') + `<p class="chart-caption">SIGMET stažen ${section.retrievedAt ? esc(fullTime(section.retrievedAt)) : '—'}.</p>`;
}

function initMap() {
  if (!window.L) { $('region-map').innerHTML = '<p class="empty-state">Mapovou knihovnu se nepodařilo načíst. Místo lze stále vybrat v záhlaví.</p>'; return; }
  const L = window.L;
  map = L.map('region-map', { scrollWheelZoom: false }).setView([state.lat, state.lon], 8);
  const base = L.tileLayer('https://ags.cuzk.gov.cz/arcgis1/rest/services/ZTM_WM/MapServer/tile/{z}/{y}/{x}', { minZoom: 6, maxZoom: 18, updateWhenIdle: true, keepBuffer: 1, attribution: '<a href="https://geoportal.gov.cz/php/micka/record/basic/CZ-CUZK-AGS-ZTM-MERCATOR">ČÚZK – on-line</a> · <a href="https://cuzk.gov.cz/Predpisy/Podminky-poskytovani-prostor-dat-a-sitovych-sluzeb/Podminky-poskytovani-sitovych-sluzeb-CUZK.aspx">Podmínky</a>' }).addTo(map);
  base.on('tileerror', () => { $('map-caption').textContent = 'Podkladovou mapu se nepodařilo načíst. ZTM ČÚZK pokrývá Česko; bod předpovědi lze vybrat i v záhlaví.'; });
  pointMarker = L.circleMarker([state.lat, state.lon], { radius: 8, color: '#b57722', fillColor: '#f3d497', fillOpacity: 1, weight: 3 }).addTo(map).bindTooltip('Vybrané místo předpovědi');
  stationsLayer = L.layerGroup(STATIONS.map((station) => L.circleMarker([station.lat, station.lon], { radius: 4, color: '#1e6465', fillColor: '#d7edeb', fillOpacity: 1, weight: 1.5 }).bindTooltip(`${station.id} · ${station.name}`).on('click', (event) => { L.DomEvent.stopPropagation(event); choosePlace(station.lat, station.lon, `${station.id} · ${station.name}`); }))).addTo(map);
  map.on('click', (event) => choosePlace(event.latlng.lat, event.latlng.lng, `Bod ${event.latlng.lat.toFixed(3)}° N, ${event.latlng.lng.toFixed(3)}° E`));
}

function renderRadar() {
  const radar = aviation?.radar;
  if (!radar?.url || !radar.bounds || !map) {
    if (radarLayer && map) map.removeLayer(radarLayer);
    radarLayer = null;
    radarUrl = null;
    $('radar-legend').innerHTML = '';
    $('radar-toggle').disabled = true;
    $('radar-time').textContent = 'Snímek není dostupný';
    return;
  }
  $('radar-toggle').disabled = false;
  const stale = radar.status === 'stale' || Date.now() - Date.parse(radar.observedAt) > 20 * 60000;
  $('radar-time').textContent = `${fullTime(radar.observedAt)}${stale ? ' · starší snímek / obnova nepotvrzena' : ''}${radar.error ? ` · ${radar.error}` : ''}`;
  $('map-caption').textContent = `Podklad ZTM ČÚZK pokrývá Česko. Kliknutím vyber místo. Radar je pozorování z ${fullTime(radar.observedAt)}; nemění se s časem ani modelem předpovědi.`;
  if (radarUrl === radar.url && radarLayer) return;
  if (radarLayer) map.removeLayer(radarLayer);
  const layer = window.L.imageOverlay(radar.url, radar.bounds, { opacity: 0.65, attribution: 'Radar: ČHMÚ · CC BY 4.0', interactive: false });
  radarLayer = layer;
  radarUrl = radar.url;
  layer.on('error', () => { if (radarLayer !== layer) return; $('radar-time').textContent = 'Obraz se nepodařilo načíst'; $('radar-toggle').checked = false; map.removeLayer(layer); });
  if ($('radar-toggle').checked) radarLayer.addTo(map);
  $('radar-legend').innerHTML = radar.legendUrl ? `<img src="${esc(radar.legendUrl)}" alt="Barevná stupnice radarové odrazivosti dBZ a orientační intenzity srážek mm/h" loading="lazy"><p class="chart-caption">ČHMÚ · pseudo-CAPPI 2 km. Bez obrazu nelze usuzovat na nepřítomnost srážek.</p>` : '';
}

async function loadAviation(force = false) {
  const id = ++aviationRequestId;
  try {
    const response = await fetch(`./data/aviation.json${force ? `?t=${Date.now()}` : ''}`, { cache: force ? 'reload' : 'default', signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (id !== aviationRequestId) return;
    if (payload.schemaVersion !== 1 || !payload.metar || !payload.taf) throw new Error('Neočekávaný formát zpráv');
    aviation = payload;
    aviationLoadError = null;
    renderReports();
  } catch (error) {
    if (id !== aviationRequestId) return;
    aviationLoadError = error.message;
    if (aviation) { renderReports(); return; }
    $('reports-status').innerHTML = `<p class="feed-error">Balíček leteckých zpráv se nepodařilo načíst: ${esc(error.message)}. ${aviation ? 'Zůstává zobrazen předchozí balíček s původními časy.' : 'Použij odkaz na oficiální zdroj.'}</p>`;
    $('reports-meta').textContent = aviation ? $('reports-meta').textContent : 'Regionální zprávy nedostupné. Žádné náhradní zprávy se nevytvářejí.';
    if (!aviation) $('sigmets').innerHTML = '<p class="feed-error">SIGMET není k dispozici.</p>';
  }
}

async function loadForecast(force = false) {
  const id = ++requestId;
  if (controller) controller.abort();
  controller = new AbortController();
  const signal = controller.signal;
  forecast = null;
  comparison = null;
  loadError = null;
  compareError = null;
  loading = true;
  updateControls();
  renderSummary();
  renderStatus();
  renderCharts();
  const params = { lat: state.lat, lon: state.lon, signal, force };
  const primary = fetchForecast({ ...params, model: state.model });
  const secondary = state.compare ? fetchForecast({ ...params, model: state.compare }) : Promise.resolve(null);
  const [main, other] = await Promise.allSettled([primary, secondary]);
  if (id !== requestId) return;
  loading = false;
  if (main.status === 'fulfilled') forecast = main.value;
  else if (main.reason?.name !== 'AbortError') loadError = main.reason?.message || 'Zdroj není dostupný';
  if (other.status === 'fulfilled') comparison = other.value;
  else if (other.reason?.name !== 'AbortError') compareError = other.reason?.message || 'Zdroj není dostupný';
  renderContext();
}

function renderContext() {
  updateControls();
  renderSummary();
  renderStatus();
  renderCharts();
  renderAstronomy();
  if (aviation) renderReports();
  writeUrl();
}

function selectTime(iso) {
  if (!Number.isFinite(Date.parse(iso))) return;
  state.time = new Date(iso).toISOString();
  renderContext();
}

function choosePlace(lat, lon, name, place = 'custom') {
  Object.assign(state, { lat, lon, name, place });
  if (pointMarker) { pointMarker.setLatLng([lat, lon]); map.panTo([lat, lon]); }
  renderAstronomy();
  if (aviation) renderReports();
  writeUrl();
  loadForecast();
}

$('models').addEventListener('click', (event) => {
  const model = event.target.closest('[data-model]')?.dataset.model;
  if (!model || model === state.model) return;
  if (state.compare === model) state.compare = state.model;
  state.model = model;
  loadForecast();
});
$('location').addEventListener('change', (event) => {
  const place = PLACES[event.target.value];
  if (place) choosePlace(place.lat, place.lon, place.name, event.target.value);
});
$('inspection-time').addEventListener('change', (event) => {
  const iso = fromDateTimeInput(event.target.value, state.timezone);
  if (iso) { event.target.setCustomValidity(''); selectTime(iso); }
  else { event.target.setCustomValidity('Tento čas neexistuje nebo není platný. Ověř změnu letního času.'); event.target.reportValidity(); }
});
$('now').addEventListener('click', () => selectTime(new Date().toISOString()));
$('time-slider').addEventListener('input', (event) => { if (forecast) selectTime(forecast.times[Number(event.target.value)]); });
$('horizon').addEventListener('click', (event) => { const hours = Number(event.target.closest('[data-hours]')?.dataset.hours); if ([24, 48, 72].includes(hours)) { state.hours = hours; renderContext(); } });
$('compare').addEventListener('change', (event) => { state.compare = event.target.value; loadForecast(); });
$('zone').addEventListener('click', () => { state.timezone = state.timezone === 'UTC' ? 'Europe/Prague' : 'UTC'; renderContext(); if (aviation) renderReports(); });
$('refresh').addEventListener('click', () => { loadForecast(true); loadAviation(true); });
$('theme').addEventListener('click', () => { const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = theme; persist('theme', theme); $('theme').setAttribute('aria-pressed', String(theme === 'dark')); });
$('notes').addEventListener('input', (event) => persist('notes', event.target.value));
$('print').addEventListener('click', () => { $('print-notes').textContent = $('notes').value; updateControls(); window.print(); });
$('share').addEventListener('click', async () => {
  writeUrl();
  try { await navigator.clipboard.writeText(location.href); $('share').textContent = 'Odkaz zkopírován'; setTimeout(() => { $('share').textContent = 'Kopírovat odkaz'; }, 2500); }
  catch { $('share').textContent = 'Zkopíruj adresu z prohlížeče'; }
});
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
$('radar-toggle').addEventListener('change', (event) => { if (!map || !radarLayer) return; if (event.target.checked) radarLayer.addTo(map); else map.removeLayer(radarLayer); });
window.addEventListener('beforeprint', () => { $('print-notes').textContent = $('notes').value; updateControls(); });
window.addEventListener('popstate', () => location.reload());

$('radar-toggle').checked = true;
updateControls();
renderSummary();
renderAstronomy();
initMap();
loadForecast();
loadAviation();
