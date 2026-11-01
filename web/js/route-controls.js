import { ROUTE_KEY, ROUTE_LIMIT, normalizeRoutePlan, routeSchedule, loadRouteForecasts, captureRoute, renderRouteBriefing } from './route.js';
import { fetchForecast } from './weather.js';
import { formatTime, formatCoordinates, formatNumber, toDateTimeInput, fromDateTimeInput } from './briefing.js';
import { escapeHtml as esc } from './charts.js';
import { mountSection } from './section-controls.js';

export function mountRouteWorkspace({ getContext, getChoices, getClouds, onInspect, onGeometry, onMap }) {
  const $ = id => document.getElementById(id);
  let plan = { schemaVersion: 1, departure: null, points: [] }, results = {}, loading = false, controller = null, sequence = 0, signature = '', pending = null;
  let storageMessage = '', writable = true, undoPlan = null, retryUntil = 0, choiceSignature = '', displaySignature = '', legTimer = null, invalidDeparture = false, availableChoices = [];
  try {
    const raw = localStorage.getItem(ROUTE_KEY);
    if (raw !== null) { if (raw.length > 12000) throw new Error(); plan = normalizeRoutePlan(JSON.parse(raw)); }
  } catch { writable = false; storageMessage = 'Uloženou trasu nelze přečíst. Původní záznam nepřepisujeme; nové úpravy budou dočasné.'; }
  const models = () => { const state = getContext(); return [state.model, ...(state.compare && state.compare !== state.model ? [state.compare] : [])]; };
  const section = mountSection({ getSchedule: () => invalidDeparture ? [] : routeSchedule(plan), getModel: () => getContext().model, getZone: () => getContext().timezone });
  const key = () => JSON.stringify([plan, models()]);
  const setMessage = text => { $('route-feedback').textContent = text; };
  function save() {
    if (!writable) return;
    try { localStorage.setItem(ROUTE_KEY, JSON.stringify(plan)); storageMessage = ''; }
    catch { storageMessage = 'Trasu se nepodařilo uložit v prohlížeči; pracuješ s dočasnou kopií.'; }
  }
  function bundle() { return { ...captureRoute(plan, models(), results, { ...getClouds(), loading }), section: section.snapshot() }; }
  function renderOutput() {
    section.sync();
    const source = getClouds();
    displaySignature = JSON.stringify([getContext().timezone, source.clouds?.retrievedAt, source.clouds?.runTime, source.cloudError, $('route-data').clientWidth]);
    const availableWidth = $('route-data').clientWidth || 720;
    $('route-data').innerHTML = invalidDeparture ? '<p class="route-attention">Oprav plánovaný odlet. Počasí trasy ani její zachycení nejsou pro neplatný čas dostupné.</p>' : renderRouteBriefing(bundle(), { zone: getContext().timezone, interactive: true, width: Math.max(300, Math.min(1000, availableWidth > 900 ? (availableWidth - 20) / 2 : availableWidth)) });
    $('route-storage').textContent = storageMessage;
    $('route-refresh').disabled = loading || !plan.points.length;
    $('route-map').disabled = plan.points.length < 2;
    $('route-clear').disabled = !plan.points.length;
    $('route-empty').hidden = Boolean(plan.points.length);
    $('route-plan').hidden = !plan.points.length;
    $('route-undo').hidden = !undoPlan;
    const schedule = routeSchedule(plan), last = schedule.at(-1);
    $('route-summary').textContent = plan.points.length ? `${plan.points.length} / ${ROUTE_LIMIT} bodů · ${formatNumber(last.distanceKm, 1)} km přímých spojnic${last.elapsedMinutes === null ? ' · chybí délka úseku' : ` · ${last.elapsedMinutes} min podle zadání`}` : 'Volitelná bodová trasa';
    if (!invalidDeparture && document.activeElement !== $('route-departure')) $('route-departure').value = plan.departure ? toDateTimeInput(plan.departure, getContext().timezone) : '';
    $('route-zone').textContent = getContext().timezone === 'UTC' ? 'UTC' : 'CZ';
  }
  function renderEditor() {
    $('route-points').innerHTML = plan.points.map((point, index) => `<li class="route-editor-point"><div><strong>${index + 1}. ${esc(point.name)}</strong><small>${esc(formatCoordinates(point.lat, point.lon))}</small></div>${index ? `<label for="route-leg-${index}">Od předchozího bodu · min<input id="route-leg-${index}" data-route-leg="${index}" aria-label="Doba úseku do bodu ${index + 1} ${esc(point.name)} v minutách" type="number" min="1" max="600" step="1" inputmode="numeric" value="${point.legMinutes ?? ''}" placeholder="Doplň čas"></label>` : '<span class="route-note">Začátek trasy</span>'}<div class="route-editor-actions"><button type="button" class="button button-quiet" data-route-move="${index}" data-direction="-1" aria-label="Posunout bod ${index + 1} nahoru" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" class="button button-quiet" data-route-move="${index}" data-direction="1" aria-label="Posunout bod ${index + 1} dolů" ${index === plan.points.length - 1 ? 'disabled' : ''}>↓</button><button type="button" class="button button-quiet" data-route-remove="${index}" aria-label="Odebrat bod ${index + 1} ${esc(point.name)}">Odebrat</button></div></li>`).join('');
  }
  function updateChoices() {
    const choices = getChoices(), next = JSON.stringify(choices);
    if (choiceSignature !== next) {
      const selected = $('route-pick').value, previous = selected === 'current' ? null : availableChoices[Number(selected)];
      $('route-pick').replaceChildren(new Option('Právě vybraný bod', 'current'), ...choices.map((point, index) => new Option(point.name, String(index))));
      const index = previous ? choices.findIndex(point => point.name === previous.name && point.lat === previous.lat && point.lon === previous.lon) : -1;
      $('route-pick').value = index < 0 ? 'current' : String(index);
      availableChoices = choices;
      choiceSignature = next;
    }
    $('route-current').textContent = `Vybráno: ${getContext().name}`;
  }
  async function refresh(force = false) {
    const next = key();
    if (loading && signature === next && !force) return pending;
    controller?.abort(); controller = new AbortController(); const signal = controller.signal, id = ++sequence;
    signature = next;
    if (!plan.points.length) { loading = false; renderOutput(); return; }
    if (Date.now() < retryUntil) { loading = false; setMessage(`Zdroj omezuje požadavky. Další kontrola nejdříve ${formatTime(new Date(retryUntil).toISOString(), getContext().timezone, true)}.`); renderOutput(); return; }
    loading = true; renderOutput();
    const capturedPlan = structuredClone(plan), capturedModels = models();
    pending = (async () => {
      try {
        const loaded = await loadRouteForecasts(capturedPlan, capturedModels, { fetcher: fetchForecast, force, signal });
        if (id !== sequence) return;
        results = loaded.results;
        if (loaded.limited) { retryUntil = Math.max(Date.now() + 60000, Date.parse(loaded.retryAt) || 0); setMessage('Zdroj omezuje požadavky; další body jsou označené jako nedostupné.'); }
        else await section.refresh(force);
      } catch (error) { if (id === sequence && error.name !== 'AbortError') setMessage(error.message); }
      finally { if (id === sequence) { loading = false; renderOutput(); } }
    })();
    return pending;
  }
  function changed({ reset = false, editor = true } = {}) {
    clearTimeout(legTimer);
    plan = normalizeRoutePlan(plan);
    if (!plan.points.length) invalidDeparture = false;
    if (reset) results = {};
    save(); if (editor) renderEditor(); onGeometry(plan.points); void refresh();
  }
  $('route-add').addEventListener('click', () => {
    if (plan.points.length >= ROUTE_LIMIT) { setMessage('Nejvýše šest bodů. Odeber bod nebo uprav pořadí.'); return; }
    const choice = $('route-pick').value, point = choice === 'current' ? getContext() : availableChoices[Number(choice)];
    if (!point) { updateChoices(); return; }
    if (!plan.points.length) { const date = new Date(getContext().time); date.setUTCSeconds(0, 0); plan.departure = date.toISOString(); invalidDeparture = false; }
    plan.points.push({ name: point.name, lat: point.lat, lon: point.lon, legMinutes: plan.points.length ? null : 0 });
    setMessage(plan.points.length > 1 ? 'Bod přidán. Doplň dobu od předchozího bodu; čas průchodu se neodhaduje.' : 'Začátek trasy přidán. Odlet je nyní samostatný čas.');
    changed();
    if (plan.points.length > 1) $(`route-leg-${plan.points.length - 1}`).focus();
  });
  $('route-departure').addEventListener('change', event => {
    const date = fromDateTimeInput(event.target.value, getContext().timezone);
    if (!date) { invalidDeparture = true; event.target.setCustomValidity('Čas neexistuje nebo není platný. Opakovaná podzimní hodina používá první výskyt; druhý zadej v UTC.'); event.target.reportValidity(); setMessage('Neplatný odlet: oprav čas před zobrazením nebo zachycením trasy.'); renderOutput(); return; }
    invalidDeparture = false; event.target.setCustomValidity(''); plan.departure = date; setMessage('Plánovaný odlet a časy průchodů změněny.'); changed({ editor: false });
  });
  $('route-use-time').addEventListener('click', () => { const date = new Date(getContext().time); date.setUTCSeconds(0, 0); plan.departure = date.toISOString(); invalidDeparture = false; $('route-departure').setCustomValidity(''); setMessage('Čas přehledu jednorázově převzat jako plánovaný odlet.'); changed({ editor: false }); });
  function updateLeg(event) {
    if (!event.target.matches('[data-route-leg]')) return;
    const index = Number(event.target.dataset.routeLeg), raw = event.target.value, minutes = raw === '' ? null : Number(raw);
    if (minutes !== null && (!Number.isInteger(minutes) || minutes < 1 || minutes > 600)) { event.target.setCustomValidity('Zadej celé číslo 1–600 minut, nebo nech pole prázdné.'); plan.points[index].legMinutes = null; setMessage('Neplatná délka úseku: navazující časy a vzorky byly zrušeny. Zadej 1–600 celých minut.'); save(); renderOutput(); clearTimeout(legTimer); legTimer = setTimeout(() => void refresh(), 300); return; }
    event.target.setCustomValidity(''); setMessage(minutes === null ? 'Čas úseku nevyplněn; navazující průchody zůstávají neurčené.' : 'Čas průchodu přepočten podle zadaných minut.'); if (plan.points[index].legMinutes === minutes) return;
    plan.points[index].legMinutes = minutes; save(); renderOutput(); clearTimeout(legTimer); legTimer = setTimeout(() => void refresh(), 300);
  }
  $('route-points').addEventListener('input', updateLeg);
  $('route-points').addEventListener('change', updateLeg);
  $('route-points').addEventListener('click', event => {
    const remove = event.target.closest('[data-route-remove]'), move = event.target.closest('[data-route-move]');
    if (remove) { undoPlan = structuredClone(plan); plan.points.splice(Number(remove.dataset.routeRemove), 1); plan.points.forEach((point, index) => { point.legMinutes = index ? null : 0; }); changed({ reset: true }); setMessage('Bod odebrán. Délky změněných úseků vyplň znovu; odebrání můžeš vrátit.'); $('route-undo').focus(); }
    if (move) {
      const index = Number(move.dataset.routeMove), target = index + Number(move.dataset.direction);
      if (target < 0 || target >= plan.points.length) return;
      undoPlan = structuredClone(plan); [plan.points[index], plan.points[target]] = [plan.points[target], plan.points[index]];
      plan.points.forEach((point, i) => { point.legMinutes = i ? null : 0; });
      setMessage('Pořadí změněno. Délky úseků je třeba vyplnit znovu, protože spojují jiné body.'); changed({ reset: true });
      $(`route-leg-${Math.max(1, target)}`)?.focus();
    }
  });
  $('route-clear').addEventListener('click', () => { undoPlan = structuredClone(plan); plan.points = []; changed({ reset: true }); setMessage('Trasa odebrána; můžeš ji vrátit.'); $('route-undo').focus(); });
  $('route-undo').addEventListener('click', () => { if (!undoPlan) return; plan = undoPlan; undoPlan = null; changed({ reset: true }); setMessage('Předchozí trasa vrácena.'); $('route-add').focus(); });
  $('route-refresh').addEventListener('click', () => void refresh(true));
  $('route-map').addEventListener('click', () => onMap(plan.points));
  $('route-data').addEventListener('click', event => {
    const button = event.target.closest('[data-route-inspect]'); if (!button) return;
    const point = routeSchedule(plan)[Number(button.dataset.routeInspect)]; if (point) onInspect(point);
  });
  renderEditor(); updateChoices(); renderOutput();
  return { refresh, points: () => plan.points, snapshot() { if (invalidDeparture && plan.points.length) throw new Error('Oprav plánovaný odlet trasy před zachycením briefingu.'); return plan.points.length ? bundle() : null; }, stop() { sequence++; controller?.abort(); clearTimeout(legTimer); section.stop(); loading = false; }, sync() { updateChoices(); if (key() !== signature) void refresh(); else { const source = getClouds(); if (JSON.stringify([getContext().timezone, source.clouds?.retrievedAt, source.clouds?.runTime, source.cloudError, $('route-data').clientWidth]) !== displaySignature) renderOutput(); } } };
}
