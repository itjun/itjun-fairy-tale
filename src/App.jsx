import { lazy, Suspense } from 'react';
import { DesktopActions } from './DesktopActions.jsx';
import { GardenBackup } from './GardenBackup.jsx';
import { flushScores } from './scores/client.js';
const ScoreHistory = lazy(() => import('./scores/ScoreHistory.jsx').then(module => ({ default: module.ScoreHistory })));
const PlatformGame = lazy(() => import('./game/PlatformGame.jsx').then(module => ({ default: module.PlatformGame })));
import { useEffect, useRef, useState } from 'react';
import { Flower, Rainbow, IceCream, Heart, Star, Sparkle, ArrowRight, ArrowLeft, SpeakerHigh, SpeakerSlash, X, Check, House, Images, PaintBrush, ArrowCounterClockwise, DownloadSimple, Play, Drop, Sun, Flag, Butterfly, Trophy } from '@phosphor-icons/react';

const asset = (path) => window.__GAME_ASSETS__?.[path] || `./${path}`;
const colors = [
  { name: '红色', hex: '#e95666' }, { name: '橙色', hex: '#f4a34c' },
  { name: '黄色', hex: '#e8c949' }, { name: '绿色', hex: '#88b768' },
  { name: '蓝色', hex: '#62abc9' }, { name: '紫色', hex: '#9c81bb' },
];
const quests = [
  { id: 'rainbow', title: '找回彩虹', hint: '和颜色捉迷藏', icon: Rainbow, color: 'pink', reward: '彩虹魔法师' },
  { id: 'garden', title: '照顾花朵', hint: '让小花开开心心', icon: Flower, color: 'green', reward: '花园小园丁' },
  { id: 'treat', title: '甜蜜分享', hint: '给家人做冰淇淋', icon: IceCream, color: 'blue', reward: '甜心分享家' },
];
const artworkNames = ['爱心花园', '绿色小城堡', '我们在一起', '阳光下的小家', '粉色城堡', '彩虹花园王国', '幸福的一家人', '蓝色大城堡', '我的花园王国', '超级冰淇淋', '高高的城堡'];
const turns = [-90, -90, -90, -90, 90, 90, -90, -90, 0, 0, 0];
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
  const [isAdventure, setIsAdventure] = useState(false);
  const [isScores, setIsScores] = useState(false);
  useEffect(() => { flushScores(); }, []);
  const [isSound, setIsSound] = useState(true);
  const [isDecorating, setIsDecorating] = useState(false);
  const [stamp, setStamp] = useState('flower');
  const [galleryIndex, setGalleryIndex] = useState(8);
  const [flavor, setFlavor] = useState(null);
  const [notice, setNotice] = useState('今天，邀请家人来花园开派对吧！');
  const [feedback, setFeedback] = useState('');
  const [isSaved, setIsSaved] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [photo, setPhoto] = useState(null);
  const isExportingRef = useRef(false);
  const soundContext = useRef(null);
  const noticeTimer = useRef(null);
  const completed = [progress.rainbow === 6, progress.flowers.every(v => v === 2), progress.served.every(Boolean)];
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
  function speak(text, isRequested = false) {
    if ((!isSound && !isRequested) || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN'; utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
  }
  function tell(text) {
    setNotice(text); clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice('慢慢来，每一个小发现都很棒。'), 6500);
  }
  function openQuest(id) {
    setFeedback(''); setFlavor(null); setMode(id);
    const text = { rainbow: '彩虹想找回六种颜色。跟着提示，点一点彩色爱心吧。', garden: '小花口渴啦。先给每朵花浇水，再送它一点阳光。', treat: '选一个冰淇淋口味，再点一位家人，分享甜甜的快乐。' }[id];
    speak(text);
  }
  function closeModal() { setMode(null); window.speechSynthesis?.cancel(); }
  function pickColor(index) {
    if (progress.rainbow >= 6) return;
    if (index !== progress.rainbow) { setFeedback(`这是${colors[index].name}。再找找${colors[progress.rainbow].name}吧！`); speak(`再找找${colors[progress.rainbow].name}吧`); return; }
    setProgress(p => ({ ...p, rainbow: p.rainbow + 1 }));
    setFeedback(`${colors[index].name}找到啦！`); chime(index === 5);
    if (index === 5) speak('彩虹回来啦！你是彩虹魔法师！');
  }
  function careForFlower(index) {
    if (progress.flowers[index] === 2) return;
    const step = progress.flowers[index];
    setProgress(p => ({ ...p, flowers: p.flowers.map((v, i) => i === index ? v + 1 : v) }));
    setFeedback(step === 0 ? '咕噜咕噜，谢谢你！再送我一点阳光吧。' : '小花开了！你把花园照顾得真好。');
    chime(step === 1);
  }
  function serve(index) {
    if (progress.served[index]) return;
    if (flavor === null) { setFeedback('先点一个你喜欢的口味吧。'); return; }
    setProgress(p => ({ ...p, served: p.served.map((v, i) => i === index ? true : v) }));
    setFeedback(`${['爸爸', '妈妈', '姐姐', '妹妹'][index]}说：谢谢你，${['草莓', '蓝莓', '芒果'][flavor]}味真好吃！`);
    setFlavor(null); chime(true);
  }
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
  const activeQuest = quests.find(q => q.id === mode);
  const isQuestComplete = activeQuest && completed[quests.indexOf(activeQuest)];
  if (isScores) return <Suspense fallback={<div className="loading-adventure">正在翻开成绩本…</div>}><ScoreHistory onClose={() => setIsScores(false)} /></Suspense>;
  if (isAdventure) return <Suspense fallback={<div className="loading-adventure">正在打开彩笔世界…</div>}><PlatformGame initialSound={isSound} onExit={() => setIsAdventure(false)} /></Suspense>;
  return <div className="app-shell">
    <header className="header">
      <a className="brand" href="#" aria-label="花园王国首页" onClick={e => { e.preventDefault(); closeModal(); setIsDecorating(false); }}><span className="brand-icon"><Icon as={Flower} size={34} /></span><span>花园王国<small>一个小画家的奇妙世界</small></span></a>
      <div className="header-actions"><button className="quiet-button" onClick={() => setIsScores(true)}><Icon as={Trophy} size={21} />我的成绩本</button><button className="quiet-button" onClick={() => setMode('gallery')}><Icon as={Images} size={21} />小小画展</button><button className="sound-button" aria-label={isSound ? '关闭声音' : '打开声音'} aria-pressed={isSound} onClick={() => { setIsSound(!isSound); window.speechSynthesis?.cancel(); }}><Icon as={isSound ? SpeakerHigh : SpeakerSlash} size={23} /><span>声音{isSound ? '开' : '关'}</span></button></div>
    </header>
    <DesktopActions />
    <main>
      <section className="intro"><div><div className="intro-note"><Icon as={Sun} size={20} />今天也是适合冒险的一天</div><h1>欢迎来到<span>花园王国</span></h1><p>和家人一起，把画里的小小心愿变成真的。</p></div><button className="collection" onClick={() => setMode('collection')}><span className="collection-icons">{quests.map((q, i) => <Icon key={q.id} as={q.icon} size={29} className={completed[i] ? 'earned' : ''} />)}</span><span>我的小成就 <b>{total} / 3</b></span></button></section>
      <section className="adventure-launch"><img src="./assets/girl-player.png" alt="粉裙小画家" /><div><h2>彩笔跳台探险</h2><p>八个小世界，随机跳台。从童话城堡出发，去海边、森林和雪地找宝物。</p></div><button className="primary-button" onClick={() => { window.speechSynthesis?.cancel(); setIsAdventure(true); }}><Icon as={Play} weight="fill" />去跳台探险<Icon as={ArrowRight} size={20} /></button></section>
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
      {isDecorating ? <section className="sticker-tools" aria-label="花园贴纸"><span>我的贴纸</span>{[['flower', '小花'], ['heart', '爱心'], ['star', '星星'], ['butterfly', '蝴蝶']].map(([type, name]) => <button key={type} aria-label={`${name}贴纸`} aria-pressed={stamp === type} className={`sticker-choice stamp-${type} ${stamp === type ? 'selected' : ''}`} onClick={() => setStamp(type)} data-stamp-type={type}><Stamp type={type} /><span>{name}</span></button>)}<button className="quiet-button" disabled={!progress.stamps.length} onClick={() => setProgress(p => ({ ...p, stamps: p.stamps.slice(0, -1) }))}><Icon as={ArrowCounterClockwise} />撤回</button><button className="quiet-button" disabled={isExporting} onClick={saveGarden}><Icon as={DownloadSimple} />{isExporting ? "保存中……" : "保存花园"}</button></section> : <section className="quest-list" aria-label="三个小冒险">{quests.map((quest, i) => <button className={`quest-card ${quest.color} ${completed[i] ? 'complete' : ''}`} key={quest.id} onClick={() => openQuest(quest.id)}><span className="quest-icon"><Icon as={quest.icon} size={34} /></span><span className="quest-copy"><small>小冒险 0{i + 1}</small><strong>{quest.title}</strong><span>{completed[i] ? '做得真棒，可以再看看' : quest.hint}</span></span><span className="quest-arrow"><Icon as={completed[i] ? Check : ArrowRight} size={22} /></span></button>)}</section>}
      <footer><span><Icon as={Heart} size={16} />灵感来自一位 6 岁小画家的 11 幅画</span><span>{isSaved ? '小心愿会自动记住' : '这次进度暂时无法保存'}<span className="footer-divider">/</span><button onClick={() => setMode('reset')}>重新开始</button></span></footer>
      <GardenBackup progress={progress} onImport={setProgress} />
    </main>
    {activeQuest && <Modal title={activeQuest.title} onClose={closeModal} className={`quest-modal ${activeQuest.color}`}>
      <div className="quest-modal-description"><p>{mode === 'rainbow' ? '把六种颜色送回彩虹里。' : mode === 'garden' ? '一口水，一点阳光，小花就会长大。' : '选个口味，再点一位家人，把甜蜜送给他们。'}</p><button className="icon-button" aria-label="听玩法" onClick={() => speak(mode === 'rainbow' ? '请找出' + (colors[progress.rainbow]?.name || '全部颜色，你成功啦') : mode === 'garden' ? '先点水滴给小花浇水，再点太阳送它阳光。' : '先选一个口味，再点一位家人。', true)}><Icon as={SpeakerHigh} /></button></div>
      {mode === 'rainbow' && <div className="rainbow-game"><div className="color-progress">{colors.map((color, i) => <span key={color.name} style={{ color: progress.rainbow > i ? color.hex : '#dedbd1' }}><Icon as={Heart} weight={progress.rainbow > i ? 'fill' : 'regular'} size={39} /></span>)}</div>{!isQuestComplete && <h3>找一找 <span style={{ color: colors[progress.rainbow].hex }}>{colors[progress.rainbow].name}</span> 的爱心</h3>}<div className="color-choices">{[4, 0, 3, 5, 1, 2].map(index => <button key={index} style={{ '--choice': colors[index].hex }} aria-label={`${colors[index].name}爱心`} disabled={index < progress.rainbow} onClick={() => pickColor(index)}><Icon as={index < progress.rainbow ? Check : Heart} weight="fill" size={58} /><span>{colors[index].name}</span></button>)}</div><p className="game-counter">已找到 {progress.rainbow} / 6 种颜色</p></div>}
      {mode === 'garden' && <div className="flower-game">{progress.flowers.map((step, i) => <div className={`flower-pot step-${step}`} key={i}><span className="flower-name">{['小粉', '朵朵', '花花', '小芽'][i]}</span><img src={asset('assets/flower.png')} alt={`第${i + 1}朵小花`} /><button disabled={step === 2} onClick={() => careForFlower(i)} aria-label={`${step === 0 ? '浇水' : step === 1 ? '送阳光' : '已开花'}给${['小粉', '朵朵', '花花', '小芽'][i]}`}><Icon as={step === 0 ? Drop : step === 1 ? Sun : Check} weight="duotone" />{['浇浇水', '晒太阳', '开花啦'][step]}</button></div>)}</div>}
      {mode === 'treat' && <div className="treat-game"><div className="icecream-making"><img className={flavor !== null ? 'icecream-ready' : ''} src={asset('assets/icecream.png')} alt="原画风格的彩色冰淇淋" /><div><h3>{flavor !== null ? '做好啦！送给谁呢？' : '你想做什么口味？'}</h3><div className="flavor-choices">{['草莓', '蓝莓', '芒果'].map((name, i) => <button className={`flavor flavor-${i}`} key={name} aria-pressed={flavor === i} onClick={() => { setFlavor(i); setFeedback(`${name}味冰淇淋做好啦！点一位家人送给他们。`); chime(); }} disabled={isQuestComplete}><Icon as={IceCream} size={27} />{name}{flavor === i && <Icon as={Check} size={18} />}</button>)}</div></div></div><img className="sharing-family" src={asset('assets/family.png')} alt="等着一起吃冰淇淋的一家四口" /><div className="family-choices">{['爸爸', '妈妈', '姐姐', '妹妹'].map((name, i) => <button key={name} disabled={progress.served[i]} onClick={() => serve(i)}>{progress.served[i] && <Icon as={Check} size={18} />}{progress.served[i] ? `${name}收到啦` : `送给${name}`}</button>)}</div></div>}
      <p className="game-feedback" aria-live="polite">{feedback || '点一点，试试看。'}</p>
      {isQuestComplete && <div className="success-panel"><Icon as={activeQuest.icon} size={42} /><div><strong>你是「{activeQuest.reward}」啦！</strong><span>这份小成就，送给温柔又勇敢的你。</span></div><button className="primary-button" onClick={() => { closeModal(); tell(`获得小成就：${activeQuest.reward}！`); if (total === 3) setMode('party'); }}> {total === 3 ? '去开派对' : '回到花园'}<Icon as={ArrowRight} size={18} /></button></div>}
    </Modal>}
    {mode === 'photo' && <Modal title="我的花园照片" onClose={closeModal} className="gallery-modal"><p className="modal-subtitle">把今天的快乐留在照片里。</p><img className="garden-photo" src={photo} alt="包含家人和贴纸的花园照片" /><div className="photo-actions"><a className="primary-button" href={photo} download="我的花园王国.png"><Icon as={DownloadSimple} />下载图片</a><span>也可以长按或右键图片保存</span></div></Modal>}
    {mode === 'gallery' && <Modal title="小小画家的画展" onClose={closeModal} className="gallery-modal"><p className="modal-subtitle">每个奇妙的故事，都从一张画开始。</p><div className="artwork-view"><img src={asset(`artworks/${galleryIndex + 1}.jpg`)} className={turns[galleryIndex] ? 'rotated-art' : ''} style={{ transform: `translate(-50%, -50%) rotate(${turns[galleryIndex]}deg)` }} alt={artworkNames[galleryIndex]} /></div><div className="gallery-controls"><button className="icon-button" aria-label="上一幅画" onClick={() => setGalleryIndex((galleryIndex + 10) % 11)}><Icon as={ArrowLeft} /></button><div><strong>{artworkNames[galleryIndex]}</strong><span>{galleryIndex + 1} / 11</span></div><button className="icon-button" aria-label="下一幅画" onClick={() => setGalleryIndex((galleryIndex + 1) % 11)}><Icon as={ArrowRight} /></button></div></Modal>}
    {mode === 'collection' && <Modal title="我的小成就" onClose={closeModal}><p className="modal-subtitle">每一次用心，都值得被记住。</p><div className="achievement-list">{quests.map((q, i) => <button key={q.id} onClick={() => openQuest(q.id)} className={completed[i] ? 'earned' : ''}><Icon as={q.icon} size={48} /><strong>{q.reward}</strong><span>{completed[i] ? '已经收集到啦' : '去玩一玩'}</span></button>)}</div><p className="game-counter">已经收集 {total} / 3 份小成就</p></Modal>}
    {mode === 'party' && <Modal title="一家人在一起，就是最好的魔法" onClose={closeModal} className="party-modal"><Icon as={Heart} className="party-heart" size={52} weight="fill" /><p className="modal-subtitle">谢谢你，让花园变得这么温暖！</p><img src={asset('assets/family.png')} alt="一家四口手牵手庆祝" className="party-family dancing" /><div className="party-badges">{quests.map(q => <span key={q.id}><Icon as={q.icon} />{q.reward}</span>)}</div><button className="primary-button" onClick={() => { closeModal(); setIsDecorating(true); tell('把花园装饰成你喜欢的样子吧！'); }}><Icon as={PaintBrush} />一起装饰花园</button><button className="text-button" onClick={closeModal}>再逛一会儿</button></Modal>}
    {mode === 'help' && <Modal title="小小冒险家，这样玩" onClose={closeModal}><div className="help-list"><p><Icon as={Play} />点“开始冒险”，或者选下面的小冒险。</p><p><Icon as={SpeakerHigh} />点小喇叭，就能听玩法。</p><p><Icon as={PaintBrush} />点“装饰花园”，把贴纸放到喜欢的位置。</p><p><Icon as={Heart} />没有倒计时，点错也没关系。</p></div><button className="primary-button" onClick={closeModal}>我知道啦<Icon as={Check} /></button></Modal>}
    {mode === 'reset' && <Modal title="再来一次小冒险？" onClose={closeModal}><p className="modal-subtitle">会清空这次的小成就和花园贴纸，原画会好好保留。</p><div className="reset-actions"><button className="quiet-button" onClick={closeModal}>继续现在的冒险</button><button className="primary-button" onClick={() => { setProgress({ ...emptyProgress, stamps: [] }); setIsDecorating(false); closeModal(); tell('新的一天开始啦！一起准备花园派对吧。'); }}>重新开始</button></div></Modal>}
  </div>;
}
