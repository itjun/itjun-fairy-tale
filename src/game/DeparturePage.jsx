import { ArrowLeft, ArrowRight } from '@phosphor-icons/react';
import { useGamepad } from '../input/GamepadSupport.jsx';
import { navigate } from '../input/gamepad.js';
import { trapFocus } from './AdventurePanels.jsx';
import './departure.css';

export function ConfirmAction({ children, onClick, className = '', isPadKeyAlwaysVisible = false }) {
  const { mode } = useGamepad();
  return <button className={`departure-confirm ${className}`} onClick={onClick}>
    {isPadKeyAlwaysVisible || mode === 'gamepad' ? <kbd aria-hidden="true">A</kbd> : <ArrowRight weight="bold" />}
    {children}
  </button>;
}

export function DeparturePage({ title, backLabel, onBack, className, children, pageRef, isPadKeyAlwaysVisible = false }) {
  const { mode } = useGamepad();
  function handleKey(event) {
    if (event.defaultPrevented || event.target.closest('[role="dialog"]') !== event.currentTarget) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) onBack();
    } else if (event.key.startsWith('Arrow') && !event.target.matches('canvas')) {
      event.preventDefault();
      navigate(event.currentTarget, event.key.slice(5).toLowerCase());
    } else if (event.repeat && ['Enter', ' '].includes(event.key)) {
      event.preventDefault();
    } else {
      trapFocus(event);
    }
  }
  return <section ref={pageRef} className={`departure-page ${className}`} role="dialog"
    aria-modal="true" aria-label={title} onKeyDown={handleKey}>
    <header className="departure-heading">
      <h2>{title}</h2>
      <button className="departure-back" data-gamepad-back onClick={onBack}>
        {isPadKeyAlwaysVisible || mode === 'gamepad' ? <kbd aria-hidden="true">B</kbd> : <ArrowLeft weight="bold" />}{backLabel}
      </button>
    </header>
    {children}
  </section>;
}
