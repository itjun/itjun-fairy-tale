import test from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS } from '../shared/adventure-catalog.js';
import { newAdventure } from '../src/game/adventure.js';
import { fireLoadout, stepAdventureWave } from '../src/game/adventure-combat.js';
import { saveProjectiles, restoreProjectiles, isValidProjectiles } from '../src/game/projectile-state.js';
import { headless, run } from './helpers/headless-engine.mjs';

const bounds = { left:-30, right:30 };
const player = () => ({x:0, y:0, facing:1});
const enemy = (id, x, extra = {}) => ({id, x, y:0, width:1, height:2, hp:1000, maxHp:1000, combatVersion:2, ...extra});
function build(kind, upgrades = {}) {
  const a = newAdventure(42); a.weapons = [kind]; a.weaponRanks = {[kind]:1}; a.upgrades = upgrades;
  a.attackBindings = [kind, null, null];
  a.loadouts[0] = {weapon:kind, weapons:[kind], upgrades:Object.keys(upgrades)};
  return a;
}

test('八种武器空放只留一轮，碰平台不消失，出屏后才能再发', () => {
  for (const kind of Object.keys(WEAPONS).filter(id => !WEAPONS[id].isMelee)) for (const facing of [-1, 1]) {
    const p = {...player(), facing}, a = build(kind), waves = [];
    let emissions = 0;
    for (let frame = 0; frame < 720; frame++) {
      const t = frame / 120, shots = fireLoadout(p, t, bounds, a);
      emissions += shots.length; waves.push(...shots);
      assert.ok(waves.filter(w => w.isActive).length <= 1, kind);
      for (const w of waves) stepAdventureWave(w, [], [{x:5*facing, y:1, width:4}], 1/120, t);
    }
    assert.ok(emissions >= 2, kind);
    for (const w of waves.filter(w => !w.isActive)) assert.ok(w.x * facing >= bounds.right, `${kind} ${w.x}`);
  }
});

test('命中最近的敌人或护盾立即消失，后排不会被贯穿', () => {
  for (const kind of Object.keys(WEAPONS).filter(id => !WEAPONS[id].isMelee)) for (const hasShell of [false, true]) {
    const p = player(), a = build(kind), first = enemy(1, 4, {hasShell}), behind = enemy(2, 15);
    const [wave] = fireLoadout(p, 0, bounds, a);
    let hits = [];
    for (let frame = 1; frame < 120 && wave.isActive; frame++) hits.push(...stepAdventureWave(wave, [behind, first], [], 1/120, frame/120).hits);
    assert.equal(wave.isActive, false, kind);
    assert.deepEqual(hits.map(h => h.enemy.id), [1], kind);
    assert.equal(behind.hp, 1000, kind);
    assert.equal(fireLoadout(p, 2, bounds, a).length, 1, kind);
  }
});

test('双发要等全部弹道结束，攻速奖励同时加快飞行和冷却', () => {
  const a = build('blade', {double:1}), p = player();
  const waves = fireLoadout(p, 0, bounds, a);
  const target = enemy(1, 3, {height:0.15, y:1});
  stepAdventureWave(waves[0], [target], [], .1, .1);
  assert.equal(waves[0].isActive, false); assert.equal(waves[1].isActive, true);
  assert.deepEqual(fireLoadout(p, 2, bounds, a), []);
  stepAdventureWave(waves[1], [], [], 2, 2);
  assert.equal(fireLoadout(p, 2.1, bounds, a).length, 2);
  const normalPlayer = player(), fastPlayer = player();
  const [normal] = fireLoadout(normalPlayer, 0, bounds, build('moonblade'));
  const [fast] = fireLoadout(fastPlayer, 0, bounds, build('moonblade', {rapid:3}));
  assert.ok(fast.speed > normal.speed); assert.ok(fastPlayer.weaponShots.moonblade < normalPlayer.weaponShots.moonblade);
});

test('恢复飞行弹道仍占用发射轮次，分裂弹和延迟花田同样占用', () => {
  const a = build('moonblade'), [wave] = fireLoadout(player(), 0, bounds, a);
  const restored = restoreProjectiles(JSON.parse(JSON.stringify(saveProjectiles([wave], []))));
  assert.deepEqual(fireLoadout(player(), 5, bounds, a, 0, restored.waves), []);
  for (const [kind, upgrades] of [['blade', {split:1}], ['bubble', {linger:1}]]) {
    const b = build(kind, upgrades), p = player(), shots = fireLoadout(p, 0, bounds, b);
    const result = stepAdventureWave(shots[0], [enemy(1, 3)], [], .2, .2);
    assert.ok(result.spawned.length);
    assert.deepEqual(fireLoadout(p, 5, bounds, b, 0, result.spawned), [], kind);
  }
});

test('实际引擎的手柄长按、暂停和恢复不会叠出额外一轮', () => {
  const game = headless('room'); game.adventure = build('moonblade'); game.survival.character = 'dad';
  game.world.enemies.forEach(e => {e.isDormant = true;});
  game.setGamepadInput({actions:new Set(['attack']), direction:0});
  run(game, .6); assert.equal(game.waves.length, 1);
  const state = game.exportState(), before = JSON.stringify(state.projectiles);
  game.pause(true); game.tick(); assert.equal(JSON.stringify(game.exportState().projectiles), before);
  const restored = headless('room'); restored.restoreState(state);
  restored.setGamepadInput({actions:new Set(['attack']), direction:0});
  run(restored, .1); assert.equal(restored.waves.length, 1);
});

test('弹道存档拒绝损坏的归属与屏幕边界，旧弹道仍能读取', () => {
  const waves = fireLoadout(player(), 0, bounds, build('moonblade')), state = saveProjectiles(waves, []), world = {enemies:[]};
  assert.ok(isValidProjectiles(state, world));
  for (const patch of [{firingWeapon:'unknown'}, {ownerIndex:2}, {flightBounds:{left:'bad',right:20}}, {flightBounds:{left:30,right:20}}]) {
    const broken = structuredClone(state); Object.assign(broken.waves[0], patch); assert.equal(isValidProjectiles(broken, world), false);
  }
  delete state.waves[0].flightBounds; delete state.waves[0].firingWeapon; delete state.waves[0].ownerIndex;
  assert.ok(isValidProjectiles(state, world));
});
