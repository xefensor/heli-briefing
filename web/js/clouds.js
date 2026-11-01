/** Native ICON-D2 diagnostic, independent of the selected surface forecast. */
const URL_PATH = './data/clouds.json';
const VALID_STATUSES = new Set(['ok', 'partial', 'stale', 'unavailable']);
const finite = (value) => typeof value === 'number' && Number.isFinite(value);

export function validateClouds(data) {
  if (!data || data.schemaVersion !== 1 || !VALID_STATUSES.has(data.status) ||
      data.model !== 'ICON-D2' || data.product !== 'CEILING' || data.units !== 'm MSL' ||
      !Array.isArray(data.points) || !Array.isArray(data.frames)) {
    throw new Error('Neočekávaný formát nativní předpovědi výšky oblačnosti.');
  }
  if (data.status === 'unavailable' && !data.points.length && !data.frames.length) return data;
  if (!data.points.length || data.points.length > 25000 || !data.frames.length || data.frames.length > 73 ||
      !Number.isFinite(Date.parse(data.runTime)) || !Number.isFinite(Date.parse(data.retrievedAt)) ||
      !data.region || !data.grid || data.grid.type !== 'native-unstructured') {
    throw new Error('Předpověď nemá ověřitelnou oblast, běh nebo nativní síť.');
  }
  const { south, north, west, east } = data.region;
  if (![south, north, west, east].every(finite) || south >= north || west >= east || south < -90 || north > 90 || west < -180 || east > 180) {
    throw new Error('Předpověď má neplatné regionální pokrytí.');
  }
  for (const point of data.points) {
    if (!point || !finite(point.lat) || !finite(point.lon) || point.lat < south || point.lat > north || point.lon < west || point.lon > east ||
        (point.elevationMsl !== null && !finite(point.elevationMsl))) {
      throw new Error('Nativní síť obsahuje neplatný bod nebo výšku.');
    }
  }
  let previous = -Infinity;
  for (const frame of data.frames) {
    const time = Date.parse(frame.validAt);
    if (!Number.isFinite(time) || time <= previous || !Array.isArray(frame.values) || frame.values.length !== data.points.length ||
        frame.values.some(value => value !== null && (!finite(value) || Math.abs(value) > 1000000))) {
      throw new Error('Nativní hodnoty nejsou zarovnány se sítí a platností.');
    }
    previous = time;
  }
  return data;
}

export async function fetchClouds({ signal, force = false } = {}) {
  const timeout = AbortSignal.timeout(25000);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  // Revalidate one stable URL so unchanged regional snapshots can use HTTP validators.
  const response = await fetch(URL_PATH, { signal: combined, cache: force ? 'no-cache' : 'default' });
  if (!response.ok) throw new Error(`Nativní cloudový produkt: HTTP ${response.status}`);
  return validateClouds(await response.json());
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const a = Math.sin((lat2 - lat1) * rad / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin((lon2 - lon1) * rad / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

/** Nearest real native centre and hour; no interpolation/extrapolation or AGL claim. */
export function queryClouds(data, { lat, lon, time, nowMs = Date.now() } = {}) {
  const emptySeries = { times: [], values: [] };
  const base = {
    status: 'unavailable', valueMsl: null, cell: null, distanceKm: null,
    validAt: null, runTime: data?.runTime ?? null, retrievedAt: data?.retrievedAt ?? null,
    sourceUrl: data?.sourceUrl ?? null, units: 'm MSL', model: 'ICON-D2', product: 'CEILING',
    stale: data?.status === 'stale', error: data?.error ?? null, series: emptySeries,
  };
  if (!finite(lat) || !finite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180 || !Number.isFinite(Date.parse(time))) {
    return { ...base, error: 'Neplatné místo nebo čas přehledu.' };
  }
  if (!data || data.status === 'unavailable' || !data.points?.length || !data.frames?.length) return base;
  const { south, north, west, east } = data.region;
  if (lat < south || lat > north || lon < west || lon > east) return { ...base, status: 'outside-region' };
  let index = -1;
  let nearest = Infinity;
  data.points.forEach((point, i) => {
    const distance = distanceKm(lat, lon, point.lat, point.lon);
    if (distance < nearest) { index = i; nearest = distance; }
  });
  const maxDistance = Math.min(3.5, finite(data.grid?.maxDistanceKm) ? data.grid.maxDistanceKm : 3.5);
  if (index < 0 || nearest > maxDistance) return { ...base, status: 'outside-grid', distanceKm: nearest };
  const cell = data.points[index];
  const series = { times: data.frames.map(frame => frame.validAt), values: data.frames.map(frame => frame.values[index] ?? null) };
  const common = { ...base, cell, distanceKm: nearest, series, stale: base.stale || nowMs - Date.parse(data.runTime) > 9 * 3600000 };
  const instant = Date.parse(time);
  const first = Date.parse(series.times[0]);
  const last = Date.parse(series.times.at(-1));
  if (nowMs > last) return { ...common, status: 'expired' };
  if (instant < first || instant > last) return { ...common, status: 'outside-horizon' };
  let selected = -1;
  let delta = Infinity;
  data.frames.forEach((frame, i) => {
    const difference = Math.abs(Date.parse(frame.validAt) - instant);
    if (difference < delta) { delta = difference; selected = i; }
  });
  // Missing lead hours stay missing; an absent time step never inherits a
  // distant hour even when it is still inside the collection's overall range.
  if (selected < 0 || delta > 30 * 60000) return { ...common, status: 'outside-horizon' };
  const frame = data.frames[selected];
  const valueMsl = frame.values[index] ?? null;
  return { ...common, status: valueMsl === null ? 'missing' : 'available', valueMsl, validAt: frame.validAt, sourceUrl: frame.sourceUrl || common.sourceUrl };
}

export const CLOUD_STATUS_LABELS = Object.freeze({
  unavailable: 'Nativní cloudový produkt není dostupný.',
  'outside-region': 'Bod je mimo zpracovanou jihočeskou oblast.',
  'outside-grid': 'V tomto bodě není blízká buňka nativní sítě.',
  'outside-horizon': 'Pro vybraný čas není dostupný nativní výstup.',
  expired: 'Poslední nativní běh je již mimo svůj předpovědní horizont.',
  missing: 'Model zde nevrátil definovaný CEILING. Neznamená to jasnou oblohu.',
  available: 'Modelová výška CEILING nad hladinou moře.',
});
