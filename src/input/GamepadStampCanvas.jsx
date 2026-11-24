import { useEffect, useRef, useState } from 'react';

export function GamepadStampCanvas({ isDecorating, onPlace, children }) {
  const root = useRef(null), position = useRef({ x: 50, y: 55 }), place = useRef(onPlace);
  const [cursor, setCursor] = useState(position.current);
  place.current = onPlace;
  useEffect(() => {
    if (!isDecorating) return;
    const node = root.current;
    function move(dx, dy) {
      position.current = {
        x: Math.max(5, Math.min(95, position.current.x + dx)),
        y: Math.max(5, Math.min(95, position.current.y + dy)),
      };
      setCursor(position.current);
    }
    function placeAtCursor() {
      const bounds = node.getBoundingClientRect();
      place.current({ target: node, currentTarget: node, clientX: bounds.x + bounds.width * position.current.x / 100, clientY: bounds.y + bounds.height * position.current.y / 100 });
    }
    function input(event) {
      const { input, dt, isConfirm } = event.detail;
      const dy = Number(input.actions.has('down')) - Number(input.actions.has('up'));
      if (input.direction || dy) move(input.direction * dt * 0.045, dy * dt * 0.045);
      if (isConfirm) placeAtCursor();
    }
    function keyboard(event) {
      if (event.target !== node || event.altKey || event.ctrlKey || event.metaKey) return;
      const steps = { ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2] };
      if (Object.hasOwn(steps, event.key)) {
        event.preventDefault();
        move(...steps[event.key]);
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (!event.repeat) placeAtCursor();
      }
    }
    node.addEventListener('garden:canvas-input', input);
    node.addEventListener('keydown', keyboard);
    return () => {
      node.removeEventListener('garden:canvas-input', input);
      node.removeEventListener('keydown', keyboard);
    };
  }, [isDecorating]);
  return <div ref={root} className="world" onClick={onPlace} tabIndex={isDecorating ? 0 : undefined} data-gamepad-canvas={isDecorating || undefined} data-gamepad-stamps={isDecorating || undefined} aria-label={isDecorating ? '贴纸画布：摇杆或方向键移动，A、回车或空格放贴纸' : undefined}>{children}{isDecorating && <span className="gamepad-stamp-cursor" style={{ left: `${cursor.x}%`, top: `${cursor.y}%` }} aria-hidden="true"/>}</div>;
}
