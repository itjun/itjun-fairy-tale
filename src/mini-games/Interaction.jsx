import { createContext, useContext, useRef, useState } from 'react';

const Interaction = createContext(null);
export function InteractionProvider({ children, onDrop, renderItem, resetKey }) {
  const [choice, setChoice] = useState(null);
  const selected = choice?.key === resetKey ? choice.item : null;
  const [drag, setDrag] = useState(null);
  const gesture = useRef(null);
  const suppressClick = useRef(false);
  function choose(item) { setChoice({ key: resetKey, item }); }
  function place(target, action, item = selected) {
    if (!item) return;
    onDrop({ type: action, item, target: Number(target) });
    setChoice(null);
  }
  const value = { selected, choose, place,
    source(item) {
      return {
        onPointerDown(event) {
          if (event.button !== 0) return;
          gesture.current = { item, x: event.clientX, y: event.clientY, isMoving: false, key: resetKey };
          event.currentTarget.setPointerCapture(event.pointerId);
        },
        onPointerMove(event) {
          const current = gesture.current;
          if (!current || current.item !== item) return;
          if (Math.hypot(event.clientX - current.x, event.clientY - current.y) > 8) current.isMoving = true;
          if (current.isMoving) { choose(item); setDrag({ item, x: event.clientX, y: event.clientY }); }
        },
        onPointerUp(event) {
          const current = gesture.current;
          gesture.current = null; setDrag(null);
          if (!current?.isMoving || current.key !== resetKey) return;
          suppressClick.current = true;
          const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-drop]');
          if (target && !target.disabled) place(target.dataset.drop, target.dataset.action, item);
        },
        onPointerCancel() { gesture.current = null; setDrag(null); },
        onClick() {
          if (suppressClick.current) { suppressClick.current = false; return; }
          choose(selected === item ? null : item);
        },
      };
    },
  };
  return <Interaction.Provider value={value}>{children}{drag && <div className="mini-drag-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden="true">{renderItem(drag.item)}</div>}</Interaction.Provider>;
}

export function PickItem({ item, label, children, className = '' }) {
  const interaction = useContext(Interaction);
  return <button type="button" className={`mini-pick ${className} ${interaction.selected === item ? 'is-selected' : ''}`} aria-label={label} aria-pressed={interaction.selected === item} {...interaction.source(item)}>{children}<span>{label}</span></button>;
}

export function DropZone({ target, action = 'place', label, children, className = '', isDisabled = false }) {
  const interaction = useContext(Interaction);
  return <button type="button" data-drop={target} data-action={action} disabled={isDisabled} className={`mini-drop ${className} ${interaction.selected ? 'is-ready' : ''}`} aria-label={label} onClick={() => interaction.place(target, action)}>{children}</button>;
}
