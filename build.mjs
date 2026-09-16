import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
const result=await build({entryPoints:[new URL('./src/main.js',import.meta.url).pathname],bundle:true,write:false,minify:true,format:'iife',target:'es2020',legalComments:'inline'});
const base=readFileSync(new URL('./index.template.html',import.meta.url),'utf8').split('</style>')[0].replace('The Glasshouse Job · Traversal Study','The Glasshouse Job · Playable Heist');
const template=base+readFileSync(new URL('./heist.extra.css',import.meta.url),'utf8')+readFileSync(new URL('./heist.body.html',import.meta.url),'utf8');
writeFileSync(new URL('./museum.html',import.meta.url),template.replace('/*BUNDLE*/',()=>result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')));
console.log('Bundled self-contained museum.html ('+result.outputFiles[0].text.length+' JS characters)');
