import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_ACTS } from '../shared/levels.js';
import { createRoomWorld } from '../shared/room-world.js';
import { MONSTER_ROLES } from '../shared/monster-roles.js';
import { newRoomState, stepRoom, isRoomCleared, enterDoor, encounterBarrier } from '../src/game/rooms.js';
import { createPlayer } from '../src/game/physics.js';
import { enemyTiming, stepAdventureEnemies } from '../src/game/adventure-enemies.js';
import { readAdventure, writeAdventure } from '../src/game/save.js';
import { newAdventure } from '../src/game/adventure.js';
import { newSurvival } from '../src/game/characters.js';
import { headless } from './helpers/headless-engine.mjs';
import { roomFixture } from './helpers/adventure-fixtures.mjs';

test('长房间有三段真实地形，怪数随世界上升且分散在三个战区', () => {
  for (const act of WORLD_ACTS) for (let seed = 1; seed <= 40; seed++) {
    const world = createRoomWorld(seed, act);
    for (const room of world.rooms) {
      const enemies = room.enemyIds.map(id => world.enemies[id - 1]).filter(enemy => !enemy.isChallenge);
      const label = `${act.id} ${seed} ${room.id} ${room.kind}`;
      if (room.sections) {
        assert.equal(room.sections.length, 3, label);
        assert.ok(room.sections.some(section => section.shape === 'decks'), label);
        assert.ok(room.sections.reduce((sum, section) => sum + section.length, 0) >= (room.kind === 'intro' ? 177 : 264), label);
        const [min, max] = room.kind === 'intro' ? [9, 13] : [13, 21];
        assert.ok(enemies.length >= min && enemies.length <= max, `${label}: ${enemies.length}`);
        for (let section = 0; section < 3; section++) assert.ok(enemies.filter(enemy => enemy.section === section).length >= 2, label);
      }
      if (room.encounters) {
        assert.equal(room.encounters.length, 3, label);
        assert.ok(room.right - room.left >= 180, label);
        const [min, max] = room.kind === 'battle' ? [19, 27] : [13, 21];
        assert.ok(enemies.length >= min && enemies.length <= max, `${label}: ${enemies.length}`);
        for (const encounter of room.encounters) {
          const group = enemies.filter(enemy => enemy.wave >= encounter.firstWave && enemy.wave <= encounter.lastWave);
          assert.ok(group.length >= 4 && group.every(enemy => encounter.platformIds.includes(enemy.platformId)), label);
        }
      }
    }
  }
});

test('战区依次推进波次，召唤子怪没清掉不能跳波，读档仍停在同一波', () => {
  const world = createRoomWorld(42, WORLD_ACTS[0]);
  const room = world.rooms.find(item => item.depth === 1 && item.kind === 'battle');
  const state = newRoomState(world), player = createPlayer(world.platforms[world.rooms[0].exitId]);
  stepRoom(world, state, player, 1 / 120);
  enterDoor(world, state, world.doors.find(door => door.targetRoomId === room.id));
  Object.assign(player, createPlayer(world.platforms[room.startId]));
  const parent = room.enemyIds.map(id => world.enemies[id - 1]).filter(enemy => enemy.wave === 0).at(-1);
  const child = { ...parent, id: world.enemies.length + 1, parentId: parent.id, childIds: undefined, wave: undefined, isDormant: true };
  world.enemies.push(child); parent.childIds = [child.id]; room.childIds.push(child.id);
  for (let wave = 0; wave < room.waves; wave++) {
    assert.equal(state.wave, wave);
    assert.equal(isRoomCleared(state), false);
    assert.equal(encounterBarrier(world, state).endId, room.encounters[Math.floor(wave / 2)].endId);
    for (const id of room.enemyIds) {
      const enemy = world.enemies[id - 1];
      if (enemy.wave !== wave) continue;
      enemy.isDefeated = true; enemy.hp = 0;
      for (const childId of enemy.childIds || []) {
        const child = world.enemies[childId - 1];
        child.isDormant = false;
        assert.equal(stepRoom(world, state, player, 1 / 120).length, 0);
        assert.equal(state.wave, wave);
        assert.equal(encounterBarrier(world, state).endId, room.encounters[Math.floor(wave / 2)].endId);
        child.isDefeated = true; child.hp = 0;
      }
    }
    const events = stepRoom(world, state, player, 1 / 120);
    assert.ok(events.some(event => event.type === (wave < room.waves - 1 ? 'wave' : 'clear')));
  }
  assert.equal(isRoomCleared(state), true);

  const fixture = roomFixture('room', 'rainbow-world', { roomId: room.id });
  fixture.state.rooms.wave = 2;
  for (const enemy of fixture.state.enemies) if (enemy.roomId === room.id && enemy.wave !== undefined) {
    if (enemy.wave < 2) { enemy.hp = 0; enemy.isDefeated = true; fixture.state.defeatedIds.push(enemy.id); }
    enemy.isDormant = enemy.wave > 2;
  }
  const data = new Map(), storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) };
  writeAdventure(fixture.run, fixture.state, storage);
  const saved = readAdventure(storage);
  assert.ok(saved);
  const game = headless('room'); game.restoreState(saved.state);
  assert.equal(game.roomState.wave, 2);
  assert.equal(isRoomCleared(game.roomState), false);
  assert.equal(encounterBarrier(game.world, game.roomState).endId, room.encounters[1].endId);
  assert.equal(game.roomBounds().maxX, encounterBarrier(game.world, game.roomState).x - 1, '读档后仍须清怪放行');
});

test('小怪先给完整预告，攻击空档缩短，敌弹有独立伤害，同屏仍只允许三只出手', () => {
  for (const role of Object.values(MONSTER_ROLES)) {
    for (const bonus of [0, 0.6]) {
      const timing = enemyTiming(role, bonus);
      assert.ok(timing.warning + 1e-9 >= (bonus ? 0.9 : 0.7));
      assert.ok(timing.rest <= role.period * 1.9 / 3.6 * 0.751);
    }
  }
  const enemy = { id: 1, behavior: 'bubble', x: 5, y: 0, baseY: 0, minX: 3, maxX: 7, elapsed: 0, phase: 3, speed: 0.84, direction: -1, period: 3.4 };
  const enemies = Array.from({ length: 8 }, (_, i) => ({ ...enemy, id: i + 1, x: 5 + i, minX: 3 + i, maxX: 7 + i }));
  const shots = [], gate = { next: 0 };
  let warningFrames = 0, firstShot = false;
  for (let frame = 0; frame < 480; frame++) {
    stepAdventureEnemies(enemies, [{ x: 0, y: 0 }], 1 / 120, frame / 120, shots, { bounds: { left: -20, right: 25 }, maxAttackers: 3, attackGate: gate, warningBonus: 0.6 });
    assert.ok(enemies.filter(item => !item.isWaiting).length <= 3);
    if (enemies[0].isWarning && !firstShot) warningFrames++;
    if (!firstShot && shots.length) { firstShot = true; assert.ok(warningFrames >= 107, `${warningFrames} 帧预告`); }
  }
  assert.ok(firstShot);
  assert.ok(shots.every(shot => shot.damage === 20));
});

test('真实引擎受伤路径：轻松与标准扣血、短暂无敌、血条耗尽扣命并暂停', () => {
  for (const difficulty of ['easy', 'normal', 'hard']) {
    const game = headless('room');
    game.adventure = newAdventure(42); game.adventure.difficulty = difficulty; game.applyRoomRules();
    game.survival = newSurvival('sister');
    const player = game.players[0], floor = player.safe;
    game.world.enemies.forEach(enemy => { enemy.isDormant = true; });
    const enemy = game.world.enemies.find(item => !item.isBoss);
    Object.assign(enemy, { isDormant: false, isDefeated: false, behavior: 'crawl', speed: 0, touchDamage: 18, x: player.x + 0.4, minX: player.x + 0.4, maxX: player.x + 0.4, baseY: player.y, y: player.y });
    player.protection = 0;
    game.tick();
    assert.equal(game.survival.hp, difficulty === 'easy' ? 91 : 82);
    const hp = game.survival.hp;
    game.tick(); assert.equal(game.survival.hp, hp, '持续重叠不会连续扣血');
    Object.assign(player, createPlayer(floor)); player.protection = 0;
    enemy.isDormant = true;
    game.enemyShots = [{ id: 'test', x: player.x, y: player.y + 0.8, vx: 0, vy: 0, gravity: 0, age: 0, damage: 20, kind: 'bubble', isActive: true }];
    game.tick(); assert.equal(game.survival.hp, hp - (difficulty === 'easy' ? 10 : 20));
    game.survival.hp = 1; game.hurt(false, 28);
    assert.deepEqual([game.survival.hp, game.survival.lives, game.survival.phase, game.isPaused], [0, 2, 'fallen', true]);
    game.hurt(false, 28); assert.equal(game.survival.lives, 2, '等待选择期间不重复扣命');
  }
});
