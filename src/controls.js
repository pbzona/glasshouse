// Pure control policy; deliberately independent from rendering and mission state.
export const angleDelta=(from,to)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));
export function movementVector(x,z,yaw){const length=Math.hypot(x,z);if(length>1){x/=length;z/=length;}return {x:x*Math.cos(yaw)+z*Math.sin(yaw),z:z*Math.cos(yaw)-x*Math.sin(yaw)};}
export function followYaw(yaw,dx,dz,dt,{enabled=true,grounded=true,manualAge=99,movingAge=99,slow=false,backward=false,busy=false}={}){
 if(!enabled||!grounded||slow||backward||busy||manualAge<1.5||movingAge<.45||Math.hypot(dx,dz)<.15)return yaw;
 const target=Math.atan2(dx,dz)+Math.PI,delta=angleDelta(yaw,target);
 if(Math.abs(delta)<.07)return yaw;
 const amount=Math.sign(delta)*Math.min(Math.abs(delta)*(1-Math.exp(-2*dt)),.8*dt);
 return yaw+amount;
}
export function chooseContext(action,tether){
 // Never silently abandon a steal/prep action for a nearby tether. A blocked roof
 // exit is the exception: descending is the useful way out without an anchor.
 if(action&&!action.blocked)return {kind:'action',id:action.id,label:action.label,action};
 if(tether&&(!action||action.id==='exit-roof'))return {kind:'tether',id:tether.down?'descend':'ascend',label:tether.label,tether};
 return action?{kind:'action',id:action.id,label:action.blocked,action}:null;
}
export function findLedge(p,dx,dz,blocks,{airborne=false}={}){
 const length=Math.hypot(dx,dz);if(length<.01)return null;dx/=length;dz/=length;
 if(airborne&&p.vy>3.5)return null;
 let best=null,score=Infinity;
 for(const b of blocks){
  if(b.disabled||b.kind==='gate'||b.w<.8||b.d<.8)continue;
  const rise=b.top-p.y;if(rise<(airborne?-.12:.5)||rise>(airborne?1.05:1.25))continue;
  // Standing safely inside a platform is not a missed ledge.
  if(airborne&&p.x>b.x-b.w/2+.08&&p.x<b.x+b.w/2-.08&&p.z>b.z-b.d/2+.08&&p.z<b.z+b.d/2-.08)continue;
  const x=Math.max(b.x-b.w/2+.38,Math.min(b.x+b.w/2-.38,p.x)),z=Math.max(b.z-b.d/2+.38,Math.min(b.z+b.d/2-.38,p.z));
  const vx=x-p.x,vz=z-p.z,d=Math.hypot(vx,vz);if(d<.04||d>(airborne?.9:.95)||(vx*dx+vz*dz)/d<.45)continue;
  // Reject landing volumes and paths obstructed by a different solid platform.
  let clear=true;
  for(let step=1;step<=6&&clear;step++){
   const t=step/6,vertical=Math.min(1,t/.55),horizontal=Math.max(0,(t-.4)/.6);
   const q={x:p.x+vx*horizontal,y:p.y+rise*vertical+.035,z:p.z+vz*horizontal};
   for(const other of blocks){if(other===b||other.disabled)continue;const bottom=other.top-other.h;
    if(q.y<other.top-.015&&q.y+1.35>bottom+.025&&Math.abs(q.x-other.x)<other.w/2+.22&&Math.abs(q.z-other.z)<other.d/2+.22){clear=false;break;}
   }
  }
  if(!clear)continue;const cost=d+Math.max(0,rise)*.08;if(cost<score){score=cost;best={x,y:b.top,z,platformId:b.id};}
 }
 return best;
}
