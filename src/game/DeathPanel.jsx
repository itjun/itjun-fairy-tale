import { useEffect, useRef, useState } from 'react';
import { trapFocus } from './AdventurePanels.jsx';

export function DeathPanel({ survival, heldKeys, onContinue, onRestart }) {
  const root = useRef(null), isSubmitted = useRef(false);
  const blocked = useRef(new Set(heldKeys));
  const [isWaiting, setIsWaiting] = useState(blocked.current.size > 0);
  const [isBusy, setIsBusy] = useState(false);
  useEffect(() => {
    root.current?.focus();
    const release = event => { blocked.current.delete(event.code); setIsWaiting(blocked.current.size > 0); };
    const releasePointer = () => { for (const key of blocked.current) if (key.startsWith('touch:')) blocked.current.delete(key); setIsWaiting(blocked.current.size > 0); };
    const blur = () => { blocked.current.clear(); setIsWaiting(false); };
    window.addEventListener('keyup', release); window.addEventListener('blur', blur);
    window.addEventListener('pointerup', releasePointer); window.addEventListener('pointercancel', releasePointer);
    return () => { window.removeEventListener('keyup', release); window.removeEventListener('blur', blur); window.removeEventListener('pointerup', releasePointer); window.removeEventListener('pointercancel', releasePointer); };
  }, []);
  function choose(isRestart) {
    if (isSubmitted.current || blocked.current.size || !isRestart && !survival.lives) return;
    isSubmitted.current = true; setIsBusy(true);
    const result = isRestart ? onRestart() : onContinue();
    if (result === false) { isSubmitted.current = false; setIsBusy(false); }
  }
  return <div className="adventure-overlay"><section ref={root} tabIndex={-1} className="adventure-menu death-menu" role="dialog" aria-modal="true" aria-labelledby="death-title" onKeyDown={event => {
    event.stopPropagation();
    if (event.repeat || blocked.current.has(event.code) || event.key === 'Escape') event.preventDefault();
    trapFocus(event);
  }}>
    <img className="death-bottle" src="./assets/life-potion.png" alt=""/>
    <h2 id="death-title">这条血用完了</h2>
    <p>{survival.lives ? `还剩 ${survival.lives} 条命，可以在附近满血继续。` : '命数用完了，重新出发吧。'}</p>
    <p>继续保留地图、武器和成长。<br/>重来会从第一小关出发，重置本次成长。</p>
    {isWaiting && <small role="status">先松开按键，再选一次。</small>}
    <div className="adventure-menu-actions"><button className="primary-button" disabled={isWaiting || isBusy || !survival.lives} onClick={() => choose(false)}>继续{!survival.lives ? '（没有剩余命数）' : ''}</button><button className="text-button" disabled={isWaiting || isBusy} onClick={() => choose(true)}>重来</button></div>
  </section></div>;
}
