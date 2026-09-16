export const START={x:7,y:0,z:11};
export const platforms=[];
const box=(id,x,z,w,d,top,kind='stone',h=.4)=>{const b={id,x,z,w,d,top,h,kind}; platforms.push(b);return b;};
box('ground',0,0,34,30,0,'floor',.7);
// Continuous east staircase, outside the overhead gallery footprint.
for(let i=0;i<11;i++)box('stair-'+i,7,8.5-i*.82,3.4,.86,(i+1)*.4,'stair',.4);
box('stair-landing',7,-1.3,4,3.2,4.4);
box('terrace-connection',10,-2,8,3,4.4,'garden');
box('east-gallery',14,-1,4,26,4.4,'garden');
box('north-gallery',0,-12,28,4,4.4);
box('west-gallery',-14,-1,4,26,4.4,'garden');
box('exhibition',3,-7.9,7,4.5,4.4);
box('exhibition-link',3,-10,4,2,4.4);
box('scaffold-base',-10,-6,4,4,4.4,'wood');
box('scaffold-one',-8,-3.5,3,2.6,5.5,'wood');
box('scaffold-two',-10,-.5,3,2.6,6.6,'wood');
box('scaffold-three',-7,1.5,3,2.6,7.7,'wood');
box('scaffold-four',-4,1.5,3,3,8.8,'wood');
box('beam-one',-4,-3,1.8,6,8.8,'beam');
box('beam-two',-4,-8,1.8,1.4,8.8,'beam');
box('roof-deck',0,-11,10,4,8.8,'roof');
export const securityGate={id:'security-gate',x:3,z:-10.42,w:4.4,d:.32,top:6.7,h:2.3,kind:'gate',disabled:false};
export const coverBlocks=[
 {id:'east-cover',x:13,z:1.5,w:1.5,d:1.25,top:6,h:1.6,kind:'crate'},
 {id:'north-cover',x:-5,z:-11.1,w:1.5,d:1.2,top:6,h:1.6,kind:'crate'},
 {id:'case-cover',x:.35,z:-7.4,w:1.2,d:1.5,top:6,h:1.6,kind:'crate'}
];
platforms.push(...coverBlocks,securityGate);
export const markers=[
 {x:13,y:4.4,z:-2,label:'01 / Planted terrace',short:'PLANTED TERRACE',hint:'WASD to move. Climb the broad staircase ahead; follow the brass inlays.'},
 {x:-4,y:8.8,z:1.5,label:'02 / Scaffold crown',short:'SCAFFOLD CROWN',hint:'Follow the gallery around the far wall. Jump between the amber scaffold landings.'},
 {x:1,y:8.8,z:-11,label:'03 / Skylight overlook',short:'SKYLIGHT OVERLOOK',hint:'Follow the narrow beam. Jump the marked gap to reach the roof deck.'}
];
export const BODY_RADIUS=.29, BODY_HEIGHT=1.35;
export function makePlayer(){return {...START,vx:0,vy:0,vz:0,grounded:false,coyote:0,jumpBuffer:0};}
export function stepPlayer(p,ix,iz,dt,jump=false,slow=false){
 const speed=slow?2.6:5.6;
 const length=Math.hypot(ix,iz);if(length>1){ix/=length;iz/=length;}
 // Vector acceleration avoids an extra diagonal boost. Faster braking reduces
 // overshoot on narrow landings, while sustained movement eases up to speed.
 const acceleration=p.grounded?(length<.02?46:27):21;
 const ax=ix*speed-p.vx,az=iz*speed-p.vz,change=Math.hypot(ax,az),ratio=change?Math.min(1,acceleration*dt/change):0;
 p.vx+=ax*ratio;p.vz+=az*ratio;
 p.coyote=p.grounded?.17:Math.max(0,p.coyote-dt);
 p.jumpBuffer=jump?.2:Math.max(0,p.jumpBuffer-dt);
 if(p.jumpBuffer>0&&p.coyote>0){p.vy=8.6;p.grounded=false;p.coyote=0;p.jumpBuffer=0;}
 p.vy-=20*dt;
 const oldY=p.y;
 // Axis-separated swept side collision. Stair auto-step is intentionally generous.
 for(const axis of ['x','z']){
  const velocity=axis==='x'?p.vx:p.vz;
  const proposed=p[axis]+velocity*dt;let v=proposed;
  for(const b of platforms){if(b.disabled)continue;
   const bottom=b.top-b.h;
   if(p.y>=b.top-.015||p.y+BODY_HEIGHT<=bottom+.025)continue;
   const other=axis==='x'?'z':'x', halfOther=(other==='x'?b.w:b.d)/2;
   if(Math.abs(p[other]-b[other])>=halfOther+BODY_RADIUS-.02)continue;
   const half=(axis==='x'?b.w:b.d)/2;
   if(Math.abs(v-b[axis])>=half+BODY_RADIUS)continue;
   if(p.grounded&&b.top-p.y<=.43&&b.top>=p.y&&p.vy<=0){p.y=b.top;p.vy=0;continue;}
   const edge=b[axis]+(velocity>0?-1:1)*(half+BODY_RADIUS);
   if(velocity>0&&p[axis]<=edge+.05)v=Math.min(v,edge);
   else if(velocity<0&&p[axis]>=edge-.05)v=Math.max(v,edge);
  }
  p[axis]=v;
 }
 let nextY=p.y+p.vy*dt;p.grounded=false;
 if(p.vy<=0){
  let floor=-Infinity;
  for(const b of platforms){if(b.disabled)continue;if(Math.abs(p.x-b.x)<=b.w/2+BODY_RADIUS*.5&&Math.abs(p.z-b.z)<=b.d/2+BODY_RADIUS*.5&&p.y>=b.top-.055&&nextY<=b.top)floor=Math.max(floor,b.top);}
  if(floor!==-Infinity){nextY=floor;p.vy=0;p.grounded=true;}
 }else{
  for(const b of platforms){if(b.disabled)continue;let bottom=b.top-b.h;if(Math.abs(p.x-b.x)<b.w/2+BODY_RADIUS&&Math.abs(p.z-b.z)<b.d/2+BODY_RADIUS&&oldY+BODY_HEIGHT<=bottom&&nextY+BODY_HEIGHT>=bottom){nextY=bottom-BODY_HEIGHT;p.vy=0;}}
 }
 p.y=nextY;
 p.x=Math.max(-16.6,Math.min(16.6,p.x));p.z=Math.max(-14.6,Math.min(14.6,p.z));
}
