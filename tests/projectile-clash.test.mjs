import test from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS } from '../shared/adventure-catalog.js';
import { fireAdventureWeapon, stepAdventureWave } from '../src/game/adventure-combat.js';
import { saveProjectiles, restoreProjectiles } from '../src/game/projectile-state.js';
import { headless, run } from './helpers/headless-engine.mjs';
const owner={x:0,y:0,facing:1}, bounds={left:-25,right:25};
const hostile=(x=2,extra={})=>({x,y:1.05,vx:0,vy:0,gravity:0,age:0,isActive:true,...extra});
const enemy=(x)=>({id:1,x,y:0,width:.5,height:2,hp:1000,maxHp:1000,combatVersion:2});

test('光刀扩大后可在身前一换一砍碎小怪和 BOSS 的攻击', () => {
  for (const facing of [-1, 1]) for (const bossId of [undefined, 1]) {
    const player = { ...owner, facing };
    const [wave] = fireAdventureWeapon(player, 0, bounds, 'lightblade', { split: 1, chain: 2 });
    const shots = [hostile(facing * 5.6, { y: 2.3, bossId }), hostile(facing * 4, { bossId })];
    const target = enemy(facing * 3);
    const result = stepAdventureWave(wave, [target], [], 1 / 120, 1 / 120, player, shots);
    assert.deepEqual(wave.clash, { x: shots[0].x, y: shots[0].y });
    assert.equal(wave.isActive, false);
    assert.deepEqual(shots.map(shot => shot.isActive), [false, true]);
    assert.deepEqual(result, { hits: [], spawned: [] });
    assert.equal(target.hp, 1000);
  }
});
test('所有远程武器穿过小怪和 BOSS 的弹丸，继续打中敌人', () => {
  const rangedWeapons = Object.keys(WEAPONS).filter(kind => !WEAPONS[kind].isMelee);
  for (const kind of rangedWeapons) for (const bossId of [undefined, 1]) {
    const [wave] = fireAdventureWeapon({ ...owner }, 0, bounds, kind);
    const shot = hostile(2, { bossId });
    const target = enemy(12);
    for (let i = 1; i <= 240 && wave.isActive; i++) {
      stepAdventureWave(wave, [target], [], 1 / 120, i / 120, owner, [shot]);
    }
    assert.equal(shot.isActive, true, kind);
    assert.equal(wave.clash, undefined, kind);
    assert.ok(target.hp < 1000, kind);
  }
});
test('远程脉冲和光刀分裂出的星弹都没有砍碎敌弹的能力', () => {
  const [seed] = fireAdventureWeapon({ ...owner }, 0, bounds, 'seed', { bloom: 1 });
  const [lightblade] = fireAdventureWeapon({ ...owner }, 0, bounds, 'lightblade', { split: 1 });
  for (const root of [seed, lightblade]) {
    const result = stepAdventureWave(root, [enemy(2)], [], .2, .2, owner);
    assert.ok(result.spawned.length > 0);
    for (const wave of result.spawned) {
      const shot = hostile(wave.x, { y: wave.y, bossId: 1 });
      stepAdventureWave(wave, [], [], .65, .85, owner, [shot]);
      assert.equal(shot.isActive, true, wave.kind);
      assert.equal(wave.clash, undefined, wave.kind);
      if (wave.kind === 'pulse') assert.ok(wave.burst, '脉冲仍然爆发');
    }
  }
});
test('高速敌弹经过刀光会被砍碎，错层和已消失的弹丸不会触发抵消', () => {
  const [wave] = fireAdventureWeapon({ ...owner }, 0, bounds, 'lightblade');
  const shot = hostile(-4, { previousX: 7, previousY: 1.05 });
  stepAdventureWave(wave, [], [], .08, .08, owner, [shot]);
  assert.ok(wave.clash);
  assert.equal(shot.isActive, false);
  const [next] = fireAdventureWeapon({ ...owner }, 0, bounds, 'lightblade');
  stepAdventureWave(next, [], [], .08, .08, owner, [hostile(2, { y: 8 }), hostile(2, { isActive: false })]);
  assert.equal(next.clash, undefined);
});
test('延迟刀光未出手不能对冲，出手后能消除地面技能且下一刀仍保留',()=>{
 const waves=fireAdventureWeapon({...owner},0,bounds,'lightblade',{weaponRank:2}),shot=hostile(3,{kind:'shock',bossId:1});
 stepAdventureWave(waves[1],[],[],.01,.01,owner,[shot]);assert.equal(shot.isActive,true);
 stepAdventureWave(waves[0],[],[],.01,.01,owner,[shot]);assert.equal(shot.isActive,false);assert.equal(waves[1].isActive,true);
 const state=saveProjectiles(waves,[shot]),restored=restoreProjectiles(state);
 assert.equal(restored.waves.length,1);assert.equal(restored.shots.length,0);
});
test('真实引擎先抵消再检查玩家受伤，暂停冻结，抵消不计分不充能',()=>{
 const game=headless('room'); game.world.enemies.forEach(e=>{e.isDormant=true;});
 const p=game.players[0];p.protection=0;
 game.waves=fireAdventureWeapon({...p,nextShot:0},game.elapsed,{left:p.x-20,right:p.x+20},'lightblade');
 game.enemyShots=[hostile(p.x+.6,{y:p.y+1.05,kind:'boss',bossId:1,damage:35})];
 const hp=game.survival.hp, defeated=game.defeatedIds.length,energy=game.spellHits,sounds=[];
 game.callbacks.onSound=s=>sounds.push(s);
 game.pause(true);game.tick();assert.equal(game.enemyShots[0].isActive,true);
 game.pause(false);run(game,1/120);
 assert.equal(game.enemyShots.length,0);assert.equal(game.waves.length,0);assert.equal(game.survival.hp,hp);
 assert.equal(game.defeatedIds.length,defeated);assert.equal(game.spellHits,energy);assert.ok(sounds.includes('block'));
});

test('真实引擎中与远程攻击重叠的敌弹仍可打伤玩家', () => {
  for (const bossId of [undefined, 1]) {
    const game = headless('room');
    game.world.enemies.forEach(enemy => { enemy.isDormant = true; });
    const player = game.players[0];
    player.protection = 0;
    game.waves = fireAdventureWeapon({ ...player, nextShot: 0 }, game.elapsed, { left: player.x - 20, right: player.x + 20 }, 'blade');
    game.enemyShots = [hostile(game.waves[0].x, { y: game.waves[0].y, bossId, damage: 35 })];
    const hp = game.survival.hp;
    run(game, 1 / 120);
    assert.ok(game.survival.hp < hp);
    assert.equal(game.waves.length, 1);
    assert.equal(game.waves[0].clash, undefined);
  }
});
