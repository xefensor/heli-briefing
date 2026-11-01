export const TERRAIN_URL = 'https://ags.cuzk.gov.cz/arcgis2/rest/services/dmr5g/ImageServer/identify';
export const TERRAIN_TERMS = 'https://cuzk.gov.cz/Predpisy/Podminky-poskytovani-prostor-dat-a-sitovych-sluzeb/Podminky-poskytovani-sitovych-sluzeb-CUZK.aspx';
const finite = value => typeof value === 'number' && Number.isFinite(value);

export function terrainUrl(points) {
  if (!Array.isArray(points) || !points.length || points.length > 64 || points.some(point => !finite(point.lat) || !finite(point.lon) || Math.abs(point.lat) > 90 || Math.abs(point.lon) > 180)) throw new Error('Neplatné body terénu.');
  return `${TERRAIN_URL}?${new URLSearchParams({ f: 'json', geometryType: 'esriGeometryMultipoint', geometry: JSON.stringify({ points: points.map(point => [point.lon, point.lat]), spatialReference: { wkid: 4326 } }), renderingRule: JSON.stringify({ rasterFunction: 'None' }), returnGeometry: 'false', returnCatalogItems: 'false', returnPixelValues: 'false' })}`;
}

export function normalizeTerrain(payload, count) {
  // ArcGIS returns a single identify object for a one-point multipoint.
  const results = count === 1 && payload?.objectId === 0 ? [payload] : payload?.results;
  if (payload?.error || !Array.isArray(results)) throw new Error('ČÚZK nevrátil očekávané výškové vzorky.');
  const heights = Array(count).fill(null), ids = new Set();
  for (const item of results) {
    const id = item.objectId;
    if (!Number.isInteger(id) || id < 0 || id >= count || ids.has(id)) throw new Error('ČÚZK vrátil nejednoznačné pořadí vzorků.');
    ids.add(id);
    if (item.location?.spatialReference?.latestVcsWkid !== 8357 && item.location?.spatialReference?.vcsWkid !== 8357) throw new Error('Terén nemá očekávanou výškovou referenci Bpv.');
    const value = typeof item.value === 'string' && /^-?\d+(?:\.\d+)?$/.test(item.value.trim()) ? Number(item.value) : finite(item.value) ? item.value : null;
    heights[id] = finite(value) && value > -500 && value < 9000 ? value : null;
  }
  return heights;
}

export async function fetchTerrain(points, { signal, fetcher = (...args) => fetch(...args), now = () => new Date().toISOString() } = {}) {
  if (!points.length || points.length > 257) throw new Error('Terénní profil musí mít 1–257 vzorků.');
  const values = Array(points.length).fill(null), errors = [], urls = [];
  for (let start = 0; start < points.length; start += 64) {
    if (signal?.aborted) throw new DOMException('Zrušeno', 'AbortError');
    const chunk = points.slice(start, start + 64), url = terrainUrl(chunk); urls.push(url);
    try {
      const response = await fetcher(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(18000)]) : AbortSignal.timeout(18000), cache: 'no-cache', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`ČÚZK HTTP ${response.status}`);
      normalizeTerrain(await response.json(), chunk.length).forEach((height, index) => { values[start + index] = height; });
    } catch (error) { if (signal?.aborted) throw error; errors.push(error.message); if (/429/.test(error.message)) break; }
  }
  return { status: values.some(finite) ? values.every(finite) && !errors.length ? 'available' : 'partial' : 'unavailable', values, retrievedAt: now(), product: 'ČÚZK DMR 5G · rastr 2 m', verticalReference: 'Bpv / Baltic 1957 · EPSG:8357', units: 'm Bpv', sourceUrl: TERRAIN_URL, requestUrls: urls, termsUrl: TERRAIN_TERMS, attribution: 'ČÚZK – on-line', surveyTime: null, errors };
}
