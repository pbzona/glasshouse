import assert from 'node:assert/strict';
import {guardVision,createVisionBuffers,updateVisionBuffers} from './src/visibility.js';
import {hasLineOfSight} from './src/heist.js';
import {platforms,securityGate} from './src/world.js';
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name);}
function near(a,b,epsilon=1e-6){assert(Math.abs(a-b)<=epsilon,`${a} != ${b}`);}
const mission=(extra={})=>({phase:'prep',alarm:false,shield:0,jam:0,...extra});
const guard=(extra={})=>({id:'east',x:0,y:0,z:0,heading:0,active:true,reactingFor:0,disabledFor:0,...extra});
const block=(extra={})=>({x:0,z:3,w:12,d:.4,top:3,h:3,disabled:false,...extra});
const radius=(positions,vertex)=>Math.hypot(positions[vertex*3],positions[vertex*3+2]);
function render(h=mission(),g=guard(),blocks=[],options={},buffers=createVisionBuffers()){
 return updateVisionBuffers(buffers,h,g,blocks,options);
}
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
function worldVertex(positions,index,g){
 const x=positions[index*3],z=positions[index*3+2],sin=Math.sin(g.heading),cos=Math.cos(g.heading);
 return {x:g.x+x*cos+z*sin,y:g.y+.9,z:g.z+z*cos-x*sin};
}

test('nominal parameters, fan sizes, Uint16 indices and upward winding',()=>{
 assert.deepEqual(guardVision(mission(),guard()),{range:6,halfAngle:.65,closeRadius:1.1,enabled:true,reason:'normal'});
 const b=render();
 assert(b.conePositions instanceof Float32Array);assert(b.closePositions instanceof Float32Array);
 assert(b.coneIndices instanceof Uint16Array);assert(b.closeIndices instanceof Uint16Array);
 assert.equal(b.conePositions.length,26*3);assert.equal(b.closePositions.length,34*3);
 assert.equal(b.coneIndices.length,24*3);assert.equal(b.closeIndices.length,32*3);
 for(const [p,indices,n] of [[b.conePositions,b.coneIndices,24],[b.closePositions,b.closeIndices,32]]){
  assert.deepEqual([...p.slice(0,3)],[0,0,0]);
  for(let i=0;i<n;i++){
   assert.deepEqual([...indices.slice(i*3,i*3+3)],[0,i+1,i+2]);
   const a=(i+1)*3,c=(i+2)*3;
   assert(p[a+2]*p[c]-p[a]*p[c+2]>0,'fan must face +Y');
  }
  for(let i=1;i<p.length;i+=3)assert.equal(p[i],0);
 }
});

test('cone endpoints and center use actual range and local angles',()=>{
 const b=render();
 for(let i=0;i<=24;i++){
  const angle=-.65+1.3*i/24;
  near(b.conePositions[(i+1)*3],Math.sin(angle)*6);
  near(b.conePositions[(i+1)*3+2],Math.cos(angle)*6);
  near(radius(b.conePositions,i+1),6);
 }
 near(b.conePositions[13*3],0);near(b.conePositions[13*3+2],6);
});

test('translation and heading remain local, transform matches Three rotation.y',()=>{
 const g=guard({x:8,y:4.4,z:-7,heading:Math.PI/2}),b=render(mission(),g),base=render();
 assert.deepEqual(b.conePositions,base.conePositions);assert.deepEqual(b.closePositions,base.closePositions);
 const forward=worldVertex(b.conePositions,13,g);
 near(forward.x,14);near(forward.z,-7);near(forward.y,5.3);
});

test('360-degree close zone includes rear and has exactly closed seam',()=>{
 const b=render();
 for(let i=1;i<=33;i++)near(radius(b.closePositions,i),1.1);
 near(b.closePositions[17*3+2],-1.1);
 near(b.closePositions[9*3],1.1);near(b.closePositions[25*3],-1.1);
 assert.deepEqual(b.closePositions.slice(3,6),b.closePositions.slice(-3));
});

test('normal, slow, reaction alert, case alarm, and non-case alarm ranges',()=>{
 for(const [h,g,options,range,reason] of [
  [mission(),guard(),{},6,'normal'],[mission(),guard(),{slow:true},4.2,'slow'],
  [mission(),guard({reactingFor:1}),{slow:true},7,'alert'],
  [mission({alarm:true}),guard({id:'case'}),{slow:true},7,'alert'],
  [mission({alarm:true}),guard(),{slow:true},4.2,'slow'],
  [mission({jam:8}),guard(),{},6,'normal']
 ]){
  const b=render(h,g,[],options);assert.equal(b.vision.range,range);assert.equal(b.vision.reason,reason);
  near(radius(b.conePositions,13),range);near(radius(b.closePositions,17),1.1);
 }
});

test('inactive/scout/complete/immunity/jammed/suppressed disable and clear stale fans',()=>{
 const b=render();
 for(const [h,g,options,reason] of [
  [mission(),guard({active:false}),{},'inactive'],[mission({phase:'scout'}),guard(),{},'scout'],
  [mission({phase:'complete'}),guard(),{},'complete'],[mission({shield:4}),guard(),{},'immunity'],
  [mission(),guard({disabledFor:.001}),{},'jammed'],[mission(),guard(),{suppressed:true},'suppressed']
 ]){
  render(mission(),guard(),[],{},b);
  const result=render(h,g,[],options,b);
  assert.equal(result.vision.enabled,false);assert.equal(result.vision.reason,reason);
  assert(result.conePositions.every(n=>n===0));assert(result.closePositions.every(n=>n===0));
 }
 render(mission(),guard(),[],{},b);assert.equal(b.vision.enabled,true);near(radius(b.conePositions,13),6);
});

test('tall cover clips conservatively within one refined sample of its front',()=>{
 const g=guard(),blocks=[block()],b=render(mission(),g,blocks);
 const r=radius(b.conePositions,13);
 assert(r<=2.8);assert(r>=2.8-.3/16-1e-6);
 for(let i=1;i<=25;i++){
  assert(hasLineOfSight({x:g.x,y:g.y+1.1,z:g.z},worldVertex(b.conePositions,i,g),blocks));
 }
});

test('world clipping rotates with guard heading without double-rotating buffers',()=>{
 const g=guard({x:5,z:-2,heading:Math.PI/2}),blocks=[block({x:8,z:-2,w:.4,d:12})];
 const b=render(mission(),g,blocks);
 near(b.conePositions[13*3],0);
 assert(radius(b.conePositions,13)<=2.8);assert(radius(b.conePositions,13)>2.78);
 const p=worldVertex(b.conePositions,13,g);assert(p.x<7.8);near(p.z,-2);
});

test('rear close radius clips independently of the forward cone',()=>{
 const b=render(mission(),guard(),[block({z:-.7,d:.2})]);
 const rear=radius(b.closePositions,17);
 assert(rear<=.6);assert(rear>.6-.3/16);near(radius(b.conePositions,13),6);
});

test('authored disabled security gate does not occlude',()=>{
 const g=guard({x:3,y:4.4,z:-12}),enabled={...securityGate,disabled:false};
 const closed=render(mission(),g,[enabled]);assert(radius(closed.conePositions,13)<1.43);
 const open=render(mission(),g,[{...enabled,disabled:true}]);near(radius(open.conePositions,13),6);
});

test('same-floor slice does not falsely occlude at overhead or supporting platforms',()=>{
 const overhead=platforms.find(b=>b.id==='exhibition'),g=guard({x:4,z:-11});
 const below=render(mission(),g,[overhead]);near(radius(below.conePositions,13),6);
 const above=render(mission(),{...g,y:4.4},[overhead]);near(radius(above.conePositions,13),6);
 const low=render(mission(),guard({y:4.4}),[block({top:3,h:3})]);near(radius(low.conePositions,13),6);
 const elevated=render(mission(),guard({y:4.4}),[block({top:6.7,h:2.3})]);
 assert(radius(elevated.conePositions,13)<2.8);
});

test('eye-height broad phase retains low cover touching the target .9 height',()=>{
 const g=guard(),blocks=[block({z:1.5,d:.2,top:.95,h:.95})],b=render(mission(),g,blocks);
 assert(radius(b.conePositions,13)<1.41);
 assert(hasLineOfSight({x:0,y:1.1,z:0},{x:0,y:1.1,z:1.5},blocks),'flat eye-to-eye ray would miss this cover');
 assert(!hasLineOfSight({x:0,y:1.1,z:0},{x:0,y:.9,z:1.5},blocks));
});

test('first sampled occlusion stops ray even when its far endpoint is clear',()=>{
 const blocks=[block({z:.3,d:.05,top:1.06,h:.06})],g=guard();
 assert(!hasLineOfSight({x:0,y:1.1,z:0},{x:0,y:.9,z:.6},blocks));
 assert(hasLineOfSight({x:0,y:1.1,z:0},{x:0,y:.9,z:6},blocks));
 const b=render(mission(),g,blocks);assert(radius(b.conePositions,13)<=.6);
});

test('irrelevant distant or elevated blockers leave fans unchanged',()=>{
 const blocks=[block({x:100}),block({z:100}),block({top:10,h:.2}),block({top:.8,h:1}),block({disabled:true})];
 const expected=render(),actual=render(mission(),guard(),blocks);
 assert.deepEqual(actual.conePositions,expected.conePositions);assert.deepEqual(actual.closePositions,expected.closePositions);
});

test('arrays, metadata and returned buffer identity survive repeated updates',()=>{
 const b=createVisionBuffers(),keys=['conePositions','closePositions','coneIndices','closeIndices','vision'];
 const refs=keys.map(k=>b[k]),indices=[b.coneIndices.slice(),b.closeIndices.slice()];
 for(const options of [{},{slow:true},{suppressed:true},{}]){
  assert.equal(render(mission(),guard(),[block()],options,b),b);
  keys.forEach((k,i)=>assert.equal(b[k],refs[i]));
 }
 assert.deepEqual(b.coneIndices,indices[0]);assert.deepEqual(b.closeIndices,indices[1]);
});

test('inputs including blocks and options stay immutable',()=>{
 const h=freeze(mission({alarm:true})),g=freeze(guard({id:'case',heading:.7,y:4.4}));
 const blocks=freeze([block({top:6.7,h:2.3}),{...securityGate,disabled:true}]);
 const options=freeze({slow:true}),before=JSON.stringify({h,g,blocks,options});
 guardVision(h,g,options);render(h,g,blocks,options);
 assert.equal(JSON.stringify({h,g,blocks,options}),before);
});

test('custom fan subdivisions and index limits are validated',()=>{
 const b=render(mission(),guard(),[],{},createVisionBuffers(8,12));
 assert.equal(b.conePositions.length,30);assert.equal(b.closePositions.length,42);
 near(radius(b.conePositions,5),6);near(radius(b.closePositions,7),1.1);
 for(const n of [0,-1,1.5,NaN,Infinity,65535])assert.throws(()=>createVisionBuffers(n),RangeError);
 for(const n of [0,1,2,2.5,65535])assert.throws(()=>createVisionBuffers(24,n),RangeError);
 const maximum=createVisionBuffers(65534,3);assert.equal(maximum.coneIndices.at(-1),65535);
 assert.throws(()=>updateVisionBuffers({},mission(),guard(),[]),TypeError);
});
console.log(`\n${passed} visibility tests passed.`);
