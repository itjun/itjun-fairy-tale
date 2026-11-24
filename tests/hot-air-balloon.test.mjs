import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_MAPS } from '../shared/levels.js';
import { createRoomWorld } from '../shared/room-world.js';
import { TIMED_ITEMS } from '../shared/adventure-catalog.js';
import { readAdventure, writeAdventure } from '../src/game/save.js';
import { readXboxPad } from '../src/input/gamepad-state.js';
import { headless, run } from './helpers/headless-engine.mjs';
import { roomFixture } from './helpers/adventure-fixtures.mjs';

const level = 'beach-tide-lights-terraces';

test('新旧地图的开场都能从入口平台跳到热气球，每个气球有独立编号', () => {
  for (const stage of WORLD_MAPS) {
    const world = createRoomWorld(42, stage);
    const balloons = world.supplies.filter(item => item.kind === 'hotAirBalloon');
    assert.ok(balloons.some(item => item.platformId === world.start.id), stage.id);
    assert.equal(new Set(balloons.map(item => item.id)).size, balloons.length);
    for (const item of balloons) {
      const floor = world.platforms[item.platformId];
      assert.ok(Math.abs(item.x - floor.x) < floor.width / 2);
      assert.ok(item.y - floor.y > 2.3 && item.y - floor.y < 4);
    }
  }
});

test('热气球可用摇杆和触屏飞行，悬停和暂停续玩后按剩余时间到期', () => {
  const game = headless('room', level);
  const player = game.players[0], item = game.world.supplies.find(s => s.kind === 'hotAirBalloon');
  player.x = item.x;
  game.tick();
  assert.equal(game.adventure.effects.hotAirBalloon, undefined);
  game.jumps[0] = true;
  run(game, .5, () => game.claimedSupplies.includes(item.id));
  assert.equal(game.adventure.effects.hotAirBalloon, TIMED_ITEMS.hotAirBalloon.duration);
  assert.equal(game.supplyViews.get(item.id).visible, false);

  const position = () => [player.x, player.y];
  const [x, y] = position();
  game.setGamepadInput(readXboxPad({ connected: true, mapping: 'standard', axes: [-.6, -.6], buttons: [] }));
  run(game, .5);
  assert.ok(player.x < x && player.y > y);
  game.releaseGamepad();
  const hovered = position();
  run(game, .4);
  assert.deepEqual(position(), hovered);
  game.setTouch('right', true);
  game.setTouch('drop', true);
  run(game, .15);
  assert.ok(player.x > hovered[0] && player.y < hovered[1]);
  game.pause(true);
  const seconds = game.adventure.effects.hotAirBalloon;
  for (let frame = 0; frame < 240; frame++) game.tick();
  assert.equal(game.adventure.effects.hotAirBalloon, seconds);

  const data = new Map(), storage = { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) };
  const record = roomFixture('room', level).run;
  writeAdventure(record, game.exportState(), storage);
  const saved = readAdventure(storage);
  assert.ok(saved);
  const restored = headless('room', level);
  restored.restoreState(saved.state);
  const pilot = restored.players[0];
  assert.deepEqual([pilot.x, pilot.y], position());
  assert.equal(restored.adventure.effects.hotAirBalloon, seconds);
  assert.equal(restored.supplyViews.get(item.id).visible, false);
  run(restored, seconds - .1);
  assert.equal(pilot.y, player.y);
  assert.ok(restored.adventure.effects.hotAirBalloon > 0);
  run(restored, 1.5);
  assert.equal(restored.adventure.effects.hotAirBalloon, undefined);
  assert.equal(pilot.isGrounded, true);
  assert.equal(restored.claimedSupplies.filter(id => id === item.id).length, 1);

  saved.state.players[0].balloonPosition.y = 1e8;
  writeAdventure(record, saved.state, storage);
  assert.equal(readAdventure(storage), null);
});
