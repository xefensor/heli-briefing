/** Supplemental dated METAR/TAF archive from MET Norway's public API.
 * Checked 2026-11-02: https://api.met.no/weatherapi/tafmetar/1.0/documentation
 * This legacy endpoint is being replaced by national SWIM services. It is not
 * a complete regional warning service; no SIGMET absence is inferred here.
 */
export const METNO_PROVIDER = 'metno-tafmetar';
export const METNO_API = 'https://api.met.no/weatherapi/tafmetar/1.0/';
export const METNO_STATIONS = Object.freeze(['LKCS', 'LKHS', 'LKPR', 'LKKB', 'LKPD', 'LKTB', 'LKKV', 'LOWL', 'LOWW']);
export const METNO_WARNING = 'Doplňkový archiv MET Norway: skutečné dostupné zprávy za posledních 24 hodin, nikoli záruka úplnosti. Starší rozhraní má být nahrazeno národními SWIM službami; budoucí zahraniční dostupnost není zaručena.';
const FIVE_MINUTES = 300000, DAY = 86400000;
const requestCache = new Map();
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const iso = value => new Date(value).toISOString();
function fail(message = 'Odpověď MET Norway nemá platný formát.') { throw new Error(message); }
export function metnoSourceUrl(kind) {
  if (!['metar', 'taf'].includes(kind)) fail();
  return `${METNO_API}${kind}.xml?${new URLSearchParams({ icao: METNO_STATIONS.join(',') })}`;
}
function sourceUrl(value, kind) {
  const actual = new URL(value), expected = new URL(metnoSourceUrl(kind));
  if (actual.origin !== expected.origin || actual.pathname !== expected.pathname || actual.hash || actual.username || actual.password || [...actual.searchParams].length !== 1 || actual.searchParams.getAll('icao').length !== 1 || actual.searchParams.get('icao') !== METNO_STATIONS.join(',')) fail('Zpráva MET Norway má nepovolený zdroj.');
  return value;
}
function instant(value, nullable = false) {
  if (nullable && value === null) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value)) fail('Datum zprávy MET Norway není jednoznačné UTC.');
  const at = Date.parse(value);
  if (!Number.isFinite(at) || iso(at).slice(0, 19) !== value.slice(0, 19)) fail('Datum zprávy MET Norway není platné.');
  return iso(at);
}
function sourceTime(value) {
  if (typeof value !== 'string') fail();
  // This API documents its unqualified XML times as UTC, never local time.
  return instant(/Z$/.test(value) ? value : `${value}Z`);
}
function codeMatches(value, code, allow24 = false) {
  const at = new Date(value);
  const actual = `${String(at.getUTCDate()).padStart(2, '0')}${String(at.getUTCHours()).padStart(2, '0')}${String(at.getUTCMinutes()).padStart(2, '0')}`;
  if (code.length === 7) return `${actual}Z` === code;
  if (code.length !== 4) return false;
  if (actual.slice(0, 4) === code && at.getUTCMinutes() === 0) return true;
  return allow24 && code.slice(2) === '24' && at.getUTCHours() === 0 && at.getUTCMinutes() === 0 && String(new Date(+at - DAY).getUTCDate()).padStart(2, '0') === code.slice(0, 2);
}
/** Revalidation also used when restoring this provider's browser-local cache. */
export function normalizeMetnoReport({ kind, station, raw, reportType = '', observedAt = null, issuedAt = null, validFrom = null, validTo = null, retrievedAt, sourceUrl: url }) {
  if (!['metar', 'taf'].includes(kind) || !METNO_STATIONS.includes(station) || typeof raw !== 'string' || !raw.trim() || raw.length > 32768 || /[^\x09\x0a\x0d\x20-\x7e]/.test(raw) || typeof reportType !== 'string' || reportType.length > 30) fail();
  const allowedTypes = kind === 'metar' ? ['AUTO', 'SPECI', 'COR'] : ['AMD', 'COR'];
  if (reportType.split(/\s+/).filter(Boolean).some(word => !allowedTypes.includes(word))) fail('Neznámý typ zprávy MET Norway.');
  const compact = raw.trim().replace(/\s+/g, ' '), words = new Set(compact.match(/\b[A-Z]+\b/g));
  if (kind === 'metar' && /^TAF\b/.test(compact) || kind === 'taf' && /^(?:METAR|SPECI)\b/.test(compact)) fail('Typ XML a TAC MET Norway nesouhlasí.');
  const head = compact.replace(/^(?:METAR|SPECI|TAF)\s+/, '').replace(/^(?:(?:AMD|COR)\s+)+/, '');
  const match = /^([A-Z]{4})\s+(?:(\d{6}Z)\b|NIL\b)/.exec(head);
  if (!match || match[1] !== station) fail('Identita zprávy MET Norway nesouhlasí.');
  retrievedAt = instant(retrievedAt); observedAt = instant(observedAt, true); issuedAt = instant(issuedAt, true); validFrom = instant(validFrom, true); validTo = instant(validTo, true);
  const reportAt = kind === 'metar' ? observedAt : issuedAt;
  if (!reportAt || (kind === 'metar' ? issuedAt !== null || validFrom !== null || validTo !== null : observedAt !== null) || match[2] && !codeMatches(reportAt, match[2])) fail('Datum XML a TAC MET Norway nesouhlasí.');
  if (Date.parse(reportAt) > Date.parse(retrievedAt) + FIVE_MINUTES) fail('Zpráva MET Norway má budoucí čas vydání/pozorování.');
  if (kind === 'taf') {
    const validity = /\b(\d{4})\/(\d{4})\b/.exec(compact);
    if (validity && (!validFrom || !validTo || !codeMatches(validFrom, validity[1], true) || !codeMatches(validTo, validity[2], true))) fail('Platnost XML a TAC MET Norway nesouhlasí.');
    if (!validity && !words.has('NIL') && !words.has('CNL')) fail('TAF MET Norway neobsahuje platnost.');
    if ((validFrom === null) !== (validTo === null) || validFrom && (Date.parse(validTo) <= Date.parse(validFrom) || Date.parse(validTo) - Date.parse(validFrom) > 72 * 3600000)) fail('Interval TAF MET Norway není platný.');
  }
  return {
    id: `${kind}:${station}:${reportAt}:metno`, kind, provider: METNO_PROVIDER, station, fir: null, raw: raw.trim(),
    observedAt, issuedAt, validFrom, validTo, receivedAt: null, retrievedAt,
    sourceUpdatedAt: null, sourceUrl: sourceUrl(url, kind), sourceFilename: null,
    source: { reportType },
    timeReference: 'Úplná data a časy XML MET Norway jsou UTC; den a čas původního TAC jsou samostatně porovnány. Typ zprávy je samostatné pole poskytovatele, původní text zůstává beze změny.',
    cancelled: words.has('CNL'), nil: words.has('NIL'), amended: words.has('AMD') || reportType.split(/\s+/).includes('AMD'), corrected: words.has('COR') || reportType.split(/\s+/).includes('COR'),
  };
}
function entities(text) {
  if (/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[\da-fA-F]+;)/.test(text)) fail();
  return text.replace(/&([^;]+);/g, (_, entity) => {
    const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    if (Object.hasOwn(named, entity)) return named[entity];
    const code = entity.startsWith('#x') ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    if (!Number.isInteger(code) || code < 32 && ![9, 10, 13].includes(code) || code > 0x10ffff || code >= 0xd800 && code <= 0xdfff) fail();
    return String.fromCodePoint(code);
  });
}
/** Small bounded XML reader: no DTD, entity expansion, external resources or HTML. */
function xmlTree(text) {
  if (typeof text !== 'string' || text.length > 1000000 || /<!DOCTYPE|<!ENTITY|<!\[CDATA\[/i.test(text)) fail();
  const document = { children: [], text: '', ns: {} }, stack = [document];
  let consumed = 0, count = 0;
  for (const match of text.matchAll(/<\?xml\s[^?]*\?>|<!--[\s\S]*?-->|<[^>]+>|[^<]+/g)) {
    if (match.index !== consumed || ++count > 30000) fail();
    const token = match[0]; consumed += token.length;
    if (token.startsWith('<?xml') || token.startsWith('<!--')) continue;
    if (token.startsWith('</')) {
      if (!/^<\/[A-Za-z_][\w.:-]*\s*>$/.test(token) || stack.length < 2 || token.slice(2, -1).trim() !== stack.pop().tag) fail();
    } else if (token.startsWith('<')) {
      const opening = /^<([A-Za-z_][\w.:-]*)([\s\S]*?)(\/?)>$/.exec(token);
      if (!opening || stack.length > 10) fail();
      const parent = stack.at(-1), ns = { ...parent.ns }, attributes = new Set();
      let tail = opening[2];
      while (tail.trim()) {
        const attr = /^\s+([A-Za-z_][\w.:-]*)\s*=\s*(?:"([^"<>]*)"|'([^'<>]*)')/.exec(tail);
        if (!attr || attributes.has(attr[1])) fail();
        attributes.add(attr[1]); tail = tail.slice(attr[0].length);
        if (attr[1] === 'xmlns') ns[''] = entities(attr[2] ?? attr[3]);
        else if (attr[1].startsWith('xmlns:')) ns[attr[1].slice(6)] = entities(attr[2] ?? attr[3]);
      }
      const parts = opening[1].split(':');
      if (parts.length > 2) fail();
      const uri = ns[parts.length === 2 ? parts[0] : ''];
      if (!uri) fail();
      const node = { tag: opening[1], name: parts.at(-1), uri, children: [], text: '', ns };
      parent.children.push(node); if (!opening[3]) stack.push(node);
    } else {
      if (stack.length === 1 && token.trim()) fail();
      stack.at(-1).text += entities(token);
    }
  }
  if (consumed !== text.length || stack.length !== 1 || document.children.length !== 1) fail();
  return document.children[0];
}
const M = 'http://api.met.no', G = 'http://www.opengis.net/gml/3.2';
function child(node, name, uri = M, optional = false) {
  const matches = node.children.filter(value => value.name === name && value.uri === uri);
  if (!matches.length && optional) return null;
  if (matches.length !== 1) fail();
  return matches[0];
}
function leaf(node) { if (!node || node.children.length) fail(); return node.text.trim(); }
function path(node, names, uri = M) { for (const name of names) node = child(node, name, uri); return leaf(node); }
/** Parse only the official aviationProducts schema and preserve exact TAC text. */
export function parseMetnoXml(text, { kind, retrievedAt, sourceUrl: url = metnoSourceUrl(kind) } = {}) {
  if (!['metar', 'taf'].includes(kind)) fail();
  const root = xmlTree(text);
  if (root.name !== 'aviationProducts' || root.uri !== M || root.children.length > 2000 || root.text.trim()) fail();
  return root.children.map(node => {
    if (node.uri !== M || node.name !== (kind === 'metar' ? 'meteorologicalAerodromeReport' : 'terminalAerodromeForecast')) fail();
    const station = path(node, ['icaoAirportIdentifier']), type = child(node, kind === 'metar' ? 'metarType' : 'tafType', M, true);
    const time = child(node, kind === 'metar' ? 'validTime' : 'issuedTime');
    const date = sourceTime(path(time, ['TimeInstant', 'timePosition'], G));
    const period = kind === 'taf' ? child(node, 'validPeriod', M, true) : null;
    return normalizeMetnoReport({ kind, station, raw: path(node, [kind === 'metar' ? 'metarText' : 'tafText']), reportType: type ? leaf(type) : '', retrievedAt, sourceUrl: url,
      observedAt: kind === 'metar' ? date : null, issuedAt: kind === 'taf' ? date : null,
      validFrom: period ? sourceTime(path(period, ['beginPosition'], G)) : null, validTo: period ? sourceTime(path(period, ['endPosition'], G)) : null });
  });
}
async function fetchKind(kind, { fetcher, now, signal, cache }) {
  const url = metnoSourceUrl(kind), at = now(), cached = cache?.get(url);
  if (cached && cached.nextRequestAt > at && cached.nextRequestAt <= at + DAY && cached.attemptedAt <= at) return cached;
  const attemptedAt = at;
  let result;
  try {
    const response = await fetcher(url, { mode: 'cors', credentials: 'omit', cache: 'default', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(18000)]) : AbortSignal.timeout(18000) });
    if (!response.ok) throw new Error(`MET Norway HTTP ${response.status}`);
    if (response.url) sourceUrl(response.url, kind);
    const type = response.headers?.get?.('Content-Type') || '';
    if (type && !/^(?:application|text)\/xml\b/i.test(type)) fail('MET Norway nevrátil XML zprávy.');
    const size = Number(response.headers?.get?.('Content-Length'));
    if (Number.isFinite(size) && size > 1000000) fail('Archiv MET Norway překročil velikostní limit.');
    const body = await response.text(), retrievedAt = iso(now());
    if (new TextEncoder().encode(body).byteLength > 1000000) fail('Archiv MET Norway překročil velikostní limit.');
    const items = parseMetnoXml(body, { kind, retrievedAt, sourceUrl: url });
    const expires = Date.parse(response.headers?.get?.('Expires'));
    result = { status: 'ok', transportStatus: 'ok', items, retrievedAt, attemptedAt, sourceUrl: url, nextRequestAt: Math.max(now() + FIVE_MINUTES, Number.isFinite(expires) && expires <= now() + DAY ? expires : 0) };
  } catch (error) {
    if (signal?.aborted) throw signal.reason || error;
    result = { status: 'unavailable', transportStatus: 'unavailable', items: [], retrievedAt: null, attemptedAt, sourceUrl: url, error: error.message || 'Archiv MET Norway nebyl načten.', nextRequestAt: now() + FIVE_MINUTES };
  }
  cache?.set(url, result); return result;
}
/** Two bounded ordinary CORS requests; repeated refreshes reuse at least 5 min. */
export async function fetchMetnoAviation({ fetcher = globalThis.fetch, now = Date.now, previous = null, signal, cache = requestCache } = {}) {
  signal?.throwIfAborted();
  const clock = () => { const at = typeof now === 'function' ? now() : now; if (!Number.isFinite(at)) fail(); return at; };
  const sections = await Promise.all(['metar', 'taf'].map(async kind => {
    const result = await fetchKind(kind, { fetcher, now: clock, signal, cache });
    if (result.status === 'ok') return [kind, result];
    const retained = [...(previous?.[kind]?.items || []), ...(kind === 'metar' ? previous?.metar?.history || [] : [])].filter(item => item?.provider === METNO_PROVIDER);
    const unique = [...new Map(retained.map(item => [item.id, { ...item, transportStatus: 'stale', refreshError: result.error }])).values()];
    return [kind, { ...result, items: unique, status: unique.length ? 'stale' : 'unavailable' }];
  }));
  return Object.fromEntries(sections);
}
