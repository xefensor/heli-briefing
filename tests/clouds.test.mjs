import test from 'node:test';
import assert from 'node:assert/strict';
import { validateClouds, queryClouds } from '../web/js/clouds.js';

const sample = () => ({
  schemaVersion: 1, status: 'ok', model: 'ICON-D2', product: 'CEILING', units: 'm MSL',
  runTime: '2026-11-01T12:00:00Z', retrievedAt: '2026-11-01T13:10:00Z', error: null,
  region: {south:48.4,north:49.7,west:12.9,east:15.7}, grid: {type:'native-unstructured',maxDistanceKm:3.5},
  points: [{lat:48.94,lon:14.42,elevationMsl:437},{lat:49.04,lon:14.50,elevationMsl:500}],
  frames: [{validAt:'2026-11-01T14:00:00Z',values:[0,9999],sourceUrl:'https://source/14'},
    {validAt:'2026-11-01T15:00:00Z',values:[1200,null],sourceUrl:'https://source/15'},
    {validAt:'2026-11-01T16:00:00Z',values:[1600,900],sourceUrl:'https://source/16'}],
});
const options = {lat:48.9463,lon:14.4294,time:'2026-11-01T14:10:00Z',nowMs:Date.parse('2026-11-01T14:00:00Z')};

test('native sample preserves real zero, source cell and MSL meaning', () => {
  const result = queryClouds(validateClouds(sample()), options);
  assert.equal(result.status, 'available');
  assert.equal(result.valueMsl, 0);
  assert.equal(result.cell.elevationMsl, 437);
  assert.equal(result.units, 'm MSL');
  assert.ok(result.distanceKm > 0.8 && result.distanceKm < 1.2);
  assert.equal(result.validAt, '2026-11-01T14:00:00Z');
  assert.equal(result.sourceUrl, 'https://source/14');
  assert.deepEqual(result.series.values, [0,1200,1600]);
  assert.equal(result.valueAgl, undefined);
});

test('undefined diagnostic and real 9999m remain different', () => {
  assert.equal(queryClouds(sample(), {...options,lat:49.04,lon:14.5}).valueMsl,9999);
  const result = queryClouds(sample(), {...options,lat:49.04,lon:14.5,time:'2026-11-01T15:00:00Z'});
  assert.equal(result.status,'missing');
  assert.equal(result.valueMsl,null);
  assert.deepEqual(result.series.values,[9999,null,900]);
});

test('outside region, sparse grid and forecast horizon do not borrow a value', () => {
  assert.equal(queryClouds(sample(), {...options,lat:50}).status,'outside-region');
  assert.equal(queryClouds(sample(), {...options,lat:49.5}).status,'outside-grid');
  assert.equal(queryClouds(sample(), {...options,time:'2026-11-01T13:59:59Z'}).status,'outside-horizon');
  assert.equal(queryClouds(sample(), {...options,time:'2026-11-01T16:00:01Z'}).status,'outside-horizon');
  const sparse=sample();sparse.frames.splice(1,1);
  assert.equal(queryClouds(sparse, {...options,time:'2026-11-01T15:00:00Z'}).status,'outside-horizon');
});

test('stale transport keeps original provenance and expired run stays explicit', () => {
  const data={...sample(),status:'stale',error:'source unavailable'};
  const result=queryClouds(data,options);
  assert.equal(result.status,'available');
  assert.equal(result.stale,true);
  assert.equal(result.error,'source unavailable');
  assert.equal(result.retrievedAt,data.retrievedAt);
  assert.equal(queryClouds(data,{...options,nowMs:Date.parse('2026-11-01T17:00:00Z')}).status,'expired');
});

test('decoder format validation rejects wrong vertical unit and misaligned cells', () => {
  assert.throws(()=>validateClouds({...sample(),units:'m AGL'}));
  const wrong=sample();wrong.frames[0].values=[200];
  assert.throws(()=>validateClouds(wrong));
  const unordered=sample();unordered.frames.reverse();
  assert.throws(()=>validateClouds(unordered));
  const malformed=sample();malformed.frames[0].values[0]='0';
  assert.throws(()=>validateClouds(malformed));
});

test('initial outage and invalid selected coordinates remain unavailable', () => {
  const empty={...sample(),status:'unavailable',points:[],frames:[],retrievedAt:null,runTime:null};
  assert.equal(validateClouds(empty),empty);
  assert.equal(queryClouds(empty,options).status,'unavailable');
  assert.equal(queryClouds(sample(),{...options,lat:NaN}).status,'unavailable');
});
