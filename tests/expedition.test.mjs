import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomWorld } from '../shared/room-world.js';
import { WORLD_ACTS } from '../shared/levels.js';
import { ADVENTURE_GENERATION_VERSION } from '../shared/adventure-catalog.js';
import { newRoomState } from '../src/game/rooms.js';
import { roomFixture } from './helpers/adventure-fixtures.mjs';
import { MONSTERS } from '../shared/adventure-catalog.js';
import { newAdventure, newJourney, chooseReward, recycleReward } from '../src/game/adventure.js';
import { newSurvival } from '../src/game/characters.js';
import { damageWithBuild, recordDefeat, completeEncounter, tickResources, useRecovery } from '../src/game/expedition.js';
import { stepAdventureEnemies } from '../src/game/adventure-enemies.js';
import { fireAdventureWeapon, stepAdventureWave } from '../src/game/adventure-combat.js';
import { readAdventure, writeAdventure } from '../src/game/save.js';
import { openStore } from '../server/store.mjs';

test('击杀和精英不弹奖励，通关可选补命，领取与回收不能两头领', async () => {
  const { GardenEngine } = await import('../src/game/engine.js');
  const a = newAdventure(42), s = newSurvival(), j = newJourney(), world = createRoomWorld(42, WORLD_ACTS[6]);
  const game = Object.assign(Object.create(GardenEngine.prototype), { adventure:a, survival:s, journey:j, world, roomState:newRoomState(world), levelKey:'forest-world:42', elapsed:3, players:[{}], defeatedIds:[], pickups:[], enemyShots:[], callbacks:{onSound(){}}, publish(){} });
  const enemies = world.enemies.filter(e => !e.parentId).slice(0,15);
  enemies[0].isElite = true; enemies[1].isElite = true;
  for (const enemy of enemies) { enemy.isDefeated = true; game.rewardEnemy(enemy); game.rewardEnemy(enemy); }
  assert.equal(a.resources.kills,15);
  assert.deepEqual(j.queued,[]);assert.equal(j.pending,null);
  s.hp=50; j.pending={id:'finish:forest:42',family:'nature',title:'选一份',player:0,choices:[{type:'supply',id:'heal',rarity:'common'}],rewardVersion:1};
  assert.ok(chooseReward(a,j,[0],s)); assert.equal(s.hp,75);assert.equal(s.lives,3);
  assert.equal(chooseReward(a,j,[0],s),false); assert.ok(j.claimed.includes('finish:forest:42'));
  j.pending={id:'finish:forest:43',family:'nature',title:'选一份',player:0,choices:[{type:'supply',id:'fragments',rarity:'common'}],rewardVersion:1};
  const balance=a.resources.balance;
  assert.ok(recycleReward(a,j)); assert.equal(a.resources.balance,balance+1); assert.equal(recycleReward(a,j),false);
});

test('花瓣与点心回血不加命，死亡不恢复，天赋与护甲按顺序消耗', () => {
 const a=newAdventure(1),s=newSurvival('dad'),powers={petal:1,snack:1,armor:1,courage:1};a.resources.petals=12;a.resources.snack=1;
 assert.equal(damageWithBuild(a,s,powers,'snow:1',0),'shield');assert.equal(a.resources.armorZones.length,0);
 assert.equal(damageWithBuild(a,s,powers,'snow:1',0),'armor');assert.equal(s.hp,100);
 assert.equal(damageWithBuild(a,s,powers,'snow:1',0),'hurt');assert.equal(s.hp,100);assert.equal(a.resources.snack,0);
 damageWithBuild(a,s,powers,'snow:1',0);assert.equal(s.hp,100);assert.equal(a.resources.petals,0);
 damageWithBuild(a,s,powers,'snow:1',0);assert.equal(s.hp,90);assert.equal(s.lives,3);
 s.hp=10;assert.equal(damageWithBuild(a,s,powers,'snow:1',0),'courage');assert.equal(s.hp,10);
 s.lives=1;assert.equal(damageWithBuild(a,s,powers,'snow:1',0,true),'death');assert.equal(s.lives,0);assert.equal(s.hp,0);
 a.resources.petals=12;assert.equal(useRecovery(a,s,powers),false);assert.equal(s.lives,0);
});

test('护罩和击败事件只结算一次，冷却按游玩时间减少', () => {
  const a=newAdventure(2),s=newSurvival(), powers={pocket:1,explorer:1,wreath:1,thrift:1};
  const world=createRoomWorld(2,WORLD_ACTS[0]),enemy=world.enemies[0]; enemy.isElite=true;
  s.lives=7; recordDefeat(a,s,powers,enemy,'rainbow:2'); assert.equal(s.lives,7);
  const before=structuredClone(a); assert.equal(recordDefeat(a,s,powers,enemy,'rainbow:2'),null); assert.deepEqual(a,before);
  world.enemies.filter(e=>e.zone===0).forEach(e=>{e.isDefeated=true;});
  assert.ok(completeEncounter(a,powers,world,0,'rainbow:2')); a.resources.wreathShield=0;
  assert.equal(completeEncounter(a,powers,world,0,'rainbow:2'),false); assert.equal(a.resources.wreathShield,0);
  const restored=JSON.parse(JSON.stringify(a));
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
  const w=[5,1,42,137,999].map(seed=>createRoomWorld(seed,WORLD_ACTS[7])).find(world=>world.enemies.some(e=>e.kind==='paint'&&e.childIds));
  assert.ok(w,'卡通世界里有会召唤的彩笔桶');const parent=w.enemies.find(e=>e.kind==='paint'&&e.childIds);parent.isDormant=false;parent.elapsed=2.5;parent.phase=0;parent.x=5;
  for(let i=0;i<1000;i++)stepAdventureEnemies(w.enemies,[player],0.02,3+i*0.02,[],{allEnemies:w.enemies});
  assert.equal(parent.childIds.length,2);assert.ok(parent.childIds.every(id=>!w.enemies[id-1].isDormant));
});

test('束缚仅首次命中触发，碰到叶盾后光刃消失', () => {
  const targets=[1,2].map(id=>({id,x:id*5,y:0,width:1.5,height:2,hp:4,isDefeated:false,isGuarding:id===1,direction:-1}));
  const [wave]=fireAdventureWeapon({x:0,y:0,facing:1},0,{left:-10,right:20},'blade');wave.bindingCharge={isUsed:false};
  for(let i=1;i<200;i++)stepAdventureWave(wave,targets,[],1/120,i/120);
  assert.equal(targets[0].hp,4);assert.equal(targets[1].hp,4);assert.ok(targets[0].boundUntil>0);assert.equal(targets[1].boundUntil,undefined);
});

test('存档与计分服务一致，碎片和没选完的奖励往返不变，非法资源拒绝', () => {
  const f=roomFixture('reward'),a=f.state.adventure;a.resources.balance=17;
  const map=new Map(), storage={getItem:k=>map.get(k) ?? null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
  writeAdventure(f.run,f.state,storage);const restored=readAdventure(storage);assert.ok(restored);
  assert.deepEqual(restored.state.adventure,JSON.parse(JSON.stringify(a)));assert.deepEqual(restored.state.journey,JSON.parse(JSON.stringify(f.state.journey)));
  const db=openStore(':memory:');try{assert.equal(db.save(f.run).generationVersion,ADVENTURE_GENERATION_VERSION);}finally{db.close();}
  a.resources.balance=-1;writeAdventure(f.run,f.state,storage);assert.equal(readAdventure(storage),null);
});
