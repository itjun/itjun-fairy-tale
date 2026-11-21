import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_ACTS } from '../shared/levels.js';
import { createRoomWorld } from '../shared/room-world.js';
import { applyCycleHealth, carryToNextWorld } from '../shared/adventure-cycle.js';
import { bossBaseline, bossTargetHp } from '../shared/boss-health.js';
import { newAdventure, isValidAdventure, migrateAdventure } from '../src/game/adventure.js';
import { newSurvival } from '../src/game/characters.js';
import { readAdventure, writeAdventure } from '../src/game/save.js';
import { headless } from './helpers/headless-engine.mjs';
import { roomFixture } from './helpers/adventure-fixtures.mjs';

const memory = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }; };

test('只有通关最后一个世界才跨轮，武器、品质、资源、剩余时限和原难度完整保留', () => {
  const { state } = roomFixture('stack');
  state.adventure.difficulty = 'hard';
  const before = structuredClone(state.adventure);
  let carried = state.adventure;
  for (let world = 0; world < WORLD_ACTS.length; world++) {
    carried = carryToNextWorld(carried, world, WORLD_ACTS.length);
    assert.equal(carried.cycle, world === WORLD_ACTS.length - 1 ? 2 : 1);
  }
  assert.deepEqual(state.adventure, before, '结算快照不能被修改，重复打开结果页不能累加轮数');
  assert.deepEqual(carried, { ...before, cycle: 2, revision: before.revision + WORLD_ACTS.length });
  assert.equal(newAdventure(9).cycle, 1, '死亡重来和新冒险从第一轮开始');
});

test('旧第 11 版无轮数字段按第一轮恢复，非法轮数被拒绝', () => {
  const fixture = roomFixture('room'), storage = memory();
  delete fixture.state.adventure.cycle;
  writeAdventure(fixture.run, fixture.state, storage);
  assert.equal(readAdventure(storage).state.adventure.cycle, 1);
  for (const cycle of [0, -1, 1.5, '2', Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const adventure = { ...newAdventure(42), cycle };
    assert.equal(isValidAdventure(adventure, 1), false);
  }
  assert.equal(migrateAdventure(newAdventure(42)).cycle, 1);
});

test('各世界的后续轮回只加厚首领、护甲、召唤和精英，不改普通怪、拓扑、奖励及编号', () => {
  for (const stage of WORLD_ACTS) for (const cycle of [2, 3, 10, 50]) {
    const first = createRoomWorld(42, stage), next = createRoomWorld(42, stage, cycle);
    assert.deepEqual(next.platforms, first.platforms);
    assert.deepEqual(next.doors, first.doors);
    assert.deepEqual(next.treasures, first.treasures);
    assert.equal(next.signature, first.signature);
    for (const [index, enemy] of next.enemies.entries()) {
      const original = first.enemies[index];
      assert.equal(enemy.id, original.id);
      assert.equal(enemy.points, original.points);
      if (enemy.isBoss || enemy.isElite || !enemy.parentId && ['armored', 'summoner'].includes(enemy.role)) assert.ok(enemy.hp > original.hp);
      else assert.equal(enemy.hp, original.hp);
    }
    const boss = next.enemies.find(enemy => enemy.isBoss);
    assert.equal(boss.hp, bossBaseline(stage, cycle));
    applyCycleHealth(next, cycle);
    assert.equal(boss.hp, bossBaseline(stage, cycle), '恢复规则重复应用不能重复放大');
  }
});

test('轻松、标准、挑战各轮的敌人碰撞与敌弹实际扣血递增，掉坑规则保持', () => {
  for (const difficulty of ['easy', 'normal', 'hard']) for (const cycle of [1, 2, 3, 10]) for (const isShot of [false, true]) {
    const game = headless('room');
    game.adventure = newAdventure(42); Object.assign(game.adventure, { difficulty, cycle }); game.applyRoomRules();
    game.survival = newSurvival('sister');
    const player = game.players[0]; player.protection = 0;
    game.world.enemies.forEach(enemy => { enemy.isDormant = true; });
    if (isShot) game.enemyShots.push({ x: player.x, y: player.y + 0.8, vx: 0, vy: 0, gravity: 0, age: 0, life: 2, damage: 20, size: 0.5, kind: 'orb', isActive: true });
    else {
      const enemy = game.world.enemies.find(item => !item.isBoss);
      Object.assign(enemy, { isDormant: false, isDefeated: false, behavior: 'crawl', speed: 0, touchDamage: 18, x: player.x + 0.4, minX: player.x + 0.4, maxX: player.x + 0.4, baseY: player.y, y: player.y });
    }
    game.tick();
    const expected = Math.round((isShot ? 20 : 18) * (1 + (cycle - 1) * 0.12) * (difficulty === 'easy' ? 0.5 : 1));
    assert.equal(game.survival.hp, 100 - expected, `${difficulty} ${cycle} ${isShot}`);
    game.survival.hp = 100; game.hurt(true);
    assert.equal(game.survival.hp, difficulty === 'easy' ? 100 : 75);
  }
});

test('轮回首领叠武器加厚、半血预告、受伤状态和弹道存档可以往返，不在读档时再次升轮', () => {
  for (const cycle of [2, 3, 10]) {
    const game = headless('boss');
    game.adventure.cycle = cycle; game.applyRoomRules(); game.tick();
    const boss = game.world.enemies.find(enemy => enemy.isBoss);
    assert.ok(boss.maxHp >= bossBaseline(game.stage, cycle));
    assert.ok(boss.maxHp <= bossTargetHp(game.stage, 100, cycle));
    boss.hp -= 37;
    const state = game.exportState(), fixture = roomFixture('boss'), storage = memory();
    writeAdventure(fixture.run, state, storage);
    const saved = readAdventure(storage);
    assert.ok(saved, `第 ${cycle} 轮必须能保存恢复`);
    const restored = headless('boss'); restored.restoreState(saved.state);
    assert.equal(restored.adventure.cycle, cycle);
    assert.deepEqual(restored.exportState().enemies, state.enemies);
    assert.deepEqual(restored.survival, game.survival);
    assert.equal(restored.difficulty, game.difficulty);
    restored.applyRoomRules();
    assert.equal(restored.world.enemies[boss.id - 1].hp, boss.hp);
  }
});
