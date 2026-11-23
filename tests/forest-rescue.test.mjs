import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomWorld } from '../shared/room-world.js';
import { FOREST_RESCUE, PLAYABLE_WORLDS } from '../shared/levels.js';
import { syncForestRoutes } from '../shared/forest-rescue.js';
import { createPlayer } from '../src/game/physics.js';
import { newRoomState } from '../src/game/rooms.js';
import { stepForestRescue } from '../src/game/forest-rescue.js';
import { newAdventure } from '../src/game/adventure.js';
import { stepBosses } from '../src/game/bosses.js';
import { caveMouthAt, beginCrawl, stepTraversal } from '../src/game/traversal.js';
import { roomFixture } from './helpers/adventure-fixtures.mjs';
import { readAdventure, writeAdventure } from '../src/game/save.js';
import { openStore } from '../server/store.mjs';

test('两个树心拓扑各有八段长路线，旧森林编号仍重建旧关', () => {
  assert.equal(PLAYABLE_WORLDS[6], FOREST_RESCUE);
  assert.equal(createRoomWorld(42, 'forest-world').zones.length, 5);
  const variants = new Set();
  for (let seed = 1; seed <= 32; seed++) {
    const world = createRoomWorld(seed, FOREST_RESCUE);
    variants.add(world.forest.linked);
    assert.equal(world.signature, createRoomWorld(seed, FOREST_RESCUE).signature);
    for (const trail of Object.values(world.forest.trails)) {
      assert.equal(trail.length, 4);
      const route = trail.flatMap(stop => stop.path).map(id => world.platforms[id]);
      const distance = route.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - route[i].x, p.y - route[i].y), 0);
      assert.ok(distance > 580);
    }
  }
  assert.equal(variants.size, 2);
});

test('两种救援顺序、洞口、捷径和首领激活由实际落脚与回巢触发', () => {
  for (const order of [['crown', 'roots'], ['roots', 'crown']]) {
    const world = createRoomWorld(42, FOREST_RESCUE);
    const state = newRoomState(world), room = world.rooms[0];
    const entry = createPlayer(world.start, -8);
    const mouth = caveMouthAt(room, entry);
    assert.equal(mouth.label, '进树根洞');
    beginCrawl(entry, mouth);
    for (let i = 0; i < 44; i++) stepTraversal(entry, {}, [], world.platforms, 1/120, {}, room.traversal);
    assert.equal(entry.safe.id, world.forest.rootEntryId);
    for (const side of order) {
      const stops = world.forest.trails[side];
      assert.equal(stepForestRescue(world, state.forest, createPlayer(world.platforms[stops[3].platformId])), null);
      if (side === 'roots') {
        assert.equal(stepForestRescue(world, state.forest, createPlayer(world.platforms[stops[0].platformId])), null);
        for (const id of world.forest.fireflies) assert.ok(stepForestRescue(world, state.forest, createPlayer(world.platforms[id])));
      }
      for (const stop of stops) {
        const player = createPlayer(world.platforms[stop.platformId]);
        assert.ok(stepForestRescue(world, state.forest, player));
        assert.equal(stepForestRescue(world, state.forest, player), null);
      }
      assert.equal(state.forest[side], 4);
      assert.ok(world.platforms[world.forest.bridges[side]].isEnabled);
      stepBosses(world, createPlayer(world.start), 1/120, 1, [], {});
      assert.equal(world.enemies[room.bossId-1].isDormant, true);
      assert.ok(stepForestRescue(world, state.forest, createPlayer(world.start)).delivered);
    }
    assert.equal(world.bossArenas[0].isLocked, false);
    stepBosses(world, createPlayer(world.start), 1/120, 2, [], newAdventure(42));
    assert.equal(world.enemies[room.bossId-1].isDormant, false);
  }
});

test('续关恢复带鸟状态和捷径，旧局与新局成绩能分别备份导入', () => {
  const { run, state } = roomFixture('room', FOREST_RESCUE.id);
  state.rooms.forest = { crown: 4, roots: 2, lights: 7 };
  const memory = new Map();
  const storage = { getItem: k => memory.get(k) ?? null, setItem: (k,v) => memory.set(k,v), removeItem: k => memory.delete(k) };
  writeAdventure(run, state, storage);
  const saved = readAdventure(storage);
  assert.deepEqual(saved.state.rooms.forest, state.rooms.forest);
  const world = createRoomWorld(run.seed, FOREST_RESCUE);
  syncForestRoutes(world, saved.state.rooms.forest);
  assert.ok(world.rooms[0].traversal.walls.length);
  assert.ok(world.platforms[world.forest.bridges.roots].isEnabled);
  assert.ok(world.bossArenas[0].isLocked);
  const store = openStore(':memory:');
  try {
    for (const id of [FOREST_RESCUE.id, 'forest-world']) {
      const record = roomFixture('room', id).run;
      assert.equal(store.save(record).levelId, id);
      assert.equal(store.save({...record, revision:2, collectedIds:[1], flowers:1},true).flowers, 1);
    }
  } finally { store.close(); }
});
