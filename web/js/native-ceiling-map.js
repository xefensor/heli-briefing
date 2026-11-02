/** Actual native ICON-EU centres only: no interpolation, terrain conversion or flight categories. */
import { escapeHtml as esc } from './charts.js';

const finite = value => typeof value === 'number' && Number.isFinite(value);
// Thousands of native-cell titles share three precisions; reuse Intl formatters.
const numberFormats = new Map([0, 2, 5].map(digits => [digits, new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: digits, maximumFractionDigits: digits })]));
const formatNumber = (value, digits = 0) => finite(value) ? numberFormats.get(digits).format(Object.is(value, -0) ? 0 : value) : '—';
const valueOk = value => value === null || finite(value) && value >= -1000 && value <= 50000;
const PALETTE = Object.freeze([
  { max: 500, color: '#e3e2ef', label: '< 500' },
  { max: 1000, color: '#bdb9da', label: '500–<1000' },
  { max: 1500, color: '#938cbd', label: '1000–<1500' },
  { max: 2000, color: '#71649f', label: '1500–<2000' },
  { max: 3000, color: '#524075', label: '2000–<3000' },
  { max: Infinity, color: '#34234e', label: '≥ 3000' },
]);
const PLACES = Object.freeze([
  { name: 'Č. Budějovice', lat: 48.9757, lon: 14.4803 },
  { name: 'Kvilda', lat: 49.0197, lon: 13.5794 },
  { name: 'Tábor', lat: 49.4144, lon: 14.6578 },
  { name: 'Praha', lat: 50.0755, lon: 14.4378 },
]);
const fail = () => { throw new Error('Regionální pole ICON-EU nemá ověřitelný zdroj, čas nebo geometrii.'); };
function validTime(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value)) return false;
  const at = Date.parse(value);
  return Number.isFinite(at) && new Date(at).toISOString().slice(0, 19) === value.slice(0, 19);
}
function inside(node, bounds) {
  return finite(node?.lat) && finite(node?.lon) && node.lat >= bounds[0][0] && node.lat <= bounds[1][0] && node.lon >= bounds[0][1] && node.lon <= bounds[1][1];
}
function validNode(node, bounds) {
  return inside(node, bounds) && valueOk(node.valueMsl) && Number.isInteger(node.index) && node.index >= 0 && node.index < 2000000;
}

/** Geometry/provenance validation shared by the live renderer and frozen export. */
export function validateNativeCeilingRegional(regional) {
  if (!regional || regional.model !== 'ICON-EU' || regional.product !== 'CEILING' || regional.units !== 'm MSL' ||
    !/^[a-f\d]{32}$/i.test(regional.gridUuid) || !['runTime', 'validAt', 'retrievedAt'].every(key => validTime(regional[key])) ||
    Date.parse(regional.validAt) < Date.parse(regional.runTime)) fail();
  const bounds = regional.bounds;
  if (!Array.isArray(bounds) || bounds.length !== 2 || bounds.some(pair => !Array.isArray(pair) || pair.length !== 2 || !pair.every(finite)) ||
    bounds[0][0] < -85 || bounds[1][0] > 85 || bounds[0][0] >= bounds[1][0] || bounds[0][1] < -180 || bounds[1][1] > 180 || bounds[0][1] >= bounds[1][1]) fail();
  if (!Array.isArray(regional.nodes) || regional.nodes.length > 2048 ||
    !Number.isInteger(regional.totalCells) || regional.totalCells < regional.nodes.length || regional.totalCells > 2000000 ||
    typeof regional.subset !== 'boolean' || regional.subset !== (regional.totalCells > regional.nodes.length)) fail();
  const indices = new Set();
  for (const node of regional.nodes) {
    if (!validNode(node, bounds) || indices.has(node.index)) fail();
    indices.add(node.index);
  }
  if (regional.selectedCell !== undefined && !validNode(regional.selectedCell, bounds)) fail();
  return regional;
}

export function nativeCeilingColour(value) {
  if (!valueOk(value) || value === null) return null;
  return PALETTE.find(item => value < item.max || item.max === Infinity).color;
}
const mercator = lat => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
const r = value => Number(value.toFixed(3));
const unavailable = '<p class="native-ceiling-map-unavailable">Regionální pole CEILING není pro tento čas dostupné. Žádná plocha ani chybějící hodnota nebyla dopočtena.</p>';
function stamp(value, timezone) {
  return `${new Intl.DateTimeFormat('cs-CZ', { timeZone: timezone, day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value))} ${timezone === 'UTC' ? 'UTC' : 'CZ'}`;
}
function ticks(lo, hi, maximum) {
  const span = hi - lo;
  const step = [0.25, 0.5, 1, 2, 5, 10, 20, 30, 60, 90].find(value => span / value <= maximum) || 180;
  const values = [];
  for (let value = Math.ceil(lo / step) * step; value <= hi + 1e-8 && values.length < 30; value += step) values.push(r(value));
  return values;
}
function coordinate(value, positive, negative) { return `${formatNumber(Math.abs(value), 2)}° ${value < 0 ? negative : positive}`; }

/** Self-contained HTML/SVG, including a readable legend; it makes no remote requests. */
export function renderNativeCeilingMap(regional, { lat, lon, timezone = 'Europe/Prague', width = 720, selectedCell = regional?.selectedCell, idPrefix = 'native-ceiling-map' } = {}) {
  try { validateNativeCeilingRegional(regional); } catch { return unavailable; }
  if (!regional.nodes.length || !['UTC', 'Europe/Prague'].includes(timezone)) return unavailable;
  if (selectedCell !== undefined && !validNode(selectedCell, regional.bounds)) return unavailable;
  if (!finite(width)) width = 720;
  width = Math.max(280, Math.min(1000, width));
  const height = Math.round(Math.min(740, Math.max(330, width * 0.91)));
  const padding = { left: 64, right: 18, top: 18, bottom: 38 };
  const availableWidth = width - padding.left - padding.right, availableHeight = height - padding.top - padding.bottom;
  const [[south, west], [north, east]] = regional.bounds;
  const minX = west * Math.PI / 180, maxX = east * Math.PI / 180, minY = mercator(south), maxY = mercator(north);
  const scale = Math.min(availableWidth / (maxX - minX), availableHeight / (maxY - minY));
  const plotWidth = (maxX - minX) * scale, plotHeight = (maxY - minY) * scale;
  const left = padding.left + (availableWidth - plotWidth) / 2, top = padding.top + (availableHeight - plotHeight) / 2;
  const point = node => ({ x: left + (node.lon * Math.PI / 180 - minX) * scale, y: top + (maxY - mercator(node.lat)) * scale });
  const nodeRadius = Math.min(4, Math.max(1.6, Math.sqrt(plotWidth * plotHeight / Math.max(1, regional.totalCells)) * 0.29));
  const titleId = `${/^[a-z][a-z\d_-]{0,50}$/i.test(idPrefix) ? idPrefix : 'native-ceiling-map'}-title`;
  const descId = `${titleId}-description`;
  const grid = [...ticks(west, east, width < 480 ? 3 : 5).map(value => {
    const x = point({ lat: south, lon: value }).x;
    return `<path d="M${r(x)},${r(top)}V${r(top + plotHeight)}" stroke="#d6dee4" stroke-width="0.8"/><text x="${r(x)}" y="${r(top + plotHeight + 22)}" text-anchor="middle" fill="#405261" font-size="12">${esc(coordinate(value, 'E', 'W'))}</text>`;
  }), ...ticks(south, north, width < 480 ? 3 : 5).map(value => {
    const y = point({ lat: value, lon: west }).y;
    return `<path d="M${r(left)},${r(y)}H${r(left + plotWidth)}" stroke="#d6dee4" stroke-width="0.8"/><text x="${r(left - 6)}" y="${r(y + 4)}" text-anchor="end" fill="#405261" font-size="12">${esc(coordinate(value, 'N', 'S'))}</text>`;
  })].join('');
  const nodes = regional.nodes.map(node => {
    const p = point(node), title = `Nativní buňka ${node.index} · ${formatNumber(node.lat, 5)}° N, ${formatNumber(node.lon, 5)}° E · ${node.valueMsl === null ? 'hodnota chybí' : formatNumber(node.valueMsl, 0) + ' m MSL'}`;
    return node.valueMsl === null
      ? `<path class="native-ceiling-node native-ceiling-node--missing" data-cell-index="${node.index}" d="M${r(p.x - nodeRadius)},${r(p.y - nodeRadius)}l${r(2 * nodeRadius)},${r(2 * nodeRadius)}m0,${r(-2 * nodeRadius)}l${r(-2 * nodeRadius)},${r(2 * nodeRadius)}" stroke="#6b7780" stroke-width="1" fill="none"><title>${esc(title)}</title></path>`
      : `<circle class="native-ceiling-node" data-cell-index="${node.index}" cx="${r(p.x)}" cy="${r(p.y)}" r="${r(nodeRadius)}" fill="${nativeCeilingColour(node.valueMsl)}" stroke="#61596f" stroke-width="0.5"><title>${esc(title)}</title></circle>`;
  }).join('');
  const labels = PLACES.filter(place => inside(place, regional.bounds)).map(place => {
    const p = point(place), anchor = p.x > left + plotWidth - 105 ? 'end' : 'start', x = p.x + (anchor === 'end' ? -6 : 6);
    const y = p.y < top + 20 ? p.y + 17 : p.y - 7;
    return `<g class="native-ceiling-place"><circle cx="${r(p.x)}" cy="${r(p.y)}" r="2.4" fill="#1d3443" stroke="#fff" stroke-width="1.2"/><text x="${r(x)}" y="${r(y)}" text-anchor="${anchor}" fill="#182d3b" stroke="#fff" stroke-width="3" paint-order="stroke" font-size="13" font-weight="600">${esc(place.name)}</text></g>`;
  }).join('');
  let selected = '';
  const locationInside = inside({ lat, lon }, regional.bounds);
  if (selectedCell) {
    const p = point(selectedCell);
    selected += `<circle class="native-ceiling-selected-cell" cx="${r(p.x)}" cy="${r(p.y)}" r="${r(Math.max(5, nodeRadius + 2))}" fill="none" stroke="#fff" stroke-width="4"/><circle cx="${r(p.x)}" cy="${r(p.y)}" r="${r(Math.max(5, nodeRadius + 2))}" fill="none" stroke="#1d3443" stroke-width="1.5"><title>Modelová buňka pro vybraný bod · ${selectedCell.valueMsl === null ? 'hodnota chybí' : esc(formatNumber(selectedCell.valueMsl, 0)) + ' m MSL'}</title></circle>`;
  }
  if (locationInside) {
    const p = point({ lat, lon });
    const d = `M${r(p.x - 7)},${r(p.y)}h14M${r(p.x)},${r(p.y - 7)}v14`;
    selected += `<path class="native-ceiling-selected-location" d="${d}" stroke="#fff" stroke-width="4"/><path d="${d}" stroke="#172d3b" stroke-width="1.5"><title>Vybraný bod · ${esc(formatNumber(lat, 5))}° N, ${esc(formatNumber(lon, 5))}° E</title></path>`;
  }
  const shownValues = regional.nodes.filter(node => node.valueMsl !== null).length;
  const markerNote = `${selectedCell ? `Kroužek: modelová buňka ${selectedCell.index}${selectedCell.valueMsl === null ? ' · hodnota chybí' : ' · ' + formatNumber(selectedCell.valueMsl) + ' m MSL'}. ` : ''}${locationInside ? 'Kříž: vybraný bod.' : finite(lat) && finite(lon) ? 'Vybraný bod leží mimo zobrazený výřez.' : ''}`;
  const legend = PALETTE.map(item => `<li style="display:flex;align-items:center;gap:7px"><span aria-hidden="true" style="display:inline-block;width:18px;height:14px;border:1px solid #737887;background:${item.color}"></span><span>${esc(item.label)} m MSL</span></li>`).join('');
  return `<figure class="native-ceiling-map" style="margin:20px 0"><figcaption><strong>Regionální modelový CEILING · ICON-EU</strong><p style="margin:6px 0;font-size:13px;line-height:1.6">Platnost ${esc(stamp(regional.validAt, timezone))} · běh ${esc(stamp(regional.runTime, timezone))} · staženo ${esc(stamp(regional.retrievedAt, timezone))}.</p></figcaption><svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="${titleId} ${descId}" viewBox="0 0 ${r(width)} ${height}" style="display:block;width:100%;height:auto;background:#fafbfc;border:1px solid #ccd6dd;border-radius:4px"><title id="${titleId}">ICON-EU CEILING · skutečné nativní buňky · m MSL</title><desc id="${descId}">Body jsou skutečné středy nativních buněk, nikoli souvislá předpovědní plocha. ${regional.nodes.length} z ${regional.totalCells} buněk výřezu, ${shownValues} s číselnou hodnotou. Křížky místo barevných bodů označují chybějící hodnoty. ${esc(markerNote)}</desc><rect x="${r(left)}" y="${r(top)}" width="${r(plotWidth)}" height="${r(plotHeight)}" fill="none" stroke="#8595a2" stroke-width="1"/>${grid}${nodes}${labels}${selected}</svg><ul aria-label="Výška CEILING v metrech MSL" style="display:flex;flex-wrap:wrap;gap:8px 20px;padding:0;margin:12px 0;list-style:none;font-size:13px;line-height:1.5">${legend}<li>× hodnota chybí</li></ul><p style="margin:8px 0;font-size:13px;line-height:1.6">${regional.nodes.length} / ${regional.totalCells} skutečných buněk výřezu${regional.subset ? ' · zobrazen pravidelný podvýběr skutečných středů, bez interpolace' : ''}. ${esc(markerNote)} Prázdné plochy ani chybějící hodnoty nepotvrzují jasnou oblohu.</p><p style="margin:8px 0;font-size:13px;line-height:1.6">Samostatný produkt DWD ICON-EU: první výška s pokrytím přes 50 %, bez konvektivní složky. Výšky jsou nad mořem (MSL), nikoli AGL nebo pozorování METAR. Barvy vyjadřují výšky, nikoli provozní minima. Nejde o původní mapu nízké oblačnosti ČHMÚ.</p></figure>`;
}
