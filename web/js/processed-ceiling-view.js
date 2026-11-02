/** Independently processed AGL raster. This is separate from native MSL CEILING. */
import { escapeHtml as esc, renderChart, niceTicks } from './charts.js';
import { formatTime, formatNumber } from './briefing.js';
import { allowedProcessedCeilingUrl } from './processed-ceiling-source.js';

const MODELS = ['ICON-D2-RUC', 'ICON-D2', 'ICON-EU'];
const STATUSES = ['ok', 'partial', 'outside-domain', 'outside-horizon'];
const R = 6378137, LIMIT = Math.PI * R, DEG = Math.PI / 180;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const close = (a, b, tolerance = 0.000002) => finite(a) && finite(b) && Math.abs(a - b) <= tolerance;
const fail = message => { throw new Error(`Neplatný zpracovaný ceiling: ${message}.`); };
function date(value, nullable = false) {
  if (nullable && value === null) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|\+00:00)$/.test(value)) fail('nejednoznačný čas');
  const at = Date.parse(value);
  if (!Number.isFinite(at) || new Date(at).toISOString().slice(0, 19) !== value.slice(0, 19)) fail('neplatné datum');
  return at;
}
function text(value, maximum = 1000) { if (typeof value !== 'string' || value.length > maximum) fail('neplatný text'); return value; }
function value(value) { if (value !== null && (!finite(value) || value < 0 || value > 100000)) fail('neplatná výška ft AGL'); }
function coordinate(point) {
  if (!object(point) || !finite(point.lat) || !finite(point.lon) || Math.abs(point.lat) >= 85.05112878 || Math.abs(point.lon) > 180) fail('neplatná poloha');
}
function project(lat, lon) { return { x: R * lon * DEG, y: R * Math.log(Math.tan(Math.PI / 4 + lat * DEG / 2)) }; }
function inverse(x, y) { return { lon: x / R / DEG, lat: (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) / DEG }; }
function distance(a, b) {
  const h = Math.sin((b.lat - a.lat) * DEG / 2) ** 2 + Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.sin((b.lon - a.lon) * DEG / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(Math.min(1, h)), Math.sqrt(Math.max(0, 1 - h)));
}
function grid(g) {
  if (!object(g) || g.type !== 'processed-raster' || g.crs !== 'EPSG:3857' || !Number.isInteger(g.width) || !Number.isInteger(g.height) || g.width < 1 || g.height < 1 || g.width > 4096 || g.height > 4096 || g.width * g.height > 2000000 || ![g.originX, g.originY, g.pixelWidth, g.pixelHeight].every(finite) || g.pixelWidth <= 0 || g.pixelHeight >= 0 || Math.abs(g.originX) > LIMIT || Math.abs(g.originY) > LIMIT || Math.abs(g.originX + g.width * g.pixelWidth) > LIMIT + 0.01 || Math.abs(g.originY + g.height * g.pixelHeight) > LIMIT + 0.01) fail('neověřitelný zpracovaný rastr');
}
function cell(c, g) {
  coordinate(c);
  if (!Number.isInteger(c.row) || !Number.isInteger(c.col) || c.row < 0 || c.col < 0 || c.row >= g.height || c.col >= g.width || c.index !== c.row * g.width + c.col) fail('pixel nesouhlasí s rastrem');
  const actual = inverse(g.originX + (c.col + 0.5) * g.pixelWidth, g.originY + (c.row + 0.5) * g.pixelHeight);
  if (!close(actual.lat, c.lat) || !close(actual.lon, c.lon)) fail('poloha není skutečný střed pixelu');
}
function sampled(point, g, request, distanceKm) {
  grid(g); cell(point, g);
  const position = project(request.lat, request.lon);
  if (Math.floor((position.x - g.originX) / g.pixelWidth) !== point.col || Math.floor((position.y - g.originY) / g.pixelHeight) !== point.row || !finite(distanceKm) || distanceKm < 0 || Math.abs(distance(request, point) - distanceKm) > 0.05) fail('pixel nepatří zvolenému bodu');
}
function runDate(code) { return date(`${code.slice(0, 4)}-${code.slice(4, 6)}-${code.slice(6, 8)}T${code.slice(8, 10)}:00:00Z`); }
function metadata(frame, data, { empty = false } = {}) {
  if (!object(frame)) fail('chybí metadata snímku');
  const at = date(frame.validAt, empty), run = date(frame.runTime, true), fetched = date(frame.retrievedAt, true);
  if (frame.model === null && empty) {
    if (run !== null || frame.sourceUrl !== null || fetched !== null) fail('neúplný stav nemá konzistentní metadata');
    return;
  }
  if (!MODELS.includes(frame.model) || !allowedProcessedCeilingUrl(frame.sourceUrl, { kind: 'raster' })) fail('neznámý model nebo zdroj');
  const match = /\/cog\/ceiling_([0-9]{10}_[0-9]{10}_[0-9]{10})_h([0-9]{2,3})m(00|15|30|45)\.tif$/.exec(frame.sourceUrl);
  if (!match || match[1] !== data.runId || at !== date(data.providerReferenceTime) + (Number(match[2]) * 60 + Number(match[3])) * 60000) fail('soubor nesouhlasí s referenčním časem katalogu');
  if (run !== null) {
    const codes = data.runId.split('_'), index = frame.model === 'ICON-D2' ? 0 : frame.model === 'ICON-D2-RUC' ? 1 : 2;
    if (frame.runTimeSource !== 'provider viewer explicit model/date/hour' || run !== runDate(codes[index]) || run > at || at - run > 180 * 3600000) fail('běh modelu není doložen metadaty');
  } else if (frame.runTimeSource !== null) fail('chybějící běh má neplatný původ');
}

/** Validate serialized metadata and numeric rasters; accept genuine null/error gaps. */
export function validateProcessedCeiling(data) {
  if (!object(data) || data.schemaVersion !== 1 || data.source !== 'ClearToFly' || data.product !== 'CEILING' || data.units !== 'ft AGL' || !STATUSES.includes(data.status) || !['ok', 'missing', 'unavailable'].includes(data.selectedStatus) || data.providerLicence !== 'not-published' || typeof data.stale !== 'boolean') fail('identita nebo výšková reference');
  if (!object(data.processing) || data.processing.grid !== 'EPSG:3857 processed raster' || data.processing.terrainSource !== 'unknown' || data.processing.conversion !== 'provider; details not published') fail('nepotvrzené zpracování nebo terén');
  if (data.transportError !== undefined) text(data.transportError, 1000);
  text(data.attribution, 500); if (!data.attribution.includes('DWD') || !data.attribution.includes('ClearToFly')) fail('chybí atribuce');
  if (typeof data.runId !== 'string' || !/^[0-9]{10}_[0-9]{10}_[0-9]{10}$/.test(data.runId)) fail('identifikátor zdroje');
  data.runId.split('_').forEach(runDate);
  const publication = date(data.publicationTime), reference = date(data.providerReferenceTime);
  text(data.providerReferenceNote, 500);
  if (reference > publication + 300000 || !allowedProcessedCeilingUrl(data.catalogueUrl, { kind: 'viewer' }) || !data.catalogueUrl.endsWith(`ceiling-viewer-${data.runId}.html`)) fail('publikace nebo katalog');
  coordinate(data.request); date(data.request.selectedTime);
  if (!Number.isInteger(data.request.hours) || data.request.hours < 1 || data.request.hours > 24) fail('rozsah požadavku');
  value(data.valueAglFt);
  metadata(data, data, { empty: data.status === 'outside-horizon' });
  if (data.validAt !== null && Math.abs(date(data.validAt) - date(data.request.selectedTime)) > 1800000) fail('vybraný čas neodpovídá snímku');
  if (data.selectedStatus === 'ok' && data.valueAglFt === null || data.selectedStatus !== 'ok' && data.valueAglFt !== null) fail('stav a číselná hodnota nesouhlasí');
  if (data.cell !== null) {
    sampled(data.cell, data.grid, data.request, data.distanceKm);
    if (data.selectedStatus === 'unavailable' || !Number.isFinite(date(data.retrievedAt, true)) || data.cell.valueAglFt !== undefined && data.cell.valueAglFt !== data.valueAglFt) fail('vybraný pixel není doložen');
  } else if (data.selectedStatus !== 'unavailable' || data.distanceKm !== null || data.valueAglFt !== null) fail('chybí vybraný pixel');
  if (data.grid !== null) grid(data.grid);
  const s = data.series;
  if (!object(s) || !Array.isArray(s.times) || !Array.isArray(s.values) || !Array.isArray(s.frames) || s.times.length > 24 || s.times.length !== s.values.length || s.times.length !== s.frames.length || s.times.length && s.times.length !== data.request.hours) fail('neplatná časová řada');
  if (!s.times.length && data.status !== 'outside-horizon') fail('chybí časová řada');
  let previous = -Infinity;
  s.frames.forEach((frame, i) => {
    const at = date(s.times[i]); value(s.values[i]);
    if (at < previous || frame.validAt !== s.times[i] || frame.units !== 'ft AGL' || frame.runId !== data.runId) fail('řada není zarovnána s metadaty');
    if (Math.abs(at - (Math.floor(date(data.request.selectedTime) / 3600000) + i) * 3600000) > 1800000) fail('vzorek nepatří požadované hodině');
    previous = at;
    metadata(frame, data, { empty: true });
    if (frame.error !== undefined) text(frame.error, 1000);
    if (frame.cell !== null) sampled(frame.cell, frame.grid, data.request, frame.distanceKm);
    else if (s.values[i] !== null || !frame.error || frame.distanceKm !== null) fail('hodnota bez načteného pixelu');
    if (frame.grid !== null) grid(frame.grid);
    if (s.values[i] !== null && (frame.error || frame.retrievedAt === null) || frame.model === null && !frame.error) fail('chyba nemůže nést předpověď');
  });
  if (!Array.isArray(data.errors) || data.errors.length > 25) fail('neplatné chyby zdroje');
  for (const error of data.errors) { if (!object(error)) fail('neplatná chyba'); date(error.validAt); text(error.error, 1000); }
  if (data.regional !== null) {
    const region = data.regional;
    if (!object(region) || region.source !== 'ClearToFly' || region.units !== 'ft AGL' || region.model !== data.model || region.validAt !== data.validAt || region.runTime !== data.runTime || region.runTimeSource !== data.runTimeSource || region.sourceUrl !== data.sourceUrl || region.retrievedAt !== data.retrievedAt || !Array.isArray(region.nodes) || !region.nodes.length || region.nodes.length > 2048 || !Number.isInteger(region.totalCells) || region.totalCells < region.nodes.length || region.totalCells > 2000000 || region.subset !== (region.totalCells > region.nodes.length) || !Array.isArray(region.bounds) || region.bounds.length !== 2 || region.bounds.some(row => !Array.isArray(row) || row.length !== 2)) fail('neplatný regionální výřez');
    grid(region.grid);
    for (const key of ['width', 'height', 'originX', 'originY', 'pixelWidth', 'pixelHeight']) if (region.grid[key] !== data.grid?.[key]) fail('region patří jinému rastru');
    const [[south, west], [north, east]] = region.bounds;
    if (![south, west, north, east].every(finite) || south >= north || west >= east || Math.abs(south) >= 85.05112878 || Math.abs(north) >= 85.05112878 || west < -180 || east > 180) fail('neplatné hranice výřezu');
    const indices = new Set();
    for (const node of region.nodes) {
      cell(node, region.grid); value(node.valueAglFt);
      if (indices.has(node.index) || node.lat < south - 0.000002 || node.lat > north + 0.000002 || node.lon < west - 0.000002 || node.lon > east + 0.000002) fail('pixel není v daném výřezu');
      indices.add(node.index);
    }
    const selected = region.nodes.find(node => node.index === data.cell?.index);
    if (!selected || selected.valueAglFt !== data.valueAglFt) fail('výřez neobsahuje zvolený skutečný pixel');
  } else if (data.cell !== null) fail('chybí výřez zvoleného pixelu');
  return data;
}

const stamp = (time, zone) => time ? `${formatTime(time, zone, true)} ${zone === 'UTC' ? 'UTC' : 'CZ'}` : 'neuvedeno';
const number = (n, digits = 0) => finite(n) ? formatNumber(n, digits) : '—';
const colors = ['#ede4f2', '#d6bde5', '#b18dc9', '#8863ab', '#5b4284', '#352c60'];
const edges = [500, 1000, 2000, 4000, 8000];
function shade(n) { const index = edges.findIndex(edge => n < edge); return colors[index < 0 ? colors.length - 1 : index]; }
function regionalSvg(data, width) {
  const region = data.regional;
  if (!region) return '<p class="route-attention">Regionální rastr pro zvolený bod a čas není dostupný.</p>';
  const [[south, west], [north, east]] = region.bounds, w = Math.round(Math.max(320, Math.min(1000, width))), h = Math.round(Math.max(270, Math.min(420, w * 0.48))), margin = 38;
  const sw = project(south, west), ne = project(north, east), scale = Math.min((w - 2 * margin) / (ne.x - sw.x), (h - 2 * margin) / (ne.y - sw.y));
  const left = (w - (ne.x - sw.x) * scale) / 2, top = (h - (ne.y - sw.y) * scale) / 2;
  const xy = (lat, lon) => { const p = project(lat, lon); return { x: left + (p.x - sw.x) * scale, y: top + (ne.y - p.y) * scale }; };
  const rounded = n => n.toFixed(2), end = xy(south, east), start = xy(north, west);
  const latLines = niceTicks(south, north, 5).map(lat => { const p = xy(lat, west); return `<path d="M${rounded(start.x)} ${rounded(p.y)}H${rounded(end.x)}" stroke="#b8c2cc" stroke-width=".6"/><text x="${rounded(start.x - 5)}" y="${rounded(p.y + 4)}" text-anchor="end">${number(lat, 1)}°</text>`; }).join('');
  const lonLines = niceTicks(west, east, 6).map(lon => { const p = xy(south, lon); return `<path d="M${rounded(p.x)} ${rounded(start.y)}V${rounded(end.y)}" stroke="#b8c2cc" stroke-width=".6"/><text x="${rounded(p.x)}" y="${rounded(end.y + 17)}" text-anchor="middle">${number(lon, 1)}°</text>`; }).join('');
  const radius = w < 500 ? 1.6 : 2.2;
  const nodes = region.nodes.map(node => {
    const p = xy(node.lat, node.lon), x = rounded(p.x), y = rounded(p.y), title = `${number(node.valueAglFt)} ft AGL · pixel ${node.row}, ${node.col}`;
    return node.valueAglFt === null ? `<path data-processed-cell="${node.index}" d="M${rounded(p.x - 1.6)} ${rounded(p.y - 1.6)}l3.2 3.2m0-3.2l-3.2 3.2" stroke="#707983" stroke-width=".8"><title>Pixel ${node.row}, ${node.col}: hodnota chybí, nikoli jasno</title></path>` : `<circle data-processed-cell="${node.index}" cx="${x}" cy="${y}" r="${radius}" fill="${shade(node.valueAglFt)}"><title>${esc(title)}</title></circle>`;
  }).join('');
  const places = [['Č. Budějovice', 48.9757, 14.478], ['Churáňov', 49.0682, 13.6148], ['Praha', 50.1008, 14.26], ['Brno', 49.2, 16.61], ['Linec', 48.3069, 14.2858]].filter(([, lat, lon]) => lat >= south && lat <= north && lon >= west && lon <= east).map(([label, lat, lon]) => { const p = xy(lat, lon); return `<g class="processed-place"><circle cx="${rounded(p.x)}" cy="${rounded(p.y)}" r="2" fill="#172b3d"/><text x="${rounded(p.x + 5)}" y="${rounded(p.y - 5)}">${esc(label)}</text></g>`; }).join('');
  const selected = xy(data.cell.lat, data.cell.lon), request = xy(data.request.lat, data.request.lon);
  return `<svg class="processed-ceiling-map" viewBox="0 0 ${w} ${h}" role="img" aria-label="Zpracovaný ceiling ClearToFly v stopách AGL, skutečné středy pixelů bez interpolace"><rect x="${rounded(start.x)}" y="${rounded(start.y)}" width="${rounded(end.x - start.x)}" height="${rounded(end.y - start.y)}" fill="#f4f5f8" stroke="#8493a1"/>${latLines}${lonLines}${nodes}${places}<circle data-selected-cell="${data.cell.index}" cx="${rounded(selected.x)}" cy="${rounded(selected.y)}" r="7" fill="none" stroke="#ad6714" stroke-width="2"><title>Střed pixelu použitého pro bod</title></circle><path d="M${rounded(request.x - 4)} ${rounded(request.y)}h8m-4-4v8" stroke="#ad6714" stroke-width="1.8"><title>Zvolený bod</title></path></svg>`;
}

/** Pure local SVG/HTML, suitable for the live page and a frozen standalone briefing. */
export function renderProcessedCeiling(data, { lat = data?.request?.lat, lon = data?.request?.lon, time = data?.request?.selectedTime, timezone = 'Europe/Prague', width = 720 } = {}) {
  if (!data) return '<p class="route-attention">Zpracovaný ceiling ClearToFly zatím nebyl načten.</p>';
  validateProcessedCeiling(data);
  const matching = close(lat, data.request.lat, 0.00000001) && close(lon, data.request.lon, 0.00000001) && Number.isFinite(Date.parse(time)) && (data.validAt === null || Math.abs(Date.parse(time) - Date.parse(data.validAt)) <= 1800000);
  const readable = data.selectedStatus === 'ok' && matching;
  const selectedNote = !matching ? 'Načtená data nepatří zvolenému místu nebo blízkému času. Obnov tento produkt.' : data.status === 'outside-domain' ? 'Bod je mimo zpracovaný rastr poskytovatele.' : data.status === 'outside-horizon' ? 'Vybraný čas je mimo publikovaný horizont.' : data.selectedStatus === 'missing' ? 'Pixel nemá uvedenou výšku. Chybějící hodnota nepotvrzuje jasno.' : data.selectedStatus === 'unavailable' ? 'Vybraný pixel se nepodařilo načíst.' : 'Hodnota vybraného pixelu zpracované předpovědi.';
  const series = MODELS.filter(model => data.series.frames.some(frame => frame.model === model)).map((model, index) => ({ label: model, values: data.series.values.map((n, i) => data.series.frames[i].model === model ? n : null), color: ['#866aa3', '#287b8c', '#b07826'][index], unit: 'ft AGL', pointsOnly: true }));
  const chart = data.series.times.length ? renderChart({ times: data.series.times, series, selectedTime: time, timezone, width, height: 230, yLabel: 'ft AGL', min: 0 }) : '<p>Hodinová řada není dostupná.</p>';
  const legend = ['0–499', '500–999', '1 000–1 999', '2 000–3 999', '4 000–7 999', '≥ 8 000'].map((label, i) => `<span><i style="background:${colors[i]}"></i>${label}</span>`).join('');
  const rows = data.series.frames.map((frame, i) => `<tr><td>${esc(stamp(frame.validAt, timezone))}</td><td>${number(data.series.values[i])}</td><td>${esc(frame.model || 'nedostupný')}</td><td>${esc(stamp(frame.runTime, timezone))}</td><td>${esc(stamp(frame.retrievedAt, timezone))}${frame.error ? `<br>${esc(frame.error)}` : ''}</td></tr>`).join('');
  return `<div class="processed-ceiling"><h3>Zpracovaný modelový ceiling · ClearToFly · ft AGL</h3><p class="processed-ceiling-reading"><strong>${readable ? number(data.valueAglFt) : '—'}</strong> <span>ft AGL</span></p><p class="${readable && !data.stale ? 'section-note' : 'route-attention'}">${esc(selectedNote)}${data.transportError ? ` Obnova selhala: ${esc(data.transportError)} Původní časy zůstávají zachovány.` : data.stale ? ' Publikace je starší; aktuálnost není potvrzena.' : ''}</p><p class="section-note">${esc(data.model || 'Model neuveden')} · platnost ${esc(stamp(data.validAt, timezone))} · běh modelu ${esc(stamp(data.runTime, timezone))} · načteno ${esc(stamp(data.retrievedAt, timezone))}.</p><p class="section-note">Samostatný výstup DWD zpracovaný službou ClearToFly ve stopách nad terénem. Použitý terén a podrobnosti převodu poskytovatel nepopisuje. Hodnoty zachovávají jeho referenci ft AGL; nejsou součástí nativního produktu v m MSL.</p>${data.cell ? `<p class="section-note">Střed použitého pixelu ${number(data.cell.lat, 5)}° N, ${number(data.cell.lon, 5)}° E · ${number(data.distanceKm, 2)} km od bodu · zpracovaný rastr EPSG:3857.</p>` : ''}<h4>Bodová předpověď · ${data.series.times.length} hodinových vzorků</h4>${chart}<p class="section-note">Graf obsahuje hodinové vzorky; hlavní hodnota RUC může patřit bližšímu 15minutovému rámci. Body jsou skutečně načtené hodnoty rastru pro uvedené platnosti. Mezi nimi se výšky nedopočítávají; barva odlišuje model. Model i běh se mohou během řady změnit.</p><div class="processed-ceiling-table-wrap" tabindex="0" role="region" aria-label="Hodinové hodnoty ceilingu AGL a původ, vodorovně posuvná tabulka"><table class="processed-ceiling-table"><caption>Platnost, hodnota ft AGL a původ každého hodinového vzorku</caption><thead><tr><th>Platnost</th><th>ft AGL</th><th>Model</th><th>Běh modelu</th><th>Načteno / mezera</th></tr></thead><tbody>${rows || '<tr><td colspan="5">Žádné dostupné vzorky.</td></tr>'}</tbody></table></div><h4>Regionální zpracovaný rastr</h4>${regionalSvg(data, width)}<div class="processed-ceiling-legend">${legend}<span>× chybějící hodnota</span><span>Jednotky: ft AGL</span></div>${data.regional ? `<p class="section-note">${data.regional.nodes.length} skutečných středů pixelů z ${data.regional.totalCells}${data.regional.subset ? ' · řídký výběr' : ''}. Mezery mezi body nejsou doplněné pokrytí. Kroužek označuje použitý pixel, křížek zvolený bod. Mapa není pozorování ani rozbor překážek.</p>` : ''}<p class="section-note">Publikace ${esc(stamp(data.publicationTime, timezone))} · časová základna katalogu ${esc(stamp(data.providerReferenceTime, timezone))} (není běh jednotlivých modelů). ${data.errors.length ? `${data.errors.length} mezer / chyb zdroje; podrobnosti jsou u jednotlivých vzorků.` : ''}</p><p class="section-note">${esc(data.attribution)} · <a href="${esc(data.catalogueUrl)}" target="_blank" rel="noopener noreferrer">Původní produkt a legenda ↗</a>. Dodatečné podmínky využití zpracovaného výstupu nejsou zveřejněny; atribuce zůstává zachována. Chybějící výška není potvrzení jasné oblohy.</p></div>`;
}

export const PROCESSED_CEILING_PRINT_CSS = '.processed-ceiling-reading{font-size:1.2rem;margin:10px 0}.processed-ceiling-reading strong{font-size:2rem}.processed-ceiling-map{display:block;width:100%;height:auto;color:#263b4b}.processed-ceiling-map text{font:11px sans-serif;fill:currentColor}.processed-place text{paint-order:stroke;stroke:#fff;stroke-width:3;stroke-linejoin:round}.processed-ceiling-legend{display:flex;flex-wrap:wrap;gap:8px 16px;font-size:13px;margin:10px 0}.processed-ceiling-legend span{display:inline-flex;align-items:center;gap:5px}.processed-ceiling-legend i{display:inline-block;width:14px;height:14px;border:1px solid #78858c}.processed-ceiling-table-wrap{overflow-x:auto}.processed-ceiling-table{border-collapse:collapse;width:100%;font-size:13px}.processed-ceiling-table th,.processed-ceiling-table td{text-align:left;padding:7px 9px;border-bottom:1px solid #aab5bc;vertical-align:top}.processed-ceiling-table caption{text-align:left;padding:8px 0}.processed-ceiling h4{margin:22px 0 10px}.processed-ceiling .section-note{font-size:13px;line-height:1.6}@media(max-width:650px){.processed-ceiling-table{min-width:600px}.processed-ceiling-map text{font-size:12px}}@media print{.processed-ceiling-table-wrap{overflow:visible}.processed-ceiling-table{min-width:0}.processed-ceiling-map{max-height:380px}.processed-ceiling-reading strong{font-size:1.6rem}}';
