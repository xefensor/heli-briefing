/** Bounded browser-local retention of actual direct ČHMÚ / MET Norway reports. */
import { METNO_PROVIDER, normalizeMetnoReport, metnoSourceUrl } from './metno-source.js';
import { AVIATION_API, AVIATION_STATIONS, AVIATION_FIRS, parseTacReport, mergeObservationHistory } from './aviation-source.js';

export const AVIATION_CACHE_KEY = 'heli-briefing.direct-aviation.v1';
export const AVIATION_CACHE_MAX_BYTES = 750_000;
const PROVIDER = 'chmi-swim';
const PROVIDERS = new Set([PROVIDER, 'chmi-swim+metno']);
const STATUSES = new Set(['ok', 'partial', 'stale', 'unavailable']);
const RESTORE_NOTE = 'Místní kopie z tohoto prohlížeče; živá obnova zdroje zatím nebyla potvrzena.';
const TOP_KEYS = new Set(['schemaVersion', 'provider', 'generatedAt', 'sourceName', 'attribution', 'documentationUrl', 'licenceStatus', 'catalogueCreatedAt', 'metar', 'taf', 'sigmet', 'radar', 'restoredFromCache', 'cacheSavedAt', 'restoredAt', 'supplementWarning', 'supplementDocumentationUrl', 'supplementLicenceUrl', 'supplementTermsUrl']);
const ITEM_KEYS = new Set(['id', 'kind', 'provider', 'station', 'fir', 'raw', 'observedAt', 'issuedAt', 'validFrom', 'validTo', 'receivedAt', 'retrievedAt', 'sourceUpdatedAt', 'sourceUrl', 'sourceFilename', 'source', 'timeReference', 'cancelled', 'nil', 'amended', 'corrected', 'transportStatus', 'refreshError', 'restoredFromCache']);
const SECTION_KEYS = new Set(['supplementSourceUrl', 'provider', 'items', 'sourceUrl', 'status', 'transportStatus', 'retrievedAt', 'attemptedAt', 'error', 'coverageComplete', 'coverageStatus', 'firScope', 'missingFirs', 'currentMessageCount', 'requestedStations', 'missingStations', 'history', 'historyStatus', 'historyMethod', 'historyPartial', 'historyHours', 'historyRetrievedAt', 'historyAttemptedAt', 'historySourceUrl', 'historyWindowFrom', 'historyWindowTo', 'historyLimitReached', 'historyUnknownTimeCount', 'historyFutureTimeCount', 'historyError', 'restoredFromCache', 'cacheSavedAt', 'restoredAt']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function fail() { throw new Error('Místní kopie leteckých zpráv nemá platný formát.'); }
function keys(value, allowed) { if (!object(value) || Object.keys(value).some(key => !allowed.has(key))) fail(); }
function text(value, limit = 5000, nullable = false) {
  if (nullable && value == null) return null;
  if (typeof value !== 'string' || value.length > limit) fail();
  return value;
}
function timestamp(value, nullable = false) {
  if (nullable && value == null) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value))) fail();
  const day = new Date(Date.UTC(+value.slice(0, 4), +value.slice(5, 7) - 1, +value.slice(8, 10)));
  if (day.getUTCFullYear() !== +value.slice(0, 4) || day.getUTCMonth() + 1 !== +value.slice(5, 7) || day.getUTCDate() !== +value.slice(8, 10) || +value.slice(11, 13) > 23 || +value.slice(14, 16) > 59 || value[16] === ':' && +value.slice(17, 19) > 59) fail();
  return value;
}
function clock(now) {
  const value = typeof now === 'function' ? now() : now;
  if (!Number.isFinite(value)) fail();
  return value;
}
function sourceUrl(value, filename = null) {
  const url = new URL(text(value, 1000));
  if (url.origin !== 'https://swim.chmi.cz' || url.pathname !== '/api.php' || url.hash || url.username || url.password) fail();
  const parameters = [...url.searchParams];
  const allowed = filename ? ['action', 'file', 'format'] : ['action', 'format'];
  if (parameters.length !== allowed.length || allowed.some(key => url.searchParams.getAll(key).length !== 1) || parameters.some(([key]) => !allowed.includes(key)) || url.searchParams.get('action') !== (filename ? 'get' : 'list') || url.searchParams.get('format') !== 'txt' || filename && url.searchParams.get('file') !== filename) fail();
  return value;
}
function report(value, kind, nowMs) {
  keys(value, ITEM_KEYS);
  if (value.kind !== kind || !object(value.source)) fail();
  const retrievedAt = timestamp(value.retrievedAt);
  if (Date.parse(retrievedAt) > nowMs + 300000) fail();
  let result;
  if (value.provider === PROVIDER) {
    if (Object.keys(value.source).length || !new RegExp(`^[A-Z]{4}_${kind === 'metar' ? '(?:METAR|SPECI)' : kind.toUpperCase()}\\.txt$`).test(value.sourceFilename)) fail();
    result = parseTacReport({ kind, raw: text(value.raw, 65536), filename: value.sourceFilename, updated: timestamp(value.sourceUpdatedAt, true), sourceUrl: sourceUrl(value.sourceUrl, value.sourceFilename), retrievedAt });
  } else if (value.provider === METNO_PROVIDER && kind !== 'sigmet') {
    if (Object.keys(value.source).some(key => key !== 'reportType') || value.sourceFilename !== null || value.sourceUpdatedAt !== null) fail();
    result = normalizeMetnoReport({ kind, station: value.station, raw: text(value.raw, 32768), reportType: value.source.reportType,
      observedAt: timestamp(value.observedAt, true), issuedAt: timestamp(value.issuedAt, true), validFrom: timestamp(value.validFrom, true), validTo: timestamp(value.validTo, true), retrievedAt, sourceUrl: value.sourceUrl });
  } else fail();
  for (const field of ['id', 'station', 'fir', 'observedAt', 'issuedAt', 'validFrom', 'validTo', 'cancelled', 'nil', 'amended', 'corrected']) if (value[field] !== result[field]) fail();
  if (value.receivedAt !== null) fail();
  if (value.transportStatus !== undefined) {
    if (!STATUSES.has(value.transportStatus)) fail();
    result.transportStatus = value.transportStatus;
  }
  if (value.refreshError !== undefined) result.refreshError = text(value.refreshError, 5000, true);
  return result;
}
function section(value, kind, nowMs) {
  keys(value, SECTION_KEYS);
  if (!PROVIDERS.has(value.provider) || kind === 'sigmet' && value.provider !== PROVIDER || !STATUSES.has(value.status) || !STATUSES.has(value.transportStatus) || !Array.isArray(value.items) || value.items.length > 64 || typeof value.coverageComplete !== 'boolean' || !['complete', 'partial', 'unknown'].includes(value.coverageStatus)) fail();
  const result = { provider: value.provider, items: value.items.map(item => report(item, kind, nowMs)), sourceUrl: sourceUrl(value.sourceUrl), status: value.status, transportStatus: value.transportStatus, retrievedAt: timestamp(value.retrievedAt, true), attemptedAt: timestamp(value.attemptedAt, true), error: text(value.error, 5000, true), coverageComplete: value.coverageComplete, coverageStatus: value.coverageStatus };
  if (value.supplementSourceUrl !== undefined) { if (kind === 'sigmet' || value.supplementSourceUrl !== metnoSourceUrl(kind)) fail(); result.supplementSourceUrl = value.supplementSourceUrl; }
  for (const field of ['firScope', 'missingFirs', 'requestedStations', 'missingStations']) if (value[field] !== undefined) {
    const scope = field.toLowerCase().includes('fir') ? AVIATION_FIRS : AVIATION_STATIONS;
    if (!Array.isArray(value[field]) || value[field].length > scope.length || value[field].some(id => !scope.includes(id))) fail();
    result[field] = [...value[field]];
  }
  for (const field of ['currentMessageCount', 'historyHours', 'historyUnknownTimeCount', 'historyFutureTimeCount']) if (value[field] !== undefined) {
    if (!Number.isInteger(value[field]) || value[field] < 0 || value[field] > 10000) fail();
    result[field] = value[field];
  }
  if (kind === 'sigmet' && result.coverageComplete) fail();
  if (kind === 'metar') {
    if (!Array.isArray(value.history) || value.history.length > 2000 || !['browser-observed', 'source-archive-and-browser'].includes(value.historyMethod) || value.historyPartial !== true || !STATUSES.has(value.historyStatus)) fail();
    result.history = mergeObservationHistory(value.history.map(item => report(item, 'metar', nowMs)), result.items, nowMs);
    result.historyStatus = result.history.length ? value.historyStatus : 'unavailable';
    result.historyMethod = value.historyMethod; result.historyPartial = true;
    for (const field of ['historyRetrievedAt', 'historyAttemptedAt', 'historyWindowFrom', 'historyWindowTo']) result[field] = timestamp(value[field], true);
    result.historySourceUrl = value.historySourceUrl === metnoSourceUrl('metar') ? value.historySourceUrl : sourceUrl(value.historySourceUrl);
    result.historyError = text(value.historyError, 5000, true);
    if (typeof value.historyLimitReached !== 'boolean') fail();
    result.historyLimitReached = value.historyLimitReached || result.history.length >= 400;
  }
  return result;
}
function snapshot(value, nowMs) {
  keys(value, TOP_KEYS);
  if (value.schemaVersion !== 1 || !PROVIDERS.has(value.provider)) fail();
  const generatedAt = timestamp(value.generatedAt);
  if (Date.parse(generatedAt) > nowMs + 300000 || value.documentationUrl !== 'https://swim.chmi.cz/info.php') fail();
  const result = { schemaVersion: 1, provider: value.provider, generatedAt, sourceName: text(value.sourceName, 300), attribution: text(value.attribution, 1000), documentationUrl: value.documentationUrl, licenceStatus: text(value.licenceStatus, 300) };
  if (value.supplementWarning !== undefined) result.supplementWarning = text(value.supplementWarning, 2000);
  const supplementUrls = { supplementDocumentationUrl: 'https://api.met.no/weatherapi/tafmetar/1.0/documentation', supplementLicenceUrl: 'https://api.met.no/doc/License', supplementTermsUrl: 'https://api.met.no/doc/TermsOfService' };
  for (const [key, url] of Object.entries(supplementUrls)) if (value[key] !== undefined) { if (value[key] !== url) fail(); result[key] = url; }
  if (value.catalogueCreatedAt !== undefined) result.catalogueCreatedAt = timestamp(value.catalogueCreatedAt, true);
  for (const kind of ['metar', 'taf', 'sigmet']) result[kind] = section(value[kind], kind, nowMs);
  if (![result.metar.items, result.metar.history, result.taf.items, result.sigmet.items].some(items => items.length)) fail();
  // Deliberately do not copy radar or any image payload from the main workspace.
  return result;
}
function storageOrNull(storage) {
  if (storage !== undefined) return storage;
  try { return globalThis.localStorage || null; } catch { return null; }
}
const bytes = value => new TextEncoder().encode(value).byteLength;

/** Restored reports retain source times and are always unconfirmed local copies. */
export function readAviationCache({ storage, now = Date.now } = {}) {
  try {
    const target = storageOrNull(storage); if (!target) return null;
    const raw = target.getItem(AVIATION_CACHE_KEY);
    if (typeof raw !== 'string' || raw.length > AVIATION_CACHE_MAX_BYTES || bytes(raw) > AVIATION_CACHE_MAX_BYTES) return null;
    const value = JSON.parse(raw);
    keys(value, new Set(['schemaVersion', 'provider', 'savedAt', 'aviation']));
    const nowMs = clock(now);
    if (value.schemaVersion !== 1 || !PROVIDERS.has(value.provider) || value.provider !== value.aviation?.provider || Date.parse(timestamp(value.savedAt)) > nowMs + 300000) return null;
    const restored = snapshot(value.aviation, nowMs), restoredAt = new Date(nowMs).toISOString();
    Object.assign(restored, { restoredFromCache: true, cacheSavedAt: value.savedAt, restoredAt });
    const mark = item => ({ ...item, transportStatus: 'stale', restoredFromCache: true });
    for (const kind of ['metar', 'taf', 'sigmet']) {
      const feed = restored[kind];
      feed.items = feed.items.map(mark);
      Object.assign(feed, { status: feed.items.length ? 'stale' : 'unavailable', transportStatus: feed.items.length ? 'stale' : 'unavailable', restoredFromCache: true, cacheSavedAt: value.savedAt, restoredAt, error: [RESTORE_NOTE, feed.error].filter(Boolean).join(' ') });
      if (kind === 'metar') { feed.history = feed.history.map(mark); feed.historyStatus = feed.history.length ? 'stale' : 'unavailable'; }
    }
    return restored;
  } catch { return null; }
}

/** Validate before a single atomic replacement; failure leaves an older cache intact. */
export function writeAviationCache(value, { storage, now = Date.now } = {}) {
  try {
    const nowMs = clock(now), aviation = snapshot(value, nowMs);
    const raw = JSON.stringify({ schemaVersion: 1, provider: aviation.provider, savedAt: new Date(nowMs).toISOString(), aviation });
    if (bytes(raw) > AVIATION_CACHE_MAX_BYTES) throw new Error('Místní historie zpráv překročila limit 750 kB; předchozí kopie zůstala zachována.');
    const target = storageOrNull(storage);
    if (!target) throw new Error('Místní úložiště zpráv není dostupné.');
    target.setItem(AVIATION_CACHE_KEY, raw);
    return { ok: true };
  } catch (error) { return { ok: false, error: error.message || 'Místní historii zpráv se nepodařilo uložit.' }; }
}
