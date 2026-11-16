import { RARITIES, ROOM_TIERS, RARITY_FRAGMENTS } from '../../shared/combat-catalog.js';
import { useEffect, useRef, useState } from 'react';
import { CATEGORY_LABELS } from '../../shared/adventure-catalog.js';
import { rewardItem, upgradePower } from './adventure.js';

export function RewardPanel({ reward, adventure, onChoose, onRecycle, onReroll, onExit }) {
  const root = useRef(null), isConfirmed = useRef(false), isRerolling = useRef(false);
  // 第 9 版清房奖励：门上写的是什么，标题就说什么。
  const isRoom = ROOM_TIERS.includes(reward.tier), rerolls = adventure.resources?.rerolls || 0;
  function reroll() {
    if (isRerolling.current || isConfirmed.current) return;
    isRerolling.current = true;
    if (!onReroll(reward.id)) isRerolling.current = false;
  }
  const [selection, setSelection] = useState([]);
  const isReady=selection==='recycle'||selection.length===1;
  function select(index) {
    setSelection(previous=>{
      const chosen=Array.isArray(previous)?previous:[];
      if(chosen.includes(index))return chosen.filter(value=>value!==index);
      return [...chosen,index].slice(-1);
    });
  }
  useEffect(() => { root.current?.focus({ preventScroll: true }); }, []);
  function confirm() {
    if (!isReady || isConfirmed.current) return;
    isConfirmed.current = true;
    if (selection === 'recycle') onRecycle(reward.id, reward.player);
    else onChoose(selection, reward.id, reward.player);
  }
  return <section ref={root} tabIndex={-1} className="reward-panel" role="dialog" aria-modal="true" aria-labelledby="reward-title" onKeyDown={event => { if (event.repeat && [' ', 'Enter'].includes(event.key)) event.preventDefault(); trapFocus(event); }}>
    <div className="reward-heading"><h2 id="reward-title">{isRoom?reward.title:'小关通关啦，选一份奖励'}</h2><p>{reward.tier==='boss'?'血量上限 +20、攻击 +10%，再挑一张卡':'点选奖励，再确认领取'}</p><small>{isRoom?`稀有多给 ${RARITY_FRAGMENTS.rare} 片碎片，史诗 ${RARITY_FRAGMENTS.epic} 片，传奇 ${RARITY_FRAGMENTS.legendary} 片`:'武器与本领可叠加，限时道具按卡片计时'}</small></div>
    <div className="reward-choices">{reward.choices.map((choice, index) => {
      const item = rewardItem(choice,adventure), rank = choice.type==='spell' ? adventure.magic?.ranks[choice.id] || 0 : adventure.upgrades[choice.id] || 0;
      const isSelected=Array.isArray(selection)&&selection.includes(index);
      return <button className="reward-choice" data-rarity={choice.rarity || 'common'} style={{'--rarity-color':RARITIES[choice.rarity || 'common'].color}} data-category={item.category} key={`${choice.type}:${choice.id}`} onClick={() => select(index)} aria-pressed={isSelected} aria-label={`选择${item.name}`}>
        <span className="rarity-seal">{RARITIES[choice.rarity || 'common'].name}</span><span className="reward-category">{CATEGORY_LABELS[item.category]}</span><strong className="reward-name">{item.name}</strong><img src={`./assets/${item.image}.png`} alt=""/><span className="reward-copy"><span>{item.hint}</span>{item.legend&&<b className="legend-effect">{item.legend}</b>}<small>{choice.type === 'timed' ? `${item.duration} 秒有效游玩时间` : choice.type === 'weapon' ? '与现有武器一起发射' : choice.type === 'supply' || choice.type === 'salvage' ? '确认后领取' : choice.type==='spell' && rank>=3 ? '保留 3 级，解锁传奇效果' : rank ? `升级到 ${rank + 1} 级` : '与现有本领叠加'}</small></span><span className="reward-pick">{isSelected ? '已选这个' : '选这个'}</span>
      </button>;
    })}</div>
    <footer><span>彩笔碎片 {adventure.resources?.balance || 0}</span><button aria-pressed={selection === 'recycle'} onClick={() => setSelection('recycle')}>这次换碎片 +{upgradePower(adventure, reward.player).recycle ? 3 : 1}</button>{isRoom && rerolls > 0 && <button onClick={reroll}>换一批卡（重抽券 {rerolls} 张）</button>}<button className="reward-confirm primary-button" disabled={!isReady} onClick={confirm}>选好了，领取奖励</button><button onClick={onExit}>保存回花园</button></footer>
  </section>;
}
export function trapFocus(event) {
  if (event.key !== 'Tab') return;
  const items = [...event.currentTarget.querySelectorAll('button:not(:disabled)')], first = items[0], last = items.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  else if (document.activeElement === event.currentTarget) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); }
}
