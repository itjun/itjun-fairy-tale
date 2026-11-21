import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { CHARACTERS } from '../../../src/game/characters.js';
import { recommendedStarter } from '../../../src/game/starter-build.js';
import { WEAPONS, UPGRADES, MONSTERS, TIMED_ITEMS, EXPANDED_THEME_MONSTERS, upgradeCategory } from '../../../shared/adventure-catalog.js';
import { SPELLS, LEGENDARY_EFFECTS } from '../../../shared/combat-catalog.js';
import { WORLD_ACTS } from '../../../shared/levels.js';
import { MONSTER_ROLES, roleForBehavior, ELITE_TRAITS } from '../../../shared/monster-roles.js';
import { BOSS_THEMES } from '../../../shared/boss-skills.js';
import { createRoomWorld } from '../../../shared/room-world.js';
import { COLLECTIBLES } from '../../../shared/collectibles.js';
import { ALBUM_PAGES } from '../../../src/album/album.js';
import { SETS } from '../../../src/game/sets.js';
import { cycleModifiers } from '../../../shared/adventure-cycle.js';
const output = new URL('./', import.meta.url);
const images = {};
const screenshot = await readFile(new URL('./cycle-2.webp', import.meta.url))
  .then(bytes => 'data:image/webp;base64,' + bytes.toString('base64'))
  .catch(error => {
    if (error.code !== 'ENOENT') throw error;
    return null;
  });
const probe = JSON.parse(await readFile(new URL('./probe-results.json', import.meta.url), 'utf8'));
const imageIds = [...new Set([...Object.values(CHARACTERS).map(c=>c.image), ...[WEAPONS,UPGRADES,MONSTERS,SPELLS,COLLECTIBLES,TIMED_ITEMS].flatMap(c=>Object.values(c).map(i=>i.image)), ...Object.values(BOSS_THEMES).map(i=>i.image), ...WORLD_ACTS.map(i=>i.image)])];
for (const id of imageIds) {
  const buffer = await sharp(new URL(`../../../public/assets/${id}.png`, import.meta.url).pathname).resize(160,160,{fit:'inside',withoutEnlargement:true}).webp({quality:80}).toBuffer();
  images[id] = `data:image/webp;base64,${buffer.toString('base64')}`;
}
const worlds = WORLD_ACTS.map(stage=>{ const world=createRoomWorld(42,stage),boss=world.enemies.find(e=>e.isBoss);return {...stage,boss:{name:boss.name,image:boss.image,hp:boss.hp,skills:boss.skills.map(s=>({name:s.name,kind:s.kind}))},monsters:EXPANDED_THEME_MONSTERS[stage.themeId]};});
const entries = catalog=>Object.entries(catalog).map(([id,item])=>({id,...item}));
const data = {screenshot,date:probe.date,head:execFileSync('git',['rev-parse','--short','HEAD'],{encoding:'utf8'}).trim(),characters:entries(CHARACTERS).map(c=>({...c,starter:recommendedStarter(c.id)})),weapons:entries(WEAPONS),upgrades:entries(UPGRADES).map(u=>({...u,category:upgradeCategory(u.id)})),monsters:entries(MONSTERS).map(m=>({...m,role:roleForBehavior(m.behavior),...MONSTER_ROLES[roleForBehavior(m.behavior)]})),spells:entries(SPELLS),timed:entries(TIMED_ITEMS),collectibles:entries(COLLECTIBLES),sets:entries(SETS),traits:entries(ELITE_TRAITS),legends:LEGENDARY_EFFECTS,album:ALBUM_PAGES,worlds,images,cycleSamples:Array.from({length:20},(_,i)=>({cycle:i+1,...cycleModifiers(i+1)})),probe};
const template=await readFile(new URL('./report-template.html',import.meta.url),'utf8');
await writeFile(new URL('./index.html',output),template.replace('/*__REPORT_DATA__*/',JSON.stringify(data).replaceAll('<','\\u003c')));
console.log('已生成 docs/design/game-framework/index.html');
