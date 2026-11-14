import { GamepadGate, readXboxPad, nearestControl } from './gamepad-state.js';

const listeners = new Set();
let state = { mode: 'keyboard', context: 'menu', connected: false, name: '', notice: '', vibration: true, deadzone: 0.22 };
try {
  const saved = JSON.parse(localStorage.getItem('garden-gamepad-settings-v1'));
  if (saved) state = { ...state, vibration: saved.vibration !== false, deadzone: Math.max(0.1, Math.min(0.4, Number(saved.deadzone) || 0.22)) };
} catch { /* 设置不可读时使用默认值，游玩不依赖写入成功。 */ }
export const getGamepadState = () => state;
export function subscribeGamepad(listener) { listeners.add(listener); return () => listeners.delete(listener); }
function publish(patch) {
  if (Object.entries(patch).every(([key, value]) => state[key] === value)) return;
  state = { ...state, ...patch };
  document.documentElement.dataset.inputMode = state.mode;
  listeners.forEach(listener => listener());
}
export function setGamepadSettings(patch) {
  publish(patch);
  try { localStorage.setItem('garden-gamepad-settings-v1', JSON.stringify({ vibration: state.vibration, deadzone: state.deadzone })); } catch { publish({ notice: '手柄设置暂未保存，本次仍可使用。' }); }
}
let activePad = null, gameplay = null;
export function registerGamepadPlayer(player) {
  gameplay = player;
  return () => { if (gameplay === player) { player.release(); gameplay = null; } };
}
export function vibrateGamepad(kind = 'hit') {
  if (!state.vibration || state.mode !== 'gamepad' || document.hidden || !document.hasFocus()) return;
  const actuator = activePad?.vibrationActuator;
  if (!actuator?.playEffect) return;
  const isHurt = kind === 'hurt';
  try { Promise.resolve(actuator.playEffect('dual-rumble', { duration: isHurt ? 160 : 45, strongMagnitude: isHurt ? 0.45 : 0.08, weakMagnitude: isHurt ? 0.3 : 0.18 })).catch(() => {}); } catch { /* 驱动未提供震动时不影响操作。 */ }
}
function isVisible(node) {
  return !node.closest('[inert], [hidden], [aria-hidden="true"]') && node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden';
}
const selectable = 'button:not(:disabled), a[href], select:not(:disabled), input:not(:disabled):not([type="hidden"]):not([type="file"]), [data-gamepad-canvas]';
function scopeOfPage() {
  const dialogs = [...document.querySelectorAll('[role="dialog"], dialog[open]')].filter(isVisible);
  return dialogs.at(-1) || [...document.querySelectorAll('.app-shell, .home-page, .home-menu, .mini-game, .score-screen')].filter(isVisible).at(-1) || document.querySelector('#root');
}
function controls(scope) { return [...scope.querySelectorAll(selectable)].filter(isVisible); }
function focus(node) { node?.focus({ preventScroll: true }); node?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
function editControl(node, direction) {
  if (!['left', 'right'].includes(direction)) return false;
  const step = direction === 'left' ? -1 : 1;
  if (node?.tagName === 'SELECT') {
    const options = [...node.options].filter(option => !option.disabled);
    const index = options.findIndex(option => option.value === node.value);
    node.value = options[Math.max(0, Math.min(options.length - 1, index + step))]?.value || '';
    node.dispatchEvent(new Event('change', { bubbles: true })); return true;
  }
  if (node?.tagName === 'INPUT' && ['range', 'date', 'number'].includes(node.type)) {
    try { step > 0 ? node.stepUp() : node.stepDown(); } catch { return false; }
    node.dispatchEvent(new Event('input', { bubbles: true })); node.dispatchEvent(new Event('change', { bubbles: true })); return true;
  }
  return false;
}
function navigate(scope, direction) {
  const items = controls(scope), current = document.activeElement, index = items.indexOf(current);
  if (!items.length) return;
  if (editControl(current, direction)) return;
  if (index < 0) { focus(items[0]); return; }
  if (direction === 'previous' || direction === 'next') { focus(items[(index + (direction === 'next' ? 1 : -1) + items.length) % items.length]); return; }
  const center = node => { const rect = node.getBoundingClientRect(); return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }; };
  const next = nearestControl(center(current), items.map(center), direction);
  if (next >= 0) focus(items[next]);
}
function back(scope) { controls(scope).find(node => node.hasAttribute('data-gamepad-back'))?.click(); }
function scroll(scope, delta) {
  let node = document.activeElement;
  while (node && scope.contains(node)) {
    if (node.scrollHeight > node.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(node).overflowY)) { node.scrollTop += delta; return; }
    node = node.parentElement;
  }
  window.scrollBy(0, delta);
}

export function startGamepad() {
  const gate = new GamepadGate(), abort = new AbortController();
  let frame, identity = '', context = null, contextKey = '', lastTime = 0, focused = null, isFocused = document.hasFocus();
  function release() { gameplay?.release(); document.activeElement?.dispatchEvent(new CustomEvent('garden:practice-input', { detail: null })); gate.reset(); }
  function keyboard() { publish({ mode: 'keyboard' }); }
  window.addEventListener('keydown', keyboard, { signal: abort.signal });
  window.addEventListener('pointerdown', keyboard, { signal: abort.signal });
  window.addEventListener('blur', () => { isFocused = false; release(); gameplay?.pause(); activePad?.vibrationActuator?.reset?.()?.catch?.(() => {}); }, { signal: abort.signal });
  window.addEventListener('focus', () => { isFocused = true; release(); }, { signal: abort.signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { release(); gameplay?.pause(); } }, { signal: abort.signal });
  function tick(time) {
    frame = requestAnimationFrame(tick);
    const dt = Math.min(40, time - (lastTime || time)); lastTime = time;
    let pads;
    try { pads = [...(navigator.getGamepads?.() || [])].filter(pad => pad?.connected); }
    catch { publish({ notice: '当前环境不能读取手柄，请使用桌面版或本机浏览器。' }); release(); return; }
    const compatible = pads.filter(pad => pad.mapping === 'standard');
    const previous = activePad;
    activePad = compatible.find(pad => `${pad.index}:${pad.id}` === identity) || compatible[0] || null;
    const nextIdentity = activePad ? `${activePad.index}:${activePad.id}` : '';
    if (identity !== nextIdentity) {
      if (identity) { release(); gameplay?.pause(); }
      identity = nextIdentity; gate.reset();
      publish({ connected: !!activePad, name: activePad?.id || '', notice: activePad ? '手柄已连接，松开按键后即可游玩。' : '手柄已断开，探险已暂停；连接后手动继续。' });
      previous?.vibrationActuator?.reset?.()?.catch?.(() => {});
    } else if (!activePad && pads.length) publish({ notice: '手柄尚未识别为 Xbox 标准布局，请切换到 XInput 模式或用 USB 重新连接。' });
    if (!isFocused || document.hidden || !activePad) return;
    const input = readXboxPad(activePad, state.deadzone), scope = scopeOfPage();
    if (!scope) return;
    const isPlaying = !!gameplay?.isActive();
    const isPractice = !isPlaying && document.activeElement?.hasAttribute('data-gamepad-practice');
    const isStamp = !isPlaying && document.activeElement?.hasAttribute('data-gamepad-stamps');
    const key = isPlaying ? 'playing' : isPractice ? 'practice' : isStamp ? 'stamps' : `${document.querySelector('.platform-game')?.dataset.gameStatus || ''}:${scope.dataset.gamepadPage || ''}:${scope.querySelector('h1,h2')?.textContent || ''}`;
    if (context !== scope || contextKey !== key) {
      release(); context = scope; contextKey = key; focused = null;
      publish({ context: isPlaying ? 'playing' : isPractice ? 'practice' : isStamp ? 'stamps' : 'menu' });
    }
    const step = gate.step(input, time);
    if (!step.isReady) return;
    if (step.pressed.size || input.scroll) publish({ mode: 'gamepad', notice: '' });
    if (isPlaying) {
      if (step.pressed.has('pause') || step.pressed.has('back')) { release(); gameplay.pause(); return; }
      if (step.pressed.has('interact')) { gameplay.interact(); return; }
      gameplay.input(input);
      return;
    }
    if ((isPractice || isStamp) && (step.pressed.has('previous') || step.pressed.has('next'))) {
      document.activeElement.dispatchEvent(new CustomEvent('garden:practice-input', { detail: null }));
      navigate(scope, step.pressed.has('next') ? 'next' : 'previous'); focused = document.activeElement; gate.reset(); return;
    }
    if (isStamp) {
      const node = document.activeElement;
      node.dispatchEvent(new CustomEvent('garden:canvas-input', { detail: { input, dt, isConfirm: step.pressed.has('confirm') } }));
      if (step.pressed.has('back')) { focus(scope.querySelector('.decorate-toggle')); gate.reset(); }
      return;
    }
    if (isPractice) {
      document.activeElement.dispatchEvent(new CustomEvent('garden:practice-input', { detail: input }));
      if (step.pressed.has('back') || step.pressed.has('pause')) {
        document.activeElement.dispatchEvent(new CustomEvent('garden:practice-input', { detail: null }));
        focus(scope.querySelector('.character-try-row button')); gate.reset();
      }
      return;
    }
    if (step.navigation) { navigate(scope, step.navigation); focused = document.activeElement; }
    if (input.scroll) scroll(scope, input.scroll * dt * 0.65);
    if (step.pressed.has('back')) { back(scope); return; }
    if (step.pressed.has('pause')) { controls(scope).find(node => node.hasAttribute('data-gamepad-resume'))?.click(); return; }
    if (step.pressed.has('confirm')) {
      // 首次 A 只定位；不会把跳跃键带进奖励、死亡或破坏性确认。
      const target = document.activeElement;
      if (!focused || focused !== target || !controls(scope).includes(target)) { focus(controls(scope)[0]); focused = document.activeElement; return; }
      if (target.hasAttribute('data-gamepad-canvas')) target.dispatchEvent(new CustomEvent('garden:canvas-confirm'));
      else if (!['SELECT', 'INPUT'].includes(target.tagName)) target.click();
    }
  }
  frame = requestAnimationFrame(tick);
  return () => { cancelAnimationFrame(frame); abort.abort(); release(); activePad = null; };
}
