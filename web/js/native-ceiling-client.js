/** Keep bounded native GRIB work off the UI thread; the worker owns its cache. */
export function createNativeCeilingClient({ WorkerClass = globalThis.Worker, timeoutMs = 90000, workerUrl = new URL('./native-ceiling-worker.js', import.meta.url) } = {}) {
  let worker = null, sequence = 0;
  const pending = new Map();
  const abortError = () => new DOMException('Načítání ceilingu bylo zrušeno.', 'AbortError');
  function finish(id, error, result) {
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    clearTimeout(entry.timer);
    entry.signal?.removeEventListener('abort', entry.abort);
    if (error) entry.reject(error); else entry.resolve(result);
  }
  function stop(message = 'Pracovní proces ceilingu byl ukončen.') {
    worker?.terminate(); worker = null;
    for (const id of [...pending.keys()]) finish(id, new Error(message));
  }
  function connect() {
    if (worker) return worker;
    if (typeof WorkerClass !== 'function') throw new Error('Prohlížeč nepodporuje pracovní proces pro nativní ceiling.');
    worker = new WorkerClass(workerUrl, { type: 'module' });
    worker.onmessage = ({ data }) => {
      if (!data || !pending.has(data.id)) return;
      if (typeof data.progress === 'string') pending.get(data.id).onProgress?.(data.progress);
      if (data.result) finish(data.id, null, data.result);
      else if (data.error) finish(data.id, new Error(String(data.error)));
    };
    worker.onerror = () => stop('Pracovní proces ceilingu selhal; data nejsou potvrzena.');
    return worker;
  }
  function request(params, { signal, onProgress } = {}) {
    if (signal?.aborted) return Promise.reject(signal.reason || abortError());
    return new Promise((resolve, reject) => {
      let target;
      try { target = connect(); } catch (error) { reject(error); return; }
      const id = ++sequence;
      const abort = () => { target.postMessage({ type: 'cancel', id }); finish(id, signal?.reason || abortError()); };
      const timer = setTimeout(() => {
        target.postMessage({ type: 'cancel', id });
        finish(id, new Error('Načítání ceilingu překročilo časový limit.'));
      }, timeoutMs);
      pending.set(id, { resolve, reject, signal, onProgress, timer, abort });
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) { abort(); return; }
      try { target.postMessage({ id, params }); }
      catch (error) { finish(id, error); }
    });
  }
  return { request, stop };
}
