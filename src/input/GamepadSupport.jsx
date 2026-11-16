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
      <dt><PadKey name="stick" /></dt><dd>左摇杆或方向键：移动。门前按上进门，按下再按 A 往下跳</dd>
      <dt><PadKey name="A" /></dt><dd>跳，空中再按一次。页面上是确定</dd>
      <dt><PadKey name="X" /><PadKey name="RT" /></dt><dd>攻击，按住连发</dd>
      <dt><PadKey name="Y" /></dt><dd>大招攒满后放出去</dd>
      <dt><PadKey name="B" /></dt><dd>页面上返回上一层。游玩中不起作用</dd>
      <dt><PadKey name="LB" /><PadKey name="RB" /></dt><dd>翻页、换分类、换难度</dd>
      <dt><PadKey name="View" /></dt><dd>看这一局的本领。老地图里是休息点</dd>
      <dt><PadKey name="Menu" /></dt><dd>暂停，再按一次继续</dd>
    </dl>
    <label>摇杆死区 <input aria-label="摇杆死区" type="range" min="0.1" max="0.4" step="0.02" value={state.deadzone} onChange={event => setGamepadSettings({ deadzone: Number(event.target.value) })}/><span>{Math.round(state.deadzone * 100)}%</span></label>
    <button aria-pressed={state.vibration} onClick={() => setGamepadSettings({ vibration: !state.vibration })}>震动反馈：{state.vibration ? '开' : '关'}</button>
    <button disabled={!state.connected || !state.vibration} onClick={() => vibrateGamepad('hurt')}>试试震动</button>
    <small>断开手柄或切换到其他窗口会暂停探险。重新连接后先松开按键，再手动继续。震动取决于系统与连接方式；Xbox 系统键由系统处理。</small>
  </section>;
}
