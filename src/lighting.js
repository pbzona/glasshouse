// Art-directed static illumination. Actors use the matching live lights below;
// the museum is baked once at construction time, so the light hierarchy is not
// a per-frame multi-light shader cost over every architectural pixel.
export const LIGHT_POOLS=Object.freeze([
 {x:3,y:7.4,z:-7.9,radius:7,power:.95,color:[1,.79,.48]},
 {x:-5.5,y:4.8,z:6.1,radius:8,power:.52,color:[1,.76,.48]},
 {x:3.5,y:5.0,z:6,radius:7,power:.42,color:[1,.80,.57]},
 {x:7,y:7,z:-2,radius:5,power:.32,color:[1,.86,.65]},
 {x:-13.8,y:6,z:3,radius:7,power:.24,color:[.49,.66,1]}
]);
export function staticIrradiance(x,y,z,nx,ny,nz,out=[0,0,0]){
 const key=Math.max(0,-nx*.35+ny*.81+nz*.46),up=Math.max(0,ny);
 out[0]=.25+key*.37+up*.035;out[1]=.29+key*.34+up*.055;out[2]=.34+key*.28+up*.09;
 for(const l of LIGHT_POOLS){const dx=l.x-x,dy=l.y-y,dz=l.z-z,d=Math.hypot(dx,dy,dz);if(d<.01||d>l.radius)continue;const lambert=Math.max(0,(nx*dx+ny*dy+nz*dz)/d),fall=(1-d/l.radius)**2,level=l.power*fall*(.2+.8*lambert);for(let k=0;k<3;k++)out[k]+=l.color[k]*level;}
 return out;
}
export function createActorLighting(T,scene){
 const hemi=new T.HemisphereLight('#9eafbf','#564439',1.6);scene.add(hemi);
 const key=new T.DirectionalLight('#ffe0b8',2.4);key.position.set(-8,16,10);scene.add(key);
 const rim=new T.DirectionalLight('#92acc9',1.35);rim.position.set(10,12,-15);scene.add(rim);
 const prize=new T.PointLight('#ffd092',1.8,9,2);prize.position.set(3,7,-7.9);scene.add(prize);
 const alert=new T.PointLight('#e8b181',0,7,2);alert.position.set(3,6.3,-7.9);scene.add(alert);
 return {update(state){alert.intensity=state.stolen?.7:0;},stats:{lights:5,shadowMaps:0}};
}
