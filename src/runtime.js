import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {platforms,markers,securityGate,coverBlocks,RECON_POINTS,makePlayer,stepPlayer,START} from './world.js';
import {createHeist,advanceHeist,survey,pulse,nearbyAction,interact,recover,getCurator} from './heist.js';
import {movementVector,followYaw,chooseContext,findLedge} from './controls.js';
import {createVisionBuffers,updateVisionBuffers,guardVision} from './visibility.js';
import {PUBLIC_REFUGE,inPublicRefuge,curatorCue,checkpointName,surfaceForInlay} from './readability.js';
export function startHeistRuntime({T,scene,camera,renderer,occluders,hero,thief,gala,actorLighting,shadow,rings,mats,cube,ball,cyl,rod,caseGlass}){
 const $=s=>document.querySelector(s),canvas=$('#scene'),p=makePlayer();
 let h=createHeist(),checkpoint={...START},landmark=0,active=false,started=false,mantle=null,tether=null,jumpQueued=false;
 let yaw=0,pitch=.3,distance=7.6,phase=0,drag=null,elapsed=0,lastTime=performance.now(),accumulator=0,uiTimer=0;
 let moveBasisYaw=0,lastIX=0,lastIZ=0,movingAge=0,manualAge=99,manualDirty=false,travelX=0,travelZ=-1,jumpAssist=0,contextLock=null,grabCount=0;
 const smoothFocus=new T.Vector3(),cameraAim=new T.Vector3();
 let renderScale=Math.min(devicePixelRatio,1),slowSamples=0,frames=0,frameSum=0,lastFps=0,skipRender=false;
 const keys=new Set(),focus=new T.Vector3(),desired=new T.Vector3(),direction=new T.Vector3(),ray=new T.Raycaster();
 const perf={samples:0,simulation:0,presentation:0,submit:0}, map=$('#map'),ctx=map.getContext('2d');
 const markPositions=[{x:7,y:4.4,z:-2},{x:-9,y:0,z:9},{x:1,y:8.8,z:-11},{x:3,y:4.4,z:-7.9},{x:7,y:0,z:12}];
 // Actual mission props stay separate from the static museum batch.
 const prize=new T.Group();scene.add(prize);prize.position.set(3,5.95,-7.9);
 ball('gold',0,0,0,.28,.35,.22,prize);ball('gold',0,.35,.1,.18,.18,.16,prize);for(const s of [-1,1]){const w=ball('gold',s*.32,.17,0,.13,.45,.07,prize);w.rotation.z=-s*.65;}
 const gateMaterial=new T.MeshBasicMaterial({color:'#d89f73',transparent:true,opacity:.24,depthWrite:false});
 const gate=cube(gateMaterial,securityGate.x,securityGate.top-securityGate.h/2,securityGate.z,securityGate.w,securityGate.h,securityGate.d);gate.userData.collider=securityGate;occluders.push(gate);
 const displayStatus=cube(new T.MeshBasicMaterial({color:'#86bdb2'}),3,5.55,-7.12,1.2,.045,.035);
 const gateLines=[];for(let x=1;x<=5;x+=.5)gateLines.push(rod([x,4.4,-10.42],[x,6.7,-10.42],.02,'gold'));
 const curator=new T.Group();scene.add(curator);curator.position.set(-9,0,9);curator.rotation.y=Math.PI/2;
 cyl('wine',0,.66,0,.24,1,curator);
 const curatorHead=new T.Group();curatorHead.position.set(0,1.25,0);curator.add(curatorHead);
 ball('fur',0,.10,0,.22,.25,.2,curatorHead);ball('fur',-.14,.27,0,.09,.1,.06,curatorHead);ball('fur',.14,.27,0,.09,.1,.06,curatorHead);ball('cream',0,.04,.16,.14,.08,.10,curatorHead);
 const catalogue=new T.Group();catalogue.position.set(0,.96,.27);curator.add(catalogue);cube('verdigris',0,0,0,.48,.075,.36,catalogue);cube('cream',0,.045,0,.43,.015,.30,catalogue);cube('brass',0,.06,0,.02,.018,.31,catalogue);
 const accessCard=cube('gold',-.28,.68,-.07,.06,.2,.15,curator);
 for(const x of [-.14,.14]){cube('navy',x,.14,0,.13,.28,.17,curator);rod([x*1.8,1.1,0],[x*1.2,.97,.28],.06,'wine',curator);}
 const curatorFlag=new T.Mesh(new T.RingGeometry(.38,.43,24),new T.MeshBasicMaterial({color:'#9dcbb5',side:T.DoubleSide,transparent:true,opacity:.7}));curatorFlag.rotation.x=-Math.PI/2;curatorFlag.position.set(-9,.035,9);scene.add(curatorFlag);
 // The inlay follows the actual circular refuge predicate and only rests on floor.
 const refugePositions=[];const rr=PUBLIC_REFUGE.radius;
 for(let i=0;i<80;i++){const a=i/80*Math.PI*2,b=(i+1)/80*Math.PI*2,mid=(a+b)/2,x=PUBLIC_REFUGE.x+Math.sin(mid)*rr,z=PUBLIC_REFUGE.z+Math.cos(mid)*rr;if(Math.abs((surfaceForInlay(platforms,x,z,4.4)??-1)-4.4)>.01)continue;
  const v=(angle,r)=>[PUBLIC_REFUGE.x+Math.sin(angle)*r,4.429,PUBLIC_REFUGE.z+Math.cos(angle)*r];refugePositions.push(...v(a,rr-.035),...v(a,rr),...v(b,rr),...v(a,rr-.035),...v(b,rr),...v(b,rr-.035));}
 const refugeGeo=new T.BufferGeometry();refugeGeo.setAttribute('position',new T.Float32BufferAttribute(refugePositions,3));
 const refugeInlay=new T.Mesh(refugeGeo,new T.MeshBasicMaterial({color:'#cfb783',side:T.DoubleSide}));scene.add(refugeInlay);
 const anchor=new T.Group();scene.add(anchor);anchor.position.set(1,8.8,-11);cyl('brass',0,.18,0,.5,.35,anchor);rod([0,.3,0],[0,1.15,0],.08,'brass',anchor);const anchorTop=ball('gold',0,1.15,0,.2,.2,.2,anchor);
 const tetherLineGeo=new T.BufferGeometry().setFromPoints([new T.Vector3(1,9.9,-11),new T.Vector3(3,5.8,-6.3)]),tetherLine=new T.Line(tetherLineGeo,new T.LineBasicMaterial({color:'#b7d6bf',transparent:true,opacity:.6}));scene.add(tetherLine);
 const pulseRing=new T.Mesh(new T.RingGeometry(.94,1,48),new T.MeshBasicMaterial({color:'#95d6cc',transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false}));pulseRing.rotation.x=-Math.PI/2;scene.add(pulseRing);let pulseAge=2;
 // The extraction marker lights only after the prize is secured.
 const exitRing=new T.Mesh(new T.TorusGeometry(.9,.06,5,32),new T.MeshBasicMaterial({color:'#8ed1b0'}));exitRing.rotation.x=-Math.PI/2;exitRing.position.set(7,.07,12);scene.add(exitRing);
 const exitInlays=[[3,-3],[3,1],[10,3],[10,6],[10,9],[10,12]].map(([x,z])=>cyl(new T.MeshBasicMaterial({color:'#8ed1b0'}),x,.04,z,.14,.04));
 for(const [x,z]of [[6,12],[8,12]]){rod([x,0,z],[x,2.4,z],.045,'brass');}rod([6,2.4,12],[8,2.4,12],.045,'brass');
 function batchDirect(group,exclude=null){group.updateMatrixWorld(true);const batches=new Map();for(const o of [...group.children]){if(!o.isMesh||o===exclude)continue;const key=o.material.uuid;if(!batches.has(key))batches.set(key,{material:o.material,parts:[]});batches.get(key).parts.push(o.geometry.clone().applyMatrix4(o.matrix));group.remove(o);}for(const b of batches.values()){group.add(new T.Mesh(mergeGeometries(b.parts,false),b.material));for(const p of b.parts)p.dispose();}}
 batchDirect(curator,accessCard);batchDirect(curatorHead);batchDirect(catalogue);
 const guardViews=h.guards.map(()=>{
  const g=new T.Group();scene.add(g);cyl('navy',0,.7,0,.26,1,g);ball('fur',0,1.37,0,.23,.24,.22,g);cube('navy',0,1.58,0,.55,.13,.5,g);const visor=cube(new T.MeshBasicMaterial({color:'#a4d5c1'}),0,1.4,.225,.35,.095,.04,g);
  const limbs={legs:[],arms:[]};
  for(const x of [-.15,.15]){const leg=new T.Group();leg.position.set(x,.47,0);g.add(leg);cyl('navy',0,-.19,0,.09,.38,leg);cube('nose',0,-.41,.06,.15,.13,.23,leg);limbs.legs.push(leg);
   const arm=new T.Group();arm.position.set(x*1.8,1.08,0);g.add(arm);rod([0,0,0],[0,-.46,.04],.065,'navy',arm);ball('nose',0,-.48,.04,.075,.08,.07,arm);limbs.arms.push(arm);}
  const buffers=createVisionBuffers();
  function footprint(positions,indices,opacity){const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));geo.setIndex(new T.BufferAttribute(indices,1));geo.boundingSphere=new T.Sphere(new T.Vector3(),7.1);const mesh=new T.Mesh(geo,new T.MeshBasicMaterial({color:'#dfb26a',transparent:true,opacity,side:T.DoubleSide,depthWrite:false}));scene.add(mesh);return mesh;}
  const cone=footprint(buffers.conePositions,buffers.coneIndices,.12),near=footprint(buffers.closePositions,buffers.closeIndices,.09);
  const bar=new T.Mesh(new T.PlaneGeometry(.65,.075),new T.MeshBasicMaterial({color:'#f0b865',side:T.DoubleSide,depthTest:false}));scene.add(bar);
  batchDirect(g,visor);return {g,cone,near,bar,visor,buffers,limbs,stamp:''};
 });
 // Simple synth cues are generated locally; sound starts only after user interaction.
 let audio=null,sound=true,lastMissionCue=-100,lastStepAt=-100,heroAnimation='idle',winPoseTime=0;
 function stepCue(landing=false){if(!sound||h.time-lastStepAt<.12)return;lastStepAt=h.time;try{audio??=new (window.AudioContext||window.webkitAudioContext)();const osc=audio.createOscillator(),gain=audio.createGain();osc.type='triangle';osc.frequency.setValueAtTime(p.y>6?145:95,audio.currentTime);osc.frequency.exponentialRampToValueAtTime(42,audio.currentTime+.07);gain.gain.setValueAtTime(landing?.045:.018,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.09);osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(audio.currentTime+.1);}catch{}}
 function cue(freq=440){if(!sound)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume();const o=audio.createOscillator(),gain=audio.createGain();o.type='sine';o.frequency.value=freq;gain.gain.setValueAtTime(.055,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.18);o.connect(gain);gain.connect(audio.destination);o.start();o.stop(audio.currentTime+.2);}catch{}}
 function toast(text,speaker='LOOKOUT'){lastMissionCue=h.time;$('#crewSpeaker').textContent=speaker;$('#crewText').textContent=text;$('#crew').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#crew').classList.remove('show'),7000);}
 function clearInput(){keys.clear();jumpQueued=false;drag=null;contextLock=null;jumpAssist=0;lastIX=lastIZ=0;movingAge=0;h.holdProgress=0;h.holdId=null;}
 function placeAt(point){Object.assign(p,point,{vx:0,vy:0,vz:0,grounded:false,coyote:0,jumpBuffer:0});mantle=null;tether=null;clearInput();moveBasisYaw=yaw;manualAge=99;manualDirty=false;smoothFocus.set(p.x,p.y+1,p.z);snapCamera();}
 function resetCheckpoint(){if(h.phase==='complete')return;recover(h);placeAt(checkpoint);toast(`Back at the ${checkpointName(checkpoint)}. Prep and prize kept; scrambler ready. Four seconds to regroup.`);}
 function restart(){h=createHeist();thief.reset();gala.reset();winPoseTime=0;lastMissionCue=-100;lastStepAt=-100;checkpoint={...START};landmark=0;elapsed=0;yaw=0;pitch=.3;distance=7.6;grabCount=0;securityGate.disabled=false;placeAt(START);$('#complete').hidden=true;$('#caught').hidden=true;updateUI();}
 function begin(){if(sound){try{audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume();}catch{}}active=true;started=true;for(const id of ['intro','pause','complete','caught'])$('#'+id).hidden=true;canvas.focus();lastTime=performance.now();accumulator=0;if(h.phase==='scout')toast('Our client wants one thing: the bird in the far display. Look like you belong until it is time not to.');}
 function pause(){active=false;clearInput();$('#pause').hidden=false;}
 function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
 addEventListener('resize',resize);resize();
 function cameraTarget(){focus.set(p.x,p.y+1,p.z);desired.set(p.x+Math.sin(yaw)*distance*Math.cos(pitch),smoothFocus.y+Math.sin(pitch)*distance,p.z+Math.cos(yaw)*distance*Math.cos(pitch));direction.copy(desired).sub(focus).normalize();ray.set(focus,direction);ray.far=focus.distanceTo(desired);const blockers=occluders.filter(o=>!o.userData.collider?.disabled);const hits=ray.intersectObjects(blockers,false);if(hits.length)desired.copy(focus).addScaledVector(direction,Math.max(.5,hits[0].distance-.22));return hits.length>0;}
 function snapCamera(){smoothFocus.set(p.x,p.y+1,p.z);cameraTarget();camera.position.copy(desired);camera.lookAt(smoothFocus);}
 function recenter(){yaw=Math.atan2(travelX,travelZ)+Math.PI;pitch=.3;distance=7.6;manualAge=0;manualDirty=true;snapCamera();}
 function currentDirection(){const ix=Number(keys.has('KeyD'))-Number(keys.has('KeyA')),iz=Number(keys.has('KeyS'))-Number(keys.has('KeyW'));if(ix||iz)return movementVector(ix,iz,manualDirty?yaw:moveBasisYaw);return {x:Math.sin(hero.rotation.y),z:Math.cos(hero.rotation.y)};}
 function mantleCandidate(airborne=false){if(mantle||tether||(!airborne&&!p.grounded))return null;const v=currentDirection();return findLedge(p,v.x,v.z,platforms,{airborne});}
 function beginMantle(target){mantle={from:new T.Vector3(p.x,p.y,p.z),to:new T.Vector3(target.x,target.y,target.z),t:0};p.vx=p.vy=p.vz=0;p.grounded=false;p.coyote=0;p.jumpBuffer=0;jumpQueued=false;jumpAssist=0;grabCount++;}
 function contextCandidate(){return chooseContext(nearbyAction(h,p),tetherCandidate());}
 function tetherCandidate(){if(mantle||tether||!p.grounded||h.phase==='scout'||h.phase==='complete')return null;
  if(Math.abs(p.y-8.8)<.5&&Math.hypot(p.x-1,p.z+11)<2)return {label:'Descend to the prize gallery',to:{x:3,y:4.4,z:-6.3},down:true};
  if(h.anchor&&Math.abs(p.y-4.4)<.6&&Math.hypot(p.x-3,p.z+7.9)<2.5)return {label:'Return to the roof anchor',to:{x:1,y:8.8,z:-11},down:false};return null;}
 function startTether(){const target=tetherCandidate();if(!target)return;tether={from:{x:p.x,y:p.y,z:p.z},...target,t:0};if(target.down&&!h.stolen)h.approach='roof';clearInput();cue(650);}
 function onPublicTerrace(){return inPublicRefuge(h,p);}
 function usePulse(){if(pulse(h,p)){pulseAge=0;pulseRing.position.set(p.x,p.y+.08,p.z);cue(320);}else if(h.cooldown>0)toast(`Scrambler recharging: ${Math.ceil(h.cooldown)} seconds.`,'ENGINEER');}
 const handled=['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','ShiftRight','KeyE','KeyR','KeyC','KeyQ','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Escape'];
 addEventListener('keydown',e=>{if(!handled.includes(e.code)||e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return;e.preventDefault();if(e.code==='Escape'){if(!$('#caught').hidden||!$('#complete').hidden)return;active?pause():started&&begin();return;}if(!active)return;keys.add(e.code);
  if(e.code==='Space'&&!e.repeat){const target=mantleCandidate();if(target)beginMantle(target);else{jumpQueued=true;jumpAssist=1.15;}}
  if(e.code==='KeyR'&&!e.repeat)resetCheckpoint();if(e.code==='KeyC'&&!e.repeat)recenter();if(e.code==='KeyQ'&&!e.repeat)usePulse();
  if(e.code==='KeyE'&&!e.repeat){const c=contextCandidate();contextLock=c?.id||null;if(c?.kind==='tether')startTether();}
 });
 addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='KeyE'){contextLock=null;h.holdProgress=0;h.holdId=null;}});addEventListener('blur',()=>{clearInput();if(active)pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&active)pause();});
 canvas.addEventListener('pointerdown',e=>{if(!active)return;drag={x:e.clientX,y:e.clientY};manualAge=0;canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(!drag)return;yaw-=(e.clientX-drag.x)*.005;pitch=Math.max(.15,Math.min(1.1,pitch+(e.clientY-drag.y)*.0035));manualAge=0;manualDirty=true;drag={x:e.clientX,y:e.clientY};});canvas.addEventListener('pointerup',()=>{drag=null;manualAge=0;});canvas.addEventListener('pointercancel',()=>drag=null);canvas.addEventListener('wheel',e=>{e.preventDefault();distance=Math.max(3.5,Math.min(12,distance+e.deltaY*.008));manualAge=0;},{passive:false});canvas.addEventListener('contextmenu',e=>e.preventDefault());
 $('#start').onclick=begin;$('#resume').onclick=begin;$('#pauseBtn').onclick=pause;$('#restartBtn').onclick=()=>{restart();begin();};$('#retry').onclick=()=>{restart();begin();};$('#caughtRetry').onclick=()=>{resetCheckpoint();begin();};$('#resetBtn').onclick=resetCheckpoint;$('#recenter').onclick=recenter;
 $('#contrast').onchange=e=>renderer.toneMappingExposure=e.target.checked?1.75:1.35;$('#sound').onchange=e=>{sound=e.target.checked;cue(560);};
 $('#quality').onchange=e=>{renderScale=e.target.value==='low'?.5:Math.min(devicePixelRatio,1);renderer.setPixelRatio(renderScale);resize();slowSamples=0;};
 function missionEvents(){let e;while(e=h.events.shift()){
  if(e.type==='caught'){active=false;clearInput();$('#caught').hidden=false;$('#caughtDetail').textContent=`Return to the ${checkpointName(checkpoint)}. ${h.stolen?'Bird and preparation kept.':'Completed preparation kept.'} Scrambler ready; four seconds to regroup.`;cue(160);}
  else if(e.type==='theft'){winPoseTime=0;checkpoint=h.anchor?{x:1,y:8.8,z:-11}:{x:14,y:4.4,z:10};cue(740);toast(h.anchor?'In the bag. Easy now. The roof tether is ready; leave before the room catches up.':'In the bag. The display sensor has tripped. Take the side aisle and keep moving.');}
  else if(e.type==='complete'){active=false;clearInput();$('#complete').hidden=false;$('#resultTime').textContent=`${Math.floor(elapsed/60)}:${String(Math.floor(elapsed%60)).padStart(2,'0')}`;$('#resultCatches').textContent=h.catches;$('#resultPrep').textContent=Number(h.relay)+Number(h.anchor)+'/2';$('#resultRoute').textContent=`${h.approach==='roof'?'Roof descent':'Gallery approach'} · ${h.exit==='roof'?'Roof extraction':'Gala exit'} · ${h.disruptions} visor disruptions`;$('#resultTitle').textContent=h.catches?'A getaway worth keeping.':'Without a trace.';cue(1040);}
  else if(e.type==='survey'){toast('Routes scouted. The brass circle is a public refuge; beyond it, patrols become active after your four-second grace period.');cue(660);}
  else if(e.type!=='recovered'){toast(e.text,e.type==='pulse'||e.type==='relay'?'ENGINEER':'LOOKOUT');cue(e.type==='survey'?660:490);}
 }}
 function tick(dt){if(!active)return;elapsed+=dt;
  manualAge+=dt;jumpAssist=Math.max(0,jumpAssist-dt);
  const orbiting=keys.has('ArrowLeft')||keys.has('ArrowRight')||keys.has('ArrowUp')||keys.has('ArrowDown');
  if(keys.has('ArrowLeft'))yaw+=dt*1.5;if(keys.has('ArrowRight'))yaw-=dt*1.5;if(keys.has('ArrowUp'))pitch=Math.min(1.1,pitch+dt);if(keys.has('ArrowDown'))pitch=Math.max(.15,pitch-dt);
  if(orbiting||drag){manualAge=0;manualDirty=true;}
  const ix=Number(keys.has('KeyD'))-Number(keys.has('KeyA')),iz=Number(keys.has('KeyS'))-Number(keys.has('KeyW')),moving=!!(ix||iz),slow=keys.has('ShiftLeft')||keys.has('ShiftRight');
  if(manualDirty||((ix!==lastIX||iz!==lastIZ)&&p.grounded))moveBasisYaw=yaw;
  lastIX=ix;lastIZ=iz;manualDirty=false;movingAge=moving?movingAge+dt:0;
  const drive=movementVector(ix,iz,moveBasisYaw);if(moving){travelX=drive.x;travelZ=drive.z;}
  // A held key chord keeps its world heading while the camera catches up. This
  // avoids the runaway orbit caused by feeding follow-yaw back into steering.
  yaw=followYaw(yaw,drive.x,drive.z,dt,{enabled:$('#autoCamera').checked,grounded:p.grounded,manualAge,movingAge,slow,backward:iz>0,busy:!!mantle||!!tether||!!contextLock});
  if(tether){tether.t+=dt;const t=Math.min(1,tether.t/1.15),e=t*t*(3-2*t);p.x=T.MathUtils.lerp(tether.from.x,tether.to.x,e);p.y=T.MathUtils.lerp(tether.from.y,tether.to.y,e)+Math.sin(t*Math.PI)*.65;p.z=T.MathUtils.lerp(tether.from.z,tether.to.z,e);p.vx=p.vy=p.vz=0;if(t===1){tether=null;p.grounded=true;}}
  else if(mantle){mantle.t+=dt;const t=Math.min(1,mantle.t/.28),v=Math.min(1,t/.55),u=Math.max(0,(t-.4)/.6),ve=v*v*(3-2*v),ue=u*u*(3-2*u);p.x=T.MathUtils.lerp(mantle.from.x,mantle.to.x,ue);p.y=T.MathUtils.lerp(mantle.from.y,mantle.to.y,ve)+Math.sin(t*Math.PI)*.035;p.z=T.MathUtils.lerp(mantle.from.z,mantle.to.z,ue);p.vx=p.vy=p.vz=0;if(t===1){mantle=null;p.grounded=true;}}
  else{stepPlayer(p,drive.x,drive.z,dt,jumpQueued,slow);jumpQueued=false;if(!p.grounded&&jumpAssist>0){const target=findLedge(p,moving?drive.x:travelX,moving?drive.z:travelZ,platforms,{airborne:true});if(target)beginMantle(target);}}
  if(p.y<-4)resetCheckpoint();
  if(h.phase==='scout'){const spot=RECON_POINTS.find(m=>Math.hypot(p.x-m.x,p.z-m.z)<1.4&&Math.abs(p.y-m.y)<.4&&p.grounded);if(spot){checkpoint={...spot};landmark=1;survey(h);}}
  if(h.phase!=='scout'&&landmark<3){const m=markers[landmark];if(Math.hypot(p.x-m.x,p.z-m.z)<1.15&&Math.abs(p.y-m.y)<.3&&p.grounded){checkpoint={x:m.x,y:m.y,z:m.z};landmark++;toast('Safe point marked. R returns you here.');}}
  securityGate.disabled=h.relay||h.jam>0;
  advanceHeist(h,dt,p,{slow:keys.has('ShiftLeft')||keys.has('ShiftRight'),blocks:platforms,pauseDetection:!!tether||onPublicTerrace()});
  const context=contextCandidate();if(!h.events.some(e=>e.type==='caught'))interact(h,p,dt,keys.has('KeyE')&&context?.kind==='action'&&context.id===contextLock&&!tether&&!mantle);
  securityGate.disabled=h.relay||h.jam>0;missionEvents();
 }
 let lastUI='';
 function updateUI(){
  const candidate=contextCandidate(),context=candidate?.action?.id==='exit-front'&&h.phase!=='escape'?null:candidate,action=context?.kind==='action'?context.action:null,t=context?.kind==='tether'?context.tether:null,maxSus=Math.max(0,...h.guards.map(g=>g.suspicion));
  const headings={scout:['01 / RECONNAISSANCE','Survey the collection','Choose: broad stairs to the inner gallery, or service access on the far left. Both let you scout safely.'],prep:['02 / THE SETUP','The bird is the job',h.relay?'Access card secured. Use the screened inner arcade or the service roof route; hold E at the prize.':'Optional: lift the curator’s card while they read. Screens hide the inner arcade; service stairs give a separate roof approach.'],escape:['03 / EXTRACTION','Time to leave',h.anchor?'Tap E near the prize to return to the roof; release, then hold E at the anchor. The gala exit also works.':'Follow green inlays through the aisle beside the staircase; hold E at the gala exit. Its guard is now active.'],complete:['JOB COMPLETE','The collection is one bird lighter','Restart for a different approach.']};
  const [stage,title,hint]=headings[h.phase],stamp=[stage,title,hint,h.relay,h.anchor,h.phase,landmark].join('|');if(stamp!==lastUI){lastUI=stamp;$('#stage').textContent=stage;$('#objective').textContent=title;$('#hint').textContent=hint;$('#prepRelay').textContent=h.relay?'DONE · Curator access card':'OPTIONAL · Pickpocket curator / gala';$('#prepAnchor').textContent=h.anchor?'DONE · Roof return tether':'OPTIONAL · Return tether / roof';$('#prepRelay').classList.toggle('checked',h.relay);$('#prepAnchor').classList.toggle('checked',h.anchor);$('#progress').style.width=({scout:8,prep:35,escape:75,complete:100}[h.phase])+'%';}
  $('#scrambler').textContent=h.phase==='scout'?'Available after recon':h.cooldown>0?`Recharging ${Math.ceil(h.cooldown)}s`:'Ready · Q';$('#jamStatus').textContent=h.jam>0?`Case bypass ${Math.ceil(h.jam)}s`:h.relay?'Card authorizes the case':'8s case / brief visor fault → search';
  $('#suspicionFill').style.width=maxSus+'%';$('#suspicion').classList.toggle('alert',maxSus>65);$('#suspicionLabel').textContent=h.shield>0?`REGROUPING · ${Math.ceil(h.shield)}s`:onPublicTerrace()?'PUBLIC REFUGE':maxSus>65?'IDENTIFYING YOU':maxSus>5?'SUSPICIOUS':h.guards.some(g=>g.reactingFor>0)?'SECURITY CHECKING FAULT':'UNSEEN';
  const curatorNear=!h.relay&&Math.abs(p.y)<.65&&Math.hypot(p.x+9,p.z-9)<3.8,cueState=curatorCue(h);
  $('#interaction').hidden=!active||(!context&&!mantleCandidate()&&!curatorNear);
  if(action){$('#actionText').textContent=action.blocked||`Hold E · ${action.label}`;$('#actionProgress').style.width=(action.blocked?0:h.holdProgress/action.duration*100)+'%';$('#actionSub').textContent=contextLock&&contextLock!==context.id?'Release E, then press again for this action.':action.id==='relay'?`${cueState.label} · ${cueState.remaining.toFixed(1)}s`:'';}
  else if(t){$('#actionText').textContent='E · '+t.label;$('#actionProgress').style.width='0%';$('#actionSub').textContent='One press · contextual tether';}
  else if(curatorNear){$('#actionText').textContent=cueState.label;$('#actionProgress').style.width='0%';$('#actionSub').textContent=cueState.reading?'Circle behind the catalogue reader, then hold E.':'Wait here; the curator stays in this spot.';}
  else{$('#actionText').textContent='SPACE · Climb this ledge';$('#actionSub').textContent='Jump toward a reachable edge to grab it automatically.';$('#actionProgress').style.width='0%';}
  $('#height').textContent=p.y.toFixed(1)+' m';
 }
 function drawMap(){ctx.fillStyle='#142a32';ctx.fillRect(0,0,170,148);const sx=x=>85+x*4,sz=z=>74+z*4;
  for(const b of platforms){if(b.disabled)continue;ctx.fillStyle=b===securityGate?'#d29468':b.top<1?'#284049':b.top<5?'#68726a':'#b29b71';ctx.fillRect(sx(b.x-b.w/2),sz(b.z-b.d/2),b.w*4,b.d*4);}
  const points=h.phase==='scout'?RECON_POINTS.map(m=>({...m,color:'#edc57a'})):h.phase==='escape'?[{...markPositions[4],color:'#8fd9b4'},...(h.anchor?[{...markPositions[2],color:'#8fd9b4'}]:[])]:[{...markPositions[3],color:'#edc57a'},...(!h.relay?[{...markPositions[1],color:'#a5c9d3'}]:[]),...(!h.anchor?[{...markPositions[2],color:'#a5c9d3'}]:[])];
  for(const m of points){ctx.beginPath();ctx.arc(sx(m.x),sz(m.z),4,0,Math.PI*2);ctx.fillStyle=m.color;ctx.fill();}
  for(const g of h.guards){if(!g.active)continue;ctx.fillStyle=g.disabledFor>0?'#7695a3':'#d88872';ctx.beginPath();ctx.arc(sx(g.x),sz(g.z),2.4,0,Math.PI*2);ctx.fill();ctx.strokeStyle=ctx.fillStyle;ctx.beginPath();ctx.moveTo(sx(g.x),sz(g.z));ctx.lineTo(sx(g.x)+Math.sin(g.heading)*7,sz(g.z)+Math.cos(g.heading)*7);ctx.stroke();}
  ctx.fillStyle='#fff4d8';ctx.beginPath();ctx.arc(sx(p.x),sz(p.z),3,0,Math.PI*2);ctx.fill();}
 let visionAge=.2,lastCuratorMood=true;
 function present(dt,now){hero.position.set(p.x,p.y,p.z);const speed=Math.hypot(p.vx,p.vz);let turnRate=0;
  if(speed>.2){const a=Math.atan2(p.vx,p.vz),delta=Math.atan2(Math.sin(a-hero.rotation.y),Math.cos(a-hero.rotation.y)),step=delta*Math.min(1,dt*14);hero.rotation.y+=step;turnRate=step/Math.max(.001,dt);}
  const currentAction=nearbyAction(h,p),interacting=!!h.holdId&&h.holdProgress>0;
  if(interacting&&currentAction){const a=Math.atan2(currentAction.position.x-p.x,currentAction.position.z-p.z);hero.rotation.y+=Math.atan2(Math.sin(a-hero.rotation.y),Math.cos(a-hero.rotation.y))*Math.min(1,dt*10);}
  if(h.phase==='complete')winPoseTime+=dt;
  const anim=thief.update(dt,{speed,turnRate,grounded:p.grounded,vy:p.vy,slow:keys.has('ShiftLeft')||keys.has('ShiftRight'),mantleProgress:mantle?Math.min(1,mantle.t/.28):null,tetherProgress:tether?Math.min(1,tether.t/1.15):null,interactionId:interacting?h.holdId:null,interactionProgress:interacting&&currentAction?h.holdProgress/currentAction.duration:0,loot:h.stolen,alert:Math.max(0,...h.guards.map(g=>g.suspicion)),won:h.phase==='complete',paused:!active&&!(h.phase==='complete'&&winPoseTime<1.8)});
  heroAnimation=anim.state;if(active&&(anim.footstep||anim.landed))stepCue(anim.landed);
  const social=gala.update(dt,{time:h.time,phase:h.phase,player:{x:p.x,y:p.y,z:p.z},stolen:h.stolen,disruptions:h.disruptions,paused:!active});
  if(social.cue&&active&&h.time-lastMissionCue>9&&!h.holdId){toast(social.cue.text,social.cue.speaker);}
  actorLighting.update({stolen:h.stolen,time:h.time});
  let support=0;for(const b of platforms)if(!b.disabled&&Math.abs(p.x-b.x)<b.w/2&&Math.abs(p.z-b.z)<b.d/2&&b.top<=p.y+.05)support=Math.max(support,b.top);shadow.position.set(p.x,support+.025,p.z);
  smoothFocus.x=p.x;smoothFocus.z=p.z;smoothFocus.y=T.MathUtils.lerp(smoothFocus.y,p.y+1,1-Math.exp(-10*dt));const obstructed=cameraTarget();if(obstructed&&camera.position.distanceTo(focus)>desired.distanceTo(focus))camera.position.copy(desired);else camera.position.lerp(desired,1-Math.exp(-14*dt));cameraAim.copy(smoothFocus).add(new T.Vector3(travelX*.2,0,travelZ*.2));camera.lookAt(cameraAim);hero.visible=camera.position.distanceTo(focus)>1.15;
  prize.visible=!h.stolen;prize.rotation.y=.25;displayStatus.material.color.set(h.stolen?'#d9a36e':h.relay||h.jam>0?'#a2c3a5':'#86bdb2');gate.visible=!securityGate.disabled;for(const line of gateLines)line.visible=!securityGate.disabled;
  const c=getCurator(h),cc=curatorCue(h);curator.rotation.y=Math.PI/2;curatorHead.rotation.y=T.MathUtils.lerp(curatorHead.rotation.y,c.distracted?0:-2.5,1-Math.exp(-12*dt));curatorHead.rotation.x=T.MathUtils.lerp(curatorHead.rotation.x,c.distracted?.18:-.06,1-Math.exp(-10*dt));catalogue.rotation.x=T.MathUtils.lerp(catalogue.rotation.x,c.distracted?-.12:.6,1-Math.exp(-10*dt));accessCard.visible=!h.relay;curatorFlag.visible=!h.relay;curatorFlag.material.color.set(cc.warning?'#d0b376':c.distracted?'#9dcbb5':'#d3a174');if(c.distracted!==lastCuratorMood){if(active&&Math.hypot(p.x+9,p.z-9)<4)cue(c.distracted?540:360);lastCuratorMood=c.distracted;}refugeInlay.material.color.set(h.phase==='escape'?'#6b6556':'#cfb783');anchorTop.material=mats[h.anchor?'green':'gold'];tetherLine.visible=h.anchor||!!tether;exitRing.visible=h.phase==='escape';for(const inlay of exitInlays)inlay.visible=h.phase==='escape';
  rings[0].position.set(7,4.5,-2);rings[0].visible=h.phase==='scout';rings[1].visible=h.phase!=='complete'&&!h.stolen&&landmark<2;rings[1].material.color.set('#8baea0');rings[2].visible=h.phase!=='complete';rings[2].material.color.set(h.anchor?'#8dcfb0':'#e9bc69');
  visionAge+=dt;const updateFootprints=visionAge>=.1;if(updateFootprints)visionAge=0;
  const sightOptions={slow:keys.has('ShiftLeft')||keys.has('ShiftRight'),suppressed:!!tether||onPublicTerrace()};
  h.guards.forEach((g,i)=>{const v=guardViews[i],vision=guardVision(h,g,sightOptions),stamp=[vision.enabled,vision.range,securityGate.disabled].join('|');
   v.g.visible=g.active;v.g.position.set(g.x,g.y,g.z);v.g.rotation.y=g.heading;const stride=g.disabledFor>0||!active?0:Math.sin(h.time*4.4+i)*.28;v.limbs.legs[0].rotation.x=stride;v.limbs.legs[1].rotation.x=-stride;v.limbs.arms[0].rotation.x=g.disabledFor>0?-2.25:-stride*.7;v.limbs.arms[1].rotation.x=h.alarm&&h.time%8<1.6?-1.8:stride*.7;
   v.visor.material.color.set(g.disabledFor>0?'#829aa0':g.suspicion>65?'#ed8070':g.reactingFor>0?'#e4b36e':'#a4d5c1');
   if(updateFootprints||v.stamp!==stamp){updateVisionBuffers(v.buffers,h,g,platforms,sightOptions);v.cone.geometry.attributes.position.needsUpdate=true;v.near.geometry.attributes.position.needsUpdate=true;v.stamp=stamp;}
   v.cone.visible=v.near.visible=vision.enabled;
   for(const f of [v.cone,v.near]){f.position.set(g.x,g.y+.037,g.z);f.rotation.y=g.heading;f.material.color.set(g.suspicion>65?'#e88370':g.reactingFor>0?'#e7a26b':'#dfb26a');}
   v.bar.visible=g.active&&g.suspicion>2;v.bar.position.set(g.x,g.y+1.98,g.z);v.bar.quaternion.copy(camera.quaternion);v.bar.scale.x=g.suspicion/100;
  });
  pulseAge+=active?dt:0;pulseRing.material.opacity=Math.max(0,.65-pulseAge*.8);pulseRing.scale.setScalar(1+pulseAge*10);pulseRing.visible=pulseAge<.82;
 }
 function frame(now){requestAnimationFrame(frame);const raw=Math.max(.001,(now-lastTime)/1000),dt=Math.min(.1,raw);lastTime=now;let t=performance.now();accumulator+=dt;while(accumulator>=1/120){tick(1/120);accumulator-=1/120;}perf.simulation+=performance.now()-t;t=performance.now();present(dt,now);perf.presentation+=performance.now()-t;
  uiTimer+=raw;if(uiTimer>.08){updateUI();drawMap();uiTimer=0;}t=performance.now();if(!skipRender)renderer.render(scene,camera);perf.submit+=performance.now()-t;perf.samples++;frames++;frameSum+=raw;
  if(frameSum>.8){lastFps=Math.round(frames/frameSum);$('#fps').textContent=lastFps+' fps';if($('#quality').value==='auto'){slowSamples=lastFps<28?slowSamples+1:0;if(slowSamples>=3&&renderScale>.5){renderScale=Math.max(.5,renderScale*.75);renderer.setPixelRatio(renderScale);resize();slowSamples=0;}}frames=0;frameSum=0;}}
 Object.defineProperty(window,'museumState',{get:()=>({position:{x:p.x,y:p.y,z:p.z},velocity:{x:p.vx,y:p.vy,z:p.vz},grounded:p.grounded,stage:landmark,done:h.phase==='complete',active,yaw,pitch,elapsed,fps:lastFps,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,renderScale,mantle:!!mantle,tether:!!tether,controls:{moveBasisYaw,manualAge,movingAge,travelX,travelZ,grabCount,context:contextCandidate()?.id||null,autoCamera:$('#autoCamera').checked},build:'gala-06',hero:{state:heroAnimation,stats:thief.stats},gala:{stats:{actors:gala.stats.actors,triangles:gala.stats.triangles,drawCalls:gala.stats.drawCalls},snapshot:gala.stats.snapshot},presentation:{refuge:onPublicTerrace(),checkpointName:checkpointName(checkpoint),curatorCue:curatorCue(h),vision:guardViews.map(v=>({...v.buffers.vision})),ambientGuests:gala.stats.positions.length},curator:getCurator(h),mission:JSON.parse(JSON.stringify({...h,events:[]})),checkpoint:{...checkpoint},profile:{simulationMs:perf.simulation/Math.max(1,perf.samples),presentationMs:perf.presentation/Math.max(1,perf.samples),renderSubmitMs:perf.submit/Math.max(1,perf.samples)}})});
 window.profileMuseum=async(mode='normal',ms=3000)=>{skipRender=mode==='no-render';const t=performance.now(),n=perf.samples;await new Promise(r=>setTimeout(r,Math.min(6000,Math.max(1000,ms))));const result={mode,frames:perf.samples-n,seconds:(performance.now()-t)/1000,fps:(perf.samples-n)/((performance.now()-t)/1000),state:window.museumState.profile};skipRender=false;return result;};
 updateUI();snapCamera();requestAnimationFrame(frame);$('#bootError').textContent='';$('#start').disabled=false;
}
