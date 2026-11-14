import { useEffect, useRef } from 'react';
import { ArrowLeft } from '@phosphor-icons/react';

export function HomePage({ title, onBack, backLabel = '返回主菜单', className = '', children }) {
  const heading = useRef(null);
  useEffect(() => { heading.current.focus({ preventScroll: true }); window.scrollTo(0, 0); }, []);
  return <main className={`home-page ${className}`} onKeyDown={event => {
    if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); onBack(); }
  }}>
    <header className="home-page-header">
      <button className="home-back" onClick={onBack}><ArrowLeft size={24} />{backLabel}</button>
      <h1 ref={heading} tabIndex={-1}>{title}</h1>
    </header>
    <div className="home-page-content">{children}</div>
  </main>;
}
