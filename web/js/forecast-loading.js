/** Start both model requests together and publish each result independently. */
export async function settleForecastPair({ main, comparison = null, onSettled = () => {} }) {
  function start(load) {
    try { return Promise.resolve(load ? load() : null); }
    catch (reason) { return Promise.reject(reason); }
  }
  const mainRequest = start(main), comparisonRequest = start(comparison);
  const settle = (kind, request) => request.then(
    value => ({ status: 'fulfilled', value }),
    reason => ({ status: 'rejected', reason }),
  ).then(outcome => { onSettled(kind, outcome); return outcome; });
  const [mainResult, comparisonResult] = await Promise.all([settle('main', mainRequest), settle('comparison', comparisonRequest)]);
  return { main: mainResult, comparison: comparisonResult };
}

function message(error, fallback) {
  return typeof error === 'string' && error ? error : typeof error?.message === 'string' && error.message ? error.message : fallback;
}

function failure(outcome) {
  if (outcome?.status === 'rejected') return {
    error: message(outcome.reason, 'Předpověď není dostupná.'),
    retryAt: outcome.reason?.retryAt,
  };
  const data = outcome?.status === 'fulfilled' ? outcome.value : null;
  if (data?.transport?.stale || data?.transport?.error) return {
    error: message(data.transport.error, 'Obnova nebyla potvrzena; zachována jsou dříve načtená data.'),
    retryAt: data.transport.error?.retryAt,
  };
  if (!data?.validFrom || !Number.isFinite(Date.parse(data.validFrom))) return {
    error: 'Zdroj neposkytl použitelné hodinové hodnoty.',
  };
  return null;
}

/** Summarize failures without modifying source data, source clocks or outcomes. */
export function forecastPairOutcome(results, { comparisonRequested = false, nowMs = Date.now() } = {}) {
  const failures = [failure(results?.main)];
  if (comparisonRequested) {
    const comparison = failure(results?.comparison);
    if (comparison) failures.push({ ...comparison, error: `Porovnání: ${comparison.error}` });
  }
  const present = failures.filter(Boolean);
  const deadlines = present.map(item => typeof item.retryAt === 'number' ? item.retryAt : Date.parse(item.retryAt))
    .filter(time => Number.isFinite(time) && time > nowMs);
  return {
    ok: present.length === 0,
    error: present.length ? present.map(item => item.error).join(' · ') : undefined,
    retryAt: deadlines.length ? Math.max(...deadlines) : undefined,
  };
}
