import assert from 'node:assert/strict';
import test from 'node:test';
import { WORLD_ACTS } from '../shared/levels.js';
import { createRoomWorld } from '../shared/room-world.js';
import { rescue } from '../src/game/physics.js';
import { caveForPlayer, caveMouthAt, reachableGrips } from '../src/game/traversal.js';
import { readAdventure, writeAdventure } from '../src/game/save.js';
import { roomFixture } from './helpers/adventure-fixtures.mjs';
import { headless, run } from './helpers/headless-engine.mjs';

const desert = 'desert-world';
const input = (game, direction = 0, up = false, jump = false) => game.setGamepadInput({ direction,
  actions: new Set([direction > 0 && 'right', direction < 0 && 'left', up && 'up', jump && 'confirm'].filter(Boolean)) });

function fixtureAt(depth) {
  const game = headless('room', desert);
  const room = game.world.rooms.find(room => room.depth === depth);
  const fixture = roomFixture('room', desert, { roomId: room.id });
  game.restoreState(fixture.state);
  return { game, room, player: game.players[0], fixture };
}

test('沙漠两扇门都保留主题地形，同种子可恢复，旧世界入口也有可回程洞窟', () => {
  const names = ['砂岩大峡谷', '砂岩峰', '风车遗迹', '绿洲洞窟', '沙漠首领场'];
  const caveNames = new Set();
  for (let seed = 1; seed <= 32; seed++) {
    const world = createRoomWorld(seed, desert);
    assert.deepEqual(world.rooms.map(room => room.traversal.name), [names[0], names[1], names[1], names[2], names[2], names[3], names[3], names[4]]);
    assert.ok(world.rooms.filter(room => room.depth === 1).every(room => room.traversal.grips.some(point => point.isJumpOnly)));
    for (const room of world.rooms.filter(room => room.depth === 3)) {
      const { cave, legacyCave } = room.traversal;
      caveNames.add(cave.name);
      assert.ok(cave.right - cave.left > 28 && cave.floorY < legacyCave.floorY - 30);
      assert.ok(cave.pathIds.every(id => world.platforms[id].caveId === cave.id));
      assert.notEqual(cave.mouths[0].targetId, legacyCave.mouths[0].platformId);
    }
  }
  assert.equal(caveNames.size, 2);
  for (const stage of WORLD_ACTS.filter(stage => stage.id !== desert)) {
    const world = createRoomWorld(42, stage);
    const room = world.rooms[0];
    assert.equal(room.traversal.cave.mouths.length, 4);
    assert.ok(world.platforms[room.traversal.cave.mouths[0].targetId].isCave);
    assert.ok(room.traversal.grips.length + room.traversal.walls.length > 0);
  }
});

test('Xbox 输入贴墙、上爬翻台，跳抓同样适用于四位角色', () => {
  const { game, room, player } = fixtureAt(0);
  const climbWalls = room.traversal.walls.filter(wall => wall.side === -1);
  const first = climbWalls[0];
  const floor = room.platformIds.map(id => game.platforms[id]).find(p => p.y === 0 && Math.abs(first.x - .68 - p.x) < p.width / 2);
  for (const character of ['dad', 'mom', 'sister', 'little']) {
    player.character = character;
    rescue(player, floor, first.x - .68);
    for (const wall of climbWalls) {
      input(game, 1);
      run(game, .7, () => player.x >= wall.x - .66);
      input(game, 1, false, true);
      run(game, .32, () => player.grip?.point === wall);
      assert.equal(player.grip?.point, wall, character);
      input(game, 0, true);
      run(game, 3.4, () => player.ground?.id === wall.topId);
      assert.equal(player.ground?.id, wall.topId, character);
    }
    assert.ok(player.y >= 18);
    input(game);
  }
});

test('攀岩换点需要重新推摇杆，能横移、停住并攀到顶', () => {
  const { game, room, player } = fixtureAt(1);
  const { grips } = room.traversal;
  const floor = game.platforms[room.path[1]];
  rescue(player, floor, grips[0].x - .3);
  for (const section of [0, 1, 2]) {
    const path = grips.filter(point => point.section === section && !point.isJumpOnly);
    input(game, 1, false, true);
    run(game, .22, () => player.grip?.point === path[0]);
    assert.equal(player.grip?.point, path[0], `第 ${section + 1} 段攀岩起点`);
    for (let index = 1; index < path.length; index++) {
      const previous = path[index - 1], target = path[index];
      const dx = target.x - previous.x, dy = target.y - previous.y;
      input(game);
      run(game, .07);
      input(game, Math.abs(dx) > .7 ? Math.sign(dx) : 0, dy > .5);
      run(game, .52);
      assert.equal(player.grip?.point, target, `第 ${section + 1} 段第 ${index + 1} 个抓点`);
    }
    input(game);
    run(game, .4);
    const position = [player.x, player.y];
    run(game, .4);
    assert.deepEqual([player.x, player.y], position);
    input(game, 0, true);
    run(game, .54);
    assert.equal(player.ground?.id, path.at(-1).restId);
    input(game);
  }
  assert.ok(player.y >= 26);
  assert.ok(!reachableGrips(room.traversal, grips[15]).includes(grips.at(-1)), '跨点支路不能靠方向吸过去');
});

test('触屏可以从台边下攀、半途松手再抓墙，然后安全爬到下层', () => {
  const { game, room, player } = fixtureAt(0);
  const [lower, upper] = room.traversal.walls.slice(-2);
  const top = game.platforms[upper.topId];
  rescue(player, top, upper.x + .9);

  game.setTouch('drop', true);
  run(game, .9);
  assert.equal(player.grip?.point, upper);
  assert.ok(player.y < upper.maxY && player.y > upper.minY);
  game.setTouch('drop', false);
  const stopped = player.y;
  run(game, .5);
  assert.equal(player.y, stopped);

  game.setTouch('drop', true);
  game.setTouch('jump', true);
  run(game, 1 / 120);
  game.setTouch('jump', false);
  game.setTouch('drop', false);
  assert.equal(player.grip, null);
  game.setTouch('up', true);
  run(game, .65, () => !!player.grip);
  game.setTouch('up', false);
  assert.equal(player.grip?.point, upper);
  assert.ok(player.y < stopped);
  assert.equal(game.survival.hp, 100);

  game.setTouch('drop', true);
  run(game, 3, () => player.isGrounded);
  assert.equal(player.ground?.id, lower.topId);
  assert.equal(game.survival.hp, 100);
});

test('摇杆向下可沿横向抓点退到山脚', () => {
  const { game, room, player, fixture } = fixtureAt(1);
  fixture.state.adventure.difficulty = 'normal';
  game.restoreState(fixture.state);
  const last = room.traversal.grips.filter(point => !point.isJumpOnly).at(-1);
  const top = game.platforms[last.restId];
  const descend = new Set(['down']);

  rescue(player, top, last.x);
  game.setGamepadInput({ actions: descend });
  run(game, 7, () => player.isGrounded && player.ground !== top && player.y === 0);
  assert.equal(player.ground?.id, room.path[1]);
  assert.equal(game.survival.hp, 100);
});

test('风车遗迹可从矮墙接力跳抓石柱和横梁', () => {
  const { game, room, player } = fixtureAt(2);
  const floor = game.platforms[room.path[1]], [low, pillar, beam] = room.traversal.walls;
  rescue(player, floor, low.x - .8);
  input(game, 1, false, true);
  run(game, .4, () => player.grip?.point === low);
  assert.equal(player.grip?.point, low);
  for (const next of [pillar, beam]) {
    input(game, 1);
    run(game, .03);
    input(game, 1, false, true);
    run(game, 1.2, () => player.grip?.point === next);
    assert.equal(player.grip?.point, next);
  }
});

test('洞窟两端连通，洞里存档恢复后可出洞，地表隔断只能走洞', () => {
  const { game, room, player, fixture } = fixtureAt(3);
  const cave = room.traversal.cave, [mouth, , , exit] = cave.mouths;
  const surface = game.platforms[mouth.platformId];
  rescue(player, surface, mouth.x);
  assert.equal(game.roomBounds().maxX, cave.ridgeX - 1.35);
  assert.equal(caveMouthAt(room, player), mouth);
  input(game, 0, true);
  run(game, .5);
  assert.ok(player.ground.isCave);
  const entries = new Map();
  const storage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) };
  writeAdventure(fixture.run, game.exportState(), storage);
  const saved = readAdventure(storage);
  assert.ok(saved);
  const resumed = headless('room', desert);
  resumed.restoreState(saved.state);
  const restored = resumed.players[0];
  assert.equal(caveForPlayer(room, restored)?.id, cave.id);
  for (const id of cave.pathIds.slice(1)) {
    const next = resumed.platforms[id], ground = restored.ground;
    input(resumed, 1);
    run(resumed, 1.6, () => restored.x >= ground.x + ground.width / 2 - .58);
    input(resumed, 1, false, true);
    for (let frame = 0; frame < 150; frame++) {
      if (restored.x >= next.x - next.width / 2 + .7) input(resumed);
      run(resumed, 1 / 120);
      if (restored.isGrounded) break;
    }
    input(resumed);
    assert.ok(restored.isGrounded && Math.abs(restored.ground.x - next.x) < .01, `洞里石台 ${id}`);
  }
  input(resumed, 1);
  run(resumed, .9, () => restored.x >= exit.x - .1);
  input(resumed, 0, true);
  run(resumed, .5);
  assert.equal(resumed.players[0].ground.id, exit.targetId);
  assert.equal(resumed.roomBounds().minX, cave.ridgeX + 1.35);

  const oldCave = room.traversal.legacyCave;
  const [oldMouth] = oldCave.mouths;
  const oldState = structuredClone(fixture.state);
  Object.assign(oldState.players[0], { safeId: oldMouth.platformId, safeX: oldMouth.x });
  writeAdventure(fixture.run, oldState, storage);
  const oldSave = readAdventure(storage);
  assert.ok(oldSave);
  resumed.restoreState(oldSave.state);
  assert.equal(caveForPlayer(room, restored), oldCave);
  input(resumed);
  input(resumed, 0, true);
  run(resumed, .5);
  assert.equal(restored.ground.id, oldMouth.targetId);
});
