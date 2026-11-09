import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Star, Heart, Pause, Play, ArrowsClockwise, House, SpeakerHigh, SpeakerSlash, Users, Trophy, Check } from '@phosphor-icons/react';
import { GardenEngine } from './engine.js';
import { CAMPAIGNS, GENERATION_VERSION } from '../../shared/campaign.js';
import { readAdventure, writeAdventure, clearAdventure } from './save.js';
import { COLLECTIBLES, LEVEL_COLLECTIBLES } from './collectibles.js';
import { SKILLS } from './skills.js';
import { LEVELS } from '../../shared/levels.js';
import { queueRun, flushScores, saveOnLeave } from '../scores/client.js';
import './game.css';
const initialStats = { flowers: 0, distance: 0, gardens: 0, score: 0, platform: 0, seconds: 0, message: '', positions: [], platforms: 0 };
function makeSeed(previous) { const value=crypto.getRandomValues(new Uint32Array(1))[0]; return value===previous ? (value+1)>>>0 : value; }
export function PlatformGame({ onExit, initialSound = true }) {
  const host = useRef(null), engine = useRef(null), menu = useRef(null), audio = useRef(null);
  const saved = useRef(readAdventure());
  const isAutoStart = useRef(false), isResumeSaved = useRef(true);
  const sound = useRef(initialSound), run = useRef(null), statusRef = useRef('loading'), isMounted = useRef(true);
  const [isSound, setIsSound] = useState(initialSound);
  const [seed, setSeed] = useState(() => saved.current?.run.seed ?? makeSeed());
  const [count, setCount] = useState(() => saved.current?.run.players ?? 1);
  const [levelIndex, setLevelIndex] = useState(() => Math.max(0,LEVELS.findIndex(l=>l.id===saved.current?.run.levelId)));
  const level = LEVELS[levelIndex];
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [sync, setSync] = useState({ isSaved: true, message: '出发后自动记录积分' });
  const [stats, setStats] = useState(initialStats);
  function changeStatus(value) { statusRef.current = value; setStatus(value); }
  function snapshotRun(snapshot, state) {
    if (!run.current || ['completed', 'ended'].includes(run.current.status)) return null;
    run.current = { ...run.current, flowers: snapshot.flowers, collectedIds: snapshot.collectedIds || [], defeatedIds: snapshot.defeatedIds || [], platform: snapshot.platform, seconds: snapshot.seconds, status: state, revision: run.current.revision + 1 };
    if (state === 'completed' || state === 'ended') clearAdventure();
    else { try { writeAdventure(run.current,engine.current.exportState()); isResumeSaved.current=true; } catch { isResumeSaved.current=false; setSync({isSaved:false,message:'本机空间不足，暂时不能保存续关'}); } }
    return run.current;
  }
  async function persist(snapshot, state) {
    const record = snapshotRun(snapshot, state);
    if (record) queueRun(record);
    setSync({ isSaved: false, message: '正在保存积分…' });
    const result = await flushScores();
    if (isMounted.current) setSync(isResumeSaved.current ? result : {isSaved:false,message:'积分已记录，但续关暂未保存，请腾出本机空间后重试'});
  }
  function playSound(type) {
    if (!sound.current) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      audio.current ||= new Audio();
      const context = audio.current;
      if (context.state !== 'running') return;
      const notes = type === 'skill' ? [523, 659, 784, 1046, 1318] : type === 'bubble' ? [392, 784] : type === 'stars' ? [880, 1175, 1568] : type === 'checkpoint' ? [523, 659, 784] : type === 'flower' ? [784, 1046] : type === 'fire' ? [440] : type === 'hit' ? [587] : [330];
      notes.forEach((frequency, i) => {
        const oscillator = context.createOscillator(), gain = context.createGain();
        oscillator.frequency.setValueAtTime(frequency, context.currentTime + i * 0.1);
        gain.gain.setValueAtTime(0.025, context.currentTime + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + i * 0.1 + 0.2);
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.start(context.currentTime + i * 0.1); oscillator.stop(context.currentTime + i * 0.1 + 0.21);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      });
    } catch { /* 音频不可用时仍可正常游玩。 */ }
  }
  useEffect(() => {
    isMounted.current = true;
    function leave() {
      const record = snapshotRun(engine.current?.snapshot() || initialStats, 'paused');
      if (record) { if(window.gardenDesktop) queueRun(record); else saveOnLeave(record); }
    }
    window.addEventListener('pagehide', leave);
    function prepareClose(event) {
      engine.current?.pause(true);
      const record = snapshotRun(engine.current?.snapshot() || initialStats, 'paused');
      if (record) queueRun(record);
      if (!isResumeSaved.current) event.preventDefault();
      if (run.current) { setStats(engine.current?.snapshot() || initialStats); changeStatus('paused'); }
    }
    window.addEventListener('garden:prepare-close', prepareClose);
    const timer = setInterval(() => {
      if (run.current && !['completed', 'ended'].includes(run.current.status)) persist(engine.current?.snapshot() || initialStats, statusRef.current === 'playing' ? 'playing' : 'paused');
    }, 3000);
    return () => { isMounted.current = false; clearInterval(timer); window.removeEventListener('pagehide', leave); window.removeEventListener('garden:prepare-close', prepareClose); audio.current?.close(); };
  }, []);
  useEffect(() => {
    document.body.classList.add('is-platform-game');
    changeStatus('loading'); setError(''); setStats(initialStats); run.current = null;
    setSync({ isSaved: true, message: '出发后自动记录积分' });
    let game;
    try {
      game = new GardenEngine(host.current, { seed, count, level, onUpdate: setStats,
        onPause: () => { changeStatus('paused'); persist(game.snapshot(), 'paused'); },
        onComplete: snapshot => { setStats(snapshot); changeStatus('completed'); persist(snapshot, 'completed'); },
        onReady: () => {
          if (saved.current) { const previous=saved.current; saved.current=null; game.restoreState(previous.state); run.current=previous.run; changeStatus('paused'); }
          else if (isAutoStart.current) { isAutoStart.current = false; start(); }
          else changeStatus('ready');
        }, onError: message => { setError(message); changeStatus('error'); }, onSound: playSound });
      engine.current = game;
      if (import.meta.env.DEV) window.__gardenEngine = game;
    } catch (failure) {
      console.error('3D 游戏启动失败', failure);
      setError('这台电脑暂时无法打开 3D 画面。请使用 Edge 或 Chrome，并开启图形加速。'); changeStatus('error');
    }
    return () => { game?.dispose(); engine.current = null; if (import.meta.env.DEV) delete window.__gardenEngine; document.body.classList.remove('is-platform-game'); };
  }, [seed, count, levelIndex]);
  useEffect(() => {
    if (status !== 'playing') {
      const target = menu.current?.querySelector(status === 'ready' ? '.level-choices button[aria-pressed=true]' : 'button:not(:disabled)');
      target?.focus({ preventScroll: true });
      if (status === 'ready') target?.scrollIntoView({ block: 'nearest' });
    }
  }, [status]);
  useEffect(() => {
    window.gardenDesktop?.updateSafe(['ready', 'paused', 'completed', 'ended'].includes(status));
    return () => window.gardenDesktop?.updateSafe(false);
  }, [status]);
  useEffect(() => {
    if (run.current && statusRef.current === 'playing') persist(engine.current.snapshot(), 'playing');
  }, [stats.flowers, stats.platform, stats.combatScore, stats.skillRevision]);
  function trapMenuFocus(event) {
    if (event.key !== 'Tab') return;
    const buttons = [...menu.current.querySelectorAll('button:not(:disabled)')];
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  function start() {
    if (statusRef.current === 'playing') return;
    if (!run.current || ['completed', 'ended'].includes(run.current.status)) {
      run.current = { id: crypto.randomUUID(), levelId: level.id, startedAt: new Date().toISOString(), players: count, seed, scoringVersion: 3, generationVersion: GENERATION_VERSION, revision: 0, status: 'playing' };
    }
    try { const Audio = window.AudioContext || window.webkitAudioContext; if (Audio && sound.current) { audio.current ||= new Audio(); audio.current.resume(); } } catch { /* 可静音游玩。 */ }
    engine.current?.pause(false); changeStatus('playing'); persist(engine.current.snapshot(), 'playing');
  }
  function pause() { engine.current?.pause(true); changeStatus('paused'); persist(engine.current.snapshot(), 'paused'); }
  function exit() { if (run.current) { engine.current?.pause(true); persist(engine.current.snapshot(), 'paused'); } onExit(); }
  function restart(index = levelIndex, isImmediate = false) {
    if (statusRef.current === 'loading') return;
    isAutoStart.current = isImmediate;
    changeStatus('loading');
    setLevelIndex(index); setSeed(previous=>makeSeed(previous));
  }
  function touchProps(action) {
    return {
      onPointerDown: event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); engine.current?.setTouch(action, true); },
      onPointerUp: () => engine.current?.setTouch(action, false), onPointerCancel: () => engine.current?.setTouch(action, false),
      onLostPointerCapture: () => engine.current?.setTouch(action, false), onContextMenu: event => event.preventDefault(),
    };
  }
  const isResult = ['completed', 'ended'].includes(status);
  const skill = SKILLS[stats.skill || 'blade'];
  return <div className="platform-game" data-game-status={status} data-level={level.id} data-player-positions={JSON.stringify(stats.positions)} data-platform-count={stats.platforms} data-route={level.id} data-enemy-count={stats.enemies}>
    <div className="game-canvas" ref={host} />
    <header className="adventure-header" inert={status !== 'playing'}>
      <button className="adventure-home" aria-label="回花园" onClick={exit}><ArrowLeft size={20} /><span>回花园</span></button>
      <div className="adventure-title"><small>第 {levelIndex + 1} 关 / 花园王国</small><h1>{level.name}</h1></div>
      <div className="adventure-actions"><button aria-label={isSound ? '关闭探险声音' : '打开探险声音'} onClick={() => { sound.current = !isSound; setIsSound(!isSound); if (sound.current) { try { const Audio = window.AudioContext || window.webkitAudioContext; if (Audio) { audio.current ||= new Audio(); audio.current.resume(); } } catch {} } }}>{isSound ? <SpeakerHigh size={24} /> : <SpeakerSlash size={24} />}</button><button aria-label="暂停探险" disabled={status !== 'playing'} onClick={pause}><Pause size={24} weight="fill" /></button></div>
    </header>
    <div className="score-popups" aria-hidden="true">{stats.pickups?.map(pickup=><span key={pickup.id} className="score-popup" style={{left:`${Math.max(12,Math.min(88,pickup.x))}%`,top:`${Math.max(30,Math.min(75,pickup.y))}%`,animationPlayState:status==='playing'?'running':'paused'}}><img src={`./assets/${pickup.kind ? COLLECTIBLES[pickup.kind].image : "enemy-burst"}.png`} alt=""/>+{pickup.points} 分</span>)}</div>
    <aside className="adventure-score" aria-label="探险收集"><span><Trophy size={24} />积分 <b key={stats.score} className="score-total">{stats.score}</b>{stats.pickups?.length>0&&<em className="score-gain" key={stats.pickups.at(-1).id}>+{stats.pickups.at(-1).points}</em>}</span><span><Star size={22} />宝物 <b>{stats.flowers}/{stats.requiredFlowers || 0}</b></span><span className="infinite-life"><Heart size={23} />无限生命</span></aside>
    <div className="level-progress"><span>探险进度 {Math.round(stats.platform / (stats.totalProgress || 1) * 100)}%</span><progress value={stats.platform} max={stats.totalProgress || 1} aria-label="关卡进度" /></div>
    {status === 'playing' && <aside className="skill-status" aria-label="当前技能"><img src={`./assets/${skill.image}.png`} alt=""/><span>{skill.name}</span>{stats.skillSeconds > 0 ? <><b>{stats.skillSeconds} 秒</b><progress value={stats.skillSeconds} max={skill.duration} aria-label="强化剩余时间"/></> : <small>贯穿屏幕</small>}</aside>}
    {status === 'playing' && stats.skillNotice && <div key={stats.skillNotice.id} className="skill-celebration" role="status"><img src={`./assets/${SKILLS[stats.skillNotice.kind].image}.png`} alt=""/><div><strong>获得{SKILLS[stats.skillNotice.kind].name}！</strong><span>{SKILLS[stats.skillNotice.kind].hint}</span></div></div>}
    {stats.message && <div className="adventure-message" role="status">{stats.message}</div>}
    <div className="adventure-bottom" inert={status !== 'playing'}><span>{count === 1 ? '← → 移动　空格 跳跃　J 攻击　↓ + 空格 下跳' : '小女孩：A D + 空格，S + 空格 下跳　J 攻击　爸爸：← → + ↑，Enter 攻击'}<small className={sync.isSaved?'':'save-pending'}>{sync.message}</small></span><button onClick={() => engine.current?.returnToSafety()} disabled={status !== 'playing'}><ArrowsClockwise size={19} />回安全台</button></div>
    {status === 'playing' && <div className="touch-controls" aria-label="触屏操作"><div><button aria-label="向左走" {...touchProps('left')}><ArrowLeft size={30} /></button><button aria-label="向右走" {...touchProps('right')}><ArrowRight size={30} /></button></div><div><button aria-label="向下跳台" {...touchProps('drop')}><ArrowDown size={27}/></button><button aria-label={`发射${skill.name}`} {...touchProps('attack')}><span>{skill.shortName}</span></button><button className="touch-jump" aria-label="跳跃" {...touchProps('jump')}><ArrowUp size={29} /><span>跳</span></button></div></div>}
    {status !== 'playing' && <div className="adventure-overlay"><section ref={menu} onKeyDown={trapMenuFocus} className={`adventure-menu ${status==='ready'?'level-menu':''}`} role="dialog" aria-modal="true" aria-labelledby="adventure-heading">
      <span className="adventure-kicker">带着画里的自己，去看更大的世界</span>
      <h2 id="adventure-heading">{status === 'loading' ? '彩笔世界准备中…' : status === 'error' ? '画面需要一点帮助' : status === 'completed' ? `${level.name}，挑战成功！` : status === 'ended' ? '今天的小脚印，收好啦' : status === 'paused' ? '坐下来，歇一小会儿' : '选一个小世界，出发吧'}</h2>
      {status === 'error' ? <p>{error}</p> : status === 'loading' ? <p>把新的风景和小伙伴放进画里。</p> : isResult ? <><div className="result-score"><Trophy size={38} weight="duotone" /><strong>{stats.score}</strong><span>分</span></div><p>宝物积分 {stats.treasureScore || 0} 分 ＋ 打怪 {stats.combatScore || 0} 分{status==='completed'?` ＋ 通关奖励 ${level.bonus} 分`:''}</p><div className="collectible-preview" aria-label="本次收集">{Object.entries(stats.collection || {}).map(([id,total])=><span key={id}><img src={`./assets/${COLLECTIBLES[id].image}.png`} alt={COLLECTIBLES[id].name}/>{COLLECTIBLES[id].name} {total} × {COLLECTIBLES[id].points} = {total * COLLECTIBLES[id].points} 分</span>)}</div><p className={sync.isSaved?'result-saved':'save-pending'} role="status">{sync.isSaved&&<Check size={18}/>} {sync.message}</p>{!sync.isSaved&&<button className="quiet-button" onClick={()=>persist(stats,status)}>重试保存</button>}</> : status==='paused' ? <p>已经收集 {stats.flowers} 件宝物，得到 {stats.score} 分。<br/>休息时不计时，掉落也不扣分。</p> : <>
        <div className="level-choices" aria-label="选择挑战关卡">{LEVELS.map((item,index)=><button key={item.id} aria-pressed={index===levelIndex} onClick={()=>setLevelIndex(index)}><img src={`./assets/${item.image}.png`} alt={item.subtitle}/><span>第 {index+1} 关</span><strong>{item.name}</strong><small>{CAMPAIGNS[item.id].name}</small><small>通关加 {item.bonus} 分</small></button>)}</div>
        <p className="level-source">{level.sources.length ? `这一关组合了原画 ${level.sources.join('、')} 的元素。` : level.story} {CAMPAIGNS[level.id].hint}</p>
        <div className="collectible-preview" aria-label="这一关的宝物">{LEVEL_COLLECTIBLES[level.id].map(id=><span key={id}><img src={`./assets/${COLLECTIBLES[id].image}.png`} alt=""/>{COLLECTIBLES[id].name} <b>{COLLECTIBLES[id].points} 分</b></span>)}</div>
        <div className="player-mode"><button aria-pressed={count===1} onClick={()=>setCount(1)}><img src="./assets/girl-player.png" alt=""/><span>自己探险</span></button><button aria-pressed={count===2} onClick={()=>setCount(2)}><Users size={28}/><span>和爸爸一起</span></button></div>
        <div className="key-guide"><span><kbd>A</kbd><kbd>D</kbd> 走一走</span><span><kbd>空格</kbd> 跳起来</span><span><kbd>J</kbd> 攻击</span>{count===2&&<span>爸爸用 <kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>Enter 攻击</kbd></span>}</div><small className="game-reassurance">光刃贯穿屏幕，捡到魔法奖励还能变出泡泡和星雨。无限生命，碰到不扣分。</small>
      </>}
      <div className="adventure-menu-actions">
        {['ready','paused'].includes(status)&&<button className="primary-button" onClick={start}><Play size={21} weight="fill"/>{status==='paused'?'继续探险':'出发吧'}<ArrowRight size={21}/></button>}
        {isResult&&<><button className="primary-button" onClick={()=>restart(status==='completed'?(levelIndex+1)%LEVELS.length:levelIndex, true)}>{status==='completed'?(levelIndex===LEVELS.length-1?'再从彩虹花园出发':'去下一关'):'再挑战一次'}<ArrowRight size={20}/></button></>}
        {status==='error'&&<button className="primary-button" onClick={()=>restart()}>重新打开</button>}
        <button className="text-button" onClick={exit}><House size={18}/>回到我的花园</button>
      </div>
    </section></div>}
  </div>;
}
