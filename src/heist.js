// Pure mission simulation. Coordinates are feet positions; heading 0 faces +Z.
const point=(x,y,z)=>({x,y,z});
const RELAY=point(-11,0,9), ROOF=point(1,8.8,-11);
const PRIZE=point(3,4.4,-7.9), FRONT=point(7,0,12);
const EPS=1e-9, SPEED=1.2, TURN_SPEED=1.8;
const seconds=dt=>Number.isFinite(dt)?Math.max(0,dt):0;
const horizontal=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const angleDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const bearing=(a,b)=>Math.atan2(b.x-a.x,b.z-a.z);
const inReach=(p,a)=>horizontal(p,a)<=1.65+EPS&&Math.abs(p.y-a.y)<=.65+EPS;
const emit=(h,type,text,extra={})=>h.events.push({type,text,...extra});

export const GUARD_SPECS=Object.freeze([
 {id:'east',y:4.4,points:[[14,-8],[14,7]],escapeOnly:false},
 {id:'north',y:4.4,points:[[-8,-12],[7,-12]],escapeOnly:false},
 {id:'case',y:4.4,points:[[1,-7],[5,-7],[5,-9],[1,-9]],escapeOnly:false},
 {id:'front',y:0,points:[[-3,9],[7,9],[7,12]],escapeOnly:true}
].map(s=>Object.freeze({...s,points:Object.freeze(s.points.map(p=>Object.freeze(p)))})));

function makeGuard(spec){
 const [x,z]=spec.points[0], [tx,tz]=spec.points[1];
 return {id:spec.id,x,y:spec.y,z,index:1,heading:Math.atan2(tx-x,tz-z),
  suspicion:0,disabledFor:0,active:!spec.escapeOnly};
}
function resetHold(h){h.holdProgress=0;h.holdId=null;}

export function createHeist(){
 return {phase:'scout',relay:false,anchor:false,stolen:false,cooldown:0,jam:0,
  shield:0,time:0,catches:0,resets:0,holdProgress:0,holdId:null,
  approach:'gallery',exit:null,guards:GUARD_SPECS.map(makeGuard),events:[]};
}

export function survey(h){
 if(h.phase!=='scout')return false;
 h.phase='prep';h.shield=4;resetHold(h);
 emit(h,'survey','Terrace surveyed. Both preparation jobs are optional.');
 return true;
}

export function nearbyAction(h,player){
 if(h.phase==='complete'||!player)return null;
 const actions=[];
 const add=(id,label,position,duration,blocked)=>actions.push({id,label,position:{...position},duration,...(blocked?{blocked}:{})});
 if(h.phase==='escape'){
  add('exit-front','Leave through the gala entrance',FRONT,1);
  add('exit-roof','Extract via the roof tether',ROOF,1,h.anchor?null:'Roof extraction needs the anchor prepared before the theft. Use the front exit.');
 }else{
  if(!h.relay)add('relay','Unlock the security relay',RELAY,1.5);
  if(!h.anchor)add('anchor','Prepare the return tether',ROOF,1.5);
  if(!h.stolen)add('prize','Lift the museum prize',PRIZE,2.5,h.relay||h.jam>0?null:'Press Q to jam case.');
  add('exit-front','Gala entrance',FRONT,1,'Take the prize before leaving.');
 }
 const action=actions.filter(a=>inReach(player,a.position)).sort((a,b)=>horizontal(player,a.position)-horizontal(player,b.position))[0];
 if(!action)return null;
 if(h.phase==='scout')action.blocked='Reach the planted terrace to survey the museum first.';
 return action;
}

// holdProgress is elapsed seconds, not a fraction: UI can divide by action.duration.
// Call every input frame, including when F is released. Returns a completed action or null.
export function interact(h,player,dt,held){
 if(h.phase==='complete')return null;
 const action=nearbyAction(h,player);
 if(!held||!action||action.blocked){resetHold(h);return null;}
 if(h.holdId!==action.id){resetHold(h);h.holdId=action.id;}
 h.holdProgress=Math.min(action.duration,h.holdProgress+seconds(dt));
 if(h.holdProgress+EPS<action.duration)return null;
 resetHold(h);
 if(action.id==='relay'){
  h.relay=true;emit(h,'relay','Security relay unlocked. The case stays open.');
 }else if(action.id==='anchor'){
  h.anchor=true;emit(h,'anchor','Return tether prepared. Roof extraction is available.');
 }else if(action.id==='prize'){
  h.stolen=true;h.approach=h.approach||'gallery';h.phase='escape';
  h.guards.forEach((g,i)=>{g.active=!GUARD_SPECS[i].escapeOnly||h.phase==='escape';});
  emit(h,'theft','Prize secured. Reach an exit.',{approach:h.approach});
 }else{
  h.exit=action.id==='exit-roof'?'roof':'front';h.phase='complete';
  emit(h,'complete','Clean getaway. The prize is yours.',{exit:h.exit,approach:h.approach});
 }
 return action;
}

export function pulse(h,player){
 if((h.phase!=='prep'&&h.phase!=='escape')||h.cooldown>0||!player)return false;
 h.jam=8;h.cooldown=16;
 const guards=[];
 for(const g of h.guards){
  if(horizontal(g,player)<=6.5+EPS&&Math.abs(g.y-player.y)<=2+EPS){
   g.suspicion=0;g.disabledFor=5;guards.push(g.id);
  }
 }
 emit(h,'pulse','Case jammed for 8 seconds. Nearby visors disabled for 5 seconds.',{guards});
 return true;
}

// Exact segment / solid AABB slab test. a and b are already eye coordinates.
// Blocks use centered x,z, width/depth, and vertical extent [top-h, top].
export function hasLineOfSight(a,b,blocks=[]){
 for(const box of blocks){
  if(box.disabled)continue;
  const lo={x:box.x-box.w/2,y:box.top-box.h,z:box.z-box.d/2};
  const hi={x:box.x+box.w/2,y:box.top,z:box.z+box.d/2};
  let enter=0,leave=1,hit=true;
  for(const axis of ['x','y','z']){
   const delta=b[axis]-a[axis];
   if(Math.abs(delta)<EPS){
    if(a[axis]<lo[axis]||a[axis]>hi[axis]){hit=false;break;}
   }else{
    let t0=(lo[axis]-a[axis])/delta,t1=(hi[axis]-a[axis])/delta;
    if(t0>t1)[t0,t1]=[t1,t0];
    enter=Math.max(enter,t0);leave=Math.min(leave,t1);
    if(enter>leave){hit=false;break;}
   }
  }
  if(hit)return false;
 }
 return true;
}

function patrol(g,spec,dt){
 let travel=SPEED*dt;
 while(travel>EPS){
  const [x,z]=spec.points[g.index],d=Math.hypot(x-g.x,z-g.z);
  if(d<=travel+EPS){
   g.x=x;g.z=z;travel=Math.max(0,travel-d);g.index=(g.index+1)%spec.points.length;
  }else{g.x+=(x-g.x)/d*travel;g.z+=(z-g.z)/d*travel;travel=0;}
 }
}
function visible(h,g,p,options){
 if(!p||h.phase==='scout'||h.shield>0||options.pauseDetection||g.disabledFor>0||Math.abs(g.y-p.y)>1.65+EPS)return false;
 const d=horizontal(g,p);
 if(d>(options.slow?4.2:6)+EPS)return false;
 if(d>1.1+EPS&&Math.abs(angleDelta(g.heading,bearing(g,p)))>.65+EPS)return false;
 return hasLineOfSight(point(g.x,g.y+1.1,g.z),point(p.x,p.y+.9,p.z),options.blocks||[]);
}

export function advanceHeist(h,dt,player,options={}){
 if(h.phase==='complete')return h;
 let remaining=seconds(dt);
 // Small substeps keep timer expiry, patrol turns and catches reliable for long frames.
 while(remaining>EPS){
  const step=Math.min(remaining,1/60);remaining-=step;h.time+=step;
  for(const key of ['cooldown','jam','shield'])h[key]=Math.max(0,h[key]-step);
  for(let i=0;i<h.guards.length;i++){
   const g=h.guards[i],spec=GUARD_SPECS[i];
   g.disabledFor=Math.max(0,g.disabledFor-step);g.active=!spec.escapeOnly||h.phase==='escape';
   if(!g.active){g.suspicion=0;continue;}
   patrol(g,spec,step);
   const seen=visible(h,g,player,options);
   const [tx,tz]=spec.points[g.index];
   const target=seen?bearing(g,player):bearing(g,{x:tx,z:tz});
   const delta=angleDelta(g.heading,target);
   g.heading+=Math.max(-TURN_SPEED*step,Math.min(TURN_SPEED*step,delta));
   g.heading=Math.atan2(Math.sin(g.heading),Math.cos(g.heading));
   g.suspicion=Math.max(0,Math.min(100,g.suspicion+(seen?(options.slow?26:36):-25)*step));
   if(g.suspicion>=100){
    h.catches++;h.shield=4;resetHold(h);
    for(const other of h.guards)other.suspicion=0;
    emit(h,'caught','Spotted by security. Regroup and try again.',{guard:g.id,catches:h.catches});
   }
  }
 }
 // Continuing a hold after walking away or after a temporary case jam expires is invalid.
 if(h.holdId){const a=nearbyAction(h,player);if(!a||a.blocked||a.id!==h.holdId)resetHold(h);}
 return h;
}

export function recover(h){
 if(h.phase==='complete')return h;
 h.guards.forEach((g,i)=>Object.assign(g,makeGuard(GUARD_SPECS[i]),{active:!GUARD_SPECS[i].escapeOnly||h.phase==='escape'}));
 h.jam=0;h.cooldown=0;h.shield=4;h.resets++;resetHold(h);
 emit(h,'recovered','Back in position. Preparation and loot are preserved.');
 return h;
}
