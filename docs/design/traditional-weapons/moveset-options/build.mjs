import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
const root=new URL('./',import.meta.url);
const data=JSON.parse(await readFile(new URL('data.json',root),'utf8'));
if(data.order.length!==3||new Set(data.order).size!==3)throw new Error('需要记录三组图片的实际展示顺序');
for(const w of data.weapons)for(const id of data.order){const move=data.directions[id].moves[w.id];if(move.damage.reduce((a,b)=>a+b,0)!==w.total)throw new Error('整轮伤害预算不一致');}
data.images={};
for(const id of data.order){const img=await sharp(new URL(data.directions[id].image,root).pathname).webp({quality:90}).toBuffer();data.images[id]='data:image/webp;base64,'+img.toString('base64');}
data.audio='data:audio/wav;base64,'+(await readFile(new URL('../audio/ng3-enemy-break.wav',root))).toString('base64');
const template=await readFile(new URL('template.html',root),'utf8');
const temporary=await mkdtemp(join(tmpdir(),'garden-moveset-font-'));
try{const text=join(temporary,'text.txt'),font=join(temporary,'font.woff2');await writeFile(text,template+JSON.stringify(data));execFileSync('python3',['-m','fontTools.subset',new URL('../../../../public/fonts/LXGWWenKai-Regular.woff2',root).pathname,'--text-file='+text,'--output-file='+font,'--flavor=woff2'],{stdio:'pipe'});const html=template.replace('__FONT__','data:font/woff2;base64,'+(await readFile(font)).toString('base64')).replace('__DATA__',JSON.stringify(data).replaceAll('<','\\u003c'));await writeFile(new URL('index.html',root),html);console.log('设计选择页已生成：'+(Buffer.byteLength(html)/1024/1024).toFixed(2)+' MB，12 个招式预算检查通过。');}finally{await rm(temporary,{recursive:true,force:true});}
