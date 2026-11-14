import test from 'node:test';
import assert from 'node:assert/strict';
import { newAdventure, activeWeapons, equipWeapon, isValidAdventure } from '../src/game/adventure.js';
import { fireLoadout, fireAdventureWeapon, stepAdventureWave } from '../src/game/adventure-combat.js';
import { readAdventure, writeAdventure } from '../src/game/save.js';
import { bossFixture } from './helpers/adventure-fixtures.mjs';

const storage=()=>{const data=new Map();return {getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};};

test('新冒险只带一把弯刀，其他武器基础也只发一枚，分别计算冷却',()=>{
  const adventure=newAdventure(1),player={x:0,y:0,facing:1},bounds={left:-25,right:25};
  assert.ok(isValidAdventure(adventure,1));assert.deepEqual(adventure.weapons,['moonblade']);assert.deepEqual(activeWeapons(adventure),['moonblade']);
  const first=fireLoadout(player,0,bounds,adventure);
  assert.deepEqual(first.map(s=>s.kind),['moonblade']);assert.equal(first[0].damage,48);
  assert.deepEqual(fireLoadout(player,.1,bounds,adventure),[]);
  assert.deepEqual(fireLoadout(player,.18,bounds,adventure).map(s=>s.kind),['moonblade']);
  for(const weapon of ['blade','moonblade','stars','bubble','boomerang','seed','firefly'])assert.equal(fireAdventureWeapon({x:0,y:0,facing:1},0,bounds,weapon).length,1,weapon);
  adventure.weapons.push('blade');adventure.loadouts[0].weapons.push('blade');
  assert.deepEqual(fireLoadout(player,.2,bounds,adventure).map(s=>s.kind),['blade']);
});

test('没有敌人也能持续发射弯刀，朝左右前方直飞并在射程耗尽后清理',()=>{
  for(const facing of [-1,1]) {
    const adventure=newAdventure(1),player={x:0,y:0,facing},waves=[];let peakActive=0;
    for(let i=0;i<360;i++) {
      waves.push(...fireLoadout(player,i/120,{left:-25,right:25},adventure));
      for(const wave of waves)stepAdventureWave(wave,[],[],1/120,i/120);
      peakActive=Math.max(peakActive,waves.filter(wave=>wave.isActive).length);
      if(i===0) { assert.equal(waves[0].isActive,true);assert.ok(waves[0].x*facing>.6); }
    }
    assert.ok(waves.length>=16&&waves.length<=17);assert.ok(peakActive>=10);
    assert.equal(waves[0].isActive,false);
    assert.ok(waves.some(wave=>wave.isActive));
    for(const wave of waves) {
      assert.ok(wave.x*facing>.6&&wave.x*facing<=40.6+1e-8);
      assert.equal(wave.y,1.05);assert.equal(wave.targetId,null);
      assert.ok(wave.age<=2+1/120+1e-8);
    }
  }
});

test('叠加后的月牙分散飞出，各自追踪不同敌人，同一把不会重复命中',()=>{
  const waves=fireAdventureWeapon({x:0,y:0,facing:1},0,{left:-25,right:25},'moonblade',{weaponRank:3,double:1});
  assert.equal(waves.length,6);assert.equal(new Set(waves.map(w=>w.headingY)).size,6);
  assert.ok(waves[0].headingY<0&&waves.at(-1).headingY>0);
  const enemies=[{id:1,x:9,y:-3},{id:2,x:12,y:4},{id:3,x:16,y:0}].map(e=>({...e,width:1,height:2,hp:10000,combatVersion:2}));
  const hits=[];
  for(const wave of waves)stepAdventureWave(wave,enemies,[],1/120,1/120);
  assert.equal(new Set(waves.map(w=>w.targetId)).size,3);
  for(let i=2;i<=300;i++)for(const [n,wave] of waves.entries())for(const hit of stepAdventureWave(wave,enemies,[],1/120,i/120).hits)hits.push(`${n}:${hit.enemy.id}`);
  assert.equal(new Set(hits).size,hits.length);assert.equal(new Set(hits.map(hit=>hit.split(':')[1])).size,3);
  assert.ok(waves.every(wave=>!wave.isActive));
});

test('月牙沿弧线转向身后目标，不在一帧内直接反向',()=>{
  const [wave]=fireAdventureWeapon({x:0,y:0,facing:1},0,{left:-25,right:25},'moonblade');
  const enemy={id:1,x:-8,y:5,width:1,height:2,hp:100,combatVersion:2};
  stepAdventureWave(wave,[enemy],[],1/120,1/120);
  assert.ok(wave.headingX>0);assert.ok(wave.headingY>0&&wave.headingY<.2);
  const hits=[];for(let i=2;i<=300;i++)hits.push(...stepAdventureWave(wave,[enemy],[],1/120,i/120).hits);
  assert.equal(hits.length,1);assert.equal(enemy.hp,52);
});

test('空放弯刀能在途中追踪新敌人，失去目标仍继续飞行并重新锁定',()=>{
  const [wave]=fireAdventureWeapon({x:0,y:0,facing:1},0,{left:-25,right:25},'moonblade');
  stepAdventureWave(wave,[],[],.1,.1);
  assert.equal(wave.isActive,true);assert.equal(wave.y,1.05);
  const target={id:1,x:8,y:5,width:1,height:2,hp:100,combatVersion:2};
  stepAdventureWave(wave,[target],[],.1,.2);
  assert.equal(wave.targetId,1);assert.ok(wave.y>1.05);
  target.isHidden=true;
  const last={x:wave.x,y:wave.y};
  stepAdventureWave(wave,[target],[],.1,.3);
  assert.equal(wave.isActive,true);assert.equal(wave.targetId,null);
  assert.ok(Math.hypot(wave.x-last.x,wave.y-last.y)>1.9);
  const next={id:2,x:wave.x-5,y:wave.y+3,width:1,height:2,hp:100,combatVersion:2},hits=[];
  for(let i=1;i<=240;i++)hits.push(...stepAdventureWave(wave,[target,next],[],1/120,.3+i/120).hits);
  assert.deepEqual(hits.map(hit=>hit.enemy.id),[2]);assert.equal(next.hp,52);assert.equal(target.hp,100);
  assert.equal(wave.isActive,false);
});

test('弯刀追踪上下方和身后敌人，穿过平台，每把对同一目标只命中一次',()=>{
  for(const [x,y] of [[8,7],[-8,5],[0,9],[7,-5]]) {
    const target={id:1,x,y,width:1,height:2,hp:200,combatVersion:2};
    const [wave]=fireAdventureWeapon({x:0,y:0,facing:1},0,{left:-25,right:25},'moonblade');
    const hits=[];
    for(let i=1;i<=300;i++)hits.push(...stepAdventureWave(wave,[target],[{x:3,y:3,width:10}],1/120,i/120).hits);
    assert.equal(hits.length,1,`${x}/${y}`);assert.equal(target.hp,152);assert.equal(wave.isActive,false);
  }
});

test('弯刀随移动目标转向，失效后换目标，不锁定隐藏、休眠或已击败敌人',()=>{
  const target={id:1,x:8,y:5,width:1,height:2,hp:100,combatVersion:2};
  const next={id:2,x:-15,y:1,width:1,height:2,hp:100,combatVersion:2};
  const ignored=[{...next,id:3,x:0,isHidden:true},{...next,id:4,x:0,isDormant:true},{...next,id:5,x:0,isDefeated:true}];
  const [wave]=fireAdventureWeapon({x:0,y:0,facing:1},0,{left:-25,right:25},'moonblade');
  stepAdventureWave(wave,[target,next,...ignored],[],.1,.1);assert.equal(wave.targetId,1);assert.ok(wave.y>1.05);
  target.x=-4;target.y=7;const previousX=wave.x;
  stepAdventureWave(wave,[target,next,...ignored],[],.1,.2);assert.ok(wave.x<previousX);assert.equal(wave.targetId,1);
  target.isDefeated=true;
  const hits=[];for(let i=1;i<=240;i++)hits.push(...stepAdventureWave(wave,[target,next,...ignored],[],1/120,.2+i/120).hits);
  assert.deepEqual(hits.map(hit=>hit.enemy.id),[2]);assert.equal(next.hp,52);
  for(const enemy of ignored)assert.equal(enemy.hp,100);
  const [empty]=fireAdventureWeapon({x:0,y:0,facing:1},0,{left:-25,right:25},'moonblade');
  stepAdventureWave(empty,[{...target,isDefeated:false,x:100},...ignored],[],.1,.1);assert.equal(empty.isActive,true);assert.equal(empty.targetId,null);assert.equal(empty.x,2.6);
});

test('多把弯刀各自追踪且伤害独立，成长与护盾减伤仍有效',()=>{
  const shots=fireAdventureWeapon({x:0,y:0,facing:1},0,{left:-25,right:25},'moonblade',{attackGrowth:2,double:1,area:2,weaponRank:3});
  assert.equal(shots.length,6);assert.equal(shots[0].damage,77);assert.ok(shots[0].radius>.7);
  const boss={id:1,x:6,y:5,width:3,height:7,hp:600,combatVersion:2,isShielded:true,isBoss:true};
  const hits=[];for(let i=1;i<240;i++)for(const wave of shots)hits.push(...stepAdventureWave(wave,[boss],[],1/120,i/120).hits);
  assert.equal(hits.length,6);assert.equal(boss.hp,276);assert.ok(hits.every(hit=>hit.damage===54&&hit.blocked===23));
});

test('旧冒险补发弯刀而保留装备成长和时限，主动取下后恢复不再强制装上',()=>{
  const f=bossFixture(),mem=storage();delete f.state.adventure.starterVersion;
  const original=structuredClone(f.state);writeAdventure(f.run,f.state,mem);
  const saved=readAdventure(mem);assert.ok(saved);const adventure=saved.state.adventure;
  assert.ok(adventure.weapons.includes('moonblade'));assert.ok(activeWeapons(adventure).includes('moonblade'));
  assert.deepEqual(adventure.weapons.filter(id=>id!=='moonblade'),original.adventure.weapons);
  assert.deepEqual(adventure.growth,original.adventure.growth);assert.deepEqual(adventure.effects,original.adventure.effects);
  assert.deepEqual(saved.state.survival,original.survival);assert.deepEqual(saved.state.journey,original.journey);assert.deepEqual(saved.state.enemies,original.enemies);
  assert.ok(equipWeapon(adventure,0,'moonblade'));const revision=adventure.revision;
  writeAdventure(saved.run,saved.state,mem);const resumed=readAdventure(mem).state.adventure;
  assert.ok(!activeWeapons(resumed).includes('moonblade'));assert.equal(resumed.weapons.filter(id=>id==='moonblade').length,1);assert.equal(resumed.revision,revision);
});
