import { useEffect, useRef, useState } from 'react';
import { ArrowsOutCardinal, MapPin } from '@phosphor-icons/react';
import { PLAYABLE_WORLDS, findStage } from '../../shared/levels.js';
import { CHARACTERS } from './characters.js';
import { difficultyOf } from './difficulty.js';
import { readWorldAdventures } from './save.js';
import { ConfirmAction, DeparturePage } from './DeparturePage.jsx';

// Coordinates are percentages of the painted atlas, independent of viewport size.
const LANDMARKS = {
  rainbow: { x: 46.8, y: 48, portraitX: 49.5, portraitY: 41.8, region: '四川盆地', description: '群山环抱花田，江水向东流。' },
  family: { x: 74.7, y: 25.6, portraitX: 74.5, portraitY: 22.4, region: '东部平原', description: '穿过河畔的小镇，找找钟楼。' },
  sweet: { x: 67.8, y: 54.4, portraitX: 68.1, portraitY: 66.7, region: '江南丘陵', description: '顺着起伏的山丘，去城堡做甜点。' },
  beach: { x: 85.5, y: 60.4, portraitX: 82.5, portraitY: 51.4, region: '东海与海岛', description: '沿海岸找贝壳，隔海望见小岛。' },
  meadow: { x: 31.6, y: 24, portraitX: 25.1, portraitY: 22.7, region: '北方草原', description: '翻过草坡，风把风车吹转了。' },
  snow: { x: 54.4, y: 19.6, portraitX: 50, portraitY: 13.1, region: '北方雪山', description: '白雪盖住山脊，山下站着雪人。' },
  forest: { x: 32.5, y: 80.5, portraitX: 27, portraitY: 83.8, region: '南方雨林', description: '循着鸟鸣，走进藤蔓缠绕的雨林。' },
  cartoon: { x: 65, y: 84, portraitX: 74.5, portraitY: 89.1, region: '东南河谷', description: '小火车沿着河谷，开往积木镇。' },
  desert: { x: 16.2, y: 46.8, portraitX: 20.5, portraitY: 49.4, region: '西部沙漠', description: '从敦煌石窟到绿洲，一排排小树挡住风沙。' },
};

function resumeLabel(saved) {
  if (saved.state.survival.phase === 'over' || (saved.state.isCompleted && !saved.state.journey.pending)) return '查看结算';
  return '接着玩';
}

export function WorldPicker({ levelIndex, isSwitching, freshOnly, onChoose, onBack }) {
  const [saves] = useState(() => freshOnly ? [] : readWorldAdventures());
  const [marked, setMarked] = useState(PLAYABLE_WORLDS[levelIndex].themeId);
  const [listing, setListing] = useState(false);
  const [error, setError] = useState('');
  const page = useRef(null);
  const level = PLAYABLE_WORLDS.find(item => item.themeId === marked);
  const entriesFor = theme => saves.filter(item => findStage(item.run.levelId)?.themeId === theme);
  const entries = entriesFor(marked);
  const { region, description } = LANDMARKS[marked];

  useEffect(() => {
    const selector = listing ? '.world-saves button' : '.atlas-mark[aria-pressed=true]';
    page.current?.querySelector(selector)?.focus({ preventScroll: true });
  }, [listing]);

  function enter(target, saved) {
    if (!onChoose({ level: saved ? findStage(saved.run.levelId) : target, saved })) {
      setError('进度暂时存不下，请腾出空间后重试。');
    }
  }
  function choose(target) {
    const matches = entriesFor(target.themeId);
    setMarked(target.themeId);
    if (matches.length > 1) setListing(true);
    else enter(target, matches[0]);
  }
  if (listing) return <DeparturePage pageRef={page} className="saves-page" title={level.name}
    backLabel="回地图" onBack={() => { setError(''); setListing(false); }}>
    <div className="world-saves" aria-label="选择要继续的冒险">{entries.map(saved =>
      <button key={saved.run.id} data-run={saved.run.id} onClick={() => enter(level, saved)}>
        <img src={`./assets/${CHARACTERS[saved.state.survival.character].image}.png`} alt="" />
        <span><strong>{CHARACTERS[saved.state.survival.character].name}</strong>
          <small>第 {saved.state.adventure.cycle || 1} 轮 · 第 {saved.state.rooms.path.length} 段 · {difficultyOf(saved.state.adventure.difficulty).name}</small>
          <small>{new Date(saved.run.startedAt).toLocaleString('zh-CN')}</small></span>
        <b>{resumeLabel(saved)}</b>
      </button>)}</div>{error && <p role="alert">{error}</p>}
  </DeparturePage>;

  return <DeparturePage pageRef={page} className="atlas-page" title="选地图" isPadKeyAlwaysVisible
    backLabel={isSwitching ? '回到暂停' : '返回'} onBack={onBack}>
    <div className="atlas-viewport"><div className="atlas-sheet" aria-label="九个世界">
      <picture>
        <source media="(max-aspect-ratio: 1/1)" srcSet="./assets/adventure-china-atlas-portrait.webp" />
        <img className="atlas-art" src="./assets/adventure-china-atlas.webp" alt="彩笔山河，北方是雪山，南方是雨林，西边是敦煌沙漠，四川盆地的河流向东汇入大海。" />
      </picture>
      {PLAYABLE_WORLDS.map(world => {
        const { x, y, portraitX, portraitY } = LANDMARKS[world.themeId];
        const selected = marked === world.themeId;
        return <button key={world.themeId} className="atlas-mark" data-world={world.themeId}
          style={{ '--x': `${x}%`, '--y': `${y}%`, '--portrait-x': `${portraitX}%`, '--portrait-y': `${portraitY}%` }} aria-label={world.name} aria-pressed={selected}
          onFocus={() => setMarked(world.themeId)}
          onPointerEnter={event => { if (event.pointerType === 'mouse') event.currentTarget.focus({ preventScroll: true }); }}
          onClick={() => choose(world)}>
          <span className="atlas-marker" aria-hidden="true">
            {selected ? <><ArrowsOutCardinal weight="bold" />{world.name}</> : <MapPin weight="fill" />}
          </span>
        </button>;
      })}
    </div></div>
    <footer className="departure-footer"><div className="atlas-location" aria-live="polite">
      <strong>{region}</strong><span>{description}</span>
    </div><ConfirmAction isPadKeyAlwaysVisible onClick={() => choose(level)}>{entries.length > 1 ? '选进度' : entries.length ? resumeLabel(entries[0]) : '选这关'}</ConfirmAction></footer>
    {error && <p className="departure-error" role="alert">{error}</p>}
  </DeparturePage>;
}
