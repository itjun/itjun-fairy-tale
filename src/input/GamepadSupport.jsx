import { useEffect, useSyncExternalStore } from 'react';
import { getGamepadState, subscribeGamepad, setGamepadSettings, startGamepad, vibrateGamepad } from './gamepad.js';
import { GamepadHints } from './GamepadHints.jsx';
import { PadKey } from './PadKey.jsx';
import './gamepad.css';

export function useGamepad() { return useSyncExternalStore(subscribeGamepad, getGamepadState); }
export function GamepadSupport() {
  const state = useGamepad();
  useEffect(startGamepad, []);
  return <>
    {state.notice && <div className="gamepad-notice" role="status">{state.notice}</div>}
    <GamepadHints state={state} />
  </>;
}
export function GamepadSettings() {
  const state = useGamepad();
  return <section className="gamepad-settings" aria-label="Xbox 手柄">
    <h2>Xbox 手柄</h2>
    <p role="status">{state.connected ? `已连接：${state.name}` : '连接 USB 或蓝牙手柄后，按一下 A 唤醒。'}</p>
    <dl className="pad-map">
      <dt><PadKey name="stick" /></dt><dd>移动；键盘用方向键。向上买东西，向下加跳跃穿过跳台</dd>
      <dt><PadKey name="A" /></dt><dd>跳跃（空格），空中可再跳一次。页面上按 A 或 Enter 确定</dd>
      <dt><PadKey name="X" /><PadKey name="RT" /></dt><dd>使用 X 格的攻法（J）</dd>
      <dt><PadKey name="Y" /></dt><dd>使用 Y 格的攻法（K）</dd>
      <dt><PadKey name="B" /></dt><dd>使用 B 格的攻法（L）。普通菜单中返回上一层</dd>
      <dt><PadKey name="LB" /><PadKey name="RB" /></dt><dd>翻页、换分类、换难度</dd>
      <dt><PadKey name="View" /></dt><dd>看这一局的本领</dd>
      <dt><PadKey name="Menu" /></dt><dd>暂停或继续（Esc）</dd>
    </dl>
    <label>摇杆死区 <input aria-label="摇杆死区" type="range" min="0.1" max="0.4" step="0.02" value={state.deadzone} onChange={event => setGamepadSettings({ deadzone: Number(event.target.value) })}/><span>{Math.round(state.deadzone * 100)}%</span></label>
    <button aria-pressed={state.vibration} onClick={() => setGamepadSettings({ vibration: !state.vibration })}>震动反馈：{state.vibration ? '开' : '关'}</button>
    <button disabled={!state.connected || !state.vibration} onClick={() => vibrateGamepad('hurt')}>试试震动</button>
    <small>断开手柄或切换到其他窗口会暂停探险。重新连接后先松开按键，再手动继续。震动取决于系统与连接方式；Xbox 系统键由系统处理。</small>
  </section>;
}
