import { CHARACTERS } from './characters.js';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from '@phosphor-icons/react';
import { CATEGORY_LABELS } from '../../shared/adventure-catalog.js';
import { rewardItem } from './adventure.js';
import { WEAPONS, UPGRADES } from './adventure.js';
import { fireAdventureWeapon, stepAdventureWave } from './adventure-combat.js';
import { upgradePower } from './adventure.js';

export function RewardPanel({ reward, adventure, onChoose, onRecycle, onExit }) {
  const root = useRef(null), isConfirmed = useRef(false);
  const [selection, setSelection] = useState(null);
  useEffect(() => { root.current?.focus({ preventScroll: true }); }, []);
  function confirm() {
    if (selection === null || isConfirmed.current) return;
    isConfirmed.current = true;
    if (selection === 'recycle') onRecycle(reward.id, reward.player);
    else onChoose(selection, reward.id, reward.player);
  }
  return <section ref={root} tabIndex={-1} className="reward-panel" role="dialog" aria-modal="true" aria-labelledby="reward-title" onKeyDown={event => { if (event.repeat && [' ', 'Enter'].includes(event.key)) event.preventDefault(); trapFocus(event); }}>
    <div className="reward-heading"><h2 id="reward-title">选一个新本领</h2><p>点选本领，再继续探险</p><small>{reward.title}，本次冒险一直保留</small></div>
    <div className="reward-choices">{reward.choices.map((choice, index) => {
      const item = rewardItem(choice), rank = adventure.upgrades[choice.id] || 0;
      return <button className="reward-choice" data-category={item.category} key={`${choice.type}:${choice.id}`} onClick={() => setSelection(index)} aria-pressed={selection === index} aria-label={`选择${item.name}`}>
        <span className="reward-category">{CATEGORY_LABELS[item.category]}</span><strong className="reward-name">{item.name}</strong><img src={`./assets/${item.image}.png`} alt=""/><span className="reward-copy"><span>{item.hint}</span><small>{choice.type === 'weapon' ? '确认后装备' : choice.type === 'supply' || choice.type === 'salvage' ? '确认后领取' : rank ? `升级到 ${rank + 1} 级` : adventure.loadouts[reward.player].upgrades.length >= 3 ? '背包收下，去休息点装备' : '确认后装备'}</small></span><span className="reward-pick">{selection === index ? '已选这个' : '选这个'}</span>
      </button>;
    })}</div>
    <footer><span>彩笔碎片 {adventure.resources?.balance || 0}</span><button aria-pressed={selection === 'recycle'} onClick={() => setSelection('recycle')}>这次换碎片 +{upgradePower(adventure, reward.player).recycle ? 3 : 1}</button><button className="reward-confirm primary-button" disabled={selection === null} onClick={confirm}>选好了，继续</button><button onClick={onExit}>保存回花园</button></footer>
  </section>;
}
export function trapFocus(event) {
  if (event.key !== 'Tab') return;
  const items = [...event.currentTarget.querySelectorAll('button:not(:disabled)')], first = items[0], last = items.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  else if (document.activeElement === event.currentTarget) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); }
}
function WeaponPractice({ adventure, player, character }) {
  const canvas = useRef(null), data = useRef(adventure), [isTrying, setIsTrying] = useState(false);
  data.current = adventure;
  useEffect(() => {
    const node = canvas.current, context = node.getContext('2d'), images = {};
    const names = [CHARACTERS[character].image, 'enemy-leaf', 'light-wave', 'magic-bubble', 'collectible-star', 'weapon-boomerang', 'weapon-seed', 'weapon-firefly', 'enemy-burst', 'platform-crayon'];
    let isDisposed = false, frame, elapsed = 0, previous = 0, waves = [], nextShot = 0;
    const enemy = { id: 1, x: 15, y: 0, width: 1.5, height: 2, hp: 99, isDefeated: false };
    Promise.all(names.map(name => new Promise(resolve => { const image = new Image(); image.onload = () => { images[name] = image; resolve(); }; image.onerror = resolve; image.src = `./assets/${name}.png`; }))).then(() => { if (!isDisposed) frame = requestAnimationFrame(draw); });
    function draw(time) {
      const dt = previous ? Math.min((time - previous) / 1000, 0.04) : 0; previous = time; elapsed += dt;
      const scale = node.width / 22, ground = node.height * 0.7;
      const picture = (name, x, y, w, h) => { if (images[name]) context.drawImage(images[name], x * scale, ground - (y + h) * scale, w * scale, h * scale); };
      context.clearRect(0, 0, node.width, node.height);
      if (images['platform-crayon']) context.drawImage(images['platform-crayon'], 22, 258, 2127, 252, 0, ground - 5, node.width, 36);
      picture(CHARACTERS[character].image, 2, 0, 4.4, 4.4); picture('enemy-leaf', 15, 0, 3, 3.3);
      if (isTrying && elapsed > nextShot) {
        const build = data.current, weapon = build.loadouts[player].weapon;
        waves.push(...fireAdventureWeapon({ x: 4, y: 0, facing: 1, nextShot: 0 }, elapsed, { left: 0, right: 22 }, weapon, upgradePower(build, player)));
        nextShot = elapsed + 0.8;
      }
      const spawned = [];
      for (const wave of waves) {
        const result = stepAdventureWave(wave, [enemy], [{ x: 11, y: 0, width: 22 }], dt, elapsed); spawned.push(...result.spawned);
        if (result.hits.length) enemy.hitAt = elapsed;
        picture(WEAPONS[wave.kind]?.image || 'collectible-star', wave.x - 0.6, wave.y - 0.5, 1.4, 1.4);
      }
      if (elapsed - (enemy.hitAt ?? -10) < 0.3) picture('enemy-burst', 14.7, 0, 3, 3);
      enemy.hp = 99; enemy.isDefeated = false;
      waves = [...waves.filter(w => w.isActive), ...spawned].slice(-80);
      frame = requestAnimationFrame(draw);
    }
    return () => { isDisposed = true; cancelAnimationFrame(frame); };
  }, [isTrying, player, character]);
  return <div className="weapon-practice"><canvas ref={canvas} width="800" height="430" aria-label="武器试用场景"/><button className="paper-action" onClick={() => setIsTrying(!isTrying)}>{isTrying ? '停一下' : '试一试'}</button><span>这里只试效果，不计分</span></div>;
}
export function WorkbenchPanel({ character = 'sister', adventure, survival, supply, onBuy, onWeapon, onUpgrade, onClose }) {
  const player = 0;
  const [notice, setNotice] = useState('');
  const root = useRef(null), loadout = adventure.loadouts[player];
  useEffect(() => { root.current?.querySelector('button')?.focus(); }, []);
  return <section className="workbench-panel" ref={root} role="dialog" aria-modal="true" aria-labelledby="workbench-title" onKeyDown={trapFocus}>
    <div className="workbench-scene"><img className="workbench-art" src="./assets/adventure-workbench.png" alt="彩笔休息工作台"/><WeaponPractice adventure={adventure} player={player} character={character}/></div>
    <div className="workbench-content"><h2 id="workbench-title">配一配，试一试</h2>
      <div className="camp-supply"><img src="./assets/upgrade-recycle.png" alt=""/><span>碎片 <b>{adventure.resources?.balance || 0}</b><small>体力 {survival.hp}/3</small></span><button className="paper-action" disabled={supply.isUsed || survival.hp >= 3 || (adventure.resources?.balance || 0) < supply.price} onClick={() => { if (onBuy()) setNotice('恢复了 1 格体力，这个休息点的补给已用完。'); }}>{supply.isUsed ? '补给已用过' : survival.hp >= 3 ? '体力已满' : `恢复 1 格 / ${supply.price} 碎片`}</button></div>
      <h3>我的武器</h3><div className="weapon-shelf">{adventure.weapons.map(id => <button key={id} aria-pressed={loadout.weapon === id} onClick={() => { onWeapon(player, id); setNotice(''); }}><img src={`./assets/${WEAPONS[id].image}.png`} alt=""/><span>{WEAPONS[id].name}</span></button>)}</div>
      <h3>装上小本领 <small>{loadout.upgrades.length}/3</small></h3>
      {!Object.keys(adventure.upgrades).length && <p>去完成挑战，就能带回新的小本领。</p>}
      <div className="upgrade-shelf">{Object.entries(adventure.upgrades).sort(([a],[b]) => Number(loadout.upgrades.includes(b)) - Number(loadout.upgrades.includes(a))).map(([id, rank]) => {
        const item = UPGRADES[id], isCompatible = !item.weapon || item.weapon === loadout.weapon;
        return <button key={id} aria-pressed={loadout.upgrades.includes(id)} onClick={() => { if (!onUpgrade(player, id)) setNotice(isCompatible ? '先点一下已装备的本领，腾出一个位置。' : `换上${WEAPONS[item.weapon].name}，就能用这个本领。`); else setNotice(''); }}><img src={`./assets/${item.image}.png`} alt=""/><strong>{item.name}{rank > 1 ? ` ${rank}级` : ''}</strong><small>{isCompatible ? item.hint : `适合${WEAPONS[item.weapon].name}`}</small></button>;
      })}</div>
      <p className="workbench-notice" role="status">{notice || '点一下装上，再点一下取下。'}</p>
      <button className="paper-action workbench-depart" onClick={onClose}>带上出发 <ArrowRight size={24}/></button>
    </div>
  </section>;
}
