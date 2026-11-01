import { loadSection, renderSection, validateSection } from './section.js';
import { fetchForecast } from './weather.js';

export function mountSection({ getSchedule, getModel, getZone }) {
  const $ = id => document.getElementById(id);
  let data = null, controller = null, sequence = 0, signature = '', enabled = false, timer = null, loading = false, selected = 0, cooldown = 0, lastTerrain = null, paintedZone = '';
  const key = () => JSON.stringify([getSchedule(), getModel()]);
  function paint() { paintedZone = getZone(); $('section-data').innerHTML = data ? renderSection(data, { zone: paintedZone, selected, interactive: true }) : ''; }
  function clear() { sequence++; controller?.abort(); data = null; loading = false; $('section-load').disabled = false; paint(); }
  async function refresh(force = false) {
    clearTimeout(timer);
    let schedule;
    try { schedule = getSchedule(); if (schedule.length < 2 || schedule.some(point => !point.passageAt)) throw new Error('Přidej dva body a doplň platné časy úseků.'); }
    catch (error) { clear(); $('section-status').textContent = error.message; return; }
    if (Date.now() < cooldown) { $('section-status').textContent = 'Zdroj omezil požadavky. Před dalším načtením chvíli počkej.'; return; }
    const previousTerrain = force ? null : lastTerrain;
    clear(); enabled = true; loading = true; signature = key(); controller = new AbortController(); const id = ++sequence;
    $('section-load').disabled = true; $('section-status').textContent = 'Načítám meteorologické sloupce a samostatný terén ČÚZK…';
    try {
      const result = await loadSection(schedule, getModel(), { signal: controller.signal, fetcher: fetchForecast, previousTerrain, onProgress: (done, total) => { if (id === sequence) $('section-status').textContent = `Načteno ${done} / ${total} meteorologických sloupců. Terén má samostatný zdroj a výškové datum.`; } });
      if (id !== sequence) return;
      validateSection(result, getSchedule(), getModel()); data = result; lastTerrain = result.terrain; selected = 0;
      if (data.limited) cooldown = Date.now() + 60000;
      $('section-status').textContent = `${data.rows.length} sloupců · ${data.terrain.values.filter(value => value !== null).length} / ${data.terrain.values.length} terénních vzorků${data.limited ? ' · zdroj omezil další požadavky' : ''}. Mezery zůstávají viditelné.`; paint();
    } catch (error) { if (id === sequence && error.name !== 'AbortError') $('section-status').textContent = error.message; }
    finally { if (id === sequence) { loading = false; $('section-load').disabled = false; } }
  }
  $('section-load').addEventListener('click', () => void refresh(true));
  $('section-data').addEventListener('click', event => { const sample = event.target.closest('[data-section-sample]'); if (sample && data) { selected = Number(sample.dataset.sectionSample); paint(); } });
  $('section-data').addEventListener('keydown', event => {
    const sample = event.target.closest('[data-section-sample]'); if (!sample || !data) return;
    if (!['ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(event.key)) return; event.preventDefault();
    const field = sample.closest('[data-section-field]')?.dataset.sectionField;
    selected = Math.max(0, Math.min(data.rows.length - 1, Number(sample.dataset.sectionSample) + (event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0))); paint();
    $('section-data').querySelector(`[data-section-field="${field}"] [data-section-sample="${selected}"]`)?.focus();
  });
  return { snapshot() { if (!data || loading || signature !== key()) return null; return data; }, stop() { clearTimeout(timer); sequence++; controller?.abort(); loading = false; }, sync() {
    if (signature && signature !== key()) { clear(); $('section-status').textContent = 'Trasa nebo hlavní model se změnily. Připravuji aktuální řez…'; if (enabled) { clearTimeout(timer); timer = setTimeout(() => void refresh(), 750); } }
    else if (data && paintedZone !== getZone()) paint();
  } };
}
