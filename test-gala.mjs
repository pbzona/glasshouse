import assert from 'node:assert/strict';
import * as T from 'three';
import {createGala} from './src/gala.js';
import {platforms,BODY_HEIGHT} from './src/world.js';
import {STATIC_GUESTS} from './src/readability.js';

const FAR={x:16,y:0,z:14};
const state=(time,extra={})=>({time,phase:'prep',player:FAR,stolen:false,disruptions:0,paused:false,...extra});
const actor=(g,id)=>g.stats.snapshot.find(a=>a.id===id);
const pose=g=>{const p=[];g.root.traverse(o=>p.push([o.name,o.position.toArray(),o.rotation.toArray(),o.scale.toArray(),o.visible]));return p;};
const initialWorld=JSON.stringify(platforms);
const g=createGala(T),initial=pose(g),initialStats=JSON.stringify(g.stats);
assert.equal(g.stats.actors,6);
assert.equal(g.root.children.length,6);
assert(g.stats.triangles<15000);
assert(g.stats.drawCalls<=35);
assert(g.stats.bodyHeight>=BODY_HEIGHT);
assert.deepEqual(g.stats.routeCollisions,[]);
assert.equal(new Set(g.stats.positions.map(p=>`${p.x},${p.z}`)).size,6);
for(const p of g.stats.positions)assert(STATIC_GUESTS.some(([x,z])=>x===p.x&&z===p.z),'all actors replace existing crowd');
let meshCount=0,triangles=0;
g.root.traverse(o=>{
 if(!o.isMesh)return;
 meshCount++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;
 assert(!Array.isArray(o.material));assert(!o.material.map);assert(!o.userData.collider);
 for(const attribute of Object.values(o.geometry.attributes))assert([...attribute.array].every(Number.isFinite));
});
assert.equal(meshCount,g.stats.drawCalls);assert.equal(triangles,g.stats.triangles);

// Pure poses agree across framerates and dt values. No random walks or RNG.
const a=createGala(T),b=createGala(T);
for(let i=0;i<=180;i++)a.update(1/60,state(i/60));
b.update(999,state(3));assert.deepEqual(pose(a),pose(b));
for(const t of [5,7.13,11.5,19.8,42.1,117]){
 a.update(.001,state(t));b.update(100,state(t));assert.deepEqual(pose(a),pose(b));assert.deepEqual(a.stats.snapshot,b.stats.snapshot);
}

// Freeze transforms, visible glint, stats, cues and event edges during pause.
g.update(.1,state(7.15));const frozen=pose(g),frozenStats=JSON.stringify(g.stats);
for(const t of [8,50,100])assert(!g.update(40,state(t,{paused:true,stolen:true,disruptions:8})).cue);
assert.deepEqual(pose(g),frozen);assert.equal(JSON.stringify(g.stats),frozenStats);
g.update(.1,state(101));assert.deepEqual(pose(g),frozen,'resume does not jump if caller clock advanced');
g.update(.1,state(102));assert(Math.abs(g.stats.time-8.15)<1e-10);
g.reset();assert.deepEqual(pose(g),initial);assert.equal(JSON.stringify(g.stats),initialStats);
g.update(1,state(100,{paused:true}));g.update(1,state(101));assert.deepEqual(pose(g),initial,'first call may be paused');
g.reset();

// Dense full-cycle swept route sampling independently checks actual platform
// AABBs at body height, visual furniture, botanical planter and protected routes.
const remaining=STATIC_GUESTS.filter(([x,z])=>!g.stats.positions.some(p=>p.x===x&&p.z===z));
const tables=[[-5.5,5],[3.8,6.4],[-4,10],[10,5]];
let previous=null,dwellSamples=0,movingSamples=0;
for(let i=0;i<=1600;i++){
 const t=i*g.stats.routeDuration/1600;g.update(1/60,state(t));const p=actor(g,'server');
 for(const b of platforms){
  if(b.disabled||b.top<=.025||b.top-b.h>=g.stats.bodyHeight)continue;
  assert(!(Math.abs(p.x-b.x)<b.w/2+g.stats.clearance&&Math.abs(p.z-b.z)<b.d/2+g.stats.clearance),`server intersects ${b.id}`);
 }
 for(const [x,z] of tables)assert(Math.hypot(p.x-x,p.z-z)>.65+.35,'body clears table, tray intentionally above it');
 for(const [x,z] of remaining)assert(Math.hypot(p.x-x,p.z-z)>.85,'remaining static crowd clears circuit');
 assert(Math.hypot(p.x,p.z-2)>2.1+.8,'botanical planter clearance');
 assert(Math.hypot(p.x+9,p.z-9)>2.7,'curator interaction radius plus body and buffer clearance');
 assert(p.x>-10.8,'outside service stair and partition');assert(p.x<4.2,'outside public stairs');
 assert(Math.hypot(p.x-7,p.z-12)>5,'no exit obstruction');
 if(previous)assert(Math.hypot(p.x-previous.x,p.z-previous.z)<=g.stats.routeSpeed*g.stats.routeDuration/1600+1e-8);
 if(p.gesture==='serving')dwellSamples++;else movingSamples++;
 previous=p;
}
assert(dwellSamples>300&&movingSamples>500);assert(Math.hypot(previous.x+6,previous.z-6)<1e-8);
assert.equal(g.stats.route[0].dwell,3.8);assert.equal(g.stats.route[3].dwell,4.2);

// Theft reaction: nearby pair looks up, one hand rises, server holds position,
// then resumes circuit without teleport; distant civilians do not panic.
g.reset();g.update(.1,state(5));const before=actor(g,'server');
g.update(.1,state(5,{stolen:true,phase:'escape',player:{x:3,y:4.4,z:-7.9}}));
assert.equal(g.stats.theftCount,1);assert.equal(g.stats.mood,'subdued');
assert.equal(actor(g,'donor').gesture,'noticing-case');assert(actor(g,'donor').handRaised);
assert.equal(actor(g,'companion').gesture,'noticing-case');assert.equal(actor(g,'server').gesture,'tray-pause');
assert.notEqual(actor(g,'photographer').gesture,'noticing-case');
for(const t of [5.5,6,7.5]){
 g.update(.1,state(t,{stolen:true,phase:'escape'}));const p=actor(g,'server');assert.equal(p.x,before.x);assert.equal(p.z,before.z);
}
g.update(.1,state(7.7,{stolen:true,phase:'escape'}));assert(Math.hypot(actor(g,'server').x-before.x,actor(g,'server').z-before.z)<.1);
g.update(.1,state(12,{stolen:true,phase:'escape'}));assert.equal(g.stats.reactions,0);assert.equal(g.stats.theftCount,1);assert(!actor(g,'donor').handRaised);

// A disruption is local and floor-aware, not a room-wide awareness broadcast.
g.reset();g.update(.1,state(2,{disruptions:1,player:{x:-2,y:0,z:-5}}));
assert.equal(g.stats.reactions,2);assert.equal(actor(g,'donor').gesture,'brief-glance');assert.equal(actor(g,'companion').gesture,'brief-glance');
assert.notEqual(actor(g,'server').gesture,'brief-glance');
g.update(.1,state(4,{disruptions:1,player:{x:-2,y:0,z:-5}}));assert.equal(g.stats.reactions,0);
g.update(.1,state(5,{disruptions:2,player:{x:-2,y:4.4,z:-5}}));assert.equal(g.stats.reactions,0);
g.update(.1,state(6,{disruptions:3}));assert.equal(g.stats.reactions,0);

// Sparse cues are opt-in return values. Proximity includes vertical distance.
g.reset();let times=[];
for(let t=0;t<80;t+=.25){const out=g.update(.25,state(t,{player:{x:-2,y:0,z:-5}}));if(out.cue){times.push(t);assert.equal(out.cue.speaker,'GALA GUEST');}}
assert(times.length>=4);for(let i=1;i<times.length;i++)assert(times[i]-times[i-1]>=14);
g.reset();for(let t=0;t<60;t+=.5)assert(!g.update(.5,state(t)).cue);
g.reset();assert(!g.update(.1,state(30,{player:{x:-2,y:4.4,z:-5}})).cue);
g.reset();assert(!g.update(.1,state(30,{phase:'complete',player:{x:-2,y:0,z:-5}})).cue);
g.reset();const stolenCue=g.update(.1,state(10,{stolen:true,phase:'escape',player:{x:-2,y:0,z:-5}}));assert(stolenCue.cue.text.includes('case'));
assert(!g.update(.1,state(10,{stolen:true,phase:'escape',player:{x:-2,y:0,z:-5}})).cue);

// Lens glint is a tiny geometry accent, not a screen-space flash.
g.reset();g.update(.1,state(7.15));assert(actor(g,'photographer').glint);
g.update(.1,state(7.5));assert(!actor(g,'photographer').glint);

// Finite animation across long sessions, malformed times and input edge cases.
for(let i=0;i<240;i++){
 const t=i*13.7;g.update(i%2?NaN:Infinity,state(t,{stolen:i>120,disruptions:Math.floor(i/17),player:{x:Math.sin(i)*10,y:0,z:Math.cos(i)*10}}));
 g.root.traverse(o=>assert(o.matrixWorld.elements.every(Number.isFinite)));
}
for(const t of [NaN,Infinity,-100,0]){g.update(NaN,state(t));g.root.traverse(o=>assert(o.matrixWorld.elements.every(Number.isFinite)));}
g.reset();assert.deepEqual(pose(g),initial);assert.equal(JSON.stringify(platforms),initialWorld,'presentation never mutates physics');
console.log(`Gala tests passed: ${g.stats.actors} actors, ${g.stats.triangles} triangles, ${g.stats.drawCalls} max draws, ${g.stats.routeDuration.toFixed(2)}s circuit; deterministic/pause/reset/clearance/theft/locality/cues/finite animation.`);
