import { useEffect, useRef } from 'react';
import { LIFE_CHOICES, canChooseLife } from './combat-loot.js';
import { trapFocus } from './AdventurePanels.jsx';

export function LifeLootPanel({ enemyId, survival, adventure, onChoose, onLeave, onExit }) {
  const root=useRef(null),isConfirmed=useRef(false);
  useEffect(()=>{root.current?.focus({preventScroll:true});},[]);
  function claim(id) {
    if(isConfirmed.current||!canChooseLife(id,adventure,survival))return;
    isConfirmed.current=true;
    if(!onChoose(enemyId,id))isConfirmed.current=false;
  }
  return <section ref={root} tabIndex={-1} className="reward-panel life-loot-panel" role="dialog" aria-modal="true" aria-labelledby="life-loot-title" onKeyDown={event=>{if(event.repeat&&[' ','Enter'].includes(event.key))event.preventDefault();trapFocus(event);}}>
    <div className="reward-heading"><h2 id="life-loot-title">小怪留下了补给，选一份吧</h2><p>血量 {survival.hp} / {survival.maxHp}　血瓶 ×{survival.lives}</p><progress aria-label="选择补给时的玩家血量" value={survival.hp} max={survival.maxHp}/><small>点一下就领走。先放这里，离开后回来还能选。</small></div>
    <div className="reward-choices">{Object.entries(LIFE_CHOICES).map(([id,item])=>{const isAvailable=canChooseLife(id,adventure,survival);return <button className="reward-choice" data-category="survival" key={id} disabled={!isAvailable} onClick={()=>claim(id)}><strong className="reward-name">{item.name}</strong><img src={`./assets/${item.image}.png`} alt=""/><span className="reward-copy">{item.hint}</span><span className="reward-pick">{!isAvailable?id==='heal'?'生命已满':id==='reserve'?'已存一份':'已到上限':'选这个'}</span></button>;})}</div>
    <footer><button data-gamepad-back onClick={()=>onLeave(enemyId)}>先放这里</button><button onClick={onExit}>保存回花园</button></footer>
  </section>;
}
