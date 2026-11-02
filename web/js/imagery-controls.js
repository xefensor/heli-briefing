import { createBrowserCameras, fetchBrowserCameras, captureCameras, renderCameras, MUNICIPAL_CAMERA } from './cameras.js';
import { createBrowserCharts, fetchBrowserCharts, renderAviationCharts, selectedLowCloud, captureCharts } from './aviation-charts.js';
import { formatTime } from './briefing.js';
import { parseLowCloudFiles } from './lowcloud-file-source.js';
import { chartImageKey } from './browser-chart-views.js';
import { captureSourceDetailState, restoreSourceDetailState } from './view-state.js';

export function mountImagery({ getContext, onLowCloud, onChange = () => {} }) {
  const $ = id => document.getElementById(id);
  let cameras = createBrowserCameras(), charts = createBrowserCharts(), mapActive = false;
  let renderedKey = '', dialogReturnFocus = null, chartRequest = null, importing = false, sourceViewState = {};
  const imageErrors = new Set();
  // This is an ordinary cross-origin provider page. Load it only on request,
  // and keep its DOM outside the repeatedly rendered camera/source summaries.
  const municipal = document.createElement('section');
  municipal.id = 'municipal-camera';
  municipal.className = 'municipal-camera';
  municipal.setAttribute('aria-labelledby', 'municipal-camera-title');
  municipal.innerHTML = `<h3 id="municipal-camera-title">České Budějovice · Radnice · městská kamera</h3><p>Samostatný pohled města České Budějovice, nikoli kamera ČHMÚ. Přehrávač nepředává tomuto přehledu samostatný čas snímku; aktuálnost ověř přímo u zdroje. Samotné načtení přehrávače ji nepotvrzuje.</p><p>Oficiální přehrávač se připojí přímo ke zdroji až po otevření. Video se neukládá do zachyceného briefingu.</p><p><a href="${MUNICIPAL_CAMERA.pageUrl}" target="_blank" rel="noopener noreferrer">Zdroj: město České Budějovice ↗</a> · <a href="${MUNICIPAL_CAMERA.viewerUrl}" target="_blank" rel="noopener noreferrer">Otevřít samostatný přehrávač ↗</a></p><div class="municipal-camera-actions"><button id="municipal-camera-load" class="button button-primary" type="button">Otevřít městskou kameru</button><button id="municipal-camera-close" class="button button-quiet" type="button" hidden>Zavřít video</button></div><div id="municipal-camera-frame"></div>`;
  $('cameras').after(municipal);
  $('municipal-camera-load').addEventListener('click', () => {
    const frame = document.createElement('iframe');
    frame.id = 'municipal-camera-viewer';
    frame.title = 'Městská kamera České Budějovice · Radnice';
    frame.src = MUNICIPAL_CAMERA.viewerUrl;
    frame.allow = 'autoplay; fullscreen';
    frame.referrerPolicy = 'no-referrer';
    $('municipal-camera-frame').replaceChildren(frame);
    $('municipal-camera-load').disabled = true;
    $('municipal-camera-load').textContent = 'Přehrávač otevřen';
    $('municipal-camera-close').hidden = false;
    $('municipal-camera-close').focus({ preventScroll: true });
  });
  $('municipal-camera-close').addEventListener('click', () => {
    $('municipal-camera-frame').replaceChildren();
    $('municipal-camera-load').disabled = false;
    $('municipal-camera-load').textContent = 'Otevřít městskou kameru';
    $('municipal-camera-close').hidden = true;
    $('municipal-camera-load').focus({ preventScroll: true });
  });
  // Controls are recreated when frame ages or snapshots change. Retain their
  // semantic identity so refresh and modal close do not send keyboard users to body.
  function focusToken(element) {
    const root = element?.closest?.('#cameras, #aviation-chart-content');
    const control = element?.closest?.('button, a[href]');
    if (!root || !control || !root.contains(control)) return null;
    return {
      root: root.id, id: control.id, camera: control.dataset.cameraEnlarge,
      chart: control.dataset.chartEnlarge, tag: control.tagName,
      href: control.getAttribute('href'), label: control.textContent.trim(),
      article: control.closest('article')?.querySelector('h3')?.textContent || null,
    };
  }
  function restoreFocus(token) {
    if (!token) return;
    const root = $(token.root);
    const control = [...root.querySelectorAll('button, a[href]')].find(element => {
      if (token.id) return element.id === token.id;
      if (token.camera) return element.dataset.cameraEnlarge === token.camera;
      if (token.chart) return element.dataset.chartEnlarge === token.chart;
      return element.tagName === token.tag && element.getAttribute('href') === token.href &&
        element.textContent.trim() === token.label &&
        (element.closest('article')?.querySelector('h3')?.textContent || null) === token.article;
    });
    if (control && !control.disabled && control.getClientRects().length) {
      control.focus({ preventScroll: true });
      return;
    }
    // A failed frame may remove its enlarge button; return to its evidence heading.
    const heading = root.closest('section')?.querySelector('h2,h3');
    if (heading?.getClientRects().length) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  }
  function render(force = false) {
    const state = getContext();
    const key = JSON.stringify([state.lat, state.lon, state.timezone, selectedLowCloud(charts,state.time)?.validAt, Date.parse(state.time)>=Date.parse(charts?.swl?.validFrom)&&Date.parse(state.time)<Date.parse(charts?.swl?.validTo), Math.floor(Date.now()/60000), mapActive]);
    if (!force && renderedKey === key) return;
    const focusedControl = document.activeElement?.closest?.('details[data-source-detail]') ? null : focusToken(document.activeElement);
    sourceViewState = captureSourceDetailState($('aviation-chart-content'), sourceViewState);
    renderedKey = key;
    $('cameras').innerHTML = renderCameras(cameras, { ...state, interactive: true });
    $('aviation-chart-content').innerHTML = renderAviationCharts(charts, { ...state, interactive: true, imageErrors });
    const button = $('lowcloud-map'), low = selectedLowCloud(charts, state.time);
    if (button) { button.setAttribute('aria-pressed', String(mapActive)); button.disabled = !mapActive && (!(low?.imageDataUrl || low?.imagePath) || imageErrors.has(chartImageKey(low))); }
    const importButton = $('lowcloud-import');
    if (importButton) { importButton.disabled = importing; if (importing) importButton.textContent = 'Kontroluji místní soubory…'; }
    if ($('lowcloud-clear')) $('lowcloud-clear').disabled = importing;
    if (mapActive) onLowCloud((low?.imageDataUrl || low?.imagePath) && !imageErrors.has(chartImageKey(low)) ? low : null);
    restoreSourceDetailState($('aviation-chart-content'), sourceViewState);
    restoreFocus(focusedControl);
  }
  function showImage(item, title, subtitle, trigger) {
    if (!item) return;
    dialogReturnFocus = focusToken(trigger);
    $('imagery-title').textContent = title; $('imagery-context').textContent = subtitle;
    const image = document.createElement('img'); image.src = item.imageDataUrl || item.imagePath || item.imageUrl; image.alt = title; image.width = item.width; image.height = item.height;
    $('imagery-large').replaceChildren(image); $('imagery-dialog').showModal();
  }
  $('imagery-close').addEventListener('click', () => $('imagery-dialog').close());
  $('imagery-dialog').addEventListener('close', () => {
    if ($('imagery-dialog').open) return;
    restoreFocus(dialogReturnFocus); dialogReturnFocus = null;
  });
  $('cameras').addEventListener('click', event => {
    const id = event.target.closest('[data-camera-enlarge]')?.dataset.cameraEnlarge;
    const item = cameras?.items.find(item => item.id === id);
    if (item) showImage(item, `${item.name} · ${item.direction}`, item.displayOnly
      ? 'Autor ČHMÚ · distribuce In-počasí / Ventusky. Čas pořízení ověř přímo v obraze; hodinový soubor ani čas načtení jej nepotvrzují.'
      : `ČHMÚ · rámec ${formatTime(item.observedAt, getContext().timezone, true)} ${getContext().timezone === 'UTC' ? 'UTC' : 'CZ'} · obraz nezávisí na modelu a budoucím čase.`, event.target.closest('[data-camera-enlarge]'));
  });
  $('aviation-chart-content').addEventListener('click', event => {
    const kind = event.target.closest('[data-chart-enlarge]')?.dataset.chartEnlarge;
    if (kind) {
      const item = kind === 'swl' ? charts?.swl : kind === 'sigmet' ? charts?.sigmetImage : selectedLowCloud(charts, getContext().time);
      if (item?.imagePath || item?.imageUrl || item?.imageDataUrl) {
        const subtitle = kind === 'sigmet' ? 'ŘLP / ČHMÚ · aktualizaci čti v záhlaví UTC; úplnost výstrah není ověřena.' : kind !== 'swl' ? `${item.delivery === 'local-file' ? 'Místní soubor · neověřený čas z názvu: ' : 'Platnost '}${formatTime(item.validAt,'UTC',true)} UTC · vydání neposkytnuto.`
          : item.displayOnly ? 'ČHMÚ / ŘLP · vydání a platnost čti v záhlaví mapy (UTC). Mapa není svázána s časem přehledu.'
          : `Platnost ${formatTime(item.validFrom,'UTC',true)} – ${formatTime(item.validTo,'UTC',true)} UTC · původní velikost; posuň mapu vodorovně.`;
        showImage(item, kind === 'swl' ? 'SWL · původní mapa ČHMÚ' : kind === 'sigmet' ? 'SIGMET / AIREP · mapa ŘLP' : 'Nízká oblačnost · místní soubor', subtitle, event.target.closest('[data-chart-enlarge]'));
      }
    }
    if (event.target.closest('#lowcloud-import')) $('lowcloud-files').click();
    if (event.target.closest('#lowcloud-clear')) { charts.lowCloud = createBrowserCharts().lowCloud; mapActive = false; onLowCloud(null); $('lowcloud-files').value = ''; render(true); }
    if (event.target.closest('#lowcloud-map')) { mapActive = !mapActive; onLowCloud(mapActive ? selectedLowCloud(charts, getContext().time) : null, mapActive); render(); }
  });
  $('lowcloud-files').addEventListener('change', async event => {
    const files = [...event.target.files];
    if (!files.length || importing) return;
    importing = true; render(true); onChange();
    try {
      const imported = await parseLowCloudFiles(files);
      const merged = new Map((charts.lowCloud?.delivery === 'local-file' ? charts.lowCloud.frames : []).map(frame => [frame.validAt, frame]));
      for (const frame of imported.frames) merged.set(frame.validAt, frame);
      const frames = [...merged.values()].sort((a, b) => Date.parse(a.validAt) - Date.parse(b.validAt));
      if (frames.length > 12 || frames.reduce((sum, frame) => sum + frame.imageBytes, 0) > 6 * 1024 * 1024) throw new Error('Místní sada smí mít nejvýše 12 rámců a 6 MiB obrazových dat. Nejprve odeber starší sadu.');
      charts.lowCloud = { delivery: 'local-file', status: 'manual', frames, importedAt: imported.importedAt, error: null };
      mapActive = false; onLowCloud(null); imageErrors.clear();
    } catch (error) { charts.lowCloud = { ...charts.lowCloud, importError: error.message }; }
    finally { importing = false; event.target.value = ''; render(true); onChange(); $('lowcloud-import')?.focus({ preventScroll: true }); }
  });
  $('cameras').addEventListener('error', event => { const id = event.target.dataset?.cameraImage; if (id && cameras) { cameras = { ...cameras, items: cameras.items.map(item => item.id === id ? { ...item, status:'unavailable', imageDataUrl:null, error:'Snímek nelze zobrazit.' } : item) }; render(true); } }, true);
  $('aviation-chart-content').addEventListener('error', event => { const path = event.target.dataset?.chartPath; if (path) { imageErrors.add(path); render(true); } }, true);
  render(true);
  return { sync: render, busy: () => importing, hideLowCloud() { mapActive = false; onLowCloud(null); render(); }, snapshotCameras: () => captureCameras(cameras),
    async capture(time) { return { cameras: this.snapshotCameras(), charts: await captureCharts(charts, time) }; },
    async refresh(_force = false, signal) {
      if (chartRequest) return chartRequest;
      const work = (async () => {
        try {
          const [newCameras, newCharts] = await Promise.all([
            fetchBrowserCameras({ previous: cameras, signal }),
            fetchBrowserCharts({ previous: charts, signal }),
          ]);
          cameras = newCameras; charts = newCharts;
          if (charts.swl.status === 'ok') imageErrors.clear();
          render(true);
          return { ok: charts.swl.status === 'ok' && charts.sigmetImage?.status === 'ok' && cameras.status === 'ok', error: charts.swl.error || charts.sigmetImage?.error || cameras.error };
        } catch (error) {
          return { ok: false, error: error.message };
        }
      })();
      chartRequest = work;
      try { return await work; } finally { if (chartRequest === work) chartRequest = null; }
    },
  };
}
