import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { WORLD_ACTS } from '../shared/levels.js';
import { createRoomWorld, doorPosition } from '../shared/room-world.js';
import { createPlayer, stepPlayer } from '../src/game/physics.js';
import { newRoomState, stepRoom, doorAt } from '../src/game/rooms.js';

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

test('第 10 版原平台、怪、宝物及机关的编号和位置保持不变', () => {
  // 修改前八个世界 seed 42 的指纹；新增落脚点只追加在末尾，不挤掉旧存档引用。
  const counts = [68, 61, 59, 72, 59, 66, 74, 59];
  const originals = WORLD_ACTS.map((act, index) => {
    const world = createRoomWorld(42, act);
    return { platforms: world.platforms.slice(0, counts[index]), treasures: world.treasures, enemies: world.enemies, springs: world.springs, lifts: world.lifts, switches: world.switches, hazards: world.hazards, supplies: world.supplies, mainPath: world.mainPath, signature: world.signature };
  });
  assert.equal(createHash('sha256').update(JSON.stringify(originals)).digest('hex'), '43413b66c04ba4372c0aec8605e1bc023d224f8d758a0cd67cd64c3084059bda');
});
