import {createProcessedCeilingSource} from './processed-ceiling-source.js';

const source=createProcessedCeilingSource();
const requests=new Map();
self.onmessage=async ({data})=>{
  if(data?.type==='cancel') {requests.get(data.id)?.abort();return;}
  if(!Number.isSafeInteger(data?.id)||!data.params||requests.has(data.id)) return;
  const controller=new AbortController();requests.set(data.id,controller);
  try {
    const result=await source.load({...data.params,signal:controller.signal,onProgress:progress=>self.postMessage({id:data.id,progress})});
    if(!controller.signal.aborted)self.postMessage({id:data.id,result});
  } catch(error) {if(!controller.signal.aborted)self.postMessage({id:data.id,error:String(error?.message||error).slice(0,220)});}
  finally {requests.delete(data.id);}
};
