import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCameras,cameraState,renderCameras } from '../web/js/cameras.js';
import { validateCharts,selectedLowCloud,imagePosition,captureCharts } from '../web/js/aviation-charts.js';
import { createBriefingSnapshot,renderBriefingHtml } from '../web/js/archive.js';
const when='2026-11-01T12:00:00Z';
const jpg='data:image/jpeg;base64,/9j/2Q==';
const png=Buffer.alloc(45);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.writeUInt32BE(200,16);png.writeUInt32BE(100,20);
const swl={status:'ok',issuedAt:when,validFrom:when,validTo:'2026-11-01T18:00:00Z',retrievedAt:when,imagePath:'./data/charts/swl-202611011200-abcdef123456.png',width:200,height:100};
const low=(validAt,imagePath=null)=>({validAt,imagePath,retrievedAt:when,width:200,height:100,status:imagePath?'ok':'unavailable'});
const charts=()=>({schemaVersion:1,swl:{...swl},lowCloud:{status:'partial',frames:[low(when,'./data/charts/lowcloud-202611011200-abcdef123456.png'),low('2026-11-01T15:00:00Z'),low('2026-11-01T18:00:00Z')]}});
const cameras=()=>({schemaVersion:1,items:[{id:'churanov',name:'Churáňov',lat:49.068229,lon:13.614786,direction:'SV',observedAt:when,retrievedAt:when,width:200,height:100,imageDataUrl:jpg,status:'ok'}]});
test('camera freshness uses advertised observation, not collection time or selected future',()=>{
 const item=cameras().items[0];validateCameras(cameras());assert.equal(cameraState(item,Date.parse(when)+29*60000),'available');assert.equal(cameraState(item,Date.parse(when)+31*60000),'stale');assert.equal(cameraState(item,Date.parse(when)-6*60000),'future');assert.equal(cameraState({...item,imageDataUrl:null}),'unavailable');
 assert.throws(()=>validateCameras({...cameras(),items:[{...item,imageDataUrl:'https://example.com/x.jpg'}]}),/snímek/);
 assert.match(renderCameras(cameras(),{lat:49,lon:14,now:Date.parse(when)}),/EXIF není použit/);
});
test('low cloud preserves missing advertised slots instead of choosing another available image',()=>{
 validateCharts(charts());assert.equal(selectedLowCloud(charts(),'2026-11-01T15:10:00Z').imagePath,null);assert.equal(selectedLowCloud(charts(),'2026-11-02T00:00:00Z'),null);
 assert.ok(imagePosition(48.95,14.43).top>50);assert.equal(imagePosition(40,14),null);
 const wrong=charts();wrong.lowCloud.frames.reverse();assert.throws(()=>validateCharts(wrong),/časy/);
 const path=charts();path.swl.imagePath='https://example.com/remote.png';assert.throws(()=>validateCharts(path),/cesta/);
});
test('captured charts embed actual bytes and honest failures; standalone HTML has no image requests',async()=>{
 const captured=await captureCharts(charts(),when,{fetcher:async()=>({ok:true,arrayBuffer:async()=>png.buffer.slice(png.byteOffset,png.byteOffset+png.byteLength)})});validateCharts(captured,{captured:true});assert.match(captured.swl.imageDataUrl,/^data:image\/png/);assert.equal(captured.lowCloud.frames.length,0);
 const snapshot=createBriefingSnapshot({state:{name:'Test',lat:49,lon:14,model:'aladin',timezone:'UTC',time:when,hours:24},createdAt:when,cameras:cameras(),charts:captured});
 const wrong=structuredClone(captured);wrong.selectedLow.validAt='2026-11-01T15:00:00Z';assert.throws(()=>createBriefingSnapshot({state:snapshot.state,charts:wrong}),/jinému času|jiného času/);
 const html=renderBriefingHtml(snapshot);assert.match(html,/Churáňov/);assert.match(html,/SWL/);assert.doesNotMatch(html,/<img[^>]+src=["'](?:https?:|\.\/)/);assert.equal((html.match(/src="data:image\/png/g)||[]).length,2);
 const failure=await captureCharts(charts(),when,{fetcher:async()=>({ok:false,status:404})});assert.equal(failure.swl.imagePath,null);assert.equal(failure.selectedLow.imagePath,null);validateCharts(failure,{captured:true});
 assert.throws(()=>validateCharts(charts(),{captured:true}),/vložený obraz/);
});
