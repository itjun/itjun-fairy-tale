import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer } from '../src/game/physics.js';
import { doorAt, isRoomCleared } from '../src/game/rooms.js';
import { readAdventure, writeAdventure } from '../src/game/save.js';
import { headless, run } from './helpers/headless-engine.mjs';
import { roomFixture } from './helpers/adventure-fixtures.mjs';

test('战区清怪后才放行，读档保留封锁和波次，全部清完才开出口', () => {
  for (const difficulty of ['easy', 'normal', 'hard']) {
    const game = headless('room'), room = game.world.rooms.find(item => item.kind === 'battle');
    const fixture = roomFixture('room', 'rainbow-world', { roomId: room.id });
    fixture.state.adventure.difficulty = difficulty;
    fixture.state.rooms.wave = 1;
    const remaining = room.enemyIds.map(id => game.world.enemies[id - 1]).find(enemy => enemy.wave === 1);
    for (const enemy of fixture.state.enemies.filter(enemy => enemy.roomId === room.id)) {
      if (enemy.wave <= 1 && enemy.id !== remaining.id) {
        enemy.isDefeated = true; enemy.hp = 0; fixture.state.defeatedIds.push(enemy.id);
      }
      enemy.isDormant = enemy.wave > 1 || enemy.parentId !== undefined;
    }
    const floor = game.world.platforms[room.encounters[0].endId];
    fixture.state.players[0].safeId = floor.id;
    fixture.state.players[0].safeX = floor.x;
    const data = new Map(), storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
    writeAdventure(fixture.run, fixture.state, storage);
    const saved = readAdventure(storage);
    assert.ok(saved, '原第 11 版存档继续有效');
    game.restoreState(saved.state);
    game.keys.add('ArrowRight');
    run(game, 0.6);
    assert.ok(game.players[0].x <= floor.x + 1, `${difficulty} 没清怪就越过栅栏`);
    assert.equal(game.roomState.wave, 1, '向前走不跳过剩余怪物或波次');
    assert.equal(game.world.enemies[remaining.id - 1].isDefeated, false);
    Object.assign(game.world.enemies[remaining.id - 1], { isDefeated: true, hp: 0 });
    run(game, 0.6);
    assert.equal(game.roomState.wave, 2);
    assert.ok(game.players[0].x > floor.x + 2, '这一战区清完即可往前走');
    const door = game.world.doors.find(item => item.roomId === room.id);
    Object.assign(game.players[0], createPlayer(game.world.platforms[door.platformId], door.offsetX));
    assert.equal(doorAt(game.world, game.roomState, game.players[0]), null, '走到出口不能跳过战斗');
    game.keys.clear();
    Object.assign(game.players[0], createPlayer(floor));
    for (const id of [...room.enemyIds, ...room.childIds]) {
      Object.assign(game.world.enemies[id - 1], { isDefeated: true, hp: 0 });
    }
    run(game, 0.1);
    assert.ok(isRoomCleared(game.roomState, room.id), '所有波次打完仍正常清房');
    Object.assign(game.players[0], createPlayer(game.world.platforms[door.platformId], door.offsetX));
    assert.equal(doorAt(game.world, game.roomState, game.players[0]), door);
  }
});
