import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_ACTS } from '../shared/levels.js';
import { ADVENTURE_GENERATION_VERSION } from '../shared/adventure-catalog.js';
import { DOOR_REWARDS, ROOM_KINDS, createRoomWorld, doorPosition } from '../shared/room-world.js';
import { LAYER } from '../shared/room-terrain.js';
import { ELITE_TRAITS } from '../shared/monster-roles.js';
import { playRoom } from './helpers/room-runner.mjs';

const SEEDS = [1, 42, 137, 999];

test('第 10 版一章五层：开场房、三次两扇门、首领房', () => {
  assert.equal(ADVENTURE_GENERATION_VERSION, 10);
  for (const act of WORLD_ACTS) for (const seed of SEEDS) {
    const world = createRoomWorld(seed, act);
    assert.equal(world.version, 10);
    assert.equal(world.zones.length, 5);
    assert.deepEqual(world.rooms.map(room => room.depth), [0, 1, 1, 2, 2, 3, 3, 4]);
    assert.equal(world.rooms[0].kind, 'intro');
    assert.equal(world.rooms.at(-1).kind, 'boss');
    assert.equal(world.rooms.every(room => ROOM_KINDS[room.kind]), true);
    assert.equal(world.rooms.filter(room => room.kind === 'shop').length <= 1, true, '一章最多一间小店');
    for (let depth = 0; depth < 4; depth++) {
      const targets = world.rooms.filter(room => room.depth === depth + 1);
      for (const room of world.rooms.filter(item => item.depth === depth)) {
        const doors = world.doors.filter(door => door.roomId === room.id);
        assert.deepEqual(doors.map(door => door.targetRoomId), targets.map(target => target.id));
        for (const door of doors) {
          assert.notEqual(door.platformId, room.exitId, '门不放在刚踩到就会通关的出口上');
          assert.notEqual(door.platformId, room.startId);
          assert.equal(door.kind, world.rooms[door.targetRoomId].kind);
          assert.equal(door.reward, world.rooms[door.targetRoomId].reward);
          const platform = world.platforms[door.platformId];
          assert.equal(platform.isMoving || platform.isCrumbling || false, false, '门要放在站得稳的跳台上');
          assert.ok(Math.abs(door.offsetX) <= platform.width / 2 - 1, '人跳上去站得住');
        }
        if (doors.length === 2) {
          const [high, low] = doors.map(door => doorPosition(world, door));
          assert.ok(Math.abs(high.y - low.y) >= LAYER - 0.21, `${act.id} ${seed} 两扇门要一高一低`);
          assert.notEqual(doors[0].platformId, doors[1].platformId);
        }
      }
      // 两扇门后面的房间不一样，玩家自己挑，门上不写是什么。
      if (targets.length === 2) assert.notEqual(`${targets[0].kind}:${targets[0].reward}`, `${targets[1].kind}:${targets[1].reward}`, `${act.id} ${seed}`);
    }
  }
});

test('一章只在中间给一次选卡，开场和最后一间不弹，进门前不会刚领完又马上再领', () => {
  const isCard = reward => !!DOOR_REWARDS[reward]?.isChoice;
  for (const act of WORLD_ACTS) for (const seed of SEEDS) {
    const world = createRoomWorld(seed, act);
    assert.equal(world.rooms[0].reward, null, '开场房不给奖励');
    assert.equal(world.rooms.at(-1).reward, null, '首领的选卡在打赢之后，不挂在门上');
    const cardDepths = new Set(world.rooms.filter(room => isCard(room.reward)).map(room => room.depth));
    assert.ok(cardDepths.size <= 1, `${act.id} ${seed} 有 ${cardDepths.size} 层在发选卡`);
    assert.equal([...cardDepths].every(depth => depth === 1 || depth === 2), true, '选卡不放在最后一间门前');
    for (const depth of cardDepths) {
      const cards = world.rooms.filter(room => room.depth === depth && isCard(room.reward));
      assert.ok(cards.every(room => room.kind === 'elite' || room.kind === 'battle'));
      if (cards.some(room => room.kind === 'elite')) assert.equal(cards.every(room => room.kind === 'elite'), true, '有精英房时选卡只给精英房');
    }
  }
});

test('同一个种子生成同一张图，换种子路线和房间会变', () => {
  for (const act of WORLD_ACTS) {
    assert.deepEqual(createRoomWorld(42, act), createRoomWorld(42, act));
    const plans = new Set(SEEDS.concat(7, 2024, 31337).map(seed => createRoomWorld(seed, act).rooms.map(room => `${room.kind}:${room.reward}`).join(',')));
    assert.ok(plans.size >= 4, `${act.id} 只有 ${plans.size} 种排法`);
  }
});

test('房间互不重叠，怪、宝物和平台都归在自己的房间里', () => {
  for (const act of WORLD_ACTS) {
    const world = createRoomWorld(137, act);
    const sorted = [...world.rooms].sort((a, b) => a.left - b.left);
    for (let index = 1; index < sorted.length; index++) assert.ok(sorted[index].left - sorted[index - 1].right >= 40, '镜头锁在一间房里看不到隔壁');
    for (const room of world.rooms) {
      for (const id of room.platformIds) {
        const platform = world.platforms[id];
        assert.equal(platform.roomId, room.id);
        assert.equal(platform.zone, room.depth);
        assert.ok(platform.x - platform.width / 2 >= room.left - 0.01 && platform.x + platform.width / 2 <= room.right + 0.01);
      }
      for (const id of [...room.enemyIds, ...room.childIds]) {
        const enemy = world.enemies[id - 1];
        assert.equal(enemy.roomId, room.id);
        assert.ok(enemy.x > room.left && enemy.x < room.right);
      }
      assert.equal(world.platforms[room.exitId].milestone, room.depth + 1);
    }
    assert.equal(world.enemies.every(enemy => Number.isInteger(enemy.roomId)), true);
    assert.equal(world.treasures.every(item => Number.isInteger(item.roomId)), true);
  }
});

test('战斗房按预算分波出怪，后面的波先睡着；精英带一种特点', () => {
  for (const act of WORLD_ACTS) for (const seed of SEEDS) {
    const world = createRoomWorld(seed, act);
    for (const room of world.rooms) {
      const enemies = room.enemyIds.map(id => world.enemies[id - 1]);
      if (room.kind === 'battle') {
        assert.equal(room.waves, act.index >= 3 ? 3 : 2);
        assert.equal(room.hasChallenge, true);
        for (let wave = 0; wave <= room.waves; wave++) {
          const group = enemies.filter(enemy => enemy.wave === wave);
          assert.ok(group.length >= 1 && group.length <= 4, `${act.id} 第 ${wave} 波 ${group.length} 只`);
          assert.equal(group.every(enemy => !!enemy.isDormant === wave > 0), true);
        }
        assert.equal(enemies.filter(enemy => enemy.wave === room.waves).every(enemy => enemy.isChallenge), true);
      }
      if (room.kind === 'elite') {
        const elites = enemies.filter(enemy => enemy.isElite && enemy.wave === 0);
        assert.equal(elites.length, 1);
        assert.ok(ELITE_TRAITS[elites[0].trait]);
        assert.equal(room.trait, elites[0].trait);
        assert.equal(elites[0].showBar, true);
      }
      if (['puzzle', 'shop'].includes(room.kind)) assert.equal(room.enemyIds.length, 0);
      if (room.kind === 'puzzle') assert.ok(['tiles', 'cards', 'keys'].includes(room.puzzle.kind));
      if (room.kind === 'shop') { assert.equal(room.stalls.length, 4); assert.equal(room.reward, null); }
      else if (!['boss', 'intro'].includes(room.kind)) assert.ok(DOOR_REWARDS[room.reward], `${room.kind} ${room.reward}`);
    }
    const boss = world.enemies[world.rooms.at(-1).bossId - 1];
    assert.equal(boss.isBoss && boss.hasPhases, true);
    assert.equal(boss.skills.length, 2);
    assert.notDeepEqual(boss.skills[0], boss.skills[1]);
  }
});

test('每间房都能从起点走到出口', () => {
  for (const act of WORLD_ACTS) for (const seed of SEEDS) {
    const count = createRoomWorld(seed, act).rooms.length;
    for (let id = 0; id < count; id++) {
      const world = createRoomWorld(seed, act), room = world.rooms[id];
      const result = playRoom(world, room);
      assert.equal(result.failed, undefined, `${act.id} ${seed} ${room.kind} ${JSON.stringify(result)}`);
      assert.ok(result.seconds <= 60, `${act.id} ${room.kind} 走了 ${result.seconds} 秒`);
    }
  }
});
