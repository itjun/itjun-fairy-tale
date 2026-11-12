import { CHARACTERS } from './characters.js';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from '@phosphor-icons/react';
import { WEAPONS, UPGRADES } from './adventure.js';
import { fireAdventureWeapon, stepAdventureWave } from './adventure-combat.js';
import { upgradePower } from './adventure.js';

export function RewardPanel({ reward, adventure, onChoose, onExit }) {
  const root = useRef(null);
  useEffect(() => { root.current?.querySelector('button')?.focus(); }, [reward.id, reward.player]);
  return <section ref={root} className="reward-panel" role="dialog" aria-modal="true" aria-labelledby="reward-title" onKeyDown={trapFocus}>
    <div className="reward-heading"><h2 id="reward-title">选一个新本领</h2><p>本次冒险一直保留</p><small>{reward.title}</small></div>
    <div className="reward-choices">{reward.choices.map((choice, index) => {
      const item = (choice.type === 'weapon' ? WEAPONS : UPGRADES)[choice.id], rank = adventure.upgrades[choice.id] || 0;
      return <button className="reward-choice" key={`${choice.type}:${choice.id}`} onClick={() => onChoose(index, reward.id, reward.player)} aria-label={`选择${item.name}`}>
        <img src={`./assets/${item.image}.png`} alt=""/><span className="reward-copy"><strong>{item.name}</strong><span>{item.hint}</span><small>{choice.type === 'weapon' ? '新武器，选好就装备' : rank ? `升级到 ${rank + 1} 级` : '新本领'}</small></span><span className="reward-pick">选这个</span>
      </button>;
    })}</div>
    <footer><span>去休息点，还能重新搭配</span><button onClick={onExit}>保存回花园</button></footer>
  </section>;
}
export function trapFocus(event) {
  if (event.key !== 'Tab') return;
  const items = [...event.currentTarget.querySelectorAll('button:not(:disabled)')], first = items[0], last = items.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
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
export function WorkbenchPanel({ character = 'sister', adventure, onWeapon, onUpgrade, onClose }) {
  const player = 0;
  const [notice, setNotice] = useState('');
  const root = useRef(null), loadout = adventure.loadouts[player];
  useEffect(() => { root.current?.querySelector('button')?.focus(); }, []);
  return <section className="workbench-panel" ref={root} role="dialog" aria-modal="true" aria-labelledby="workbench-title" onKeyDown={trapFocus}>
    <div className="workbench-scene"><img className="workbench-art" src="./assets/adventure-workbench.png" alt="彩笔休息工作台"/><WeaponPractice adventure={adventure} player={player} character={character}/></div>
    <div className="workbench-content"><h2 id="workbench-title">配一配，试一试</h2>
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
