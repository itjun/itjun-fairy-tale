import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomWorld } from '../shared/room-world.js';
import { WORLD_ACTS } from '../shared/levels.js';
import { WEAPONS, UPGRADES, MONSTERS } from '../shared/adventure-catalog.js';
import { newAdventure, newJourney, upgradePower } from '../src/game/adventure.js';
import { newSurvival } from '../src/game/characters.js';
import { doorChoices, openRoomReward } from '../src/game/room-rewards.js';
import { fireAdventureWeapon, stepAdventureWave } from '../src/game/adventure-combat.js';
import { stepAdventureEnemies, releaseCandyChildren } from '../src/game/adventure-enemies.js';
import { readAdventure, writeAdventure } from '../src/game/save.js';
import { roomFixture } from './helpers/adventure-fixtures.mjs';
const monster = (id, x, y=0) => ({id,x,y,width:1.5,height:2,hp:20,isDefeated:false});

test('武器专属强化只在装上对应武器时生效',()=>{
 const a=newAdventure(1);a.weapons.push('bubble');a.upgrades.linger=1;a.loadouts[0].upgrades=['linger'];
 assert.equal(upgradePower(a).linger,undefined);
 a.loadouts[0].weapon='bubble';a.loadouts[0].weapons=['bubble'];
 assert.equal(upgradePower(a).linger,1);assert.equal(a.upgrades.linger,1);
});

test('各种武器确实命中，光刃贯穿、星镖往返、花种范围、追踪与组合有效',()=>{
 for(const weapon of Object.keys(WEAPONS)) {
  const enemies=[monster(1,6),monster(2,13)],player={x:0,y:0,facing:1};
  let waves=fireAdventureWeapon(player,0,{left:-20,right:20},weapon,{frost:1,area:1});let hits=0;
  assert.ok(waves.length);
  for(let i=1;i<480;i++){
   const spawned=[];
   for(const wave of waves){const r=stepAdventureWave(wave,enemies,[{x:10,y:0,width:40}],1/120,i/120);hits+=r.hits.length;spawned.push(...r.spawned);}
   waves=[...waves.filter(w=>w.isActive),...spawned];
  }
  assert.ok(hits>0,weapon);assert.ok(enemies.some(e=>e.slowUntil>0),weapon);
 }
 const p={x:0,y:0,facing:1};const stars=fireAdventureWeapon(p,0,{left:0,right:20},'stars',{fan:2,double:1});assert.equal(stars.length,10);
 const targets=[monster(1,6)],[blade]=fireAdventureWeapon({...p,nextShot:0},1,{left:0,right:20},'blade');
 for(let i=1;i<180;i++)stepAdventureWave(blade,targets,[],1/120,i/120+1);
 assert.equal(targets[0].hp,19);
 const [returning]=fireAdventureWeapon({...p,nextShot:0},0,{left:0,right:20},'boomerang');const enemy=monster(1,6);
 for(let i=1;i<250;i++)stepAdventureWave(returning,[enemy],[],1/120,i/120);
 assert.equal(enemy.hp,18,'去程返程各命中一次');
});

test('怪物预告、攻击和糖果分裂有界',()=>{
 const all=Object.keys(MONSTERS).map((kind,i)=>({...monster(i+1,5),kind,behavior:MONSTERS[kind].behavior,phase:0,elapsed:0,baseY:0,minX:3,maxX:7,direction:1,speed:1}));
 const shots=[];for(let i=1;i<400;i++)stepAdventureEnemies(all,[{x:0}],1/120,i/120,shots);
 assert.ok(shots.some(s=>s.kind==='bubble'));assert.ok(shots.some(s=>s.kind==='fan'));assert.ok(shots.some(s=>s.kind==='lob'));
 const w=WORLD_ACTS.flatMap(act=>[1,42,137,999].map(seed=>createRoomWorld(seed,act))).find(world=>world.enemies.some(e=>e.childIds));assert.ok(w,'地图里有会分裂的怪');
 const parent=w.enemies.find(e=>e.childIds);assert.ok(parent.childIds.every(id=>w.enemies[id-1].isDormant));releaseCandyChildren(parent,w.enemies);
 assert.ok(parent.childIds.every(id=>!w.enemies[id-1].isDormant));

});

test('存档恢复没选完的奖励和搭配，装备对不上的存档不收',()=>{
 const f=roomFixture('reward'),map=new Map(),storage={getItem:k=>map.get(k) ?? null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 assert.ok(f.state.journey.pending);
 writeAdventure(f.run,f.state,storage);const saved=readAdventure(storage);
 assert.deepEqual(saved.state.journey.pending,JSON.parse(JSON.stringify(f.state.journey.pending)));assert.deepEqual(saved.state.adventure.loadouts,f.state.adventure.loadouts);
 f.state.adventure.loadouts[0].weapon='missing';writeAdventure(f.run,f.state,storage);assert.equal(readAdventure(storage),null);
});

test('同一份奖励连点第二次不会再领一次',async()=>{
 const {GardenEngine}=await import('../src/game/engine.js');
 const adventure=newAdventure(7),journey=newJourney(),survival=newSurvival();
 openRoomReward(adventure,journey,survival,'room:test','door-upgrade','power');
 const game=Object.assign(Object.create(GardenEngine.prototype),{adventure,journey,survival,isPaused:true,players:[{x:0,y:0}],elapsed:1,skillEffects:{burst(){}},callbacks:{onSound(){}},publish(){}});
 const id=journey.pending.id;
 assert.ok(game.selectReward([0],id,0));
 const after=structuredClone(adventure);
 assert.equal(game.selectReward([0],id,0),false);assert.deepEqual(adventure,after);assert.equal(journey.pending,null);
});

test('收齐武器后本领门仍然给出三张不同的卡',()=>{
 const a=newAdventure(42);a.weapons=Object.keys(WEAPONS);
 const choices=doorChoices(a,'all-weapons','door-upgrade',newSurvival());
 assert.equal(choices.length,3);assert.equal(new Set(choices.map(c=>c.id)).size,3);
 assert.ok(choices.every(c=>['upgrade','weapon','supply'].includes(c.type)));
});
