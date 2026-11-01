import { profileFields, normalizeProfile } from './profile.js';
/**
 * Explicit-model forecasts for the public, open-source evaluation build.
 * Open-Meteo free hosted access is for evaluation/non-commercial use. Professional
 * production use needs an appropriate service agreement and a server-side adapter;
 * never add a paid API key to this browser module.
 * Checked 2026-11-01: https://open-meteo.com/en/terms
 */

export const MODELS = Object.freeze([
  Object.freeze({
    id: 'aladin', label: 'ALADIN', provider: 'ČHMÚ · Open-Meteo',
    apiModel: 'chmi_aladin_central_europe_2km', resolution: '2,3 km',
    description: 'Střední Evropa · fyzikální model 2,325 km · hodinový výstup',
    color: '#48cbb6', docsUrl: 'https://open-meteo.com/en/docs/chmi-api',
  }),
  Object.freeze({
    id: 'icon', label: 'ICON-D2', provider: 'DWD · Open-Meteo',
    apiModel: 'icon_d2', resolution: '2,1 km',
    description: 'Regionální model · omezená oblast a předpovědní horizont',
    color: '#e5b966', docsUrl: 'https://open-meteo.com/en/docs/dwd-api',
  }),
  Object.freeze({
    id: 'ecmwf', label: 'ECMWF IFS', provider: 'ECMWF · Open-Meteo',
    apiModel: 'ecmwf_ifs', resolution: '9 km',
    description: 'Globální IFS HRES · tento výstup neposkytuje tlakové hladiny',
    color: '#91a7f3', docsUrl: 'https://open-meteo.com/en/docs/ecmwf-api',
  }),
]);

const API = 'https://api.open-meteo.com/v1/forecast';
const CACHE_VERSION = 2;
const CACHE_PREFIX = 'heli-forecast-v2:';
const FRESH_MS = 10 * 60 * 1000;
const MAX_STALE_MS = 6 * 60 * 60 * 1000;
const FIELDS = Object.freeze({
  temperature: ['temperature_2m', '°C'],
  dewpoint: ['dew_point_2m', '°C'],
  humidity: ['relative_humidity_2m', '%'],
  pressure: ['pressure_msl', 'hPa'],
  wind: ['wind_speed_10m', 'kn'],
  gust: ['wind_gusts_10m', 'kn'],
  direction: ['wind_direction_10m', '°'],
  precipitation: ['precipitation', 'mm'],
  cloudLow: ['cloud_cover_low', '%'],
  cloudMid: ['cloud_cover_mid', '%'],
  cloudHigh: ['cloud_cover_high', '%'],
  visibility: ['visibility', 'm'],
  wind925: ['wind_speed_925hPa', 'kn'],
  height925: ['geopotential_height_925hPa', 'm'],
});

export class ForecastError extends Error {
  constructor(message, { code = 'unavailable', status = null, retryAt = null } = {}) {
    super(message);
    this.name = 'ForecastError';
    this.code = code;
    this.status = status;
    this.retryAt = retryAt;
  }
}

function modelDefinition(model) {
  const found = MODELS.find(item => item.id === model);
  if (!found) throw new ForecastError('Neznámý předpovědní model.', { code: 'model' });
  return found;
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function coordinates(lat, lon) {
  if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90 ||
      typeof lon !== 'number' || !Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new ForecastError('Neplatné zeměpisné souřadnice.', { code: 'location' });
  }
}

function abortError(reason) {
  return reason instanceof Error ? reason : new DOMException('Požadavek byl zrušen.', 'AbortError');
}

function cacheKey(lat, lon, model) {
  // Exact requested coordinates prevent one selected point inheriting another's data.
  return `${CACHE_PREFIX}${model}:${lat}:${lon}`;
}

function requestedFields(model) {
  return [...new Set([...Object.entries(FIELDS)
    .filter(([key]) => model.id !== 'ecmwf' || !['wind925', 'height925'].includes(key))
    .map(([, [apiField]]) => apiField), ...(model.id === 'ecmwf' ? [] : profileFields())])];
}

export function forecastUrl({ lat, lon, model }) {
  coordinates(lat, lon);
  const definition = modelDefinition(model);
  const query = new URLSearchParams({
    latitude: String(lat), longitude: String(lon),
    hourly: requestedFields(definition).join(','), models: definition.apiModel,
    temperature_unit: 'celsius', wind_speed_unit: 'kn', precipitation_unit: 'mm',
    timezone: 'GMT', timeformat: 'unixtime', forecast_days: '3',
  });
  return `${API}?${query}`;
}

/** Normalize without interpolating, inventing values, or identifying a model run. */
export function normalizeForecast(payload, { lat, lon, model, retrievedAt = new Date().toISOString() }) {
  coordinates(lat, lon);
  const definition = modelDefinition(model);
  if (!payload || payload.error || !payload.hourly || !Array.isArray(payload.hourly.time) || payload.hourly_units?.time !== 'unixtime') {
    throw new ForecastError('Zdroj nevrátil očekávanou hodinovou předpověď.', { code: 'format' });
  }
  const timestamps = payload.hourly.time;
  if (!timestamps.length || timestamps.length > 400) {
    throw new ForecastError('Předpověď nemá platnou časovou osu.', { code: 'format' });
  }
  const times = timestamps.map((value, index) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 8640000000000 ||
        (index && value <= timestamps[index - 1])) {
      throw new ForecastError('Předpověď obsahuje neplatné nebo neuspořádané časy.', { code: 'format' });
    }
    return new Date(value * 1000).toISOString();
  });
  if (!Number.isFinite(Date.parse(retrievedAt))) {
    throw new ForecastError('Neplatný čas stažení předpovědi.', { code: 'format' });
  }
  const hourly = {};
  const units = {};
  const coverage = {};
  const capabilities = {};
  for (const [key, [apiField, unit]] of Object.entries(FIELDS)) {
    const supported = definition.id !== 'ecmwf' || !['wind925', 'height925'].includes(key);
    const raw = payload.hourly[apiField];
    const unitMatches = payload.hourly_units?.[apiField] === unit;
    hourly[key] = times.map((_, i) => supported && unitMatches && Array.isArray(raw) ? finiteNumber(raw[i]) : null);
    units[key] = unit;
    coverage[key] = hourly[key].filter(value => value !== null).length;
    capabilities[key] = {
      requested: supported, available: coverage[key] > 0,
      count: coverage[key], total: times.length,
      reason: !supported ? 'unsupported-model-field' : !unitMatches ? 'missing-or-unexpected-unit' : coverage[key] ? null : 'no-values',
    };
  }
  // API elevation is its terrain/downscaling reference, not verified native model terrain.
  const terrain = finiteNumber(payload.elevation);
  const belowTerrain = times.map((_, i) => terrain !== null && hourly.height925[i] !== null && hourly.height925[i] <= terrain);
  for (let i = 0; i < times.length; i++) {
    if (belowTerrain[i]) hourly.wind925[i] = null;
  }
  coverage.wind925 = hourly.wind925.filter(value => value !== null).length;
  capabilities.wind925.count = coverage.wind925;
  capabilities.wind925.available = coverage.wind925 > 0;
  const usable = times.map((_, i) => Object.values(hourly).some(values => values[i] !== null));
  const first = usable.indexOf(true);
  const last = usable.lastIndexOf(true);
  return {
    model: definition.id, label: definition.label, apiModel: definition.apiModel,
    provider: definition.provider, resolution: definition.resolution,
    requestedLocation: { lat, lon },
    grid: { lat: finiteNumber(payload.latitude), lon: finiteNumber(payload.longitude), elevation: terrain },
    retrievedAt: new Date(retrievedAt).toISOString(), runTime: null,
    times, hourly, units, coverage, capabilities, belowTerrain, profile: normalizeProfile(payload,model,times.length),
    validFrom: first === -1 ? null : times[first], validTo: last === -1 ? null : times[last],
    sourceUrl: forecastUrl({ lat, lon, model }), docsUrl: definition.docsUrl,
    transport: { status: 'live', cached: false, stale: false, ageMs: 0, error: null },
    semantics: {
      pressure: 'Mean sea-level pressure forecast; not measured QNH or QFE.',
      precipitation: 'Total during the preceding hour ending at the timestamp.',
      gust: 'Maximum during the preceding hour ending at the timestamp.',
      visibility: 'Model forecast in metres, not a local observation.',
      clouds: 'Layer cloud fractions, not cloud-base height or aviation ceiling.',
      height925: '925 hPa geopotential height in metres MSL; not a fixed AGL height.',
      wind925: definition.id === 'icon'
        ? 'Open-Meteo pressure-level output; 925 hPa is not a native ICON-D2 level. Open-Meteo documents interpolation from neighbouring native pressure levels.'
        : definition.id === 'ecmwf' ? 'Pressure levels are not provided by this 9 km distribution.' : 'Wind at the 925 hPa pressure surface.',
      elevation: 'Open-Meteo elevation/downscaling reference; not independently verified native model terrain.',
      runTime: 'Ordinary API combines successive runs; initialization is not supplied. Retrieval time is separate.',
    },
  };
}

function copy(value) {
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function withTransport(value, now, status, error = null) {
  const result = copy(value);
  const ageMs = Math.max(0, now - Date.parse(result.retrievedAt));
  result.transport = {
    status, cached: status !== 'live', stale: status === 'stale', ageMs,
    error: error ? { message: error.message, code: error.code || 'network', status: error.status || null, retryAt: error.retryAt || null } : null,
  };
  return result;
}

/** Each caller owns its request/abort. Only the latest same-key request may cache. */
export function createForecastClient({
  fetchImpl = (...args) => globalThis.fetch(...args),
  storage = undefined,
  now = () => Date.now(),
  timeoutMs = 18000,
} = {}) {
  const memory = new Map();
  const sequence = new Map();
  function session() {
    if (storage !== undefined) return storage;
    try { return globalThis.sessionStorage; } catch { return null; }
  }
  function read(key, options) {
    let item = memory.get(key);
    if (!item) {
      try {
        item = JSON.parse(session()?.getItem(key) || 'null');
      } catch { return null; }
    }
    if (item?.version !== CACHE_VERSION || item?.data?.model !== options.model ||
        item?.data?.requestedLocation?.lat !== options.lat || item?.data?.requestedLocation?.lon !== options.lon ||
        !Array.isArray(item.data.times) || !item.data.times.length ||
        !Number.isFinite(Date.parse(item.data.retrievedAt))) return null;
    const age = now() - Date.parse(item.data.retrievedAt);
    // A future-dated cache is not fresh; it can indicate a changed device clock.
    if (age < 0 || age > MAX_STALE_MS) return null;
    return item;
  }
  function save(key, data) {
    const item = { version: CACHE_VERSION, data };
    memory.set(key, item);
    // Bound memory and session footprint; private coordinates stay in this tab.
    if (memory.size > 18) memory.delete(memory.keys().next().value);
    try {
      const store = session();
      if (!store) return;
      store.setItem(key, JSON.stringify(item));
      const keys = [];
      for (let i = 0; i < store.length; i++) if (store.key(i)?.startsWith(CACHE_PREFIX)) keys.push(store.key(i));
      if (keys.length > 18) {
        keys.sort((a, b) => {
          try { return Date.parse(JSON.parse(store.getItem(a)).data.retrievedAt) - Date.parse(JSON.parse(store.getItem(b)).data.retrievedAt); }
          catch { return 0; }
        });
        keys.slice(0, keys.length - 18).forEach(oldKey => store.removeItem(oldKey));
      }
    } catch { /* Storage denial/quota must not fail a valid provider response. */ }
  }
  async function fetchForecast({ lat, lon, model, signal, force = false }) {
    coordinates(lat, lon);
    modelDefinition(model);
    if (signal?.aborted) throw abortError(signal.reason);
    const key = cacheKey(lat, lon, model);
    const cached = read(key, { lat, lon, model });
    if (!force && cached && now() - Date.parse(cached.data.retrievedAt) < FRESH_MS) {
      return withTransport(cached.data, now(), 'cached');
    }
    const request = (sequence.get(key) || 0) + 1;
    sequence.set(key, request);
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort(signal.reason);
    signal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      const response = await fetchImpl(forecastUrl({ lat, lon, model }), {
        signal: controller.signal, headers: { Accept: 'application/json' }, cache: 'no-store',
      });
      if (!response.ok) {
        const retry = response.headers?.get('Retry-After');
        const retryAt = retry && /^\d+$/.test(retry) ? new Date(now() + Number(retry) * 1000).toISOString()
          : retry && Number.isFinite(Date.parse(retry)) ? new Date(retry).toISOString() : null;
        throw new ForecastError(response.status === 429 ? 'Zdroj omezuje počet požadavků. Zkuste aktualizaci později.' : `Předpověď není dostupná (HTTP ${response.status}).`, {
          code: response.status === 429 ? 'rate-limit' : 'http', status: response.status, retryAt,
        });
      }
      const payload = await response.json();
      if (signal?.aborted) throw abortError(signal.reason);
      if (timedOut) throw new ForecastError('Zdroj neodpověděl včas.', { code: 'timeout' });
      const result = normalizeForecast(payload, { lat, lon, model, retrievedAt: new Date(now()).toISOString() });
      if (sequence.get(key) === request) save(key, result);
      return result;
    } catch (error) {
      if (signal?.aborted) throw abortError(signal.reason);
      const failure = timedOut ? new ForecastError('Zdroj neodpověděl včas.', { code: 'timeout' })
        : error instanceof ForecastError ? error : new ForecastError('Předpověď se nepodařilo načíst. Zkontrolujte připojení nebo dostupnost zdroje.', { code: 'network' });
      if (cached) return withTransport(cached.data, now(), 'stale', failure);
      throw failure;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
  }
  return { fetchForecast };
}

const defaultClient = createForecastClient();
export const fetchForecast = options => defaultClient.fetchForecast(options);

/** Returns -1 outside the provided horizon, rather than clamping to old weather. */
export function nearestTimeIndex(times, instant) {
  const wanted = instant instanceof Date ? instant.getTime() : typeof instant === 'number' ? instant : Date.parse(instant);
  if (!Array.isArray(times) || !times.length || !Number.isFinite(wanted)) return -1;
  const first = Date.parse(times[0]);
  const last = Date.parse(times[times.length - 1]);
  if (wanted < first || wanted > last) return -1;
  let lo = 0;
  let hi = times.length - 1;
  while (lo < hi) {
    const middle = Math.floor((lo + hi) / 2);
    if (Date.parse(times[middle]) < wanted) lo = middle + 1;
    else hi = middle;
  }
  return lo > 0 && wanted - Date.parse(times[lo - 1]) <= Date.parse(times[lo]) - wanted ? lo - 1 : lo;
}

/** Start/end inclusive for instantaneous chart samples, not interval totals. */
export function forecastWindowIndices(times, start, hours) {
  const begin = start instanceof Date ? start.getTime() : typeof start === 'number' ? start : Date.parse(start);
  if (!Number.isFinite(begin) || !Number.isFinite(hours) || hours <= 0) return [];
  const end = begin + hours * 3600000;
  return times.reduce((result, time, index) => {
    const value = Date.parse(time);
    if (value >= begin && value <= end) result.push(index);
    return result;
  }, []);
}
