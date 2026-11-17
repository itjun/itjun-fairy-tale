import test from 'node:test';
import assert from 'node:assert/strict';
import { headless } from './helpers/headless-engine.mjs';
import { roomFixture } from './helpers/adventure-fixtures.mjs';
import { readAdventure, writeAdventure } from '../src/game/save.js';

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
