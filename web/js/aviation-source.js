/** Direct browser access to the public ČHMÚ MET-SWIM TAC service.
 * API/CORS checked 2026-11-02: https://swim.chmi.cz/SWIM_API_reference.pdf
 * This is not a complete international report archive or SIGMET inventory.
 */
export const AVIATION_API = 'https://swim.chmi.cz/api.php';
export const AVIATION_STATIONS = Object.freeze(['LKCS', 'LKHS', 'LKPR', 'LKKB', 'LKPD', 'LKTB', 'LKKV', 'LOWL', 'LOWW']);
export const AVIATION_FIRS = Object.freeze(['LKAA', 'LOVV', 'EDMM', 'LZBB']);
const PROVIDER = 'chmi-swim';
const MINUTE = 60000, HOUR = 60 * MINUTE, DAY = 24 * HOUR;
const HISTORY_LIMIT = 400;
const DOCUMENTATION = 'https://swim.chmi.cz/info.php';
const TIME_REFERENCE = 'Den a čas TAC; měsíc a rok určeny vůči datu souboru v katalogu ČHMÚ, nikoli vůči dnešnímu datu.';
const own = value => value && typeof value === 'object' && !Array.isArray(value);
const iso = value => Number.isFinite(value) ? new Date(value).toISOString() : null;
function instant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:\d\d)$/.test(value)) return null;
  const year = +value.slice(0, 4), month = +value.slice(5, 7), day = +value.slice(8, 10);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (month < 1 || month > 12 || calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day || +value.slice(11, 13) > 23 || +value.slice(14, 16) > 59 || value[16] === ':' && +value.slice(17, 19) > 59) return null;
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : null;
}
function clock(now) {
  const value = typeof now === 'function' ? now() : now;
  if (!Number.isFinite(value)) throw new TypeError('Čas kontroly zpráv není platný.');
  return value;
}
function dayCandidates(day, hour, minute, anchor, allow24 = false) {
  if (!Number.isInteger(day) || day < 1 || day > 31 || !Number.isInteger(hour) || hour < 0 || hour > (allow24 ? 24 : 23) || !Number.isInteger(minute) || minute < 0 || minute > 59 || hour === 24 && minute !== 0 || !Number.isFinite(anchor)) return [];
  const reference = new Date(anchor), candidates = [];
  for (const offset of [-1, 0, 1]) {
    const month = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + offset, 1));
    const base = Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), day, 0, minute);
    // Reject 31 February etc. before allowing an explicit TAF end-of-day 24.
    if (new Date(base).getUTCDate() !== day) continue;
    candidates.push(base + hour * HOUR);
  }
  return candidates;
}
function reportTime(code, updated) {
  if (!/^\d{6}Z?$/.test(code || '')) return null;
  const anchor = instant(updated);
  if (anchor === null) return null;
  const candidates = dayCandidates(+code.slice(0, 2), +code.slice(2, 4), +code.slice(4, 6), anchor)
    .filter(at => at <= anchor + 5 * MINUTE && anchor - at <= 36 * HOUR);
  return candidates.length ? Math.max(...candidates) : null;
}
function validity(code, anchor, minDelta, maxDelta, after = false) {
  if (!/^\d{4}(?:\d{2})?$/.test(code || '') || !Number.isFinite(anchor)) return null;
  const candidates = dayCandidates(+code.slice(0, 2), +code.slice(2, 4), +(code.slice(4, 6) || 0), anchor, true)
    .filter(at => after ? at > anchor && at - anchor <= maxDelta : at - anchor >= minDelta && at - anchor <= maxDelta)
    .sort((a, b) => Math.abs(a - anchor) - Math.abs(b - anchor));
  return candidates[0] ?? null;
}

/** Parse a single advertised TAC report; unknown dates remain null. */
export function parseTacReport({ kind, raw, filename, updated, sourceUrl, retrievedAt }) {
  if (!['metar', 'taf', 'sigmet'].includes(kind) || typeof raw !== 'string' || !raw.trim() || raw.length > 65536) throw new Error('Soubor neobsahuje použitelnou zprávu TAC.');
  const text = raw.trim(), compact = text.replace(/\s+/g, ' ');
  let station = null, fir = null, observed = null, issued = null, from = null, to = null, serial = '';
  if (kind === 'metar' || kind === 'taf') {
    const match = kind === 'metar'
      ? /^(?:METAR|SPECI)\s+(?:COR\s+)?([A-Z]{4})\s+(\d{6}Z)\b/.exec(compact)
      : /^TAF\s+(?:(?:AMD|COR)\s+)*([A-Z]{4})\s+(\d{6}Z)\b(?:\s+(\d{4})\/(\d{4}))?/.exec(compact);
    if (!match || !AVIATION_STATIONS.includes(match[1]) || !filename.startsWith(`${match[1]}_`)) throw new Error('Identita zprávy nesouhlasí s povoleným souborem.');
    station = match[1];
    const at = reportTime(match[2], updated);
    if (kind === 'metar') observed = at;
    else {
      issued = at;
      from = validity(match[3], issued, -24 * HOUR, 36 * HOUR);
      to = validity(match[4], from, 0, 48 * HOUR, true);
    }
  } else {
    const match = /^([A-Z]{4})\s+SIGMET\s+(\S+)\s+VALID\s+(\d{6})\/(\d{6})\b/.exec(compact);
    if (!match || !AVIATION_FIRS.includes(match[1]) || filename !== `${match[1]}_SIGMET.txt`) throw new Error('Identita SIGMET nesouhlasí s povoleným souborem.');
    fir = match[1]; serial = match[2];
    from = reportTime(match[3], updated);
    to = validity(match[4], from, 0, 24 * HOUR, true);
    // TAC header supplies validity, not an independent issue instant.
  }
  const words = new Set(compact.match(/\b[A-Z]+\b/g));
  return {
    id: `${kind}:${station || fir}:${iso(observed ?? issued ?? from) || updated || 'undated'}:${serial}`,
    kind, provider: PROVIDER, station, fir, raw: text,
    observedAt: iso(observed), issuedAt: iso(issued), validFrom: iso(from), validTo: iso(to),
    receivedAt: null, retrievedAt, sourceUpdatedAt: instant(updated) === null ? null : updated,
    sourceUrl, sourceFilename: filename, source: {}, timeReference: TIME_REFERENCE,
    cancelled: words.has('CNL'), nil: words.has('NIL'), amended: words.has('AMD'), corrected: words.has('COR'),
  };
}

function rank(item) {
  return [instant(item.observedAt ?? item.issuedAt ?? item.validFrom) ?? -Infinity,
    instant(item.sourceUpdatedAt) ?? -Infinity, instant(item.retrievedAt) ?? -Infinity, item.corrected ? 1 : 0];
}
function newer(a, b) {
  const left = rank(a), right = rank(b);
  for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) return left[i] > right[i];
  return true;
}
/** Only actual in-window observations; never fill the unobserved past. */
export function mergeObservationHistory(previous = [], current = [], nowMs = Date.now()) {
  if (!Number.isFinite(nowMs)) throw new TypeError('Čas historie není platný.');
  const reports = new Map();
  for (const item of [...(Array.isArray(previous) ? previous : []), ...(Array.isArray(current) ? current : [])]) {
    if (!own(item) || !AVIATION_STATIONS.includes(item.station) || typeof item.raw !== 'string' || !/^(?:METAR|SPECI)\b/.test(item.raw) || item.nil || item.cancelled || /\b(?:NIL|CNL)\b/.test(item.raw)) continue;
    const at = instant(item.observedAt);
    if (at === null || at < nowMs - 12 * HOUR || at > nowMs) continue;
    const key = `${item.station}:${item.observedAt}`, old = reports.get(key);
    if (!old || newer(item, old)) reports.set(key, item);
  }
  return [...reports.values()].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt) || a.station.localeCompare(b.station)).slice(-HISTORY_LIMIT);
}

function allowlistedFile(entry) {
  if (!own(entry) || entry.format !== 'txt' || typeof entry.filename !== 'string') return null;
  const match = /^([A-Z]{4})_(METAR|SPECI|TAF|SIGMET)\.txt$/.exec(entry.filename);
  if (!match) return null;
  const kind = match[2] === 'SPECI' ? 'metar' : match[2].toLowerCase();
  if (!(kind === 'sigmet' ? AVIATION_FIRS : AVIATION_STATIONS).includes(match[1])) return null;
  return { ...entry, identity: match[1], kind };
}
function ownReports(items) {
  return Array.isArray(items) ? items.filter(item => own(item) && item.provider === PROVIDER) : [];
}
function unavailable(kind, previous, attemptedAt, error) {
  const items = ownReports(previous?.items);
  return {
    ...previous, status: items.length ? 'stale' : 'unavailable', transportStatus: 'unavailable',
    retrievedAt: items.length ? previous?.retrievedAt ?? null : null, attemptedAt, items,
    sourceUrl: `${AVIATION_API}?action=list&format=txt`, provider: PROVIDER,
    error, coverageComplete: false, coverageStatus: 'unknown',
    ...(kind === 'sigmet' ? { firScope: [...AVIATION_FIRS], missingFirs: [...AVIATION_FIRS] }
      : { requestedStations: [...AVIATION_STATIONS], missingStations: AVIATION_STATIONS.filter(id => !items.some(item => item.station === id)) }),
  };
}
async function readResponse(fetcher, url, signal, limit) {
  const response = await fetcher(url, { mode: 'cors', credentials: 'omit', cache: 'no-cache', signal });
  if (!response.ok) throw new Error(`ČHMÚ SWIM HTTP ${response.status}`);
  if (response.url) {
    const final = new URL(response.url);
    if (final.origin !== 'https://swim.chmi.cz' || final.pathname !== '/api.php') throw new Error('Zpráva byla přesměrována mimo službu ČHMÚ SWIM.');
  }
  const advertisedSize = Number(response.headers?.get?.('Content-Length'));
  if (Number.isFinite(advertisedSize) && advertisedSize > limit) throw new Error('Odpověď ČHMÚ překročila velikostní limit.');
  const text = await response.text();
  if (text.length > limit) throw new Error('Odpověď ČHMÚ překročila velikostní limit.');
  return text;
}
function abortFailure(error, signal) {
  if (signal?.aborted) throw signal.reason || error;
}
function retainHistory(snapshot, previous, nowMs) {
  const metar = snapshot.metar;
  const oldHistory = ownReports(previous?.metar?.history);
  const history = mergeObservationHistory(oldHistory, metar.items, nowMs);
  Object.assign(metar, {
    history, historyStatus: history.length ? metar.transportStatus === 'unavailable' ? 'stale' : 'partial' : 'unavailable',
    historyMethod: 'browser-observed', historyPartial: true, historyHours: 12,
    historyRetrievedAt: metar.retrievedAt || previous?.metar?.historyRetrievedAt || null,
    historyAttemptedAt: snapshot.generatedAt, historySourceUrl: metar.sourceUrl,
    historyWindowFrom: iso(nowMs - 12 * HOUR), historyWindowTo: iso(nowMs),
    historyLimitReached: history.length >= HISTORY_LIMIT, historyUnknownTimeCount: metar.items.filter(item => !item.observedAt).length,
    historyFutureTimeCount: metar.items.filter(item => instant(item.observedAt) > nowMs).length,
    historyError: 'Pouze skutečná pozorování zachycená tímto prohlížečem. Zdroj neposkytuje dvanáctihodinový archiv; starší mezery se nedoplňují.',
  });
  return snapshot;
}

/** Existing aviation snapshot shape, fetched by this browser without a proxy. */
export async function fetchAviation({ fetcher = globalThis.fetch, now = () => Date.now(), previous = null, signal, parseReport = parseTacReport } = {}) {
  if (typeof fetcher !== 'function' || typeof parseReport !== 'function') throw new TypeError('Chybí adaptér pro přímé zprávy ČHMÚ.');
  const attemptedAt = iso(clock(now));
  const snapshot = {
    schemaVersion: 1, provider: PROVIDER, generatedAt: attemptedAt,
    sourceName: 'ČHMÚ MET-SWIM · přímý požadavek prohlížeče',
    attribution: 'ČHMÚ · Aeronautical Meteorological Service; původní vydávající autority zůstávají ve zprávách.',
    documentationUrl: DOCUMENTATION, licenceStatus: 'explicit-redistribution-licence-not-established',
  };
  let files;
  try {
    const body = await readResponse(fetcher, `${AVIATION_API}?action=list&format=txt`, signal ? AbortSignal.any([signal, AbortSignal.timeout(18000)]) : AbortSignal.timeout(18000), 250000);
    const listing = JSON.parse(body);
    if (!own(listing) || listing.status !== 'success' || !Array.isArray(listing.files) || listing.files.length > 200) throw new Error('Katalog ČHMÚ není platný.');
    files = [...new Map(listing.files.map(allowlistedFile).filter(Boolean).map(entry => [entry.filename, entry])).values()];
    snapshot.catalogueCreatedAt = instant(listing.created) === null ? null : listing.created;
  } catch (error) {
    abortFailure(error, signal);
    for (const kind of ['metar', 'taf', 'sigmet']) snapshot[kind] = unavailable(kind, previous?.[kind], attemptedAt, error.message || 'Katalog ČHMÚ nebyl načten.');
    snapshot.generatedAt = iso(clock(now));
    return retainHistory(snapshot, previous, clock(now));
  }
  const outcomes = [], queue = files.slice();
  async function worker() {
    while (queue.length) {
      signal?.throwIfAborted();
      const entry = queue.shift();
      const sourceUrl = `${AVIATION_API}?${new URLSearchParams({ action: 'get', file: entry.filename, format: 'txt' })}`;
      try {
        const body = await readResponse(fetcher, sourceUrl, signal ? AbortSignal.any([signal, AbortSignal.timeout(18000)]) : AbortSignal.timeout(18000), 65536);
        const retrievedAt = iso(clock(now));
        const parts = body.split('=').map(part => part.trim()).filter(Boolean);
        if (!parts.length) throw new Error('Inzerovaný soubor zprávy je prázdný.');
        const items = parts.map(part => parseReport({ kind: entry.kind, raw: `${part}=`, filename: entry.filename, updated: entry.updated, sourceUrl, retrievedAt }));
        outcomes.push({ entry, items, retrievedAt });
      } catch (error) {
        abortFailure(error, signal);
        outcomes.push({ entry, error: error.message || 'Zpráva ČHMÚ nebyla načtena.' });
      }
    }
  }
  await Promise.all([worker(), worker()]);
  const finished = clock(now);
  snapshot.generatedAt = iso(finished);
  for (const kind of ['metar', 'taf', 'sigmet']) {
    const relevant = outcomes.filter(result => result.entry.kind === kind), successful = relevant.filter(result => result.items), failed = relevant.filter(result => result.error);
    const items = successful.flatMap(result => result.items);
    for (const failure of failed) items.push(...ownReports(previous?.[kind]?.items).filter(item => item.sourceFilename === failure.entry.filename).map(item => ({ ...item, transportStatus: 'stale', refreshError: failure.error })));
    let selected = items;
    if (kind !== 'sigmet') {
      const latest = new Map();
      for (const item of items) if (!latest.has(item.station) || newer(item, latest.get(item.station))) latest.set(item.station, item);
      selected = AVIATION_STATIONS.filter(id => latest.has(id)).map(id => latest.get(id));
    }
    const present = new Set(selected.map(item => kind === 'sigmet' ? item.fir : item.station));
    const scope = kind === 'sigmet' ? AVIATION_FIRS : AVIATION_STATIONS;
    const missing = scope.filter(id => !present.has(id));
    const currentSigmets = kind === 'sigmet' ? selected.filter(item => !item.cancelled && !item.nil && instant(item.validFrom) !== null && instant(item.validFrom) <= finished && instant(item.validTo) > finished) : [];
    const error = [failed.length ? `${failed.length} souborů se nepodařilo obnovit; zachované zprávy mají původní časy.` : '',
      missing.length ? `Zdroj nenabízí úplné pokrytí: ${missing.join(', ')}.` : '',
      kind === 'sigmet' ? 'Katalog posledních zpráv neprokazuje úplný seznam platných SIGMET. Vypršelé zprávy nejsou aktuální výstrahy ani potvrzení jejich nepřítomnosti.' : ''].filter(Boolean).join(' ');
    snapshot[kind] = {
      provider: PROVIDER, items: selected, sourceUrl: `${AVIATION_API}?action=list&format=txt`,
      status: !successful.length ? selected.length ? 'stale' : 'unavailable' : failed.length || missing.length || kind === 'sigmet' ? 'partial' : 'ok',
      transportStatus: successful.length ? failed.length ? 'partial' : 'ok' : 'unavailable',
      retrievedAt: successful.length ? successful.map(result => result.retrievedAt).sort().at(-1) : previous?.[kind]?.provider === PROVIDER ? previous[kind].retrievedAt ?? null : null,
      attemptedAt, error: error || null, coverageComplete: !failed.length && !missing.length && kind !== 'sigmet',
      coverageStatus: kind === 'sigmet' ? 'unknown' : missing.length || failed.length ? 'partial' : 'complete',
      ...(kind === 'sigmet' ? { firScope: [...AVIATION_FIRS], missingFirs: missing, currentMessageCount: currentSigmets.length }
        : { requestedStations: [...AVIATION_STATIONS], missingStations: missing }),
    };
  }
  return retainHistory(snapshot, previous, finished);
}
