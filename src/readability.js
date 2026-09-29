export const PUBLIC_REFUGE=Object.freeze({x:7,y:4.4,z:-2,radius:1.45,heightTolerance:.35});
export function inPublicRefuge(h,p){const r=PUBLIC_REFUGE;return h.phase==='prep'&&Math.abs(p.y-r.y)<r.heightTolerance&&Math.hypot(p.x-r.x,p.z-r.z)<r.radius;}
export function surfaceForInlay(blocks,x,z,hint){let best=null;for(const b of blocks){if(b.disabled||['gate','crate','dark','wine'].includes(b.kind))continue;if(Math.abs(x-b.x)>b.w/2||Math.abs(z-b.z)>b.d/2||b.top>hint+.65)continue;if(!best||Math.abs(b.top-hint)<Math.abs(best.top-hint))best=b;}return best?best.top:null;}
export function curatorCue(h){const t=((h.time%10)+10)%10,reading=t<6,remaining=reading?6-t:10-t;return {reading,remaining,warning:reading&&remaining<1.25,label:reading?(remaining<1.25?'LOOKING UP SOON':'READING · APPROACH BEHIND'):'LOOKING AROUND · WAIT'};}
export function checkpointName(p){if(p.y>8)return p.z<-7?'skylight anchor':'scaffold crown';if(p.y>4)return p.z>6?'east gallery':'public terrace';return p.x<0?'service entrance':'gala entrance';}
// Keep the interactive curator distinct from baked decorative guests.
export const STATIC_GUESTS=Object.freeze([[-6,6],[-5,6.4],[-7,4],[3,6],[4,5.5],[9,4],[-2,-5],[-1,-5.5],[-5,10],[2,11],[10,9]].map(p=>Object.freeze(p)));
