import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, Pause, SpeakerHigh, SpeakerSlash } from '@phosphor-icons/react';
import { registerGamepadPlayer, navigate } from '../input/gamepad.js';
import { AREA_NAMES, GUN_NAMES } from './stages.js';
import {
  SAVE_KEY,
  RECORD_KEY,
  decodeFlight,
  newFlight,
  tick,
  continueFlight,
  nextSpeed,
  shopBuy,
  depart,
} from './flight.js';
import { createFlightView } from './view.js';
import { FlightSound } from './sound.js';
import './flight.css';

const keys = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  KeyX: 'fire',
};
const freshInput = () => ({ x: 0, y: 0, fire: false });
function readSaved() {
  try {
    return decodeFlight(localStorage.getItem(SAVE_KEY));
  } catch {
    return null;
  }
}
function readRecord() {
  try {
    return Number(localStorage.getItem(RECORD_KEY)) || 0;
  } catch {
    return 0;
  }
}
function HUD({ state, onPause }) {
  const p = state.ship;
  return (
    <div className="gn-hud">
      <div>
        <strong>{String(state.score).padStart(6, '0')}</strong>
        <span aria-label={'备用战机 ' + p.lives}>
          <i className="gn-plane-icon" /> ×{p.lives}
        </span>
        <span>
          {p.bomb} {p.stock} <small>Lv.{p.bombPower}</small>
        </span>
      </div>
      <div className="gn-hud-right">
        <button aria-label="暂停飞行" onClick={onPause}>
          <Pause />
        </button>
        <small>
          {state.area} 区　{p.gun} 号 Lv.{p.power}
        </small>
        <small>
          机速 {p.speed}　¥ {p.cash}
        </small>
      </div>
    </div>
  );
}
export default function GunNac({ onExit, isSound, onSound }) {
  const [saved] = useState(readSaved),
    [record, setRecord] = useState(readRecord);
  const flight = useRef(saved),
    view = useRef(null),
    host = useRef(null),
    shell = useRef(null),
    audio = useRef(null);
  const [page, setPage] = useState('title'),
    pageRef = useRef('title');
  const [ready, setReady] = useState(false),
    [loadError, setLoadError] = useState(''),
    [attempt, setAttempt] = useState(0);
  const [warning, setWarning] = useState(''),
    [, refresh] = useState(0);
  const [difficulty, setDifficulty] = useState(2),
    [area, setArea] = useState(1),
    [soundTest, setSoundTest] = useState(1),
    [ricochet, setRicochet] = useState(false);
  const [parcel, setParcel] = useState(() => Math.min(8, (saved?.area ?? 0) + 1)),
    [shopNotice, setShopNotice] = useState('');
  const recordRef = useRef(record),
    press = useRef(new Set()),
    pad = useRef(freshInput()),
    touch = useRef(freshInput());
  const bombPending = useRef(false),
    padBomb = useRef(false),
    drag = useRef(null);
  const s = flight.current;
  function release() {
    press.current.clear();
    pad.current = freshInput();
    touch.current = freshInput();
    bombPending.current = false;
    padBomb.current = false;
    drag.current = null;
  }
  function show(next) {
    release();
    pageRef.current = next;
    setPage(next);
    if (next !== 'flight') audio.current?.hush();
  }
  function persist() {
    const game = flight.current;
    if (!game) return true;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(game));
      if (game.score > recordRef.current) {
        localStorage.setItem(RECORD_KEY, String(game.score));
        recordRef.current = game.score;
        setRecord(game.score);
      }
      setWarning('');
      return true;
    } catch {
      setWarning('这次飞行还没保存，请腾出存储空间后重试。');
      return false;
    }
  }
  function pause() {
    if (pageRef.current === 'flight') {
      show('pause');
      persist();
    }
  }
  function resume() {
    audio.current?.wake();
    const g = flight.current;
    if (g) show(g.phase);
  }
  function start() {
    flight.current = newFlight({
      area: soundTest === 5 ? area : 1,
      difficulty,
      ricochet,
      seed: crypto.getRandomValues(new Uint32Array(1))[0],
    });
    persist();
    resume();
  }
  function leave() {
    if (!persist()) return;
    onExit();
  }
  function continueRun() {
    if (continueFlight(flight.current)) {
      persist();
      resume();
    }
  }
  function launchNext() {
    if (depart(flight.current)) {
      setShopNotice('');
      persist();
      resume();
    }
  }
  function purchase(kind) {
    const g = flight.current;
    if (pageRef.current !== 'shop') return;
    if (shopBuy(g, kind, parcel)) {
      setShopNotice(kind === 'parcel' ? '炸弹已寄往第 ' + parcel + ' 区' : '已装好');
      audio.current?.effect('pickup');
      persist();
      refresh((n) => n + 1);
    }
  }
  function swapSound() {
    audio.current?.hush();
    if (audio.current) {
      audio.current.enabled = !isSound;
      if (!isSound) audio.current.wake();
    }
    onSound();
  }
  useEffect(() => {
    if (audio.current) audio.current.enabled = isSound;
  }, [isSound]);
  useEffect(() => {
    window.gardenDesktop?.updateSafe(page !== 'flight');
    return () => window.gardenDesktop?.updateSafe(false);
  }, [page]);
  useLayoutEffect(() => {
    const first = shell.current?.querySelector('[data-gn-first]');
    first?.focus({ preventScroll: true });
  }, [page, ready]);
  useEffect(() => {
    const sound = new FlightSound();
    sound.enabled = isSound;
    audio.current = sound;
    return () => {
      sound.dispose();
      audio.current = null;
    };
  }, []);
  useEffect(() => {
    let dead = false,
      owned = null,
      raf = 0,
      last = 0,
      carry = 0,
      lastStill = null;
    setReady(false);
    setLoadError('');
    createFlightView(host.current)
      .then((v) => {
        if (dead) {
          v.dispose();
          return;
        }
        owned = v;
        view.current = v;
        setReady(true);
        const loop = (now) => {
          raf = requestAnimationFrame(loop);
          const g = flight.current;
          if (pageRef.current !== 'flight' || !g) {
            carry = 0;
            last = now;
            if (g && g !== lastStill && ['pause', 'over', 'ending', 'shop'].includes(pageRef.current)) {
              v.frame(g);
              lastStill = g;
            }
            return;
          }
          lastStill = null;
          carry += Math.min(100, Math.max(0, now - (last || now)));
          last = now;
          while (carry >= 1000 / 60 && pageRef.current === 'flight') {
            carry -= 1000 / 60;
            const k = press.current,
              gamepad = pad.current,
              finger = touch.current;
            tick(g, {
              x: Number(k.has('right')) - Number(k.has('left')) + gamepad.x + finger.x,
              y: Number(k.has('down')) - Number(k.has('up')) + gamepad.y + finger.y,
              fire: k.has('fire') || gamepad.fire || finger.fire,
              bomb: bombPending.current,
            });
            bombPending.current = false;
            audio.current?.frame(g);
            if (g.phase !== 'flight') {
              setParcel(Math.min(8, g.area + 1));
              setShopNotice('');
              show(g.phase);
              persist();
              break;
            }
            if (g.frame % 360 === 0) persist();
            if (g.frame % 5 === 0) refresh((n) => n + 1);
          }
          v.frame(g);
        };
        raf = requestAnimationFrame(loop);
      })
      .catch(() => {
        if (!dead) setLoadError('战场画面未能打开。');
      });
    const element = host.current;
    function lost(e) {
      e.preventDefault();
      pause();
      setReady(false);
      setLoadError('战场画面已中断，进度已保留。');
    }
    element.addEventListener('webglcontextlost', lost, true);
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      element.removeEventListener('webglcontextlost', lost, true);
      owned?.dispose();
      if (view.current === owned) view.current = null;
    };
  }, [attempt]);
  useEffect(() => {
    const gate = registerGamepadPlayer({
      isActive: () => pageRef.current === 'flight',
      pause,
      release,
      interact: () => nextSpeed(flight.current),
      input(i) {
        const a = i.actions;
        pad.current = {
          x: Number(a.has('right')) - Number(a.has('left')),
          y: Number(a.has('down')) - Number(a.has('up')),
          fire: i.faceX,
        };
        if (a.has('confirm') && !padBomb.current) bombPending.current = true;
        padBomb.current = a.has('confirm');
      },
    });
    const events = new AbortController(),
      opts = { signal: events.signal };
    function keydown(e) {
      const where = pageRef.current;
      if (where !== 'flight') {
        if (e.repeat && ['Enter', 'Space'].includes(e.code)) {
          e.preventDefault();
          return;
        }
        if (
          ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) &&
          (e.target?.tagName !== 'SELECT' || !e.altKey)
        ) {
          e.preventDefault();
          navigate(shell.current, e.code.slice(5).toLowerCase());
          return;
        }
        if (e.code === 'Escape' && !e.repeat) {
          e.preventDefault();
          shell.current?.querySelector('[data-gamepad-back]')?.click();
        }
        return;
      }
      if (keys[e.code]) {
        e.preventDefault();
        press.current.add(keys[e.code]);
      } else if (['Enter', 'Escape', 'KeyZ', 'ShiftLeft', 'ShiftRight'].includes(e.code)) {
        e.preventDefault();
        if (e.repeat) return;
        if (e.code === 'Enter' || e.code === 'Escape') pause();
        else if (e.code === 'KeyZ') bombPending.current = true;
        else nextSpeed(flight.current);
      }
    }
    window.addEventListener('keydown', keydown, opts);
    window.addEventListener('keyup', (e) => press.current.delete(keys[e.code]), opts);
    window.addEventListener('blur', pause, opts);
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) pause();
      },
      opts,
    );
    window.addEventListener('pagehide', persist, opts);
    window.addEventListener(
      'garden:prepare-close',
      (e) => {
        if (!persist()) e.preventDefault();
      },
      opts,
    );
    return () => {
      gate();
      events.abort();
    };
  }, []);
  const back = (fn, label = '返回') => (
    <button data-gamepad-back onClick={fn}>
      <ArrowLeft size={18} />
      {label}
    </button>
  );
  const launchButton = (
    <button
      data-gn-first={!s || s.phase === 'ending' ? true : undefined}
      disabled={!ready}
      onClick={() => (s && s.phase !== 'ending' ? show('replace') : start())}
    >
      开始游戏
    </button>
  );
  return (
    <main ref={shell} className="gn-page home-page" data-gamepad-page={'gun-nac-' + page} data-gn-page={page}>
      <div className="gn-screen">
        <div ref={host} className="gn-field" aria-hidden={page !== 'flight'} />
        {page === 'flight' && s && (
          <>
            <div
              className="gn-touch-area"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
              }}
              onPointerMove={(e) => {
                const d = drag.current;
                if (d?.id === e.pointerId) {
                  touch.current.x = Math.sign(Math.abs(e.clientX - d.x) > 7 ? e.clientX - d.x : 0);
                  touch.current.y = Math.sign(Math.abs(e.clientY - d.y) > 7 ? e.clientY - d.y : 0);
                }
              }}
              onPointerUp={() => {
                drag.current = null;
                touch.current.x = touch.current.y = 0;
              }}
              onPointerCancel={() => {
                drag.current = null;
                touch.current = freshInput();
              }}
            />
            <HUD state={s} onPause={pause} />
            {s.banner > 0 && (
              <div className="gn-banner">
                {AREA_NAMES[s.area]}
                <small>第 {s.area} 区</small>
              </div>
            )}
            <div className="gn-touch-buttons">
              <button onClick={() => nextSpeed(s)}>换速</button>
              <button
                onPointerDown={() => {
                  bombPending.current = true;
                }}
              >
                投弹
              </button>
              <button
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  touch.current.fire = true;
                }}
                onPointerCancel={() => {
                  touch.current.fire = false;
                }}
                onPointerUp={() => {
                  touch.current.fire = false;
                }}
              >
                射击
              </button>
            </div>
          </>
        )}
        {(page !== 'flight' || loadError) && (
          <section className={'gn-panel gn-' + page}>
            {loadError ? (
              <>
                <h2>{loadError}</h2>
                <button data-gn-first onClick={() => setAttempt((n) => n + 1)}>
                  重新打开画面
                </button>
                {back(leave, '回花园')}
              </>
            ) : page === 'title' ? (
              <>
                <p className="gn-best">最高分　{String(record).padStart(6, '0')}</p>
                <h1>加纳战机</h1>
                <nav>
                  {s && s.phase !== 'ending' && (
                    <button data-gn-first disabled={!ready} onClick={resume}>
                      继续飞行
                    </button>
                  )}
                  {launchButton}
                  <button onClick={() => show('config')}>飞行设置</button>
                  {back(leave, '回花园')}
                </nav>
                <p className="gn-help">
                  方向键移动　X 射击　Z 投弹　Shift 换速
                  <br />
                  手柄　X 射击　A 投弹　View 换速　Menu 暂停
                </p>
              </>
            ) : page === 'config' ? (
              <>
                <h2>飞行设置</h2>
                <label>
                  难度
                  <select data-gn-first value={difficulty} onChange={(e) => setDifficulty(+e.target.value)}>
                    {['入门', '普通', '进阶', '专家'].map((n, i) => (
                      <option key={n} value={i + 1}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <button aria-pressed={ricochet} onClick={() => setRicochet((v) => !v)}>
                  反击弹　{ricochet ? '开' : '关'}
                </button>
                <label>
                  声音测试
                  <select
                    value={soundTest}
                    onChange={(e) => {
                      const n = +e.target.value;
                      setSoundTest(n);
                      audio.current.wake();
                      audio.current.effect('shot' + (1 + (n % 5)));
                    }}
                  >
                    {Array.from({ length: 16 }, (_, i) => (
                      <option key={i} value={i}>
                        {String(i).padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  出发地区
                  <select
                    disabled={soundTest !== 5}
                    value={soundTest === 5 ? area : 1}
                    onChange={(e) => setArea(+e.target.value)}
                  >
                    {AREA_NAMES.map((n, i) => (
                      <option key={n} value={i}>
                        {i}　{n}
                      </option>
                    ))}
                  </select>
                </label>
                <button onClick={swapSound}>
                  {isSound ? <SpeakerHigh /> : <SpeakerSlash />} 游戏声音　{isSound ? '开' : '关'}
                </button>
                {back(() => show('title'), '返回机库')}
              </>
            ) : page === 'replace' ? (
              <>
                <h2>重新出击？</h2>
                <p>将替换这次飞行进度。</p>
                <button data-gn-first data-gamepad-back onClick={() => show('title')}>
                  保留进度
                </button>
                <button onClick={start}>重新出击</button>
              </>
            ) : page === 'pause' ? (
              <>
                <h2>飞行暂停</h2>
                <p>
                  第 {s.area} 区　{AREA_NAMES[s.area]}
                </p>
                <button data-gn-first data-gamepad-resume data-gamepad-back onClick={resume}>
                  继续飞行
                </button>
                <button onClick={swapSound}>{isSound ? <SpeakerHigh /> : <SpeakerSlash />} 游戏声音</button>
                <button onClick={leave}>保存并回花园</button>
              </>
            ) : page === 'shop' ? (
              <>
                <h2>星际补给站</h2>
                <p>
                  第 {s.area} 区通过　　钱包 ¥ {s.ship.cash}
                </p>
                <div className="gn-shop-grid">
                  {GUN_NAMES.map((name, i) => (
                    <button
                      key={name}
                      disabled={
                        s.ship.cash < 10 || (s.ship.gun === i + 1 && s.ship.power >= (s.ship.wing ? 8 : 3))
                      }
                      onClick={() => purchase('gun' + (i + 1))}
                    >
                      {i + 1} {name} <small>¥10</small>
                    </button>
                  ))}
                  <button disabled={s.ship.cash < 10 || s.ship.wing} onClick={() => purchase('wing')}>
                    机翼 <small>¥10</small>
                  </button>
                  <button disabled={s.ship.cash < 6 || s.ship.turbo === 5} onClick={() => purchase('turbo')}>
                    连射 {s.ship.turbo}/5 <small>¥6</small>
                  </button>
                </div>
                {s.area < 8 && (
                  <div className="gn-parcel">
                    <label>
                      预送到
                      <select
                        aria-label="预送地区"
                        value={parcel}
                        onChange={(e) => setParcel(+e.target.value)}
                      >
                        {AREA_NAMES.slice(s.area + 1).map((name, i) => (
                          <option key={name} value={s.area + 1 + i}>
                            第 {s.area + 1 + i} 区
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      disabled={s.ship.cash < 4 || s.orders[parcel] >= 20}
                      onClick={() => purchase('parcel')}
                    >
                      寄炸弹 ¥4　×{s.orders[parcel]}
                    </button>
                  </div>
                )}
                {s.area === 7 && <p>终关补给：每攒够 ¥10 自动换一枚炸弹。</p>}
                <span role="status" className="gn-shop-notice">
                  {shopNotice || '当前武器　' + GUN_NAMES[s.ship.gun - 1] + '　Lv.' + s.ship.power}
                </span>
                <div className="gn-row">
                  <button data-gn-first onClick={launchNext}>
                    飞往第 {s.area + 1} 区
                  </button>
                  {back(leave, '保存并回花园')}
                </div>
              </>
            ) : page === 'over' ? (
              <>
                <h2>战机用尽</h2>
                <p>
                  第 {s.area} 区　得分 {s.score}
                </p>
                <button data-gn-first onClick={continueRun}>
                  从本区续关
                </button>
                {back(leave, '回花园')}
              </>
            ) : (
              <>
                <div className="gn-ending-plane" aria-hidden="true" />
                <h2>星系恢复了和平</h2>
                <p>八区通关　得分 {s.score}</p>
                <button data-gn-first onClick={() => show('title')}>
                  回机库
                </button>
                {back(leave, '回花园')}
              </>
            )}
          </section>
        )}
        {warning && (
          <p role="alert" className="gn-warning">
            {warning}
          </p>
        )}
      </div>
    </main>
  );
}
