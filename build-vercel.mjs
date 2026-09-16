import './build.mjs';
import {mkdirSync,copyFileSync} from 'node:fs';
const out=new URL('./dist/',import.meta.url);
mkdirSync(out,{recursive:true});
copyFileSync(new URL('./museum.html',import.meta.url),new URL('./dist/index.html',import.meta.url));
console.log('Vercel output: dist/index.html');
