import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { WEAPONS } from '../../../shared/adventure-catalog.js';

const root = new URL('./', import.meta.url);
const data = JSON.parse(await readFile(new URL('design-data.json', root), 'utf8'));
data.ranged = Object.entries(WEAPONS).map(([id,item])=>({id,...item}));
data.images = {};
const ids = [...data.characters.flatMap(c=>[`${c.id}-player`,`${c.id}-attack`]), ...data.weapons.map(w=>w.image), ...data.effects.map(effect=>effect.image)];
for(const id of ids){
  let pipeline = sharp(new URL(`assets/${id}.png`,root).pathname);
  if(id.startsWith('effect-')&&id!=='effect-wind-fire-wheel')pipeline=pipeline.trim({threshold:10});
  const bytes = await pipeline.resize({width:id.startsWith('weapon-')?1400:540,withoutEnlargement:true}).webp({quality:88,alphaQuality:100}).toBuffer();
  data.images[id] = `data:image/webp;base64,${bytes.toString('base64')}`;
}
data.audio.data = `data:audio/wav;base64,${(await readFile(new URL(data.audio.file,root))).toString('base64')}`;
const template = await readFile(new URL('report-template.html',root),'utf8');
const temporary = await mkdtemp(join(tmpdir(),'garden-design-font-'));
try{
  const textFile = join(temporary,'characters.txt'), fontFile = join(temporary,'hand.woff2');
  await writeFile(textFile,template+JSON.stringify(data));
  execFileSync('python3',['-m','fontTools.subset',new URL('../../../public/fonts/LXGWWenKai-Regular.woff2',root).pathname,`--text-file=${textFile}`,`--output-file=${fontFile}`,'--flavor=woff2'],{stdio:'pipe'});
  const font = `data:font/woff2;base64,${(await readFile(fontFile)).toString('base64')}`;
  const html = template.replace('/*__FONT__*/',font).replace('/*__DATA__*/',JSON.stringify(data).replaceAll('<','\\u003c'));
  await writeFile(new URL('index.html',root),html);
  console.log(`设计报告已生成：${(Buffer.byteLength(html)/1024/1024).toFixed(2)} MB；游戏仍有 ${data.ranged.length} 种现有武器。`);
}finally{await rm(temporary,{recursive:true,force:true});}
