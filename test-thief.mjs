import assert from 'node:assert/strict';
import * as T from 'three';
import {createThief} from './src/thief.js';

const thief = createThief(T), {root, stats} = thief;
const defaults = {speed:0, turnRate:0, grounded:true, vy:0, slow:false, mantleProgress:null, tetherProgress:null, interactionId:null, interactionProgress:0, loot:false, alert:0, won:false, paused:false};
const meshes = []; root.traverse(o => {if(o.isMesh) meshes.push(o);});
const tail = root.getObjectByName('tail.continuous'), {rings,sides} = tail.userData;
const positionBuffer = tail.geometry.attributes.position, indexBuffer = tail.geometry.index;
const indices = [...indexBuffer.array];
const checks = [];
function test(name, fn) { fn(); checks.push(name); console.log('PASS', name); }
function snapshot() {
  const result = [];
  root.traverse(o => result.push({name:o.name,p:o.position.toArray(),q:o.quaternion.toArray(),s:o.scale.toArray(),visible:o.visible}));
  return {rig:result,tail:[...positionBuffer.array]};
}
function rootSnapshot(){return [...root.position.toArray(),...root.quaternion.toArray(),...root.scale.toArray()];}
function finiteRig(){
  root.updateMatrixWorld(true);
  root.traverse(o=>{
    for(const n of [...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray(),...o.matrixWorld.elements]) assert.ok(Number.isFinite(n),`${o.name}: finite transform`);
    assert.ok(Math.abs(o.quaternion.length()-1)<1e-5,`${o.name}: normalized rotation`);
    if(o.isMesh) for(const [key,attr] of Object.entries(o.geometry.attributes)) for(const value of attr.array) assert.ok(Number.isFinite(value),`${o.name}: finite ${key}`);
  });
}
function exactBounds(){
  root.updateMatrixWorld(true);
  const bounds = new T.Box3(), v = new T.Vector3();
  root.traverseVisible(o=>{if(o.isMesh){const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);bounds.expandByPoint(v);}}});
  return bounds;
}
function advance(pose, frames=90){let event;for(let i=0;i<frames;i++)event=thief.update(1/60,{...defaults,...pose});return event;}
function ringCenter(r){const center=new T.Vector3();for(let j=0;j<sides;j++)center.add(new T.Vector3().fromBufferAttribute(positionBuffer,r*sides+j));return center.multiplyScalar(1/sides);}

test('explicit hierarchical rig, forward axis, batched matte geometry and budgets',()=>{
  assert.equal(root.name,'Sable');
  assert.equal(root.getObjectByName('spine').parent.name,'hip');
  assert.equal(root.getObjectByName('head').parent.name,'spine');
  for(const s of ['L','R']){
    assert.equal(root.getObjectByName('forearm.'+s).parent.name,'upperArm.'+s);
    assert.equal(root.getObjectByName('paw.'+s).parent.name,'forearm.'+s);
    assert.equal(root.getObjectByName('shin.'+s).parent.name,'thigh.'+s);
    assert.equal(root.getObjectByName('boot.'+s).parent.name,'shin.'+s);
  }
  const triangleCount=meshes.reduce((n,m)=>n+(m.geometry.index?.count||m.geometry.attributes.position.count)/3,0);
  assert.equal(stats.triangles,triangleCount);assert.equal(stats.drawCalls,meshes.length);
  assert.ok(triangleCount<12000,`triangles ${triangleCount}`);assert.ok(meshes.length<=35,`draws ${meshes.length}`);
  assert.equal(new Set(meshes.map(m=>m.material)).size,1);
  for(const mesh of meshes){assert.equal(mesh.castShadow,false);assert.equal(mesh.receiveShadow,false);assert.equal(mesh.material.map,null);assert.ok(mesh.material.isMeshLambertMaterial);assert.ok(mesh.geometry.attributes.color);assert.equal(mesh.geometry.groups.length,0);}
  finiteRig();
  const b=exactBounds();
  assert.ok(Math.abs(b.min.y)<.002,`feet ${b.min.y}`);
  assert.ok(b.max.y>=1.55&&b.max.y<=1.65,`height ${b.max.y}`);
  assert.ok(b.max.x-b.min.x<.80,'slender silhouette');
  assert.ok(b.min.z<-.85,'long trailing tail');
  const h=root.getObjectByName('head.batch'), hb=new T.Box3().setFromObject(h);
  assert.ok(hb.max.z>.29,'muzzle points +Z');
});

test('tail is one closed connected manifold with monotonically tapered sections',()=>{
  assert.equal(positionBuffer.count,rings*sides+2);
  assert.equal(indexBuffer.count/3,(rings-1)*sides*2+sides*2);
  const edges=new Map(),adj=Array.from({length:positionBuffer.count},()=>new Set());
  for(let i=0;i<indices.length;i+=3){const a=indices[i],b=indices[i+1],c=indices[i+2];assert.equal(new Set([a,b,c]).size,3);for(const [x,y]of[[a,b],[b,c],[c,a]]){const key=x<y?`${x}:${y}`:`${y}:${x}`;edges.set(key,(edges.get(key)||0)+1);adj[x].add(y);adj[y].add(x);}}
  for(const count of edges.values())assert.equal(count,2,'every edge belongs to exactly two triangles');
  const seen=new Set([0]),queue=[0];while(queue.length){for(const n of adj[queue.pop()])if(!seen.has(n)){seen.add(n);queue.push(n);}}
  assert.equal(seen.size,positionBuffer.count,'one connected component, not a chain of separate blobs');
  assert.equal(positionBuffer.count-edges.size+indices.length/3,2,'closed sphere topology');
  let previousRadius=Infinity,previousCenter=null;
  for(let r=0;r<rings;r++){
    const center=ringCenter(r),radii=Array.from({length:sides},(_,j)=>new T.Vector3().fromBufferAttribute(positionBuffer,r*sides+j).distanceTo(center));
    const radius=radii.reduce((a,b)=>a+b,0)/sides;
    assert.ok(radius<previousRadius);assert.ok(Math.max(...radii)-Math.min(...radii)<1e-6);
    if(previousCenter){assert.ok(center.z<previousCenter.z);assert.ok(center.distanceTo(previousCenter)<.07);}
    previousRadius=radius;previousCenter=center;
  }
  assert.ok(previousRadius<.009,'fine tapered tip');
});

test('all poses, action progress endpoints, finite geometry, and visual-only root ownership',()=>{
  const scenarios=[
    {name:'idle',p:{}}, {name:'walk',p:{speed:2}}, {name:'run',p:{speed:5.8,turnRate:2}},
    {name:'sneak',p:{speed:1.1,slow:true}}, {name:'airborne',p:{grounded:false,vy:6}},
    {name:'airborne',p:{grounded:false,vy:-7}}, {name:'carry',p:{loot:true}},
    {name:'escape',p:{won:true,loot:true}}, {name:'idle',p:{alert:100}}
  ];
  for(const progress of [0,.01,.25,.5,.8,1])for(const mode of ['mantleProgress','tetherProgress'])scenarios.push({name:mode==='mantleProgress'?'mantle':'tether',p:{[mode]:progress,grounded:false}});
  for(const id of ['relay','anchor','prize','exit-front','exit-roof'])for(const progress of [0,.01,.25,.5,.82,1])scenarios.push({name:progress===0?'idle':id==='relay'?'pickpocket':id==='prize'?'stash':'interact',p:{interactionId:id,interactionProgress:progress}});
  let lo=Infinity,hi=-Infinity,maxWidth=0;
  for(const {name,p}of scenarios){
    thief.reset();const event=advance(p);assert.equal(event.state,name,JSON.stringify(p));finiteRig();
    const b=exactBounds();lo=Math.min(lo,b.min.y);hi=Math.max(hi,b.max.y);maxWidth=Math.max(maxWidth,b.max.x-b.min.x);
    assert.ok(b.min.y>-.08&&b.max.y<2.3,`${name} vertical bounds ${b.min.y}..${b.max.y}`);
    assert.ok(b.min.z>-1.5&&b.max.z<1,`${name} depth bounds`);
    assert.ok(b.max.x-b.min.x<1.15,`${name} width bounds`);
    root.position.set(7.25,4.4,-8.75);root.rotation.set(.08,1.8,-.03);root.scale.set(1.1,.9,1.05);
    const external=rootSnapshot();advance(p,2);assert.deepEqual(rootSnapshot(),external);thief.reset();assert.deepEqual(rootSnapshot(),external);
    root.position.set(0,0,0);root.rotation.set(0,0,0);root.scale.set(1,1,1);
  }
  console.log('  pose bounds:',JSON.stringify({minY:lo,maxY:hi,maxWidth}));
});

test('pause freezes every joint, visibility and dynamic vertex; reset is exactly deterministic',()=>{
  thief.reset();const start=snapshot();advance({speed:5,loot:true,alert:80},37);
  const before=snapshot();for(let i=0;i<50;i++){const e=thief.update(.1,{speed:1,grounded:false,paused:true,interactionId:'prize',interactionProgress:.5});assert.equal(e.footstep,false);assert.equal(e.landed,false);}
  assert.deepEqual(snapshot(),before);thief.reset();assert.deepEqual(snapshot(),start);
  const sequence=()=>{advance({speed:3.1},31);advance({speed:1.2,slow:true},17);advance({grounded:false,vy:-3},12);advance({loot:true},14);return snapshot();};
  const first=sequence();thief.reset();assert.deepEqual(sequence(),first);thief.reset();
});

test('walk / sneak / reach / loot / escape have distinct readable poses without control locking',()=>{
  thief.reset();advance({speed:2});const walkHip=root.getObjectByName('hip').position.y;
  advance({speed:1,slow:true});assert.ok(root.getObjectByName('hip').position.y<walkHip-.10,'low quiet sneak');
  advance({tetherProgress:.4,grounded:false});
  const paw=root.getObjectByName('paw.R'),p=new T.Vector3();paw.getWorldPosition(p);assert.ok(p.y>1.4,'overhead tether grip');
  advance({interactionId:'prize',interactionProgress:.5});assert.equal(root.getObjectByName('lootParcel').visible,true);
  advance({interactionId:'prize',interactionProgress:1,loot:true});assert.equal(root.getObjectByName('lootParcel').visible,false);assert.equal(root.getObjectByName('storedLoot').visible,true);
  advance({loot:true});paw.getWorldPosition(p);const bag=root.getObjectByName('satchel');const bagPosition=bag.getWorldPosition(new T.Vector3());assert.ok(p.distanceTo(bagPosition)<.25,'protective hand stays near satchel');
  advance({won:true,loot:true},32);const salute=root.getObjectByName('paw.L').getWorldPosition(new T.Vector3()).y;
  advance({won:true,loot:true},120);const settled=root.getObjectByName('paw.L').getWorldPosition(new T.Vector3()).y;assert.ok(salute>settled+.15,'escape acknowledgement settles instead of looping');
  assert.equal(advance({speed:5,interactionId:null,won:false},2).state,'run','pose switch never input locks');
});

test('landing and footstep events are single-frame, pause-safe, and recover after takeoff',()=>{
  thief.reset();advance({grounded:false,vy:-4},12);let e=thief.update(1/60,defaults);assert.equal(e.landed,true);assert.equal(e.state,'landing');
  assert.equal(thief.update(1/60,defaults).landed,false);advance({},60);assert.equal(thief.update(1/60,defaults).state,'idle');
  thief.reset();let steps=0;for(let i=0;i<180;i++)steps+=Number(thief.update(1/60,{speed:4}).footstep);assert.ok(steps>=9&&steps<22,`footstep count ${steps}`);
  assert.equal(thief.update(1/60,{speed:5,grounded:false}).footstep,false);
});

test('dynamic tail has stable topology and bounded smooth motion over phase wraps and state transitions',()=>{
  thief.reset();let prev=[...positionBuffer.array],maxChange=0;
  for(let i=0;i<900;i++){
    const p=i<300?{speed:6,turnRate:3}:i<600?{speed:1,slow:true,turnRate:-3}:{grounded:false,vy:-3,tetherProgress:(i-600)/300};
    thief.update(1/60,p);assert.equal(tail.geometry.attributes.position,positionBuffer);assert.equal(tail.geometry.index,indexBuffer);
    const arr=positionBuffer.array;for(let n=0;n<arr.length;n++)maxChange=Math.max(maxChange,Math.abs(arr[n]-prev[n]));prev=[...arr];
    for(let r=0;r<rings-1;r++)assert.ok(ringCenter(r).distanceTo(ringCenter(r+1))<.075);
  }
  assert.deepEqual([...indexBuffer.array],indices);assert.ok(maxChange<.025,`maximum vertex change/frame ${maxChange}`);
  console.log('  tail max local vertex delta / 60 Hz frame:',maxChange.toFixed(6));
});

test('extreme inputs and dt clamping remain finite; separate instances share no mutable rig state',()=>{
  for(const dt of [0,-1,NaN,Infinity,.0001,1000])thief.update(dt,{speed:Infinity,turnRate:NaN,vy:-Infinity,alert:NaN,grounded:false});finiteRig();
  const other=createThief(T),secondTail=other.root.getObjectByName('tail.continuous');const before=[...secondTail.geometry.attributes.position.array];
  thief.update(.1,{speed:5,slow:true});assert.deepEqual([...secondTail.geometry.attributes.position.array],before);assert.notEqual(secondTail.geometry,tail.geometry);
});
console.log(`\n${checks.length} Sable rig tests passed. Stats: ${JSON.stringify(stats)}`);
