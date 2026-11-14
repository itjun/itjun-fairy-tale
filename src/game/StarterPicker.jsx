import { useEffect, useRef, useState } from 'react';
import { WEAPONS, UPGRADES, CATEGORY_LABELS, upgradeCategory } from '../../shared/adventure-catalog.js';
import { isValidStarter, EXPLORATION_UPGRADES } from './starter-build.js';
import { trapFocus } from './AdventurePanels.jsx';

export function StarterPicker({ build, onConfirm, onClose }) {
  const [draft,setDraft]=useState(()=>structuredClone(build)),[tab,setTab]=useState('weapons');
  const root=useRef(null),isConfirmed=useRef(false);
  useEffect(()=>{root.current?.focus();},[]);
  const isWeapons=tab==='weapons',key=isWeapons?'weapons':'upgrades';
  const items=Object.entries(isWeapons?WEAPONS:UPGRADES).filter(([id])=>isWeapons||!EXPLORATION_UPGRADES.has(id)&&upgradeCategory(id)===tab);
  function toggle(id) {
    setDraft(previous=>{
      const list=previous[key];
      if(!isWeapons&&!list.includes(id)&&list.length>=2)return previous;
      const next={...previous,[key]:isWeapons?[id]:list.includes(id)?list.filter(value=>value!==id):[...list,id]};
      next.upgrades=next.upgrades.filter(value=>!UPGRADES[value].weapon||next.weapons.includes(UPGRADES[value].weapon));
      return next;
    });
  }
  return <div className="starter-picker-overlay"><section ref={root} tabIndex={-1} className="starter-picker" role="dialog" aria-modal="true" aria-labelledby="starter-title" onKeyDown={event=>{event.stopPropagation();if(event.repeat&&[' ','Enter'].includes(event.key))event.preventDefault();trapFocus(event);}}>
    <header><h2 id="starter-title">自己搭配初始本领</h2><p>选 1 种武器，最多 2 项本领。探索奖励可叠加武器和发射数量。</p></header>
    <div className="starter-selection" aria-live="polite"><span>武器 {draft.weapons.length}/1：{draft.weapons.map(id=>WEAPONS[id].shortName).join('、')||'还没选'}</span><span>本领 {draft.upgrades.length}/2：{draft.upgrades.map(id=>UPGRADES[id].name).join('、')||'还没选'}</span></div>
    <nav aria-label="初始搭配分类">{Object.entries({weapons:'武器',...CATEGORY_LABELS}).map(([id,label])=><button key={id} aria-pressed={tab===id} onClick={()=>setTab(id)}>{label}</button>)}</nav>
    <div className="starter-options">{items.map(([id,item])=>{const isSelected=draft[key].includes(id),isUnavailable=!!item.weapon&&!draft.weapons.includes(item.weapon);return <button key={id} aria-pressed={isSelected} disabled={isUnavailable||!isWeapons&&!isSelected&&draft[key].length>=2} onClick={()=>toggle(id)}><img src={`./assets/${item.image}.png`} alt=""/><strong>{item.name}</strong><small>{item.hint}</small><em>{isSelected?'已选':isUnavailable?`需先选${WEAPONS[item.weapon].shortName}`:!isWeapons&&draft[key].length>=2?'先取下一项':'选这个'}</em></button>;})}</div>
    <footer><button className="paper-action" onClick={onClose}>返回</button><button className="paper-action" disabled={!isValidStarter(draft)} onClick={()=>{if(isConfirmed.current||!isValidStarter(draft))return;isConfirmed.current=true;onConfirm(draft);}}>选好了，去试试</button></footer>
  </section></div>;
}
