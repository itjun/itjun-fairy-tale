import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_ACTS } from '../shared/levels.js';
import { createRoomWorld, spotPosition, doorPosition } from '../shared/room-world.js';
import { createPlayer } from '../src/game/physics.js';
import { newRoomState, stepRoom, isRoomCleared, doorAt, enterDoor, recordCombo, recordHurt, roomProgress, dropPosition, stallAt, starTotal, isValidRoomState, COMBO_WINDOW } from '../src/game/rooms.js';

const STEP = 1 / 120;
// 找一张第一层就有指定房间的图，把进度直接放到那间房。
function roomOf(kind, isMatch = () => true) {
  for (const act of WORLD_ACTS) for (let seed = 1; seed < 80; seed++) {
    const world = createRoomWorld(seed, act), room = world.rooms.find(item => item.depth === 1 && item.kind === kind && isMatch(item));
    if (!room) continue;
    const state = newRoomState(world), player = createPlayer(world.platforms[world.rooms[0].exitId]);
    stepRoom(world, state, player, STEP);
    enterDoor(world, state, world.doors.find(door => door.roomId === 0 && door.targetRoomId === room.id));
    Object.assign(player, createPlayer(world.platforms[room.startId]));
    return { world, room, state, player };
  }
  throw new Error(`没找到 ${kind}`);
}
const enemiesOf = (world, room, wave) => room.enemyIds.map(id => world.enemies[id - 1]).filter(enemy => enemy.wave === wave);
const types = events => events.map(event => event.type);

test('开场房走到出口才开门，跳到门上才进下一间', () => {
  const world = createRoomWorld(42, WORLD_ACTS[0]), state = newRoomState(world), room = world.rooms[0];
  const player = createPlayer(world.platforms[room.startId]);
  assert.deepEqual(stepRoom(world, state, player, STEP), []);
  assert.equal(doorAt(world, state, player), null);
  const exit = world.platforms[room.exitId];
  Object.assign(player, createPlayer(exit));
  const events = stepRoom(world, state, player, STEP);
  assert.deepEqual(types(events), ['clear']);
  assert.equal(events[0].stars, 3);
  assert.equal(isRoomCleared(state), true);
  assert.deepEqual(stepRoom(world, state, player, STEP), [], '清完只报一次');
  const doors = world.doors.filter(door => door.roomId === 0);
  assert.equal(doors.length, 2);
  assert.equal(doorAt(world, state, player), null, '站在出口上不算进门');
  for (const door of doors) {
    const spot = doorPosition(world, door);
    Object.assign(player, createPlayer(world.platforms[door.platformId], spot.x - world.platforms[door.platformId].x));
    assert.equal(doorAt(world, state, player), door);
    player.x = spot.x + 3;
    assert.equal(doorAt(world, state, player), null, '离门远了不算');
  }
  const next = enterDoor(world, state, doors[1]);
  assert.equal(next.id, doors[1].targetRoomId);
  assert.deepEqual(state.path, [0, next.id]);
  assert.equal(state.wave, 0);
  assert.equal(isRoomCleared(state), false);
  assert.equal(isValidRoomState(structuredClone(state), world), true);
});

test('战斗房一波打完才出下一波，全部打完开门；挑战那一波只在挑战难度出现', () => {
  for (const isExtraWave of [false, true]) {
    const { world, room, state, player } = roomOf('battle');
    const total = room.waves + (isExtraWave ? 1 : 0);
    assert.equal(roomProgress(world, state, isExtraWave).waves, total);
    for (let wave = 0; wave < total; wave++) {
      const group = enemiesOf(world, room, wave);
      assert.equal(group.every(enemy => !enemy.isDormant), true, `第 ${wave} 波醒着`);
      assert.equal(roomProgress(world, state, isExtraWave).left, group.length);
      group.slice(1).forEach(enemy => { enemy.isDefeated = true; });
      assert.deepEqual(stepRoom(world, state, player, STEP, isExtraWave), [], '还剩一只不出下一波');
      group[0].isDefeated = true;
      const events = stepRoom(world, state, player, STEP, isExtraWave);
      assert.deepEqual(types(events), [wave + 1 < total ? 'wave' : 'clear']);
    }
    assert.equal(isRoomCleared(state), true);
    assert.equal(enemiesOf(world, room, room.waves).every(enemy => enemy.isDormant) , !isExtraWave, '不选挑战时那一波一直睡着');
    assert.equal(isValidRoomState(structuredClone(state), world), true);
  }
});

test('受伤和掉坑各少一颗星，进新房间重新计', () => {
  const { world, room, state, player } = roomOf('mechanism');
  recordHurt(state, false, false); recordHurt(state, true, true);
  assert.equal(state.downs, 1);
  Object.assign(player, createPlayer(world.platforms[room.exitId]));
  assert.equal(stepRoom(world, state, player, STEP).find(event => event.type === 'clear').stars, 1);
  assert.equal(starTotal(state), 3 + 1);
  const door = world.doors.find(item => item.roomId === room.id);
  enterDoor(world, state, door);
  assert.deepEqual([state.isHurt, state.isFallen, state.downs], [false, false, 0]);
});

test('不用选卡的奖励掉在门边，走过去捡一次', () => {
  const { world, room, state, player } = roomOf('mechanism', item => item.reward === 'heart');
  Object.assign(player, createPlayer(world.platforms[room.exitId]));
  const spot = dropPosition(world, room);
  player.x = spot.x + 5;
  assert.deepEqual(types(stepRoom(world, state, player, STEP)), ['clear']);
  assert.deepEqual(state.drops, [{ roomId: room.id, kind: 'heart', isTaken: false }]);
  player.x = spot.x;
  assert.deepEqual(stepRoom(world, state, player, STEP), [{ type: 'drop', kind: 'heart' }]);
  assert.deepEqual(stepRoom(world, state, player, STEP), []);
  assert.equal(isValidRoomState(structuredClone(state), world), true);
});

test('彩虹砖按顺序踩，踩错从头来', () => {
  const { world, room, state, player } = roomOf('puzzle', item => item.puzzle.kind === 'tiles');
  const { tiles, order } = room.puzzle;
  const stand = color => { const tile = tiles.find(item => item.color === color); Object.assign(player, createPlayer(world.platforms[tile.platformId])); return stepRoom(world, state, player, STEP); };
  const floor = () => { Object.assign(player, createPlayer(world.platforms[room.startId])); return stepRoom(world, state, player, STEP); };
  assert.deepEqual(stand(order[0]), [{ type: 'puzzle', isRight: true }]);
  assert.deepEqual(stand(order[0]), [], '站着不动不重复算');
  assert.deepEqual(stand(order[2]), [{ type: 'puzzle', isRight: false }]);
  assert.equal(state.puzzle.step, 0);
  floor();
  for (const color of order.slice(0, -1)) { assert.equal(stand(color)[0].isRight, true); floor(); }
  assert.equal(isValidRoomState(structuredClone(state), world), true);
  assert.deepEqual(types(stand(order.at(-1))), ['puzzle', 'clear']);
});

test('翻牌要跳起来顶，两张一样才留着', () => {
  const { world, room, state, player } = roomOf('puzzle', item => item.puzzle.kind === 'cards');
  const cards = room.puzzle.cards;
  const bump = index => { const spot = spotPosition(world, cards[index]); Object.assign(player, { x: spot.x, y: spot.y - 1.7, vy: 6, isGrounded: false, ground: null }); return stepRoom(world, state, player, STEP); };
  const pairOf = index => cards.findIndex((card, n) => n !== index && card.face === cards[index].face);
  const other = cards.findIndex(card => card.face !== cards[0].face);
  Object.assign(player, { x: spotPosition(world, cards[0]).x, vy: 0 });
  assert.deepEqual(stepRoom(world, state, player, STEP), [], '从下面走过不会翻');
  assert.equal(bump(0)[0].isRight, true);
  assert.equal(bump(other)[0].isRight, false);
  assert.deepEqual(bump(pairOf(0)), [], '合上之前不能再翻');
  for (let frame = 0; frame < 120; frame++) stepRoom(world, state, { ...player, vy: 0 }, STEP);
  assert.deepEqual(state.puzzle.open, []);
  const done = new Set();
  let last = [];
  for (let index = 0; index < cards.length; index++) {
    if (done.has(index)) continue;
    bump(index); last = bump(pairOf(index));
    done.add(index); done.add(pairOf(index));
  }
  assert.deepEqual(types(last), ['puzzle', 'clear']);
});

test('星星钥匙找齐三颗就开门', () => {
  const { world, room, state, player } = roomOf('puzzle', item => item.puzzle.kind === 'keys');
  room.puzzle.keys.forEach((key, index) => {
    const spot = spotPosition(world, key);
    Object.assign(player, { x: spot.x, y: spot.y - 0.9 });
    const events = stepRoom(world, state, player, STEP);
    assert.deepEqual(types(events), index === 2 ? ['puzzle', 'clear'] : ['puzzle']);
  });
});

test('小店一进门就开着，摊位要走到跟前', () => {
  const { world, room, state, player } = roomOf('shop');
  assert.deepEqual(types(stepRoom(world, state, player, STEP)), ['clear']);
  assert.equal(state.drops.length, 0);
  assert.equal(stallAt(world, state, player), null);
  for (const stall of room.stalls) {
    Object.assign(player, createPlayer(world.platforms[stall.platformId], stall.offsetX));
    assert.equal(stallAt(world, state, player), stall);
  }
});

test('三秒内连着打倒算连击，每三只给一次碎片', () => {
  const { world, state, player } = roomOf('battle');
  assert.deepEqual([recordCombo(state), recordCombo(state), recordCombo(state), recordCombo(state)], [false, false, true, false]);
  assert.equal(state.combo, 4);
  for (let time = 0; time < COMBO_WINDOW + 0.1; time += STEP) stepRoom(world, state, player, STEP);
  assert.equal(state.combo, 0);
  assert.equal(recordCombo(state), false);
  assert.equal(state.combo, 1);
});

test('房间存档对不上地图就不收', () => {
  const { world, room, state, player } = roomOf('battle');
  assert.equal(isValidRoomState(undefined, world), false);
  const ok = () => structuredClone(state);
  assert.equal(isValidRoomState(ok(), world), true);
  const other = world.rooms.find(item => item.depth === 1 && item.id !== room.id);
  for (const change of [
    s => { s.roomId = other.id; },
    s => { s.path = [0, room.id, room.id]; },
    s => { s.path = [room.id]; },
    s => { s.cleared = []; },
    s => { s.cleared.push(room.id); },
    s => { s.stars[0] = 4; },
    s => { s.wave = room.waves + 1; },
    s => { s.comboLeft = 9; },
    s => { s.drops.push({ roomId: room.id, kind: 'heart', isTaken: false }); },
    s => { s.bought.push(`${room.id}:heal`); },
    s => { s.puzzle = { step: 0, lastTile: -1 }; },
    s => { s.isHurt = 1; },
  ]) { const changed = ok(); change(changed); assert.equal(isValidRoomState(changed, world), false, change.toString()); }
  void player;
});
