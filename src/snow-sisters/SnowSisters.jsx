import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Pause, SpeakerHigh, SpeakerSlash, UsersThree } from '@phosphor-icons/react';
import { registerGamepadPlayer, navigate, vibrateGamepad } from '../input/gamepad.js';
import { useGamepad } from '../input/GamepadSupport.jsx';
import { PadHint, PadKey } from '../input/PadKey.jsx';
import { getFloor } from './floors.js';
import { matchTimeCode } from './bonus.js';
import {
  SAVE_KEY,
  RECORD_KEY,
  FIXED_DT,
  continueSnowGame,
  decodeSnowGame,
  joinSecondPlayer,
  newSnowGame,
  tickSnow,
} from './engine.js';
import { createSnowView, readQuality } from './view.js';
import { SNOW_TRACKS, SnowSound } from './sound.js';
import { SnowManual } from './Manual.jsx';
import { SNOW_PLAYTIME_KEY, bankSession, formatPlaytime, frameSeconds, recordSession } from '../playtime.js';
import './snow-sisters.css';

const MENU_MOVES = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
};

const CODE_DIR = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
};

function readSaved() {
  try {
    return decodeSnowGame(localStorage.getItem(SAVE_KEY));
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

function formatClock(frames) {
  const sec = Math.max(0, Math.ceil(frames / 60));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function KeyHint({ keys: labels, children }) {
  return (
    <span className="sn-key-hint">
      {labels.map((label) => (
        <kbd key={label} className="sn-kbd">
          {label}
        </kbd>
      ))}
      {children}
    </span>
  );
}

function BossBar({ boss }) {
  if (!boss) return null;
  const hp = boss.units.reduce((sum, u) => sum + Math.max(0, u.hp), 0);
  const maxHp = Math.max(1, boss.units.reduce((sum, u) => sum + Math.max(1, u.maxHp), 0));
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  return (
    <div className="sn-boss-bar" role="status" aria-label={`${boss.name} 血量 ${hp} / ${maxHp}`}>
      <div className="sn-boss-head">
        <strong>{boss.name}</strong>
        <span>
          {hp} / {maxHp}
        </span>
      </div>
      <div className="sn-boss-track">
        <i className="sn-boss-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function PlayerStatusCard({ player, tagLabel, cls }) {
  const letters = ['S', 'N', 'O', 'W'];
  return (
    <>
      <span className={`sn-rail-tag ${cls}`}>{tagLabel}</span>
      <strong className="sn-rail-score">{String(player.score).padStart(6, '0')}</strong>
      <span>命 ×{player.lives}</span>
      <div className="sn-letters" aria-label="SNOW 字母收集">
        {letters.map((ch) => (
          <span key={ch} className={`sn-letter ${player.letters.includes(ch) ? 'lit' : ''}`}>
            {ch}
          </span>
        ))}
      </div>
      <div className="sn-potions">
        {player.potions.speed && <span className="sn-potion-badge red">红速</span>}
        {player.potions.power && <span className="sn-potion-badge blue">蓝强</span>}
        {player.potions.range && <span className="sn-potion-badge yellow">黄远</span>}
        {player.giantTimer > 0 && <span className="sn-potion-badge green">巨大无敌</span>}
      </div>
    </>
  );
}

function RailLeft({ state }) {
  if (!state) return <aside className="sn-rail sn-rail-left" hidden aria-hidden="true" />;
  return (
    <aside className="sn-rail sn-rail-left" aria-label="1P 姐姐状态">
      <PlayerStatusCard player={state.players[0]} tagLabel="1P 姐姐" cls="p1" />
    </aside>
  );
}

function RailRight({ state, isGamepad, onPause, onJoinP2 }) {
  if (!state) return <aside className="sn-rail sn-rail-right" hidden aria-hidden="true" />;
  const fDef = getFloor(state.floor);
  const p2 = state.players[1];
  return (
    <aside className="sn-rail sn-rail-right" aria-label="2P 与塔层信息">
      <button aria-label="暂停游戏" onClick={onPause}>
        {isGamepad ? <PadKey name="menu" /> : <Pause />}
        暂停
      </button>
      <span className="sn-rail-best">
        <small>最高分</small>
        {String(state.hiScore).padStart(6, '0')}
      </span>
      <span className="sn-hud-floor">
        第 {state.floor} 层
        <small>{fDef.world.name}</small>
      </span>
      <span className="sn-rail-time" aria-label={'本局已玩 ' + formatPlaytime(frameSeconds(state.frame))}>
        <small>已玩</small>
        {formatPlaytime(frameSeconds(state.frame))}
      </span>
      {state.timeMode && <span className="sn-time-pill">TIME {formatClock(state.timeLeft)}</span>}
      {p2.active ? (
        <PlayerStatusCard player={p2} tagLabel="2P 妹妹" cls="p2" />
      ) : (
        <button type="button" onClick={onJoinP2}>
          <UsersThree size={16} aria-hidden="true" />
          2P 妹妹加入
        </button>
      )}
      <div className="sn-rail-keys">
        {isGamepad ? (
          <>
            <PadHint keys={['stick']}>移动</PadHint>
            <PadHint keys={['A']}>跳跃</PadHint>
            <PadHint keys={['X']}>喷雪 / 踢球</PadHint>
          </>
        ) : (
          <>
            <KeyHint keys={p2.active ? ['AD'] : ['AD', '←→']}>1P 移动</KeyHint>
            <KeyHint keys={['W', 'Space']}>1P 跳跃</KeyHint>
            <KeyHint keys={['J']}>1P 喷雪/踢</KeyHint>
            {p2.active ? (
              <>
                <KeyHint keys={['←→']}>2P 移动</KeyHint>
                <KeyHint keys={['↑']}>2P 跳</KeyHint>
                <KeyHint keys={['1/.']}>2P 喷雪</KeyHint>
              </>
            ) : (
              <KeyHint keys={['Enter']}>2P 加入</KeyHint>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

function MenuControlBar({ page, isGamepad, loadError, manualBackLabel }) {
  if (!isGamepad) {
    return (
      <div className="sn-pad-bar" aria-label="键盘操作提示">
        {loadError ? (
          <>
            <KeyHint keys={['WASD']}>选择</KeyHint>
            <KeyHint keys={['J', 'Enter']}>确定</KeyHint>
            <KeyHint keys={['Esc']}>回怀旧游戏</KeyHint>
          </>
        ) : page === 'manual' ? (
          <>
            <KeyHint keys={['A', 'D']}>切页</KeyHint>
            <KeyHint keys={['W', 'S']}>选条目</KeyHint>
            <KeyHint keys={['Esc']}>{manualBackLabel}</KeyHint>
          </>
        ) : page === 'pause' ? (
          <>
            <KeyHint keys={['WASD']}>选择</KeyHint>
            <KeyHint keys={['J', 'Enter']}>确定</KeyHint>
            <KeyHint keys={['Esc']}>继续游玩</KeyHint>
          </>
        ) : (
          <>
            <KeyHint keys={['WASD']}>选择</KeyHint>
            <KeyHint keys={['J', 'Enter']}>确定</KeyHint>
            <KeyHint keys={['Esc']}>{page === 'config' ? '回标题页' : '回怀旧游戏'}</KeyHint>
          </>
        )}
      </div>
    );
  }
  return (
    <div className="sn-pad-bar" aria-label="Xbox 手柄操作提示">
      {page === 'manual' ? (
        <>
          <PadHint keys={['LB', 'RB']}>切页</PadHint>
          <PadHint keys={['stick']}>选条目</PadHint>
          <PadHint keys={['B']}>{manualBackLabel}</PadHint>
        </>
      ) : page === 'pause' ? (
        <>
          <PadHint keys={['stick']}>选择</PadHint>
          <PadHint keys={['A']}>确定</PadHint>
          <PadHint keys={['menu', 'B']}>继续游玩</PadHint>
        </>
      ) : (
        <>
          <PadHint keys={['stick']}>选择</PadHint>
          <PadHint keys={['A']}>确定</PadHint>
          <PadHint keys={['B']}>{page === 'config' ? '回标题页' : '回怀旧游戏'}</PadHint>
        </>
      )}
    </div>
  );
}

export default function SnowSisters({ onExit, isSound, onSound }) {
  const gamepadState = useGamepad();
  const isPadUi = gamepadState.mode === 'gamepad';
  const [saved] = useState(readSaved);
  const [record, setRecord] = useState(readRecord);
  const gameRef = useRef(saved);
  const viewRef = useRef(null);
  const hostRef = useRef(null);
  const shellRef = useRef(null);
  const audioRef = useRef(null);

  const [page, setPage] = useState('title');
  const pageRef = useRef('title');
  const manualFrom = useRef('title');
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [warning, setWarning] = useState('');
  const [, refresh] = useState(0);

  const [timeMode, setTimeMode] = useState(false);
  const [timeUnlocked, setTimeUnlocked] = useState(false);
  const [soundTest, setSoundTest] = useState(0);
  const [pendingMode, setPendingMode] = useState(1);

  const recordRef = useRef(record);
  const keysRef = useRef(new Set());
  const pad1Ref = useRef({ left: false, right: false, up: false, down: false, jump: false, shoot: false });
  const pad2Ref = useRef({ left: false, right: false, up: false, down: false, jump: false, shoot: false, join: false });
  const touchRef = useRef({ left: false, right: false, jump: false, shoot: false });
  const slotTapRef = useRef(false);
  const dragRef = useRef(null);
  const codeBufRef = useRef([]);
  const lastVibeRef = useRef(0);

  const s = gameRef.current;

  function release() {
    keysRef.current.clear();
    pad1Ref.current = { left: false, right: false, up: false, down: false, jump: false, shoot: false };
    pad2Ref.current = { left: false, right: false, up: false, down: false, jump: false, shoot: false, join: false };
    touchRef.current = { left: false, right: false, jump: false, shoot: false };
    slotTapRef.current = false;
    dragRef.current = null;
  }

  function show(next) {
    release();
    pageRef.current = next;
    setPage(next);
    if (next !== 'play') audioRef.current?.hush();
  }

  function persist() {
    const g = gameRef.current;
    if (!g) return true;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(g));
      recordSession(SNOW_PLAYTIME_KEY, frameSeconds(g.frame));
      const best = Math.max(g.hiScore || 0, g.players[0]?.score || 0, g.players[1]?.score || 0);
      if (best > recordRef.current) {
        localStorage.setItem(RECORD_KEY, String(best));
        recordRef.current = best;
        setRecord(best);
      }
      setWarning('');
      return true;
    } catch {
      setWarning('本次冒险进度暂未保存，请检查本地存储空间。');
      return false;
    }
  }

  function pause() {
    if (pageRef.current === 'play') {
      show('pause');
      persist();
    }
  }

  function resume() {
    audioRef.current?.wake();
    const g = gameRef.current;
    if (!g) return;
    if (g.phase === 'over') show('over');
    else if (g.phase === 'ending') show('ending');
    else show('play');
  }

  function startRun(playerCount) {
    // 新开一局前，把上一局的游玩时间并入累计。
    bankSession(SNOW_PLAYTIME_KEY, frameSeconds(gameRef.current?.frame));
    gameRef.current = newSnowGame({
      players: playerCount,
      timeMode,
      seed: crypto.getRandomValues(new Uint32Array(1))[0],
      hiScore: recordRef.current,
    });
    persist();
    resume();
  }

  function tryLaunch(playerCount) {
    if (s && !['ending'].includes(s.phase)) {
      setPendingMode(playerCount);
      show('replace');
      return;
    }
    startRun(playerCount);
  }

  function openManual(from) {
    manualFrom.current = from;
    show('manual');
  }

  function leave() {
    if (!persist()) return;
    onExit();
  }

  function handleContinue() {
    if (continueSnowGame(gameRef.current)) {
      persist();
      resume();
    }
  }

  function handleJoinP2() {
    if (gameRef.current && joinSecondPlayer(gameRef.current)) {
      persist();
      refresh((n) => n + 1);
    }
  }

  const [quality, setQualityState] = useState(readQuality);
  function swapQuality() {
    const next = quality === 'high' ? 'standard' : 'high';
    viewRef.current?.setQuality(next);
    setQualityState(next);
  }

  function swapSound() {
    audioRef.current?.hush();
    if (audioRef.current) {
      audioRef.current.enabled = !isSound;
      if (!isSound) audioRef.current.wake();
    }
    onSound();
  }

  useEffect(() => {
    if (audioRef.current) audioRef.current.enabled = isSound;
  }, [isSound]);

  useEffect(() => {
    window.gardenDesktop?.updateSafe(page !== 'play');
    return () => window.gardenDesktop?.updateSafe(false);
  }, [page]);

  useLayoutEffect(() => {
    const first = shellRef.current?.querySelector('[data-sn-first]');
    first?.focus({ preventScroll: true });
  }, [page, ready]);

  useEffect(() => {
    const sound = new SnowSound();
    sound.enabled = isSound;
    audioRef.current = sound;
    return () => {
      sound.dispose();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    let dead = false;
    let owned = null;
    let raf = 0;
    let last = 0;
    let carry = 0;
    let lastStill = null;
    setReady(false);
    setLoadError('');

    createSnowView(hostRef.current)
      .then((v) => {
        if (dead) {
          v.dispose();
          return;
        }
        owned = v;
        viewRef.current = v;
        setReady(true);

        const loop = (now) => {
          raf = requestAnimationFrame(loop);
          const g = gameRef.current;
          if (pageRef.current !== 'play' || !g) {
            carry = 0;
            last = now;
            if (g && g !== lastStill && ['pause', 'over', 'ending'].includes(pageRef.current)) {
              v.frame(g);
              lastStill = g;
            }
            return;
          }
          lastStill = null;
          carry += Math.min(100, Math.max(0, now - (last || now)));
          last = now;

          while (carry >= FIXED_DT && pageRef.current === 'play') {
            carry -= FIXED_DT;
            const k = keysRef.current;
            const p1g = pad1Ref.current;
            const p2g = pad2Ref.current;
            const tch = touchRef.current;
            const isCoop = g.players[1]?.active;
            const slotStop = slotTapRef.current;
            slotTapRef.current = false;

            const p1In = {
              left: k.has('KeyA') || (!isCoop && k.has('ArrowLeft')) || p1g.left || tch.left,
              right: k.has('KeyD') || (!isCoop && k.has('ArrowRight')) || p1g.right || tch.right,
              up: k.has('KeyW') || (!isCoop && k.has('ArrowUp')) || p1g.up,
              down: k.has('KeyS') || (!isCoop && k.has('ArrowDown')) || p1g.down,
              jump:
                k.has('KeyW') ||
                k.has('KeyK') ||
                k.has('Space') ||
                (!isCoop && (k.has('ArrowUp') || k.has('KeyX'))) ||
                p1g.jump ||
                tch.jump ||
                slotStop,
              shoot: k.has('KeyJ') || k.has('KeyZ') || p1g.shoot || tch.shoot,
            };

            const p2In = {
              left: (isCoop && k.has('ArrowLeft')) || p2g.left,
              right: (isCoop && k.has('ArrowRight')) || p2g.right,
              up: (isCoop && k.has('ArrowUp')) || p2g.up,
              down: (isCoop && k.has('ArrowDown')) || p2g.down,
              jump:
                (isCoop && (k.has('ArrowUp') || k.has('Numpad2') || k.has('Period'))) ||
                p2g.jump ||
                slotStop,
              shoot:
                (isCoop && (k.has('Numpad1') || k.has('Comma') || k.has('Slash'))) ||
                p2g.shoot,
              join: k.has('Enter') || k.has('Numpad0') || k.has('F2') || p2g.join,
            };

            tickSnow(g, { p1: p1In, p2: p2In });
            audioRef.current?.frame(g);

            if (g.sounds.some((id) => ['melt', 'bossDown', 'oneUp'].includes(id))) {
              vibrateGamepad('hurt', 0);
            } else if (g.frame - lastVibeRef.current >= 8 && g.sounds.some((id) => ['kick', 'chain', 'squash'].includes(id))) {
              lastVibeRef.current = g.frame;
              vibrateGamepad('hit', 0);
            }

            if (g.phase === 'over' || g.phase === 'ending') {
              show(g.phase);
              persist();
              break;
            }
            if (g.frame % 300 === 0) persist();
            if (g.frame % 6 === 0 || g.sounds.length > 0) refresh((n) => n + 1);
          }

          v.frame(g);
        };
        raf = requestAnimationFrame(loop);
      })
      .catch(() => {
        if (!dead) setLoadError('彩笔冒险舞台未能打开。');
      });

    const el = hostRef.current;
    function lost(e) {
      e.preventDefault();
      pause();
      setReady(false);
      setLoadError('画面已中断，当前层数已保存。');
    }
    el.addEventListener('webglcontextlost', lost, true);
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      el.removeEventListener('webglcontextlost', lost, true);
      owned?.dispose();
      if (viewRef.current === owned) viewRef.current = null;
    };
  }, [attempt]);

  useEffect(() => {
    const gate = registerGamepadPlayer({
      isActive: () => pageRef.current === 'play',
      pause,
      release,
      interact: () => {},
      input(i, secondPadInput) {
        const a = i.actions;
        pad1Ref.current = {
          left: i.direction < -0.25 || a.has('left'),
          right: i.direction > 0.25 || a.has('right'),
          up: a.has('up'),
          down: a.has('down'),
          jump: a.has('confirm'),
          shoot: a.has('attack'),
        };
        if (secondPadInput) {
          const b = secondPadInput.actions;
          pad2Ref.current = {
            left: secondPadInput.direction < -0.25 || b.has('left'),
            right: secondPadInput.direction > 0.25 || b.has('right'),
            up: b.has('up'),
            down: b.has('down'),
            jump: b.has('confirm'),
            shoot: b.has('attack'),
            join: b.has('confirm') || b.has('attack') || b.has('pause'),
          };
        } else {
          pad2Ref.current = { left: false, right: false, up: false, down: false, jump: false, shoot: false, join: false };
        }
      },
    });

    const events = new AbortController();
    const opts = { signal: events.signal };

    function keydown(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const where = pageRef.current;

      // 标题页检测 FC 秘密 Time 模式指令：↑×2 →×8 ↓×2 ←×8
      if (where === 'title' && !e.repeat && CODE_DIR[e.code]) {
        const { next, matched } = matchTimeCode(codeBufRef.current, CODE_DIR[e.code]);
        codeBufRef.current = next;
        if (matched) {
          setTimeUnlocked(true);
          setTimeMode(true);
          audioRef.current?.wake();
          audioRef.current?.effect('oneUp');
        }
      }

      if (where !== 'play') {
        if (e.repeat && ['Enter', 'Space', 'KeyJ'].includes(e.code)) {
          e.preventDefault();
          return;
        }
        if (MENU_MOVES[e.code]) {
          e.preventDefault();
          const dir = MENU_MOVES[e.code];
          navigate(shellRef.current, dir);
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
          if (active && shellRef.current?.contains(active) && active.tagName === 'BUTTON' && !active.disabled) {
            active.click();
          }
          return;
        }
        if (e.code === 'Escape' && !e.repeat) {
          e.preventDefault();
          shellRef.current?.querySelector('[data-gamepad-back]')?.click();
        }
        return;
      }

      if (e.code === 'Escape' && !e.repeat) {
        e.preventDefault();
        pause();
        return;
      }
      if (
        ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyJ', 'KeyK', 'KeyX', 'KeyZ', 'Numpad0', 'Numpad1', 'Numpad2', 'Enter', 'Comma', 'Period', 'Slash', 'F2'].includes(
          e.code,
        )
      ) {
        e.preventDefault();
        keysRef.current.add(e.code);
      }
    }

    function keyup(e) {
      keysRef.current.delete(e.code);
    }

    window.addEventListener('keydown', keydown, opts);
    window.addEventListener('keyup', keyup, opts);
    window.addEventListener('blur', pause, opts);
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); }, opts);
    window.addEventListener('pagehide', persist, opts);
    window.addEventListener('garden:prepare-close', (e) => { if (!persist()) e.preventDefault(); }, opts);

    return () => {
      gate();
      events.abort();
    };
  }, []);

  const padBadge = (name) =>
    isPadUi ? (
      <span className="sn-btn-pad" aria-hidden="true">
        <PadKey name={name} />
      </span>
    ) : null;

  const back = (fn, label = '返回') => (
    <button data-gamepad-back onClick={fn}>
      {isPadUi ? padBadge('B') : <kbd className="sn-kbd" aria-hidden="true">Esc</kbd>}
      {label}
    </button>
  );

  const isPlaying = page === 'play' && !!s;
  const stagePhase = isPlaying ? s.phase : page;
  const isSlot = isPlaying && (s.phase === 'slot' || s.phase === 'warpSlot');

  return (
    <main
      ref={shellRef}
      className="sn-page home-page"
      data-gamepad-page={'snow-sisters-' + page}
      data-sn-page={stagePhase}
    >
      <div className="sn-screen">
        <div className="sn-stage">
          <RailLeft state={isPlaying ? s : null} />
          <div className="sn-arena">
            <div ref={hostRef} className="sn-field" aria-hidden={!isPlaying} />
            {isPlaying && (
              <>
                <div
                  className="sn-touch-area"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    dragRef.current = { id: e.pointerId, x: e.clientX };
                  }}
                  onPointerMove={(e) => {
                    const d = dragRef.current;
                    if (d?.id === e.pointerId) {
                      const dx = e.clientX - d.x;
                      touchRef.current.left = dx < -10;
                      touchRef.current.right = dx > 10;
                    }
                  }}
                  onPointerUp={() => {
                    dragRef.current = null;
                    touchRef.current.left = false;
                    touchRef.current.right = false;
                  }}
                  onPointerCancel={() => {
                    dragRef.current = null;
                    touchRef.current = { left: false, right: false, jump: false, shoot: false };
                  }}
                />
                <BossBar boss={s.boss} />
                {isSlot && s.bonus && (
                  <div className="sn-slot-overlay" role="dialog" aria-label={s.bonus.message}>
                    <h2>{s.bonus.message}</h2>
                    <p>
                      第 {s.bonus.queue[s.bonus.turnIndex]}P 拍停转轮
                      {s.bonus.kind === 'warp' ? `（当前已累计跳 ${s.bonus.totalSkip} 层）` : ''}
                    </p>
                    <div className="sn-slot-reels">
                      {s.bonus.reels.map((r, idx) => (
                        <div key={idx} className={`sn-reel-box ${r.stopped ? 'stopped' : ''}`}>
                          {r.stopped ? r.symbol : r.strip[r.pos]}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      autoFocus
                      onClick={() => {
                        slotTapRef.current = true;
                      }}
                    >
                      拍停第 {Math.min(3, s.bonus.activeReel + 1)} 轮
                    </button>
                  </div>
                )}
                <div className="sn-touch-buttons">
                  <button
                    onPointerDown={() => {
                      touchRef.current.jump = true;
                    }}
                    onPointerUp={() => {
                      touchRef.current.jump = false;
                    }}
                  >
                    跳
                  </button>
                  <button
                    onPointerDown={() => {
                      touchRef.current.shoot = true;
                    }}
                    onPointerUp={() => {
                      touchRef.current.shoot = false;
                    }}
                  >
                    喷雪
                  </button>
                </div>
              </>
            )}
          </div>
          <RailRight state={isPlaying ? s : null} isGamepad={isPadUi} onPause={pause} onJoinP2={handleJoinP2} />
        </div>

        {(page !== 'play' || loadError) && (
          <section className={'sn-panel sn-' + page}>
            {loadError ? (
              <>
                <h2>{loadError}</h2>
                <button data-sn-first onClick={() => setAttempt((n) => n + 1)}>
                  {padBadge('A')}
                  重新打开舞台
                </button>
                {back(leave, '回怀旧游戏')}
              </>
            ) : page === 'title' ? (
              <>
                <p className="sn-best">最高分　{String(record).padStart(6, '0')}</p>
                <h1>小雪人姐妹</h1>
                {timeUnlocked && <span className="sn-time-unlocked">TIME 竞速秘籍已开启！</span>}
                <nav>
                  {s && s.phase !== 'ending' && (
                    <button data-sn-first disabled={!ready} onClick={resume}>
                      {padBadge('A')}
                      继续第 {s.floor} 层
                    </button>
                  )}
                  <button data-sn-first={!s || s.phase === 'ending'} disabled={!ready} onClick={() => tryLaunch(1)}>
                    {(!s || s.phase === 'ending') && padBadge('A')}
                    1P 单人冒险（姐姐）
                  </button>
                  <button disabled={!ready} onClick={() => tryLaunch(2)}>
                    2P 双人同屏（姐妹合作）
                  </button>
                  <button onClick={() => show('config')}>塔楼与声音设置</button>
                  <button onClick={() => openManual('title')}>图文说明书</button>
                  {back(leave, '回怀旧游戏')}
                </nav>
                <div className="sn-help">
                  {isPadUi ? (
                    <>
                      <PadHint keys={['stick']}>移动</PadHint>
                      <PadHint keys={['A']}>跳跃</PadHint>
                      <PadHint keys={['X']}>喷雪 / 踢雪球</PadHint>
                      <PadHint keys={['menu']}>暂停</PadHint>
                    </>
                  ) : (
                    <>
                      <KeyHint keys={['WASD']}>1P 移动</KeyHint>
                      <KeyHint keys={['Space', 'W']}>跳跃</KeyHint>
                      <KeyHint keys={['J']}>喷雪 / 踢球</KeyHint>
                      <KeyHint keys={['方向键', '1/2']}>2P 同屏</KeyHint>
                    </>
                  )}
                </div>
              </>
            ) : page === 'manual' ? (
              <SnowManual
                isGamepad={isPadUi}
                backLabel={manualFrom.current === 'pause' ? '返回暂停' : '返回标题'}
                onBack={() => show(manualFrom.current)}
              />
            ) : page === 'config' ? (
              <>
                <h2>塔楼与声音设置</h2>
                <button data-sn-first aria-pressed={timeMode} onClick={() => setTimeMode((v) => !v)}>
                  挑战模式　{timeMode ? 'Time 2分钟极限' : '标准 50 层闯关'}
                </button>
                <label>
                  原声与音效测试
                  <select
                    value={soundTest}
                    onChange={(e) => {
                      const n = +e.target.value;
                      setSoundTest(n);
                      audioRef.current?.previewTest(n);
                    }}
                  >
                    {SNOW_TRACKS.map((t, i) => (
                      <option key={t.id} value={i}>
                        {t.name}
                      </option>
                    ))}
                    {['音效：喷雪', '音效：成球', '音效：踢飞', '音效：双色连锁', '音效：药水', '音效：奖命 1UP'].map(
                      (label, j) => (
                        <option key={label} value={SNOW_TRACKS.length + j}>
                          {String(SNOW_TRACKS.length + j + 1).padStart(2, '0')} {label}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <button onClick={swapSound}>
                  {isSound ? <SpeakerHigh /> : <SpeakerSlash />} 游戏声音　{isSound ? '开' : '关'}
                </button>
                <button onClick={swapQuality}>画质　{quality === 'high' ? '最高' : '标准'}</button>
                {back(() => show('title'), '回标题页')}
              </>
            ) : page === 'replace' ? (
              <>
                <h2>开始新的登塔冒险？</h2>
                <p>当前停在第 {s?.floor || 1} 层，新开局将替换此次续玩进度。</p>
                <button data-sn-first data-gamepad-back onClick={() => show('title')}>
                  {padBadge('B')}
                  保留现有进度
                </button>
                <button onClick={() => startRun(pendingMode)}>
                  {padBadge('A')}
                  开始 {pendingMode}P 新冒险
                </button>
              </>
            ) : page === 'pause' ? (
              <>
                <h2>冒险暂停</h2>
                <p>
                  第 {s.floor} 层　{getFloor(s.floor).world.name}
                </p>
                <p className="sn-playtime">本局已玩 {formatPlaytime(frameSeconds(s.frame))}</p>
                <button data-sn-first data-gamepad-resume data-gamepad-back onClick={resume}>
                  {padBadge('menu')}
                  继续冒险
                </button>
                {!s.players[1].active && (
                  <button
                    onClick={() => {
                      handleJoinP2();
                      resume();
                    }}
                  >
                    让 2P 妹妹加入同屏
                  </button>
                )}
                <button onClick={() => openManual('pause')}>图文说明书</button>
                <button onClick={swapSound}>
                  {isSound ? <SpeakerHigh /> : <SpeakerSlash />} 游戏声音　{isSound ? '开' : '关'}
                </button>
                <button onClick={swapQuality}>画质　{quality === 'high' ? '最高' : '标准'}</button>
                <button onClick={leave}>保存并回怀旧游戏</button>
              </>
            ) : page === 'over' ? (
              <>
                <h2>{s.timeMode && s.timeLeft <= 0 ? 'TIME UP！时间到' : '雪人融化啦'}</h2>
                <p>
                  第 {s.floor} 层　1P {s.players[0].score} 分
                  {s.players[1].active ? ` · 2P ${s.players[1].score} 分` : ''}
                </p>
                <p>剩余共享续关：{s.continues} 次</p>
                <button data-sn-first disabled={s.continues <= 0} onClick={handleContinue}>
                  {padBadge('A')}
                  投币续关（从第 {s.floor} 层继续）
                </button>
                <button onClick={() => startRun(s.mode)}>从第 1 层重新开始</button>
                {back(leave, '回怀旧游戏')}
              </>
            ) : (
              <>
                <h2>救出双胞胎公主！</h2>
                <p>
                  50 层大高塔通关！　1P {s?.players[0]?.score || 0} 分
                  {s?.players[1]?.active ? ` · 2P ${s.players[1].score} 分` : ''}
                </p>
                <div className="sn-credits" role="region" aria-label="制作人员表" tabIndex={0}>
                  <div className="sn-credits-roll">
                    <h3>制作人员表</h3>
                    <dl>
                      <dt>原作致敬</dt>
                      <dd>《雪人兄弟》东亚企划 Toaplan · FC 版 1991</dd>
                      <dt>主角与彩笔画风</dt>
                      <dd>小画家的姐姐与妹妹</dd>
                      <dt>关卡与怪物</dt>
                      <dd>50 层高塔、五位大守卫、九类小怪</dd>
                      <dt>芯片原声与音效</dt>
                      <dd>12 首网页合成曲目与全套音效</dd>
                      <dt>特别感谢</dt>
                      <dd>每一位陪孩子一起堆雪球的你</dd>
                    </dl>
                  </div>
                </div>
                <button data-sn-first onClick={() => show('title')}>
                  {padBadge('A')}
                  回标题页
                </button>
                {back(leave, '回怀旧游戏')}
              </>
            )}

            <MenuControlBar
              page={page}
              isGamepad={isPadUi}
              loadError={loadError}
              manualBackLabel={manualFrom.current === 'pause' ? '返回暂停' : '返回标题'}
            />
          </section>
        )}

        {warning && (
          <p role="alert" className="sn-warning">
            {warning}
          </p>
        )}
      </div>
    </main>
  );
}
