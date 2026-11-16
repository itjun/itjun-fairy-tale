import { SpeakerHigh, SpeakerSlash, Trophy, Images, Star, HandHeart, Lightning, Gauge } from '@phosphor-icons/react';
import { HomePage } from './HomePage.jsx';
import { DesktopActions } from './DesktopActions.jsx';
import { DesktopBackups } from './DesktopBackups.jsx';
import { GardenBackup } from './GardenBackup.jsx';
import { GamepadSettings } from './input/GamepadSupport.jsx';
import { DIFFICULTIES, usePlaySettings, setPlaySettings } from './game/difficulty.js';

const CATEGORIES = [['game', '游戏'], ['pad', '手柄'], ['window', '窗口'], ['works', '作品与成绩'], ['saves', '存档']];

// 选项页在首页和暂停时共用。暂停时只留游戏、手柄、窗口三类，难度只读。
export function OptionsPage({ category, onCategory, onBack, backLabel, isSound, onSound, runDifficulty, progress, onImport, onScores, onGallery, onCollection }) {
  const settings = usePlaySettings();
  const isInGame = !!runDifficulty;
  const categories = isInGame ? CATEGORIES.slice(0, 3) : CATEGORIES;
  return <HomePage title="选项" onBack={onBack} backLabel={backLabel} className={`home-options${isInGame ? ' in-game-page' : ''}`}>
    <div className="home-options-layout">
      <nav className="home-options-categories" aria-label="选项分类" data-gamepad-tabs="换分类">
        {categories.map(([id, label]) => <button key={id} aria-pressed={category === id} onClick={() => onCategory(id)}>{label}</button>)}
      </nav>
      {category === 'game' && <section className="home-options-grid" aria-label="游戏">
        <div className="option-row"><Gauge size={28} /><span>难度</span>{isInGame
          ? <b>{DIFFICULTIES[runDifficulty].name}</b>
          : <div className="option-chips">{Object.entries(DIFFICULTIES).map(([id, item]) => <button key={id} aria-pressed={settings.difficulty === id} onClick={() => setPlaySettings({ difficulty: id })}>{item.name}</button>)}</div>}</div>
        <button className="quiet-button" aria-pressed={settings.isHelpOn} onClick={() => setPlaySettings({ isHelpOn: !settings.isHelpOn })}><HandHeart />帮一把：{settings.isHelpOn ? '开' : '关'}</button>
        <button className="quiet-button" aria-pressed={settings.isAutoSpell} onClick={() => setPlaySettings({ isAutoSpell: !settings.isAutoSpell })}><Lightning />大招满了自动放：{settings.isAutoSpell ? '开' : '关'}</button>
        <button className="quiet-button" aria-pressed={isSound} onClick={onSound}>{isSound ? <SpeakerHigh /> : <SpeakerSlash />}声音：{isSound ? '开' : '关'}</button>
        <p className="option-note">{isInGame ? '难度在出发前选，这次冒险不能换。' : `${DIFFICULTIES[settings.difficulty].hint}。下一次出发时用这个难度。`}帮一把打开时，同一间房里倒下两次会送一层护盾。</p>
      </section>}
      {category === 'pad' && <section className="home-options-grid" aria-label="手柄"><GamepadSettings /></section>}
      {category === 'window' && <section className="home-options-grid" aria-label="窗口">
        {window.gardenDesktop ? <DesktopActions /> : <p className="option-note">网页版没有窗口设置。全屏请用浏览器自己的按钮。</p>}
      </section>}
      {category === 'works' && <section className="home-options-grid" aria-label="作品与成绩">
        <button className="quiet-button" onClick={onScores}><Trophy />我的成绩本</button>
        <button className="quiet-button" onClick={onGallery}><Images />小小画展</button>
        <button className="quiet-button" onClick={onCollection}><Star />我的小成就</button>
      </section>}
      {category === 'saves' && <section className="home-options-grid" aria-label="存档">
        {window.gardenDesktop ? <DesktopBackups progress={progress} onImport={onImport} /> : <GardenBackup progress={progress} onImport={onImport} />}
      </section>}
    </div>
  </HomePage>;
}
