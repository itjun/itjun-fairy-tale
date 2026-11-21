import { readFile,writeFile,mkdtemp,rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
const root=new URL('./',import.meta.url),data={images:{},audio:{}};
const files={person:'../assets/sister-attack.png',saber:'../assets/weapon-saber.png',spear:'../assets/weapon-spear.png',sword:'../assets/weapon-sword.png',halberd:'../assets/weapon-halberd.png',wheel:'../assets/effect-wind-fire-wheel.png',enemy:'../../../../public/assets/enemy-jelly.png'};
for(const [id,file] of Object.entries(files)){const buf=await sharp(new URL(file,root).pathname).resize({width:id==='person'?520:900,withoutEnlargement:true}).webp({quality:90,alphaQuality:100}).toBuffer();data.images[id]='data:image/webp;base64,'+buf.toString('base64');}
data.reference='data:image/webp;base64,'+(await sharp(new URL('../moveset-options/rhythm.png',root).pathname).resize({width:1400}).webp({quality:88}).toBuffer()).toString('base64');
for(const id of ['saber','spear','sword','halberd']){data.audio[id]={};for(const kind of ['impact','phrase'])data.audio[id][kind]='data:audio/wav;base64,'+(await readFile(new URL('audio/'+id+'-'+kind+'.wav',root))).toString('base64');}
const template=await readFile(new URL('template.html',root),'utf8'),temporary=await mkdtemp(join(tmpdir(),'garden-rhythm-font-'));
try{await writeFile(join(temporary,'text.txt'),template);execFileSync('python3',['-m','fontTools.subset',new URL('../../../../public/fonts/LXGWWenKai-Regular.woff2',root).pathname,'--text-file='+join(temporary,'text.txt'),'--output-file='+join(temporary,'font.woff2'),'--flavor=woff2'],{stdio:'pipe'});const html=template.replace('__FONT__','data:font/woff2;base64,'+(await readFile(join(temporary,'font.woff2'))).toString('base64')).replace('__DATA__',JSON.stringify(data).replaceAll('<','\\u003c'));await writeFile(new URL('index.html',root),html);console.log('动态预览已生成：'+(Buffer.byteLength(html)/1048576).toFixed(2)+' MB');}finally{await rm(temporary,{recursive:true,force:true});}
