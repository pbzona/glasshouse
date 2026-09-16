import assert from 'node:assert/strict';
import {makePlayer,stepPlayer,markers} from './src/world.js';
const p=makePlayer(),dt=1/120;let ticks=0;
function frame(ix=0,iz=0,j=false,slow=false){stepPlayer(p,ix,iz,dt,j,slow);ticks++;assert(Number.isFinite(p.y));}
function go(x,z,timeout=10){for(let t=0;t<timeout;t+=dt){let dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz);if(d<.08&&Math.hypot(p.vx,p.vz)<.2)return;const input=Math.min(1,d*2/5.6);frame(d?dx/d*input:0,d?dz/d*input:0);}throw Error(`Failed go ${x},${z}: ${JSON.stringify(p)}`);}
function settle(){for(let t=0;t<.5;t+=dt)frame();}
function jumpTo(x,z,height){assert(p.grounded);for(let t=0;t<1.2;t+=dt){const dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz);let input=Math.min(1,d*4/5.6);frame(d?dx/d*input:0,d?dz/d*input:0,t===0);if(t>.2&&p.grounded){assert(Math.abs(p.y-height)<.02,`landed ${p.y}, expected ${height} at ${p.x},${p.z}`);go(x,z);return;}}throw Error('No jump landing');}
settle();assert.equal(p.y,0);go(7,-1.3);assert(Math.abs(p.y-4.4)<.02);go(13,-2);assert.equal(p.y,markers[0].y);console.log('PASS staircase and planted terrace');
go(14,-12);go(-14,-12);go(-14,-6);go(-10,-6);assert.equal(p.y,4.4);console.log('PASS connected gallery circuit');
jumpTo(-8,-3.5,5.5);jumpTo(-10,-.5,6.6);jumpTo(-7,1.5,7.7);jumpTo(-4,1.5,8.8);console.log('PASS four scaffold jumps');
go(-4,-5.7);jumpTo(-4,-8,8.8);jumpTo(-4,-10,8.8);go(1,-11);assert.equal(p.y,markers[2].y);console.log('PASS beam gaps and skylight deck');
// Holding no input must brake rather than drift. A held movement vector is normalized.
settle();assert(Math.hypot(p.vx,p.vz)<.01);console.log('PASS friction; complete ascent in '+(ticks/120).toFixed(1)+' simulated seconds');
