import test from 'node:test';
import assert from 'node:assert/strict';
import { newAdventure, newJourney, chooseReward, rewardChoices, rewardItem, weaponRank, isValidAdventure, activeWeapons } from '../src/game/adventure.js';
import { fireLoadout } from '../src/game/adventure-combat.js';
import { writeAdventure, readAdventure } from '../src/game/save.js';
import { bossFixture } from './helpers/adventure-fixtures.mjs';

function award(adventure,journey,id,weapon) {
  journey.pending={id,family:'flight',title:'小关通关',player:0,choices:[{type:'weapon',id:weapon}]};
  assert.ok(chooseReward(adventure,journey,0));assert.equal(chooseReward(adventure,journey,0),false);
}
test('连续关卡奖励同时叠加不同武器、同种数量和伤害，旧档武器按一枚计算',()=>{
  const a=newAdventure(42),j=newJourney();
  award(a,j,'one','moonblade');award(a,j,'two','moonblade');award(a,j,'three','bubble');award(a,j,'four','bubble');
  assert.deepEqual(activeWeapons(a),['moonblade','bubble']);assert.equal(weaponRank(a,'moonblade'),3);assert.equal(weaponRank(a,'bubble'),2);
  const shots=fireLoadout({x:0,y:0,facing:1},0,{left:-25,right:25},a);
  assert.equal(shots.filter(s=>s.kind==='moonblade').length,3);assert.equal(shots.filter(s=>s.kind==='bubble').length,2);
  assert.equal(shots.find(s=>s.kind==='moonblade').damage,67);assert.equal(shots.find(s=>s.kind==='bubble').damage,66);
  assert.equal(new Set(shots.map(s=>s.hitIds)).size,5);assert.ok(isValidAdventure(a,1));
  const old={...a};delete old.weaponRanks;assert.ok(isValidAdventure(old,1));assert.equal(fireLoadout({x:0,y:0,facing:1},0,{left:-25,right:25},old).length,2);
  const text=rewardItem({type:'weapon',id:'moonblade'},a);assert.match(text.name,/叠加/);assert.match(text.hint,/3 → 4/);assert.match(text.hint,/67 → 77/);
});
test('随机奖励包含已拥有武器且结果固定，数量成长有边界校验',()=>{
  const a=newAdventure(42);let isFound=false;
  for(let i=0;i<80;i++){
    const choices=rewardChoices(a,`boss:${i}`,'flight',0,undefined,'small');
    assert.deepEqual(choices,rewardChoices(a,`boss:${i}`,'flight',0,undefined,'small'));
    if(choices.some(c=>c.type==='weapon'&&c.id==='moonblade'))isFound=true;
  }
  assert.ok(isFound);
  for(const ranks of [{moonblade:0},{moonblade:1.5},{moonblade:100},{bubble:2},[]])assert.equal(isValidAdventure({...a,weaponRanks:ranks},1),false);
  a.weaponRanks.moonblade=99;
  assert.ok(!rewardChoices(a,'max','flight').some(c=>c.type==='weapon'&&c.id==='moonblade'));
  const j=newJourney();j.pending={id:'limit',family:'flight',title:'通关',player:0,choices:[{type:'weapon',id:'moonblade'}]};
  assert.equal(chooseReward(a,j,0),false);assert.equal(a.weaponRanks.moonblade,99);
});
test('叠加后的数量、伤害与多武器在存档恢复及下一关构筑中保留',()=>{
  const f=bossFixture('boss-moon','rainbow-1'),data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
  award(f.state.adventure,f.state.journey,'stack','moonblade');award(f.state.adventure,f.state.journey,'new','stars');
  writeAdventure(f.run,f.state,storage);const restored=readAdventure(storage);assert.ok(restored);
  const next=structuredClone(restored.state.adventure);
  assert.deepEqual(activeWeapons(next),['moonblade','stars']);assert.equal(weaponRank(next,'moonblade'),2);
  const waves=fireLoadout({x:0,y:0,facing:1},0,{left:-25,right:25},next);
  assert.equal(waves.length,3);assert.equal(waves[0].damage,58);assert.equal(waves[2].kind,'stars');
});
