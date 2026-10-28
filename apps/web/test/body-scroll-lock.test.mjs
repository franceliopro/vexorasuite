import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {acquireBodyScrollLock} from '../src/lib/body-scroll-lock.ts';

test('fullscreen and dialog may close in either order without stranding page scrolling',()=>{
 for(const fullscreenFirst of [true,false]){
  const dom=new JSDOM('<body></body>'),doc=dom.window.document;
  const fullscreen=acquireBodyScrollLock(doc),dialog=acquireBodyScrollLock(doc);
  assert.equal(doc.body.style.overflow,'hidden');
  (fullscreenFirst?fullscreen:dialog)();
  assert.equal(doc.body.style.overflow,'hidden','the remaining overlay keeps its lock');
  (fullscreenFirst?dialog:fullscreen)();
  assert.equal(doc.body.style.overflow,'');
  dom.window.close();
 }
});
test('repeated cleanup does not unlock another overlay',()=>{
 const dom=new JSDOM('<body></body>'),doc=dom.window.document;
 const a=acquireBodyScrollLock(doc),b=acquireBodyScrollLock(doc);
 a();a();assert.equal(doc.body.style.overflow,'hidden');
 b();assert.equal(doc.body.style.overflow,'');dom.window.close();
});
test('restores preexisting overflow and its priority',()=>{
 const dom=new JSDOM('<body></body>'),doc=dom.window.document;
 doc.body.style.setProperty('overflow','auto','important');
 const release=acquireBodyScrollLock(doc);release();
 assert.equal(doc.body.style.overflow,'auto');
 assert.equal(doc.body.style.getPropertyPriority('overflow'),'important');
 dom.window.close();
});
