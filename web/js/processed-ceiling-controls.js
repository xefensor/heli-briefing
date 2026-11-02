import { createNativeCeilingClient } from './native-ceiling-client.js';
import { validateProcessedCeiling, renderProcessedCeiling } from './processed-ceiling-view.js';
import { escapeHtml as esc } from './charts.js';
import { captureSourceDetailState, restoreSourceDetailState } from './view-state.js';

/** Step through actual loaded samples; an exact half-hour tie uses the earlier one. */
export function adjacentProcessedTime(times, selectedTime, direction) {
  const selected = Date.parse(selectedTime), instants = Array.isArray(times) ? times.map(time => Date.parse(time)) : null;
  if (!instants?.length || !Number.isFinite(selected) || ![-1, 1].includes(direction) || instants.some((time, index) => !Number.isFinite(time) || index && time <= instants[index - 1])) return null;
  const nearest = instants.reduce((best, time, index) => Math.abs(time - selected) < Math.abs(instants[best] - selected) ? index : best, 0);
  return times[Math.max(0, Math.min(times.length - 1, nearest + direction))];
}

/** Separate processed AGL product; never reuses native-EU MSL state or terrain. */
export function mountProcessedCeiling({ getContext, onChange = () => {}, onSelectTime = null }) {
  const root = document.getElementById('processed-ceiling-content');
  const status = document.getElementById('processed-ceiling-progress');
  const worker = createNativeCeilingClient({ workerUrl: new URL('./processed-ceiling-worker.js', import.meta.url) });
  const key = () => {
    const state = getContext(), step = 15 * 60000;
    return `${state.lat}:${state.lon}:${Math.floor(Date.parse(state.time) / 3600000)}:${Math.ceil(Date.parse(state.time) / 3600000 - 0.5)}:${Math.ceil(Date.parse(state.time) / step - 0.5) * step}`;
  };
  let data = null, dataKey = '', pendingKey = '', request = null, controller = null, timer = null, sequence = 0, retryAfter = 0, failedKey = '', revision = 0, lastError = '', renderedKey = '', sourceViewState = {}, chartFocusPending = false;
  function render() {
    const context = getContext();
    const width = Math.max(240, Math.min(1000, root.clientWidth - 32));
    const signature = JSON.stringify([revision, key(), context.time, context.timezone, width, lastError]);
    if (signature === renderedKey) return;
    renderedKey = signature;
    const active = root.ownerDocument.activeElement;
    const chartFocused = Boolean(active?.closest?.('[data-processed-time-chart]') && root.contains(active));
    const restoreChart = chartFocused || chartFocusPending && active === root;
    chartFocusPending = false;
    sourceViewState = captureSourceDetailState(root, sourceViewState);
    if (data && dataKey === key()) root.innerHTML = renderProcessedCeiling(data, { ...context, width, interactive: true });
    else if (lastError) root.innerHTML = `<p class="feed-error">${esc(lastError)} Nejde o potvrzení jasné oblohy.</p>`;
    else root.innerHTML = '<p class="section-note">Samostatná zpracovaná předpověď ve ft AGL. Načítání a čas tohoto zdroje jsou nezávislé na hlavním modelu a nativním ICON-EU.</p>';
    restoreSourceDetailState(root, sourceViewState);
    if (restoreChart) {
      const chart = root.querySelector('[data-processed-time-chart]');
      if (chart) chart.focus({ preventScroll: true });
      else { root.tabIndex = -1; root.focus({ preventScroll: true }); chartFocusPending = true; }
    }
  }
  function stop() {
    sequence++; controller?.abort(); controller = null; request = null; pendingKey = ''; clearTimeout(timer); timer = null; onChange();
  }
  async function load(forceRefresh = false, outerSignal) {
    const wanted = key();
    if (request && pendingKey === wanted) return request;
    stop();
    const run = ++sequence, context = { ...getContext() }, own = controller = new AbortController();
    const cancel = () => own.abort();
    outerSignal?.addEventListener('abort', cancel, { once: true });
    if (outerSignal?.aborted) own.abort();
    pendingKey = wanted; status.textContent = 'Načítám samostatný ceiling AGL · ClearToFly…';
    const work = (async () => {
      try {
        const result = await worker.request({ lat: context.lat, lon: context.lon, selectedTime: context.time, hours: 6, forceRefresh }, {
          signal: own.signal, onProgress: message => { if (run === sequence) status.textContent = message; },
        });
        if (run !== sequence || own.signal.aborted || wanted !== key()) return { ok: false, cancelled: true };
        validateProcessedCeiling(result);
        data = result; dataKey = wanted; retryAfter = 0; lastError = ''; revision++; status.textContent = ''; render();
        const failure = result.errors?.find(item => !['missing-frame', 'outside-domain'].includes(item.kind));
        return { ok: !failure, error: failure?.error };
      } catch (error) {
        if (run !== sequence || own.signal.aborted) return { ok: false, cancelled: true };
        retryAfter = Date.now() + 60000; failedKey = wanted; lastError = error.message; revision++;
        status.textContent = 'Obnova zpracovaného ceilingu AGL nebyla potvrzena.';
        if (data && dataKey === wanted) { data = { ...data, stale: true, transportError: error.message }; render(); }
        else render();
        return { ok: false, error: error.message };
      } finally {
        outerSignal?.removeEventListener('abort', cancel);
        if (run === sequence) { request = null; pendingKey = ''; controller = null; onChange(); }
      }
    })();
    request = work; onChange(); return work;
  }
  function sync() {
    if (lastError && failedKey !== key()) { lastError = ''; retryAfter = 0; }
    render();
    if (document.hidden || navigator.onLine === false || pendingKey === key() || dataKey === key() && data || failedKey === key() && Date.now() < retryAfter) return;
    clearTimeout(timer); timer = setTimeout(() => { timer = null; load(); }, 200); onChange();
  }
  function selectedChart(event) {
    const chart = event.target.closest?.('[data-processed-time-chart]');
    return typeof onSelectTime === 'function' && data && dataKey === key() && chart && root.contains(chart) ? chart : null;
  }
  root.addEventListener('click', event => {
    const chart = selectedChart(event), sample = event.target.closest?.('[data-time]');
    if (!chart || !sample || !chart.contains(sample) || !data.series.times.includes(sample.dataset.time)) return;
    onSelectTime(sample.dataset.time);
  });
  root.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key) || !selectedChart(event) || event.target.closest?.('a[href], button, input, select, textarea, summary')) return;
    const time = adjacentProcessedTime(data.series.times, getContext().time, event.key === 'ArrowLeft' ? -1 : 1);
    if (!time) return;
    event.preventDefault();
    if (Date.parse(time) !== Date.parse(getContext().time)) onSelectTime(time);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else sync(); });
  window.addEventListener('offline', stop);
  window.addEventListener('online', sync);
  window.addEventListener('focus', sync);
  window.addEventListener('pageshow', sync);
  window.addEventListener('pagehide', () => { stop(); worker.stop(); });
  window.addEventListener('resize', render);
  queueMicrotask(sync);
  return { sync, refresh: load, busy: () => Boolean(request || timer), snapshot: () => data && dataKey === key() ? structuredClone(data) : null };
}
