import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, House, Play } from '@phosphor-icons/react';
import { PLAYABLE_WORLDS, findStage } from '../../shared/levels.js';
import { COLLECTIBLES, LEVEL_COLLECTIBLES } from './collectibles.js';
import { CHARACTERS, INITIAL_LIVES } from './characters.js';
import { DIFFICULTIES, difficultyOf, setPlaySettings, usePlaySettings } from './difficulty.js';
import { readWorldAdventures } from './save.js';
import { trapFocus } from './AdventurePanels.jsx';

function worldChoices(saves) {
  return PLAYABLE_WORLDS.flatMap(level => {
    const entries = saves.filter(({ run }) => findStage(run.levelId)?.themeId === level.themeId);
    if (!entries.length) return [{ key: level.id, level }];
    return entries.map(saved => ({ key: saved.run.id, level: findStage(saved.run.levelId), saved }));
  });
}

const routeHints = {
  'flower-valley': '河对岸就是城堡。站上水槽，看一看花园里有什么变化。',
  'clock-tower': '搭上会摆动的指针，到窗台敲钟，再去镇广场。',
  'snow-chutes': '雪球能撞开冰墙。沿山脊追过去，看看岔路藏着什么。',
  'forest-rescue': '沿枝头找树冠幼鸟，钻进树洞找树根幼鸟。带它们回巢后，守住大树。',
};
function progressLabel(saved) {
  if (saved.state.survival.phase === 'over' || saved.state.isCompleted && !saved.state.journey.pending) return '查看结算';
  return '继续这一关';
}

export function WorldPicker({ levelIndex, isSwitching, freshOnly, isGamepad, onChoose, onBack }) {
  const [choices] = useState(() => worldChoices(freshOnly ? [] : readWorldAdventures()));
  const [marked, setMarked] = useState(() => choices.findIndex(choice => choice.level.worldIndex === levelIndex));
  const [error, setError] = useState('');
  const menu = useRef(null);
  const settings = usePlaySettings();
  const { level, saved } = choices[marked];
  useEffect(() => {
    const button = menu.current.querySelector('.level-choices [aria-pressed=true]');
    button.focus({ preventScroll: true });
    button.scrollIntoView({ block: 'nearest' });
  }, []);
  function choose(choice) {
    if (!onChoose(choice)) setError('本机空间不足，进度暂时存不下。请腾出空间后再试一次。');
  }
  return <div className="adventure-overlay"><section className="adventure-menu level-menu" ref={menu} role="dialog" aria-modal="true" aria-labelledby="world-heading" onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (!event.repeat) onBack(); }
    else trapFocus(event);
  }}>
    <span className="adventure-kicker">带着画里的自己，去看更大的世界</span>
    <h2 id="world-heading">{isSwitching ? '想去哪个世界？' : '选一个小世界，出发吧'}</h2>
    <div className="level-choices" aria-label="选择挑战关卡">{choices.map((choice, index) =>
      <button key={choice.key} data-world={choice.level.themeId} aria-pressed={index === marked} onFocus={() => setMarked(index)} onClick={() => choose(choice)}>
        <img src={`./assets/${choice.level.image}.png`} alt={choice.level.subtitle}/>
        <span>第 {choice.level.worldIndex + 1} 个世界</span><strong>{choice.level.chapterName}</strong><small>{choice.level.name}</small>
        <small>{choice.saved ? `${progressLabel(choice.saved)} · ${CHARACTERS[choice.saved.state.survival.character].name} · 第 ${choice.saved.state.rooms.path.length} 段` : `通关加 ${choice.level.bonus} 分`}</small>
      </button>)}</div>
    <p className="level-source">{level.sources.length ? `这一关组合了原画 ${level.sources.join('、')} 的元素。` : level.story}</p>
    <div className="collectible-preview" aria-label="这一关的宝物">{LEVEL_COLLECTIBLES[level.themeId].map(id =>
      <span key={id}><img src={`./assets/${COLLECTIBLES[id].image}.png`} alt=""/>{COLLECTIBLES[id].name} <b>{COLLECTIBLES[id].points} 分</b></span>)}</div>
    {saved ? <p>{progressLabel(saved)} · 第 {saved.state.adventure.cycle || 1} 轮 · {difficultyOf(saved.state.adventure.difficulty).name} · 剩 {saved.state.survival.lives} 条命</p>
      : <div className="difficulty-row"><span>难度</span><div className="option-chips" aria-label="难度" data-gamepad-tabs="换难度">{Object.entries(DIFFICULTIES).map(([id, item]) =>
        <button key={id} aria-pressed={settings.difficulty === id} onClick={() => setPlaySettings({ difficulty: id })}>{item.name}</button>)}</div><small>{DIFFICULTIES[settings.difficulty].hint}。出发后这次冒险不能换。</small></div>}
    {!isGamepad && <div className="key-guide"><span><kbd>A</kbd><kbd>D</kbd> 走一走</span><span><kbd>空格</kbd> 跳起来</span><span><kbd>J</kbd><kbd>K</kbd><kbd>L</kbd> 武器和大招</span><span><kbd>W</kbd> 在小店买</span></div>}
    <small className="game-reassurance">{saved ? '地图和宝物都记着，回来可以接着玩。' : <>{level.structure === 'field-journey' ? level.story : routeHints[level.structure] || '一章是四间房加一场首领。清完一间，跳到发光的门上。'}初始 {INITIAL_LIVES} 条命，血条用完后选继续或重来。</>}</small>
    {error && <p role="alert">{error}</p>}
    <div className="adventure-menu-actions">
      <button className="primary-button" onClick={() => choose(choices[marked])}><Play size={21} weight="fill"/>{saved ? progressLabel(saved) : '选择角色'}<ArrowRight size={21}/></button>
      <button className="text-button" data-gamepad-back onClick={onBack}>{isSwitching ? <><ArrowLeft size={18}/>回到暂停</> : <><House size={18}/>回到我的花园</>}</button>
    </div>
  </section></div>;
}
