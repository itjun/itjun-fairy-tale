import { registerGamepadPlayer, vibrateGamepad } from '../input/gamepad.js';
import { useGamepad } from '../input/GamepadSupport.jsx';
import { CombatAudio } from './combat-audio.js';
import { INITIAL_LIVES, CHARACTERS } from './characters.js';
import { CharacterCamp } from './CharacterCamp.jsx';
import { DeathPanel } from './DeathPanel.jsx';
import { recommendedStarter, isValidStarter } from './starter-build.js';
import { LifeLootPanel } from './LifeLootPanel.jsx';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Play, House, Trophy, Check, ListBullets, GearSix, Sword } from '@phosphor-icons/react';
import { RoomHud, RunOverview } from './RoomHud.jsx';
import { WeaponBindingsPage } from './WeaponBindingsPage.jsx';
import { OptionsPage } from '../OptionsPage.jsx';
import { DIFFICULTIES, getPlaySettings, setPlaySettings, usePlaySettings } from './difficulty.js';
import { readAlbum, writeAlbum, recordAlbum, lockedItems } from '../album/album.js';
import { GardenEngine } from './engine.js';
import { readAdventure, writeAdventure } from './save.js';
import { COLLECTIBLES, LEVEL_COLLECTIBLES } from './collectibles.js';
import { RewardPanel } from './AdventurePanels.jsx';
import './adventure.css';
import { WORLD_ACTS } from '../../shared/levels.js';
import { carryToNextWorld } from '../../shared/adventure-cycle.js';
import { queueRun, flushScores, saveOnLeave } from '../scores/client.js';
import './game.css';
import './boss.css';
const initialStats = { flowers: 0, distance: 0, gardens: 0, score: 0, platform: 0, seconds: 0, message: '', positions: [], platforms: 0 };
function makeSeed(previous) { const value=crypto.getRandomValues(new Uint32Array(1))[0]; return value===previous ? (value+1)>>>0 : value; }
export function PlatformGame({ onExit, initialSound = true }) {
  const gamepadState = useGamepad();
  const host = useRef(null), engine = useRef(null), menu = useRef(null), audio = useRef(null);
  const [initialSaved] = useState(readAdventure);
  const saved = useRef(initialSaved);
  const carriedAdventure = useRef(null), carriedSurvival = useRef(null);
  const [character, setCharacter] = useState(() => saved.current?.state.survival?.character || 'sister');
  const [starterBuilds,setStarterBuilds]=useState(()=>{
    let stored; try { stored=JSON.parse(localStorage.getItem('garden-starter-builds-v2')); } catch {}
    return Object.fromEntries(Object.keys(CHARACTERS).map(id=>[id,isValidStarter(stored?.[id])?stored[id]:recommendedStarter(id)]));
  });
  const restartBuild = useRef(null), restartDifficulty = useRef(null), overviewFrom = useRef('paused');
  const settings = usePlaySettings();
  const [optionsCategory, setOptionsCategory] = useState('game');
  const [albumNotice, setAlbumNotice] = useState(null);
  useEffect(()=>{try { localStorage.setItem('garden-starter-builds-v2',JSON.stringify(starterBuilds)); } catch {}},[starterBuilds]);
  const isAutoStart = useRef(false), isResumeSaved = useRef(true);
  const sound = useRef(initialSound), run = useRef(null), statusRef = useRef('loading'), isMounted = useRef(true), enterCamp = useRef(false);
  const [isSound, setIsSound] = useState(initialSound);
  const [seed, setSeed] = useState(() => saved.current?.run.seed ?? makeSeed());
  const count = 1;
  const [levelIndex, setLevelIndex] = useState(() => Math.max(0, WORLD_ACTS.findIndex(item => item.id === initialSaved?.run.levelId)));
  const [markedIndex, setMarkedIndex] = useState(levelIndex);
  useEffect(() => { setMarkedIndex(levelIndex); }, [levelIndex]);
  const level = WORLD_ACTS[levelIndex];
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [sync, setSync] = useState({ isSaved: true, message: '出发后自动记录积分' });
  const [stats, setStats] = useState(initialStats);
  function changeStatus(value) { statusRef.current = value; setStatus(value); }
  function snapshotRun(snapshot, state) {
    if (!run.current) return null;
    if (run.current.status === 'completed') state = 'completed';
    if (engine.current.survival.phase === 'over') state = 'ended';
    run.current = { ...run.current, flowers: snapshot.flowers, collectedIds: snapshot.collectedIds || [], defeatedIds: snapshot.defeatedIds || [], platform: snapshot.platform, seconds: snapshot.seconds, status: state, revision: run.current.revision + 1 };
    { try { writeAdventure(run.current,engine.current.exportState()); isResumeSaved.current=true; } catch { isResumeSaved.current=false; setSync({isSaved:false,message:'本机空间不足，暂时不能保存续关'}); } }
    return run.current;
  }
  async function persist(snapshot, state) {
    const record = snapshotRun(snapshot, state);
    if (record) queueRun(record);
    setSync({ isSaved: false, message: '正在保存积分…' });
    const result = await flushScores();
    if (isMounted.current) setSync(isResumeSaved.current ? result : {isSaved:false,message:'积分已记录，但续关暂未保存，请腾出本机空间后重试'});
  }
  // 引擎报来的画册事件：记进本机画册，点亮了新的一块就在画面上说一声。
  function noteAlbum(event) {
    const result = recordAlbum(readAlbum(), event);
    if (!writeAlbum(result.album) || !result.gained) return;
    setAlbumNotice({ id: crypto.randomUUID(), text: result.completed.length ? `集满《${result.completed[0].name}》，画册里解锁了新东西！` : `画册点亮了 ${result.gained} 块！` });
  }
  useEffect(() => {
    if (!albumNotice) return;
    const timer = setTimeout(() => setAlbumNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [albumNotice]);
  function toggleSound() {
    sound.current = !isSound; setIsSound(!isSound);
    audio.current ||= new CombatAudio(); audio.current.setMuted(!sound.current); if (sound.current) audio.current.unlock();
  }
  function playSound(type) {
    if (['player-hurt', 'life-lost'].includes(type)) vibrateGamepad('hurt');
    else if (type.endsWith(':hit') || type.endsWith(':defeat')) vibrateGamepad('hit');
    audio.current ||= new CombatAudio(); audio.current.setMuted(!sound.current); audio.current.play(type);
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
      if (run.current) { setStats(engine.current?.snapshot() || initialStats); changeStatus(engine.current.survival.phase === 'over' ? 'ended' : engine.current.survival.phase === 'fallen' ? 'fallen' : engine.current?.journey.pending ? 'reward' : engine.current?.combatLoot.pendingId!==null ? 'life-loot' : engine.current.isCompleted ? 'completed' : 'paused'); }
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
      game = new GardenEngine(host.current, { seed, count, level, onUpdate: setStats, adventure: carriedAdventure.current, character, survival: carriedSurvival.current,
        difficulty: getPlaySettings().difficulty, locked: lockedItems(readAlbum()), onAlbum: noteAlbum,
        onLifeChange: snapshot => {
          setStats(snapshot);
          if (snapshot.survival.phase !== 'alive') changeStatus(snapshot.survival.phase === 'over' ? 'ended' : 'fallen');
          const record = snapshotRun(snapshot, snapshot.survival.phase === 'over' ? 'ended' : snapshot.survival.phase === 'fallen' ? 'paused' : statusRef.current === 'playing' ? 'playing' : 'paused');
          if (record && snapshot.survival.phase !== 'alive') { queueRun(record); flushScores().then(result => { if (isMounted.current) setSync(result); }); }
        },
        onReward: () => { changeStatus('reward'); persist(game.snapshot(), 'paused'); },
        onLifeLoot: () => { changeStatus('life-loot'); persist(game.snapshot(), 'paused'); },
        onPause: () => { setStats(game.snapshot()); changeStatus('paused'); persist(game.snapshot(), 'paused'); },
        onComplete: snapshot => { setStats(snapshot); changeStatus(snapshot.pendingReward ? 'reward' : 'completed'); persist(snapshot, 'completed'); },
        onReady: () => {
          if (saved.current) { const previous=saved.current; saved.current=null; game.restoreState(previous.state); run.current=previous.run; setCharacter(game.survival.character); persist(game.snapshot(), previous.run.status); changeStatus(game.survival.phase === 'over' ? 'ended' : game.survival.phase === 'fallen' ? 'fallen' : game.journey.pending ? 'reward' : game.combatLoot.pendingId!==null ? 'life-loot' : game.isCompleted ? 'completed' : 'paused'); }
          else if (isAutoStart.current) { isAutoStart.current = false; if(restartBuild.current){game.configureStarter(restartBuild.current,restartDifficulty.current||getPlaySettings().difficulty,lockedItems(readAlbum()));restartBuild.current=null;} start(); }
          else if (enterCamp.current) changeStatus('camp');
          else changeStatus('ready');
        }, onError: message => { enterCamp.current = false; setError(message); changeStatus('error'); }, onSound: playSound });
      engine.current = game;
      if (import.meta.env.DEV) window.__gardenEngine = game;
    } catch (failure) {
      console.error('3D 游戏启动失败', failure);
      setError('这台电脑暂时无法打开 3D 画面。请使用 Edge 或 Chrome，并开启图形加速。'); changeStatus('error');
    }
    return () => { game?.dispose(); engine.current = null; if (import.meta.env.DEV) delete window.__gardenEngine; document.body.classList.remove('is-platform-game'); };
  }, [seed, count, levelIndex]);
  useEffect(() => {
    if (!['playing','fallen','ended','reward','life-loot'].includes(status)) {
      // 保存提示里的重试按钮会消失，初始光标只落在稳定的菜单动作上。
      const target = menu.current?.querySelector(status === 'ready' ? '.level-choices button[aria-pressed=true]' : '.adventure-menu-actions button:not(:disabled)');
      target?.focus({ preventScroll: true });
      if (status === 'ready') target?.scrollIntoView({ block: 'nearest' });
    }
  }, [status]);
  useEffect(() => {
    window.gardenDesktop?.updateSafe(['ready', 'camp', 'paused', 'fallen', 'completed', 'ended'].includes(status));
    return () => window.gardenDesktop?.updateSafe(false);
  }, [status]);
  useEffect(() => {
    if (run.current && statusRef.current === 'playing') persist(engine.current.snapshot(), 'playing');
  }, [stats.flowers, stats.platform, stats.combatScore, stats.skillRevision]);
  function trapMenuFocus(event) {
    if (event.key === 'Escape' && statusRef.current === 'paused') {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) start();
      return;
    }
    if (event.key !== 'Tab') return;
    const buttons = [...menu.current.querySelectorAll('button:not(:disabled)')];
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  function start() {
    enterCamp.current = false;
    if (statusRef.current === 'playing') return;
    if (engine.current?.survival.phase !== 'alive' || engine.current.isCompleted) return;
    if (!run.current || ['completed', 'ended'].includes(run.current.status)) {
      run.current = { id: crypto.randomUUID(), levelId: level.id, startedAt: new Date().toISOString(), players: count, seed, scoringVersion: 3, generationVersion: engine.current.world.version, revision: 0, status: 'playing' };
    }
    audio.current ||= new CombatAudio();audio.current.setMuted(!sound.current);audio.current.unlock();
    if (engine.current?.journey.pending) { changeStatus('reward'); persist(engine.current.snapshot(), 'paused'); return; }
    if (engine.current?.combatLoot.pendingId!==null) { changeStatus('life-loot'); persist(engine.current.snapshot(), 'paused'); return; }
    engine.current?.pause(false); changeStatus('playing'); persist(engine.current.snapshot(), 'playing');
  }
  function pause() { engine.current?.pause(true); changeStatus('paused'); persist(engine.current.snapshot(), 'paused'); }
  function exit() { if (run.current) { engine.current?.pause(true); persist(engine.current.snapshot(), 'paused'); } onExit(); }
  function restart(index = levelIndex, isImmediate = false) {
    enterCamp.current = false;
    if (statusRef.current === 'loading') return;
    const isContinuing = isImmediate && statusRef.current === 'completed';
    carriedAdventure.current = isContinuing ? carryToNextWorld(engine.current.exportAdventure(), levelIndex, WORLD_ACTS.length) : null;
    carriedSurvival.current = isContinuing ? structuredClone(engine.current.survival) : null;
    saved.current = null;
    isAutoStart.current = isImmediate;
    changeStatus('loading');
    setLevelIndex(index); setSeed(previous=>makeSeed(previous));
  }
  useEffect(() => registerGamepadPlayer({
    isActive: () => statusRef.current === 'playing' && !engine.current?.isPaused,
    input: input => engine.current?.setGamepadInput(input),
    release: () => engine.current?.releaseGamepad(),
    pause: () => engine.current?.requestPause(),
    interact: () => { if (statusRef.current === 'playing') openOverview('playing'); },
  }), []);
  function touchProps(action) {
    return {
      onPointerDown: event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); engine.current?.setTouch(action, true); },
      onPointerUp: () => engine.current?.setTouch(action, false), onPointerCancel: () => engine.current?.setTouch(action, false),
      onLostPointerCapture: () => engine.current?.setTouch(action, false), onContextMenu: event => event.preventDefault(),
    };
  }
  const isResult = status === 'completed';
  const isAdventureDialog = ['reward','camp','life-loot','fallen','ended','overview','options','weapon-bindings'].includes(status);
  const isGamepad = gamepadState.mode === 'gamepad';
  const locked = lockedItems(readAlbum());
  const starterBuild = [...starterBuilds[character].weapons.map(id => `weapon:${id}`), ...starterBuilds[character].upgrades.map(id => `upgrade:${id}`)].some(id => locked.includes(id)) ? recommendedStarter(character) : starterBuilds[character];
  const person = CHARACTERS[stats.survival?.character || character];
  function selectReward(index, id, player) {
    if (!engine.current.selectReward(index, id, player)) return;
    persist(engine.current.snapshot(), 'paused');
    if (!engine.current.journey.pending) { if(engine.current.isCompleted) changeStatus('completed'); else start(); }
  }
  function rerollPending(id) {
    if (!engine.current.rerollPending(id)) return false;
    persist(engine.current.snapshot(), 'paused'); return true;
  }
  function openOverview(from) {
    if (!engine.current) return;
    overviewFrom.current = from;
    engine.current.pause(true); changeStatus('overview');
    if (from === 'playing') persist(engine.current.snapshot(), 'paused');
  }
  function closeOverview() { if (overviewFrom.current === 'playing') start(); else changeStatus('paused'); }
  function equipWeapon(slot, id) {
    const game = engine.current;
    if (statusRef.current === 'weapon-bindings' && game?.equipAttack(slot, id)) persist(game.snapshot(), 'paused');
  }
  function recyclePending(id, player) {
    if (!engine.current.recyclePending(id, player)) return;
    persist(engine.current.snapshot(), 'paused');
    if (!engine.current.journey.pending) { if(engine.current.isCompleted) changeStatus('completed'); else start(); }
  }
  function chooseLifeLoot(id,choice) {
    if(!engine.current.chooseLifeLoot(id,choice))return false;
    persist(engine.current.snapshot(),'paused');start();return true;
  }
  function leaveLifeLoot(id) {
    if(!engine.current.leaveLifeLoot(id))return;
    persist(engine.current.snapshot(),'paused');start();
  }
  return <div className="platform-game" data-game-status={status} data-adventure={!!stats.adventure} data-rooms data-level={level.id} data-player-positions={JSON.stringify(stats.positions)} data-platform-count={stats.platforms} data-route={level.id} data-enemy-count={stats.enemies} data-boss-active={!!stats.boss}>
    <div className="game-canvas" ref={host} />
    {stats.rooms && stats.survival && !['loading','ready','camp','error','overview','options','weapon-bindings'].includes(status) && <RoomHud stats={stats} person={person} isGamepad={isGamepad} isPlaying={status === 'playing'} warning={!sync.isSaved && !sync.message.startsWith('正在') ? sync.message : ''} onPause={pause} touchProps={touchProps} />}
    {albumNotice && <div key={albumNotice.id} className="album-toast" role="status"><img src="./assets/flower.png" alt="" />{albumNotice.text}</div>}
    <div className="score-popups" aria-hidden="true">{stats.pickups?.map(pickup=><span key={pickup.id} className="score-popup" style={{left:`${Math.max(12,Math.min(88,pickup.x))}%`,top:`${Math.max(30,Math.min(75,pickup.y))}%`,animationPlayState:status==='playing'?'running':'paused'}}><img src={`./assets/${pickup.kind ? COLLECTIBLES[pickup.kind].image : "enemy-burst"}.png`} alt=""/>+{pickup.points} 分</span>)}</div>
    {stats.boss && <aside className="boss-health" aria-label="BOSS 生命"><div><strong>{stats.boss.name}</strong><span>{stats.boss.hp} / {stats.boss.maxHp}</span><small className={stats.boss.isWeak ? 'is-weak' : ''}>{stats.boss.isWeak ? '露出破绽了，快打！伤害翻倍' : stats.boss.isEnraged ? '首领着急了，多了一招' : '这一章的首领'}</small></div><progress aria-label={`${stats.boss.name}生命`} value={stats.boss.hp} max={stats.boss.maxHp}/></aside>}
    {status==='playing'&&(stats.boss?.warning||stats.boss?.casting)&&<div className="boss-warning" role="status">{stats.boss.warning||stats.boss.casting}</div>}
    {status==='playing'&&stats.bossTarget&&<div className="boss-target" aria-hidden="true" style={{left:`${stats.bossTarget.x}%`,top:`${stats.bossTarget.y}%`}}><img src="./assets/enemy-burst.png" alt=""/><span>躲开这里</span></div>}
    <div className="damage-popups" aria-hidden="true">{stats.damageNumbers?.map(hit=><span key={hit.id} className={hit.isPlayer?'damage-number player-damage':'damage-number'} style={{left:`${Math.max(3,Math.min(95,hit.x))}%`,top:`max(var(--damage-min-top,22%),${Math.min(85,hit.y)}%)`}}>{hit.damage?`−${hit.damage}`:'格挡'}{hit.count>1&&<small>×{hit.count}</small>}{hit.damage>0&&hit.blocked>0&&<small>减伤 {hit.blocked}</small>}</span>)}</div>
    {status === 'playing' && stats.guide && <div className="treasure-guide"><img src="./assets/collectible-star.png" alt=""/>{stats.guide.direction}</div>}
    {stats.message && !stats.boss?.warning && !stats.boss?.casting && <div className="adventure-message" role="status">{stats.message}</div>}
    {status === 'reward' && stats.pendingReward && <RewardPanel key={`${stats.pendingReward.id}:${stats.pendingReward.player}:${stats.pendingReward.rerolls || 0}`} reward={stats.pendingReward} adventure={stats.adventure} onChoose={selectReward} onRecycle={recyclePending} onReroll={rerollPending} onExit={exit}/>}
    {status === 'camp' && <CharacterCamp character={character} build={starterBuild} locked={locked} isSound={isSound} onBuild={build=>setStarterBuilds(previous=>({...previous,[character]:build}))} onSelect={id => { setCharacter(id); engine.current.selectCharacter(id); }} onBack={() => { enterCamp.current = false; changeStatus('ready'); }} onStart={()=>{if(engine.current.configureStarter(starterBuild,getPlaySettings().difficulty,locked))start();}}/>}
    {status==='life-loot'&&stats.pendingLifeLoot!==null&&<LifeLootPanel key={stats.pendingLifeLoot} enemyId={stats.pendingLifeLoot} adventure={stats.adventure} survival={stats.survival} onChoose={chooseLifeLoot} onLeave={leaveLifeLoot} onExit={exit}/>}
    {['fallen','ended'].includes(status) && stats.survival && <DeathPanel survival={stats.survival} heldKeys={engine.current?.heldKeys || []} onContinue={()=>{if(!engine.current.revive())return false;start();return true;}} onRestart={()=>{
      const game=engine.current;
      restartBuild.current=structuredClone(game.adventure?.starter || recommendedStarter(game.survival.character));
      restartDifficulty.current=game.adventure?.difficulty || null;
      setCharacter(game.survival.character);
      if(run.current){const record=snapshotRun(game.snapshot(),'paused');if(record)queueRun({...record,status:'ended',revision:record.revision+1});}
      restart(0,true);return true;
    }}/>}
    {status === 'overview' && stats.adventure && <RunOverview stats={stats} onBack={closeOverview} />}
    {status === 'weapon-bindings' && stats.adventure && <WeaponBindingsPage adventure={stats.adventure} isGamepad={isGamepad} onBind={equipWeapon} onBack={() => changeStatus('paused')} />}
    {status === 'options' && <OptionsPage category={optionsCategory} onCategory={setOptionsCategory} onBack={() => changeStatus('paused')} backLabel="回到暂停" isSound={isSound} onSound={toggleSound} runDifficulty={stats.adventure?.difficulty || 'normal'} />}
    {status !== 'playing' && !isAdventureDialog && <div className="adventure-overlay"><section ref={menu} onKeyDown={trapMenuFocus} className={`adventure-menu ${status==='ready'?'level-menu':''}`} role="dialog" aria-modal="true" aria-labelledby="adventure-heading">
      <span className="adventure-kicker">带着画里的自己，去看更大的世界</span>
      <h2 id="adventure-heading">{status === 'loading' ? '彩笔世界准备中…' : status === 'error' ? '画面需要一点帮助' : status === 'completed' ? `${level.chapterName || level.name}，挑战成功！` : status === 'ended' ? '生命用完了，这次冒险结束' : status === 'fallen' ? `扣掉一条命，还剩 ${stats.survival?.lives} 条` : status === 'paused' ? '坐下来，歇一小会儿' : '选一个小世界，出发吧'}</h2>
      {status === 'error' ? <p>{error}</p> : status === 'loading' ? <p>把新的风景和小伙伴放进画里。</p> : status === 'fallen' ? <p>在附近安全的位置接着走。武器、本领和宝物都会保留。</p> : isResult ? <><div className="result-score"><Trophy size={38} weight="duotone" /><strong>{stats.score}</strong><span>分</span></div><p>宝物积分 {stats.treasureScore || 0} 分 ＋ 打怪 {stats.combatScore || 0} 分{status==='completed'?` ＋ 通关奖励 ${level.bonus} 分`:''}</p>{stats.rooms && <p>这一章拿到 {stats.rooms.stars} 颗星，最多 {stats.rooms.layers.length * 3} 颗。</p>}<div className="collectible-preview" aria-label="本次收集">{Object.entries(stats.collection || {}).map(([id,total])=><span key={id}><img src={`./assets/${COLLECTIBLES[id].image}.png`} alt={COLLECTIBLES[id].name}/>{COLLECTIBLES[id].name} {total} × {COLLECTIBLES[id].points} = {total * COLLECTIBLES[id].points} 分</span>)}</div><p className={sync.isSaved?'result-saved':'save-pending'} role="status">{sync.isSaved&&<Check size={18}/>} {sync.message}</p>{!sync.isSaved&&<button className="quiet-button" onClick={()=>persist(stats,status)}>重试保存</button>}</> : status==='paused' ? <p>{stats.rooms ? `已经拿到 ${stats.rooms.stars} 颗星` : `已经收集 ${stats.flowers} 件宝物`}，得到 {stats.score} 分。<br/>休息时不计时。生命、搭配和道具剩余时间都会保存。</p> : <>
        <div className="level-choices" aria-label="选择挑战关卡">{WORLD_ACTS.map((item,index)=><button key={item.id} aria-pressed={index===markedIndex} onFocus={() => setMarkedIndex(index)} onClick={() => { enterCamp.current = true; if (index === levelIndex) changeStatus('camp'); else setLevelIndex(index); }}><img src={`./assets/${item.image}.png`} alt={item.subtitle}/><span>第 {index+1} 个世界</span><strong>{item.chapterName}</strong><small>{item.name}</small><small>通关加 {item.bonus} 分</small></button>)}</div>
        <p className="level-source">{WORLD_ACTS[markedIndex].sources.length ? `这一关组合了原画 ${WORLD_ACTS[markedIndex].sources.join('、')} 的元素。` : WORLD_ACTS[markedIndex].story}</p>
        <div className="collectible-preview" aria-label="这一关的宝物">{LEVEL_COLLECTIBLES[WORLD_ACTS[markedIndex].themeId].map(id=><span key={id}><img src={`./assets/${COLLECTIBLES[id].image}.png`} alt=""/>{COLLECTIBLES[id].name} <b>{COLLECTIBLES[id].points} 分</b></span>)}</div>
        <div className="difficulty-row"><span>难度</span><div className="option-chips" aria-label="难度" data-gamepad-tabs="换难度">{Object.entries(DIFFICULTIES).map(([id, item]) => <button key={id} aria-pressed={settings.difficulty === id} onClick={() => setPlaySettings({ difficulty: id })}>{item.name}</button>)}</div><small>{DIFFICULTIES[settings.difficulty].hint}。出发后这次冒险不能换。</small></div>
        {!isGamepad && <div className="key-guide"><span><kbd>A</kbd><kbd>D</kbd> 走一走</span><span><kbd>空格</kbd> 跳起来</span><span><kbd>J</kbd><kbd>K</kbd><kbd>L</kbd> 武器和大招</span><span><kbd>W</kbd> 在小店买</span></div>}<small className="game-reassurance">一章是四间房加一场首领。清完一间，跳到发光的门上。初始 {INITIAL_LIVES} 条命，血条用完后选继续或重来。</small>
      </>}
      <div className="adventure-menu-actions">
        {['ready','paused'].includes(status)&&<button className="primary-button" data-gamepad-resume={status === 'paused' || undefined} data-gamepad-back={status === 'paused' || undefined} onClick={() => status === 'ready' ? changeStatus('camp') : start()}><Play size={21} weight="fill"/>{status==='paused'?'继续探险':'选择角色'}<ArrowRight size={21}/></button>}
        {status === 'paused' && stats.adventure && <button className="quiet-button" onClick={() => changeStatus('weapon-bindings')}><Sword size={20} />武器搭配</button>}
        {status === 'paused' && stats.adventure && <button className="quiet-button" onClick={() => openOverview('paused')}><ListBullets size={20}/>本领一览</button>}
        {status === 'paused' && <button className="quiet-button" onClick={() => { setOptionsCategory('game'); changeStatus('options'); }}><GearSix size={20}/>选项</button>}
        {status === 'fallen' && <button className="primary-button" onClick={() => { if (engine.current.revive()) start(); }}>从这里继续</button>}
        {isResult&&<><button className="primary-button" onClick={()=>restart(status==='completed'?(levelIndex+1)%WORLD_ACTS.length:0, status==='completed')}>{status==='completed'?(levelIndex===WORLD_ACTS.length-1?`进入第 ${(stats.adventure?.cycle || 1) + 1} 轮`:'去下一关'):'新冒险'}<ArrowRight size={20}/></button></>}
        {status==='error'&&<button className="primary-button" onClick={()=>restart()}>重新打开</button>}
        <button className="text-button" data-gamepad-back={!['playing', 'paused'].includes(status) || undefined} onClick={exit}><House size={18}/>回到我的花园</button>
      </div>
    </section></div>}
  </div>;
}
