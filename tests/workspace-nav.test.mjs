import test from 'node:test';
import assert from 'node:assert/strict';
import {activeChapter} from '../web/js/workspace-nav.js';
test('active chapter follows measured content as the sticky context changes height',()=>{
 const bounds=[{id:'forecast',top:-600},{id:'reports',top:180},{id:'imagery',top:800}];
 assert.equal(activeChapter(bounds,150),'forecast');
 assert.equal(activeChapter(bounds,240),'reports');
 assert.equal(activeChapter([{id:'forecast',top:-1600},{id:'reports',top:-800},{id:'imagery',top:100}],180),'imagery');
 assert.equal(activeChapter([{id:'forecast',top:400}],150),'forecast');
 assert.equal(activeChapter([],150),null);
 assert.equal(activeChapter([{id:'route',top:-800},{id:'output',top:400}],150,true),'output');
});
