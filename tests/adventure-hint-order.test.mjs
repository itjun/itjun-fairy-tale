import test from 'node:test';
import assert from 'node:assert/strict';
import { Object3D } from 'three';
import { createRoomWorld } from '../shared/room-world.js';
import { fieldHint, stepField } from '../shared/trails/field-progress.js';
import { addFieldViews } from '../src/game/field-views.js';
import { addForestViews } from '../src/game/forest-view.js';
import { createPlayer } from '../src/game/physics.js';

function hintViews(world, player) {
  const signs = [];
  const engine = {
    world, players: [player], elapsed: 1, isReducedMotion: true,
    spriteMaterial: () => ({}), sprite: material => Object.assign(new Object3D(), { material }),
  };
  return {
    engine, items: [], signs, glow: () => new Object3D(),
    paper(x, y) {
      const mesh = new Object3D();
      mesh.position.set(x, y, 0);
      signs.push(mesh);
      return { mesh, draw() {} };
    },
    visibleSigns(state) {
      for (const item of this.items) item.update(state, item.roomId === state.roomId);
      return signs.filter(sign => {
        let isVisible = false;
        sign.traverseVisible(() => { isVisible = true; });
        return isVisible;
      });
    },
  };
}

test('按订单顺序显示路牌，先路过交货处或完成后折返都不提前提示', () => {
  const world = createRoomWorld(42, 'sweet-banquet'), room = world.rooms[0];
  const [cone, berry, counter] = room.stops.map(stop => world.platforms[stop.platformId]);
  const player = createPlayer(counter), state = { roomId: room.id, field: {} };
  // 这间房只绘制任务物品和提示牌。
  const views = hintViews({ ...world, rooms: [{ ...room, props: [] }] }, player);
  addFieldViews(views);
  const [first, second, last] = views.signs;
  const stand = pad => Object.assign(player, createPlayer(pad));
  const collect = () => stepField(world, state, player, 1);
  assert.equal(collect(), null);
  assert.deepEqual(views.visibleSigns(state), []);
  for (const [pad, sign] of [[cone, first], [berry, second], [counter, last]]) {
    stand(pad);
    assert.deepEqual(views.visibleSigns(state), [sign]);
    assert.ok(collect());
    assert.deepEqual(views.visibleSigns(state), []);
  }
  stand(cone);
  assert.deepEqual(views.visibleSigns(structuredClone(state)), []);
});

test('树根先集齐萤火虫才显示点灯提示，点灯后才显示下一处机关', () => {
  const world = createRoomWorld(42, 'forest-rescue');
  const [lamp, bridge] = world.forest.trails.roots.map(stop => world.platforms[stop.platformId]);
  const player = createPlayer(bridge), state = { roomId: 0, forest: { roots: 0, crown: 0, lights: 0 } };
  const views = hintViews(world, player);
  addForestViews(views);
  const visibleAt = pad => {
    Object.assign(player, createPlayer(pad));
    return views.visibleSigns(state).some(sign => sign.position.x === pad.x && sign.position.y === pad.y + 3.1);
  };
  assert.equal(visibleAt(bridge), false);
  state.forest.lights = 3;
  assert.equal(visibleAt(lamp), false);
  state.forest.lights = 7;
  assert.equal(visibleAt(lamp), true);
  state.forest.roots = 1;
  assert.equal(visibleAt(lamp), false);
  assert.equal(visibleAt(bridge), true);
});

test('饼干烤坊先点烤炉，提前站在蛋筒旁也只引导当前步骤', () => {
  const world = createRoomWorld(42, 'sweet-banquet'), room = world.rooms.find(r => r.name === '饼干烤坊');
  const state = { roomId: room.id, field: {} };
  const [oven, cone] = room.stops;
  const player = createPlayer(world.platforms[cone.platformId]);
  assert.ok(fieldHint(world, state, player, 0).endsWith(oven.label));
  assert.equal(stepField(world, state, player, 0), null);
  assert.equal(stepField(world, state, createPlayer(world.platforms[oven.platformId]), 1), oven);
  assert.ok(fieldHint(world, state, player, 1).endsWith(cone.label));
  assert.equal(stepField(world, state, player, 2), cone);
});
