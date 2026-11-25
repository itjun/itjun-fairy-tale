import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { syncField } from '../shared/trails/field-progress.js';
import { addFieldViews } from '../src/game/field-views.js';
import { rescue } from '../src/game/physics.js';
import { readAdventure } from '../src/game/save.js';
import { roomFixture } from './helpers/adventure-fixtures.mjs';
import { headless } from './helpers/headless-engine.mjs';

function delivery(stage, difficulty = 'normal') {
  const game = headless('room', stage);
  const room = game.world.rooms.find(room => room.name === '悬空甜品车');
  const fixture = roomFixture('room', stage, { roomId: room.id });
  fixture.state.adventure.difficulty = difficulty;
  game.restoreState(fixture.state);
  const player = game.players[0], cart = game.platforms[room.moving[0].platformId];
  function stand(key) {
    const stop = room.stops.find(s => s.key === key);
    const platform = game.platforms[stop.platformId];
    rescue(player, platform, platform.x);
    game.elapsed += 1 / 120;
    game.tick();
    assert.ok(Object.hasOwn(game.roomState.field, room.id + '/' + key), stop.label);
  }
  function reload() {
    const data = JSON.stringify({ run: fixture.run, state: game.exportState() });
    const saved = readAdventure({ getItem: () => data, removeItem() {} });
    assert.ok(saved, '这次冒险可以续玩');
    game.restoreState(saved.state);
  }
  function fall() {
    Object.assign(player, { y: room.fallY - 1, ground: null, isGrounded: false });
    game.tick();
  }
  return { game, room, cart, player, stand, reload, fall };
}

for (const stage of ['sweet-banquet', 'sweet-banquet-terraces']) {
  test(stage+'：送达前掉坑，读档继续能带着原来的两件配料重新上车', () => {
    const { game, room, cart, player, stand, fall, reload } = delivery(stage);
    stand('piece0'); stand('piece1');
    const collected = { ...game.roomState.field };
    game.survival.hp = 1;
    fall(); reload();
    assert.equal(game.revive(), true);
    game.pause(false);
    assert.deepEqual(game.roomState.field, collected);
    stand('serve');
    game.elapsed += 3;
    syncField(game.world, game.roomState, game.elapsed);
    assert.ok(cart.x > room.moving[0].x);
    game.survival.hp = 1;
    fall(); reload();
    assert.equal(game.revive(), true);
    assert.deepEqual(game.roomState.field, collected, '两件配料回到手里，可以重新装车');
    assert.equal(cart.x, room.moving[0].x, '车回到装货处等人');
    game.pause(false); game.tick();
    assert.deepEqual(game.roomState.field, collected, '在岸上复活时不会误装车');
    stand('serve');
    assert.equal(player.ground, cart);
    game.elapsed += room.moving[0].period / 2;
    syncField(game.world, game.roomState, game.elapsed);
    stand('ride');
    const delivered = { ...game.roomState.field };
    fall(); reload();
    assert.deepEqual(game.roomState.field, delivered, '送达后掉坑不重复发配料');
  });
}

test('轻松档运输途中掉坑，回到出发岸就能带着配料重试', () => {
  const { game, cart, room, stand, fall } = delivery('sweet-banquet-terraces', 'easy');
  stand('piece0'); stand('piece1');
  const picked = { ...game.roomState.field };
  stand('serve');
  game.elapsed += 3;
  syncField(game.world, game.roomState, game.elapsed);
  fall();
  assert.equal(game.survival.lives, 3);
  assert.equal(game.survival.hp, game.survival.maxHp);
  assert.deepEqual(game.roomState.field, picked);
  assert.equal(cart.x, room.moving[0].x);
});

test('甜品杯与蓝莓球跟着角色，装车后随车移动，到岸、读档后仍在篮子里', t => {
  const { game, room, cart, player, stand, reload } = delivery('sweet-banquet-terraces');
  const pen = Object.fromEntries(['scale','beginPath','ellipse','fill','stroke','lineTo','moveTo','closePath'].map(k => [k, () => {}]));
  globalThis.document = { createElement: () => ({ getContext: () => pen }) };
  t.after(() => { delete globalThis.document; });
  Object.assign(game, {
    scene: new THREE.Scene(), resources: [], textures: [], planeGeometry: new THREE.PlaneGeometry(),
    spriteMaterial: name => new THREE.MeshBasicMaterial({ name }),
    platformViews: new Map(game.platforms.map(p => [p.id, new THREE.Group()])),
  });
  const views = { engine: game, items: [], glow: () => new THREE.Object3D(), paper: () => ({ mesh: new THREE.Object3D(), draw() {} }) };
  addFieldViews(views);
  function checkCargo(x, y, radius) {
    views.items.forEach(view => view.update(game.roomState, view.roomId === room.id));
    for (const name of ['mini-cup', 'mini-scoop-blue']) {
      const items = game.scene.children.filter(o => o.visible && o.material?.name === name);
      assert.equal(items.length, 1, name+' 只出现一份');
      assert.ok(Math.abs(items[0].position.x - x) < radius && Math.abs(items[0].position.y - y) < 3, name+' 应在实际持有者身边');
    }
  }
  stand('piece0'); stand('piece1');
  game.elapsed += 1;
  checkCargo(player.x, player.y, 2);
  stand('serve');
  for (const dt of [2, 4.5]) {
    game.elapsed += dt;
    syncField(game.world, game.roomState, game.elapsed);
    checkCargo(cart.x, cart.y, cart.width / 2);
  }
  stand('ride');
  game.elapsed += 2;
  reload();
  checkCargo(cart.x, cart.y, cart.width / 2);
  assert.equal(game.platformViews.get(cart.id).visible, false, '车身使用自己的踏板');
});
