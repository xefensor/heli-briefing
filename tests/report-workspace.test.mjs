import test from 'node:test';
import assert from 'node:assert/strict';
import { renderReportGuide, renderMetarSummary, renderTafPeriods, REPORT_VIEW_CSS } from '../web/js/report-views.js';
import { createBriefingSnapshot, renderBriefingHtml } from '../web/js/archive.js';

const taf = raw => ({raw:`TAF LKCS 011100Z 0112/0212 ${raw}`,validFrom:'2026-11-01T12:00:00Z',validTo:'2026-11-02T12:00:00Z'});

test('scan rows retain every conditional group without adding earlier visibility or cloud to a wind-only BECMG',()=>{
 const html=renderTafPeriods(taf('05005KT 9999 SCT025 BECMG 0118/0120 30004KT TEMPO 0118/0202 2000 BR BKN003 PROB30 0202/0206 0400 FG VV///'),{selectedTime:'2026-11-01T19:00:00Z',timezone:'UTC',compact:true});
 const rows=[...html.matchAll(/<tr class="taf-period"[\s\S]*?<\/tr>/g)].map(match=>match[0]);
 assert.equal(rows.length,4);
 const change=rows.find(row=>row.includes('>BECMG<'));
 assert.match(change,/taf-condition--wind/);assert.match(change,/300° \/ 4 kt/);
 assert.doesNotMatch(change,/taf-condition--visibility|taf-condition--ceiling|taf-condition--clouds|≥ 10 km|SCT/);
 assert.match(change,/Postupná změna v intervalu/);
 assert.match(change,/1\.11\. 18:00 UTC/);assert.match(change,/1\.11\. 20:00 UTC/);
 assert.ok(rows.filter(row=>row.includes('data-selected="true"')).length>1,'overlap remains distinct from a single effective-conditions row');
 assert.match(rows[2],/300 ft AGL/);assert.match(rows[3],/Výška neznámá/);
 assert.match(rows[3],/PROB30/);assert.match(html,/Jen výslovně uvedené položky/);
 assert.doesNotMatch(html,/<details[^>]*>[\s\S]*<table/);
});

test('the always-visible reading key and exceptional METAR warnings do not depend on expanding interpretation guidance',()=>{
 const guide=renderReportGuide(),key=guide.split('<details')[0];
 assert.match(key,/ft AGL nad letištěm/);assert.match(key,/BECMG je okno změny/);assert.match(key,/TEMPO přechodně, PROB pravděpodobnost/);assert.match(key,/UTC/);
 const html=renderMetarSummary({raw:'METAR LKCS 011200Z 00000KT 0000 FG VV/// 00/00 Q1030',observedAt:'2026-11-01T12:00:00Z'},{timezone:'UTC'});
 const visible=html.split('<details')[0];
 assert.match(visible,/&lt; 50 m/);assert.match(visible,/Výška neznámá/);
 assert.match(visible,/report-warnings/);assert.match(visible,/Pozorování 1\.11\. 12:00 UTC/);
 assert.match(visible,/0 kt/);assert.match(visible,/0 °C \/ 0 °C/);
});

test('standalone briefing embeds report styles and preserves print qualifications outside closed guide details',()=>{
 const snapshot=createBriefingSnapshot({state:{name:'Planá',lat:48.9463,lon:14.4294,model:'aladin',time:'2026-11-01T18:00:00Z',hours:24,timezone:'UTC'},createdAt:'2026-11-01T17:00:00Z'});
 const html=renderBriefingHtml(snapshot);
 assert.ok(html.includes(REPORT_VIEW_CSS),'frozen output contains the helper styles without a network stylesheet');
 assert.doesNotMatch(REPORT_VIEW_CSS,/#reports-panel|@import|url\(/);
 const guide=renderReportGuide(),printNote=guide.match(/<p class="print-only report-guide-print-note">([\s\S]*?)<\/p>/)?.[1];
 assert.ok(printNote);assert.match(printNote,/CAVOK není neomezená ani změřená výška/);
 assert.match(printNote,/BECMG je okno postupné změny, nikoli okamžik přepnutí/);
 assert.ok(guide.indexOf(printNote)<guide.indexOf('<details'),'print qualifications do not require opening native details');
});
