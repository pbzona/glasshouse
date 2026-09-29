import {hasLineOfSight} from './heist.js';

// Presentation only: a same-floor slice (target feet at g.y), not a 3D frustum.
// Detection also checks a real target's elevation; this overlay cannot depict
// all elevations at once. Keep these constants aligned with heist.js visible().
const HALF_ANGLE=.65, CLOSE_RADIUS=1.1, SAMPLE_SPACING=.3, REFINE_STEPS=4;
const scratchByBuffers=new WeakMap();

export function guardVision(h,g,{slow=false,suppressed=false}={}){
 const alert=g.reactingFor>0||(h.alarm&&g.id==='case');
 const range=alert?7:slow?4.2:6;
 let reason=!g.active?'inactive':h.phase==='scout'?'scout':
  h.phase==='complete'?'complete':h.shield>0?'immunity':
  g.disabledFor>0?'jammed':suppressed?'suppressed':null;
 const enabled=reason===null;
 if(enabled)reason=alert?'alert':slow?'slow':'normal';
 return {range,halfAngle:HALF_ANGLE,closeRadius:CLOSE_RADIUS,enabled,reason};
}

function checkSegments(n,min,name){
 // Last fan vertex is n+1 and must fit in Uint16.
 if(!Number.isInteger(n)||n<min||n>65534)throw new RangeError(`${name} must be an integer from ${min} to 65534`);
}
function makeFan(segments,start,span){
 const positions=new Float32Array((segments+2)*3);
 const indices=new Uint16Array(segments*3);
 const directions=new Float64Array((segments+1)*2);
 for(let i=0;i<=segments;i++){
  const angle=start+span*i/segments;
  directions[i*2]=Math.sin(angle);directions[i*2+1]=Math.cos(angle);
  // +Y-facing triangles; heading 0 faces local +Z, as in heist.js.
  if(i<segments)indices.set([0,i+1,i+2],i*3);
 }
 return {positions,indices,directions};
}

export function createVisionBuffers(coneSegments=24,closeSegments=32){
 checkSegments(coneSegments,1,'coneSegments');checkSegments(closeSegments,3,'closeSegments');
 const cone=makeFan(coneSegments,-HALF_ANGLE,HALF_ANGLE*2);
 const close=makeFan(closeSegments,0,Math.PI*2);
 // Make the circle seam identical, not just approximately equal after sin(2π).
 close.directions[closeSegments*2]=close.directions[0];
 close.directions[closeSegments*2+1]=close.directions[1];
 const buffers={coneSegments,closeSegments,
  conePositions:cone.positions,closePositions:close.positions,
  coneIndices:cone.indices,closeIndices:close.indices,
  vision:{range:6,halfAngle:HALF_ANGLE,closeRadius:CLOSE_RADIUS,enabled:false,reason:'uninitialized'}};
 scratchByBuffers.set(buffers,{coneDirections:cone.directions,closeDirections:close.directions,
  blockers:[],eye:{x:0,y:0,z:0},target:{x:0,y:0,z:0}});
 return buffers;
}

function clippedRadius(radius,dx,dz,scratch){
 const {eye,target,blockers}=scratch;
 if(!blockers.length)return radius;
 const steps=Math.ceil(radius/SAMPLE_SPACING),step=radius/steps;
 let clear=0;
 for(let i=1;i<=steps;i++){
  let blocked=i===steps?radius:i*step;
  target.x=eye.x+dx*blocked;target.z=eye.z+dz*blocked;
  if(hasLineOfSight(eye,target,blockers)){clear=blocked;continue;}
  // Stop at the FIRST sampled occlusion, not merely at an occluded endpoint.
  // Keep the clear side of the bracket: conservative on sampled rays. Finite
  // angular/radial sampling can miss thin features between samples; fan chords
  // are an approximation, never a pixel-perfect or authoritative vision test.
  for(let j=0;j<REFINE_STEPS;j++){
   const mid=(clear+blocked)/2;
   target.x=eye.x+dx*mid;target.z=eye.z+dz*mid;
   if(hasLineOfSight(eye,target,blockers))clear=mid;else blocked=mid;
  }
  return clear;
 }
 return radius;
}
function updateFan(positions,directions,radius,sin,cos,scratch){
 for(let i=0;i<directions.length/2;i++){
  const x=directions[i*2],z=directions[i*2+1];
  // World rotation matches Three.js rotation.y = g.heading; stored points
  // remain local so the caller must not bake the heading in a second time.
  const r=clippedRadius(radius,x*cos+z*sin,z*cos-x*sin,scratch),offset=(i+1)*3;
  positions[offset]=x*r;positions[offset+1]=0;positions[offset+2]=z*r;
 }
}

// Bind arrays once to Three BufferAttributes. Call from the render owner at
// about 6 Hz (not every frame); mark position attributes dirty after each call.
// Render meshes at (g.x,g.y+.035,g.z), rotation.y=g.heading, using vision.enabled
// for visibility. Update bounds or use a fixed bound accommodating range 7.
// This helper does not own cadence, materials, color, opacity, or game state.
export function updateVisionBuffers(buffers,h,g,blocks=[],options={}){
 const scratch=scratchByBuffers.get(buffers);
 if(!scratch)throw new TypeError('Use createVisionBuffers() to create buffers');
 const vision=buffers.vision;
 Object.assign(vision,guardVision(h,g,options));
 const {blockers,eye,target}=scratch;
 blockers.length=0;
 if(!vision.enabled){
  buffers.conePositions.fill(0);buffers.closePositions.fill(0);return buffers;
 }
 eye.x=g.x;eye.y=g.y+1.1;eye.z=g.z;
 target.y=g.y+.9;
 // Broad phase: discard disabled blocks, irrelevant vertical extents and AABBs
// whose nearest horizontal point exceeds the largest possible ray length.
 const radius=Math.max(vision.range,vision.closeRadius);
 for(const b of blocks){
  if(b.disabled||b.top<target.y||b.top-b.h>eye.y)continue;
  const dx=Math.max(0,Math.abs(b.x-g.x)-b.w/2),dz=Math.max(0,Math.abs(b.z-g.z)-b.d/2);
  if(dx*dx+dz*dz<=radius*radius)blockers.push(b);
 }
 const sin=Math.sin(g.heading),cos=Math.cos(g.heading);
 updateFan(buffers.conePositions,scratch.coneDirections,vision.range,sin,cos,scratch);
 updateFan(buffers.closePositions,scratch.closeDirections,Math.min(vision.range,vision.closeRadius),sin,cos,scratch);
 return buffers;
}
