import { useEffect, useRef, useState } from 'react';
import { ArrowsOutCardinal, MapPin } from '@phosphor-icons/react';
import { PLAYABLE_WORLDS, findStage } from '../../shared/levels.js';
import { ATLAS_LANDMARKS, findLandmark } from '../../shared/world-atlas.js';
import { CHARACTERS } from './characters.js';
import { difficultyOf } from './difficulty.js';
import { readWorldAdventures } from './save.js';
import { ConfirmAction, DeparturePage } from './DeparturePage.jsx';

const GAME_SAVE_KEYS = {
  'snow-sisters': 'garden-snow-sisters-v1',
  'gun-nac': 'garden-gun-nac-flight-v1',
};

const GAME_ACTION_LABELS = {
  'snow-sisters': '进入高塔',
  'gun-nac': '进入机库',
};

function hasActiveStandaloneSave(game) {
  const key = GAME_SAVE_KEYS[game];
  if (!key) return false;
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    return !!saved && saved.phase !== 'ending';
  } catch {
    return false;
  }
}

function resumeLabel(saved) {
  if (saved.state.survival.phase === 'over' || (saved.state.isCompleted && !saved.state.journey.pending)) return '查看结算';
  return '接着玩';
}

export function WorldPicker({ levelIndex = 0, initialLandmark, isSwitching, freshOnly, onChoose, onLaunchGame, onBack }) {
  const [saves] = useState(() => freshOnly ? [] : readWorldAdventures());
  const [standaloneSaves] = useState(() => ({
    'snow-sisters': hasActiveStandaloneSave('snow-sisters'),
    'gun-nac': hasActiveStandaloneSave('gun-nac'),
  }));
  const [marked, setMarked] = useState(() => {
    const candidate = initialLandmark || PLAYABLE_WORLDS[levelIndex]?.themeId;
    return findLandmark(candidate).id;
  });
  const [listing, setListing] = useState(false);
  const [error, setError] = useState('');
  const page = useRef(null);
  const landmark = findLandmark(marked);
  const entriesFor = theme => saves.filter(item => findStage(item.run.levelId)?.themeId === theme);
  const entries = landmark.game === 'platform' ? entriesFor(landmark.id) : [];

  useEffect(() => {
    const selector = listing ? '.world-saves button' : '.atlas-mark[aria-pressed=true]';
    page.current?.querySelector(selector)?.focus({ preventScroll: true });
  }, [listing]);

  function enterPlatform(target, saved) {
    if (!onChoose({ level: saved ? findStage(saved.run.levelId) : target.stage, saved })) {
      setError('进度暂时存不下，请腾出空间后重试。');
    }
  }
  function choose(target) {
    setError('');
    setMarked(target.id);
    if (target.game !== 'platform') {
      if (onLaunchGame?.(target) === false) {
        setError('进度暂时存不下，请腾出空间后重试。');
      }
      return;
    }
    const matches = entriesFor(target.id);
    if (matches.length > 1) setListing(true);
    else enterPlatform(target, matches[0]);
  }

  const confirmText = landmark.game !== 'platform'
    ? (standaloneSaves[landmark.game] ? '接着玩' : (GAME_ACTION_LABELS[landmark.game] || '开始玩'))
    : (entries.length > 1 ? '选进度' : entries.length ? resumeLabel(entries[0]) : '选这关');

  if (listing) return <DeparturePage pageRef={page} className="saves-page" title={landmark.name}
    backLabel="回地图" onBack={() => { setError(''); setListing(false); }}>
    <div className="world-saves" aria-label="选择要继续的冒险">{entries.map(saved =>
      <button key={saved.run.id} data-run={saved.run.id} onClick={() => enterPlatform(landmark, saved)}>
        <img src={`./assets/${CHARACTERS[saved.state.survival.character].image}.png`} alt="" />
        <span><strong>{CHARACTERS[saved.state.survival.character].name}</strong>
          <small>第 {saved.state.adventure.cycle || 1} 轮 · 第 {saved.state.rooms.path.length} 段 · {difficultyOf(saved.state.adventure.difficulty).name}</small>
          <small>{new Date(saved.run.startedAt).toLocaleString('zh-CN')}</small></span>
        <b>{resumeLabel(saved)}</b>
      </button>)}</div>{error && <p role="alert">{error}</p>}
  </DeparturePage>;

  return <DeparturePage pageRef={page} className="atlas-page" title="选地图" isPadKeyAlwaysVisible
    backLabel={isSwitching ? '回到暂停' : '返回'} onBack={onBack}>
    <div className="atlas-viewport"><div className="atlas-sheet" aria-label="世界地图">
      <picture>
        <source media="(max-aspect-ratio: 1/1)" srcSet="./assets/adventure-china-atlas-portrait.webp" />
        <img className="atlas-art" src="./assets/adventure-china-atlas.webp" alt="彩笔山河，西北是空军基地，北方是雪山，南方是雨林，西边是敦煌沙漠，四川盆地的河流向东汇入大海。" />
      </picture>
      {ATLAS_LANDMARKS.filter(item => item.art).map(item => (
        <img key={`${item.id}-art`} className="atlas-overlay-art" data-landmark-art={item.id}
          src={item.art} alt="" aria-hidden="true" draggable="false"
          style={{ '--x': `${item.x}%`, '--y': `${item.y}%`, '--portrait-x': `${item.portraitX}%`, '--portrait-y': `${item.portraitY}%` }} />
      ))}
      {ATLAS_LANDMARKS.map(item => {
        const selected = marked === item.id;
        return <button key={item.id} className="atlas-mark" data-world={item.id} data-game={item.game}
          style={{ '--x': `${item.x}%`, '--y': `${item.y}%`, '--portrait-x': `${item.portraitX}%`, '--portrait-y': `${item.portraitY}%` }}
          aria-label={item.name} aria-pressed={selected}
          onFocus={() => setMarked(item.id)}
          onPointerEnter={event => { if (event.pointerType === 'mouse') event.currentTarget.focus({ preventScroll: true }); }}
          onClick={() => choose(item)}>
          <span className="atlas-marker" aria-hidden="true">
            {selected ? <><ArrowsOutCardinal weight="bold" />{item.name}</> : <MapPin weight="fill" />}
          </span>
        </button>;
      })}
    </div></div>
    <footer className="departure-footer"><div className="atlas-location" aria-live="polite">
      <strong>{landmark.region}</strong><span>{landmark.description}</span>
    </div><ConfirmAction isPadKeyAlwaysVisible onClick={() => choose(landmark)}>{confirmText}</ConfirmAction></footer>
    {error && <p className="departure-error" role="alert">{error}</p>}
  </DeparturePage>;
}
