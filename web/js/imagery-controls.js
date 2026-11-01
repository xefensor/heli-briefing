import { validateCameras, renderCameras } from './cameras.js';
import { validateCharts, renderAviationCharts, selectedLowCloud, captureCharts } from './aviation-charts.js';
import { formatTime } from './briefing.js';

export function mountImagery({ getContext, onLowCloud }) {
  const $ = id => document.getElementById(id);
  let cameras = null, charts = null, cameraError = null, chartError = null, mapActive = false;
  let cameraSequence = 0, chartSequence = 0, busy = null, renderedKey = '';
  const imageErrors = new Set();
  function render(force = false) {
    const state = getContext();
    const key = JSON.stringify([state.lat, state.lon, state.timezone, selectedLowCloud(charts,state.time)?.validAt, Date.parse(state.time)>=Date.parse(charts?.swl?.validFrom)&&Date.parse(state.time)<Date.parse(charts?.swl?.validTo), Math.floor(Date.now()/60000), mapActive]);
    if (!force && renderedKey === key) return;
    renderedKey = key;
    $('cameras').innerHTML = !cameras && !cameraError ? '<p class="section-note">Načítám kamery ČHMÚ…</p>' : renderCameras(cameras, { ...state, error: cameraError, interactive: true });
    $('aviation-chart-content').innerHTML = !charts && !chartError ? '<p class="section-note">Načítám letecké mapy ČHMÚ…</p>' : renderAviationCharts(charts, { ...state, error: chartError, interactive: true, imageErrors });
    const button = $('lowcloud-map'), low = selectedLowCloud(charts, state.time);
    if (button) { button.setAttribute('aria-pressed', String(mapActive)); button.disabled = !mapActive && (!low?.imagePath || imageErrors.has(low.imagePath)); }
    if (mapActive) onLowCloud(low?.imagePath && !imageErrors.has(low.imagePath) ? low : null);
  }
  function showImage(item, title, subtitle) {
    if (!item) return;
    $('imagery-title').textContent = title; $('imagery-context').textContent = subtitle;
    const image = document.createElement('img'); image.src = item.imageDataUrl || item.imagePath; image.alt = title; image.width = item.width; image.height = item.height;
    $('imagery-large').replaceChildren(image); $('imagery-dialog').showModal();
  }
  $('imagery-close').addEventListener('click', () => $('imagery-dialog').close());
  $('cameras').addEventListener('click', event => {
    const id = event.target.closest('[data-camera-enlarge]')?.dataset.cameraEnlarge;
    const item = cameras?.items.find(item => item.id === id);
    if (item) showImage(item, `${item.name} · ${item.direction}`, `ČHMÚ · rámec ${formatTime(item.observedAt, getContext().timezone, true)} ${getContext().timezone === 'UTC' ? 'UTC' : 'CZ'} · obraz nezávisí na modelu a budoucím čase.`);
  });
  $('aviation-chart-content').addEventListener('click', event => {
    const kind = event.target.closest('[data-chart-enlarge]')?.dataset.chartEnlarge;
    if (kind) { const item = kind === 'swl' ? charts?.swl : selectedLowCloud(charts, getContext().time); if (item?.imagePath) showImage(item, kind === 'swl' ? 'SWL · původní mapa ČHMÚ' : 'Nízká oblačnost · ČHMÚ', kind === 'swl' ? `Platnost ${formatTime(item.validFrom,'UTC',true)} – ${formatTime(item.validTo,'UTC',true)} UTC · původní velikost; posuň mapu vodorovně.` : `Platnost ${formatTime(item.validAt,'UTC',true)} UTC · vydání neposkytnuto.`); }
    if (event.target.closest('#lowcloud-map')) { mapActive = !mapActive; onLowCloud(mapActive ? selectedLowCloud(charts, getContext().time) : null, mapActive); render(); }
  });
  $('cameras').addEventListener('error', event => { const id = event.target.dataset?.cameraImage; if (id && cameras) { cameras = { ...cameras, items: cameras.items.map(item => item.id === id ? { ...item, status:'unavailable', imageDataUrl:null, error:'Snímek nelze zobrazit.' } : item) }; render(true); } }, true);
  $('aviation-chart-content').addEventListener('error', event => { const path = event.target.dataset?.chartPath; if (path) { imageErrors.add(path); render(true); } }, true);
  async function load(kind, force, signal) {
    const sequence = kind === 'cameras' ? ++cameraSequence : ++chartSequence;
    try {
      const response = await fetch(`./data/${kind}.json`, { cache: force ? 'no-cache' : 'default', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(25000)]) : AbortSignal.timeout(25000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const value = kind === 'cameras' ? validateCameras(await response.json()) : validateCharts(await response.json());
      if (sequence !== (kind === 'cameras' ? cameraSequence : chartSequence)) return { ok: false };
      if (kind === 'cameras') { cameras = value; cameraError = null; } else { charts = value; chartError = null; if (force) imageErrors.clear(); }
      render(true); return { ok: true };
    } catch (error) { if (sequence !== (kind === 'cameras' ? cameraSequence : chartSequence)) return { ok: false }; if (kind === 'cameras') cameraError = error.message; else chartError = error.message; render(true); return { ok: false, error: error.message }; }
  }
  return { sync: render, hideLowCloud() { mapActive = false; onLowCloud(null); render(); }, snapshotCameras: () => cameras ? { ...cameras, transportError: cameraError } : null,
    async capture(time) { if (busy) await busy; if (!charts || !cameras) await this.refresh(false); return { cameras: this.snapshotCameras(), charts: charts ? { ...await captureCharts(charts, time), transportError: chartError } : null }; },
    async refresh(force = false, signal) { if (busy && !force) return busy; const pending = Promise.all([load('cameras', force, signal), load('charts', force, signal)]).then(results => ({ ok: results.every(item => item.ok), error: results.find(item => !item.ok)?.error })); busy = pending; try { return await pending; } finally { if (busy === pending) busy = null; } },
  };
}
