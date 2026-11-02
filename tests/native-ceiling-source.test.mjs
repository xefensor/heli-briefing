import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchNativeCeiling, discoverNativeCeiling, createNativeCeilingCache, cropNativeGrid, NATIVE_CEILING_ORIGIN, NATIVE_CEILING_PREFIX } from '../web/js/native-ceiling-source.js';
import { fixtureGrib } from './native-grib-fixtures.mjs';

const now=()=>Date.parse('2026-11-02T12:37:00Z'),run=NATIVE_CEILING_PREFIX+'2026-11-02T06/',at='2026-11-02T06:00:00.000Z';
const xml=content=>`<?xml version="1.0"?><ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><IsTruncated>false</IsTruncated>${content}</ListBucketResult>`;
function provider({missing=[],fail=[],future=false}={}){
  let active=0,max=0;const urls=[];
  const fetcher=async(url,options)=>{
    urls.push(url);assert.equal(options.credentials,'omit');assert.equal(options.mode,'cors');active++;max=Math.max(max,active);await new Promise(resolve=>setTimeout(resolve,1));active--;
    const u=new URL(url);
    if(u.searchParams.get('delimiter')==='/')return new Response(xml(`<CommonPrefixes><Prefix>${run}</Prefix></CommonPrefixes>${future?`<CommonPrefixes><Prefix>${NATIVE_CEILING_PREFIX}2026-11-03T00/</Prefix></CommonPrefixes>`:''}`));
    if(u.searchParams.has('list-type'))return new Response(xml(Array.from({length:20},(_,i)=>i).filter(i=>!missing.includes(i)).map(i=>`<Contents><Key>${run}CEILING/PT${String(i).padStart(3,'0')}H00M.grib2</Key></Contents>`).join('')));
    const match=/\/(CEILING|CLAT|CLON|HSURF)\/PT(\d{3})H00M\.grib2$/.exec(url);assert.ok(match,url);
    const field=match[1],lead=+match[2];if(field==='CEILING'&&fail.includes(lead))return new Response('failed',{status:503});
    return new Response(fixtureGrib(field,{runTime:at,leadHours:lead,reference:{CLAT:48.95,CLON:14.43,HSURF:440,CEILING:3000+lead}[field]}));
  };return{fetcher,urls,getMax:()=>max};
}

test('native source uses advertised nonfuture run, real closest hour and one bounded crop across six frames',async()=>{
  const p=provider({future:true}),cache=createNativeCeilingCache();
  const result=await fetchNativeCeiling({lat:48.95,lon:14.43,time:new Date(now()).toISOString(),now,fetcher:p.fetcher,cache});
  assert.equal(result.model,'ICON-EU');assert.equal(result.units,'m MSL');assert.equal(result.validAt,'2026-11-02T13:00:00.000Z');assert.equal(result.valueMsl,3007);
  assert.equal(result.snapshot.frames.length,6);assert.equal(result.snapshot.frames[0].validAt,'2026-11-02T12:00:00.000Z');
  assert.equal(result.snapshot.points.length,1);assert.equal(result.regional.nodes[0].valueMsl,3007);assert.equal(result.regional.gridUuid,result.cell.gridUuid);assert.equal(result.cell.elevationMsl,440);
  assert.ok(p.getMax()<=2);assert.equal(p.urls.length,11);
  const count=p.urls.length;
  const again=await fetchNativeCeiling({lat:48.96,lon:14.44,time:'2026-11-02T12:30:00Z',now,fetcher:p.fetcher,cache});
  assert.equal(again.validAt,'2026-11-02T12:00:00.000Z');assert.equal(p.urls.length,count);assert.equal(again.retrievedAt,result.retrievedAt);
});

test('missing advertised hours and failed loads remain null rather than switching time or filling values',async()=>{
  const p=provider({missing:[7],fail:[8]});
  const r=await fetchNativeCeiling({lat:48.95,lon:14.43,time:'2026-11-02T12:37:00Z',now,fetcher:p.fetcher,cache:createNativeCeilingCache()});
  assert.equal(r.status,'unavailable');assert.equal(r.valueMsl,null);assert.equal(r.validAt,null);assert.equal(r.regional,null);assert.equal(r.snapshot.status,'partial');
  assert.equal(r.snapshot.frames[1].status,'missing');assert.deepEqual(r.snapshot.frames[1].values,[null]);
  assert.equal(r.snapshot.frames[2].status,'unavailable');assert.deepEqual(r.snapshot.frames[2].values,[null]);assert.match(r.error,/2 z 6/);
});

test('native source bounds requested hours, rejects incomplete catalogues, changed origins and mismatched actual GRIB dates',async()=>{
  const p=provider();
  await assert.rejects(fetchNativeCeiling({lat:48.95,lon:14.43,time:'2026-11-02T12:00:00Z',frameLimit:25,now,fetcher:p.fetcher}),/počet/);
  for(const time of ['2026-11-02T12:00:00','2026-02-31T12:00:00Z','2026-11-02T24:00:00Z'])await assert.rejects(fetchNativeCeiling({lat:48.95,lon:14.43,time,now,fetcher:p.fetcher}),/neplatné místo/);
  for(const text of [xml('').replace('false','true'),xml('').replace('http://s3.amazonaws.com/doc/2006-03-01/','https://untrusted.test'), '<!DOCTYPE x>'+xml('')])await assert.rejects(discoverNativeCeiling({now,cache:createNativeCeilingCache(),fetcher:async()=>new Response(text)}),/katalog/);
  await assert.rejects(discoverNativeCeiling({now,cache:createNativeCeilingCache(),fetcher:async()=>({ok:true,url:'https://untrusted.test/file',arrayBuffer:async()=>new ArrayBuffer(0)})}),/přesměrován/);
  const bad=provider();const fetcher=async(url,opts)=>url.includes('/CLAT/')?new Response(fixtureGrib('CLAT',{reference:48.95,runTime:'2026-11-02T03:00:00.000Z'})):bad.fetcher(url,opts);
  await assert.rejects(fetchNativeCeiling({lat:48.95,lon:14.43,time:'2026-11-02T12:00:00Z',now,fetcher,cache:createNativeCeilingCache()}),/skutečný parametr/);
  const aborted=new AbortController();aborted.abort();await assert.rejects(fetchNativeCeiling({lat:48.95,lon:14.43,time:'2026-11-02T12:00:00Z',now,signal:aborted.signal,fetcher:p.fetcher}),{name:'AbortError'});
});

test('native crops keep actual cell indices, nearest-cell inclusion, null terrain and honest outside-grid coverage',()=>{
  const grid={uuid:'one',number:62,count:6,reference:1};
  const f=values=>({grid,values:Float64Array.from(values)});
  const lat=f([48.91,48.92,48.93,48.94,48.95,48.96]),lon=f([14.4,14.41,14.42,14.43,14.44,14.45]),surface=f([400,NaN,410,420,430,440]);
  const crop=cropNativeGrid(lat,lon,surface,{lat:48.92,lon:14.41,maxNodes:3});
  assert.equal(crop.totalCells,6);assert.equal(crop.subset,true);assert.ok(crop.indices.includes(1));assert.equal(crop.points[crop.nearestIndex].elevationMsl,null);assert.equal(crop.distanceKm,0);
  assert.throws(()=>cropNativeGrid(lat,lon,surface,{lat:60,lon:5}),/blízkou buňku/);
});
