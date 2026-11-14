import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampaignWorld,validateCampaign} from '../shared/campaign.js';
import {STAGES} from '../shared/levels.js';
import {MONSTERS,WEAPONS} from '../shared/adventure-catalog.js';
import {SPELLS} from '../shared/combat-catalog.js';
import {newSurvival,migrateSurvival,addLife,takeDamage,reviveSurvival} from '../src/game/characters.js';
import {heal} from '../src/game/expedition.js';
import {newAdventure,newJourney,rewardChoices,chooseReward,migratePendingReward,isValidJourney,isValidAdventure} from '../src/game/adventure.js';
import {stepMagic,consumeMagicShield,isValidMagic} from '../src/game/magic.js';
import {fireLoadout,stepAdventureWave} from '../src/game/adventure-combat.js';
import {stepAdventureEnemies} from '../src/game/adventure-enemies.js';
import {stepBosses} from '../src/game/bosses.js';
import {readAdventure,writeAdventure} from '../src/game/save.js';
import {bossFixture} from './helpers/adventure-fixtures.mjs';
import {damageEnemy} from '../src/game/combat.js';
import {saveProjectiles,restoreProjectiles,isValidProjectiles} from '../src/game/projectile-state.js';
import {CombatAudio,AUDIO_FILES} from '../src/game/combat-audio.js';
import {readFileSync} from 'node:fs';
import {play} from './helpers/campaign-runner.mjs';

const target=(id=1,x=4)=>({id,x,y:0,width:2,height:3,hp:10000,maxHp:10000,combatVersion:2});
const player=()=>({x:0,y:0,facing:1});
const bounds={left:-20,right:20};
function grant(a,type,id,rarity='legendary',s=newSurvival()) {const j=newJourney();j.pending={id:crypto.randomUUID(),player:0,choices:[{type,id,rarity}]};assert.ok(chooseReward(a,j,0,s));return s;}

test('新版 24 小关有 56 场首领，30 种怪物，密度增加且全部连接可达',()=>{
 let bosses=0,before=0,after=0;const seen=new Set();
 assert.equal(Object.keys(MONSTERS).length,30);
 for(const stage of STAGES)for(const seed of [1,42,137]){
  const w=createCampaignWorld(seed,stage,6),old=createCampaignWorld(seed,stage,5);assert.ok(validateCampaign(w),`${stage.id}/${seed}`);
  const r=play(stage.id,seed,6);assert.equal(r.failed,undefined,JSON.stringify(r));assert.equal(r.recoveries,0);
  assert.deepEqual(w,createCampaignWorld(seed,stage,6));assert.equal(w.bossArenas.length,stage.chapter===2?3:2);
  assert.ok(w.enemies[w.bossArenas[0].bossId-1].isMidBoss);
  if(seed===42)bosses+=w.bossArenas.length;
  before+=old.enemies.filter(e=>!e.isBoss&&!e.parentId).length;after+=w.enemies.filter(e=>!e.isBoss&&!e.parentId).length;
  w.enemies.forEach(e=>seen.add(e.kind));assert.ok(w.supplies.some(s=>s.kind==='medkit'&&s.bossId));
 }
 assert.equal(bosses,56);assert.equal(seen.size,30);assert.ok(after/before>1.45);assert.ok(after/before<1.8);
});
test('每小关传奇保底，大关两传奇两史诗，候选可领取且品质不降级',()=>{
 for(const stage of STAGES)for(let seed=0;seed<50;seed++){
  const a=newAdventure(seed),s=newSurvival(),tier=stage.chapter===2?'world':'small';
  const choices=rewardChoices(a,`finish:${stage.id}`,'nature',0,s,tier);
  assert.equal(choices.length,tier==='world'?4:3);assert.equal(choices.filter(c=>c.rarity==='legendary').length,tier==='world'?2:1);assert.ok(choices.some(c=>c.rarity==='epic'));
  assert.deepEqual(choices,rewardChoices(a,`finish:${stage.id}`,'nature',0,s,tier));
  for(const c of choices){const clone=structuredClone(a);grant(clone,c.type,c.id,c.rarity,structuredClone(s));assert.ok(isValidAdventure(clone,1));}
 }
 const a=newAdventure(3);grant(a,'weapon','blade');grant(a,'weapon','blade','rare');assert.equal(a.qualities['weapon:blade'],'legendary');assert.equal(a.weaponRanks.blade,2);
 const s=newSurvival();s.hp=40;grant(a,'supply','life','legendary',s);assert.equal(s.lives,4);assert.equal(s.hp,40);assert.equal(a.revivalWaves,1);
});
test('单血条旧档按比例迁移，真实命数旧档保留命数，归零状态不自动复活',()=>{
 const old={version:3,character:'sister',lives:6,maxLives:12,phase:'alive',shieldRemaining:0,attacks:0,revision:4};
 const s=migrateSurvival(old);assert.equal(s.lives,3);assert.equal(s.maxHp,160);assert.equal(s.hp,80);assert.deepEqual(migrateSurvival(s),s);
 const early=migrateSurvival({...old,version:1,lives:7,hp:2,maxLives:undefined});assert.equal(early.lives,7);assert.equal(early.hp,67);
 const lifeOnly=migrateSurvival({...old,version:2,lives:4,maxLives:undefined});assert.equal(lifeOnly.lives,4);assert.equal(lifeOnly.hp,100);
 const ended=migrateSurvival({...old,lives:0,phase:'over'});assert.equal(ended.lives,0);assert.equal(ended.hp,0);assert.equal(reviveSurvival(ended),false);
 addLife(s);assert.equal(s.hp,80);heal(s,25);assert.equal(s.lives,4);assert.equal(s.hp,105);
 takeDamage(s,false,10000);assert.equal(s.lives,3);assert.equal(s.phase,'fallen');assert.equal(s.hp,0);reviveSurvival(s);assert.equal(s.hp,160);assert.equal(s.lives,3);
});
test('旧待选卡不被替换，补传奇后保存再次迁移不变',()=>{
 const a=newAdventure(1),j=newJourney();j.pending={id:'finish:old',title:'通关',family:'flight',player:0,choices:[{type:'weapon',id:'blade'},{type:'weapon',id:'bubble'},{type:'upgrade',id:'rapid'}]};
 migratePendingReward(a,j);assert.equal(j.pending.choices.length,4);assert.deepEqual(j.pending.choices.slice(0,3).map(c=>c.id),['blade','bubble','rapid']);assert.equal(j.pending.choices[3].rarity,'legendary');
 assert.ok(isValidJourney(j,createCampaignWorld(1,'rainbow-1',5),1));const saved=structuredClone(j);migratePendingReward(a,j);assert.deepEqual(j,saved);
});
test('四大招仅攻击可见敌人时充能，火环距离不合适不阻塞其他就绪技能',()=>{
 const a=newAdventure(1),s=newSurvival(),p=player();for(const id of Object.keys(SPELLS))grant(a,'spell',id,'epic');
 for(let i=0;i<100;i++)stepMagic(a,s,p,[],[],.1,i*.1,true,bounds);assert.deepEqual(Object.values(a.magic.charges),[0,0,0,0]);
 const enemy=target(1,12);stepMagic(a,s,p,[enemy],[],1,1,false,bounds);assert.equal(a.magic.charges.fire,0);
 for(const id of a.magic.equipped)a.magic.charges[id]=SPELLS[id].charge;a.magic.ready=['fire','thunder','snow','rain'];
 const r=stepMagic(a,s,p,[enemy],[],.01,2,true,bounds);assert.equal(r.events[0].id,'thunder');assert.equal(a.magic.gap,2.5);assert.ok(a.magic.ready.includes('fire'));
 const saved=structuredClone(a);stepMagic(a,s,p,[enemy],[],0,2,true,bounds);assert.deepEqual(a,saved);assert.ok(isValidMagic(a.magic));
});
test('甘霖只回血一次且不加命、不清首领弹；持续技能跨存档接续，不重复触发',()=>{
 const a=newAdventure(1),s=newSurvival(),p=player();grant(a,'spell','rain');s.hp=40;a.magic.charges.rain=26;a.magic.ready=['rain'];
 const shots=[{isActive:true,x:1},{isActive:true,x:1,bossId:3}];stepMagic(a,s,p,[target()],shots,.01,0,true,bounds);
 assert.equal(s.hp,50);assert.equal(s.lives,3);assert.equal(shots[0].isActive,false);assert.equal(shots[1].isActive,true);
 const copy=JSON.parse(JSON.stringify(a));for(let i=1;i<=41;i++)stepMagic(copy,s,p,[target()],[],.1,i*.1,false,bounds);
 assert.equal(s.hp,50);assert.equal(copy.magic.shield,1);assert.equal(copy.magic.charges.rain,0);assert.ok(isValidMagic(copy.magic));
 assert.deepEqual(consumeMagicShield(copy,p,[],5),[]);assert.equal(consumeMagicShield(copy,p,[],5),null);
});
test('雪幕冻结有免疫窗，BOSS 只减速；雷链单次同目标至多两击',()=>{
 for(const id of ['snow','thunder']){
  const a=newAdventure(1),s=newSurvival(),p=player(),e=target(),boss={...target(2,7),isBoss:true};grant(a,'spell',id);a.magic.charges[id]=SPELLS[id].charge;a.magic.ready=[id];
  let count=0;for(let i=0;i<40;i++){const r=stepMagic(a,s,p,[e,boss],[],.1,i*.1,true,bounds);count+=r.hits.filter(h=>h.enemy.id===1).length;}
  if(id==='snow'){assert.equal(boss.frozenUntil,undefined);assert.ok(e.freezeImmuneUntil>3);assert.ok(e.frozenUntil<2);assert.ok(boss.slowUntil>0);}else assert.ok(count<=2);
 }
});
test('火龙固定节拍伤害不随帧率倍增，月牙传奇子弹不递归，泡泡不重复结算直击',()=>{
 const simulate=dt=>{const a=newAdventure(1);a.weapons=['flame'];a.loadouts[0].weapons=['flame'];const p=player(),e=target();let waves=[];for(let t=0;t<2;t+=dt){waves.push(...fireLoadout(p,t,bounds,a));for(const wave of waves)stepAdventureWave(wave,[e],[],dt,t);waves=waves.filter(w=>w.isActive);}return 10000-e.hp;};
 assert.ok(Math.abs(simulate(1/60)-simulate(1/120))<=18);
 const a=newAdventure(1);grant(a,'weapon','moonblade');const p=player(),enemies=[target(1,3),target(2,7)];let waves=fireLoadout(p,0,bounds,a),children=0;
 for(let n=0;n<360;n++){const spawned=[];for(const wave of waves){const r=stepAdventureWave(wave,enemies,[],1/120,n/120);children+=r.spawned.filter(w=>w.isLegendChild).length;spawned.push(...r.spawned);}waves=[...waves.filter(w=>w.isActive),...spawned];}
 assert.equal(children,2);
 const b=newAdventure(1);b.weapons=['bubble'];b.loadouts[0].weapons=['bubble'];const e=target(1,2),[wave]=fireLoadout(player(),0,bounds,b);for(let i=0;i<100;i++)stepAdventureWave(wave,[e],[],1/120,i/120);assert.equal(10000-e.hp,WEAPONS.bubble.damage);
});
test('新怪物动作、破壳与同屏预算真实生效',()=>{
 const make=kind=>({...target(),...MONSTERS[kind],kind,baseY:0,minX:0,maxX:10,direction:1,speed:1,phase:0,elapsed:2.49,hasShell:kind==='penguin'});
 const plane=make('plane'),balloon=make('balloon');stepAdventureEnemies([plane,balloon],[player()],.1,3,[]);assert.notEqual(plane.y,balloon.y);
 const penguin=make('penguin');assert.equal(damageEnemy(penguin,0,{damage:30}),false);assert.equal(penguin.hp,10000);assert.equal(penguin.hasShell,false);damageEnemy(penguin,1,{damage:30});assert.equal(penguin.hp,9970);
 const octopus=make('octopus'),shots=[];stepAdventureEnemies([octopus],[player()],.1,3,shots);assert.equal(shots[0].kind,'inklob');for(let i=0;i<30;i++)stepAdventureEnemies([],[player()],.1,3+i*.1,shots);assert.equal(shots[0].kind,'ink');
});
test('飞行弹道与已命中记录保存恢复，继续不会重伤同一目标',()=>{
 const a=newAdventure(1),p=player(),e=target(1,2);a.weapons=['blade'];a.loadouts[0].weapons=['blade'];const waves=fireLoadout(p,0,bounds,a);stepAdventureWave(waves[0],[e],[],.1,.1);
 const state=saveProjectiles(waves,[]);assert.ok(isValidProjectiles(state,{enemies:[e]}));const restored=restoreProjectiles(JSON.parse(JSON.stringify(state)));const hp=e.hp;stepAdventureWave(restored.waves[0],[e],[],.1,.2);assert.equal(e.hp,hp);
 state.waves[0].hitIds=[999];assert.equal(isValidProjectiles(state,{enemies:[e]}),false);
});
test('127 份原创音效离线打包，混音最多 12 声部，同批发射合并且预警优先',()=>{
 for(const name of AUDIO_FILES){const wav=readFileSync(new URL(`../public/audio/combat/${name}.wav`,import.meta.url));assert.equal(wav.toString('ascii',0,4),'RIFF');assert.ok(wav.length>2000);}
 const context={currentTime:1,state:'running',destination:{},createBufferSource(){return {connect(){},start(){},stop(){},disconnect(){}};},createGain(){return {gain:{value:0,cancelScheduledValues(){},setTargetAtTime(){}},connect(){},disconnect(){}};}};
 const mixer=new CombatAudio();mixer.context=context;for(const name of AUDIO_FILES)mixer.buffers.set(name,{});
 for(let i=0;i<100;i++)mixer.play('moonblade:fire');assert.equal(mixer.voices.length,1);
 for(let i=0;i<30;i++){context.currentTime+=.2;mixer.play('blade:fire');}assert.equal(mixer.voices.length,12);
 mixer.play('boss-warning');assert.equal(mixer.voices.length,12);assert.ok(mixer.voices.some(v=>v.name==='boss-warning'));mixer.pause();assert.equal(mixer.voices.length,0);assert.equal(mixer.loops.size,0);
});

test('五类白装基础武器都能在移动与护盾阶段中打败全部 56 位首领',()=>{
 let fights=0;
 for(const stage of STAGES){
  const source=createCampaignWorld(42,stage,6);
  for(const arena of source.bossArenas)for(const kind of ['blade','bubble','stars','moonblade','flame']){
   const w=structuredClone(source),e=w.enemies[arena.bossId-1];
   w.enemies.filter(n=>n.isBoss&&n.id!==e.id).forEach(n=>{n.isDefeated=true;n.hp=0;});
   const a=newAdventure(2);a.weapons=[kind];a.loadouts[0].weapons=[kind];a.loadouts[0].weapon=kind;
   const p={x:e.x-6,y:arena.y,facing:1,isGrounded:true,ground:w.platforms[arena.floorId]};let waves=[];
   for(let t=0;t<45&&!e.isDefeated;t+=1/60){
    p.x=Math.max(arena.left+1,Math.min(arena.right-1,e.x-6));p.facing=e.x>=p.x?1:-1;
    stepBosses(w,p,1/60,t,[]);waves.push(...fireLoadout(p,t,{left:p.x-20,right:p.x+20},a));
    const spawned=[];for(const wave of waves)spawned.push(...stepAdventureWave(wave,[e],w.platforms,1/60,t).spawned);
    waves=[...waves.filter(w=>w.isActive),...spawned];
   }
   assert.ok(e.isDefeated,`${stage.id}/${e.name}/${kind} 基础伤害不足或无法命中`);fights++;
  }
 }
 assert.equal(fights,280);
});
test('飞行存档保留同轮共享命中特效，备份旧单血条且不重置新档待复活状态',()=>{
 const a=newAdventure(1);a.weaponRanks.blade=3;a.weapons=['blade'];a.loadouts[0].weapons=['blade'];
 const waves=fireLoadout(player(),0,bounds,a),charge={isUsed:false};waves.forEach(w=>{w.floralCharge=charge;w.bindingCharge=charge;});
 const restored=restoreProjectiles(JSON.parse(JSON.stringify(saveProjectiles(waves,[]))));
 restored.waves[0].floralCharge.isUsed=true;assert.ok(restored.waves.every(w=>w.floralCharge.isUsed));
 const fixture=bossFixture('boss-play'),key=['garden','active','adventure','v1'].join('-'),data=new Map();
 const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 fixture.state.survival={version:3,character:'sister',lives:5,maxLives:10,phase:'alive',shieldRemaining:0,attacks:0,revision:0};
 data.set(key,JSON.stringify(fixture));const migrated=readAdventure(storage);assert.ok(migrated);
 writeAdventure(migrated.run,migrated.state,storage);assert.equal(data.get(`${key}-before-hp-lives`),JSON.stringify(fixture));
 takeDamage(migrated.state.survival,false,9999);migrated.state.projectiles=saveProjectiles(waves,[]);
 writeAdventure(migrated.run,migrated.state,storage);const loaded=readAdventure(storage);
 assert.ok(loaded);assert.equal(loaded.state.survival.lives,2);assert.equal(loaded.state.survival.hp,0);assert.equal(loaded.state.survival.phase,'fallen');
});

test('星雨命中后消失，贯穿光刃连续命中；传奇雷链为回响保留第二击',()=>{
 for(const kind of ['stars','blade']){
  const a=newAdventure(1);a.weapons=[kind];a.loadouts[0].weapons=[kind];const enemies=[target(1,3),target(2,7)],[wave]=fireLoadout(player(),0,bounds,a);
  for(let i=0;i<120;i++)stepAdventureWave(wave,enemies,[],1/120,i/120);
  assert.ok(enemies[0].hp<10000);assert.equal(enemies[1].hp<10000,kind==='blade');
 }
 const a=newAdventure(2),s=newSurvival();for(let i=0;i<3;i++)grant(a,'spell','thunder','epic');grant(a,'spell','thunder','legendary');assert.equal(a.magic.ranks.thunder,3);
 a.magic.charges.thunder=20;a.magic.ready=['thunder'];const times=[],e=target();
 for(let i=0;i<20;i++){const r=stepMagic(a,s,player(),[e],[],.1,i*.1,true,bounds);for(const h of r.hits)if(h.enemy.id===e.id)times.push(i*.1);}
 assert.equal(times.length,2);assert.ok(times[1]>=1.3);
});
