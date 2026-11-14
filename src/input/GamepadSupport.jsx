import { useEffect, useSyncExternalStore } from 'react';
import { getGamepadState, subscribeGamepad, setGamepadSettings, startGamepad, vibrateGamepad } from './gamepad.js';
import './gamepad.css';

export function useGamepad() { return useSyncExternalStore(subscribeGamepad, getGamepadState); }
export function GamepadSupport() {
  const state = useGamepad();
  useEffect(startGamepad, []);
  return <>
    {state.notice && <div className="gamepad-notice" role="status">{state.notice}</div>}
    {state.mode === 'gamepad' && state.connected && <div className="gamepad-guide" aria-label="手柄操作提示"><span>{state.context === 'practice' ? '左摇杆／方向键 移动　A 跳跃　X / RT 攻击　B 返回按钮区' : state.context === 'stamps' ? '左摇杆／方向键 移动贴纸　A 放下　B 返回按钮区' : '方向键／左摇杆 选择　A 确认　B 返回　LB / RB 上一项／下一项　右摇杆 滚动'}</span></div>}
  </>;
}
export function GamepadSettings() {
  const state = useGamepad();
  return <section className="gamepad-settings" aria-label="Xbox 手柄">
    <h2>Xbox 手柄</h2>
    <p role="status">{state.connected ? `已连接：${state.name}` : '连接 USB 或蓝牙手柄后，按一下 A 唤醒。'}</p>
    <dl><dt>移动／跳跃</dt><dd>左摇杆或方向键／A</dd><dt>攻击／充能大招</dt><dd>按住 X 或 RT 连发；蓄满后随攻击施放，也可按 Y 施放</dd><dt>向下跳台</dt><dd>下方向 + A</dd><dt>暂停／休息点</dt><dd>Menu（≡）／View（双窗口）</dd><dt>菜单与小游戏</dt><dd>方向键选择，A 点选，再选目标或确认按钮；B 返回</dd><dt>长页面／逐项切换</dt><dd>右摇杆滚动；LB / RB 可走到每个操作项</dd><dt>营地练习／花园贴纸</dt><dd>选中练习场或贴纸画布后用摇杆操作，B 返回按钮区</dd></dl>
    <label>摇杆死区 <input aria-label="摇杆死区" type="range" min="0.1" max="0.4" step="0.02" value={state.deadzone} onChange={event => setGamepadSettings({ deadzone: Number(event.target.value) })}/><span>{Math.round(state.deadzone * 100)}%</span></label>
    <button aria-pressed={state.vibration} onClick={() => setGamepadSettings({ vibration: !state.vibration })}>震动反馈：{state.vibration ? '开' : '关'}</button>
    <button disabled={!state.connected || !state.vibration} onClick={() => vibrateGamepad('hurt')}>试试震动</button>
    <small>断开手柄或切换到其他窗口会暂停探险。重新连接后先松开按键，再手动继续。震动取决于系统与连接方式；Xbox 系统键由系统处理。文件导入和导出使用系统文件窗口。</small>
  </section>;
}
