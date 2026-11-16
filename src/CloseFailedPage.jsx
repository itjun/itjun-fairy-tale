import { useEffect, useRef, useState } from 'react';

// 退出时积分没存上，在应用里问一句，手柄也能选。主进程收不到回应才会退回系统窗口。
export function CloseFailedPage() {
  const [token, setToken] = useState(null);
  const isDecided = useRef(false), stay = useRef(null);
  useEffect(() => window.gardenDesktop?.onCloseFailed(value => {
    isDecided.current = false; setToken(value);
    window.gardenDesktop.decideClose(value, false, true);
  }), []);
  useEffect(() => { if (token) stay.current?.focus({ preventScroll: true }); }, [token]);
  if (!token) return null;
  function decide(isExit) {
    if (isDecided.current) return;
    isDecided.current = true;
    window.gardenDesktop.decideClose(token, isExit);
    setToken(null);
  }
  return <section className="close-failed-page" role="dialog" aria-modal="true" aria-labelledby="close-failed-title">
    <h2 id="close-failed-title">积分还没有保存好</h2>
    <p>留在游戏里可以再试一次。现在退出的话，没写进去的积分会在下次打开时补存。</p>
    <div><button ref={stay} className="primary-button" data-gamepad-back="留在游戏" onClick={() => decide(false)}>留在游戏</button><button className="quiet-button" onClick={() => decide(true)}>仍然退出</button></div>
  </section>;
}
