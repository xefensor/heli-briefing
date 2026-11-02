import {decodeProcessedGeoTiff, rasterCell, cropRaster} from './processed-geotiff.js';

export const PROCESSED_CEILING_ORIGIN = 'https://d34ooj23crdzyh.cloudfront.net';
const RUN = '[0-9]{10}_[0-9]{10}_[0-9]{10}';
const MODEL = {RUC:'ICON-D2-RUC',D2:'ICON-D2',EU:'ICON-EU'};
const HOUR = 3600000;
const abort = signal => { if (signal?.aborted) throw new DOMException('Zrušeno','AbortError'); };
const errText = error => String(error?.message || error).slice(0,220);
const iso = value => new Date(value).toISOString();
export function allowedProcessedCeilingUrl(value,{kind}={}) {
  try {
    const u = new URL(value);
    if (u.origin !== PROCESSED_CEILING_ORIGIN || u.username || u.password || u.search || u.hash) return false;
    const latest = u.pathname === '/latest.json';
    const viewer = new RegExp(`^/viewers/ceiling-viewer-${RUN}\\.html$`).test(u.pathname);
    const raster = new RegExp(`^/cog/ceiling_${RUN}_h[0-9]{2,3}m(?:00|15|30|45)\\.tif$`).test(u.pathname);
    return kind === 'latest' ? latest : kind === 'viewer' ? viewer : kind === 'raster' ? raster : latest || viewer || raster;
  } catch { return false; }
}
function instant(value,label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|\+00:00)$/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error(`Neplatný čas ${label}`);
  const time=Date.parse(value);
  if(iso(time).slice(0,19)!==value.slice(0,19)) throw new Error(`Neplatné datum ${label}`);
  return time;
}
function runInstant(value) {
  if (!/^\d{10}$/.test(value)) throw new Error('Neplatný běh ClearToFly');
  const text=`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}T${value.slice(8,10)}:00:00Z`;
  const time=instant(text,'běhu');
  if (iso(time).slice(0,13)!==text.slice(0,13)) throw new Error('Neplatné datum běhu');
  return time;
}
function literal(config,key) {
  const match=config.match(new RegExp(`\\b${key}\\s*:\\s*(['"])([^'"\\r\\n]{1,180})\\1`));
  if (!match) throw new Error(`Chybí položka katalogu ${key}`);
  return match[2];
}
function frameJson(config) {
  const marker=/\bframes\s*:\s*\[/.exec(config);
  if (!marker) throw new Error('Chybí snímky katalogu');
  const start=marker.index+marker[0].length-1;
  let quoted=false,escaped=false,depth=0;
  for (let i=start;i<config.length && i-start<90000;i++) {
    const c=config[i];
    if (quoted) { if (escaped) escaped=false; else if(c==='\\') escaped=true; else if(c==='"') quoted=false; continue; }
    if(c==='"') quoted=true;
    else if(c==='[') depth++;
    else if(c===']' && --depth===0) return JSON.parse(config.slice(start,i+1));
  }
  throw new Error('Neplatný seznam snímků');
}
export function parseProcessedCeilingCatalogue(latest,html,{now=Date.now()}={}) {
  if (!latest || typeof latest!=='object' || typeof latest.run_id!=='string' || !new RegExp(`^${RUN}$`).test(latest.run_id)) throw new Error('Neplatný katalog ClearToFly');
  const runId=latest.run_id, expected=`viewers/ceiling-viewer-${runId}.html`;
  if (latest.viewers?.ceiling!==expected) throw new Error('Neshoduje se publikovaný prohlížeč');
  const publication=instant(latest.timestamp,'publikace');
  if (publication>now+5*60000) throw new Error('Katalog má budoucí čas publikace');
  const runs=runId.split('_').map(runInstant);
  if (runs.some(time=>time>now+5*60000 || time>publication+5*60000)) throw new Error('Katalog má budoucí běh');
  if (typeof html!=='string' || html.length>3*1024*1024) throw new Error('Neplatná velikost prohlížeče');
  const start=html.indexOf('window.ICON_CONFIG');
  if (start<0) throw new Error('Chybí konfigurace ClearToFly');
  const config=html.slice(start,start+100000);
  if (literal(config,'runId')!==runId || literal(config,'productType')!=='ceiling' || literal(config,'cogBaseUrl')!==`${PROCESSED_CEILING_ORIGIN}/cog`) throw new Error('Neshoduje se produkt nebo zdroj katalogu');
  const baseTime=instant(literal(config,'baseTime'),'základny');
  if(baseTime>publication+5*60000) throw new Error('Budoucí časová základna katalogu');
  // The identifier ties the files together. Model initialization times come
  // separately from the provider's explicit dated model labels, never baseTime.
  const declaredRuns=new Map();
  for(const match of html.matchAll(/\b(D2|RUC|EU)\s+(\d{4}-\d{2}-\d{2})\s+(\d{2})Z\b/g)) {
    const time=instant(`${match[2]}T${match[3]}:00:00Z`,'popisku běhu');
    const expectedRun=runs[match[1]==='D2'?0:match[1]==='RUC'?1:2];
    if(time!==expectedRun || (declaredRuns.has(match[1])&&declaredRuns.get(match[1])!==time)) throw new Error('Neshoduje se deklarovaný běh modelu');
    declaredRuns.set(match[1],time);
  }
  const advertised=frameJson(config);
  if (!Array.isArray(advertised) || !advertised.length || advertised.length>400) throw new Error('Neplatný počet snímků');
  const frames=[];let previous=-1;
  for (const frame of advertised) {
    if (!frame || !Number.isInteger(frame.hour) || frame.hour<0 || frame.hour>400 || ![0,15,30,45].includes(frame.minute) || frame.minutesOffset!==frame.hour*60+frame.minute || frame.minutesOffset<=previous) throw new Error('Neplatná časová osa katalogu');
    previous=frame.minutesOffset;
    const filename=`ceiling_${runId}_h${String(frame.hour).padStart(2,'0')}m${String(frame.minute).padStart(2,'0')}.tif`;
    if (frame.filename!==filename) throw new Error('Neshoduje se soubor a platnost snímku');
    if (!Object.hasOwn(MODEL,frame.source)) { if(frame.source==='ECMWF') continue; throw new Error('Neznámý model v katalogu'); }
    const runTime=declaredRuns.get(frame.source)??null;
    const validTime=baseTime+frame.minutesOffset*60000;
    if (runTime!==null&&(validTime<runTime || validTime-runTime>180*HOUR)) throw new Error('Platnost mimo běh modelu');
    frames.push({validAt:iso(validTime),model:MODEL[frame.source],runTime:runTime===null?null:iso(runTime),runTimeSource:runTime===null?null:'provider viewer explicit model/date/hour',sourceUrl:`${PROCESSED_CEILING_ORIGIN}/cog/${filename}`});
  }
  if (!frames.length) throw new Error('Katalog neobsahuje podporované DWD snímky');
  return {runId,publicationTime:iso(publication),providerReferenceTime:iso(baseTime),providerReferenceNote:'časová základna katalogu; není běh jednotlivých modelů',catalogueUrl:`${PROCESSED_CEILING_ORIGIN}/${expected}`,frames};
}

const processing={grid:'EPSG:3857 processed raster',terrainSource:'unknown',conversion:'provider; details not published'};
const attribution='DWD · zpracování ClearToFly';
function nearest(frames,time) {
  let best=null,distance=Infinity;
  for (const frame of frames) {
    const delta=Math.abs(Date.parse(frame.validAt)-time);
    if(delta<distance) {best=frame;distance=delta;}
  }
  return distance<=30*60000?best:null;
}

export function createProcessedCeilingSource({fetchImpl=globalThis.fetch,now=Date.now}={}) {
  let active=0,catalogue=null,catalogueTime=0;
  const queue=[],cache=new Map();
  const clock=()=>typeof now==='function'?now():now;
  async function acquire(signal) {
    abort(signal);
    if(active<2) {active++;return;}
    await new Promise((resolve,reject)=>{
      const item={resolve:()=>{signal?.removeEventListener('abort',cancel);resolve();},reject};
      const cancel=()=>{const i=queue.indexOf(item);if(i>=0)queue.splice(i,1);reject(new DOMException('Zrušeno','AbortError'));};
      signal?.addEventListener('abort',cancel,{once:true}); queue.push(item);
    });
  }
  function release() {const next=queue.shift();if(next)next.resolve();else active--;}
  async function get(url,maxBytes,kind,signal) {
    if(!allowedProcessedCeilingUrl(url,{kind})) throw new Error('Nepovolený zdroj ClearToFly');
    await acquire(signal);
    const controller=new AbortController();
    const cancel=()=>controller.abort();
    signal?.addEventListener('abort',cancel,{once:true});
    const timeout=setTimeout(()=>controller.abort(new DOMException('Vypršel čas zdroje','TimeoutError')),30000);
    let reader;
    try {
      abort(signal);
      const response=await fetchImpl(url,{mode:'cors',credentials:'omit',redirect:'error',cache:kind==='raster'?'force-cache':'no-cache',signal:controller.signal});
      if (!response.ok || response.type==='opaque' || (response.url && response.url!==url)) throw new Error(`Zdroj ClearToFly HTTP ${response.status}`);
      const type=response.headers.get('content-type')||'';
      if(kind==='raster'?!/^image\/(?:tiff|geotiff)/i.test(type):kind==='latest'?!/^application\/json/i.test(type):!/^text\/html/i.test(type)) throw new Error('Neočekávaný formát zdroje ClearToFly');
      const advertised=Number(response.headers.get('content-length'));
      if(advertised>maxBytes) throw new Error('Zdroj ClearToFly překročil limit');
      reader=response.body?.getReader();
      if(!reader) throw new Error('Prázdná odpověď ClearToFly');
      const chunks=[];let total=0;
      while(true) {
        abort(signal);
        const {done,value}=await reader.read();if(done)break;
        total+=value.byteLength;
        if(total>maxBytes) throw new Error('Zdroj ClearToFly překročil limit');
        chunks.push(value);
      }
      const bytes=new Uint8Array(total);let offset=0;
      for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
      return bytes;
    } catch(error) {await reader?.cancel().catch(()=>{});throw error;}
    finally {reader?.releaseLock();clearTimeout(timeout);signal?.removeEventListener('abort',cancel);release();}
  }
  async function discover(signal,forceRefresh=false) {
    if(!forceRefresh && catalogue && clock()-catalogueTime<10*60000) return catalogue;
    const latestBytes=await get(`${PROCESSED_CEILING_ORIGIN}/latest.json`,65536,'latest',signal);
    const latest=JSON.parse(new TextDecoder().decode(latestBytes));
    if(!latest || typeof latest.run_id!=='string' || !new RegExp(`^${RUN}$`).test(latest.run_id) || latest.viewers?.ceiling!==`viewers/ceiling-viewer-${latest.run_id}.html`) throw new Error('Neplatný katalog ClearToFly');
    const viewerUrl=`${PROCESSED_CEILING_ORIGIN}/${latest.viewers.ceiling}`;
    const html=new TextDecoder().decode(await get(viewerUrl,3*1024*1024,'viewer',signal));
    catalogue=parseProcessedCeilingCatalogue(latest,html,{now:clock()});catalogueTime=clock();
    return catalogue;
  }
  async function field(frame,signal) {
    if(cache.has(frame.sourceUrl)) {const found=cache.get(frame.sourceUrl);cache.delete(frame.sourceUrl);cache.set(frame.sourceUrl,found);return found;}
    const bytes=await get(frame.sourceUrl,8*1024*1024,'raster',signal);
    const raster=await decodeProcessedGeoTiff(bytes,{signal});
    const found={raster,retrievedAt:iso(clock())};cache.set(frame.sourceUrl,found);
    while(cache.size>8)cache.delete(cache.keys().next().value);
    return found;
  }
  const publicGrid=raster=>({...raster.grid,width:raster.width,height:raster.height,pixelHeight:-raster.grid.pixelHeight});
  return {
    async load({lat,lon,selectedTime,hours=6,forceRefresh=false,signal,onProgress}={}) {
      if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>=85.05112878||Math.abs(lon)>180||!Number.isInteger(hours)||hours<1||hours>24) throw new Error('Neplatný bod nebo rozsah ClearToFly');
      const selected=typeof selectedTime==='number'?selectedTime:instant(selectedTime,'výběru');
      if(!Number.isFinite(selected)||!Number.isFinite(new Date(selected).getTime())) throw new Error('Neplatný vybraný čas');
      abort(signal);onProgress?.('Načítám katalog zpracovaného ceilingu ClearToFly…');
      const cat=await discover(signal,forceRefresh), first=Date.parse(cat.frames[0].validAt),last=Date.parse(cat.frames.at(-1).validAt);
      const selectedFrame=selected>=first&&selected<=last?nearest(cat.frames,selected):null;
      const base={schemaVersion:1,source:'ClearToFly',product:'CEILING',units:'ft AGL',request:{lat,lon,selectedTime:iso(selected),hours},runId:cat.runId,publicationTime:cat.publicationTime,providerReferenceTime:cat.providerReferenceTime,providerReferenceNote:cat.providerReferenceNote,catalogueUrl:cat.catalogueUrl,processing:{...processing},providerLicence:'not-published',attribution,stale:clock()-Date.parse(cat.publicationTime)>12*HOUR};
      const empty={...base,status:'outside-horizon',selectedStatus:'unavailable',valueAglFt:null,model:null,runTime:null,validAt:null,retrievedAt:null,sourceUrl:null,cell:null,grid:null,distanceKm:null,series:{times:[],values:[],frames:[]},regional:null,errors:[]};
      if(!selectedFrame) return empty;
      const floor=Math.floor(selected/HOUR)*HOUR;
      const requested=Array.from({length:hours},(_,i)=>{const time=floor+i*HOUR;return {time,frame:time>=first&&time<=last?nearest(cat.frames,time):null};});
      const unique=new Map([[selectedFrame.sourceUrl,selectedFrame]]);
      for(const item of requested)if(item.frame)unique.set(item.frame.sourceUrl,item.frame);
      const fields=new Map();let completed=0;
      await Promise.all([...unique.values()].map(async frame=>{
        try {const found=await field(frame,signal);fields.set(frame.sourceUrl,{...frame,...found});}
        catch(error){if(signal?.aborted)throw error;fields.set(frame.sourceUrl,{...frame,error:errText(error)});}
        completed++;onProgress?.(`Zpracovaný ceiling ClearToFly: ${completed}/${unique.size} snímků`);
      }));
      abort(signal);
      const series={times:[],values:[],frames:[]},errors=[];
      for(const item of requested) {
        const found=item.frame?fields.get(item.frame.sourceUrl):null;
        const validAt=item.frame?.validAt||iso(item.time);
        const point=found?.raster?rasterCell(found.raster,lat,lon):null;
        const meta={validAt,model:found?.model||null,runTime:found?.runTime||null,runTimeSource:found?.runTimeSource||null,sourceUrl:found?.sourceUrl||null,retrievedAt:found?.retrievedAt||null,runId:cat.runId,units:'ft AGL',cell:point?{lat:point.lat,lon:point.lon,row:point.row,col:point.col,index:point.index}:null,grid:found?.raster?publicGrid(found.raster):null,distanceKm:point?.distanceKm??null};
        if(!found||found.error) {meta.error=found?.error||'Požadovaný čas není v katalogu';errors.push({validAt,error:meta.error,kind:found?'source-error':'missing-frame'});}
        else if(!point) {meta.error='Bod leží mimo zpracovaný rastr';errors.push({validAt,error:meta.error,kind:'outside-domain'});}
        series.times.push(validAt);series.values.push(point?.valueAglFt??null);series.frames.push(meta);
      }
      const chosen=fields.get(selectedFrame.sourceUrl),point=chosen?.raster?rasterCell(chosen.raster,lat,lon):null;
      if(chosen?.error&&!errors.some(e=>e.validAt===chosen.validAt))errors.push({validAt:chosen.validAt,error:chosen.error,kind:'source-error'});
      let regional=null;
      if(point) regional={...cropRaster(chosen.raster,lat,lon),source:'ClearToFly',units:'ft AGL',model:chosen.model,validAt:chosen.validAt,runTime:chosen.runTime,runTimeSource:chosen.runTimeSource,sourceUrl:chosen.sourceUrl,retrievedAt:chosen.retrievedAt,grid:publicGrid(chosen.raster)};
      const {distanceKm,...cell}=point||{};
      return {...base,status:chosen?.raster&&!point?'outside-domain':errors.length?'partial':'ok',selectedStatus:!point?'unavailable':point.valueAglFt===null?'missing':'ok',valueAglFt:point?.valueAglFt??null,model:chosen?.model||selectedFrame.model,runTime:chosen?.runTime||selectedFrame.runTime,runTimeSource:chosen?.runTimeSource||selectedFrame.runTimeSource,validAt:selectedFrame.validAt,retrievedAt:chosen?.retrievedAt||null,sourceUrl:selectedFrame.sourceUrl,cell:point?cell:null,grid:chosen?.raster?publicGrid(chosen.raster):null,distanceKm:point?distanceKm:null,series,regional,errors};
    }
  };
}
