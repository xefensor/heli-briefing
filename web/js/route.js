import { normalizePlace } from './places.js';
import { haversineKm, formatTime, formatNumber, formatCoordinates, parseSharedState } from './briefing.js';
import { MODELS, nearestTimeIndex } from './weather.js';
import { escapeHtml as esc } from './charts.js';
import { queryClouds, CLOUD_STATUS_LABELS } from './clouds.js';

export const ROUTE_LIMIT = 6;
export const ROUTE_KEY = 'heli-route-v1';
const finite = value => typeof value === 'number' && Number.isFinite(value);
const keys = ['wind', 'gust', 'direction', 'visibility', 'cloudLow', 'precipitation', 'temperature', 'dewpoint', 'pressure'];
const label = model => MODELS.find(item => item.id === model)?.label || model;
const stamp = (value, zone) => value && Number.isFinite(Date.parse(value)) ? `${formatTime(value, zone, true).replace(' ', `${new Intl.DateTimeFormat('cs-CZ', { timeZone: zone, year: 'numeric' }).format(new Date(value))} `)} ${zone === 'UTC' ? 'UTC' : 'CZ'}` : 'čas neurčen';
const number = (value, unit = '', digits = 0) => finite(value) ? `${formatNumber(value, digits)}${unit ? ` ${unit}` : ''}` : '—';

export function normalizeRoutePlan(input) {
  if (!input || input.schemaVersion !== 1 || !Array.isArray(input.points) || input.points.length > ROUTE_LIMIT) throw new Error('Trasa nemá podporovaný formát nebo obsahuje více než šest bodů.');
  const departure = input.departure === null ? null : parseSharedState(new URLSearchParams({ time: input.departure }).toString()).time;
  if (input.points.length && !departure) throw new Error('Trasa nemá platný čas odletu.');
  return { schemaVersion: 1, departure: departure || null, points: input.points.map((value, index) => {
    const point = normalizePlace(value);
    if (!point) throw new Error('Bod trasy nemá platný název nebo souřadnice.');
    const minutes = index === 0 ? 0 : value.legMinutes;
    if (minutes !== null && (!Number.isInteger(minutes) || minutes < 0 || minutes > 600 || (index > 0 && minutes === 0))) throw new Error('Čas úseku musí být celé číslo 1–600 minut, nebo nevyplněný.');
    return { name: point.name, lat: point.lat, lon: point.lon, legMinutes: minutes };
  }) };
}

export function routeSchedule(input) {
  const plan = normalizeRoutePlan(input);
  let elapsed = 0, distanceKm = 0, complete = true;
  return plan.points.map((point, index) => {
    if (index) {
      distanceKm += haversineKm(plan.points[index - 1].lat, plan.points[index - 1].lon, point.lat, point.lon);
      if (point.legMinutes === null) complete = false;
      else elapsed += point.legMinutes;
    }
    return { ...point, index, distanceKm, elapsedMinutes: complete ? elapsed : null, passageAt: complete ? new Date(Date.parse(plan.departure) + elapsed * 60000).toISOString() : null };
  });
}
export const routeDataKey = (point, model) => `${point.lat},${point.lon}:${model}`;
function validateModels(models) { if (!Array.isArray(models) || !models.length || models.length > 2 || new Set(models).size !== models.length || models.some(model => !MODELS.some(item => item.id === model))) throw new Error('Trasa vyžaduje jeden nebo dva odlišné podporované modely.'); }

/** Two in-flight requests at most. A rate limit stops the remaining queue. */
export async function loadRouteForecasts(plan, models, { fetcher, signal, force = false } = {}) {
  validateModels(models);
  const tasks = [...new Map(routeSchedule(plan).filter(point => point.passageAt).flatMap(point => models.map(model => [routeDataKey(point, model), { point, model }]))).entries()];
  const results = {}, requested = { next: 0 }, state = { limited: false, retryAt: null };
  function limited(retryAt) { state.limited = true; if (Number.isFinite(Date.parse(retryAt)) && (!state.retryAt || Date.parse(retryAt) > Date.parse(state.retryAt))) state.retryAt = retryAt; }
  async function worker() {
    while (requested.next < tasks.length) {
      if (signal?.aborted) throw new DOMException('Požadavek byl zrušen.', 'AbortError');
      const [key, { point, model }] = tasks[requested.next++];
      if (state.limited) { results[key] = { error: 'Další body nebyly načteny: zdroj omezuje požadavky.' }; continue; }
      try {
        const forecast = await fetcher({ lat: point.lat, lon: point.lon, model, force, signal });
        results[key] = { forecast };
        if (forecast.transport?.error?.status === 429) limited(forecast.transport.error.retryAt);
      } catch (error) {
        if (signal?.aborted || error.name === 'AbortError') throw error;
        results[key] = { error: error.message || 'Zdroj není dostupný.' };
        if (error.status === 429 || error.code === 'rate-limit') limited(error.retryAt);
      }
    }
  }
  await Promise.all([worker(), worker()]);
  return { results, limited: state.limited, retryAt: state.retryAt };
}

export function routeSample(entry, point, model) {
  const f = entry?.forecast;
  const base = { model, label: label(model), status: !point.passageAt ? 'time-missing' : !entry ? 'loading' : !f ? 'unavailable' : 'available', error: entry?.error || f?.transport?.error?.message || null,
    validAt: null, retrievedAt: f?.retrievedAt || null, runTime: f?.runTime || null, sourceUrl: f?.sourceUrl || null, apiModel: f?.apiModel || null,
    requestedLocation: f?.requestedLocation || null, gridLocation: f?.grid || null, stale: Boolean(f?.transport?.stale), values: Object.fromEntries(keys.map(key => [key, null])) };
  if (!f || !point.passageAt) return base;
  if (f.model !== model || f.requestedLocation?.lat !== point.lat || f.requestedLocation?.lon !== point.lon) return { ...base, status: 'context-error', error: 'Předpověď neodpovídá tomuto bodu a modelu.' };
  const index = nearestTimeIndex(f.times, point.passageAt);
  if (index < 0 || Math.abs(Date.parse(f.times[index]) - Date.parse(point.passageAt)) > 1800000) return { ...base, status: 'outside-horizon' };
  const values = Object.fromEntries(keys.map(key => [key, finite(f.hourly?.[key]?.[index]) ? f.hourly[key][index] : null]));
  return { ...base, values, validAt: f.times[index], status: ['wind', 'visibility', 'temperature'].some(key => values[key] === null) ? 'partial' : 'available' };
}

export function captureRoute(plan, models, results, { clouds = null, cloudError = null, loading = false, now = Date.now() } = {}) {
  validateModels(models);
  const valid = normalizeRoutePlan(plan);
  return { schemaVersion: 1, plan: valid, models: [...models], loading, rows: routeSchedule(valid).map(point => {
    const native = point.passageAt ? queryClouds(clouds, { lat: point.lat, lon: point.lon, time: point.passageAt, nowMs: now }) : { status: 'time-missing' };
    // Preserve the selected native value and its provenance, not the entire crop/series per point.
    const { series, ...ceiling } = native;
    return { ...point, samples: models.map(model => routeSample(results[routeDataKey(point, model)] || (loading || !point.passageAt ? null : { error: 'Pro bod a čas nebyl zdroj načten.' }), point, model)), ceiling: { ...ceiling, error: cloudError || ceiling.error || null } };
  }) };
}

const states = { loading: 'Načítání', unavailable: 'Zdroj nedostupný', 'time-missing': 'Doplň čas úseku', 'context-error': 'Jiný bod / model', 'outside-horizon': 'Mimo dostupné hodiny', partial: 'Chybějící hodnoty', available: 'Hodinový vzorek' };
export function validateRouteBundle(bundle, expectedModels) {
  if (!bundle || bundle.schemaVersion !== 1 || JSON.stringify(bundle.models) !== JSON.stringify(expectedModels)) throw new Error('Trasa neodpovídá vybraným modelům.');
  const schedule = routeSchedule(bundle.plan);
  if (!Array.isArray(bundle.rows) || bundle.rows.length !== schedule.length) throw new Error('Trasa nemá odpovídající body.');
  bundle.rows.forEach((row, index) => {
    const point = schedule[index];
    if (['lat', 'lon', 'name', 'passageAt', 'elapsedMinutes', 'index'].some(key => row[key] !== point[key]) || !finite(row.distanceKm) || Math.abs(row.distanceKm - point.distanceKm) > .00001) throw new Error('Vzorek trasy patří jinému bodu nebo času.');
    if (!Array.isArray(row.samples) || row.samples.length !== expectedModels.length) throw new Error('Trasa nemá odpovídající vzorky.');
    row.samples.forEach((sample, modelIndex) => {
      if (sample.model !== expectedModels[modelIndex] || !Object.hasOwn(states, sample.status) || !sample.values || keys.some(key => sample.values[key] !== null && !finite(sample.values[key]))) throw new Error('Trasa obsahuje neplatný vzorek.');
      if (sample.validAt && (!row.passageAt || !Number.isFinite(Date.parse(sample.validAt)) || Math.abs(Date.parse(sample.validAt) - Date.parse(row.passageAt)) > 1800000)) throw new Error('Hodinový vzorek trasy je příliš vzdálený od průchodu.');
      if (sample.requestedLocation && (sample.requestedLocation.lat !== row.lat || sample.requestedLocation.lon !== row.lon)) throw new Error('Vzorek trasy patří jiným souřadnicím.');
      if (Object.values(sample.values).some(finite) && (!sample.validAt || !['available', 'partial'].includes(sample.status))) throw new Error('Hodnoty trasy nemají platný hodinový vzorek.');
    });
    if (!row.ceiling || (row.ceiling.status === 'available' && (!finite(row.ceiling.valueMsl) || !Number.isFinite(Date.parse(row.ceiling.validAt)) || !row.passageAt || Math.abs(Date.parse(row.ceiling.validAt) - Date.parse(row.passageAt)) > 1800000))) throw new Error('Cloudový vzorek trasy nemá platný bodový čas.');
  });
  return bundle;
}

function sourceLink(value) {
  try { const url = new URL(value); if (url.protocol === 'https:' && !url.username && !url.password) return `<a href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">Přesný dotaz na zdroj ↗</a>`; } catch { /* No clickable link for invalid/untrusted schemes. */ }
  return '';
}
function dotChart(bundle, field, title, unit, divisor = 1, width = 720) {
  const w = Math.max(300, Math.min(1000, width)), h = 205, left = 48, right = w - 16, top = 28, bottom = 158;
  const values = bundle.rows.flatMap(row => row.samples.flatMap(sample => [sample.values[field], ...(field === 'wind' ? [sample.values.gust] : [])])).filter(finite).map(value => value / divisor);
  const max = Math.max(1, ...values) * 1.15;
  const x = index => bundle.rows.length === 1 ? (left + right) / 2 : left + index / (bundle.rows.length - 1) * (right - left);
  const y = value => bottom - value / max * (bottom - top);
  const colors = ['var(--chart-cyan,#167d98)', 'var(--chart-amber,#a86b13)'];
  const grid = [0, .5, 1].map(fraction => `<line x1="${left}" x2="${right}" y1="${y(max * fraction)}" y2="${y(max * fraction)}" stroke="var(--line,#d6dfe5)"/><text x="${left - 8}" y="${y(max * fraction) + 4}" text-anchor="end">${esc(formatNumber(max * fraction, 1))}</text>`).join('');
  const dots = bundle.rows.map((row, i) => row.samples.map((sample, modelIndex) => {
    const at = x(i) + (modelIndex ? 3 : -3), value = sample.values[field];
    return `${finite(value) ? `<circle cx="${at}" cy="${y(value / divisor)}" r="5" fill="${colors[modelIndex]}"/>` : `<text x="${at}" y="${bottom - 8}" text-anchor="middle" fill="${colors[modelIndex]}">×</text>`}${field === 'wind' && finite(sample.values.gust) ? `<circle cx="${at}" cy="${y(sample.values.gust)}" r="7" fill="none" stroke="${colors[modelIndex]}" stroke-width="2"/>` : ''}`;
  }).join('')).join('');
  return `<div class="route-chart"><h3>${esc(title)} · ${unit}</h3><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)} v bodech trasy, hodnoty mezi body nejsou dopočítány">${grid}${dots}${bundle.rows.map((row, index) => `<text x="${x(index)}" y="183" text-anchor="middle">${index + 1}</text>`).join('')}</svg></div>`;
}

export function renderRouteBriefing(bundle, { zone = 'Europe/Prague', interactive = false, width = 720 } = {}) {
  if (!bundle?.rows?.length) return '';
  const graphs = bundle.rows.length > 1 ? `<div class="route-charts">${dotChart(bundle, 'wind', 'Vítr / nárazy', 'kt', 1, width)}${dotChart(bundle, 'visibility', 'Modelová dohlednost', 'km', 1000, width)}</div><p class="route-note">Čísla odpovídají pořadí bodů níže. Tečka = vítr, kroužek = nárazy; × = chybí. ${bundle.models.map((model, i) => `${i ? 'Okrová' : 'Modrá'}: ${esc(label(model))}`).join(' · ')}. Mezi body není dopočítáno počasí.</p>` : '';
  return `<div class="route-output"><p class="route-note">Plánovaný odlet ${esc(stamp(bundle.plan.departure, zone))}. Čas trasy je samostatný; Teď ani posun hlavních grafů jej nepřepisuje.${bundle.loading ? ' Obnova trasy probíhá; některé hodnoty mohou ještě chybět.' : ''}</p>${graphs}<div class="route-point-grid">${bundle.rows.map(row => `<article class="route-point"><header><h3>${interactive ? `<button type="button" class="route-inspect" data-route-inspect="${row.index}">${row.index + 1}. ${esc(row.name)} ↗</button>` : `${row.index + 1}. ${esc(row.name)}`}</h3><p>${esc(formatCoordinates(row.lat, row.lon))} · ${number(row.distanceKm, 'km', 1)} od začátku</p><strong>Průchod: ${row.passageAt ? esc(stamp(row.passageAt, zone)) : 'doplň časy předchozích úseků'}</strong></header>${row.passageAt ? row.samples.map(sample => `<div class="route-model"><h4>${esc(sample.label)} <span class="${sample.status !== 'available' || sample.stale ? 'route-attention' : ''}">${esc(states[sample.status] || sample.status)}${sample.stale ? ' · STARŠÍ DATA' : ''}</span></h4><p class="route-note">Vzorek ${esc(stamp(sample.validAt, zone))} · staženo ${esc(stamp(sample.retrievedAt, zone))} · běh ${sample.runTime ? esc(stamp(sample.runTime, zone)) : 'API neuvádí'}</p><dl class="route-values"><div><dt>Vítr / nárazy · kt</dt><dd>${number(sample.values.wind)} / ${number(sample.values.gust)} · ${number(sample.values.direction, '°')}</dd></div><div><dt>Modelová dohlednost</dt><dd>${number(sample.values.visibility === null ? null : sample.values.visibility / 1000, 'km', 1)}</dd></div><div><dt>Nízká oblačnost · pokrytí</dt><dd>${number(sample.values.cloudLow, '%')}</dd></div><div><dt>Srážky · předchozí hodina</dt><dd>${number(sample.values.precipitation, 'mm', 1)}</dd></div><div><dt>Teplota / rosný bod · °C</dt><dd>${number(sample.values.temperature, '', 1)} / ${number(sample.values.dewpoint, '', 1)}</dd></div><div><dt>Modelový tlak MSL</dt><dd>${number(sample.values.pressure, 'hPa')}</dd></div></dl>${sample.error ? `<p class="route-attention">${esc(sample.error)}</p>` : ''}<details class="route-provenance"><summary>Zdroj a časy · ${esc(sample.label)}</summary><p>Open-Meteo · ${esc(sample.apiModel || sample.model)} · staženo ${esc(stamp(sample.retrievedAt, zone))} · běh ${sample.runTime ? esc(stamp(sample.runTime, zone)) : 'API neuvádí'}.</p>${sample.gridLocation ? `<p>Výstupní bod ${esc(formatCoordinates(sample.gridLocation.lat, sample.gridLocation.lon))}; výšková reference API není ověřeným terénním profilem.</p>` : ''}${sourceLink(sample.sourceUrl)}</details></div>`).join('') : '<p class="route-attention">Nejdříve doplň délky úseků. Pro neurčený průchod se počasí neodhaduje.</p>'}<p class="route-ceiling"><strong>Samostatný ICON-D2 CEILING</strong> · ${row.ceiling.status === 'available' ? number(row.ceiling.valueMsl, 'm MSL') : esc(CLOUD_STATUS_LABELS[row.ceiling.status] || 'Pro tento bod / čas není hodnota dostupná.')}<br>Vzorek ${esc(stamp(row.ceiling.validAt, zone))} · běh ${esc(stamp(row.ceiling.runTime, zone))} · staženo ${esc(stamp(row.ceiling.retrievedAt, zone))}${row.ceiling.stale ? ' · STARŠÍ BĚH' : ''}${row.ceiling.error ? ` · ${esc(row.ceiling.error)}` : ''}</p></article>`).join('')}</div><p class="route-note">Bodové hodinové vzorky, nikoli souvislý řez trasou. Nárazy a srážky patří předchozí hodině končící časem vzorku; nejsou souhrnem letu. Pokrytí nízkou oblačností není ceiling. CEILING DWD je MSL, bez konvektivní složky, nikoli AGL ani pozorování. Spojnice bodů ani jejich vzdálenost nejsou ověřená letová trasa, terén či překážková analýza.</p></div>`;
}

export function routeText(bundle, zone) {
  if (!bundle?.rows?.length) return [];
  return ['', 'POČASÍ V BODECH TRASY', `Plánovaný odlet ${stamp(bundle.plan.departure, zone)}${bundle.loading ? ' · obnova při zachycení probíhala' : ''}`,
    ...bundle.rows.flatMap(row => [`${row.index + 1}. ${row.name} · ${formatCoordinates(row.lat, row.lon)} · ${number(row.distanceKm, 'km', 1)} · průchod ${stamp(row.passageAt, zone)}`,
      ...row.samples.map(sample => `${sample.label}: ${states[sample.status]}${sample.stale ? ' · STARŠÍ DATA' : ''} · vzorek ${stamp(sample.validAt, zone)} · staženo ${stamp(sample.retrievedAt, zone)} · běh ${stamp(sample.runTime, zone)} · vítr/nárazy ${number(sample.values.wind)}/${number(sample.values.gust)} kt · směr ${number(sample.values.direction, '°')} · dohlednost ${number(sample.values.visibility === null ? null : sample.values.visibility / 1000, 'km', 1)} · nízká oblačnost ${number(sample.values.cloudLow, '%')} · srážky ${number(sample.values.precipitation, 'mm', 1)}${sample.error ? ` · ${sample.error}` : ''}`),
      `Samostatný ICON-D2 CEILING: ${row.ceiling.status === 'available' ? number(row.ceiling.valueMsl, 'm MSL') : 'nedostupný'} · vzorek ${stamp(row.ceiling.validAt, zone)}${row.ceiling.stale ? ' · starší běh' : ''}`]),
    'Bodové vzorky, nikoli souvislé počasí nebo terénní/překážkový profil. Nárazy a srážky za hodinu končící vzorkem; nízká oblačnost v % není ceiling.'];
}

export const ROUTE_PRINT_CSS = `.route-point-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.route-point{border:1px solid #aabcc8;padding:14px;break-inside:avoid;overflow-wrap:anywhere}.route-point h3{margin:0 0 6px}.route-point header p,.route-note,.route-ceiling{font-size:12px;line-height:1.6}.route-model{border-top:1px solid #d6dfe5;margin-top:14px;padding-top:10px}.route-model h4{margin:0}.route-model h4 span{display:block;font-size:12px;font-weight:400}.route-values{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.route-values dt{font-size:11px}.route-values dd{margin:4px 0;font-weight:600}.route-attention{color:#8d4800}.route-chart svg{display:block;width:100%;height:auto}.route-chart svg text{font:13px sans-serif;fill:#192d3d}.route-provenance{font-size:12px}.route-ceiling{padding-top:10px;border-top:1px solid #aabcc8}@media(max-width:650px){.route-point-grid{grid-template-columns:1fr}.route-values{grid-template-columns:repeat(2,minmax(0,1fr))}}@media print{.route-point-grid{grid-template-columns:1fr}.route-point{break-inside:auto}.route-values{grid-template-columns:repeat(3,minmax(0,1fr))}.route-chart{break-inside:avoid}}`;
