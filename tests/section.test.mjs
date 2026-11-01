import test from 'node:test';
import assert from 'node:assert/strict';
import { sectionPositions, sphericalPoint, loadSection, validateSection, renderSection } from '../web/js/section.js';
const schedule=[{lat:48.95,lon:14.43,name:'Base',passageAt:'2026-11-01T12:00:00.000Z',distanceKm:0},{lat:49.07,lon:13.61,name:'Hill',passageAt:'2026-11-01T13:00:00.000Z',distanceKm:61}];
const terrainFetcher=async(url)=>{const points=JSON.parse(new URL(url).searchParams.get('geometry')).points;return {ok:true,json:async()=>({results:points.map((_,objectId)=>({objectId,value:objectId===2?'NoData':'425',location:{spatialReference:{vcsWkid:8357}}}))})};};
const weather=async({lat,lon,model})=>({model,requestedLocation:{lat,lon},times:['2026-11-01T12:00:00.000Z','2026-11-01T13:00:00.000Z'],hourly:{wind:[0,10],gust:[1,null],visibility:[10000,null],cloudLow:[0,50],precipitation:[0,1]},retrievedAt:'2026-11-01T11:50:00Z',runTime:null,sourceUrl:'https://example.com/forecast',profile:{status:'available',terrainMsl:420,levels:[{pressureHpa:925,interpolated:false,height:[800,810],wind:[0,12],direction:[0,90],temperature:[5,4],humidity:[90,95],reasons:[null,null]}]}});
test('section samples include nodes and interpolate only planned position/time',()=>{
 const points=sectionPositions(schedule);assert.equal(points[0].lon,14.43);assert.equal(points.at(-1).passageAt,schedule[1].passageAt);assert.ok(points.length<=17);assert.equal(points.find(point=>point.distanceKm===30.5).passageAt,'2026-11-01T12:30:00.000Z');
 assert.throws(()=>sectionPositions([schedule[0],{...schedule[1],passageAt:null}]),/časy/);
 assert.throws(()=>sectionPositions([schedule[0],{...schedule[1],distanceKm:0}]),/shodné/);
 const crossing=sphericalPoint({lat:0,lon:179},{lat:0,lon:-179},.5);assert.ok(Math.abs(crossing.lon)>179.9);
});
test('section preserves nearest hourly time, zero/gaps, Bpv separation and all snapshot context',async()=>{
 const section=await loadSection(schedule,'aladin',{fetcher:weather,terrainFetcher});validateSection(section,schedule,'aladin');
 assert.equal(section.rows[0].values.wind,0);assert.equal(section.rows.at(-1).values.gust,null);assert.equal(section.rows[0].runTime,null);assert.equal(section.terrain.units,'m Bpv');assert.ok(section.terrain.values.includes(null));
 assert.throws(()=>validateSection(section,schedule,'icon'),/neodpovídá/);
 const changed=structuredClone(section);changed.rows[1].lat+=1;assert.throws(()=>validateSection(changed,schedule,'aladin'),/jiné poloze/);
 const html=renderSection(section);assert.match(html,/Bpv/);assert.match(html,/neinterpoluje/);assert.doesNotMatch(html,/role="button"|tabindex="0"/);assert.match(renderSection(section,{interactive:true}),/role="button"/);
});
test('rate limit does not trigger a burst; prior terrain retains original retrieval time',async()=>{
 const original=await loadSection(schedule,'aladin',{fetcher:weather,terrainFetcher});let requests=0;
 const limited=await loadSection(schedule,'icon',{previousTerrain:original.terrain,terrainFetcher:()=>assert.fail('terrain should be reused'),fetcher:async()=>{requests++;const error=new Error('Quota');error.status=429;throw error;}});
 assert.ok(requests<=2);assert.equal(limited.limited,true);assert.ok(limited.rows.every(row=>row.validAt===null));assert.equal(limited.terrain.retrievedAt,original.terrain.retrievedAt);
});
test('wrong model and outside-hour data remain unavailable, never silently substituted',async()=>{
 const section=await loadSection(schedule,'icon',{fetcher:weather.bind(null),terrainFetcher});assert.equal(section.model,'icon');
 const wrong=await loadSection(schedule,'aladin',{fetcher:async point=>({...await weather(point),model:'icon'}),previousTerrain:section.terrain});assert.ok(wrong.rows.every(row=>row.validAt===null&&row.error));
});
