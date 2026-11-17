import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomWorld } from '../shared/room-world.js';
import { newRoomState, roomProgress, stepRoom } from '../src/game/rooms.js';
import { roomEnemyGuide } from '../src/game/room-guide.js';

function scenario() {
  const world = createRoomWorld(42, 'rainbow-world'), room = world.rooms.find(item => item.kind === 'battle');
  const state = { ...newRoomState(world), roomId: room.id, wave: 1 };
  const floor = world.platforms[room.encounters[0].endId], player = { x: floor.x, y: floor.y };
  const target = world.enemies[room.enemyIds.find(id => world.enemies[id - 1].wave === 1) - 1];
  for (const id of room.enemyIds) {
    const enemy = world.enemies[id - 1];
    enemy.isDefeated = enemy.wave <= 1 && enemy !== target;
    enemy.isDormant = enemy.wave > 1;
  }
  return { world, room, state, player, target };
}

test('剩一只时指向它，屏幕外保留边缘箭头并区分左右高低，屏内标在头顶', () => {
  const { world, state, player, target } = scenario();
  assert.equal(roomProgress(world, state).left, 1);
  for (const [dx, dy, projected, label, angle] of [
    [-30, 0, { x: -20, y: 60 }, '左边还有小怪', 180],
    [30, 0, { x: 120, y: 60 }, '右边还有小怪', 0],
    [0, 10, { x: 50, y: -20 }, '上方还有小怪', -90],
    [0, -10, { x: 50, y: 120 }, '下方还有小怪', 90],
    [-30, 10, { x: -20, y: -20 }, '左上方还有小怪', null],
  ]) {
    target.x = player.x + dx; target.y = player.y + dy;
    const guide = roomEnemyGuide(world, state, player, () => projected);
    assert.equal(guide.id, target.id);
    assert.equal(guide.label, label);
    assert.equal(guide.isNearBarrier, true);
    assert.equal(guide.isAtEdge, true);
    assert.ok(guide.x >= 12 && guide.x <= 88 && guide.y >= 34 && guide.y <= 76);
    if (angle !== null) assert.equal(guide.angle, angle);
  }
  const guide = roomEnemyGuide(world, state, player, (x, y) => {
    assert.equal(x, target.x); assert.equal(y, target.y + target.height + 0.6);
    return { x: 30, y: 55 };
  });
  assert.deepEqual([guide.x, guide.y, guide.angle, guide.isAtEdge, guide.label], [30, 55, 90, false, '打败这只小怪']);
  for (const viewport of [{ width: 720, height: 540 }, { width: 640, height: 720 }]) {
    const edge = roomEnemyGuide(world, state, player, () => ({ x: -50, y: -50 }), false, viewport);
    assert.ok(edge.x * viewport.width / 100 >= 109, '窄窗口的提示不出屏');
    assert.ok(edge.y * viewport.height / 100 >= 299, '给顶部状态栏和暂停按钮留位置');
    const low = roomEnemyGuide(world, state, player, () => ({ x: 50, y: 150 }), false, viewport);
    assert.ok(low.y * viewport.height / 100 <= viewport.height - 169, '给底部触屏按钮留位置');
  }
});

test('提示跟随当前波和活着的分身，忽略未出场怪、其他房间与已击败怪', () => {
  const { world, room, state, player, target } = scenario();
  const project = () => ({ x: 50, y: 55 });
  target.x = player.x - 10; target.y = player.y;
  const future = world.enemies[room.enemyIds.find(id => world.enemies[id - 1].wave === 2) - 1];
  future.x = player.x; future.y = player.y;
  assert.equal(roomEnemyGuide(world, state, player, project).id, target.id);
  const child = { ...target, id: world.enemies.length + 1, parentId: target.id, wave: undefined, x: player.x - 2, isDormant: false };
  world.enemies.push(child); room.childIds.push(child.id); target.childIds = [child.id];
  assert.equal(roomProgress(world, state).left, 2);
  assert.equal(roomEnemyGuide(world, state, player, project).id, child.id, '先指最近的活分身');
  target.isDefeated = true;
  assert.equal(stepRoom(world, state, player, 1 / 120).length, 0, '分身没清完不放行');
  assert.equal(roomEnemyGuide(world, state, player, project).id, child.id);
  child.isDefeated = true;
  stepRoom(world, state, player, 1 / 120);
  assert.equal(state.wave, 2);
  assert.equal(roomEnemyGuide(world, state, player, project).id, future.id, '清完自动指向新一波');
  assert.equal(roomEnemyGuide(world, state, player, project).isNearBarrier, false);
  state.cleared.push(room.id);
  assert.equal(roomEnemyGuide(world, state, player, project), null);
  state.roomId = 0;
  assert.equal(roomEnemyGuide(world, state, player, project), null, '没有战区封锁的房间不显示');
});
