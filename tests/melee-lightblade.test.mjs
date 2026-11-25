import test from 'node:test';
import assert from 'node:assert/strict';
import { newAdventure, activeWeapons, chooseReward, newJourney, isValidAdventure } from '../src/game/adventure.js';
import { fireAdventureWeapon, fireLoadout, stepAdventureWave } from '../src/game/adventure-combat.js';
import { saveProjectiles, restoreProjectiles, isValidProjectiles } from '../src/game/projectile-state.js';
import { recommendedStarter, starterAdventure } from '../src/game/starter-build.js';
import { headless, run } from './helpers/headless-engine.mjs';

const bounds = { left: -30, right: 30 };
const owner = (facing = 1) => ({ x: 0, y: 0, facing });
const target = (id, x, extra = {}) => ({ id, x, y: 0, width: .4, height: 2, hp: 10000, maxHp: 10000, combatVersion: 2, ...extra });
function build(weapons = ['lightblade'], upgrades = {}, rank = 1) {
  const a = newAdventure(42);
  a.weapons = [...weapons]; a.weaponRanks = { lightblade: rank }; a.upgrades = upgrades;
  a.attackBindings = [weapons[0], weapons[1] ?? null, null];
  a.loadouts[0] = { weapon: weapons[0], weapons: [...weapons], upgrades: Object.keys(upgrades) };
  return a;
}
function step(waves, enemies, p, seconds, start = 0) {
  const hits = [];
  for (let i = 1; i <= Math.ceil(seconds * 120); i++) {
    for (const wave of waves) hits.push(...stepAdventureWave(wave, enemies, [], 1 / 120, start + i / 120, p).hits);
  }
  return hits;
}

test('近战光刀只伤身前短范围，每次挥斩对同一目标只结算一次', () => {
  for (const facing of [-1, 1]) {
    const p = owner(facing), [wave] = fireAdventureWeapon(p, 0, bounds, 'lightblade');
    const enemies = [target(1, facing * 1.5), target(2, facing * 5.5, { y: 2 }), target(3, -facing * 1.5), target(4, facing * 6), target(5, facing * 1.5, { y: 4 })];
    const first = stepAdventureWave(wave, enemies, [], 1 / 120, 1 / 120, p);
    assert.deepEqual(first.hits.map(h => h.enemy.id), [1, 2]);
    assert.equal(wave.isActive, true, '命中后仍显示完整挥斩');
    assert.equal(step([wave], enemies, p, .3).length, 0, '持续动画不得重复伤害');
    assert.equal(wave.isActive, false);
    assert.deepEqual(first.hits.map(hit => hit.damage), [96, 96]);
    assert.ok(enemies.slice(2).every(e => e.hp === 10000), '背后、远处和另一层目标不命中');
  }
});

test('光刀随角色移动和跳跃，已开始的一刀保持出手朝向', () => {
  const p = owner(), [wave] = fireAdventureWeapon(p, 0, bounds, 'lightblade');
  stepAdventureWave(wave, [], [], 1 / 120, 1 / 120, p);
  p.x = 8; p.y = 4; p.facing = -1;
  const enemies = [target(1, 9.5, { y: 4 }), target(2, 6.5, { y: 4 }), target(3, 1.5), target(4, 9.5)];
  const result = stepAdventureWave(wave, enemies, [], 1 / 120, 2 / 120, p);
  assert.deepEqual(result.hits.map(h => h.enemy.id), [1]);
  assert.equal(wave.direction, 1);
  assert.ok(wave.x >= p.x && wave.x <= p.x + wave.reach, '刀光留在角色身前');
});

test('护壳每刀只挡一次，下一刀才造成伤害', () => {
  const p = owner(), enemy = target(1, 1.5, { hasShell: true });
  const first = fireAdventureWeapon(p, 0, bounds, 'lightblade');
  const blocked = step(first, [enemy], p, .3);
  assert.equal(blocked.length, 1); assert.equal(blocked[0].blocked, 96);
  assert.equal(enemy.hp, 10000); assert.equal(enemy.hasShell, false);
  const second = fireAdventureWeapon(p, .5, bounds, 'lightblade');
  assert.equal(step(second, [enemy], p, .3, .5).length, 1);
  assert.equal(enemy.hp, 9904);
});

test('叠加光刀按节奏连斩，整轮结束前不能开始下一轮', () => {
  const p = owner(), a = build(['lightblade'], { double: 1 }, 3), enemy = target(1, 1.5);
  const waves = fireLoadout(p, 0, bounds, a);
  assert.equal(waves.length, 6);
  assert.deepEqual(waves.map(w => Number(w.delay.toFixed(3))), [0, .08, .16, .24, .32, .4]);
  const first = waves.flatMap(w => stepAdventureWave(w, [enemy], [], 1 / 120, 1 / 120, p).hits);
  assert.equal(first.length, 1, '不能把六刀在同一帧结算');
  assert.deepEqual(fireLoadout(p, .41, bounds, a, 0, waves), []);
  const rest = step(waves, [enemy], p, .7, 1 / 120);
  assert.equal(first.length + rest.length, 6);
  assert.equal(waves.every(w => !w.isActive), true);
  assert.equal(fireLoadout(p, .8, bounds, a, 0, waves).length, 6);
});

test('传奇光刀扩大近战范围，仍不产生远程弹道', () => {
  const normal = fireAdventureWeapon(owner(), 0, bounds, 'lightblade');
  const legend = fireAdventureWeapon(owner(), 0, bounds, 'lightblade', { legendary: 1 });
  assert.equal(legend.length, 1); assert.equal(legend[0].speed, 0);
  assert.ok(Math.abs(legend[0].reach - normal[0].reach - .6) < 1e-8);
  const nearEdge = target(1, 6, { width: .1 });
  assert.equal(step(normal, [nearEdge], owner(), .2).length, 0);
  assert.equal(step(legend, [nearEdge], owner(), .2).length, 1);
});

test('挥斩中途保存保留命中记录与待发连斩，读档不会补打已命中目标', () => {
  const p = owner(), a = build(['lightblade'], {}, 2), enemy = target(1, 1.5);
  const waves = fireLoadout(p, 0, bounds, a);
  assert.equal(step(waves, [enemy], p, .04).length, 1);
  const saved = saveProjectiles(waves, []);
  assert.ok(isValidProjectiles(saved, { enemies: [enemy] }));
  const restored = restoreProjectiles(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(saveProjectiles(restored.waves, []), saved);
  assert.deepEqual(fireLoadout(owner(), 10, bounds, a, 0, restored.waves), [], '恢复的连斩仍占用本轮');
  assert.equal(step(restored.waves, [enemy], p, .3, .04).length, 1, '只结算尚未打出的第二刀');
});

test('光刀分裂星弹会向前飞，继承武器归属并在结束后释放轮次', () => {
  const p = owner(), a = build(['lightblade'], { split: 1 });
  const waves = fireLoadout(p, 0, bounds, a), enemy = target(1, 1.5);
  const result = stepAdventureWave(waves[0], [enemy], [], 1 / 120, 1 / 120, p);
  assert.equal(result.spawned.length, 2);
  const children = result.spawned;
  assert.ok(children.every(w => w.kind === 'stars' && w.speed > 0 && w.firingWeapon === 'lightblade' && w.ownerIndex === 0));
  const starts = children.map(w => ({ x: w.x, y: w.y }));
  waves.push(...children);
  step(waves, [], p, .19, 1 / 120);
  assert.equal(waves[0].isActive, false);
  assert.ok(children.every((w, i) => w.isActive && w.x > starts[i].x));
  assert.deepEqual(fireLoadout(p, 2, bounds, a, 0, waves), [], '分裂星弹仍在飞时不补发');
  step(waves, [], p, .5, .2);
  assert.ok(waves.every(w => !w.isActive));
  assert.equal(fireLoadout(p, 2, bounds, a, 0, waves).length, 1);
});

test('近战存档拒绝损坏范围和时序，最高 99 级双重连斩仍可保存并结束', () => {
  const p = owner(), a = build(['lightblade'], { double: 1 }, 99);
  const waves = fireLoadout(p, 0, bounds, a), saved = saveProjectiles(waves, []), world = { enemies: [] };
  assert.equal(waves.length, 198);
  assert.ok(waves.at(-1).delay < 16);
  assert.ok(isValidProjectiles(saved, world));
  for (const patch of [{ duration: undefined }, { duration: NaN }, { duration: 0 }, { delay: -1 }, { reach: undefined }, { reach: 100 }, { halfHeight: 0 }]) {
    const malformed = structuredClone(saved); Object.assign(malformed.waves[0], patch);
    assert.equal(isValidProjectiles(malformed, world), false, `拒绝 ${Object.keys(patch).join(',')}`);
  }
  const restored = restoreProjectiles(JSON.parse(JSON.stringify(saved)));
  step(restored.waves, [], p, 16.1);
  assert.ok(restored.waves.every(w => !w.isActive));
  assert.equal(fireLoadout(p, 16.2, bounds, a, 0, restored.waves).length, 198);
});

test('近战与远程独立绑定，远程在途时可再次挥刀', () => {
  const p = owner(), a = build(['moonblade', 'lightblade']), waves = fireLoadout(p, 0, bounds, a);
  assert.deepEqual(waves.map(w => w.kind), ['moonblade']);
  step(waves, [], p, .45);
  assert.equal(waves[0].isActive, true);
  const slash = fireLoadout(p, .45, bounds, a, 0, waves, 'lightblade');
  assert.deepEqual(slash.map(w => w.kind), ['lightblade']);
  step(slash, [], p, .5, .45);
  const next = fireLoadout(p, .95, bounds, a, 0, [...waves, ...slash], 'lightblade');
  assert.deepEqual(next.map(w => w.kind), ['lightblade']);
  assert.deepEqual(activeWeapons(a), ['moonblade', 'lightblade']);
  assert.ok(isValidAdventure(a, 1));
});

test('光刀可作为初始武器及探索奖励，四位角色推荐搭配保持不变', () => {
  assert.deepEqual(['dad', 'mom', 'sister', 'little'].map(id => recommendedStarter(id).weapons[0]), ['blade', 'bubble', 'stars', 'moonblade']);
  const starter = starterAdventure(42, { weapons: ['lightblade'], upgrades: [] });
  assert.ok(starter); assert.deepEqual(activeWeapons(starter), ['lightblade']);
  const a = newAdventure(42), journey = newJourney();
  journey.pending = { id: 'melee-reward', family: 'power', title: '武器奖励', player: 0, choices: [{ type: 'weapon', id: 'lightblade', rarity: 'legendary' }] };
  assert.equal(chooseReward(a, journey, 0), true);
  assert.deepEqual(activeWeapons(a), ['moonblade', 'lightblade']);
  assert.equal(a.qualities['weapon:lightblade'], 'legendary');
  assert.equal(chooseReward(a, journey, 0), false);
});

test('真实引擎手柄长按、暂停和恢复遵循同一挥斩轮次', () => {
  const game = headless('room'); game.adventure = build(['lightblade', 'moonblade']); game.survival.character = 'dad';
  game.world.enemies.forEach(e => { e.isDormant = true; });
  const sounds = []; game.callbacks.onSound = sound => sounds.push(sound);
  game.setGamepadInput({ actions: new Set(['attack']), direction: 0 });
  run(game, .05);
  assert.equal(game.waves.filter(w => w.kind === 'lightblade').length, 1);
  assert.ok(sounds.includes('lightblade:fire')); assert.ok(!sounds.includes('moonblade:fire'));
  game.pause(true);
  const state = game.exportState(); game.tick();
  assert.deepEqual(game.exportState().projectiles, state.projectiles);
  const restored = headless('room'); restored.restoreState(state);
  restored.world.enemies.forEach(e => { e.isDormant = true; });
  const after = [];
  restored.callbacks.onSound = sound => { if (sound.endsWith(':fire')) after.push(sound); };
  restored.setGamepadInput({ actions: new Set(['attack', 'spell']), direction: 0 });
  run(restored, .08);
  assert.equal(restored.waves.filter(w => w.kind === 'lightblade').length, 1, '恢复后不能叠出额外一刀');
  assert.equal(restored.waves.filter(w => w.kind === 'moonblade').length, 1);
  assert.deepEqual(after, ['moonblade:fire']);
  run(restored, .5);
  assert.ok(after.includes('lightblade:fire'), '按住光刀会在收招后继续挥斩');
});

test('真实引擎派生攻击音效保留原武器归属', () => {
  for (const [weapon, kind] of [['seed', 'pulse'], ['bubble', 'pulse'], ['boomerang', 'stars']]) {
    const game = headless('room'), p = game.players[0];
    game.world.enemies.forEach(e => { e.isDormant = true; });
    const enemy = game.world.enemies[game.world.rooms[game.roomState.roomId].enemyIds[0] - 1];
    Object.assign(enemy, { x: p.x + 2, y: p.y, baseY: p.y, hp: 10000, maxHp: 10000, hasShell: false, isGuarding: false, isShielded: false, isDormant: false, boundUntil: game.elapsed + 100 });
    game.waves = [{ kind, firingWeapon: weapon, ownerIndex: 0, x: enemy.x, y: enemy.y + 1, speed: 1, direction: 1, remaining: 10, slope: 0, age: 0, delay: 0, radius: 2, damage: 10, powers: {}, hitIds: new Set(), isActive: true }];
    const sounds = []; game.callbacks.onSound = sound => sounds.push(sound);
    run(game, 1 / 120);
    assert.ok(sounds.includes(`${weapon}:hit`), `${weapon}: ${sounds.join(', ')}`);
    assert.equal(sounds.includes('blade:hit'), false);
  }
});
