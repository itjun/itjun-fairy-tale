import { useEffect, useRef, useState } from 'react';

export function GamepadStampCanvas({ isDecorating, onPlace, children }) {
  const root = useRef(null), position = useRef({ x: 50, y: 55 }), place = useRef(onPlace);
  const [cursor, setCursor] = useState(position.current);
  place.current = onPlace;
  useEffect(() => {
    const node = root.current;
    function input(event) {
      const { input, dt, isConfirm } = event.detail;
      const dy = Number(input.actions.has('down')) - Number(input.actions.has('up'));
      if (input.direction || dy) {
        position.current = { x: Math.max(5, Math.min(95, position.current.x + input.direction * dt * 0.045)), y: Math.max(5, Math.min(95, position.current.y + dy * dt * 0.045)) };
        setCursor(position.current);
      }
      if (isConfirm && isDecorating) {
        const bounds = node.getBoundingClientRect();
        place.current({ target: node, currentTarget: node, clientX: bounds.x + bounds.width * position.current.x / 100, clientY: bounds.y + bounds.height * position.current.y / 100 });
      }
    }
    node.addEventListener('garden:canvas-input', input);
    return () => node.removeEventListener('garden:canvas-input', input);
  }, [isDecorating]);
  return <div ref={root} className="world" onClick={onPlace} tabIndex={isDecorating ? 0 : undefined} data-gamepad-canvas={isDecorating || undefined} data-gamepad-stamps={isDecorating || undefined} aria-label={isDecorating ? '贴纸画布：左摇杆移动，A 放贴纸，B 返回' : undefined}>{children}{isDecorating && <span className="gamepad-stamp-cursor" style={{ left: `${cursor.x}%`, top: `${cursor.y}%` }} aria-hidden="true"/>}</div>;
}
