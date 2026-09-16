import assert from 'node:assert/strict';
import * as api from './src/heist.js';
const {createHeist,advanceHeist,survey,pulse,nearbyAction,interact,recover,hasLineOfSight,GUARD_SPECS,ESCAPE_GUARD_SPECS,getCurator}=api;
const relay={x:-10,y:0,z:9},roof={x:1,y:8.8,z:-11},prize={x:3,y:4.4,z:-7.9},front={x:7,y:0,z:12};
const far={x:100,y:0,z:100};
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name);}
function close(a,b,message){assert(Math.abs(a-b)<1e-7,message||`${a} != ${b}`);}
function prep(){const h=createHeist();survey(h);h.shield=0;return h;}
function isolated(){const h=prep();for(const g of h.guards.slice(1))g.disabledFor=100;return h;}
function hold(h,p,seconds){return interact(h,p,seconds,true);}
function events(h,type){return h.events.filter(e=>e.type===type);}

test('exact exports and pristine independent restart state',()=>{
 assert.deepEqual(Object.keys(api).sort(),['GUARD_SPECS','ESCAPE_GUARD_SPECS','getCurator','advanceHeist','createHeist','hasLineOfSight','interact','nearbyAction','pulse','recover','survey'].sort());
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
 const h=prep();assert.match(nearbyAction(h,prize).blocked,/press Q to jam case/);
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
 assert.equal(h.guards[0].suspicion,60);assert.equal(h.guards[0].disabledFor,1.8);
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
 hold(h,relay,1);hold(h,{...relay,x:-10.651},.5);assert.equal(h.holdProgress,0);
 hold(h,relay,1);hold(h,{...relay,y:.651},.5);assert.equal(h.holdProgress,0);
 assert(nearbyAction(h,{...relay,x:-10.65,y:.65}));
 hold(h,relay,1);hold(h,roof,.6);close(h.holdProgress,.6);assert.equal(h.holdId,'anchor');assert.equal(h.anchor,false);
 advanceHeist(h,.1,far);assert.equal(h.holdProgress,0);
 pulse(h,prize);hold(h,prize,2);h.jam=.1;advanceHeist(h,.2,prize,{pauseDetection:true});
 assert.equal(h.holdProgress,0);assert.equal(h.holdId,null);assert.equal(h.stolen,false);
 hold(h,prize,1);assert.equal(h.holdProgress,0);
 hold(h,relay,1.19);assert.equal(h.relay,false);hold(h,relay,.01);assert.equal(h.relay,true);
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

test('scout, shield and pause suppress detection; visor blackout also stops patrols',()=>{
 const p={x:14,y:4.4,z:-4};
 const scout=createHeist();advanceHeist(scout,1,p);assert.equal(scout.guards[0].suspicion,0);close(scout.guards[0].z,-6.8);
 const shield=isolated();shield.shield=4;advanceHeist(shield,1,p);assert.equal(shield.guards[0].suspicion,0);close(shield.shield,3);
 const disabled=isolated();disabled.guards[0].disabledFor=5;advanceHeist(disabled,1,p);assert.equal(disabled.guards[0].suspicion,0);close(disabled.guards[0].z,-8);
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
 const time=h.time,queue=h.events,navigation=h.guards.map(({x,y,z,index,heading})=>({x,y,z,index,heading}));recover(h);
 assert.equal(h.phase,'escape');assert(h.stolen&&h.relay&&h.card&&h.anchor&&h.alarm);assert.equal(h.approach,'roof');assert.equal(h.catches,3);assert.equal(h.time,time);
 assert.equal(h.resets,1);assert.equal(h.shield,4);assert.equal(h.cooldown,0);assert.equal(h.jam,0);assert.equal(h.holdProgress,0);assert.equal(h.holdId,null);
 h.guards.forEach((g,i)=>assert.deepEqual(g,{...createHeist().guards[i],...navigation[i],active:true,status:'patrolling'}));
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

test('stationary curator export, timed distraction and rear-only pickpocket gating',()=>{
 const h=prep();assert.deepEqual(getCurator(h),{x:-9,y:0,z:9,heading:Math.PI/2,distracted:true});
 assert.equal(nearbyAction(h,relay).id,'relay');close(nearbyAction(h,relay).duration,1.2);
 for(const p of [{x:-8,y:0,z:9},{x:-9,y:0,z:10},{x:-9,y:0,z:9},{x:-9.35,y:0,z:9.94}]){
  assert.match(nearbyAction(h,p).blocked,/Approach behind the curator while they read the catalogue/);
  hold(h,p,2);assert.equal(h.card,false);
 }
 assert.equal(nearbyAction(h,{x:-11,y:0,z:9}),null,'old relay terminal no longer works');
 assert.equal(nearbyAction(h,{x:-10.651,y:0,z:9}),null);
 assert.equal(nearbyAction(h,{...relay,y:.651}),null);
 assert(!nearbyAction(h,{x:-10.65,y:.65,z:9}).blocked);
 h.time=6;assert.deepEqual(getCurator(h),{x:-9,y:0,z:9,heading:-Math.PI/2,distracted:false});
 for(const p of [relay,{x:-8,y:0,z:9}]){assert(nearbyAction(h,p).blocked);hold(h,p,2);assert.equal(h.card,false);}
 h.time=10;hold(h,relay,1.2);assert(h.relay&&h.card);assert.match(events(h,'relay')[0].text,/Access card/);
 const c=getCurator(h);c.x=0;assert.equal(getCurator(h).x,-9,'returned snapshot is independent');
});

test('pickpocket holds interrupt on turning, walking in front, or E release',()=>{
 const h=prep();h.time=5.8;hold(h,relay,.6);advanceHeist(h,.3,relay,{pauseDetection:true});
 assert.equal(h.holdProgress,0);assert.equal(h.holdId,null);assert.equal(h.card,false);
 h.time=5.8;hold(h,relay,.6);advanceHeist(h,5,relay,{pauseDetection:true});
 assert(getCurator(h).distracted);assert.equal(h.holdProgress,0,'long frame crossed the undistracted interval');
 h.time=10;hold(h,relay,.8);hold(h,{x:-8,y:0,z:9},.5);assert.equal(h.holdProgress,0);
 hold(h,relay,.8);interact(h,relay,.4,false);assert.equal(h.card,false);assert.equal(h.holdProgress,0);
 hold(h,relay,1.19);assert(!h.card);hold(h,relay,.01);assert(h.card&&h.relay);
});

test('Q affects only active guards, records independent fault snapshots and never erases suspicion',()=>{
 const h=prep(),p={x:14,y:4.4,z:-5};
 Object.assign(h.guards[3],{x:14,y:4.4,z:-5});
 h.guards[0].suspicion=4;assert(pulse(h,p));assert.equal(h.disruptions,1);
 const g=h.guards[0];assert.equal(g.suspicion,20);assert.equal(g.disabledFor,1.8);assert.equal(g.reactingFor,7);
 assert.equal(g.suspicious,true);assert.equal(g.status,'suspicious');assert.deepEqual(g.faultPoint,p);
 p.x=0;assert.equal(g.faultPoint.x,14);assert.equal(h.guards[3].disabledFor,0);assert.equal(h.guards[3].reactingFor,0);
 assert.deepEqual(events(h,'pulse')[0].guards,['east']);assert.match(events(h,'pulse')[0].text,/react.*investigating/);
 assert.equal(pulse(h,p),false);assert.equal(h.disruptions,1);
});

test('blackout stops guards but turns toward fault; recovery investigates only segment projection',()=>{
 const h=prep(),g=h.guards[0],p={x:17,y:4.4,z:-5};
 pulse(h,p);assert.deepEqual(g.investigationPoint,{x:14,y:4.4,z:-5});
 advanceHeist(h,.5,far,{pauseDetection:true});close(g.x,14);close(g.z,-8);
 assert(g.heading>0&&g.heading<=.9+1e-8);close(g.reactingFor,6.5);close(g.disabledFor,1.3);close(g.suspicion,15);
 advanceHeist(h,1.3,far,{pauseDetection:true});close(g.z,-8);close(g.disabledFor,0);close(g.reactingFor,5.2);
 advanceHeist(h,1,far,{pauseDetection:true});close(g.x,14);close(g.z,-6.8);close(g.suspicion,15);
 advanceHeist(h,4.2,far,{pauseDetection:true});close(g.x,14);close(g.z,-5);close(g.reactingFor,0);
 assert.equal(g.faultPoint,null);assert.equal(g.investigationPoint,null);close(g.suspicion,15);
 advanceHeist(h,.5,far,{pauseDetection:true});close(g.z,-4.4);close(g.suspicion,2.5);
 advanceHeist(h,.2,far,{pauseDetection:true});assert.equal(g.suspicion,0);assert.equal(g.suspicious,false);assert.equal(g.status,'patrolling');
});

test('reaction projection clamps to authored segment endpoints and stays on every patrol surface',()=>{
 for(const spec of GUARD_SPECS.filter(s=>!s.escapeOnly)){
  for(let index=0;index<spec.points.length;index++){
   const h=prep(),g=h.guards.find(g=>g.id===spec.id),a=spec.points[(index+spec.points.length-1)%spec.points.length],b=spec.points[index];
   Object.assign(g,{x:(a[0]+b[0])/2,z:(a[1]+b[1])/2,index});
   pulse(h,{x:g.x+2,y:g.y,z:g.z+2});
   for(let tick=0;tick<80;tick++){
    advanceHeist(h,.08,far,{pauseDetection:true});
    const cross=(g.x-a[0])*(b[1]-a[1])-(g.z-a[1])*(b[0]-a[0]);close(cross,0);
    assert(g.x>=Math.min(a[0],b[0])-1e-8&&g.x<=Math.max(a[0],b[0])+1e-8);
    assert(g.z>=Math.min(a[1],b[1])-1e-8&&g.z<=Math.max(a[1],b[1])+1e-8);close(g.y,spec.y);
   }
  }
 }
 const h=prep(),g=h.guards[0];pulse(h,{x:14,y:4.4,z:-11});assert.deepEqual(g.investigationPoint,{x:14,y:4.4,z:-8});
 advanceHeist(h,6,far,{pauseDetection:true});close(g.z,-8);close(g.suspicion,15);
});

test('reacting guards detect at seven units and gain 44 per second even in slow mode; LOS still blocks',()=>{
 function reaction(){const h=isolated();pulse(h,{x:14,y:4.4,z:-2});advanceHeist(h,1.8,far,{pauseDetection:true});return h;}
 let h=reaction(),g=h.guards[0];advanceHeist(h,.1,{x:14,y:4.4,z:-1.2},{slow:true});close(g.suspicion,19.4);
 h=reaction();g=h.guards[0];advanceHeist(h,.1,{x:14,y:4.4,z:0});close(g.suspicion,15);
 h=reaction();g=h.guards[0];advanceHeist(h,.1,{x:14,y:4.4,z:-1.2},{blocks:[{x:14,z:-4,w:2,d:.2,top:6,h:2}]});close(g.suspicion,15);
});

test('theft redirects routes continuously, alarms case, and leaves both exits unsealed',()=>{
 assert.deepEqual(ESCAPE_GUARD_SPECS.map(s=>s.id),GUARD_SPECS.map(s=>s.id));
 assert.deepEqual(ESCAPE_GUARD_SPECS[0].points,[[14,-8],[14,-2],[8,-2],[14,-2]]);
 assert.deepEqual(ESCAPE_GUARD_SPECS[1].points,[[-8,-12],[3,-12],[3,-10.8],[3,-12]]);
 assert(Object.isFrozen(ESCAPE_GUARD_SPECS[0].points[0]));
 const h=prep();hold(h,relay,1.2);hold(h,roof,1.5);advanceHeist(h,12,far);
 const before=h.guards.map(({x,y,z})=>({x,y,z}));hold(h,prize,2.5);
 assert.deepEqual(h.guards.map(({x,y,z})=>({x,y,z})),before);assert(h.alarm);
 assert.match(events(h,'theft')[0].text,/redirecting.*gallery.*gala entrance.*without sealing all exits/);
 assert(!nearbyAction(h,front).blocked);assert(!nearbyAction(h,roof).blocked);
 for(let tick=0;tick<600;tick++){
  const old=h.guards.map(g=>({...g}));advanceHeist(h,.1,far,{pauseDetection:true});
  for(let i=0;i<h.guards.length;i++)assert(Math.hypot(h.guards[i].x-old[i].x,h.guards[i].z-old[i].z)<=.12+1e-8);
  const [e,n]=h.guards;
  assert(Math.abs(e.x-14)<1e-8||(Math.abs(e.z+2)<1e-8&&e.x>=8-1e-8));
  assert(Math.abs(n.z+12)<1e-8||(Math.abs(n.x-3)<1e-8&&n.z<=-10.8+1e-8));
 }
 const c=h.guards[2];c.disabledFor=0;c.heading=0;c.suspicion=0;
 advanceHeist(h,.1,{x:c.x,y:c.y,z:c.z+3},{slow:true});close(c.suspicion,4.4);
});

test('recovery in prep and escape clears reactions without navigation jumps or losing card state',()=>{
 for(const steal of [false,true]){
  const h=prep();hold(h,relay,1.2);if(steal)hold(h,prize,2.5);
  pulse(h,{x:14,y:4.4,z:-5});advanceHeist(h,2.2,far,{pauseDetection:true});
  const before=h.guards.map(({x,y,z,index,heading})=>({x,y,z,index,heading}));
  recover(h);assert.deepEqual(h.guards.map(({x,y,z,index,heading})=>({x,y,z,index,heading})),before);
  assert(h.card&&h.relay);assert.equal(h.stolen,steal);assert.equal(h.alarm,steal);assert.equal(h.phase,steal?'escape':'prep');
  assert.equal(h.disruptions,1);assert(h.guards.every(g=>g.reactingFor===0&&g.disabledFor===0&&g.suspicion===0&&!g.suspicious&&g.faultPoint===null&&g.investigationPoint===null));
  advanceHeist(h,.1,far);h.guards.forEach((g,i)=>assert(Math.hypot(g.x-before[i].x,g.z-before[i].z)<=.12+1e-8));
 }
});

test('clean no-Q card completion and no-prep pulse completion remain possible at mission-state level',()=>{
 for(const exit of ['front','roof']){
  const h=prep();hold(h,relay,1.2);if(exit==='roof')hold(h,roof,1.5);
  advanceHeist(h,30,far);assert.equal(h.jam,0);hold(h,prize,2.5);hold(h,exit==='roof'?roof:front,1);
  assert.equal(h.phase,'complete');assert.equal(h.disruptions,0);assert.equal(h.catches,0);assert.equal(events(h,'pulse').length,0);
 }
 const legacy=prep();legacy.relay=true;assert(!nearbyAction(legacy,prize).blocked);
 const alias=prep();alias.card=true;assert(!nearbyAction(alias,prize).blocked);assert.equal(nearbyAction(alias,relay),null);
 const noPrep=prep();pulse(noPrep,prize);hold(noPrep,prize,2.5);hold(noPrep,front,1);
 assert.equal(noPrep.phase,'complete');assert(!noPrep.card&&!noPrep.relay&&!noPrep.anchor);assert.equal(noPrep.disruptions,1);
});

console.log(`\n${passed} heist tests passed.`);
