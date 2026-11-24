import { useEffect, useState } from 'react';
import { Monitor, SignOut, ArrowsClockwise, ArrowCounterClockwise } from '@phosphor-icons/react';

const WINDOW_MODES = [['windowed', '窗口'], ['maximized', '最大化'], ['fullscreen', '全屏']];

export function DesktopRestState() {
  useEffect(() => {
    window.gardenDesktop?.updateSafe(true);
    return () => window.gardenDesktop?.updateSafe(false);
  }, []);
  return null;
}

export function DesktopActions() {
  const [update, setUpdate] = useState(null);
  const [windowMode, setWindowMode] = useState(null);
  const [windowModeError, setWindowModeError] = useState(false);
  const bridge = window.gardenDesktop;
  useEffect(() => {
    if (!bridge) return;
    let active = true;
    const unsubscribe = bridge.onUpdate(setUpdate);
    const unsubscribeWindowMode = bridge.onWindowMode(setWindowMode);
    bridge.updateState().then(state => { if (active) setUpdate(state); });
    bridge.windowMode().then(mode => { if (active) setWindowMode(current => current ?? mode); });
    return () => { active = false; unsubscribe(); unsubscribeWindowMode(); };
  }, [bridge]);
  function chooseWindowMode(mode) {
    setWindowModeError(false);
    bridge.setWindowMode(mode).catch(() => setWindowModeError(true));
  }
  if (!bridge) return null;
  return <div className="desktop-actions">
    <div className="option-row window-mode-row"><Monitor size={28} /><span id="window-mode-label">显示模式</span>
      <div className="option-chips" role="group" aria-labelledby="window-mode-label">
        {WINDOW_MODES.map(([mode, label]) => <button key={mode} value={mode} aria-pressed={windowMode === mode} onClick={() => chooseWindowMode(mode)}>{label}</button>)}
      </div>
    </div>
    {windowModeError && <p className="option-note" role="status">窗口模式设置未完成，请再试一次。</p>}
    <button className="quiet-button" onClick={() => bridge.restart()}><ArrowCounterClockwise size={19} />重新启动</button>
    <button className="quiet-button" onClick={() => bridge.quit()}><SignOut size={19} />保存并退出</button>
    <button className="quiet-button" disabled={['checking','downloading','ready','installing'].includes(update?.phase)} onClick={() => bridge.checkUpdate()}><ArrowsClockwise size={19} />检查更新</button>
    {update && <small className="desktop-update-status" role="status">{update.message}</small>}
  </div>;
}
