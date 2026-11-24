import test from 'node:test';
import assert from 'node:assert/strict';
import { headless } from './helpers/headless-engine.mjs';
import { roomFixture } from './helpers/adventure-fixtures.mjs';
import { readAdventure, writeAdventure } from '../src/game/save.js';
import { createRoomWorld } from '../shared/room-world.js';
import { enterDoor } from '../src/game/rooms.js';
import { restoreEnemy } from '../src/game/enemies.js';

test('第 11 版旧局补守卫时不改变原状态和已清房间，新存档往返不再追加', () => {
  const fixture = roomFixture('boss-moon'), originalCount = fixture.state.enemies.findIndex(e => e.isReinforcement);
  fixture.state.enemies = fixture.state.enemies.slice(0, originalCount);
  fixture.state.defeatedIds = fixture.state.defeatedIds.filter(id => id <= originalCount);
  const original = structuredClone(fixture.state.enemies);
  const data = new Map(), storage = {getItem:k=>data.get(k) ?? null, setItem:(k,v)=>data.set(k,v), removeItem:k=>data.delete(k)};
  writeAdventure(fixture.run, fixture.state, storage);
  const loaded = readAdventure(storage); assert.ok(loaded);
  assert.deepEqual(loaded.state.enemies.slice(0, originalCount), original);
  assert.ok(loaded.state.enemies.slice(originalCount).every(e => e.isDormant));
  writeAdventure(loaded.run, loaded.state, storage);
  assert.deepEqual(readAdventure(storage), loaded);
});

test('旧局恢复到第三波时，前两波追加的守卫不会重新冒出来', () => {
  const game = headless('room');
  const room = game.world.rooms.find(r => r.kind === 'battle');
  const current = roomFixture('room', 'rainbow-world', {roomId:room.id});
  const originalCount = current.state.enemies.findIndex(e => e.isReinforcement);
  current.state.rooms.wave = 2;
  current.state.enemies = current.state.enemies.slice(0, originalCount);
  current.state.defeatedIds = current.state.defeatedIds.filter(id => id <= originalCount);
  const data = new Map(), storage = {getItem:k=>data.get(k) ?? null, setItem:(k,v)=>data.set(k,v), removeItem:k=>data.delete(k)};
  writeAdventure(current.run, current.state, storage);
  const loaded = readAdventure(storage); assert.ok(loaded);
  for (const e of game.world.enemies.filter(e => e.isReinforcement && e.roomId === room.id)) assert.equal(loaded.state.enemies[e.id-1].isDormant, e.wave !== 2);
});

test('暗河旧档恢复台边和复活点，已过房间不刷怪，后续房间进门有怪', () => {
  const stage = 'desert-oasis-springs', roomId = 5;
  const { run, state } = roomFixture('room', stage, { roomId });
  const world = createRoomWorld(run.seed, stage), room = world.rooms[roomId];
  const home = world.platforms[room.startId];
  // 改动前这关只有战斗房的六只守卫和一个首领，入口平台宽 13。
  state.enemies = state.enemies.slice(0, 7);
  state.defeatedIds = run.defeatedIds = state.defeatedIds.filter(id => id <= 7);
  state.players[0].safeX = home.x + 6;
  state.revival = { platformId: home.id, offsetX: 6 };
  Object.assign(state.survival, { hp: 0, lives: 2, phase: 'fallen' });
  const storage = { getItem: () => JSON.stringify({run,state}), removeItem() {} };
  const saved = readAdventure(storage);
  assert.ok(saved);
  assert.equal(saved.state.players[0].safeId, home.id);
  assert.ok(saved.state.players[0].safeX > home.x && saved.state.players[0].safeX < home.x + home.width / 2);
  assert.ok(saved.state.revival.offsetX > 0 && saved.state.revival.offsetX <= home.width / 2 - .35);
  assert.deepEqual(saved.state.defeatedIds, state.defeatedIds);
  for (const e of world.enemies) {
    restoreEnemy(e, saved.state.enemies[e.id - 1]);
    if (e.isReinforcement) assert.equal(e.isDormant, e.roomId !== roomId);
  }
  const next = enterDoor(world, saved.state.rooms, world.doors.find(d => d.roomId === roomId));
  assert.ok(next.enemyIds.every(id => !world.enemies[id - 1].isDormant));
});
