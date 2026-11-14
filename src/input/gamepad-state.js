// Xbox 按钮采用浏览器的 standard 布局，不猜测未映射设备的按钮顺序。
export function readXboxPad(pad, deadzone = 0.22) {
  if (!pad?.connected || pad.mapping !== 'standard') return null;
  const button = index => !!pad.buttons[index]?.pressed || pad.buttons[index]?.value > 0.5;
  const axis = index => Number.isFinite(pad.axes[index]) ? Math.max(-1, Math.min(1, pad.axes[index])) : 0;
  const x = axis(0), y = axis(1);
  const direction = button(14) ? -1 : button(15) ? 1 : Math.abs(x) <= deadzone ? 0 : Math.sign(x) * (Math.abs(x) - deadzone) / (1 - deadzone);
  const actions = new Set();
  if (direction < 0) actions.add('left');
  if (direction > 0) actions.add('right');
  if (y < -0.55 || button(12)) actions.add('up');
  if (y > 0.55 || button(13)) actions.add('down');
  for (const [name, index] of Object.entries({ confirm: 0, back: 1, attack: 2, spell: 3, previous: 4, next: 5, interact: 8, pause: 9 })) if (button(index)) actions.add(name);
  if (button(7)) actions.add('attack');
  return { actions, direction, scroll: Math.abs(axis(3)) > 0.25 ? axis(3) : 0,
    isNeutral: !pad.buttons.some((_, index) => button(index)) && pad.axes.every(value => Math.abs(value) <= deadzone) };
}

// 页面、弹窗、设备切换后先回中；确认只响应新按下，导航支持慢速连发。
export class GamepadGate {
  constructor() { this.reset(); }
  reset() { this.isWaiting = true; this.previous = new Set(); this.nextRepeat = 0; this.navigation = ''; }
  step(input, time) {
    if (!input) { this.reset(); return { isReady: false, pressed: new Set(), navigation: '' }; }
    if (this.isWaiting) {
      if (input.isNeutral) this.isWaiting = false;
      this.previous = new Set(input.actions);
      return { isReady: false, pressed: new Set(), navigation: '' };
    }
    const pressed = new Set([...input.actions].filter(action => !this.previous.has(action)));
    const navigation = ['up', 'down', 'left', 'right', 'previous', 'next'].find(action => input.actions.has(action)) || '';
    let move = '';
    if (navigation && (navigation !== this.navigation || time >= this.nextRepeat)) {
      move = navigation;
      this.nextRepeat = time + (navigation !== this.navigation ? 400 : 170);
    }
    this.navigation = navigation; this.previous = new Set(input.actions);
    return { isReady: true, pressed, navigation: move };
  }
}

export function nearestControl(current, candidates, direction) {
  const isHorizontal = direction === 'left' || direction === 'right';
  const sign = direction === 'left' || direction === 'up' ? -1 : 1;
  let best = -1, score = Infinity;
  candidates.forEach((rect, index) => {
    const dx = rect.x - current.x, dy = rect.y - current.y;
    const forward = (isHorizontal ? dx : dy) * sign, sideways = Math.abs(isHorizontal ? dy : dx);
    if (forward <= 2) return;
    const value = forward + sideways * 2.5;
    if (value < score) { score = value; best = index; }
  });
  return best;
}
