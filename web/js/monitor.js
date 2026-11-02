/**
 * One browser-local freshness clock, independent of weather timestamps.
 *
 * start() does not repeat the app's initial requests: the first scheduled
 * forecast/report refresh is due 10/5 minutes later. A later restart checks
 * elapsed deadlines. Root wires visibilitychange, focus and online/offline to
 * wake(); this module installs no DOM listeners.
 *
 * onTick(nowMs, state) runs every 30 seconds, on wake/mode changes and around a
 * refresh. `state.live` is a viewing mode only: the caller may advance its
 * inspection instant in live mode, but must retain a pinned instant otherwise.
 *
 * onRefresh({forecast, aviation, nowMs, reason, signal}) returns a Promise.
 * A fulfilled callback is successful unless it returns false, or a per-product
 * false / {ok:false,error,retryAt}. An omitted product result is successful.
 * A {cancelled:true} product retains prior success/error state and gets a short
 * retry without shortening an existing failure or provider-cooldown deadline.
 * retryAt is an absolute millisecond instant, e.g. a provider Retry-After. It
 * can delay a retry beyond the normal backoff; it is never shortened here.
 *
 * Attempt/success times describe this browser's work only. They must never be
 * substituted for a model run, observation, issue or data retrieval timestamp.
 */

const DEFAULT_INTERVALS = Object.freeze({
  tick: 30_000,
  forecast: 10 * 60_000,
  aviation: 5 * 60_000,
  retry: 60_000,
});
const PRODUCTS = ['forecast', 'aviation'];

function errorMessage(error) {
  if (typeof error === 'string') return error;
  return error?.message || 'Obnova se nezdařila.';
}

export function createMonitor({
  onTick = () => {},
  onRefresh = async () => {},
  getVisibility = () => globalThis.document?.visibilityState || 'visible',
  isOnline = () => globalThis.navigator?.onLine !== false,
  now = () => Date.now(),
  setTimer = (callback, delay) => setTimeout(callback, delay),
  clearTimer = (id) => clearTimeout(id),
  intervals: requestedIntervals = {},
} = {}) {
  if (typeof onTick !== 'function' || typeof onRefresh !== 'function') {
    throw new TypeError('Monitor callbacks must be functions.');
  }
  const intervals = { ...DEFAULT_INTERVALS, ...requestedIntervals };
  for (const key of Object.keys(DEFAULT_INTERVALS)) {
    if (!Number.isFinite(intervals[key]) || intervals[key] <= 0) {
      throw new RangeError(`Monitor interval ${key} must be positive.`);
    }
  }

  let active = false;
  let live = true;
  let generation = 0;
  let timer = null;
  let inFlight = null;
  let refreshAbort = null;
  let tickError = null;
  const products = Object.fromEntries(PRODUCTS.map((name) => [name, {
    attemptedAt: null, succeededAt: null, nextAt: null,
    failures: 0, error: null,
  }]));

  const time = () => {
    const value = now();
    if (!Number.isFinite(value)) throw new TypeError('Monitor clock must return milliseconds.');
    return value;
  };
  const online = () => isOnline() !== false;
  const visible = () => {
    const value = getVisibility();
    return value === true || value === 'visible';
  };

  function getState() {
    const next = Math.min(...PRODUCTS.map((name) => products[name].nextAt ?? Infinity));
    return {
      active, live, refreshing: inFlight !== null,
      online: online(), visible: visible(), tickError,
      products: Object.fromEntries(PRODUCTS.map((name) => [name, { ...products[name] }])),
      nextRefreshAt: Number.isFinite(next) ? next : null,
    };
  }

  function emit(at = time()) {
    if (!active) return;
    try {
      onTick(at, getState());
      tickError = null;
    } catch (error) {
      // A render exception must not create an unhandled timer rejection or
      // silently terminate the freshness clock. It remains inspectable.
      tickError = errorMessage(error);
    }
  }

  function queueTick() {
    if (!active || timer !== null) return;
    timer = setTimer(() => {
      timer = null;
      if (!active) return;
      void wake('timer');
      queueTick();
    }, intervals.tick);
  }

  function request(force, reason) {
    if (!active) return Promise.resolve(getState());
    if (inFlight) return inFlight;
    if (!online() || !visible()) return Promise.resolve(getState());

    const startedAt = time();
    const due = Object.fromEntries(PRODUCTS.map((name) => [name,
      force || products[name].nextAt !== null && startedAt >= products[name].nextAt,
    ]));
    if (!PRODUCTS.some((name) => due[name])) return Promise.resolve(getState());

    const epoch = generation;
    const abort = new AbortController();
    refreshAbort = abort;
    for (const name of PRODUCTS) if (due[name]) products[name].attemptedAt = startedAt;

    // Defer the callback one microtask so the in-flight guard is installed
    // before either onTick or onRefresh could request another refresh.
    const work = Promise.resolve().then(async () => {
      if (!active || generation !== epoch) return getState();
      let result;
      let failure = null;
      try {
        result = await onRefresh({ ...due, nowMs: startedAt, reason, signal: abort.signal });
      } catch (error) {
        failure = error;
      }
      if (!active || generation !== epoch) return getState();

      const finishedAt = time();
      for (const name of PRODUCTS) {
        if (!due[name]) continue;
        const outcome = result === false ? false : result?.[name];
        const ok = !failure && outcome !== false && outcome?.ok !== false;
        const product = products[name];
        if (outcome?.cancelled === true) {
          product.nextAt = Math.max(finishedAt + intervals.retry,
            product.failures > 0 && Number.isFinite(product.nextAt) ? product.nextAt : -Infinity);
        } else if (ok) {
          product.succeededAt = finishedAt;
          product.failures = 0;
          product.error = null;
          product.nextAt = finishedAt + intervals[name];
        } else {
          product.failures += 1;
          product.error = errorMessage(failure || outcome?.error);
          const backoff = Math.min(intervals[name], intervals.retry * 2 ** Math.min(product.failures - 1, 20));
          const retryAt = outcome?.retryAt ?? failure?.retryAt;
          product.nextAt = Math.max(finishedAt + backoff,
            Number.isFinite(retryAt) ? retryAt : -Infinity);
        }
      }
      return getState();
    }).finally(() => {
      if (inFlight !== work) return;
      inFlight = null;
      refreshAbort = null;
      if (active && generation === epoch) {
        emit();
        queueTick();
      }
    }).then(() => getState());
    inFlight = work;
    emit(startedAt);
    return work;
  }

  function wake(reason = 'wake') {
    if (!active) return Promise.resolve(getState());
    emit();
    const work = request(false, reason);
    queueTick();
    return work;
  }

  function start() {
    if (active) return getState();
    active = true;
    generation += 1;
    const at = time();
    for (const name of PRODUCTS) if (products[name].nextAt === null) products[name].nextAt = at + intervals[name];
    void wake('start');
    return getState();
  }

  function stop() {
    active = false;
    generation += 1;
    if (timer !== null) clearTimer(timer);
    timer = null;
    refreshAbort?.abort();
    refreshAbort = null;
    inFlight = null;
    return getState();
  }

  function refresh(reason = 'manual') {
    if (!active) return Promise.resolve(getState());
    emit();
    const work = request(true, reason);
    queueTick();
    return work;
  }

  function setLive(value) {
    live = Boolean(value);
    emit();
    return getState();
  }

  return Object.freeze({ start, stop, wake, refresh, setLive, getState });
}
