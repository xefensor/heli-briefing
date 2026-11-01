import test from 'node:test';
import assert from 'node:assert/strict';
import { terrainUrl, normalizeTerrain, fetchTerrain } from '../web/js/terrain.js';
const point={lat:48.95,lon:14.43};
const result=(objectId,value='420.75',vcsWkid=8357)=>({objectId,value,location:{spatialReference:{vcsWkid}}});
test('terrain requests WGS84 multipoints with raw DMR values and verifies Bpv',()=>{
 const url=new URL(terrainUrl([point]));
 assert.deepEqual(JSON.parse(url.searchParams.get('geometry')).points,[[14.43,48.95]]);
 assert.equal(JSON.parse(url.searchParams.get('renderingRule')).rasterFunction,'None');
 assert.deepEqual(normalizeTerrain({results:[result(2,'NoData'),result(0,'420.75')]},3),[420.75,null,null]);
 assert.deepEqual(normalizeTerrain(result(0,'1062.47'),1),[1062.47]);
 assert.throws(()=>normalizeTerrain({results:[result(0),result(0)]},2),/pořadí/);
 assert.throws(()=>normalizeTerrain({results:[result(1)]},1),/pořadí/);
 assert.throws(()=>normalizeTerrain({results:[result(0,'10',5703)]},1),/Bpv/);
 assert.throws(()=>terrainUrl([{lat:91,lon:0}]),/body/);
});
test('terrain chunk failures remain gaps with real retrieval time; 429 stops the queue',async()=>{
 let calls=0;
 const data=await fetchTerrain(Array(129).fill(point),{now:()=> '2026-11-01T12:00:00Z',fetcher:async()=>{calls++;return calls===1?{ok:true,json:async()=>({results:[result(0)]})}:{ok:false,status:429};}});
 assert.equal(calls,2);assert.equal(data.values.length,129);assert.equal(data.values[0],420.75);assert.ok(data.values.slice(1).every(value=>value===null));
 assert.equal(data.status,'partial');assert.equal(data.units,'m Bpv');assert.equal(data.surveyTime,null);assert.equal(data.retrievedAt,'2026-11-01T12:00:00Z');
});
test('aborted terrain never resolves as a successful partial profile',async()=>{
 const controller=new AbortController();controller.abort();
 await assert.rejects(fetchTerrain([point],{signal:controller.signal,fetcher:()=>assert.fail('aborted request')}),{name:'AbortError'});
});
