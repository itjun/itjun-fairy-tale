import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomWorld } from '../shared/room-world.js';
import { stepField, syncField } from '../shared/trails/field-progress.js';
import { createPlayer, platformY, rescue, stepPlayer } from '../src/game/physics.js';
import { newRoomState } from '../src/game/rooms.js';
import { readAdventure } from '../src/game/save.js';
import { roomFixture } from './helpers/adventure-fixtures.mjs';
import { headless, run } from './helpers/headless-engine.mjs';

const stage = 'desert-oasis-springs';
test('五座光桥点亮后都能从高台走上去，停稳、起跳、下滑和反方向走回来', () => {
  const world = createRoomWorld(6732, stage), state = newRoomState(world);
  const bridges = world.platforms.filter(p => p.skin === 'sunlight');
  assert.equal(bridges.length, 5);
  assert.deepEqual(bridges, world.platforms.slice(-5));
  for (const bridge of bridges) {
    const room = world.rooms[bridge.roomId];
    state.roomId = room.id;
    const tiles = room.platformIds.map(id => world.platforms[id]).filter(p => !p.isCave);
    const stop = room.stops.find(s => s.key === bridge.fieldGate);
    const from = world.platforms[stop.platformId], to = world.platforms[stop.lightTargetId];
    const high = from.y > to.y ? from : to, low = high === from ? to : from;
    const downhill = Math.sign(low.x - high.x);
    const player = createPlayer(high);
    const tick = (direction, vertical = 0, jump = false) =>
      stepPlayer(player, { direction, vertical, jump }, tiles, 1/120, { minX:room.left, minY:room.fallY });
    syncField(world, state, 0);
    assert.equal(bridge.isEnabled, false);
    for (const earlier of room.stops.slice(0, room.stops.indexOf(stop))) {
      stepField(world, state, createPlayer(world.platforms[earlier.platformId]), 1);
    }
    assert.equal(stepField(world, state, createPlayer(from), 1), stop);
    syncField(world, state, 1);
    assert.equal(bridge.isEnabled, true);
    for (let i = 0; i < 200 && player.ground !== bridge; i++) {
      tick(downhill);
      assert.ok(player.isGrounded, stop.label);
    }
    assert.equal(player.ground, bridge);
    for (let i = 0; i < 16; i++) tick(downhill);
    const startX = player.x, startY = player.y;
    for (let i = 0; i < 120; i++) tick(0);
    assert.equal(player.x, startX);
    assert.equal(player.y, startY);
    assert.ok(tick(0, 0, true).isJumped);
    for (let i = 0; i < 240 && !player.isGrounded; i++) tick(0);
    assert.equal(player.ground, bridge);
    for (let i = 0; i < 30; i++) tick(0, -1);
    assert.ok(player.y < startY);
    const pausedX = player.x;
    tick(0);
    assert.equal(player.x, pausedX);
    for (let i = 0; i < 900 && player.ground !== low; i++) tick(0, -1);
    assert.equal(player.ground, low);
    assert.ok(Math.abs(player.x - low.x) < 1);
    for (let i = 0; i < 1500 && player.ground !== high; i++) tick(-downhill);
    assert.equal(player.ground, high);
  }
});

test('驼队引水渠在桥上续关，触屏和手柄都能下滑，到神灯下可以进洞', () => {
  const fixture = roomFixture('room', stage, {roomId:6});
  const game = headless('room', stage);
  game.restoreState(fixture.state);
  const room = game.world.rooms[6], player = game.players[0];
  const look = room.stops.find(s => s.key === 'look');
  rescue(player, game.platforms[look.platformId]);
  run(game, .1);
  game.setGamepadInput({actions:new Set(['right']), direction:1});
  const bridge = game.platforms.find(p => p.roomId === room.id && p.skin === 'sunlight');
  run(game, 4, () => player.x >= bridge.x);
  assert.equal(player.ground, bridge);
  fixture.state = game.exportState();
  const storage = {getItem:() => JSON.stringify(fixture), removeItem(){}};
  const saved = readAdventure(storage);
  assert.ok(saved);
  const resumed = headless('room', stage);
  resumed.restoreState(saved.state);
  const rider = resumed.players[0], x = rider.x;
  assert.equal(rider.ground.id, bridge.id);
  assert.equal(rider.y, platformY(bridge,x));
  resumed.setTouch('drop',true);
  run(resumed,.35);
  assert.equal(rider.ground.id, bridge.id);
  assert.ok(rider.x > x);
  resumed.setTouch('drop',false);
  resumed.setGamepadInput({actions:new Set(['down'])});
  run(resumed,4,()=>rider.ground?.id === look.lightTargetId);
  assert.equal(rider.ground?.id, look.lightTargetId);
  resumed.setGamepadInput({actions:new Set(['up'])});
  run(resumed,.6);
  assert.equal(rider.ground?.caveId,room.traversal.cave.id);
});
