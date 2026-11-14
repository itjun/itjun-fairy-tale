import test from 'node:test';
import assert from 'node:assert/strict';
import { readXboxPad, GamepadGate, nearestControl } from '../src/input/gamepad-state.js';
import { GardenEngine } from '../src/game/engine.js';

function pad(pressed = [], axes = [0, 0, 0, 0], mapping = 'standard') {
  return { connected: true, mapping, axes, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })) };
}
test('Xbox 标准键位、模拟摇杆、方向键与 RT 具有同一语义', () => {
  const input = readXboxPad(pad([0, 3, 7, 8, 9, 13], [0.61, 0, 0, 0]));
  assert.equal(input.direction, 0.5);
  assert.deepEqual([...input.actions].sort(), ['right', 'down', 'confirm', 'spell', 'attack', 'interact', 'pause'].sort());
  assert.equal(readXboxPad(pad([14], [1, 0, 0, 0])).direction, -1);
  assert.equal(readXboxPad(pad([], [0.2, -0.2, 0, 0])).isNeutral, true);
  assert.equal(readXboxPad(pad([], [0.2, -0.2, 0, 0])).actions.size, 0);
  assert.equal(readXboxPad(pad([], [], '')), null);
  assert.equal(readXboxPad(null), null);
});
test('连按攻击／跳跃进弹窗后必须全部松开，A 不连发且重连不误确认', () => {
  const gate = new GamepadGate();
  for (const time of [0, 100, 1000]) assert.equal(gate.step(readXboxPad(pad([0, 2])), time).isReady, false);
  assert.equal(gate.step(readXboxPad(pad([0])), 1100).isReady, false);
  gate.step(readXboxPad(pad()), 1200);
  assert.equal(gate.step(readXboxPad(pad([0])), 1300).pressed.has('confirm'), true);
  assert.equal(gate.step(readXboxPad(pad([0])), 4000).pressed.has('confirm'), false);
  gate.reset();
  assert.equal(gate.step(readXboxPad(pad([0])), 4100).isReady, false);
  gate.step(readXboxPad(pad()), 4200);
  assert.equal(gate.step(readXboxPad(pad([0])), 4300).pressed.has('confirm'), true);
});
test('长按方向先停顿再连发，松开和反向立即响应', () => {
  const gate = new GamepadGate(); gate.step(readXboxPad(pad()), 0);
  assert.equal(gate.step(readXboxPad(pad([13])), 10).navigation, 'down');
  assert.equal(gate.step(readXboxPad(pad([13])), 100).navigation, '');
  assert.equal(gate.step(readXboxPad(pad([13])), 410).navigation, 'down');
  assert.equal(gate.step(readXboxPad(pad([12])), 420).navigation, 'up');
  assert.equal(gate.step(readXboxPad(pad([12])), 500).navigation, '');
});
test('方向导航沿同一行或同一列选择，不跳到身后', () => {
  const rects = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }, { x: 20, y: 140 }];
  assert.equal(nearestControl(rects[0], rects, 'right'), 1);
  assert.equal(nearestControl(rects[0], rects, 'down'), 2);
  assert.equal(nearestControl(rects[0], rects, 'left'), -1);
});
test('手柄跳跃只在按下边沿触发，下跳组合、暂停清理与键盘触屏互不覆盖', () => {
  const engine = Object.create(GardenEngine.prototype);
  Object.assign(engine, { gamepad: new Set(), keys: new Set(['KeyJ']), touch: new Set(['left']), jumps: [false, false], isPaused: false });
  engine.setGamepadInput(readXboxPad(pad([0, 13], [0.61, 0, 0, 0])));
  assert.equal(engine.jumps[0], true); assert.equal(engine.hasControl('drop'), true);
  assert.equal(engine.gamepadDirection, 0.5);
  engine.jumps[0] = false;
  engine.setGamepadInput(readXboxPad(pad([0, 13])));
  assert.equal(engine.jumps[0], false);
  engine.releaseGamepad();
  assert.equal(engine.keys.has('KeyJ'), true); assert.equal(engine.touch.has('left'), true);
  assert.equal(engine.gamepad.size, 0); assert.equal(engine.gamepadDirection, 0);
  engine.isPaused = true;
  engine.setGamepadInput(readXboxPad(pad([0, 2])));
  assert.equal(engine.gamepad.size, 0);
});

test('轻推摇杆只影响移速，角色朝向仍是左右单位方向', async () => {
  const { createPlayer, stepPlayer } = await import('../src/game/physics.js');
  const floor = { id: 0, x: 0, y: 0, width: 20 }, player = createPlayer(floor);
  stepPlayer(player, { direction: -0.3 }, [floor], 1 / 60, { minX: -10, maxX: 10, minY: -10 });
  assert.equal(player.facing, -1);
  assert.ok(player.vx < 0);
});
