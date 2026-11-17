import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_ACTS } from '../shared/levels.js';
import { createRoomWorld, doorPosition } from '../shared/room-world.js';
import { stepBosses } from '../src/game/bosses.js';
import { createPlayer, stepPlayer } from '../src/game/physics.js';
import { damageEnemy } from '../src/game/combat.js';
import { readAdventure, writeAdventure } from '../src/game/save.js';
import { roomFixture } from './helpers/adventure-fixtures.mjs';
import { newRoomState, stepRoom, doorAt } from '../src/game/rooms.js';
import { headless, run } from './helpers/headless-engine.mjs';

function jumpToPlatform(world, from, to, startX = from.x, targetX = to.x) {
  const player = createPlayer(from, startX - from.x);
  for (let frame = 0; frame < 240; frame++) {
    const delta = targetX - player.x;
    stepPlayer(player, { direction: Math.abs(delta) > 0.05 ? Math.sign(delta) : 0, jump: frame === 0 }, world.platforms, 1 / 120, world);
    if (frame > 1 && player.isGrounded) return player.ground.id === to.id;
  }
  return false;
}

test('每扇门都在本房出口前方，走到通关旗后不用回头', () => {
  for (const act of WORLD_ACTS) for (const seed of [1, 7, 42, 137, 999]) {
    const world = createRoomWorld(seed, act);
    for (const door of world.doors) {
      const room = world.rooms[door.roomId], exit = world.platforms[room.exitId];
      const position = doorPosition(world, door);
      assert.ok(position.x >= exit.x + 2, `${act.id} ${seed} ${room.kind} 门在旗子后方 ${Number((exit.x - position.x).toFixed(1))}`);
    }
  }
});

test('首领场地左右和中间都有跳台，至少八块，能连续换三层高度', () => {
  for (const act of WORLD_ACTS) {
    const world = createRoomWorld(42, act), arena = world.bossArenas[0];
    const platforms = world.platforms.filter(platform => platform.roomId === world.rooms.at(-1).id && platform.y > arena.y && platform.x >= arena.left && platform.x <= arena.right);
    assert.ok(platforms.length >= 8, `${act.id} 只有 ${platforms.length} 块跳台`);
    for (const [left, right] of [[arena.left, arena.left + 10], [arena.left + 10, arena.right - 10], [arena.right - 10, arena.right]]) {
      assert.ok(platforms.some(platform => platform.x >= left && platform.x <= right && platform.y <= arena.y + 2.5), '地面各处都能跳上第一层');
    }
    assert.ok(new Set(platforms.map(platform => platform.y)).size >= 3);
    const floor = world.platforms[arena.floorId], reached = [floor];
    for (const platform of platforms.sort((a, b) => a.y - b.y)) {
      assert.ok(reached.some(from => jumpToPlatform(world, from, platform, from === floor ? platform.x : from.x)), `${act.id} 跳不上平台 ${platform.id}`);
      reached.push(platform);
    }
  }
});

test('出口前的两级台阶只往前跳就能进高门，低门直接往前走', () => {
  for (const act of WORLD_ACTS) for (const seed of [1, 7, 42, 137, 999]) {
    const world = createRoomWorld(seed, act);
    for (const room of world.rooms.filter(item => item.depth < 4)) {
      const exit = world.platforms[room.exitId], doors = world.doors.filter(door => door.roomId === room.id);
      const low = doors.at(-1);
      assert.equal(low.platformId, exit.id);
      if (doors.length === 1) continue;
      const high = world.platforms[doors[0].platformId];
      const step = world.platforms.find(platform => platform.roomId === room.id && platform.y > exit.y && platform.y < high.y && Math.abs(platform.x - exit.x) < 1);
      assert.ok(step);
      assert.ok(jumpToPlatform(world, exit, step, exit.x, exit.x + 0.5));
      assert.ok(jumpToPlatform(world, step, high, exit.x + 0.5));
      if (room.kind === 'intro' || room.kind === 'mechanism') {
        const state = newRoomState(world); state.roomId = room.id;
        const player = createPlayer(high);
        assert.ok(stepRoom(world, state, player, 1 / 120).some(event => event.type === 'clear'), '直接跳上高门也算走到尽头，不必再下来踩旗子');
        assert.equal(doorAt(world, state, player), doors[0]);
      }
    }
  }
});

test('首领的承伤间隔随存档保留，暂停和读档不能立刻再打一轮满伤害', () => {
  const game = headless('boss-moon'), boss = game.world.enemies[game.world.bossArenas[0].bossId - 1];
  game.tick();
  damageEnemy(boss, game.elapsed, { damage: 10000 });
  const saved = game.exportState(), fixture = roomFixture('boss-moon');
  const values = new Map(), storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  writeAdventure(fixture.run, saved, storage);
  const loaded = readAdventure(storage);
  assert.ok(loaded);
  const restored = headless('boss-moon'); restored.restoreState(loaded.state);
  const again = restored.world.enemies[boss.id - 1], hp = again.hp;
  damageEnemy(again, restored.elapsed + 0.1, { damage: 10000 });
  assert.equal(again.hp, hp);
  damageEnemy(again, restored.elapsed + 1.5, { damage: 10000 });
  assert.ok(again.hp < hp);
  loaded.state.enemies[boss.id - 1].hurtUntil = restored.elapsed + 100;
  writeAdventure(fixture.run, loaded.state, storage);
  assert.equal(readAdventure(storage), null);
});

test('轻松难度十二秒内至少施放三轮招式，半血转换不打断已经给出的预告', () => {
  for (const act of WORLD_ACTS) {
    const world = createRoomWorld(42, act), arena = world.bossArenas[0], boss = world.enemies[arena.bossId - 1];
    world.warningBonus = 0.6;
    const player = { x: arena.left + 3, y: arena.y }, shots = [];
    let casts = 0, previous = boss.attackStage;
    for (let frame = 0; frame < 12 * 120; frame++) {
      stepBosses(world, player, 1 / 120, frame / 120, shots);
      if (boss.attackStage === 'attack' && previous !== 'attack') casts++;
      previous = boss.attackStage;
    }
    assert.ok(casts >= 3, `${act.id} 十二秒只出招 ${casts} 次`);
    boss.attackStage = 'warning'; boss.attackTime = 1; boss.hp = boss.maxHp / 2;
    stepBosses(world, player, 1 / 120, 13, shots);
    assert.equal(boss.attackStage, 'warning');
    assert.ok(boss.attackTime > 1);
  }
});

test('叠满武器也能看见首领至少三轮出招，不会打两下就结束', t => {
  const results = [];
  for (const act of WORLD_ACTS) {
    const game = headless('boss-moon', act.id), boss = game.world.enemies[game.world.bossArenas[0].bossId - 1];
    game.survival.maxHp = game.survival.hp = 10000;
    game.adventure.growth.power = 6;
    game.adventure.weapons = ['blade', 'bubble', 'stars', 'boomerang', 'seed', 'firefly', 'flame', 'moonblade'];
    game.adventure.weaponRanks = Object.fromEntries(game.adventure.weapons.map(id => [id, 4]));
    game.adventure.upgrades = { double: 1, split: 1, fan: 2, rapid: 3, area: 2 };
    game.adventure.loadouts[0].weapons = [...game.adventure.weapons];
    game.adventure.loadouts[0].upgrades = Object.keys(game.adventure.upgrades);
    game.keys.add('KeyJ');
    const start = game.elapsed;
    let casts = 0, previous = boss.attackStage;
    run(game, 25, () => {
      if (boss.attackStage === 'attack' && previous !== 'attack') casts++;
      previous = boss.attackStage;
      return boss.isDefeated;
    });
    const result = { world: act.id, seconds: Number((game.elapsed - start).toFixed(2)), casts };
    results.push(result);
    assert.ok(boss.isDefeated, JSON.stringify(result));
    assert.ok(result.seconds >= 12 && casts >= 3, JSON.stringify(result));
  }
  t.diagnostic(JSON.stringify(results));
});
