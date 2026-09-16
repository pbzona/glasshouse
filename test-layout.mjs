import assert from 'node:assert/strict';
import {platforms,securityGate,makePlayer,stepPlayer,START} from './src/world.js';
import {createHeist,advanceHeist,survey,interact,hasLineOfSight} from './src/heist.js';
function run(offset=0){const p=makePlayer(),h=createHeist(),dt=1/120;let max=0;
 advanceHeist(h,offset,p);h.events=[];
 function tick(x=0,z=0,j=false,hold=false){securityGate.disabled=h.relay||h.jam>0;stepPlayer(p,x,z,dt,j);advanceHeist(h,dt,p,{blocks:platforms});interact(h,p,dt,hold);max=Math.max(max,...h.guards.map(g=>g.suspicion));}
 function wait(s){for(let t=0;t<s;t+=dt)tick();}
 function go(x,z){for(let t=0;t<14;t+=dt){const dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz);if(d<.08&&Math.hypot(p.vx,p.vz)<.2)return;const a=Math.min(1,d*2/5.6);tick(d?dx/d*a:0,d?dz/d*a:0);}throw Error(`Blocked ${x},${z} from ${JSON.stringify(p)}`);}
 function jump(x,z,y){assert(p.grounded);for(let t=0;t<1.3;t+=dt){const dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz),a=Math.min(1,d*4/5.6);tick(d?dx/d*a:0,d?dz/d*a:0,t===0);if(t>.2&&p.grounded){assert(Math.abs(p.y-y)<.05,`landed ${p.y}, expected ${y}`);go(x,z);return;}}throw Error('Jump landing missing');}
 wait(.2);return {p,h,tick,wait,go,jump,get max(){return max;},clearMax(){max=0;}};
}
for(const offset of [0,3,6,9,12,15]){
 const r=run(offset);r.go(7,-2);survey(r.h);r.h.shield=0;r.go(10,-2);r.go(10,-8.7);r.go(7,-8.7);r.wait(12);assert.equal(r.h.catches,0);assert.equal(r.max,0,`Arcade forced sighting at phase ${offset}: ${r.max}`);
}
console.log('PASS inner arcade and waiting pocket remain unseen across six patrol phases, no Q');
for(const offset of [0,5,10,15]){
 const r=run(offset);r.go(7,12);r.go(-9,12);survey(r.h);r.h.shield=0;r.go(-14,12);r.go(-14,1.7);assert.equal(r.p.y,4.4);r.go(-14,-6);r.go(-10,-6);r.jump(-8,-3.5,5.5);r.jump(-10,-.5,6.6);r.jump(-7,1.5,7.7);r.jump(-4,1.5,8.8);r.go(-4,-5.7);r.jump(-4,-8,8.8);r.jump(-4,-10,8.8);r.go(1,-11);assert.equal(r.h.catches,0);assert.equal(r.max,0,`Service forced sight at phase ${offset}`);
}
console.log('PASS service-floor to roof route independent of artifact walkway, across four patrol phases');
// Architectural screens actually occlude, not just decorative props.
assert.equal(hasLineOfSight({x:14,y:5.5,z:-6},{x:10,y:5.3,z:-6},platforms),false);
assert.equal(hasLineOfSight({x:6,y:5.5,z:-12},{x:6,y:5.3,z:-9},platforms),false);
console.log('PASS gallery screens block actual guard sightlines');
// Try timing a clean final approach around the case guard, without scrambler.
let clean=null;
for(let delay=0;delay<13&&!clean;delay+=.5){const r=run();r.go(7,-2);survey(r.h);r.h.shield=0;r.h.relay=true;r.h.card=true;r.go(10,-2);r.go(10,-8.7);r.go(7,-8.7);r.wait(delay);r.clearMax();r.go(7,-6.3);r.go(3,-6.3);for(let t=0;t<2.55;t+=1/120)r.tick(0,0,false,true);if(r.h.stolen&&r.h.catches===0&&r.max===0){clean={delay,max:r.max};}}
assert(clean,'No clean timed approach to the prize exists');console.log('PASS clean card-enabled theft without Q or detection; waiting delay',clean.delay);
