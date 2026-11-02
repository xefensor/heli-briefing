import test from 'node:test';
import assert from 'node:assert/strict';
import { createNativeCeilingClient } from '../web/js/native-ceiling-client.js';

class WorkerStub {
  static instances = [];
  messages = [];
  constructor(url, options) { this.url = url; this.options = options; WorkerStub.instances.push(this); }
  postMessage(data) { this.messages.push(data); }
  terminate() { this.stopped = true; }
  emit(data) { this.onmessage({data}); }
}

test('native worker client delivers progress/result and reuses its isolated worker cache', async () => {
  const client = createNativeCeilingClient({WorkerClass:WorkerStub});
  const stages = [], first = client.request({lat:49}, {onProgress:x=>stages.push(x)});
  const worker = WorkerStub.instances.at(-1), id = worker.messages.at(-1).id;
  assert.equal(worker.options.type,'module');
  worker.emit({id,progress:'2 / 9'}); worker.emit({id,result:{valueMsl:0}});
  assert.deepEqual(await first,{valueMsl:0}); assert.deepEqual(stages,['2 / 9']);
  const next = client.request({lat:50}), nextId = worker.messages.at(-1).id;
  worker.emit({id,result:{valueMsl:9999}}); worker.emit({id:nextId,result:{valueMsl:1200}});
  assert.equal((await next).valueMsl,1200); client.stop(); assert.equal(worker.stopped,true);
});

test('aborting a native request cancels work and late results cannot resolve a later selection', async () => {
  const client = createNativeCeilingClient({WorkerClass:WorkerStub});
  const controller = new AbortController(), first = client.request({}, {signal:controller.signal});
  const worker = WorkerStub.instances.at(-1), id = worker.messages.at(-1).id;
  controller.abort(); await assert.rejects(first,{name:'AbortError'});
  assert.deepEqual(worker.messages.at(-1),{type:'cancel',id});
  const next = client.request({}), nextId = worker.messages.at(-1).id;
  worker.emit({id,result:{valueMsl:4}}); worker.emit({id:nextId,error:'grid mismatch'});
  await assert.rejects(next,/grid mismatch/); client.stop();
});

test('worker failure releases pending work and permits a clean retry', async () => {
  const client = createNativeCeilingClient({WorkerClass:WorkerStub});
  const first = client.request({}), old = WorkerStub.instances.at(-1);
  old.onerror(); await assert.rejects(first,/selhal/); assert.equal(old.stopped,true);
  const next = client.request({}), current = WorkerStub.instances.at(-1);
  assert.notEqual(current,old); current.emit({id:current.messages[0].id,result:{ok:true}});
  assert.equal((await next).ok,true); client.stop();
});

test('deadline cancels stalled native work and unavailable worker support is explicit', async () => {
  const client = createNativeCeilingClient({WorkerClass:WorkerStub,timeoutMs:1});
  await assert.rejects(client.request({}),/časový limit/);
  assert.equal(WorkerStub.instances.at(-1).messages.at(-1).type,'cancel'); client.stop();
  await assert.rejects(createNativeCeilingClient({WorkerClass:null}).request({}),/nepodporuje/);
});

// Independent AGL processing uses the same cancellation protocol and its own worker/cache.
test('an explicitly selected second worker keeps processed AGL separate from native MSL', async () => {
  const url = new URL('../web/js/processed-ceiling-worker.js', import.meta.url);
  const client = createNativeCeilingClient({WorkerClass:WorkerStub,workerUrl:url});
  const result = client.request({lat:49,selectedTime:'2026-11-02T12:00:00Z'});
  const worker = WorkerStub.instances.at(-1);
  assert.equal(worker.url,url);
  worker.emit({id:worker.messages[0].id,result:{valueAglFt:0,units:'ft AGL'}});
  assert.deepEqual(await result,{valueAglFt:0,units:'ft AGL'});
  client.stop();
});
