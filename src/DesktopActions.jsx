import { useEffect, useState } from 'react';
import { CornersOut, SignOut, ArrowsClockwise } from '@phosphor-icons/react';
export function DesktopRestState() {
  useEffect(() => {
    window.gardenDesktop?.updateSafe(true);
    return () => window.gardenDesktop?.updateSafe(false);
  }, []);
  return null;
}

export function DesktopActions() {
  const [update, setUpdate] = useState(null);
  useEffect(() => {
    const bridge = window.gardenDesktop;
    if (!bridge) return;
    let active = true;
    const unsubscribe = bridge.onUpdate(setUpdate);
    bridge.updateState().then(state => { if (active) setUpdate(state); });
    return () => { active = false; unsubscribe(); };
  }, []);
  if (!window.gardenDesktop) return null;
  return <div className="desktop-actions">
    <button className="quiet-button" onClick={() => window.gardenDesktop.toggleMaximize()}><CornersOut size={19} />放大 / 还原窗口</button>
    <button className="quiet-button" onClick={() => window.gardenDesktop.quit()}><SignOut size={19} />保存并退出</button>
    <button className="quiet-button" disabled={['checking','downloading','ready','installing'].includes(update?.phase)} onClick={() => window.gardenDesktop.checkUpdate()}><ArrowsClockwise size={19} />检查更新</button>
    {update && <small className="desktop-update-status" role="status">{update.message}</small>}
  </div>;
}
