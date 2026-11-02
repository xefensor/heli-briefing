/** Native DWD diagnostic, independent of the selected surface forecast. */
const VALID_STATUSES = new Set(['ok', 'partial', 'stale', 'unavailable']);
const finite = (value) => typeof value === 'number' && Number.isFinite(value);

export function validateClouds(data) {
  if (!data || data.schemaVersion !== 1 || !VALID_STATUSES.has(data.status) ||
      !['ICON-D2', 'ICON-EU'].includes(data.model) || data.product !== 'CEILING' || data.units !== 'm MSL' ||
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
    sourceUrl: data?.sourceUrl ?? null, units: 'm MSL', model: data?.model || 'ICON-D2', product: 'CEILING',
    attribution: data?.attribution || 'DWD',
    definition: data?.definition, documentationUrl: data?.documentationUrl,
    archiveUrl: data?.archiveUrl, licenceUrl: data?.licenceUrl,
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
  const limit = data.model === 'ICON-EU' ? 8 : 3.5;
  const maxDistance = Math.min(limit, finite(data.grid?.maxDistanceKm) ? data.grid.maxDistanceKm : limit);
  if (index < 0 || nearest > maxDistance) return { ...base, status: 'outside-grid', distanceKm: nearest };
  const cell = { ...data.points[index], gridUuid: data.grid.uuid || null };
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
  if (frame.status && frame.status !== 'ok') return { ...common, status: 'unavailable',
    valueMsl: null, validAt: null, retrievedAt: null, error: frame.error || 'Požadovaná hodina nebyla potvrzena u zdroje.',
    sourceUrl: frame.sourceUrl || common.sourceUrl };
  const valueMsl = frame.values[index] ?? null;
  const retrievedAt = Object.hasOwn(frame, 'retrievedAt') ? frame.retrievedAt : common.retrievedAt;
  const regional = data.model === 'ICON-EU' ? {
    model: data.model, product: 'CEILING', units: 'm MSL', runTime: data.runTime,
    validAt: frame.validAt, retrievedAt,
    gridUuid: data.grid.uuid, bounds: [[south, west], [north, east]],
    totalCells: data.grid.totalCellsInBounds || data.points.length,
    subset: (data.grid.totalCellsInBounds || data.points.length) > data.points.length,
    nodes: data.points.map((point, i) => ({ lat: point.lat, lon: point.lon, index: point.index, valueMsl: frame.values[i] ?? null })),
    selectedCell: { ...cell, valueMsl },
  } : undefined;
  return { ...common, status: valueMsl === null ? 'missing' : 'available', valueMsl,
    validAt: frame.validAt, retrievedAt, error: frame.error || common.error,
    sourceUrl: frame.sourceUrl || common.sourceUrl, ...(regional ? { regional } : {}) };
}

export const CLOUD_STATUS_LABELS = Object.freeze({
  unavailable: 'Nativní cloudový produkt není dostupný.',
  'outside-region': 'Bod je mimo načtený regionální výřez.',
  'outside-grid': 'V tomto bodě není blízká buňka nativní sítě.',
  'outside-horizon': 'Pro vybraný čas není dostupný nativní výstup.',
  expired: 'Poslední nativní běh je již mimo svůj předpovědní horizont.',
  missing: 'Model zde nevrátil definovaný CEILING. Neznamená to jasnou oblohu.',
  available: 'Modelová výška CEILING nad hladinou moře.',
});
