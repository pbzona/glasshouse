import {platforms} from './world.js';

// Presentation only. Feet are world coordinates, heading zero faces +Z.
// These six entries REPLACE, rather than supplement, matching STATIC_GUESTS.
const SPECS=[
 {id:'server',role:'server',x:-6,z:6,yaw:0,coat:'#e2d7bb',fur:'#a97651',hat:'cap'},
 {id:'donor',role:'toast',x:-2,z:-5,yaw:2.03,coat:'#784354',fur:'#ba8055',hat:'pillbox',dress:true},
 {id:'companion',role:'chat',x:-1,z:-5.5,yaw:-1.11,coat:'#344e60',fur:'#9d9a8e',hat:'ears'},
 {id:'admirer',role:'admire',x:-7,z:4,yaw:1.85,coat:'#4d7568',fur:'#d0ab79',hat:'beret',dress:true},
 {id:'photographer',role:'photo',x:10,z:9,yaw:-2.25,coat:'#977b55',fur:'#77787c',hat:'cap'},
 {id:'patron',role:'look',x:2,z:11,yaw:-1.3,coat:'#625377',fur:'#ae8b67',hat:'brim'}
];
const ROUTE=[
 {x:-6,z:6,dwell:3.8,heading:2.6779450446},
 {x:-6.6,z:7.5,dwell:0},
 {x:-5.5,z:8.1,dwell:0},
 {x:-4,z:8.5,dwell:4.2,heading:0},
 {x:-4.6,z:7.7,dwell:0},
 {x:-6,z:7,dwell:0}
];
const PRIZE={x:3,y:4.4,z:-7.9}, SPEED=.68, BODY_HEIGHT=1.82, CLEARANCE=.48;
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const smooth=n=>{const t=clamp(n);return t*t*(3-2*t);};
const angle=n=>Math.atan2(Math.sin(n),Math.cos(n));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const bump=(t,start,hold,end)=>smooth((t-start)/.55)*(1-smooth((t-hold)/(end-hold)));
const routeDuration=ROUTE.reduce((n,p,i)=>n+p.dwell+distance(p,ROUTE[(i+1)%ROUTE.length])/SPEED,0);
function routeAt(time){
 let t=((time%routeDuration)+routeDuration)%routeDuration;
 for(let i=0;i<ROUTE.length;i++){
  const a=ROUTE[i],b=ROUTE[(i+1)%ROUTE.length],duration=distance(a,b)/SPEED;
  const heading=Math.atan2(b.x-a.x,b.z-a.z);
  if(t<a.dwell)return {...a,y:0,heading:a.heading??heading,walking:false,segment:i};
  t-=a.dwell;
  if(t<=duration){const f=t/duration;return {x:a.x+(b.x-a.x)*f,y:0,z:a.z+(b.z-a.z)*f,heading,walking:true,segment:i};}
  t-=duration;
 }
 return {...ROUTE[0],y:0,heading:0,walking:false,segment:0};
}
// Expanded segment/AABB test; elevated galleries do not block ground-floor life.
function segmentHits(a,b,box,r= CLEARANCE){
 if(box.disabled||box.top<=.025||box.top-box.h>=BODY_HEIGHT)return false;
 let enter=0,leave=1;
 for(const axis of ['x','z']){
  const half=(axis==='x'?box.w:box.d)/2+r,lo=box[axis]-half,hi=box[axis]+half,d=b[axis]-a[axis];
  if(Math.abs(d)<1e-10){if(a[axis]<lo||a[axis]>hi)return false;}
  else{const u=(lo-a[axis])/d,v=(hi-a[axis])/d;enter=Math.max(enter,Math.min(u,v));leave=Math.min(leave,Math.max(u,v));if(enter>leave)return false;}
 }
 return true;
}

export function createGala(T){
 const root=new T.Group();root.name='gala-life';root.userData.presentationOnly=true;
 const material=new T.MeshLambertMaterial({vertexColors:true});
 const geos={box:new T.BoxGeometry(1,1,1),ball:new T.SphereGeometry(1,8,5),cyl:new T.CylinderGeometry(1,1,1,8),cone:new T.CylinderGeometry(.6,1,1,8)};
 const geometries=new Set(), actors=[];
 const cream='#eddbb7',ink='#242e37',gold='#c4a66c';
 // Merge all colors/primitives of each articulated bone into one vertex-colored
 // mesh. No textures, material arrays, scene-wide baking or dependency on a DOM.
 function bone(parent,name,origin,draw){
  const g=new T.Group();g.name=name;g.position.set(...origin);parent.add(g);
  const pos=[],norm=[],col=[];
  function part(kind,color,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0){
   const q=new T.Quaternion().setFromEuler(new T.Euler(rx,ry,rz));
   const matrix=new T.Matrix4().compose(new T.Vector3(x,y,z),q,new T.Vector3(sx,sy,sz));
   const geo=geos[kind].toNonIndexed();geo.applyMatrix4(matrix);
   const p=geo.attributes.position,n=geo.attributes.normal,c=new T.Color(color);
   for(let i=0;i<p.count;i++){pos.push(p.getX(i),p.getY(i),p.getZ(i));norm.push(n.getX(i),n.getY(i),n.getZ(i));col.push(c.r,c.g,c.b);}
   geo.dispose();
  }
  draw(part);
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('normal',new T.Float32BufferAttribute(norm,3));geo.setAttribute('color',new T.Float32BufferAttribute(col,3));geo.computeBoundingSphere();
  geometries.add(geo);g.add(new T.Mesh(geo,material));return g;
 }
 for(const s of SPECS){
  const g=new T.Group();g.name='gala-'+s.id;g.userData={galaId:s.id,role:s.role,presentationOnly:true};root.add(g);
  const body=bone(g,'body',[0,0,0],p=>{
   p(s.dress?'cone':'box',s.coat,0,.77,0,s.dress?.32:.45,s.dress?.73:.61,s.dress?.27:.26);
   p('box',cream,0,.96,.142,.14,.31,.028);
   for(const sign of [-1,1])p('box',s.coat,sign*.11,1.04,.16,.105,.26,.032,0,0,sign*.28);
   p('box',gold,0,.65,.144,.44,.033,.034);
   if(s.role==='server'){
    p('box',cream,0,.59,.17,.34,.38,.03);p('box',ink,0,1.1,.18,.16,.045,.04);
   }else{p('ball',gold,.14,1.03,.174,.025,.025,.012);}
   if(s.role!=='server')for(const sign of [-1,1]){
    p('box',ink,sign*.115,.23,0,.12,.36,.135);p('ball',ink,sign*.115,.065,.055,.105,.065,.16);
   }
   // Small tapered tail is a silhouette accent, never a giant mascot blob.
   p('cone',s.fur,0,.53,-.24,.075,.36,.085,.95,0,0);
  });
  const head=bone(g,'head',[0,1.27,0],p=>{
   p('ball',s.fur,0,.04,0,.205,.225,.175);
   for(const sign of [-1,1]){
    const tall=s.id==='admirer';
    p('ball',s.fur,sign*.15,tall?.32:.23,-.005,.077,tall?.19:.092,.057,0,0,-sign*.17);
    p('ball',cream,sign*.15,tall?.33:.235,.038,.038,tall?.12:.048,.017,0,0,-sign*.17);
    p('ball',cream,sign*.095,.035,.135,.09,.067,.065);
    p('ball',ink,sign*.09,.09,.162,.024,.031,.019);
    p('ball','#fff0cd',sign*.086,.101,.181,.008,.009,.006);
    p('box',ink,sign*.089,.145,.153,.066,.012,.018,0,0,sign*.12);
   }
   p('ball',ink,0,.002,.219,.038,.027,.025);
   p('box',ink,0,-.048,.179,.062,.012,.013);
   if(s.hat==='cap'){p('cyl',s.coat,0,.23,0,.205,.08,.17);p('box',ink,0,.206,.165,.26,.026,.13);}
   if(s.hat==='pillbox'){p('cyl',s.coat,.045,.27,-.025,.17,.115,.14);p('ball',gold,.17,.29,.06,.04,.04,.04);}
   if(s.hat==='beret')p('ball',ink,.032,.242,-.005,.235,.063,.19,0,0,-.16);
   if(s.hat==='brim'){p('cyl',cream,0,.21,0,.27,.029,.235);p('cyl',s.coat,0,.27,0,.16,.11,.14);}
  });
  const arms=[-1,1].map(sign=>bone(g,sign<0?'left-arm':'right-arm',[sign*.235,1.035,0],p=>{
   const server=s.role==='server'&&sign<0;
   p('ball',s.coat,sign*.035,-.13,0,.072,.18,.078,0,0,sign*.14);
   p('ball',s.coat,sign*.04,server?.025:-.25,server?.15:.08,.065,.075,server?.23:.13,server?-.85:0);
   p('ball',s.fur,sign*.04,server?.20:-.26,server?.29:.19,.061,.059,.065);
   p('box',cream,sign*.04,server?.14:-.26,server?.25:.145,.12,.08,.045);
   if(server){
    // Tray sits above the visual tabletop, not inside it.
    p('cyl',gold,sign*.04,.245,.29,.30,.035,.27);
    for(const x of [-.13,.09]){p('cyl',cream,x,.29,.29,.046,.06,.046);p('cyl',cream,x,.345,.29,.019,.09,.019);p('cone','#b8ccc6',x,.415,.29,.055,.075,.055);}
   }
   if(s.role==='toast'&&sign>0){p('cyl',gold,.04,-.205,.20,.013,.10,.013);p('cone',cream,.04,-.12,.20,.057,.075,.057);}
   if(s.role==='admire'&&sign<0){p('box',cream,-.02,-.25,.20,.22,.024,.24,-.1);p('box',gold,-.02,-.235,.2,.15,.008,.16,-.1);}
  }));
  const legs=s.role==='server'?[-1,1].map(sign=>bone(g,sign<0?'left-leg':'right-leg',[sign*.115,.44,0],p=>{
   p('box',ink,0,-.18,0,.12,.36,.135);p('ball',ink,0,-.375,.055,.105,.065,.16);
  })):[];
  let camera=null,glint=null;
  if(s.role==='photo'){
   camera=bone(g,'camera',[0,.89,.32],p=>{
    p('box',ink,0,0,0,.29,.18,.13);p('box',gold,-.08,.098,0,.09,.03,.06);
    p('cyl',ink,.045,-.005,.12,.071,.13,.071,Math.PI/2);p('cyl','#779caa',.045,-.005,.194,.054,.009,.054,Math.PI/2);
    p('box',ink,0,.11,.015,.08,.044,.06);
   });
   const geo=new T.PlaneGeometry(.027,.027);geometries.add(geo);
   glint=new T.Mesh(geo,new T.MeshBasicMaterial({color:'#d9e9d9',depthWrite:false}));glint.name='lens-glint';glint.position.set(.06,.016,.201);camera.add(glint);glint.visible=false;
  }
  actors.push({s,g,body,head,arms,legs,camera,glint,glanceAt:-Infinity,glanceTarget:null,theftReaction:false});
 }
 for(const geo of Object.values(geos))geo.dispose();
 const collisions=[];
 for(let i=0;i<ROUTE.length;i++)for(const b of platforms)if(segmentHits(ROUTE[i],ROUTE[(i+1)%ROUTE.length],b))collisions.push({segment:i,box:b.id});
 for(const s of SPECS)for(const b of platforms)if(segmentHits(s,s,b))collisions.push({actor:s.id,box:b.id});
 if(collisions.length)throw new Error('Gala authored layout intersects world AABBs: '+JSON.stringify(collisions));
 let triangles=0,drawCalls=0;
 root.traverse(o=>{if(o.isMesh){drawCalls++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});
 const stats={actors:actors.length,triangles,drawCalls,positions:SPECS.map(s=>({id:s.id,x:s.x,y:0,z:s.z})),
  route:ROUTE.map(p=>({...p,y:0})),routeDuration,routeSpeed:SPEED,bodyHeight:BODY_HEIGHT,clearance:CLEARANCE,routeCollisions:collisions,
  cueRadius:3.2,cueCooldown:14,time:0,reactions:0,theftCount:0,cues:0,mood:'relaxed',snapshot:[]};
 let time=0,lastRaw=null,pauseOffset=0,wasPaused=false,stolen=false,disruptions=0,theftAt=-Infinity,serverLostTime=0,lastCue=-Infinity,phase='scout';
 const nearby=(a,p,r)=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z)&&Math.abs(p.y)<1.8&&distance(a,p)<=r;
 function pose(t){
  const theftAge=t-theftAt,stop=Number.isFinite(theftAt)?clamp(theftAge,0,2.6):0;
  const server=routeAt(t-serverLostTime-stop),quiet=stolen?.42:1;
  let reactions=0;
  for(let i=0;i<actors.length;i++){
   const a=actors[i],s=a.s,walk=s.role==='server'&&server.walking&&!(theftAge<2.6);
   a.g.position.set(s.role==='server'?server.x:s.x,0,s.role==='server'?server.z:s.z);
   a.g.rotation.set(0,s.role==='server'?server.heading:s.yaw,0);
   const cycle=(t+i*2.1)%13,breath=Math.sin(t*1.4+i)*.012*quiet;
   a.body.position.y=breath;
   a.head.rotation.set(.025*Math.sin(t*.8+i),Math.sin(t*.55+i)*.09*quiet,0);
   a.head.position.y=1.27+breath;
   a.arms.forEach((arm,j)=>arm.rotation.set(-.06+Math.sin(t*.9+i+j)*.055*quiet,0,(j?1:-1)*.10));
   for(let j=0;j<a.legs.length;j++)a.legs[j].rotation.x=walk?Math.sin(t*5.2+j*Math.PI)*.28:0;
   let gesture='listening';
   if(s.role==='server'){a.arms[0].rotation.set(0,0,0);a.arms[1].rotation.x=walk?Math.sin(t*5.2)*.16:-.16;gesture=walk?'carrying-tray':'serving';}
   if(s.role==='toast'){a.arms[1].rotation.x=-.48-bump(cycle,2,4,5.2)*.6*quiet;gesture=cycle>2&&cycle<5.2?'toasting':'chatting';}
   if(s.role==='chat'){a.arms[0].rotation.x=-.22-bump(cycle,6,8,9.3)*.5*quiet;a.head.rotation.z=Math.sin(t*1.2)*.04*quiet;gesture='chatting';}
   if(s.role==='admire'){a.head.rotation.x=-.12+Math.sin(t*.33)*.10*quiet;a.arms[0].rotation.x=-.2;a.arms[1].rotation.x=-.16-bump(cycle,4,6,7)*.55*quiet;gesture='admiring';}
   if(s.role==='look'){a.head.rotation.y=Math.sin(t*.27)*.4*quiet;gesture='looking-around';}
   if(s.role==='photo'){
    const c=(t+4)%19,raise=bump(c,9,11.8,13.3)*quiet;
    a.camera.position.set(0,.89+.43*raise,.32+.025*raise);a.camera.rotation.x=-.10*raise;
    a.arms.forEach(arm=>arm.rotation.x=-.35-.82*raise);a.head.rotation.x=.04*raise;
    a.glint.visible=!stolen&&c>11.1&&c<11.25;gesture=raise>.5?'photographing':'holding-camera';
   }
   const theftWeight=a.theftReaction?bump(theftAge,-.55,2.8,4.8):0;
   const glanceWeight=bump(t-a.glanceAt,-.55,.7,1.8);
   const target=theftWeight>0?PRIZE:glanceWeight>0?a.glanceTarget:null,weight=theftWeight||glanceWeight;
   if(target&&weight>0){
    const desired=angle(Math.atan2(target.x-a.g.position.x,target.z-a.g.position.z)-a.g.rotation.y);
    // Turn in place rather than moving into an aisle; the neck finishes the look.
    const shoulder=clamp(desired,-1.85,1.85)*weight;
    a.g.rotation.y+=shoulder;a.head.rotation.y=clamp(desired-shoulder,-1.3,1.3)*weight;
    a.head.rotation.x=theftWeight?-.25*weight:0;
    if(s.role!=='server')a.arms.forEach(arm=>arm.rotation.x*=1-weight*.75);
    if(s.id==='donor'&&theftWeight)a.arms[0].rotation.x=-1.9*weight;
    if(a.glint)a.glint.visible=false;
    gesture=theftWeight?'noticing-case':'brief-glance';reactions++;
   }
   if(s.role==='server'&&theftAge<2.6){gesture='tray-pause';a.arms[1].rotation.x=-.14;if(!weight)reactions++;}
   a.g.userData.mood=stolen?'subdued':'relaxed';a.g.userData.gesture=gesture;
  }
  stats.time=t;stats.mood=stolen?'subdued':'relaxed';stats.reactions=reactions;
  stats.snapshot=actors.map(a=>({id:a.s.id,x:a.g.position.x,y:0,z:a.g.position.z,heading:a.g.rotation.y,headYaw:a.head.rotation.y,headPitch:a.head.rotation.x,gesture:a.g.userData.gesture,mood:a.g.userData.mood,handRaised:a.s.id==='donor'&&a.arms[0].rotation.x<-1,glint:!!a.glint?.visible}));
  root.updateMatrixWorld(true);
 }
 function reset(){
  time=0;lastRaw=null;pauseOffset=0;wasPaused=false;stolen=false;disruptions=0;theftAt=-Infinity;serverLostTime=0;lastCue=-Infinity;phase='scout';
  stats.theftCount=0;stats.cues=0;
  for(const a of actors){a.glanceAt=-Infinity;a.glanceTarget=null;a.theftReaction=false;}
  pose(0);
 }
 function update(dt,state={}){
  // dt intentionally does not integrate poses: every schedule uses state.time.
  // Even callers whose clock keeps running while paused get a no-jump resume.
  const raw=Number.isFinite(state.time)?Math.max(0,state.time):(lastRaw??time);
  if(lastRaw!==null&&raw<lastRaw)reset();
  if(state.paused){pauseOffset+=Math.max(0,raw-(lastRaw??time));lastRaw=raw;wasPaused=true;return {reactions:stats.reactions};}
  if(wasPaused)pauseOffset=raw-time;
  else time=Math.max(0,raw-pauseOffset);
  lastRaw=raw;wasPaused=false;phase=state.phase||'scout';
  const p=state.player,nextStolen=!!state.stolen,nextDisruptions=Number.isFinite(state.disruptions)?Math.max(0,state.disruptions):0;
  // Position events at this frame's authored route position, not the previous frame.
  if((nextStolen&&!stolen)||nextDisruptions>disruptions)pose(time);
  if(nextStolen&&!stolen){
   if(Number.isFinite(theftAt))serverLostTime+=2.6;
   theftAt=time;stats.theftCount++;
   for(const a of actors)a.theftReaction=distance(a.g.position,PRIZE)<11||nearby(a.g.position,p,3.8);
  }
  if(nextDisruptions>disruptions){
   for(const a of actors)if(nearby(a.g.position,p,3.8)){a.glanceAt=time;a.glanceTarget={x:p.x,y:p.y,z:p.z};}
  }
  stolen=nextStolen;disruptions=nextDisruptions;pose(time);
  let cue;
  if(phase!=='complete'&&time>=4&&time-lastCue>=stats.cueCooldown){
   const a=actors.filter(a=>nearby(a.g.position,p,stats.cueRadius)).sort((a,b)=>distance(a.g.position,p)-distance(b.g.position,p))[0];
   if(a){
    let text=null;
    if(stolen&&a.theftReaction&&time-theftAt<8)text="Wasn't there something in that case?";
    else if(!stolen&&a.s.role==='server')text='Mind the glassware.';
    else if(!stolen&&['toast','chat'].includes(a.s.role))text='The exhibition looks different from the gallery.';
    else if(!stolen&&a.s.role==='admire')text='They kept the old botanical court. A lovely choice.';
    if(text){cue={speaker:a.s.role==='server'?'SERVER':a.s.role==='admire'?'ART ADMIRER':'GALA GUEST',text};lastCue=time;stats.cues++;}
   }
  }
  return cue?{cue,reactions:stats.reactions}:{reactions:stats.reactions};
 }
 reset();return {root,update,reset,stats};
}
