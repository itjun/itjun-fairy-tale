import { lazy, Suspense } from 'react';
import { HomePage } from './HomePage.jsx';
import { HomeMenu, artworkNames, turns } from './HomeMenu.jsx';
import { DesktopActions, DesktopRestState } from './DesktopActions.jsx';
import { GardenBackup } from './GardenBackup.jsx';
import { earnedQuests } from './garden-progress.js';
import { readMiniGames } from './garden-backup.js';
import { createMiniSession, isMiniComplete } from './mini-games/session.js';
const MiniGame = lazy(() => import('./mini-games/MiniGame.jsx').then(module => ({ default: module.MiniGame })));
import { readAdventure, clearAdventure } from './game/save.js';
import { queueRun, flushScores } from './scores/client.js';
const ScoreHistory = lazy(() => import('./scores/ScoreHistory.jsx').then(module => ({ default: module.ScoreHistory })));
const PlatformGame = lazy(() => import('./game/PlatformGame.jsx').then(module => ({ default: module.PlatformGame })));
import { useEffect, useRef, useState } from 'react';
import { Flower, Rainbow, IceCream, Heart, Star, Sparkle, ArrowRight, ArrowLeft, SpeakerHigh, SpeakerSlash, X, Check, House, Images, PaintBrush, ArrowCounterClockwise, DownloadSimple, Play, Drop, Flag, Butterfly, Trophy } from '@phosphor-icons/react';

const asset = (path) => window.__GAME_ASSETS__?.[path] || `./${path}`;
const quests = [
  { id: 'rainbow', title: '找回彩虹', hint: '找线索，解开彩虹机关', icon: Rainbow, color: 'pink', reward: '彩虹魔法师' },
  { id: 'garden', title: '照顾花朵', hint: '播种照料，搭配花束', icon: Flower, color: 'green', reward: '花园小园丁' },
  { id: 'treat', title: '甜蜜分享', hint: '看订单，制作多层冰淇淋', icon: IceCream, color: 'blue', reward: '甜心分享家' },
];
const storageKey = 'little-garden-kingdom-v1';
const emptyProgress = { rainbow: 0, flowers: [0, 0, 0, 0], served: [false, false, false, false], stamps: [] };
function loadProgress() {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey));
    if (!data) return emptyProgress;
    return {
      rainbow: Number.isInteger(data.rainbow) ? Math.max(0, Math.min(6, data.rainbow)) : 0,
      flowers: Array.isArray(data.flowers) && data.flowers.length === 4 ? data.flowers.map(v => [0, 1, 2].includes(v) ? v : 0) : [0, 0, 0, 0],
      served: Array.isArray(data.served) && data.served.length === 4 ? data.served.map(v => v === true) : [false, false, false, false],
      achievements: Object.fromEntries(quests.map(({ id }) => [id, data.achievements?.[id] === true])),
      miniGames: readMiniGames(data.miniGames),
      stamps: Array.isArray(data.stamps) ? data.stamps.filter(v => ['flower', 'heart', 'star', 'butterfly'].includes(v.type) && Number.isFinite(v.x) && Number.isFinite(v.y) && v.x >= 0 && v.x <= 100 && v.y >= 0 && v.y <= 100).slice(-40) : [],
    };
  } catch { return emptyProgress; }
}
function Icon({ as: Component, ...props }) { return <Component weight="duotone" size={26} aria-hidden="true" {...props} />; }
function Stamp({ type }) {
  if (type === 'flower') return <img src={asset('assets/flower.png')} alt="" />;
  return <Icon as={{ heart: Heart, star: Star, butterfly: Butterfly, Trophy }[type]} weight="fill" size={46} />;
}
function Modal({ title, children, onClose, className = '' }) {
  const dialog = useRef(null);
  useEffect(() => { dialog.current.showModal(); }, []);
  return <dialog ref={dialog} aria-labelledby="game-dialog-title" className={`modal ${className}`} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="modal-top"><span className="eyebrow">花园里的小小冒险</span><button className="icon-button" aria-label="关闭" onClick={onClose}><Icon as={X} /></button></div>
    <h2 id="game-dialog-title">{title}</h2>{children}
  </dialog>;
}
export function App() {
  const [progress, setProgress] = useState(loadProgress);
  const [mode, setMode] = useState(null);
  const [optionsCategory, setOptionsCategory] = useState('settings');
  const [isGarden, setIsGarden] = useState(false);
  const [isAdventure, setIsAdventure] = useState(false);
  const [savedAdventure,setSavedAdventure] = useState(readAdventure);
  const [isScores, setIsScores] = useState(false);
  useEffect(() => { flushScores(); }, []);
  const [isSound, setIsSound] = useState(true);
  const [isDecorating, setIsDecorating] = useState(false);
  const [stamp, setStamp] = useState('flower');
  const [galleryIndex, setGalleryIndex] = useState(8);
  const [notice, setNotice] = useState('今天，邀请家人来花园开派对吧！');
  const [isSaved, setIsSaved] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [photo, setPhoto] = useState(null);
  const isExportingRef = useRef(false);
  const isStartingAdventureRef = useRef(false);
  const soundContext = useRef(null);
  const noticeTimer = useRef(null);
  const questReturnMode = useRef(null);
  const achievements = earnedQuests(progress);
  const completed = quests.map(({ id }) => achievements[id]);
  const total = completed.filter(Boolean).length;
  const next = quests.find((_, i) => !completed[i]);
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(progress)); setIsSaved(true); }
    catch { setIsSaved(false); }
  }, [progress]);
  useEffect(() => () => { clearTimeout(noticeTimer.current); window.speechSynthesis?.cancel(); soundContext.current?.close(); }, []);
  function chime(isFinish = false) {
    if (!isSound) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      soundContext.current ||= new Audio();
      const context = soundContext.current;
      context.resume();
      (isFinish ? [523, 659, 784] : [660]).forEach((frequency, i) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'sine'; oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, context.currentTime + i * 0.12);
        gain.gain.linearRampToValueAtTime(0.045, context.currentTime + i * 0.12 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + i * 0.12 + 0.35);
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.start(context.currentTime + i * 0.12); oscillator.stop(context.currentTime + i * 0.12 + 0.4);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      });
    } catch { /* 声音不可用时，文字提示仍可完成游戏。 */ }
  }
  function tell(text) {
    setNotice(text); clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice('慢慢来，每一个小发现都很棒。'), 6500);
  }
  function openQuest(id) {
    if (!quests.some(quest => quest.id === mode)) questReturnMode.current = ['mini-games', 'collection'].includes(mode) ? mode : null;
    setProgress(p => {
      const saved = p.miniGames?.[id];
      return { ...p, achievements: earnedQuests(p), miniGames: { ...p.miniGames, [id]: saved && !isMiniComplete(saved) ? saved : createMiniSession(id) } };
    });
    setMode(id);
    window.speechSynthesis?.cancel();
  }
  function saveMiniSession(session) {
    const updated = { ...progress, miniGames: { ...progress.miniGames, [session.id]: session } };
    updated.achievements = earnedQuests(updated);
    // 每次有效操作立即落盘，关闭窗口也不丢最后一步。
    try { localStorage.setItem(storageKey, JSON.stringify(updated)); setIsSaved(true); }
    catch { setIsSaved(false); }
    setProgress(updated);
  }
  function closeModal() { setMode(null); window.speechSynthesis?.cancel(); }
  function placeStamp(event) {
    if (!isDecorating || event.target.closest('button')) return;
    if (progress.stamps.length >= 40) { tell('花园已经满满当当啦！可以撤回一张再贴。'); return; }
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.max(5, Math.min(95, (event.clientX - bounds.left) / bounds.width * 100));
    const y = Math.max(5, Math.min(95, (event.clientY - bounds.top) / bounds.height * 100));
    setProgress(p => ({ ...p, stamps: [...p.stamps, { type: stamp, x, y }] })); chime();
  }
  async function saveGarden() {
    if (isExportingRef.current) return;
    isExportingRef.current = true; setIsExporting(true);
    tell('正在把花园装进照片里……');
    const canvas = document.createElement('canvas'); canvas.width = 1536; canvas.height = 1124;
    const context = canvas.getContext('2d');
    async function load(path) { const image = new Image(); image.src = asset(path); await image.decode(); return image; }
    try {
      const [garden, family, flowerImage] = await Promise.all([load('assets/garden.png'), load('assets/family.png'), load('assets/flower.png')]);
      context.fillStyle = '#fff9ef'; context.fillRect(0, 0, 1536, 1124); context.drawImage(garden, 0, 0, 1536, 1024);
      context.drawImage(family, 310, 610, 460, 307);
      for (const item of progress.stamps) {
        const x = item.x / 100 * 1536, y = item.y / 100 * 1024;
        if (item.type === 'flower') context.drawImage(flowerImage, x - 40, y - 40, 80, 80);
        else {
          const element = document.querySelector(`[data-stamp-type="${item.type}"] svg`);
          if (element) {
            const copy = element.cloneNode(true);
            copy.removeAttribute('xmlns');
            copy.style.color = { heart: '#d5799a', star: '#d6b54e', butterfly: '#9d8ab5' }[item.type];
            const markup = new XMLSerializer().serializeToString(copy);
            const image = new Image(); image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
            await image.decode(); context.drawImage(image, x - 30, y - 30, 60, 60);
          }
        }
      }
      context.fillStyle = '#515039'; context.textAlign = 'center'; context.font = '36px sans-serif'; context.fillText('我的花园王国  一家人在一起，就是最好的魔法', 768, 1084);
      setPhoto(canvas.toDataURL('image/png')); setMode('photo'); tell('花园照片做好啦！');
    } catch (error) { console.warn('保存花园失败', error); tell('照片还没准备好，请再试一次。'); }
    finally { isExportingRef.current = false; setIsExporting(false); }
  }
  const isHomePage = ['options', 'mini-games', 'gallery', 'collection'].includes(mode);
  const activeQuest = quests.find(q => q.id === mode);
  if (activeQuest) return <Suspense fallback={<div className="loading-adventure">正在打开小冒险…</div>}><MiniGame session={progress.miniGames[activeQuest.id]} onChange={saveMiniSession} onExit={() => { setMode(questReturnMode.current); window.speechSynthesis?.cancel(); }} onReplay={() => openQuest(activeQuest.id)} isSound={isSound} onSound={() => { setIsSound(!isSound); window.speechSynthesis?.cancel(); }} onChime={chime} isSaved={isSaved} /></Suspense>;
  if (isScores) return <Suspense fallback={<div className="loading-adventure">正在翻开成绩本…</div>}><ScoreHistory onClose={() => setIsScores(false)} /></Suspense>;
  if (isAdventure) return <Suspense fallback={<div className="loading-adventure">正在打开彩笔世界…</div>}><PlatformGame initialSound={isSound} onExit={() => { setIsAdventure(false); setSavedAdventure(readAdventure()); }} /></Suspense>;
  return <div className={isGarden ? 'app-shell' : 'app-shell home-shell'}>
    <DesktopRestState />
    <div hidden={isHomePage}>
    {!isGarden ? <HomeMenu savedAdventure={savedAdventure} isActive={!mode}
      onAdventure={() => { window.speechSynthesis?.cancel(); setIsAdventure(true); }}
      onNewAdventure={() => { isStartingAdventureRef.current = false; setMode('new-adventure'); }}
      onMiniGames={() => setMode('mini-games')}
      onOptions={() => setMode('options')} /> : <>
    <header className="garden-return"><h1>我的花园</h1><button className="quiet-button" onClick={() => { setIsGarden(false); setIsDecorating(false); }}><Icon as={ArrowLeft} size={20} />返回主菜单</button></header>
    <main>
      <section className={`world-frame ${isDecorating ? 'is-decorating' : ''}`} aria-label="花园王国游玩场景">
        <div className="world" onClick={placeStamp}>
          <img className="world-art" src={asset('assets/garden.png')} alt="彩笔画的花园：蓝色尖顶、粉色和青绿的城堡，彩虹、大花朵和绿草地" draggable="false" />
          <div className="world-top"><span className="place-label"><Icon as={Flag} size={18} />我的花园</span><button className="world-help" onClick={() => setMode('help')} aria-label="怎么玩"><span>?</span></button></div>
          {!isDecorating && <div className="invitation"><span className="eyebrow">今天的小心愿</span><h2>{total === 3 ? '花园派对开始啦！' : '一起准备花园派对'}</h2><p>{total === 3 ? '花开了，彩虹也来了。\n和最爱的家人一起庆祝吧！' : '找找颜色，照顾小花，\n还有甜甜的冰淇淋等着你。'}</p><button className="primary-button" onClick={() => total === 3 ? setMode('party') : openQuest(next.id)}><Icon as={total === 3 ? Heart : Play} size={20} weight="fill" />{total === 3 ? '去开派对' : total ? '继续冒险' : '开始冒险'}<Icon as={ArrowRight} size={20} /></button><span className="gentle-note">不着急，按自己的节奏玩</span></div>}
          <img className={`world-family ${total === 3 ? 'dancing' : ''}`} src={asset('assets/family.png')} alt="手牵手的爸爸、妈妈和两个小女孩" draggable="false" />
          {!isDecorating && <><button className="map-hotspot rainbow-hotspot" onClick={() => openQuest('rainbow')} aria-label="去找回彩虹"><Icon as={completed[0] ? Check : Sparkle} size={20} /><span>{completed[0] ? '彩虹回来啦' : '找找彩虹'}</span></button><button className="map-hotspot flower-hotspot" onClick={() => openQuest('garden')} aria-label="去照顾花朵"><Icon as={completed[1] ? Check : Drop} size={20} /><span>{completed[1] ? '小花开啦' : '小花口渴啦'}</span></button><button className="map-hotspot treat-hotspot" onClick={() => openQuest('treat')} aria-label="去甜蜜分享"><Icon as={completed[2] ? Check : IceCream} size={20} /><span>{completed[2] ? '甜甜的一家人' : '甜蜜小屋'}</span></button></>}
          {progress.stamps.map((item, i) => <div className={`placed-stamp stamp-${item.type}`} key={i} style={{ left: `${item.x}%`, top: `${item.y}%` }} data-stamp-type={item.type}><Stamp type={item.type} /></div>)}
          {isDecorating && <div className="decorate-instruction">选一张贴纸，再点花园里的空地方</div>}
        </div>
        <div className="world-bottom"><div className="guide"><Icon as={Heart} size={23} /><span aria-live="polite">{notice}</span></div><button className={`decorate-toggle ${isDecorating ? 'active' : ''}`} onClick={() => setIsDecorating(!isDecorating)}><Icon as={isDecorating ? Check : PaintBrush} size={22} />{isDecorating ? '装饰好啦' : '装饰花园'}</button></div>
      </section>
      {isDecorating ? <section className="sticker-tools" aria-label="花园贴纸"><span>我的贴纸</span>{[['flower', '小花'], ['heart', '爱心'], ['star', '星星'], ['butterfly', '蝴蝶']].map(([type, name]) => <button key={type} aria-label={`${name}贴纸`} aria-pressed={stamp === type} className={`sticker-choice stamp-${type} ${stamp === type ? 'selected' : ''}`} onClick={() => setStamp(type)} data-stamp-type={type}><Stamp type={type} /><span>{name}</span></button>)}<button className="quiet-button" disabled={!progress.stamps.length} onClick={() => setProgress(p => ({ ...p, stamps: p.stamps.slice(0, -1) }))}><Icon as={ArrowCounterClockwise} />撤回</button><button className="quiet-button" disabled={isExporting} onClick={saveGarden}><Icon as={DownloadSimple} />{isExporting ? "保存中……" : "保存花园"}</button></section> : <section className="quest-list" aria-label="三个小冒险">{quests.map((quest, i) => <button className={`quest-card ${quest.color} ${completed[i] ? 'complete' : ''}`} key={quest.id} onClick={() => openQuest(quest.id)}><span className="quest-icon"><Icon as={quest.icon} size={34} /></span><span className="quest-copy"><small>小冒险 0{i + 1}</small><strong>{quest.title}</strong><span>{completed[i] ? '做得真棒，再玩一次' : quest.hint}</span></span><span className="quest-arrow"><Icon as={completed[i] ? Check : ArrowRight} size={22} /></span></button>)}</section>}
      <footer><span><Icon as={Heart} size={16} />灵感来自一位 6 岁小画家的 11 幅画</span><span>{isSaved ? '小心愿会自动记住' : '这次进度暂时无法保存'}<span className="footer-divider">/</span><button onClick={() => setMode('reset')}>重新开始</button></span></footer>
    </main>
    </>}
    </div>
    {mode === 'options' && <HomePage title="选项" onBack={closeModal} className="home-options">
      <div className="home-options-layout">
        <nav className="home-options-categories" aria-label="选项分类">
          {[["settings", "游戏设置"], ["collection", "作品与成绩"], ["saves", "存档管理"]].map(([id, label]) => <button key={id} aria-pressed={optionsCategory === id} onClick={() => setOptionsCategory(id)}>{label}</button>)}
        </nav>
        {optionsCategory === 'settings' && <section className="home-options-grid" aria-label="游戏设置">
          <button className="quiet-button" aria-pressed={isSound} onClick={() => { setIsSound(!isSound); window.speechSynthesis?.cancel(); }}><Icon as={isSound ? SpeakerHigh : SpeakerSlash} />声音{isSound ? '开' : '关'}</button>
          <DesktopActions />
        </section>}
        {optionsCategory === 'collection' && <section className="home-options-grid" aria-label="作品与成绩">
          <button className="quiet-button" onClick={() => setIsScores(true)}><Icon as={Trophy} />我的成绩本</button>
          <button className="quiet-button" onClick={() => setMode('gallery')}><Icon as={Images} />小小画展</button>
          <button className="quiet-button" onClick={() => setMode('collection')}><Icon as={Star} />我的小成就</button>
        </section>}
        {optionsCategory === 'saves' && <section className="home-options-grid" aria-label="存档管理">
          <GardenBackup progress={progress} onImport={setProgress} />
        </section>}
      </div>
    </HomePage>}
    {mode === 'mini-games' && <HomePage title="小游戏" onBack={closeModal} className="home-games">
      <div className="quest-list">{quests.map((quest, i) => <button className={`quest-card ${quest.color}`} key={quest.id} onClick={() => openQuest(quest.id)}><span className="quest-icon"><Icon as={quest.icon} size={34} /></span><span className="quest-copy"><strong>{quest.title}</strong><span>{completed[i] ? '再来一次' : quest.hint}</span></span><Icon as={ArrowRight} size={22} /></button>)}</div>
      <button className="quiet-button" onClick={() => { closeModal(); setIsGarden(true); }}><Icon as={Flower} />我的花园</button>
    </HomePage>}
    {mode === 'new-adventure' && <Modal title="开始新的跳台探险？" onClose={closeModal}>
      <p className="modal-subtitle">当前探险会结束，成绩保留。重新选择角色，从第一小关出发。</p>
      <div className="reset-actions"><button className="quiet-button" onClick={closeModal}>继续现在的冒险</button><button className="primary-button" onClick={() => {
        if (!savedAdventure || isStartingAdventureRef.current) return;
        isStartingAdventureRef.current = true;
        queueRun({ ...savedAdventure.run, status: 'ended', revision: savedAdventure.run.revision + 1 });
        clearAdventure(); setSavedAdventure(null); closeModal(); setIsAdventure(true);
      }}>开始新冒险</button></div>
    </Modal>}
    {!isSaved && <p role="alert" className="home-save-warning">这次进度暂时无法保存，请先到选项备份花园。</p>}
    {mode === 'photo' && <Modal title="我的花园照片" onClose={closeModal} className="gallery-modal"><p className="modal-subtitle">把今天的快乐留在照片里。</p><img className="garden-photo" src={photo} alt="包含家人和贴纸的花园照片" /><div className="photo-actions"><a className="primary-button" href={photo} download="我的花园王国.png"><Icon as={DownloadSimple} />下载图片</a><span>也可以长按或右键图片保存</span></div></Modal>}
    {mode === 'gallery' && <HomePage title="小小画家的画展" onBack={() => setMode('options')} backLabel="返回选项" className="home-gallery"><p className="modal-subtitle">每个奇妙的故事，都从一张画开始。</p><div className="artwork-view"><img src={asset(`artworks/${galleryIndex + 1}.jpg`)} className={turns[galleryIndex] ? 'rotated-art' : ''} style={{ transform: `translate(-50%, -50%) rotate(${turns[galleryIndex]}deg)` }} alt={artworkNames[galleryIndex]} /></div><div className="gallery-controls"><button className="icon-button" aria-label="上一幅画" onClick={() => setGalleryIndex((galleryIndex + 10) % 11)}><Icon as={ArrowLeft} /></button><div><strong>{artworkNames[galleryIndex]}</strong><span>{galleryIndex + 1} / 11</span></div><button className="icon-button" aria-label="下一幅画" onClick={() => setGalleryIndex((galleryIndex + 1) % 11)}><Icon as={ArrowRight} /></button></div></HomePage>}
    {mode === 'collection' && <HomePage title="我的小成就" onBack={() => setMode('options')} backLabel="返回选项" className="home-collection"><p className="modal-subtitle">每一次用心，都值得被记住。</p><div className="achievement-list">{quests.map((q, i) => <button key={q.id} onClick={() => openQuest(q.id)} className={completed[i] ? 'earned' : ''}><Icon as={q.icon} size={48} /><strong>{q.reward}</strong><span>{completed[i] ? '已经收集到啦' : '去玩一玩'}</span></button>)}</div><p className="game-counter">已经收集 {total} / 3 份小成就</p></HomePage>}
    {mode === 'party' && <Modal title="一家人在一起，就是最好的魔法" onClose={closeModal} className="party-modal"><Icon as={Heart} className="party-heart" size={52} weight="fill" /><p className="modal-subtitle">谢谢你，让花园变得这么温暖！</p><img src={asset('assets/family.png')} alt="一家四口手牵手庆祝" className="party-family dancing" /><div className="party-badges">{quests.map(q => <span key={q.id}><Icon as={q.icon} />{q.reward}</span>)}</div><button className="primary-button" onClick={() => { closeModal(); setIsDecorating(true); tell('把花园装饰成你喜欢的样子吧！'); }}><Icon as={PaintBrush} />一起装饰花园</button><button className="text-button" onClick={closeModal}>再逛一会儿</button></Modal>}
    {mode === 'help' && <Modal title="小小冒险家，这样玩" onClose={closeModal}><div className="help-list"><p><Icon as={Play} />点“开始冒险”，或者选下面的小冒险。</p><p><Icon as={SpeakerHigh} />点小喇叭，就能听玩法。</p><p><Icon as={PaintBrush} />点“装饰花园”，把贴纸放到喜欢的位置。</p><p><Icon as={Heart} />没有倒计时，点错也没关系。</p></div><button className="primary-button" onClick={closeModal}>我知道啦<Icon as={Check} /></button></Modal>}
    {mode === 'reset' && <Modal title="再来一次小冒险？" onClose={closeModal}><p className="modal-subtitle">会清空这次的小成就和花园贴纸，原画会好好保留。</p><div className="reset-actions"><button className="quiet-button" onClick={closeModal}>继续现在的冒险</button><button className="primary-button" onClick={() => { setProgress({ ...emptyProgress, stamps: [] }); setIsDecorating(false); closeModal(); tell('新的一天开始啦！一起准备花园派对吧。'); }}>重新开始</button></div></Modal>}
  </div>;
}
