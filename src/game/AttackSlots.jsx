import { PadKey } from '../input/PadKey.jsx';
import { ATTACK_KEYS, attackItem } from './attack-bindings.js';

export function AttackKey({ slot, isGamepad }) {
  const key = ATTACK_KEYS[slot];
  return isGamepad ? <PadKey name={key.pad} /> : <kbd>{key.keyboard}</kbd>;
}

export function AttackSlotContent({ slot, id, magic, isGamepad }) {
  const item = attackItem(id);
  return <>
    <AttackKey slot={slot} isGamepad={isGamepad} />
    {item && <img src={`./assets/${item.image}.png`} alt="" />}
    <span>{item?.shortName || item?.name || '空位'}
      {item?.charge && <progress aria-label={`${item.name}能量`} value={magic.charges[id] || 0} max={item.charge} />}
    </span>
  </>;
}
