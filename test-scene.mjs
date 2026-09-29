// Geometry construction smoke test, not a substitute for live WebGL inspection.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFileSync} from 'node:fs';
const root=new URL('./',import.meta.url).pathname;
const context=new Proxy({}, {get:(o,k)=>k in o?o[k]:(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
const canvas=()=>({width:1,height:1,getContext:()=>context});
globalThis.document={querySelector:()=>canvas(),createElement:()=>canvas()};globalThis.devicePixelRatio=1;
globalThis.MockRenderer=class{setPixelRatio(){}};
const result=await build({entryPoints:[root+'src/main.js'],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'construction-only',setup(b){b.onResolve({filter:/^\.\/runtime\.js$/},()=>({path:'runtime-stub',namespace:'smoke'}));b.onLoad({filter:/.*/,namespace:'smoke'},()=>({contents:'export function startHeistRuntime(args){globalThis.sceneUnderTest=args;}'}));b.onLoad({filter:/\/src\/main\.js$/},a=>({contents:readFileSync(a.path,'utf8').replace('new T.WebGLRenderer','new globalThis.MockRenderer'),loader:'js',resolveDir:root+'src'}));}}]});
try{await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));}catch(e){console.error(e.message);process.exit(1);}
const a=globalThis.sceneUnderTest;assert(a);let meshes=0,triangles=0;
a.scene.traverse(o=>{if(!o.isMesh)return;assert(o.geometry,'Missing merged geometry');const p=o.geometry.getAttribute('position');assert(p&&p.count>0);const arr=p.array;assert([...arr].every(Number.isFinite));triangles+=(o.geometry.index?.count||p.count)/3;meshes++;});
assert.equal(a.ambientGuests.length,2);assert(meshes>5);assert(triangles<45000,'Geometry budget exceeded');console.log(`PASS scene construction: ${meshes} mesh objects before runtime batching, ${triangles} triangles, two ambient actors`);
