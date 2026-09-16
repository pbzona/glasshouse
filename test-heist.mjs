import assert from 'node:assert/strict';
import * as api from './src/heist.js';
const {createHeist,advanceHeist,survey,pulse,nearbyAction,interact,recover,hasLineOfSight,GUARD_SPECS}=api;
const relay={x:-11,y:0,z:9},roof={x:1,y:8.8,z:-11},prize={x:3,y:4.4,z:-7.9},front={x:7,y:0,z:12};
const far={x:100,y:0,z:100};
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name);}
function close(a,b,message){assert(Math.abs(a-b)<1e-7,message||`${a} != ${b}`);}
function prep(){const h=createHeist();survey(h);h.shield=0;return h;}
function isolated(){const h=prep();for(const g of h.guards.slice(1))g.disabledFor=100;return h;}
function hold(h,p,seconds){return interact(h,p,seconds,true);}
function events(h,type){return h.events.filter(e=>e.type===type);}

test('exact exports and pristine independent restart state',()=>{
 assert.deepEqual(Object.keys(api).sort(),['GUARD_SPECS','advanceHeist','createHeist','hasLineOfSight','interact','nearbyAction','pulse','recover','survey'].sort());
 const a=createHeist(),b=createHeist();assert.deepEqual(a,b);
 assert.equal(a.phase,'scout');assert.equal(a.approach,'gallery');assert.equal(a.exit,null);
 assert.equal(a.guards.length,4);assert.equal(a.guards[3].active,false);
 a.guards[0].x=99;a.events.push({type:'test'});a.anchor=true;
 assert.deepEqual(b,createHeist());assert.equal(GUARD_SPECS[0].points[0][0],14);
 assert(Object.isFrozen(GUARD_SPECS[0].points[0]));
});

test('scout blocks all nearby actions; survey is one-shot and shields',()=>{
 const h=createHeist();
 for(const p of [relay,roof,prize,front]){
  assert.match(nearbyAction(h,p).blocked,/planted terrace/);hold(h,p,10);
 }
 assert.equal(pulse(h,prize),false);assert.equal(h.stolen,false);assert.equal(h.relay,false);
 assert.equal(h.holdProgress,0);assert(survey(h));assert.equal(h.phase,'prep');assert.equal(h.shield,4);
 assert.equal(survey(h),false);assert.equal(events(h,'survey').length,1);
});

test('both optional jobs, roof approach, theft and roof completion without teleport',()=>{
 const h=prep();const p={...prize};
 assert.equal(hold(h,relay,1.5).id,'relay');assert.equal(h.relay,true);
 assert.equal(hold(h,roof,1.5).id,'anchor');assert.equal(h.anchor,true);
 assert.equal(nearbyAction(h,relay),null);assert.equal(nearbyAction(h,roof),null);
 h.approach='roof';assert.equal(hold(h,p,2.5).id,'prize');assert.deepEqual(p,prize);
 assert.equal(h.phase,'escape');assert.equal(h.guards[3].active,true);assert.equal(h.stolen,true);
 assert.equal(events(h,'theft')[0].approach,'roof');
 assert.equal(hold(h,roof,1).id,'exit-roof');assert.equal(h.phase,'complete');assert.equal(h.exit,'roof');
 assert.deepEqual(h.events.map(e=>e.type),['survey','relay','anchor','theft','complete']);
});

test('no-prep completion via repeatable Q and front exit; roof blocked',()=>{
 const h=prep();assert.match(nearbyAction(h,prize).blocked,/Press Q to jam case/);
 hold(h,prize,20);assert.equal(h.stolen,false);assert.equal(h.holdProgress,0);
 assert(pulse(h,prize));hold(h,prize,2.5);
 assert.equal(h.phase,'escape');assert.equal(h.approach,'gallery');assert.equal(h.relay,false);assert.equal(h.anchor,false);
 assert.match(nearbyAction(h,roof).blocked,/anchor/);hold(h,roof,2);assert.equal(h.phase,'escape');
 hold(h,front,1);assert.equal(h.phase,'complete');assert.equal(h.exit,'front');
});

test('each prep job is independently optional and front stays available',()=>{
 const relayOnly=prep();hold(relayOnly,relay,1.5);hold(relayOnly,prize,2.5);hold(relayOnly,front,1);
 assert.equal(relayOnly.phase,'complete');assert.equal(relayOnly.anchor,false);
 const anchorOnly=prep();hold(anchorOnly,roof,1.5);assert(nearbyAction(anchorOnly,prize).blocked);
 pulse(anchorOnly,prize);hold(anchorOnly,prize,2.5);hold(anchorOnly,roof,1);
 assert.equal(anchorOnly.phase,'complete');assert.equal(anchorOnly.relay,false);
});

test('Q cooldown, unlimited uses, horizontal and height radius, explicit visor timer',()=>{
 const h=prep(),p={x:0,y:4.4,z:0};
 Object.assign(h.guards[0],{x:6.5,z:0,y:6.4,suspicion:60});
 Object.assign(h.guards[1],{x:6.501,z:0,y:4.4,suspicion:60});
 Object.assign(h.guards[2],{x:0,z:0,y:6.401,suspicion:60});
 assert(pulse(h,p));assert.equal(h.jam,8);assert.equal(h.cooldown,16);
 assert.equal(h.guards[0].suspicion,0);assert.equal(h.guards[0].disabledFor,5);
 assert.equal(h.guards[1].suspicion,60);assert.equal(h.guards[1].disabledFor,0);
 assert.equal(h.guards[2].suspicion,60);assert.equal(h.guards[2].disabledFor,0);
 assert.equal(pulse(h,p),false);assert.equal(events(h,'pulse').length,1);
 advanceHeist(h,5,far,{pauseDetection:true});close(h.guards[0].disabledFor,0);close(h.jam,3);close(h.cooldown,11);
 advanceHeist(h,11,far);close(h.jam,0);close(h.cooldown,0);assert(pulse(h,p));
 h.phase='escape';advanceHeist(h,16,far);assert(pulse(h,p));
 assert.equal(events(h,'pulse').length,3);
});

test('held duration, release, range, height, action continuity and jam expiry resets',()=>{
 const h=prep();hold(h,relay,.75);close(h.holdProgress,.75);
 interact(h,relay,.1,false);assert.equal(h.holdProgress,0);assert.equal(h.holdId,null);
 hold(h,relay,1);hold(h,{...relay,x:relay.x+1.651},.5);assert.equal(h.holdProgress,0);
 hold(h,relay,1);hold(h,{...relay,y:.651},.5);assert.equal(h.holdProgress,0);
 assert(nearbyAction(h,{...relay,x:relay.x+1.65,y:.65}));
 hold(h,relay,1);hold(h,roof,.6);close(h.holdProgress,.6);assert.equal(h.holdId,'anchor');assert.equal(h.anchor,false);
 advanceHeist(h,.1,far);assert.equal(h.holdProgress,0);
 pulse(h,prize);hold(h,prize,2);h.jam=.1;advanceHeist(h,.2,prize,{pauseDetection:true});
 assert.equal(h.holdProgress,0);assert.equal(h.holdId,null);assert.equal(h.stolen,false);
 hold(h,prize,1);assert.equal(h.holdProgress,0);
 hold(h,relay,1.49);assert.equal(h.relay,false);hold(h,relay,.01);assert.equal(h.relay,true);
 hold(h,relay,2);assert.equal(events(h,'relay').length,1);
});

test('LOS solid segment slabs: blocked, clear, disabled, parallel, height and finite endpoints',()=>{
 const a={x:0,y:1,z:0},b={x:10,y:1,z:0};
 const wall={x:5,z:0,w:1,d:2,top:3,h:3};
 assert(hasLineOfSight(a,b,[]));assert.equal(hasLineOfSight(a,b,[wall]),false);
 assert(hasLineOfSight(a,b,[{...wall,disabled:true}]));
 assert(hasLineOfSight(a,b,[{...wall,z:3}]));assert(hasLineOfSight(a,b,[{...wall,top:.5,h:.5}]));
 assert(hasLineOfSight(a,b,[{...wall,x:11}]));assert(hasLineOfSight(a,b,[{...wall,x:-2}]));
 assert.equal(hasLineOfSight({x:5,y:1,z:-5},{x:5,y:1,z:5},[wall]),false);
 assert.equal(hasLineOfSight({x:5,y:1,z:0},b,[wall]),false);
 assert.equal(hasLineOfSight(a,b,[{...wall,z:1,d:2}]),false,'tangent touches solid boundary');
 assert(hasLineOfSight({x:0,y:4,z:0},{x:10,y:4,z:0},[wall]));
 assert.equal(hasLineOfSight({x:0,y:4,z:0},{x:10,y:0,z:0},[wall]),false);
});

test('authored patrol specs, speed, turns, looping and escape-only front activation',()=>{
 assert.deepEqual(GUARD_SPECS.map(g=>g.points),[[[14,-8],[14,7]],[[-8,-12],[7,-12]],[[1,-7],[5,-7],[5,-9],[1,-9]],[[-3,9],[7,9],[7,12]]]);
 const h=prep(),start={...h.guards[3]};advanceHeist(h,1,far);
 close(h.guards[0].z,-6.8);close(h.guards[0].x,14);assert.deepEqual(h.guards[3],start);
 advanceHeist(h,24,far);close(h.guards[0].z,-8);close(h.guards[0].x,14);
 h.phase='escape';advanceHeist(h,1,far);assert(h.guards[3].active);close(h.guards[3].x,-1.8);
});

test('patrol sees in cone, sees close behind, ignores distant rear and wrong height',()=>{
 let h=isolated();const p={x:14,y:4.4,z:-4};advanceHeist(h,.1,p);close(h.guards[0].suspicion,3.6);
 h=isolated();advanceHeist(h,.1,{x:14,y:4.4,z:-10});assert.equal(h.guards[0].suspicion,0);
 h=isolated();advanceHeist(h,.1,{x:14,y:4.4,z:-8.5});close(h.guards[0].suspicion,3.6);
 h=isolated();advanceHeist(h,.1,{...p,y:6.06});assert.equal(h.guards[0].suspicion,0);
 h=isolated();advanceHeist(h,.1,{...p,y:6.05});assert(h.guards[0].suspicion>0);
 h=isolated();advanceHeist(h,.1,{x:18,y:4.4,z:-7});assert.equal(h.guards[0].suspicion,0);
});

test('slow reduces sight radius and gain; unseen suspicion decays at 25 per second',()=>{
 let h=isolated();advanceHeist(h,.1,{x:14,y:4.4,z:-4},{slow:true});close(h.guards[0].suspicion,2.6);
 h=isolated();advanceHeist(h,.1,{x:14,y:4.4,z:-3},{slow:true});assert.equal(h.guards[0].suspicion,0);
 h=isolated();advanceHeist(h,.1,{x:14,y:4.4,z:-3});close(h.guards[0].suspicion,3.6);
 h.guards[0].suspicion=40;advanceHeist(h,1,far);close(h.guards[0].suspicion,15);
 advanceHeist(h,1,far);assert.equal(h.guards[0].suspicion,0);
});

test('guard LOS uses eye height; investigation turns gradually without leaving authored line',()=>{
 const wall={x:14,z:-6,w:2,d:.25,top:6,h:1};const p={x:14,y:4.4,z:-4};
 let h=isolated();advanceHeist(h,.1,p,{blocks:[wall]});assert.equal(h.guards[0].suspicion,0);
 h=isolated();advanceHeist(h,.1,p,{blocks:[{...wall,disabled:true}]});assert(h.guards[0].suspicion>0);
 h=isolated();advanceHeist(h,.1,p,{blocks:[{...wall,top:4.9,h:1}]});assert(h.guards[0].suspicion>0);
 h=isolated();advanceHeist(h,.1,{x:16,y:4.4,z:-4});
 assert(h.guards[0].heading>0);assert(h.guards[0].heading<=.18+1e-8);close(h.guards[0].x,14);close(h.guards[0].z,-7.88);
});

test('scout, shield, disabled visors and pauseDetection suppress detection, not patrols',()=>{
 const p={x:14,y:4.4,z:-4};
 const scout=createHeist();advanceHeist(scout,1,p);assert.equal(scout.guards[0].suspicion,0);close(scout.guards[0].z,-6.8);
 const shield=isolated();shield.shield=4;advanceHeist(shield,1,p);assert.equal(shield.guards[0].suspicion,0);close(shield.shield,3);
 const disabled=isolated();disabled.guards[0].disabledFor=5;advanceHeist(disabled,1,p);assert.equal(disabled.guards[0].suspicion,0);close(disabled.guards[0].z,-6.8);
 const paused=isolated();advanceHeist(paused,1,p,{pauseDetection:true});assert.equal(paused.guards[0].suspicion,0);close(paused.time,1);
});

test('capture emits once, clears every guard, shields and never mutates player',()=>{
 const h=isolated(),p=Object.freeze({x:14,y:4.4,z:-4});h.guards[0].suspicion=99.8;h.guards[1].suspicion=80;
 advanceHeist(h,1/60,p);assert.equal(h.catches,1);assert.equal(events(h,'caught').length,1);assert.equal(h.shield,4);
 assert(h.guards.every(g=>g.suspicion===0));
 advanceHeist(h,3.9,p);assert.equal(h.catches,1);assert.equal(events(h,'caught').length,1);assert(h.shield>0);
 assert.deepEqual(p,{x:14,y:4.4,z:-4});
});

test('recovery preserves phase, loot, jobs, approach and totals; resets transient guards and holds',()=>{
 const h=prep();hold(h,relay,1.5);hold(h,roof,1.5);h.approach='roof';hold(h,prize,2.5);
 pulse(h,prize);hold(h,front,.5);advanceHeist(h,2,front,{pauseDetection:true});hold(h,front,.2);h.catches=3;
 for(const g of h.guards){g.suspicion=70;g.disabledFor=3;g.heading=2;}
 const time=h.time,queue=h.events;recover(h);
 assert.equal(h.phase,'escape');assert(h.stolen&&h.relay&&h.anchor);assert.equal(h.approach,'roof');assert.equal(h.catches,3);assert.equal(h.time,time);
 assert.equal(h.resets,1);assert.equal(h.shield,4);assert.equal(h.cooldown,0);assert.equal(h.jam,0);assert.equal(h.holdProgress,0);assert.equal(h.holdId,null);
 h.guards.forEach((g,i)=>assert.deepEqual(g,{...createHeist().guards[i],active:true}));
 assert.equal(h.events,queue);assert.equal(events(h,'recovered').length,1);
 const clean=createHeist();assert.equal(clean.stolen,false);assert.equal(clean.resets,0);assert.equal(clean.catches,0);assert.deepEqual(clean.events,[]);
});

test('completed mission freezes all API updates and negative/nonfinite dt cannot rewind',()=>{
 const h=prep();pulse(h,prize);hold(h,prize,2.5);hold(h,front,1);const snapshot=structuredClone(h);
 advanceHeist(h,100,front);assert.equal(survey(h),false);assert.equal(pulse(h,front),false);
 assert.equal(interact(h,front,100,true),null);assert.equal(nearbyAction(h,front),null);recover(h);assert.deepEqual(h,snapshot);
 const fresh=prep(),before=structuredClone(fresh);advanceHeist(fresh,-1,far);advanceHeist(fresh,NaN,far);advanceHeist(fresh,Infinity,far);assert.deepEqual(fresh,before);
 hold(fresh,relay,-1);assert.equal(fresh.holdProgress,0);
});

console.log(`\n${passed} heist tests passed.`);
