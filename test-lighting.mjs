import assert from 'node:assert/strict';
import * as T from 'three';
import {LIGHT_POOLS,staticIrradiance,createActorLighting} from './src/lighting.js';
const near=staticIrradiance(3,4.4,-7.9,0,1,0),far=staticIrradiance(-16,0,-14,0,1,0);
assert(near[0]>far[0],'Prize needs a stronger warm focus than far service space');
assert(near[0]/near[2]>far[0]/far[2],'Prize focus should be warmer');
const out=[0,0,0];assert.equal(staticIrradiance(0,0,0,1,0,0,out),out);assert(out.every(v=>Number.isFinite(v)&&v>0));
for(const l of LIGHT_POOLS)assert(l.radius>0&&l.power>=0);
const s=new T.Scene(),lighting=createActorLighting(T,s);assert.equal(lighting.stats.shadowMaps,0);assert.equal(s.children.filter(o=>o.isLight).length,5);lighting.update({stolen:true});assert(s.children.every(o=>!o.castShadow));console.log('PASS warm prize focus, readable cool fill, finite bake, actor lights and no shadow-map passes');
