// Pure mission simulation. Coordinates are feet positions; heading 0 faces +Z.
const point=(x,y,z)=>({x,y,z});
const CURATOR=point(-9,0,9), ROOF=point(1,8.8,-11);
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

// Escape routes retain IDs and stay on the gallery's authored walkway lines.
export const ESCAPE_GUARD_SPECS=Object.freeze(GUARD_SPECS.map(spec=>Object.freeze({
 ...spec,points:Object.freeze((spec.id==='east'?[[14,-8],[14,-2],[8,-2],[14,-2]]:
  spec.id==='north'?[[-8,-12],[3,-12],[3,-10.8],[3,-12]]:spec.points).map(p=>Object.freeze([...p])))
})));
const guardSpec=(h,g)=>(h.phase==='escape'?ESCAPE_GUARD_SPECS:GUARD_SPECS).find(s=>s.id===g.id);

export function getCurator(h){
 const distracted=h.time%10<6;
 return {...CURATOR,heading:distracted?Math.PI/2:-Math.PI/2,distracted};
}

function makeGuard(spec){
 const [x,z]=spec.points[0], [tx,tz]=spec.points[1];
 return {id:spec.id,x,y:spec.y,z,index:1,heading:Math.atan2(tx-x,tz-z),
  suspicion:0,disabledFor:0,reactingFor:0,faultPoint:null,investigationPoint:null,
  suspicious:false,status:spec.escapeOnly?'inactive':'patrolling',active:!spec.escapeOnly};
}
function resetHold(h){h.holdProgress=0;h.holdId=null;}

export function createHeist(){
 return {phase:'scout',relay:false,card:false,anchor:false,stolen:false,alarm:false,disruptions:0,cooldown:0,jam:0,
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
  if(!h.relay&&!h.card){
   const curator=getCurator(h),d=horizontal(player,curator);
   const dot=d>EPS?(Math.sin(curator.heading)*(player.x-curator.x)+Math.cos(curator.heading)*(player.z-curator.z))/d:0;
   add('relay','Pickpocket the curator’s access card',CURATOR,1.2,
    curator.distracted&&dot<-.35?null:'Approach behind the curator while they read the catalogue.');
  }
  if(!h.anchor)add('anchor','Prepare the return tether',ROOF,1.5);
  if(!h.stolen)add('prize','Lift the museum prize',PRIZE,2.5,h.relay||h.card||h.jam>0?null:'Pickpocket the access card for a permanent bypass, or press Q to jam case.');
  add('exit-front','Gala entrance',FRONT,1,'Take the prize before leaving.');
 }
 const action=actions.filter(a=>inReach(player,a.position)).sort((a,b)=>horizontal(player,a.position)-horizontal(player,b.position))[0];
 if(!action)return null;
 if(h.phase==='scout')action.blocked='Reach the planted terrace to survey the museum first.';
 return action;
}

// holdProgress is elapsed seconds, not a fraction: UI can divide by action.duration.
// Call every input frame, including when E is released. Returns a completed action or null.
export function interact(h,player,dt,held){
 if(h.phase==='complete')return null;
 const action=nearbyAction(h,player);
 if(!held||!action||action.blocked){resetHold(h);return null;}
 if(h.holdId!==action.id){resetHold(h);h.holdId=action.id;}
 h.holdProgress=Math.min(action.duration,h.holdProgress+seconds(dt));
 if(h.holdProgress+EPS<action.duration)return null;
 resetHold(h);
 if(action.id==='relay'){
  h.relay=true;h.card=true;emit(h,'relay','Access card pickpocketed. The case now has a permanent bypass.');
 }else if(action.id==='anchor'){
  h.anchor=true;emit(h,'anchor','Return tether prepared. Roof extraction is available.');
 }else if(action.id==='prize'){
  h.stolen=true;h.alarm=true;h.approach=h.approach||'gallery';h.phase='escape';
  for(const g of h.guards){
   const spec=guardSpec(h,g);
   // Only changed routes need a handover. Their nearest nodes connect along
   // the same east/north walkway, even when the old patrol is beyond the new end.
   if(g.id==='east'||g.id==='north'){
    g.index=spec.points.reduce((best,p,i)=>Math.hypot(p[0]-g.x,p[1]-g.z)<
     Math.hypot(spec.points[best][0]-g.x,spec.points[best][1]-g.z)?i:best,0);
   }
   g.active=true;g.suspicious=g.reactingFor>0||g.suspicion>0;
   g.status=g.suspicious?'suspicious':'patrolling';
   if(g.reactingFor>0)g.investigationPoint=projectFault(g,spec);
  }
  emit(h,'theft','Prize secured. Guards are redirecting to the gallery and gala entrance, without sealing all exits.',{approach:h.approach});
 }else{
  h.exit=action.id==='exit-roof'?'roof':'front';h.phase='complete';
  emit(h,'complete','Clean getaway. The prize is yours.',{exit:h.exit,approach:h.approach});
 }
 return action;
}

export function pulse(h,player){
 if((h.phase!=='prep'&&h.phase!=='escape')||h.cooldown>0||!player)return false;
 h.jam=8;h.cooldown=16;h.disruptions++;
 const guards=[];
 for(const g of h.guards){
  if(g.active&&horizontal(g,player)<=6.5+EPS&&Math.abs(g.y-player.y)<=2+EPS){
   g.suspicion=Math.max(20,g.suspicion);g.disabledFor=1.8;g.reactingFor=7;
   g.suspicious=true;g.status='suspicious';g.faultPoint={...player};
   g.investigationPoint=projectFault(g,guardSpec(h,g));guards.push(g.id);
  }
 }
 emit(h,'pulse','Case jammed for 8 seconds. Nearby active guards suffer a 1.8-second visor interruption and react by investigating your last position for 7 seconds.',{guards});
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
// Clamp the fault to the current patrol segment, never to the player's surface.
// A route handover may extend the first segment to the guard's current position.
function projectFault(g,spec){
 const a=spec.points[(g.index+spec.points.length-1)%spec.points.length],b=spec.points[g.index];
 const dx=b[0]-a[0],dz=b[1]-a[1],length2=dx*dx+dz*dz;
 if(length2<EPS)return point(g.x,g.y,g.z);
 const along=p=>((p.x-a[0])*dx+(p.z-a[1])*dz)/length2;
 const current=along(g),t=Math.max(Math.min(0,current),Math.min(Math.max(1,current),along(g.faultPoint)));
 return point(a[0]+dx*t,g.y,a[1]+dz*t);
}
function investigate(g,dt){
 const p=g.investigationPoint,d=horizontal(g,p),travel=Math.min(d,SPEED*dt);
 if(d>EPS){g.x+=(p.x-g.x)/d*travel;g.z+=(p.z-g.z)/d*travel;}
}
const alertGuard=(h,g)=>g.reactingFor>0||(h.alarm&&g.id==='case');
function visible(h,g,p,options){
 if(!p||h.phase==='scout'||h.shield>0||options.pauseDetection||g.disabledFor>0||Math.abs(g.y-p.y)>1.65+EPS)return false;
 const d=horizontal(g,p);
 if(d>(alertGuard(h,g)?7:options.slow?4.2:6)+EPS)return false;
 if(d>1.1+EPS&&Math.abs(angleDelta(g.heading,bearing(g,p)))>.65+EPS)return false;
 return hasLineOfSight(point(g.x,g.y+1.1,g.z),point(p.x,p.y+.9,p.z),options.blocks||[]);
}

export function advanceHeist(h,dt,player,options={}){
 if(h.phase==='complete')return h;
 let remaining=seconds(dt);
 // Small substeps keep timer expiry, patrol turns and catches reliable for long frames.
 while(remaining>EPS){
  let step=Math.min(remaining,1/60);
  // Split exactly at blackout/reaction expiry so neither timer grants free movement.
  for(const g of h.guards)for(const key of ['disabledFor','reactingFor'])if(g[key]>EPS)step=Math.min(step,g[key]);
  remaining-=step;h.time+=step;
  for(const key of ['cooldown','jam','shield'])h[key]=Math.max(0,h[key]-step);
  // A long frame cannot carry a pickpocket hold across a look-behind interval.
  if(h.holdId){const a=nearbyAction(h,player);if(!a||a.blocked||a.id!==h.holdId)resetHold(h);}
  for(let i=0;i<h.guards.length;i++){
   const g=h.guards[i],spec=guardSpec(h,g);
   g.active=!spec.escapeOnly||h.phase==='escape';
   if(!g.active){g.suspicion=0;g.suspicious=false;g.status='inactive';continue;}
   const reacting=g.reactingFor>EPS,blackout=g.disabledFor>EPS;
   if(!blackout){
    if(reacting&&g.investigationPoint)investigate(g,step);
    else patrol(g,spec,step);
   }
   const seen=visible(h,g,player,options);
   const [tx,tz]=spec.points[g.index];
   const target=reacting&&g.faultPoint?bearing(g,g.faultPoint):seen?bearing(g,player):bearing(g,{x:tx,z:tz});
   const delta=angleDelta(g.heading,target);
   g.heading+=Math.max(-TURN_SPEED*step,Math.min(TURN_SPEED*step,delta));
   g.heading=Math.atan2(Math.sin(g.heading),Math.cos(g.heading));
   g.suspicion=Math.max(reacting?15:0,Math.min(100,g.suspicion+(seen?(alertGuard(h,g)?44:options.slow?26:36):-25)*step));
   g.disabledFor=Math.max(0,g.disabledFor-step);g.reactingFor=Math.max(0,g.reactingFor-step);
   if(g.disabledFor<EPS)g.disabledFor=0;
   if(g.reactingFor<EPS){g.reactingFor=0;g.faultPoint=null;g.investigationPoint=null;}
   g.suspicious=g.reactingFor>0||g.suspicion>0;g.status=g.suspicious?'suspicious':'patrolling';
   if(g.suspicion>=100){
    h.catches++;h.shield=4;resetHold(h);
    for(const other of h.guards){
     other.suspicion=0;other.disabledFor=0;other.reactingFor=0;
     other.faultPoint=null;other.investigationPoint=null;other.suspicious=false;
     other.status=other.active?'patrolling':'inactive';
    }
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
 // Reset guard snapshots in place: no position, route-index or heading jump.
 h.guards.forEach(g=>{
  const spec=guardSpec(h,g),active=!spec.escapeOnly||h.phase==='escape';
  const navigation={x:g.x,y:g.y,z:g.z,index:g.index,heading:g.heading};
  Object.assign(g,makeGuard(spec),navigation,{active,status:active?'patrolling':'inactive'});
 });
 h.jam=0;h.cooldown=0;h.shield=4;h.resets++;resetHold(h);
 emit(h,'recovered','Back in position. Preparation and loot are preserved.');
 return h;
}
