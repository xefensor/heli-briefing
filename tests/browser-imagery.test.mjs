import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserCameras, validateCameras, cameraState, renderCameras, MUNICIPAL_CAMERA } from '../web/js/cameras.js';
import { createBrowserCharts, validateCharts, captureCharts, renderAviationCharts } from '../web/js/aviation-charts.js';
import { createBriefingSnapshot, renderBriefingHtml } from '../web/js/archive.js';

const context = { name: 'Planá', lat: 48.9463, lon: 14.4294, model: 'aladin', timezone: 'Europe/Prague', time: '2026-11-02T10:00:00Z', hours: 24 };

test('browser capability limits never become retrieved observations or current forecast maps', async () => {
  const cameras = createBrowserCameras(), charts = createBrowserCharts();
  validateCameras(cameras);
  validateCharts(charts);
  for (const item of cameras.items) {
    assert.equal(item.observedAt, null);
    assert.equal(item.retrievedAt, null);
    assert.equal(cameraState(item, Date.parse(context.time)), 'unavailable');
  }
  assert.equal(charts.swl.validFrom, null);
  assert.equal(charts.swl.validTo, null);
  let requests = 0;
  const captured = await captureCharts(charts, context.time, { fetcher: () => { requests += 1; throw new Error('Unexpected snapshot request'); } });
  assert.equal(requests, 0);
  validateCharts(captured, { captured: true });
  assert.equal(captured.selectedLow, null);
  const rendered = renderAviationCharts(charts, { ...context, interactive: true });
  assert.match(rendered, /CORS/);
  assert.match(rendered, /id="lowcloud-map"[^>]*disabled/);
  assert.doesNotMatch(rendered, /<img|data-chart-enlarge|MAPA NEPOKRÝVÁ VYBRANÝ ČAS/);
});

test('frozen browser briefing retains original camera identities and municipal online-only source without remote content', () => {
  const cameras = createBrowserCameras();
  const snapshot = createBriefingSnapshot({ state: context, cameras, charts: createBrowserCharts(), createdAt: context.time });
  const html = renderBriefingHtml(snapshot);
  assert.deepEqual(snapshot.cameras.items.map(item => item.id), ['ceske_budejovice', 'churanov', 'kocelovice']);
  assert.equal(snapshot.cameras.onlineViewer.viewerUrl, MUNICIPAL_CAMERA.viewerUrl);
  assert.equal(snapshot.cameras.onlineViewer.observedAt, null);
  assert.equal(snapshot.cameras.onlineViewer.captured, false);
  assert.match(html, /stream\.c-budejovice\.cz\/webkamera-4-radnice\.html/);
  assert.match(html, /žádný snímek videa nebyl zachycen|pouze online|Pouze online/);
  assert.doesNotMatch(html, /<iframe|<video|<img[^>]+src=["'](?:https?:|\.\/)/);
  const liveSummary = renderCameras(cameras, { ...context, interactive: true });
  assert.doesNotMatch(liveSummary, /<iframe|<img|data-camera-enlarge/);
  const invalid = structuredClone(cameras);
  invalid.onlineViewer.viewerUrl = 'https://example.com/untrusted-viewer';
  assert.throws(() => validateCameras(invalid), /městské kamery/);
});
