import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendedStarter, starterAdventure, isValidStarter } from '../src/game/starter-build.js';
import { isValidAdventure, activeWeapons, migrateAdventure } from '../src/game/adventure.js';
import { newSurvival } from '../src/game/characters.js';
import { fireLoadout } from '../src/game/adventure-combat.js';
import { newCombatLoot, rollCombatLoot, lootPosition, nearbyLoot, chooseLifeLoot, isValidCombatLoot } from '../src/game/combat-loot.js';
import { damageWithBuild, useRecovery } from '../src/game/expedition.js';
import { createCampaignWorld } from '../shared/campaign.js';
import { GardenEngine } from '../src/game/engine.js';
import { bossFixture } from './helpers/adventure-fixtures.mjs';
import { readAdventure, writeAdventure } from '../src/game/save.js';

const storage=()=>{const map=new Map();return {getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};};

test('四位角色推荐搭配有区别，自选组合按实际武器和本领出发，跨关迁移不补回未选弯刀',()=>{
  const builds=['dad','mom','sister','little'].map(recommendedStarter);
  assert.equal(new Set(builds.map(b=>JSON.stringify(b))).size,4);
  for(const build of builds){assert.ok(isValidStarter(build));assert.deepEqual(build.weapons,['moonblade']);assert.ok(isValidAdventure(starterAdventure(42,build),1));}
  const build={weapons:['blade'],upgrades:['wide','frost']},a=starterAdventure(42,build);
  const waves=fireLoadout({x:0,y:0,facing:1},0,{left:-20,right:20},a);
  assert.deepEqual(waves.map(w=>w.kind),['blade']);assert.equal(waves[0].powers.wide,1);
  const next=migrateAdventure(structuredClone(a));assert.deepEqual(activeWeapons(next),build.weapons);assert.ok(!next.weapons.includes('moonblade'));assert.deepEqual(next.upgrades,{wide:1,frost:1});
  for(const invalid of [{weapons:[],upgrades:[]},{weapons:['blade','blade'],upgrades:[]},{weapons:['blade','moonblade'],upgrades:[]},{weapons:['blade'],upgrades:['wide','double']},{weapons:['blade'],upgrades:['wide','armor','petal']}])assert.equal(starterAdventure(1,invalid),null);
  for(const id of ['double','split','fan','seek','returnSplit','bloom','companion','linger'])assert.equal(isValidStarter({weapons:['bubble'],upgrades:[id]}),false);
});

function dropped(seed=42) {
  const world=createCampaignWorld(seed,'rainbow-1',5),loot=newCombatLoot(),player={x:world.start.x,y:world.start.y,safe:world.start};
  const defeated=[];
  for(const e of world.enemies.filter(e=>!e.isBoss&&!e.parentId&&!e.isSummoned)){defeated.push(e.id);e.hp=0;e.isDefeated=true;rollCombatLoot(loot,world,e,player);}
  return {world,loot,player,defeated};
}
test('小怪低频掉落由种子固定，保底不超过八只、每小关最多三份，BOSS 和召唤物不掉',()=>{
  const a=dropped(),b=dropped();assert.deepEqual(a.loot,b.loot);assert.ok(a.loot.drops.length>0&&a.loot.drops.length<=3);assert.ok(isValidCombatLoot(a.loot,a.world,a.defeated));
  assert.ok(a.defeated.indexOf(a.loot.drops[0].enemyId)>=2);assert.ok(a.defeated.indexOf(a.loot.drops[0].enemyId)<8);
  assert.notDeepEqual(a.loot.drops,dropped(137).loot.drops);
  const before=structuredClone(a.loot);for(const e of [{id:999,isBoss:true},{id:1000,parentId:1},{id:1001,isSummoned:true}])assert.equal(rollCombatLoot(a.loot,a.world,e,a.player),null);assert.deepEqual(a.loot,before);
  for(const d of a.loot.drops){const p=lootPosition(a.world,d);assert.ok(Math.abs(p.x-a.world.platforms[d.platformId].x)<a.world.platforms[d.platformId].width/2);assert.equal(nearbyLoot(a.loot,a.world,{x:p.x,y:p.y-1})?.enemyId,d.enemyId);}
});

test('补给弹窗必须选择后确认，回血与加长血条分别生效，不能重复领取或满血浪费',()=>{
  const {loot}=dropped(),a=starterAdventure(1,recommendedStarter('sister')),s=newSurvival(),id=loot.drops[0].enemyId;
  s.lives=5;assert.equal(chooseLifeLoot(loot,a,s,id,'heal'),false);loot.pendingId=id;
  assert.ok(chooseLifeLoot(loot,a,s,id,'heal'));assert.equal(s.lives,7);assert.equal(s.maxLives,9);assert.equal(chooseLifeLoot(loot,a,s,id,'heart'),false);
  const other=newCombatLoot();other.drops=[{enemyId:2,choice:null}];other.pendingId=2;s.lives=9;
  assert.equal(chooseLifeLoot(other,a,s,2,'heal'),false);assert.ok(chooseLifeLoot(other,a,s,2,'heart'));assert.equal(s.maxLives,10);assert.equal(s.lives,10);
});

test('备用补给保留到下次实际受伤，暂停和普通更新不消耗，无法复活零血玩家',()=>{
  const a=starterAdventure(1,{weapons:['blade'],upgrades:[]}),s=newSurvival(),loot={drops:[{enemyId:1,choice:null}],pendingId:1};s.lives=5;
  assert.ok(chooseLifeLoot(loot,a,s,1,'reserve'));assert.equal(a.resources.reserveHearts,2);
  for(let i=0;i<20;i++)assert.equal(useRecovery(a,s,{}),false);assert.equal(s.lives,5);assert.equal(a.resources.reserveHearts,2);
  assert.equal(damageWithBuild(a,s,{},'rainbow:1',0),'hurt');assert.equal(s.lives,6);assert.equal(a.resources.reserveHearts,0);
  s.lives=1;a.resources.reserveHearts=2;assert.equal(damageWithBuild(a,s,{},'rainbow:1',0),'death');assert.equal(s.lives,0);assert.equal(s.phase,'over');
});

test('掉落、待选择、领取结果与自选初始装备保存恢复，非法掉落拒绝，旧档仍可读',()=>{
  const f=bossFixture('boss-moon','rainbow-1'),{world,loot,defeated}=dropped(),mem=storage();
  f.state.enemies=world.enemies;f.state.defeatedIds=defeated;f.run.defeatedIds=defeated;f.state.combatLoot=loot;
  f.state.adventure=starterAdventure(42,{weapons:['bubble'],upgrades:['frost']});loot.pendingId=loot.drops[0].enemyId;
  writeAdventure(f.run,f.state,mem);let saved=readAdventure(mem);assert.ok(saved);assert.deepEqual(saved.state.combatLoot,loot);assert.deepEqual(activeWeapons(saved.state.adventure),['bubble']);
  assert.ok(chooseLifeLoot(saved.state.combatLoot,saved.state.adventure,saved.state.survival,loot.pendingId,'heart'));writeAdventure(saved.run,saved.state,mem);saved=readAdventure(mem);assert.equal(saved.state.combatLoot.drops[0].choice,'heart');assert.equal(saved.state.survival.maxLives,10);
  for(const invalid of [{...loot,pendingId:99999},{...loot,drops:[{...loot.drops[0],offsetX:99999}]},{...loot,drops:[{...loot.drops[0],isDeferred:'yes'}]},{...loot,drops:[{...loot.drops[0],isDeferred:true}]},{...loot,drops:[...loot.drops,loot.drops[0]]}]){writeAdventure(f.run,{...f.state,combatLoot:invalid},mem);assert.equal(readAdventure(mem),null);}
  delete f.state.combatLoot;writeAdventure(f.run,f.state,mem);assert.ok(readAdventure(mem));
});

function lootEngine() {
  const {world,loot}=dropped();loot.drops=loot.drops.slice(0,1);
  const point=lootPosition(world,loot.drops[0]);let opened=0;
  const game=Object.assign(Object.create(GardenEngine.prototype),{world,combatLoot:loot,players:[{x:point.x,y:point.y-1}],survival:newSurvival(),adventure:starterAdventure(42,recommendedStarter('dad')),journey:{pending:null},isPaused:false,elapsed:1,keys:new Set(['Space','KeyJ']),touch:new Set(['jump']),waves:[],enemyShots:[],callbacks:{onSound(){},onLifeLoot(){opened++;}},skillEffects:{burst(){}},publish(){}});
  return {game,point,opened:()=>opened};
}

test('游戏更新时靠近补给自动暂停并通知弹窗，清除操作但不自动领取，连续帧不重复打开',()=>{
  const {game:g,point,opened}=lootEngine();g.players[0].x=point.x+10;
  assert.equal(g.updateLifeLoot(),false);assert.equal(opened(),0);
  g.players[0].x=point.x;g.adventure.effects.rainbowBoost=40;g.survival.shieldRemaining=12;
  g.tick();assert.ok(g.isPaused);assert.equal(opened(),1);assert.equal(g.combatLoot.pendingId,g.combatLoot.drops[0].enemyId);
  assert.equal(g.combatLoot.drops[0].choice,null);assert.equal(g.keys.size,0);assert.equal(g.touch.size,0);
  g.pause(false);for(let i=0;i<120;i++)g.tick();assert.ok(g.isPaused);assert.equal(opened(),1);
  assert.equal(g.adventure.effects.rainbowBoost,40);assert.equal(g.survival.shieldRemaining,12);
  assert.ok(g.chooseLifeLoot(g.combatLoot.pendingId,'heart'));g.pause(false);assert.equal(g.updateLifeLoot(),false);assert.equal(g.survival.maxLives,10);
});

test('先放这里不会原地反复弹出，保存恢复仍暂放，离开再靠近才重新自动打开',()=>{
  const {game:g,point,opened}=lootEngine();g.tick();const id=g.combatLoot.pendingId;
  assert.ok(g.leaveLifeLoot(id));g.pause(false);
  for(let i=0;i<20;i++)assert.equal(g.updateLifeLoot(),false);assert.equal(opened(),1);
  const f=bossFixture('boss-loot','rainbow-1'),mem=storage();f.state.combatLoot=structuredClone(g.combatLoot);
  writeAdventure(f.run,f.state,mem);const saved=readAdventure(mem);assert.ok(saved);assert.equal(saved.state.combatLoot.drops[0].isDeferred,true);
  g.combatLoot=saved.state.combatLoot;assert.equal(g.updateLifeLoot(),false);
  g.players[0].x=point.x+3.2;assert.equal(g.updateLifeLoot(),false);assert.ok(g.combatLoot.drops[0].isDeferred);
  g.players[0].x=point.x+4;assert.equal(g.updateLifeLoot(),false);assert.equal(g.combatLoot.drops[0].isDeferred,undefined);
  g.players[0].x=point.x;g.tick();assert.ok(g.isPaused);assert.equal(opened(),2);assert.equal(g.combatLoot.pendingId,id);
});

test('暂停、掉坑、零生命、通关和其他待选奖励期间不会抢开补给',()=>{
  for(const state of [{isPaused:true},{isCompleted:true},{survival:{...newSurvival(),phase:'fallen'}},{survival:{...newSurvival(),phase:'over',lives:0}},{journey:{pending:{id:'reward'}}}]) {
    const {game,opened}=lootEngine();Object.assign(game,state);assert.equal(game.updateLifeLoot(),false);assert.equal(opened(),0);assert.equal(game.combatLoot.pendingId,null);
  }
});

test('引擎只能在近处打开掉落，待选时不能解除暂停，领取有同步防重；初始搭配不能在游玩中重置',()=>{
  const {world,loot}=dropped(),drop=loot.drops[0],point=lootPosition(world,drop);
  const g=Object.assign(Object.create(GardenEngine.prototype),{world,combatLoot:loot,players:[{x:0,y:0}],survival:newSurvival(),adventure:starterAdventure(42,recommendedStarter('dad')),journey:{pending:null},isPaused:false,elapsed:1,keys:new Set(),touch:new Set(),waves:[],enemyShots:[],callbacks:{onSound(){}},skillEffects:{burst(){}},publish(){}});
  assert.equal(g.openLifeLoot(drop.enemyId),false);g.players[0]={x:point.x,y:point.y-1};assert.ok(g.openLifeLoot(drop.enemyId));assert.ok(g.isPaused);g.pause(false);assert.ok(g.isPaused);
  assert.equal(g.configureStarter(recommendedStarter('mom')),false);assert.ok(g.chooseLifeLoot(drop.enemyId,'heart'));assert.equal(g.chooseLifeLoot(drop.enemyId,'heart'),false);assert.equal(g.survival.maxLives,10);g.pause(false);assert.equal(g.isPaused,false);
});

test('真实远处击杀结算产生补给，靠近前不弹窗，同只小怪结算两次不会重抽掉落',()=>{
  const world=createCampaignWorld(42,'rainbow-1',5),g=Object.assign(Object.create(GardenEngine.prototype),{world,levelKey:'rainbow-1:42',players:[{safe:world.start}],adventure:starterAdventure(42,{weapons:['blade'],upgrades:[]}),survival:newSurvival(),journey:{fragments:0},combatLoot:newCombatLoot(),defeatedIds:[],pickups:[],enemyShots:[],elapsed:1,callbacks:{onSound(){},onReward(){assert.fail('远处击杀不能直接打开补给选择');}},publish(){}});
  for(const enemy of world.enemies.filter(e=>!e.isBoss&&!e.parentId).slice(0,8)) {
    enemy.isDefeated=true;enemy.hp=0;g.rewardEnemy(enemy);
    const before=structuredClone(g.combatLoot);g.rewardEnemy(enemy);assert.deepEqual(g.combatLoot,before);
  }
  assert.ok(g.combatLoot.drops.length>0);assert.equal(g.combatLoot.pendingId,null);
});
