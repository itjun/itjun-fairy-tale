import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PLAYABLE_WORLDS } from '../shared/levels.js';
import { createRoomWorld } from '../shared/room-world.js';
import { GardenEngine } from '../src/game/engine.js';
import { newRoomState } from '../src/game/rooms.js';
import { createPlayer, platformY, stepPlayer } from '../src/game/physics.js';
import { mechanismSave, restoreMechanisms, stepMechanisms } from '../src/game/hazards.js';
import { addNetView } from '../src/game/safety-net-view.js';

function parade() {
  const world = createRoomWorld(42, PLAYABLE_WORLDS.find(w => w.themeId === 'family'), 2);
  const room = world.rooms.find(r => r.name === '屋脊大巡游');
  return { world, room };
}

test('屋脊大巡游里沿屋边走或跳，镜头目标的位移不超过人物位移', () => {
  const { world, room } = parade();
  const frame = room.frames[0], player = createPlayer(world.platforms[room.startId]);
  const game = Object.assign(Object.create(GardenEngine.prototype), {
    world, players: [player], level: { id: 'family' }, journey: {}, camera: { right: 24 },
    roomState: { ...newRoomState(world), roomId: room.id },
  });
  const target = (x, y) => {
    Object.assign(player, { x, y });
    return game.cameraTarget();
  };
  for (const [x, y, dx, dy] of [
    [frame.x + frame.width * .48, frame.y, .05, 0],
    [frame.x, frame.y - 12, 0, .05],
    [frame.x, frame.y + 12, 0, .05],
  ]) {
    const before = target(x - dx, y - dy), after = target(x + dx, y + dy);
    assert.ok(Math.hypot(after.x - before.x, after.y - before.y) <= 2 * (dx + dy) + 1e-8,
      `人物移动 0.1，镜头目标移动 ${Math.hypot(after.x - before.x, after.y - before.y).toFixed(2)}`);
  }
});

test('落在软网上会压低脚下的网面、回摆，两端固定，起跳后逐渐恢复', () => {
  const { world, room } = parade();
  const net = room.platformIds.map(id => world.platforms[id]).find(p => p.skin === 'safety-net');
  const ledge = { id: -1, x: net.x + net.width * .8, y: net.y, width: net.width * .6 };
  const group = new THREE.Group();
  const draw = addNetView({ resources: [] }, group, net, new THREE.MeshBasicMaterial());
  const geometry = group.children[0].geometry;
  const positions = geometry.attributes.position;
  const foot = Math.round(geometry.parameters.widthSegments * .7);
  const contactX = net.x + positions.getX(foot);
  const player = createPlayer(net, contactX - net.x), rest = player.y;
  const ropeAtRest = positions.getY(foot), endAtRest = positions.getY(0);
  const ends = [-1, 1].map(side => net.x + side * net.width / 2);
  const anchors = ends.map(x => platformY(net, x));
  Object.assign(player, { y: rest + 5, isGrounded: false, ground: null });
  const dt = 1 / 120;
  let time = 0;
  function step(input = {}) {
    time += dt;
    stepMechanisms(world, player, time, dt);
    stepPlayer(player, { direction: 0, ...input }, [net, ledge], dt);
    draw();
  }
  for (let i = 0; i < 180 && !player.isGrounded; i++) step();
  assert.equal(player.ground, net);
  const heights = [];
  for (let i = 0; i < 120; i++) {
    step();
    assert.equal(player.ground, net);
    assert.equal(player.y, platformY(net, player.x));
    assert.ok(Math.abs((positions.getY(foot) - ropeAtRest) - (player.y - rest)) < 1e-5);
    heights.push(player.y);
  }
  const low = Math.min(...heights);
  assert.ok(low < rest - .25, `踩下去网面只降低了 ${(rest - low).toFixed(2)}`);
  assert.ok(Math.max(...heights.slice(heights.indexOf(low))) > low + .12);
  assert.deepEqual(ends.map(x => platformY(net, x)), anchors);
  assert.equal(positions.getY(0), endAtRest);
  const restored = parade().world;
  restoreMechanisms(restored, mechanismSave(world), time);
  assert.equal(platformY(restored.platforms[net.id], contactX), player.y);
  assert.equal(restored.platforms[net.id].netMotion.speed, net.netMotion.speed);
  step({ jump: true, direction: 1 });
  assert.ok(player.vy > 0);
  for (let i = 0; i < 240 && player.ground !== ledge; i++) step({ direction: 1 });
  assert.equal(player.ground, ledge);
  for (let i = 0; i < 360; i++) step();
  assert.ok(Math.abs(platformY(net, contactX) - rest) < .01);
});
