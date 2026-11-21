import test from 'node:test';
import assert from 'node:assert/strict';
import { newAdventure, newJourney, chooseReward, rewardItem, weaponRank, isValidAdventure, activeWeapons } from '../src/game/adventure.js';
import { fireLoadout } from '../src/game/adventure-combat.js';
import { writeAdventure, readAdventure } from '../src/game/save.js';
import { roomFixture } from './helpers/adventure-fixtures.mjs';
import { bindAttack } from '../src/game/attack-bindings.js';

function award(adventure,journey,id,weapon) {
  journey.pending={id,family:'flight',title:'小关通关',player:0,choices:[{type:'weapon',id:weapon}]};
  assert.ok(chooseReward(adventure,journey,0));assert.equal(chooseReward(adventure,journey,0),false);
}
test('奖励扩充武器库，绑定的武器保留同种数量和伤害，旧档武器按一枚计算',()=>{
  const a=newAdventure(42),j=newJourney();
  award(a,j,'one','moonblade');award(a,j,'two','moonblade');award(a,j,'three','bubble');award(a,j,'four','bubble');
  assert.deepEqual(activeWeapons(a),['moonblade','bubble']);assert.equal(weaponRank(a,'moonblade'),3);assert.equal(weaponRank(a,'bubble'),2);
  const bounds={left:-25,right:25}, p={x:0,y:0,facing:1};
  assert.deepEqual(a.attackBindings,['moonblade',null,null]);
  const shots=fireLoadout({...p},0,bounds,a);
  assert.equal(shots.length,3);assert.ok(shots.every(s=>s.kind==='moonblade'&&s.damage===67));
  assert.equal(new Set(shots.map(s=>s.hitIds)).size,3);
  assert.ok(bindAttack(a,1,'bubble'));
  const second=fireLoadout({...p},0,bounds,a,0,[],'bubble');
  assert.equal(second.length,2);assert.ok(second.every(s=>s.kind==='bubble'&&s.damage===66));
  assert.ok(isValidAdventure(a,1));
  const old={...a};delete old.weaponRanks;assert.ok(isValidAdventure(old,1));assert.equal(fireLoadout({...p},0,bounds,old).length,1);
  const text=rewardItem({type:'weapon',id:'moonblade'},a);assert.match(text.name,/叠加/);assert.match(text.hint,/3 → 4/);assert.match(text.hint,/67 → 77/);
});
test('武器叠加数量有边界，到 99 后不能再领同一把',()=>{
  const a=newAdventure(42);
  for(const ranks of [{moonblade:0},{moonblade:1.5},{moonblade:100},{bubble:2},[]])assert.equal(isValidAdventure({...a,weaponRanks:ranks},1),false);
  a.weaponRanks.moonblade=99;
  const j=newJourney();j.pending={id:'limit',family:'flight',title:'通关',player:0,choices:[{type:'weapon',id:'moonblade'}]};
  assert.equal(chooseReward(a,j,0),false);assert.equal(a.weaponRanks.moonblade,99);
});
test('叠加后的数量、伤害与多武器在存档恢复及下一关构筑中保留',()=>{
  const f=roomFixture('boss-moon'),data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  award(f.state.adventure,f.state.journey,'stack','moonblade');award(f.state.adventure,f.state.journey,'new','stars');
  assert.ok(bindAttack(f.state.adventure,2,'stars'));
  writeAdventure(f.run,f.state,storage);const restored=readAdventure(storage);assert.ok(restored);
  const next=structuredClone(restored.state.adventure);
  assert.deepEqual(activeWeapons(next),['moonblade','stars']);assert.equal(weaponRank(next,'moonblade'),2);
  const waves=fireLoadout({x:0,y:0,facing:1},0,{left:-25,right:25},next);
  assert.equal(waves.length,2);assert.equal(waves[0].damage,58);
  assert.deepEqual(next.attackBindings,['moonblade',null,'stars']);
  assert.equal(fireLoadout({x:0,y:0,facing:1},0,{left:-25,right:25},next,0,[],'stars')[0].kind,'stars');
});
