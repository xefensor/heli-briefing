/** Keep this worker alive for bounded immutable-field reuse across place/time changes. */
import { createNativeCeilingCache, fetchNativeCeiling } from './native-ceiling-source.js';
const cache = createNativeCeilingCache();
let active = null;
self.onmessage = async ({ data }) => {
  if (data?.type === 'cancel') { if (active?.id === data.id) active.abort.abort(); return; }
  if (!data || !Number.isSafeInteger(data.id) || !data.params || typeof data.params !== 'object') return;
  active?.abort.abort();
  const request = { id: data.id, abort: new AbortController() }; active = request;
  try {
    const result = await fetchNativeCeiling({ ...data.params, cache, signal: request.abort.signal,
      onProgress: progress => { if (active === request) self.postMessage({ id: request.id, progress }); } });
    if (active === request && !request.abort.signal.aborted) self.postMessage({ id: request.id, result });
  } catch (error) {
    if (active === request && !request.abort.signal.aborted) self.postMessage({ id: request.id, error: error.message || 'Nativní CEILING není dostupný.' });
  } finally { if (active === request) active = null; }
};
