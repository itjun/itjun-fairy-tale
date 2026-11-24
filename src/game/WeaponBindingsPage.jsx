import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from '@phosphor-icons/react';
import { PadKey } from '../input/PadKey.jsx';
import { ATTACK_KEYS, attackBindings, attackItem, ownedAttacks, wheelSector } from './attack-bindings.js';
import { AttackSlotContent } from './AttackSlots.jsx';
import { trapFocus } from './AdventurePanels.jsx';
import './weapon-bindings.css';

const PAGE_SIZE = 8;
const DIRECTIONS = { ArrowUp: [0, -1], ArrowRight: [1, 0], ArrowDown: [0, 1], ArrowLeft: [-1, 0] };

function wheelShape(index, count) {
  const point = (angle, radius) => [50 + Math.sin(angle) * radius, 50 - Math.cos(angle) * radius];
  const size = 2 * Math.PI / count, angle = size * index;
  const arc = Array.from({ length: 33 }, (_, step) => {
    const [x, y] = point(angle + (size - .008) * (step / 32 - .5), 50);
    return `${x.toFixed(3)}% ${y.toFixed(3)}%`;
  });
  const [x, y] = point(angle, 34.5);
  return {
    clipPath: count === 1 ? 'circle(50%)' : `polygon(50% 50%, ${arc.join(', ')})`,
    '--icon-x': `${x}%`, '--icon-y': `${y}%`,
  };
}

export function WeaponBindingsPage({ adventure, isGamepad, onBack, onBind }) {
  const root = useRef(null), heading = useRef(null);
  const [page, setPage] = useState(0), [selected, setSelected] = useState(null);
  const attacks = ownedAttacks(adventure), pages = Math.ceil(attacks.length / PAGE_SIZE);
  const items = attacks.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const candidate = attackItem(selected), bindings = attackBindings(adventure);
  const candidateName = candidate?.shortName || candidate?.name;
  function flip() {
    if (pages <= 1) return;
    setPage(previous => (previous + 1) % pages);
    setSelected(null);
  }
  useEffect(() => { heading.current.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    const node = root.current;
    function receiveInput({ detail: { pressed, stick } }) {
      if (pressed.has('pause')) { onBack(); return; }
      if (pressed.has('next') && pages > 1) { flip(); return; }
      const aimed = items[wheelSector(stick.x, stick.y, items.length)];
      if (aimed) setSelected(aimed);
      const slot = ATTACK_KEYS.findIndex(({ action }) => pressed.has(action));
      if (slot >= 0 && (aimed || selected)) onBind(slot, aimed || selected);
    }
    node.addEventListener('garden:bindings-input', receiveInput);
    return () => node.removeEventListener('garden:bindings-input', receiveInput);
  });
  function keyDown(event) {
    trapFocus(event);
    const slot = ATTACK_KEYS.findIndex(({ code }) => code === event.code);
    const direction = DIRECTIONS[event.key];
    if (event.key === 'Escape' || slot >= 0 || event.key === 'PageDown' && pages > 1 || direction) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (event.repeat) return;
    if (event.key === 'Escape') onBack();
    else if (slot >= 0 && selected) onBind(slot, selected);
    else if (event.key === 'PageDown') flip();
    else if (direction) {
      const index = items.indexOf(selected);
      if (index >= 0 && direction[0]) setSelected(items[(index + items.length + direction[0]) % items.length]);
      else setSelected(items[wheelSector(...direction, items.length)]);
    }
  }
  return <section ref={root} className="weapon-bindings" role="dialog" aria-modal="true"
    aria-labelledby="weapon-bindings-title" data-gamepad-page="weapon-bindings" onKeyDown={keyDown}>
    <header>
      <h1 id="weapon-bindings-title" ref={heading} tabIndex={-1}>武器搭配</h1>
      <button type="button" className="quiet-button" onClick={onBack}>
        {isGamepad ? <PadKey name="menu" /> : <ArrowLeft size={22} />}返回更多
      </button>
    </header>
    <div className="weapon-wheel" role="group" aria-label="已获得的武器和大招">
      {items.map((id, index) => {
        const item = attackItem(id);
        return <button key={id} type="button" aria-label={item.name} aria-pressed={selected === id} data-attack={id}
          style={wheelShape(index, items.length)} onClick={() => setSelected(id)}>
          <img src={`./assets/${item.image}.png`} alt="" />
        </button>;
      })}
      <div className="weapon-wheel-center">
        {candidateName && <strong className={candidateName.length > 3 ? 'is-long' : undefined}>{candidateName}</strong>}
        <span>{isGamepad ? '摇杆选武器' : '选一件武器'}</span>
      </div>
    </div>
    <div className="weapon-bindings-controls">
      <p>{selected ? '按一个键装上' : '选好后，按一个键装上'}</p>
      <div className="weapon-bindings-slots" aria-label="当前绑定">
        {bindings.map((id, slot) => <button key={slot} type="button" className="quiet-button" disabled={!selected}
          aria-label={`${isGamepad ? ATTACK_KEYS[slot].pad : ATTACK_KEYS[slot].keyboard} ${attackItem(id)?.name || '空位'}`}
          onClick={() => onBind(slot, selected)}>
          <AttackSlotContent {...{ slot, id, magic: adventure.magic, isGamepad }} />
        </button>)}
      </div>
      {pages > 1 && <button type="button" className="quiet-button weapon-wheel-next" onClick={flip}>
        {isGamepad && <PadKey name="RB" />}{page + 1} / {pages}<ArrowRight size={20} />
      </button>}
    </div>
  </section>;
}
