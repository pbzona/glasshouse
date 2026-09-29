import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {surfaceForInlay} from './readability.js';
export function applyMuseumFinishings({T,scene,mats,cube,ball,cyl,rod,platforms}){
 // One shared atlas for small architectural plaques and botanical prints.
 const atlas=document.createElement('canvas');atlas.width=2048;atlas.height=1024;const ctx=atlas.getContext('2d'),panels=[];let tile=0;
 function panel(title,sub,x,y,z,w=1.8,h=.64,angle=0,botanical=false){
  const col=tile%4,row=Math.floor(tile/4),left=col*512,top=row*256;tile++;
  ctx.save();ctx.translate(left,top);ctx.fillStyle=botanical?'#d8cbb0':'#203a3e';ctx.fillRect(0,0,512,256);ctx.strokeStyle='#b8a071';ctx.lineWidth=9;ctx.strokeRect(8,8,496,240);
  if(botanical){ctx.strokeStyle='#526957';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(260,205);ctx.bezierCurveTo(270,165,230,100,270,45);ctx.stroke();for(let i=0;i<5;i++){const yy=73+i*25;ctx.beginPath();ctx.ellipse(238-i*2,yy,32,9,-.6,0,Math.PI*2);ctx.ellipse(286-i*2,yy+9,30,8,.65,0,Math.PI*2);ctx.stroke();}ctx.fillStyle='#4d5e50';ctx.font='18px Georgia';ctx.textAlign='center';ctx.fillText(title,256,236);}
  else{ctx.fillStyle='#eee0bd';ctx.textAlign='center';ctx.font='600 35px sans-serif';ctx.fillText(title,256,111);ctx.fillStyle='#b8c1a6';ctx.font='22px sans-serif';ctx.fillText(sub,256,168);}ctx.restore();
  const geom=new T.PlaneGeometry(w,h),uv=geom.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,(col+uv.getX(i))/4,1-(row+1-uv.getY(i))/4);
  const tr=new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),angle),new T.Vector3(1,1,1));geom.applyMatrix4(tr);panels.push(geom);
  // Thin framing on the existing plane, never a new blocking volume.
  const ux=Math.cos(angle),uz=-Math.sin(angle);rod([x-ux*w/2,y+h/2,z-uz*w/2],[x+ux*w/2,y+h/2,z+uz*w/2],.025,'brass');rod([x-ux*w/2,y-h/2,z-uz*w/2],[x+ux*w/2,y-h/2,z+uz*w/2],.025,'brass');
 }
 panel('SCREENED ARCADE','PRIZE · OBSERVE THE PATROL',8.395,5.6,-4.9,2,.74,-Math.PI/2);
 panel('SERVICE STAIR','OPTIONAL ROOF APPROACH',-11.555,1.8,10.1,2,.74,Math.PI/2);
 panel('RESTORATION','OPTIONAL ROOF ACCESS',-6.405,5.5,-5,2,.7,-Math.PI/2);
 panel('EXTRACTION ANCHOR','OPTIONAL · PREPARE WITH E',1,9.8,-12.65,2,.65);rod([1,8.8,-12.69],[1,10.15,-12.69],.045,'brass');
 panel('GALA ENTRANCE','EXIT TO THE STREET',7,2.35,12.06,1.9,.55,Math.PI);
 panel('PRIVATE VIEW','ARCHIVE CURATOR',-8.0,.98,9,1.1,.42,Math.PI/2);cyl('brass',-7.99,.43,9,.045,.86);
 panel('PUBLIC REFUGE','PATROLS BEYOND THE INLAY',9.65,5.36,-.3,1.35,.48);rod([9.65,4.4,-.34],[9.65,5.63,-.34],.035,'brass');
 panel('FERN / STUDY 01','',12.01,5.6,-5,1.05,1.3,-Math.PI/2,true);
 panel('FERN / STUDY 02','',12.01,5.6,-8,1.05,1.3,-Math.PI/2,true);
 panel('FROND / ARCHIVE','',8.395,5.5,-7.2,1,1.15,-Math.PI/2,true);
 const texture=new T.CanvasTexture(atlas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=1;
 const atlasMesh=new T.Mesh(mergeGeometries(panels,false),new T.MeshBasicMaterial({map:texture}));scene.add(atlasMesh);for(const g of panels)g.dispose();
 // Brass caps and muted verdigris skirtings distinguish real cover partitions.
 for(const b of platforms.filter(b=>['east-screen','east-display-wall','north-screen','case-waiting-cover'].includes(b.id))){
  cube('brass',b.x,b.top+.025,b.z,b.w+.055,.07,b.d+.055);
  cube('verdigris',b.x,b.top-b.h+.10,b.z,b.w+.04,.15,b.d+.04);
 }
 // Sparse joints, avoiding a dense texture or full mesh subdivision pass.
 for(let x=-15;x<=15;x+=5)cube('brass',x,7.87,-14.29,1.2,.07,.1);
 for(const x of [-12,-6,6,12])for(let j=-2;j<=2;j++)cube(j%2?'wine':'wineFold',x+j*.26,6.6,-14.28,.09,2.25,.045);
 // Authored warm pools: opaque vertex-colored surfaces, not lights, bloom or shadows.
 function pool(x,y,z,r,core=.82){const geo=new T.CircleGeometry(r,24),pos=geo.getAttribute('position'),colors=new Float32Array(pos.count*3),center=new T.Color('#ead3a1'),edge=new T.Color('#c0b18e');for(let i=0;i<pos.count;i++){const v=Math.min(1,Math.hypot(pos.getX(i),pos.getY(i))/r),c=edge.clone().lerp(center,(1-v)*core);colors.set([c.r,c.g,c.b],i*3);}geo.setAttribute('color',new T.BufferAttribute(colors,3));const m=new T.Mesh(geo,new T.MeshBasicMaterial({vertexColors:true}));m.rotation.x=-Math.PI/2;m.position.set(x,y+.011,z);m.userData.preserveVertexColor=true;scene.add(m);}
 pool(3,4.4,-7.9,1.6);pool(-8,0,9,1.8,.48);pool(7,4.4,-2,1.25,.44);
 function lamp(x,y,z){cube('brass',x,y-.17,z,.09,.34,.1);cube('lamp',x,y+.1,z,.19,.28,.16);cube('brass',x,y+.28,z,.3,.06,.24);}
 for(const [x,y,z]of [[-11.5,2.8,10.7],[12.0,6.57,-5],[12.0,6.57,-8],[2,6.45,-14.25],[7,6.45,-14.25]])lamp(x,y,z);
 // Ground every marker on its actual authored surface. Gold = prize; green = optional roof.
 const main=[[7,10],[7,7.7],[7,5.2],[7,2.8],[7,0],[10,-2],[10,-5],[10,-8],[8,-9],[6.9,-9]];
 for(const [x,z]of main){const hint=z>1?(10-z)/8*4.4:4.4,y=surfaceForInlay(platforms,x,z,hint);if(y!==null)cyl('gold',x,y+.022,z,.085,.025);}
 for(const z of [11.5,9,6.5,4,1.7,-2,-6]){const y=surfaceForInlay(platforms,-14,z,z>2?(10-z)/7.5*4.4+.4:4.4);if(y!==null){cube('verdigris',-14,y+.026,z,.20,.025,.10);cube('brass',-14,y+.029,z,.05,.025,.1);}}
 for(const z of [-5,-3,-1])rod([-6.45,0,z],[-6.45,9.2,z],.035,'brass');
 return {atlasMesh};
}
