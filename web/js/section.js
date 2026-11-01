import { haversineKm, formatTime, formatNumber, formatCoordinates } from './briefing.js';
import { profileAt } from './profile.js';
import { MODELS, nearestTimeIndex } from './weather.js';
import { escapeHtml as esc } from './charts.js';
import { fetchTerrain, TERRAIN_TERMS } from './terrain.js';
const finite = value => typeof value === 'number' && Number.isFinite(value);
const modelLabel = model => MODELS.find(item => item.id === model)?.label || model;
const reasonText = { 'below-terrain':'Pod terénem API · meteorologické hodnoty skryty', 'terrain-unknown':'Výška terénu API chybí', 'height-missing':'Výška hladiny chybí' };
const n = (value, digits = 0) => finite(value) ? formatNumber(value, digits) : '—';

export function sphericalPoint(a, b, fraction) {
  if (fraction === 0) return { lat: a.lat, lon: a.lon }; if (fraction === 1) return { lat: b.lat, lon: b.lon };
  const rad = Math.PI / 180, distance = haversineKm(a.lat, a.lon, b.lat, b.lon) / 6371.0088;
  if (distance < 1e-9 || Math.abs(Math.sin(distance)) < 1e-9) throw new Error('Řez nelze určit pro shodné nebo protilehlé sousední body.');
  const first = Math.sin((1 - fraction) * distance) / Math.sin(distance), second = Math.sin(fraction * distance) / Math.sin(distance);
  const vector = point => [Math.cos(point.lat * rad) * Math.cos(point.lon * rad), Math.cos(point.lat * rad) * Math.sin(point.lon * rad), Math.sin(point.lat * rad)];
  const v = vector(a).map((value, index) => value * first + vector(b)[index] * second);
  return { lat: Number((Math.atan2(v[2], Math.hypot(v[0], v[1])) / rad).toFixed(5)), lon: Number((Math.atan2(v[1], v[0]) / rad).toFixed(5)) };
}

/** Interpolate only planned position/time; never interpolate weather or elevations. */
export function sectionPositions(schedule, { limit = 17, targetKm = 5 } = {}) {
  if (!Array.isArray(schedule) || schedule.length < 2 || schedule.some(point => !point.passageAt)) throw new Error('Pro řez přidej alespoň dva body a doplň časy všech úseků.');
  if (schedule.some((point, index) => index && point.distanceKm - schedule[index - 1].distanceKm < .001)) throw new Error('Sousední shodné body nelze zobrazit v řezu podle vzdálenosti.');
  const distances = schedule.map(point => point.distanceKm), total = distances.at(-1);
  while (distances.length < limit) {
    let largest = 0, at = -1;
    for (let index = 1; index < distances.length; index++) if (distances[index] - distances[index - 1] > largest) { largest = distances[index] - distances[index - 1]; at = index; }
    if (largest <= targetKm || at < 0) break;
    distances.splice(at, 0, (distances[at - 1] + distances[at]) / 2);
  }
  return distances.map(distanceKm => {
    const node = schedule.find(point => Math.abs(point.distanceKm - distanceKm) < 1e-7);
    if (node) return { lat: node.lat, lon: node.lon, name: node.name, passageAt: node.passageAt, distanceKm };
    const index = schedule.findIndex(point => point.distanceKm > distanceKm), a = schedule[index - 1], b = schedule[index], fraction = (distanceKm - a.distanceKm) / (b.distanceKm - a.distanceKm);
    return { ...sphericalPoint(a, b, fraction), name: `Úsek ${index}`, distanceKm, passageAt: new Date(Date.parse(a.passageAt) + fraction * (Date.parse(b.passageAt) - Date.parse(a.passageAt))).toISOString() };
  });
}

export async function loadSection(schedule, model, { fetcher, terrainFetcher, signal, onProgress = () => {}, previousTerrain = null } = {}) {
  if (!MODELS.some(item => item.id === model)) throw new Error('Nepodporovaný model řezu.');
  const points = sectionPositions(schedule), terrainPoints = sectionPositions(schedule, { limit: 257, targetKm: .25 }), rows = Array(points.length), queue = { next: 0, finished: 0, limited: false };
  async function worker() {
    while (queue.next < points.length) {
      if (signal?.aborted) throw new DOMException('Zrušeno', 'AbortError');
      const index = queue.next++, point = points[index];
      let error = null, profile = { status: 'unavailable', levels: [] }, values = {}, validAt = null, retrievedAt = null, runTime = null, sourceUrl = null, stale = false;
      if (queue.limited) error = 'Zdroj omezil další požadavky.';
      else try {
        const f = await fetcher({ lat: point.lat, lon: point.lon, model, signal });
        if (f.model !== model || f.requestedLocation?.lat !== point.lat || f.requestedLocation?.lon !== point.lon) throw new Error('Vzorek patří jinému bodu nebo modelu.');
        retrievedAt = f.retrievedAt; runTime = f.runTime; sourceUrl = f.sourceUrl; stale = Boolean(f.transport?.stale);
        if (f.transport?.error?.status === 429) queue.limited = true;
        const at = nearestTimeIndex(f.times, point.passageAt);
        if (at < 0 || Math.abs(Date.parse(f.times[at]) - Date.parse(point.passageAt)) > 1800000) throw new Error('Pro průchod není blízký hodinový vzorek.');
        validAt = f.times[at]; profile = profileAt(f, point.passageAt);
        for (const field of ['wind', 'gust', 'visibility', 'cloudLow', 'precipitation']) values[field] = finite(f.hourly[field]?.[at]) ? f.hourly[field][at] : null;
        error = f.transport?.error?.message || null;
      } catch (failure) { if (signal?.aborted) throw failure; error = failure.message; if (failure.status === 429 || failure.code === 'rate-limit') queue.limited = true; }
      rows[index] = { ...point, profile, values, validAt, retrievedAt, runTime, sourceUrl, stale, error };
      onProgress(++queue.finished, points.length);
    }
  }
  const sameGeometry = previousTerrain && JSON.stringify(previousTerrain.points?.map(point => [point.lat, point.lon, point.distanceKm])) === JSON.stringify(terrainPoints.map(point => [point.lat, point.lon, point.distanceKm]));
  const terrainPromise = sameGeometry ? Promise.resolve(previousTerrain) : fetchTerrain(terrainPoints, { signal, fetcher: terrainFetcher }).then(data => ({ ...data, points: terrainPoints }));
  const [, , terrain] = await Promise.all([worker(), worker(), terrainPromise]);
  if (signal?.aborted) throw new DOMException('Zrušeno', 'AbortError');
  return { schemaVersion: 1, model, label: modelLabel(model), departure: schedule[0].passageAt, routePoints: schedule.map(point => ({ lat: point.lat, lon: point.lon, passageAt: point.passageAt, distanceKm: point.distanceKm })), rows, terrain, limited: queue.limited, capturedAt: new Date().toISOString() };
}

export function validateSection(section, schedule, model) {
  if (!section || section.schemaVersion !== 1 || section.model !== model || section.departure !== schedule[0]?.passageAt || JSON.stringify(section.routePoints) !== JSON.stringify(schedule.map(point => ({ lat: point.lat, lon: point.lon, passageAt: point.passageAt, distanceKm: point.distanceKm })))) throw new Error('Řez neodpovídá této trase a modelu.');
  const expected = sectionPositions(schedule), terrainExpected = sectionPositions(schedule, { limit: 257, targetKm: .25 });
  if (!Array.isArray(section.rows) || section.rows.length !== expected.length || section.terrain?.units !== 'm Bpv' || section.terrain.points?.length !== terrainExpected.length || section.terrain.values?.length !== terrainExpected.length) throw new Error('Řez má neplatné rozměry nebo výškovou referenci.');
  expected.forEach((point, index) => {
    const row = section.rows[index];
    if (['lat', 'lon', 'passageAt', 'distanceKm'].some(key => row[key] !== point[key]) || !Array.isArray(row.profile?.levels) || row.profile.levels.length > 6) throw new Error('Vzorky řezu patří jiné poloze nebo času.');
    if (row.validAt && (!Number.isFinite(Date.parse(row.validAt)) || Math.abs(Date.parse(row.validAt) - Date.parse(row.passageAt)) > 1800000)) throw new Error('Vzorek řezu je mimo čas průchodu.');
    row.profile.levels.forEach(level => { for (const key of ['height', 'wind', 'direction', 'temperature', 'humidity']) if (level[key] !== null && !finite(level[key])) throw new Error('Řez obsahuje neplatnou meteorologickou hodnotu.'); });
  });
  terrainExpected.forEach((point, index) => { if (['lat', 'lon', 'distanceKm'].some(key => section.terrain.points[index][key] !== point[key]) || section.terrain.values[index] !== null && !finite(section.terrain.values[index])) throw new Error('Terén patří jinému řezu.'); });
  return section;
}

function fieldColor(field, value) {
  const fraction = Math.max(0, Math.min(1, field === 'wind' ? value / 40 : field === 'temperature' ? (value + 20) / 40 : value / 100));
  const first = field === 'temperature' ? [58, 117, 197] : [206, 232, 244], last = field === 'temperature' ? [199, 105, 45] : [55, 62, 151];
  return `rgb(${first.map((value, index) => Math.round(value + fraction * (last[index] - value))).join(',')})`;
}
function panel(section, field, title, unit, interactive, selected) {
  const width = 900, height = 260, left = 62, right = 876, top = 24, bottom = 220, total = section.rows.at(-1).distanceKm || 1;
  const levels = section.rows.flatMap(row => row.profile.levels).filter(level => finite(level.height)), highest = Math.max(3500, ...levels.map(level => level.height)) * 1.05;
  const x = distance => left + distance / total * (right - left), y = value => bottom - value / highest * (bottom - top);
  return `<div class="section-plot-scroll"><svg class="section-plot" data-section-field="${field}" viewBox="0 0 ${width} ${height}" role="${interactive ? 'group' : 'img'}" aria-label="${esc(title)} podél trasy, pouze skutečné vzorky"><text x="5" y="15">m MSL</text>${[0, 1000, 2000, 3000].map(value => `<line x1="${left}" x2="${right}" y1="${y(value)}" y2="${y(value)}" stroke="var(--line,#d6dfe5)"/><text x="${left - 8}" y="${y(value) + 4}" text-anchor="end">${value}</text>`).join('')}${section.rows.map((row, index) => `<g data-section-sample="${index}" ${interactive ? `role="button" tabindex="${index === selected ? 0 : -1}" aria-pressed="${index === selected}"` : ''} aria-label="Vzorek ${index + 1}, ${n(row.distanceKm, 1)} km, ${esc(formatTime(row.passageAt, 'UTC', true))} UTC"><line x1="${x(row.distanceKm)}" x2="${x(row.distanceKm)}" y1="${top}" y2="${bottom}" stroke="var(--line,#d6dfe5)" stroke-dasharray="2 6"/>${row.profile.levels.filter(level => finite(level.height) && finite(level[field])).map(level => `<circle cx="${x(row.distanceKm)}" cy="${y(level.height)}" r="7" fill="${fieldColor(field, level[field])}" stroke="var(--text,#192d3d)" stroke-width=".5"><title>${esc(`${title}: ${n(level[field], 1)} ${unit}; ${n(level.height)} m MSL; ${level.pressureHpa} hPa; směr ${n(level.direction)}°; ${row.name}`)}</title></circle>`).join('') || `<text x="${x(row.distanceKm)}" y="${bottom - 10}" text-anchor="middle">×</text>`}</g>`).join('')}${[0, .25, .5, .75, 1].map(fraction => `<text x="${x(total * fraction)}" y="245" text-anchor="middle">${n(total * fraction, 1)} km</text>`).join('')}</svg></div><p class="section-note">${esc(title)} · ${unit}. ${field === 'humidity' ? 'Tmavší bod znamená vyšší relativní vlhkost. Vlhkost není oblačnost ani námraza.' : 'Každý bod je vzorek tlakové hladiny; přesné hodnoty jsou níže.'}</p>`;
}

export function renderSection(section, { zone = 'Europe/Prague', selected = 0, interactive = false } = {}) {
  if (!section) return '';
  selected = Math.max(0, Math.min(section.rows.length - 1, selected));
  const row = section.rows[selected], t = section.terrain, total = section.rows.at(-1).distanceKm;
  const valid = t.values.filter(finite), maxTerrain = Math.max(1, ...valid) * 1.1, x = distance => 62 + distance / (total || 1) * 814, y = value => 175 - value / maxTerrain * 140;
  let drawing = '', open = false;
  t.values.forEach((value, index) => { if (!finite(value)) { open = false; return; } drawing += `${open ? 'L' : 'M'}${x(t.points[index].distanceKm).toFixed(1)},${y(value).toFixed(1)} `; open = true; });
  const maxGap = points => Math.max(0, ...points.slice(1).map((point, index) => point.distanceKm - points[index].distanceKm));
  return `<section class="section-output"><h3>Výškový řez · ${esc(section.label)}</h3><p class="section-note">${section.rows.length} meteorologických vzorků, největší rozestup ${n(maxGap(section.rows), 1)} km. Poloha a plánovaný čas uvnitř přímých úseků jsou dopočítané ze zadaných dob. Počasí se mezi vzorky neinterpoluje. Hlavní model ovládá tento řez; porovnání modelů zůstává v bodových kartách.</p><p class="section-note">Barva kóduje číslo, nikoli letové limity: vítr světlý 0 → tmavý 40+ kt; teplota modrá −20 → oranžová +20 °C; RH světlá 0 → tmavá 100 %. Na telefonu lze řez posunout vodorovně.</p>${section.model === 'ecmwf' ? '<p class="route-attention">ECMWF IFS 9 km v tomto výstupu neposkytuje tlakové hladiny. Výškové grafy nejsou dostupné; povrchové vzorky a samostatný terén zůstávají zachované.</p>' : panel(section, 'wind', 'Vítr', 'kt', interactive, selected) + panel(section, 'temperature', 'Teplota', '°C', interactive, selected) + panel(section, 'humidity', 'Relativní vlhkost', '%', interactive, selected)}<div class="section-sample"><h4>Vzorek ${selected + 1} · ${n(row.distanceKm, 1)} km · ${esc(formatCoordinates(row.lat, row.lon))}</h4><p>Průchod ${esc(formatTime(row.passageAt, zone, true))} ${zone === 'UTC' ? 'UTC' : 'CZ'} · hodinový vzorek ${row.validAt ? esc(formatTime(row.validAt, zone, true)) : 'nedostupný'} · staženo ${row.retrievedAt ? esc(formatTime(row.retrievedAt, zone, true)) : 'nedostupné'} · běh ${row.runTime ? esc(formatTime(row.runTime, zone, true)) : 'API neuvádí'}${row.stale ? ' · STARŠÍ DATA' : ''}</p><p class="section-surface">Povrchový vzorek: vítr 10 m ${n(row.values.wind,1)} kt / nárazy ${n(row.values.gust,1)} kt · dohlednost ${n(row.values.visibility == null ? null : row.values.visibility/1000,1)} km · nízká oblačnost ${n(row.values.cloudLow)} % · srážky ${n(row.values.precipitation,1)} mm za předchozí hodinu. Pokrytí oblačností není ceiling.</p>${row.error ? `<p class="route-attention">${esc(row.error)}</p>` : ''}${row.profile.status === 'unsupported' ? '<p>ECMWF 9 km neposkytuje tyto tlakové hladiny. Zdroj nebyl nahrazen jiným modelem.</p>' : ''}<table><thead><tr><th>Hladina</th><th>Výška MSL</th><th>Vítr / odkud</th><th>Teplota</th><th>RH</th></tr></thead><tbody>${row.profile.levels.map(level => `<tr><th>${level.pressureHpa} hPa${level.interpolated ? ' · interp.' : ''}</th><td>${n(level.height)} m</td><td>${n(level.wind, 1)} kt / ${n(level.direction)}°</td><td>${n(level.temperature, 1)} °C</td><td>${n(level.humidity)} %${level.reason ? ` · ${esc(reasonText[level.reason] || level.reason)}` : ''}</td></tr>`).join('')}</tbody></table>${interactive ? '<p class="section-note">Klepni na sloupec řezu nebo použij šipky pro přesná čísla jiného vzorku.</p>' : ''}</div><h3>Terén · ČÚZK DMR 5G</h3><p class="section-note">Samostatná výšková reference Bpv (Baltic 1957), nikoli ověřené společné datum s modelem MSL. ${t.values.length} poloh, největší rozestup ${n(maxGap(t.points) * 1000)} m; výstupní rastr 2 m neznamená stejnou přesnost ani pokrytí všech vrcholů mezi vzorky. Žádná analýza překážek nebo bezpečné výšky.</p><div class="section-plot-scroll"><svg class="section-plot" viewBox="0 0 900 210" role="img" aria-label="Terén DMR 5G v metrech Bpv"><text x="5" y="15">m Bpv</text>${[0, .5, 1].map(fraction => `<text x="55" y="${y(maxTerrain * fraction) + 4}" text-anchor="end">${n(maxTerrain * fraction)}</text>`).join('')}<path d="${drawing}" fill="none" stroke="var(--chart-amber,#a86b13)" stroke-width="2"/>${[0, .5, 1].map(fraction => `<text x="${x(total * fraction)}" y="201" text-anchor="middle">${n(total * fraction, 1)} km</text>`).join('')}</svg></div><p>${valid.length ? `Rozsah vzorků ${n(Math.min(...valid))}–${n(Math.max(...valid))} m Bpv.` : 'Terénní hodnoty nejsou dostupné.'} ${t.errors.map(esc).join(' · ')}</p><p class="section-note">ČÚZK – on-line · <a href="${TERRAIN_TERMS}" target="_blank" rel="noopener noreferrer">Podmínky a metadata</a> · DMR 5G, EPSG:8357 · staženo ${esc(formatTime(t.retrievedAt, zone, true))} ${zone === 'UTC' ? 'UTC' : 'CZ'}. Doba zaměření jednotlivého vzorku není poskytnuta.</p></section>`;
}

export const SECTION_PRINT_CSS = '.section-plot{width:100%;height:auto}.section-plot text{font:13px sans-serif;fill:#192d3d}.section-note{font-size:12px;line-height:1.6}.section-sample table{width:100%;border-collapse:collapse}.section-sample th,.section-sample td{padding:8px;border-bottom:1px solid #ddd;text-align:left}.section-output h3{break-after:avoid}.section-plot-scroll{break-inside:avoid}';
