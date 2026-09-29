import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {platforms,markers,securityGate} from './world.js';
import {startHeistRuntime} from './runtime.js';
import {applyMuseumFinishings} from './finishings.js';
import {STATIC_GUESTS} from './readability.js';
import {createThief} from './thief.js';
import {createGala} from './gala.js';
import {staticIrradiance,createActorLighting} from './lighting.js';
const $=s=>document.querySelector(s), canvas=$('#scene');
let renderer;
try{renderer=new T.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance'});}catch(e){$('#bootError').textContent='WebGL could not start. Try a desktop browser with hardware acceleration enabled.';throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
const scene=new T.Scene();scene.background=new T.Color('#182d3a');scene.fog=new T.Fog('#182d3a',38,90);
const camera=new T.PerspectiveCamera(60,1,.12,130);
const actorLighting=createActorLighting(T,scene);
const gala=createGala(T);

const mats={};function mat(name,color){return mats[name]=new T.MeshLambertMaterial({color});}
mat('verdigris','#516f63');mat('wineFold','#643c49');mat('pot','#774c43');mats.lamp=new T.MeshBasicMaterial({color:'#ebcf93'});mat('crate','#526b65');mat('stone','#c2b194');mat('floor','#a2957b');mat('stair','#d4c4a3');mat('garden','#b2aa91');mat('wood','#a57750');mat('beam','#c8ad72');mat('roof','#687c7d');mat('dark','#1e373e');mat('brass','#b69a64');mat('wine','#683449');mat('green','#385f50');mat('leaf','#718465');mat('bark','#544c3f');mat('cream','#eed9ac');mat('plum','#713d58');mat('fur','#a57450');mat('nose','#28242b');mat('glassFrame','#405a60');mat('cloth','#dfcda7');mat('navy','#344957');mat('gold','#e6bb5f');
const boxGeo=new T.BoxGeometry(1,1,1), sphereGeo=new T.SphereGeometry(1,10,7), cylinderGeo=new T.CylinderGeometry(1,1,1,10);
function mesh(geo,m,x,y,z,sx=1,sy=1,sz=1,parent=scene){const o=new T.Mesh(geo,mats[m]||m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);parent.add(o);return o;}
function cube(m,x,y,z,w,h,d,parent=scene){return mesh(boxGeo,m,x,y,z,w,h,d,parent);}
function ball(m,x,y,z,sx,sy,sz,parent=scene){return mesh(sphereGeo,m,x,y,z,sx,sy,sz,parent);}
function cyl(m,x,y,z,r,h,parent=scene){return mesh(cylinderGeo,m,x,y,z,r,h,r,parent);}
function rod(a,b,r,m,parent=scene){const av=new T.Vector3(...a),bv=new T.Vector3(...b),o=cyl(m,0,0,0,r,av.distanceTo(bv),parent);o.position.copy(av).add(bv).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),bv.sub(av).normalize());return o;}
const occluders=[];
const floorGeometry=new T.BoxGeometry(1,1,1,17,1,15);
for(const b of platforms){if(b===securityGate)continue;const o=b.id==='ground'?mesh(floorGeometry,b.kind,b.x,b.top-b.h/2,b.z,b.w,b.h,b.d):cube(b.kind,b.x,b.top-b.h/2,b.z,b.w,b.h,b.d);occluders.push(o);if(b.kind==='wood'){for(let i=-1;i<=1;i++)cube('brass',b.x+i*.8,b.top+.012,b.z,.025,.025,b.d);}if(b.kind==='beam'){cube('dark',b.x-b.w/2+.06,b.top+.015,b.z,.08,.035,b.d);cube('dark',b.x+b.w/2-.06,b.top+.015,b.z,.08,.035,b.d);}}
// Ground pattern and cornices give the massing a museum scale without external assets.
for(let x=-16;x<=16;x+=2)cube('stone',x,.009,0,.018,.015,29);
for(let z=-14;z<=14;z+=2)cube('stone',0,.009,z,33,.015,.018);
const walls=[];
for(const x of [-17,17]){const w=cube('dark',x,4,-1,.5,8,28);walls.push(w);occluders.push(w);cube('brass',x,4.42,-1,.6,.15,28);}
const back=cube('dark',0,4,-15,34,8,.5);occluders.push(back);walls.push(back);
for(let x=-15;x<=15;x+=5){cube('stone',x,3.9,-14.6,.7,7.8,.65);cube('stone',x,7.8,-14.45,1.15,.25,1);}
for(const x of [-15.6,15.6])for(let z=-10;z<=10;z+=5){cyl('stone',x,2.1,z,.35,4.2);cyl('brass',x,4.05,z,.55,.2);}
// Small inner railings, kept off route entrances.
function rail(x,z,len,axis='z',y=4.4){const dx=axis==='x'?len:0,dz=axis==='z'?len:0;rod([x-dx/2,y+.9,z-dz/2],[x+dx/2,y+.9,z+dz/2],.045,'brass');for(let t=-.5;t<=.51;t+=1/Math.max(2,Math.floor(len/.9)))rod([x+dx*t,y,z+dz*t],[x+dx*t,y+.9,z+dz*t],.027,'stone');}
rail(12,-8,4);rail(12,5,9);rail(-12,-1,4);rail(-12,-10,3);rail(3,-10,6,'x');
// Overhead ribs leave the playable route clear; no opaque roof to hide camera.
for(const z of [-14,-7,0,7,14]){let pts=[];for(let i=0;i<=28;i++){const a=i/28*Math.PI;pts.push(new T.Vector3(Math.cos(a)*17,9+Math.sin(a)*5,z));}const curve=new T.CatmullRomCurve3(pts);scene.add(new T.Mesh(new T.TubeGeometry(curve,32,.07,5,false),mats.brass));}
for(const x of [-12,-6,0,6,12])rod([x,9+Math.sqrt(1-(x/17)**2)*5,-14],[x,9+Math.sqrt(1-(x/17)**2)*5,14],.045,'glassFrame');
// Theatrical banners on the old wing.
for(const x of [-12,-6,6,12]){cube('wine',x,6.6,-14.35,1.6,2.4,.08);rod([x-.95,7.88,-14.2],[x+.95,7.88,-14.2],.055,'brass');cube('brass',x,5.4,-14.27,1.6,.09,.09);}
// Scaffold geometry emphasizes real staggered landings.
for(const b of platforms.filter(b=>b.kind==='wood')){for(const sx of [-1,1])for(const sz of [-1,1])rod([b.x+sx*b.w*.46,0,b.z+sz*b.d*.46],[b.x+sx*b.w*.46,b.top+.7,b.z+sz*b.d*.46],.055,'glassFrame');rod([b.x-b.w*.46,b.top-1.1,b.z-b.d*.46],[b.x+b.w*.46,b.top,b.z-b.d*.46],.035,'brass');}
const leafGeo=new T.SphereGeometry(1,4,2);
function plant(x,y,z,s=1){
 cyl('pot',x,y+.28*s,z,.34*s,.56*s);cyl('brass',x,y+.53*s,z,.36*s,.05*s);
 for(let i=0;i<5;i++){const a=i*2.4,dx=Math.sin(a),dz=Math.cos(a);rod([x,y+.54*s,z],[x+dx*.47*s,y+1.17*s,z+dz*.47*s],.018*s,'green');
  for(let j=0;j<4;j++){const t=.25+j*.18,xx=x+dx*.47*s*t,yy=y+(.54+.63*t)*s,zz=z+dz*.47*s*t;
   for(const side of [-1,1]){const leaf=mesh(leafGeo,i%2?'green':'leaf',xx+Math.cos(a)*side*.12*s,yy,zz-Math.sin(a)*side*.12*s,.20*s*(1-t*.4),.035*s,.075*s);leaf.rotation.y=a+side*.32;leaf.rotation.z=side*.25;}}
 }
}
for(const a of [[12.8,4.4,3],[-15.3,4.4,-4],[11.2,4.4,-1.1],[-5,4.4,-12],[10,4.4,-12],[-12.5,4.4,-11],[14,4.4,10],[-15.3,0,11]])plant(...a,1.3);
// Botanical court and sculptural tree; furniture is visual-only in this study.
cyl('stone',0,.22,2,2.1,.44);cyl('green',0,.45,2,1.85,.12);rod([0,.5,2],[.2,3.3,2],.18,'bark');for(let i=0;i<7;i++){let a=i*2.4;const x=Math.cos(a)*(i%2?1.3:.8),z=2+Math.sin(a)*1.2;rod([.1,2,2],[x,3.1+i*.14,z],.07,'bark');ball(i%2?'leaf':'green',x,3.1+i*.14,z,.9,.55,.9);}
// Static crowd silhouettes at readable human scale, intentionally not AI NPCs.
function guest(x,z,color,rot){const g=new T.Group();scene.add(g);g.position.set(x,0,z);g.rotation.y=rot;cyl(color,0,.63,0,.21,.82,g);ball('fur',0,1.2,0,.19,.22,.18,g);ball('fur',-.13,1.35,0,.09,.1,.08,g);ball('fur',.13,1.35,0,.09,.1,.08,g);rod([-.2,.9,0],[-.3,.58,.14],.055,color,g);rod([.2,.9,0],[.3,.75,.15],.055,color,g);for(const xx of [-.1,.1])cube('navy',xx,.18,0,.1,.36,.12,g);return g;}
for(const [i,a]of STATIC_GUESTS.entries()){if(!gala.stats.positions.some(p=>p.x===a[0]&&p.z===a[1]))guest(a[0],a[1],i%3===0?'wine':i%2?'navy':'cloth',i*1.9);}
for(const [x,z]of [[-5.5,5],[3.8,6.4],[-4,10],[10,5]]){cyl('brass',x,.6,z,.08,1.2);cyl('cloth',x,1.15,z,.65,.12);}
// Target, not interactive until the heist milestone.
cyl('dark',3,5,-7.9,.6,1.2);const glass=new T.MeshBasicMaterial({color:'#a2d9dc',transparent:true,opacity:.15,depthWrite:false});cube(glass,3,6.05,-7.9,1.5,1.4,1.5);for(const x of [2.25,3.75])for(const z of [-8.65,-7.15])rod([x,5.35,z],[x,6.8,z],.022,'brass');
// The stealable prize is created by the mission runtime, outside static batching.
// City silhouettes give the skylight a metropolitan context.
for(let i=0;i<18;i++){const x=-38+i*4.4,h=7+(i*13%11);cube(i%2?'dark':'navy',x,h/2,-27,3.5,h,5);for(let y=2;y<h-1;y+=3)cube('brass',x,y,-24.45,.55,.85,.02);}
applyMuseumFinishings({T,scene,mats,cube,ball,cyl,rod,platforms});
// Batch static surfaces by material. Preserve detached collision meshes for camera rays.
scene.updateMatrixWorld(true);
const batches=new Map(), staticMeshes=[];
scene.traverse(o=>{if(o.isMesh&&!o.material.transparent&&!o.material.map){staticMeshes.push(o);const id=o.material.uuid;if(!batches.has(id))batches.set(id,{material:o.material,geometry:[]});batches.get(id).geometry.push(o.geometry.clone().applyMatrix4(o.matrixWorld));}});
for(const o of staticMeshes)o.parent.remove(o);
// Bake simple directional lighting into vertex colors: one inexpensive static draw.
const bakedParts=[],lightDirection=new T.Vector3(-.35,.8,.45).normalize();
for(const b of batches.values()){
 const g=mergeGeometries(b.geometry,false),normals=g.getAttribute('normal'),existing=g.getAttribute('color'),colors=new Float32Array(normals.count*3),c=b.material.color;
 const pos=g.getAttribute('position'),light=[1,1,1];for(let i=0;i<normals.count;i++){if(b.material.isMeshBasicMaterial)light.fill(1);else staticIrradiance(pos.getX(i),pos.getY(i),pos.getZ(i),normals.getX(i),normals.getY(i),normals.getZ(i),light);colors[i*3]=(existing?existing.getX(i):c.r)*light[0];colors[i*3+1]=(existing?existing.getY(i):c.g)*light[1];colors[i*3+2]=(existing?existing.getZ(i):c.b)*light[2];}
 g.setAttribute('color',new T.BufferAttribute(colors,3));bakedParts.push(g);for(const source of b.geometry)source.dispose();
}
scene.add(new T.Mesh(mergeGeometries(bakedParts,false),new T.MeshBasicMaterial({vertexColors:true})));for(const g of bakedParts)g.dispose();
const rings=markers.map((m,i)=>{const material=new T.MeshBasicMaterial({color:'#e9bc69'}),ring=new T.Mesh(new T.TorusGeometry(.66,.045,5,32),material);ring.rotation.x=Math.PI/2;ring.position.set(m.x,m.y+.1,m.z);scene.add(ring);return ring;});
// Bespoke animated thief and purposeful gala actors are never statically baked.
const thief=createThief(T),hero=thief.root;hero.rotation.y=Math.PI;scene.add(hero);scene.add(gala.root);
const shadow=new T.Mesh(new T.CircleGeometry(.42,20),new T.MeshBasicMaterial({color:'#13222a',transparent:true,opacity:.35,depthWrite:false}));shadow.rotation.x=-Math.PI/2;scene.add(shadow);
startHeistRuntime({T,scene,camera,renderer,occluders,hero,thief,gala,actorLighting,shadow,rings,mats,cube,ball,cyl,rod,caseGlass:glass});
