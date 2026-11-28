import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Pause, SpeakerHigh, SpeakerSlash } from '@phosphor-icons/react';
import { registerGamepadPlayer, navigate, vibrateGamepad } from '../input/gamepad.js';
import { useGamepad } from '../input/GamepadSupport.jsx';
import { PadHint, PadKey } from '../input/PadKey.jsx';
import { AREA_NAMES, BOSS, GUN_NAMES } from './stages.js';
import {
  SAVE_KEY,
  RECORD_KEY,
  decodeFlight,
  newFlight,
  tick,
  continueFlight,
  nextSpeed,
  setFlightWidth,
  shopBuy,
  depart,
} from './flight.js';
import { createFlightView, readQuality } from './view.js';
import { applyPose, capturePose } from './pose.js';
import { FLIGHT_PLAYTIME_KEY, bankSession, formatPlaytime, frameSeconds, recordSession } from '../playtime.js';
import { FlightSound } from './sound.js';
import { FlightManual } from './Manual.jsx';
import { SHIP_CANVAS_SIZE, paintBaseShip, paintWingedShip } from './ship-art.js';
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
  KeyJ: 'fire',
};
const menuMoves = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
};
const freshInput = () => ({ x: 0, y: 0, fire: false });
// 方向键和 WASD 慢慢加上去、松开再慢慢停，巡航大约六成机速，不会一下窜满。
const KEY_CRUISE = 0.58;
function glideAxis(current, target) {
  const next = current + (target - current) * 0.16;
  return Math.abs(next) < 0.012 ? 0 : next;
}
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
function EndingWingedCraft() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, SHIP_CANVAS_SIZE, SHIP_CANVAS_SIZE);
    paintWingedShip(ctx);
  }, []);
  return <canvas ref={ref} width={SHIP_CANVAS_SIZE} height={SHIP_CANVAS_SIZE} className="gn-ending-plane" aria-hidden="true" />;
}
function BossBar({ boss }) {
  if (!boss) return null;
  const bossName = BOSS[boss.kind]?.[0] || '首领';
  const bossHp = boss.hp > 0 ? Math.max(1, Math.ceil(boss.hp)) : 0;
  const bossMaxHp = Math.max(1, Math.ceil(boss.maxHp));
  const bossPct = Math.max(0, Math.min(100, (boss.hp / bossMaxHp) * 100));
  return (
    <div
      className="gn-boss-bar"
      role="status"
      aria-label={`${bossName} 血量 ${bossHp} / ${bossMaxHp}`}
      data-hit={boss.flash > 0}
      data-guarded={boss.age >= 72 && !boss.open}
    >
      <div className="gn-boss-head">
        <strong>{bossName}</strong>
        <span>
          {bossHp} / {bossMaxHp}
        </span>
      </div>
      <div className="gn-boss-track">
        <i className="gn-boss-fill" style={{ width: `${bossPct}%` }} />
      </div>
    </div>
  );
}
function ShipLifeIcon() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, SHIP_CANVAS_SIZE, SHIP_CANVAS_SIZE);
    paintBaseShip(ctx);
  }, []);
  return <canvas ref={ref} width={SHIP_CANVAS_SIZE} height={SHIP_CANVAS_SIZE} className="gn-plane-icon" aria-hidden="true" />;
}
function RailLeft({ state }) {
  if (!state) return <aside className="gn-rail gn-rail-left" hidden aria-hidden="true" />;
  const p = state.ship;
  return (
    <aside className="gn-rail gn-rail-left" aria-label="飞行成绩">
      <strong className="gn-rail-score">{String(state.score).padStart(6, '0')}</strong>
      <span className="gn-rail-time" aria-label={'本局已玩 ' + formatPlaytime(frameSeconds(state.frame))}>
        <small>已玩</small> {formatPlaytime(frameSeconds(state.frame))}
      </span>
      <span aria-label={'备用战机 ' + p.lives}>
        <ShipLifeIcon /> ×{p.lives}
      </span>
      <span className="gn-rail-bomb">
        {p.bomb} {p.stock} <small>Lv.{p.bombPower}</small>
      </span>
    </aside>
  );
}
function RailRight({ state, isGamepad, onPause }) {
  if (!state) return <aside className="gn-rail gn-rail-right" hidden aria-hidden="true" />;
  const p = state.ship;
  return (
    <aside className="gn-rail gn-rail-right" aria-label="飞行状态">
      <button aria-label="暂停飞行" onClick={onPause}>
        {isGamepad ? <PadKey name="menu" /> : <Pause />}
      </button>
      <span className="gn-hud-area">
        第 {state.area} 区
        <small>{AREA_NAMES[state.area]}</small>
      </span>
      <span className="gn-rail-loadout">
        <span>
          {p.gun} 号 {GUN_NAMES[p.gun - 1]}
        </span>
        <span>Lv.{p.power}</span>
        <span>机速 {p.speed}</span>
        <span>¥ {p.cash}</span>
      </span>
      <div className="gn-flight-keys">
        {isGamepad ? (
          <>
            <span>自动射击</span>
            <PadHint keys={['A']}>投弹</PadHint>
            <PadHint keys={['Y']}>换速</PadHint>
          </>
        ) : (
          <>
            <span>
              <kbd>WASD</kbd>移动
            </span>
            <span>自动射击</span>
            <span>
              <kbd>K</kbd>投弹
            </span>
            <span>
              <kbd>L</kbd>换速
            </span>
          </>
        )}
      </div>
    </aside>
  );
}
function KeyHint({ keys: labels, children }) {
  return (
    <span className="gn-key-hint">
      {labels.map((label) => (
        <kbd key={label} className="gn-kbd">
          {label}
        </kbd>
      ))}
      {children}
    </span>
  );
}
function MenuControlBar({ page, isGamepad, loadError, manualBackLabel }) {
  if (!isGamepad) {
    if (loadError) {
      return (
        <div className="gn-pad-bar" aria-label="键盘操作提示">
          <KeyHint keys={['WASD']}>选择</KeyHint>
          <KeyHint keys={['J', 'Enter']}>确定</KeyHint>
          <KeyHint keys={['Esc']}>回花园</KeyHint>
        </div>
      );
    }
    return (
      <div className="gn-pad-bar" aria-label="键盘操作提示">
        {page === 'manual' ? (
          <>
            <KeyHint keys={['A', 'D']}>切页</KeyHint>
            <KeyHint keys={['W', 'S']}>选条目</KeyHint>
            <KeyHint keys={['Esc']}>{manualBackLabel}</KeyHint>
          </>
        ) : page === 'config' ? (
          <>
            <KeyHint keys={['W', 'S']}>选项目</KeyHint>
            <KeyHint keys={['A', 'D']}>调值</KeyHint>
            <KeyHint keys={['J', 'Enter']}>切换</KeyHint>
            <KeyHint keys={['Esc']}>返回机库</KeyHint>
          </>
        ) : page === 'shop' ? (
          <>
            <KeyHint keys={['WASD']}>选择</KeyHint>
            <KeyHint keys={['J', 'Enter']}>购买或出发</KeyHint>
            <KeyHint keys={['Esc']}>保存并回花园</KeyHint>
          </>
        ) : page === 'pause' ? (
          <>
            <KeyHint keys={['WASD']}>选择</KeyHint>
            <KeyHint keys={['J', 'Enter']}>确定</KeyHint>
            <KeyHint keys={['Esc']}>继续飞行</KeyHint>
          </>
        ) : (
          <>
            <KeyHint keys={['WASD']}>选择</KeyHint>
            <KeyHint keys={['J', 'Enter']}>确定</KeyHint>
            <KeyHint keys={['Esc']}>{page === 'replace' ? '保留进度' : '回花园'}</KeyHint>
          </>
        )}
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="gn-pad-bar" aria-label="Xbox 手柄操作提示">
        <PadHint keys={['stick']}>选择</PadHint>
        <PadHint keys={['A']}>确定</PadHint>
        <PadHint keys={['B']}>回花园</PadHint>
      </div>
    );
  }
  return (
    <div className="gn-pad-bar" aria-label="Xbox 手柄操作提示">
      {page === 'manual' ? (
        <>
          <PadHint keys={['LB', 'RB']}>切页</PadHint>
          <PadHint keys={['stick']}>选条目</PadHint>
          <PadHint keys={['B']}>{manualBackLabel}</PadHint>
        </>
      ) : page === 'config' ? (
        <>
          <PadHint keys={['stick']}>上下选 / 左右调值</PadHint>
          <PadHint keys={['A']}>切换</PadHint>
          <PadHint keys={['B']}>返回机库</PadHint>
        </>
      ) : page === 'shop' ? (
        <>
          <PadHint keys={['stick']}>选项目 / 左右选区</PadHint>
          <PadHint keys={['A']}>购买或出发</PadHint>
          <PadHint keys={['B']}>保存并回花园</PadHint>
        </>
      ) : page === 'pause' ? (
        <>
          <PadHint keys={['stick']}>选择</PadHint>
          <PadHint keys={['A']}>确定</PadHint>
          <PadHint keys={['menu', 'B']}>继续飞行</PadHint>
        </>
      ) : (
        <>
          <PadHint keys={['stick']}>选择</PadHint>
          <PadHint keys={['A']}>确定</PadHint>
          <PadHint keys={['B']}>{page === 'replace' ? '保留进度' : '回花园'}</PadHint>
        </>
      )}
    </div>
  );
}
export default function GunNac({ onExit, isSound, onSound }) {
  const gamepadState = useGamepad();
  const isPadUi = gamepadState.mode === 'gamepad';
  const [saved] = useState(readSaved),
    [record, setRecord] = useState(readRecord);
  const flight = useRef(saved),
    view = useRef(null),
    viewWidth = useRef(256),
    host = useRef(null),
    shell = useRef(null),
    audio = useRef(null);
  const [page, setPage] = useState('title'),
    pageRef = useRef('title'),
    manualFrom = useRef('title');
  const [ready, setReady] = useState(false),
    [loadError, setLoadError] = useState(''),
    [attempt, setAttempt] = useState(0);
  const [warning, setWarning] = useState(''),
    [, refresh] = useState(0);
  const [difficulty, setDifficulty] = useState(2),
    [area, setArea] = useState(1),
    [soundTest, setSoundTest] = useState(1),
    [ricochet, setRicochet] = useState(false);
  // 画质默认「最高」，只在手动切换时改变；存在本机，不会自动降档。
  const [quality, setQualityState] = useState(readQuality);
  const [parcel, setParcel] = useState(() => Math.min(8, (saved?.area ?? 0) + 1)),
    [shopNotice, setShopNotice] = useState('');
  const recordRef = useRef(record),
    press = useRef(new Set()),
    pad = useRef(freshInput()),
    touch = useRef(freshInput()),
    keyGlide = useRef({ x: 0, y: 0 });
  const bombPending = useRef(false),
    padEdges = useRef({ bomb: false, speed: false, prev: false, next: false }),
    lastVibe = useRef(0),
    drag = useRef(null);
  const s = flight.current;
  function release() {
    press.current.clear();
    pad.current = freshInput();
    touch.current = freshInput();
    keyGlide.current.x = 0;
    keyGlide.current.y = 0;
    bombPending.current = false;
    padEdges.current = { bomb: false, speed: false, prev: false, next: false };
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
      recordSession(FLIGHT_PLAYTIME_KEY, frameSeconds(game.frame));
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
    if (g) {
      setFlightWidth(g, viewWidth.current);
      show(g.phase);
    }
  }
  function start() {
    // 新开一局前，把上一局的游玩时间并入累计。
    bankSession(FLIGHT_PLAYTIME_KEY, frameSeconds(flight.current?.frame));
    flight.current = newFlight({
      area: soundTest === 5 ? area : 1,
      difficulty,
      gun: 1,
      ricochet,
      seed: crypto.getRandomValues(new Uint32Array(1))[0],
      width: viewWidth.current,
    });
    persist();
    resume();
  }
  function openManual(from) {
    manualFrom.current = from;
    show('manual');
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
      lastStill = null,
      // 上一步逻辑开始前各物体的位置，用于画面插值（见 pose.js）。
      prevPose = null,
      lastBossKey = '';
    setReady(false);
    setLoadError('');
    createFlightView(host.current, (w) => {
      viewWidth.current = w;
      if (flight.current) setFlightWidth(flight.current, w);
    })
      .then((v) => {
        if (dead) {
          v.dispose();
          return;
        }
        owned = v;
        view.current = v;
        viewWidth.current = v.getWidth();
        if (flight.current) setFlightWidth(flight.current, viewWidth.current);
        setReady(true);
        const loop = (now) => {
          raf = requestAnimationFrame(loop);
          const g = flight.current;
          if (pageRef.current !== 'flight' || !g) {
            carry = 0;
            last = now;
            prevPose = null;
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
              finger = touch.current,
              glide = keyGlide.current;
            const keyX = (Number(k.has('right')) - Number(k.has('left'))) * KEY_CRUISE;
            const keyY = (Number(k.has('down')) - Number(k.has('up'))) * KEY_CRUISE;
            glide.x = glideAxis(glide.x, keyX);
            glide.y = glideAxis(glide.y, keyY);
            prevPose = capturePose(g);
            tick(g, {
              x: glide.x + gamepad.x + finger.x,
              y: glide.y + gamepad.y + finger.y,
              fire: k.has('fire') || gamepad.fire || finger.fire,
              bomb: bombPending.current,
            });
            bombPending.current = false;
            audio.current?.frame(g);
            if (g.sounds.some((id) => id === 'hurt' || id === 'victory' || id.startsWith('bomb')))
              vibrateGamepad('hurt');
            else if (
              g.frame - lastVibe.current >= 8 &&
              g.sounds.some((id) => id === 'pickup' || id === 'life' || id.startsWith('hit'))
            ) {
              lastVibe.current = g.frame;
              vibrateGamepad('hit');
            }
            if (g.phase !== 'flight') {
              setParcel(Math.min(8, g.area + 1));
              setShopNotice('');
              show(g.phase);
              persist();
              break;
            }
            if (g.frame % 360 === 0) persist();
            const bossKey = g.boss
              ? `${g.boss.kind}:${Math.ceil(g.boss.hp)}:${g.boss.open}:${g.boss.flash > 0}`
              : '';
            if (bossKey !== lastBossKey || g.frame % 5 === 0) {
              lastBossKey = bossKey;
              refresh((n) => n + 1);
            }
          }
          // 两步之间按剩余时间比例取位置；渲染后还原，逻辑不受影响。
          const alpha = g.phase === 'flight' ? carry / (1000 / 60) : 1;
          const restore = applyPose(g, prevPose, alpha);
          v.frame(g);
          restore();
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
      interact: () => nextSpeed(flight.current, 1),
      input(i) {
        const a = i.actions;
        const edge = padEdges.current;
        pad.current = {
          x: i.direction,
          y: -i.vertical,
          fire: a.has('attack'),
        };
        if (a.has('confirm') && !edge.bomb) bombPending.current = true;
        if (a.has('spell') && !edge.speed) nextSpeed(flight.current, 1);
        if (a.has('next') && !edge.next) nextSpeed(flight.current, 1);
        if (a.has('previous') && !edge.prev) nextSpeed(flight.current, -1);
        edge.bomb = a.has('confirm');
        edge.speed = a.has('spell');
        edge.next = a.has('next');
        edge.prev = a.has('previous');
      },
    });
    const events = new AbortController(),
      opts = { signal: events.signal };
    function keydown(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const where = pageRef.current;
      if (where !== 'flight') {
        if (e.repeat && ['Enter', 'Space', 'KeyJ'].includes(e.code)) {
          e.preventDefault();
          return;
        }
        if (menuMoves[e.code]) {
          e.preventDefault();
          const dir = menuMoves[e.code];
          navigate(shell.current, dir);
          if (
            where === 'manual' &&
            (dir === 'left' || dir === 'right') &&
            document.activeElement?.getAttribute('role') === 'tab'
          ) {
            document.activeElement.click();
          }
          return;
        }
        if (e.code === 'KeyJ') {
          e.preventDefault();
          const active = document.activeElement;
          if (active && shell.current?.contains(active) && active.tagName === 'BUTTON' && !active.disabled)
            active.click();
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
      } else if (['Enter', 'Escape', 'KeyK', 'KeyL'].includes(e.code)) {
        e.preventDefault();
        if (e.repeat) return;
        if (e.code === 'Enter' || e.code === 'Escape') pause();
        else if (e.code === 'KeyK') bombPending.current = true;
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
  const padBadge = (name) =>
    isPadUi ? (
      <span className="gn-btn-pad" aria-hidden="true">
        <PadKey name={name} />
      </span>
    ) : null;
  const back = (fn, label = '返回') => (
    <button data-gamepad-back onClick={fn}>
      {isPadUi ? (
        padBadge('B')
      ) : (
        <kbd className="gn-kbd" aria-hidden="true">
          Esc
        </kbd>
      )}
      {label}
    </button>
  );
  const isFreshStart = !s || s.phase === 'ending';
  const isFlying = page === 'flight' && !!s;
  const launchButton = (
    <button
      data-gn-first={isFreshStart ? true : undefined}
      disabled={!ready}
      onClick={() => (s && s.phase !== 'ending' ? show('replace') : start())}
    >
      {isFreshStart && padBadge('A')}
      开始游戏
    </button>
  );
  return (
    <main ref={shell} className="gn-page home-page" data-gamepad-page={'gun-nac-' + page} data-gn-page={page}>
      <div className="gn-screen">
        <div className="gn-stage">
          <RailLeft state={isFlying ? s : null} />
          <div className="gn-arena">
            <div ref={host} className="gn-field" aria-hidden={!isFlying} />
            {isFlying && (
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
                <BossBar boss={s.boss} />
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
                </div>
              </>
            )}
          </div>
          <RailRight state={isFlying ? s : null} isGamepad={isPadUi} onPause={pause} />
        </div>
        {(page !== 'flight' || loadError) && (
          <section className={'gn-panel gn-' + page}>
            {loadError ? (
              <>
                <h2>{loadError}</h2>
                <button data-gn-first onClick={() => setAttempt((n) => n + 1)}>
                  {padBadge('A')}
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
                      {padBadge('A')}
                      继续飞行
                    </button>
                  )}
                  {launchButton}
                  <button onClick={() => show('config')}>飞行设置</button>
                  <button onClick={() => openManual('title')}>游戏说明书</button>
                  {back(leave, '回花园')}
                </nav>
                <div className="gn-help" aria-label={isPadUi ? 'Xbox 手柄操控说明' : '键盘操控说明'}>
                  {isPadUi ? (
                    <div className="gn-help-pad">
                      <PadHint keys={['stick']}>移动</PadHint>
                      <span>自动射击</span>
                      <PadHint keys={['A']}>投弹</PadHint>
                      <PadHint keys={['Y']}>换速</PadHint>
                      <PadHint keys={['menu']}>暂停</PadHint>
                    </div>
                  ) : (
                    <div className="gn-help-pad">
                      <KeyHint keys={['WASD']}>移动</KeyHint>
                      <span>自动射击</span>
                      <KeyHint keys={['K']}>投弹</KeyHint>
                      <KeyHint keys={['L']}>换速</KeyHint>
                      <KeyHint keys={['Esc']}>暂停</KeyHint>
                    </div>
                  )}
                </div>
              </>
            ) : page === 'manual' ? (
              <FlightManual
                isGamepad={isPadUi}
                backLabel={manualFrom.current === 'pause' ? '返回暂停' : '返回机库'}
                onBack={() => show(manualFrom.current)}
              />
            ) : page === 'config' ? (
              <>
                <h2>飞行设置</h2>
                <label>
                  难度
                  <span className="gn-select-wrap">
                    <select data-gn-first value={difficulty} onChange={(e) => setDifficulty(+e.target.value)}>
                      {['入门', '普通', '进阶', '专家'].map((n, i) => (
                        <option key={n} value={i + 1}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </span>
                </label>
                <button aria-pressed={ricochet} onClick={() => setRicochet((v) => !v)}>
                  反击弹　{ricochet ? '开' : '关'}
                </button>
                <label>
                  声音测试
                  <span className="gn-select-wrap">
                    <select
                      value={soundTest}
                      onChange={(e) => {
                        const n = +e.target.value;
                        setSoundTest(n);
                        audio.current?.previewTest(n);
                      }}
                    >
                      {Array.from({ length: 16 }, (_, i) => (
                        <option key={i} value={i}>
                          {String(i).padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                  </span>
                </label>
                <label>
                  出发地区
                  <span className="gn-select-wrap" data-disabled={soundTest !== 5}>
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
                  </span>
                </label>
                <button
                  onClick={() => {
                    const next = quality === 'high' ? 'standard' : 'high';
                    setQualityState(next);
                    view.current?.setQuality(next);
                  }}
                >
                  画质　{quality === 'high' ? '最高' : '标准'}
                </button>
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
                  {padBadge('B')}
                  保留进度
                </button>
                <button onClick={() => start()}>
                  {padBadge('A')}
                  重新出击
                </button>
              </>
            ) : page === 'pause' ? (
              <>
                <h2>飞行暂停</h2>
                <p>
                  第 {s.area} 区　{AREA_NAMES[s.area]}
                </p>
                <p className="gn-playtime">本局已玩 {formatPlaytime(frameSeconds(s.frame))}</p>
                <button data-gn-first data-gamepad-resume data-gamepad-back onClick={resume}>
                  {padBadge('menu')}
                  继续飞行
                </button>
                <button onClick={() => openManual('pause')}>游戏说明书</button>
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
                      <span className="gn-select-wrap">
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
                      </span>
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
                    {padBadge('A')}
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
                  {padBadge('A')}
                  从本区续关
                </button>
                {back(leave, '回花园')}
              </>
            ) : (
              <>
                <EndingWingedCraft />
                <h2>星系恢复了和平</h2>
                <p>八区通关　得分 {s.score}</p>
                <button data-gn-first onClick={() => show('title')}>
                  {padBadge('A')}
                  回机库
                </button>
                {back(leave, '回花园')}
              </>
            )}
            <MenuControlBar
              page={page}
              isGamepad={isPadUi}
              loadError={loadError}
              manualBackLabel={manualFrom.current === 'pause' ? '返回暂停' : '返回机库'}
            />
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
