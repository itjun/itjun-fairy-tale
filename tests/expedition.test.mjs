import test from 'node:test';
import assert from 'node:assert/strict';
import { createCampaignWorld, validateCampaign } from '../shared/campaign.js';
import { MONSTERS, UPGRADES, WEAPONS } from '../shared/adventure-catalog.js';
import { newAdventure, newJourney, queueReward, openReward, chooseReward, recycleReward, rewardChoices, upgradePower, isValidJourney } from '../src/game/adventure.js';
import { newSurvival } from '../src/game/characters.js';
import { damageWithBuild, recordDefeat, completeEncounter, completeRoute, buyRecovery, tickResources, useRecovery } from '../src/game/expedition.js';
import { stepAdventureEnemies } from '../src/game/adventure-enemies.js';
import { fireAdventureWeapon, stepAdventureWave } from '../src/game/adventure-combat.js';
import { readAdventure, writeAdventure } from '../src/game/save.js';
import { openStore } from '../server/store.mjs';

test('八关扩展怪物种类与密度，安全营地不刷怪，旧地图仍可重建', () => {
  const seen = new Set(); let before = 0, after = 0;
  for (const level of ['rainbow','family','sweet','beach','meadow','snow','forest','cartoon']) for (let seed=0; seed<20; seed++) {
    const old = createCampaignWorld(seed, level, 2), world = createCampaignWorld(seed, level, 3);
    assert.ok(validateCampaign(world)); assert.deepEqual(world.platforms, old.platforms);
    before += old.enemies.filter(e => !e.parentId).length; after += world.enemies.filter(e => !e.parentId).length;
    assert.deepEqual(world, createCampaignWorld(seed, level, 3));
    world.enemies.forEach(e => { seen.add(e.kind); assert.ok(!world.camps.some(c => Math.abs(c.x-e.x)<9 && Math.abs(c.y-e.y)<5)); });
  }
  assert.equal(seen.size, 24); assert.ok(after / before > 1.5 && after / before < 1.8);
});

test('击杀和精英不弹奖励，通关可选补命，领取与回收不能两头领', async () => {
  const { GardenEngine } = await import('../src/game/engine.js');
  const a = newAdventure(42), s = newSurvival(), j = newJourney(), world = createCampaignWorld(42,'forest',3);
  const game = Object.assign(Object.create(GardenEngine.prototype), { adventure:a, survival:s, journey:j, world, levelKey:'forest:42', elapsed:3, players:[{}], defeatedIds:[], pickups:[], callbacks:{onSound(){}}, publish(){} });
  const enemies = world.enemies.filter(e => !e.parentId).slice(0,15);
  enemies[0].isElite = true; enemies[1].isElite = true;
  for (const enemy of enemies) { enemy.isDefeated = true; game.rewardEnemy(enemy); game.rewardEnemy(enemy); }
  assert.equal(a.resources.kills,15);
  assert.deepEqual(j.queued,[]);assert.equal(a.resources.balance,0);
  queueReward(j,'finish:forest:42','nature','小关通关啦');
  s.lives=5; openReward(a,j,s); const id=j.pending.id;
  assert.ok(j.pending.choices.some(c => c.type==='supply' && c.id==='heal'));
  const choice=j.pending.choices.findIndex(c=>c.id==='heal'); assert.ok(chooseReward(a,j,choice,s)); assert.equal(s.lives,6);
  assert.equal(chooseReward(a,j,choice,s),false); assert.ok(j.claimed.includes(id));
  queueReward(j,'finish:forest:43','nature','小关通关啦');openReward(a,j,s); const balance=a.resources.balance;
  assert.ok(recycleReward(a,j)); assert.equal(a.resources.balance,balance+1); assert.equal(recycleReward(a,j),false);
});

test('奖励池耗尽仍有有效补给，三选项不产生空洞，旧候选保存不改变', () => {
  const a=newAdventure(4), s=newSurvival(); a.weapons=Object.keys(WEAPONS);
  Object.entries(UPGRADES).forEach(([id,d]) => {a.upgrades[id]=d.maxRank || 1;});
  a.loadouts[0].upgrades=['duplicate']; s.lives=1;
  for(let i=0;i<50;i++) {
    const choices=rewardChoices(a,`exhausted:${i}`,'nature',0,s), j=newJourney();
    j.pending={id:`exhausted:${i}`,family:'nature',title:'奖励',player:0,choices};
    assert.ok(choices.every(Boolean)); assert.ok(isValidJourney(j,createCampaignWorld(4,'rainbow',3),1));
  }
});

test('花瓣与点心补命，上限九条，死亡不补命，天赋与护甲按顺序消耗', () => {
 const a=newAdventure(1),s=newSurvival('dad'),powers={petal:1,snack:1,armor:1,courage:1};a.resources.petals=12;a.resources.snack=1;
 assert.equal(damageWithBuild(a,s,powers,'snow:1',0),'shield');assert.equal(a.resources.armorZones.length,0);
 assert.equal(damageWithBuild(a,s,powers,'snow:1',0),'armor');assert.equal(s.lives,9);
 assert.equal(damageWithBuild(a,s,powers,'snow:1',0),'hurt');assert.equal(s.lives,9);assert.equal(a.resources.snack,0);
 damageWithBuild(a,s,powers,'snow:1',0);assert.equal(s.lives,9);assert.equal(a.resources.petals,0);
 damageWithBuild(a,s,powers,'snow:1',0);assert.equal(s.lives,8);
 s.lives=1;assert.equal(damageWithBuild(a,s,powers,'snow:1',0),'courage');assert.equal(s.lives,1);
 assert.equal(damageWithBuild(a,s,powers,'snow:1',0,true),'death');assert.equal(s.lives,0);
 a.resources.petals=12;assert.equal(useRecovery(a,s,powers),false);assert.equal(s.lives,0);
});

test('补给、护罩、支路、击败事件只结算一次，营地扣费保存并跨关保留', () => {
  const a=newAdventure(2),s=newSurvival(), powers={pocket:1,explorer:1,wreath:1,thrift:1};
  const world=createCampaignWorld(2,'rainbow',3),enemy=world.enemies[0]; enemy.isElite=true;
  s.lives=7; recordDefeat(a,s,powers,enemy,'rainbow:2'); assert.equal(s.lives,7);
  const before=structuredClone(a); assert.equal(recordDefeat(a,s,powers,enemy,'rainbow:2'),null); assert.deepEqual(a,before);
  assert.equal(completeRoute(a,powers,'rainbow:2',0),false); assert.equal(completeRoute(a,powers,'rainbow:2',0),false);
  world.enemies.filter(e=>e.zone===0).forEach(e=>{e.isDefeated=true;});
  assert.ok(completeEncounter(a,powers,world,0,'rainbow:2')); a.resources.wreathShield=0;
  assert.equal(completeEncounter(a,powers,world,0,'rainbow:2'),false); assert.equal(a.resources.wreathShield,0);
  s.lives=4; a.resources.balance=10;
  assert.ok(buyRecovery(a,s,powers,'rainbow:2:camp0')); assert.equal(a.resources.balance,7); assert.equal(s.lives,5);
  assert.equal(buyRecovery(a,s,powers,'rainbow:2:camp0'),false); assert.equal(a.resources.balance,7);
  const restored=JSON.parse(JSON.stringify(a)); assert.equal(buyRecovery(restored,s,powers,'rainbow:2:camp0'),false);
  restored.resources.bindCooldown=5; tickResources(restored,0); assert.equal(restored.resources.bindCooldown,5);
  tickResources(restored,1); assert.equal(restored.resources.bindCooldown,4);
});

test('新怪物确实执行不同动作，召唤有限，屏外和过量攻击受限', () => {
  const make = (kind,id=1) => ({...MONSTERS[kind],kind,id,x:5,y:0,baseY:0,minX:3,maxX:7,direction:1,speed:1,phase:0,elapsed:2.49,hp:4,width:1.5,height:1.5});
  const player={x:0,y:0}, shots=[];
  for (const kind of ['flowerpot','pillow','ink']) {
    const e=make(kind);stepAdventureEnemies([e],[player],0.02,3,shots);
  }
  assert.ok(shots.some(s=>s.kind==='vine'));assert.ok(shots.some(s=>s.kind==='shock'));assert.ok(shots.some(s=>s.kind==='ink'));
  const burrow=make('burrow');burrow.elapsed=0;stepAdventureEnemies([burrow],[player],0.01,0.01,[]);assert.ok(burrow.isHidden);
  const drop=make('icicle');drop.elapsed=0;stepAdventureEnemies([drop],[player],0.01,0.01,[]);assert.ok(drop.y>3);
  const group=Array.from({length:8},(_,i)=>make('fish',i+1));group[7].x=40;
  const limited=[];stepAdventureEnemies(group,[player],0.02,3,limited,{bounds:{left:-10,right:20},maxAttackers:3,attackGate:{next:0}});
  assert.equal(limited.length,1);assert.equal(group.filter(e=>!e.isWaiting).length,3);
  const w=createCampaignWorld(5,'cartoon',3),parent=w.enemies.find(e=>e.kind==='paint');
  assert.ok(parent);parent.elapsed=2.5;parent.phase=0;parent.x=5;
  for(let i=0;i<1000;i++)stepAdventureEnemies(w.enemies,[player],0.02,3+i*0.02,[],{allEnemies:w.enemies});
  assert.equal(parent.childIds.length,2);assert.ok(parent.childIds.every(id=>!w.enemies[id-1].isDormant));
});

test('束缚仅首次命中触发，叶盾减伤不会破坏光刃贯穿', () => {
  const targets=[1,2].map(id=>({id,x:id*5,y:0,width:1.5,height:2,hp:4,isDefeated:false,isGuarding:id===1,direction:-1}));
  const [wave]=fireAdventureWeapon({x:0,y:0,facing:1},0,{left:-10,right:20},'blade');wave.bindingCharge={isUsed:false};
  for(let i=1;i<200;i++)stepAdventureWave(wave,targets,[],1/120,i/120);
  assert.equal(targets[0].hp,4);assert.equal(targets[1].hp,3);assert.ok(targets[0].boundUntil>0);assert.equal(targets[1].boundUntil,undefined);
});

test('版本3完整存档与计分服务一致，资源与召唤状态往返，非法资源拒绝', () => {
  const w=createCampaignWorld(9,'cartoon',3),a=newAdventure(9),s=newSurvival(),j=newJourney();a.resources.balance=17;a.resources.camps=['cartoon:9:0'];
  queueReward(j,'elite:cartoon:9:1','nature','挑战完成');openReward(a,j,s);
  const run={id:crypto.randomUUID(),startedAt:new Date().toISOString(),seed:9,levelId:'cartoon',scoringVersion:3,generationVersion:3,players:1,status:'paused',revision:1,flowers:0,collectedIds:[],defeatedIds:[],platform:0,seconds:3};
  const state={version:3,seed:9,levelId:'cartoon',elapsed:3,collectedIds:[],defeatedIds:[],visited:[],switches:[],enemies:w.enemies,players:[{safeId:0}],adventure:a,journey:j,survival:s};
  const map=new Map(), storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
  writeAdventure(run,state,storage);const restored=readAdventure(storage);assert.ok(restored);assert.deepEqual(restored.state.adventure,a);assert.deepEqual(restored.state.journey,j);
  const db=openStore(':memory:');try{assert.equal(db.save(run).generationVersion,3);}finally{db.close();}
  a.resources.balance=-1;writeAdventure(run,state,storage);assert.equal(readAdventure(storage),null);
});
