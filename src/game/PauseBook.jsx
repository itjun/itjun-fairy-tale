import { useLayoutEffect, useRef } from 'react';
import { ArrowLeft, DotsThree, GearSix, House, ListBullets, MapTrifold, Play, Sword } from '@phosphor-icons/react';
import { navigate } from '../input/gamepad.js';
import { trapFocus } from './AdventurePanels.jsx';
import './pause-book.css';

export function PauseBook({ game, more, focusOnOpen, hasAdventure, error, onResume, onWorlds, onGarden, onMore, onBack, onTool }) {
  const book = useRef(null);
  const photo = useRef(null);

  useLayoutEffect(() => {
    // 等存档恢复后的角色和机关绘制完毕，再从同一台相机取景。
    const frame = requestAnimationFrame(() => game.copyPauseFrame(photo.current));
    return () => cancelAnimationFrame(frame);
  }, [game]);

  useLayoutEffect(() => {
    const action = focusOnOpen.current || (more ? 'weapon-bindings' : 'resume');
    const entry = book.current.querySelector(`[data-pause-action="${action}"]`);
    (entry || book.current.querySelector('button')).focus({ preventScroll: true });
  }, [more, focusOnOpen]);

  function keyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) (more ? onBack : onResume)();
    } else if (event.key.startsWith('Arrow')) {
      event.preventDefault();
      navigate(book.current, event.key.slice(5).toLowerCase());
    } else if (event.repeat && ['Enter', ' '].includes(event.key)) {
      event.preventDefault();
    } else {
      trapFocus(event);
    }
  }

  return <section className="pause-book" ref={book} role="dialog" aria-modal="true"
    aria-labelledby="pause-title" data-gamepad-page={more ? 'pause-more' : 'pause'} onKeyDown={keyDown}>
    <div className="pause-photo-page">
      <div className="pause-print">
        <canvas ref={photo} role="img" aria-label="暂停时角色所在的关卡画面" />
        <button className="pause-resume" data-pause-action="resume" data-gamepad-resume
          data-gamepad-back={more ? undefined : '继续玩'} onClick={onResume}>
          <Play weight="fill" />继续玩
        </button>
      </div>
    </div>
    <div className="pause-menu-page">
      <h1 id="pause-title">{more ? '更多' : '暂停'}</h1>
      <div className="pause-actions" key={more ? 'more' : 'main'}>
        {more ? <>
          {hasAdventure && <button data-pause-action="weapon-bindings" onClick={() => onTool('weapon-bindings')}><Sword />武器搭配</button>}
          {hasAdventure && <button data-pause-action="overview" onClick={() => onTool('overview')}><ListBullets />本领一览</button>}
          <button data-pause-action="options" onClick={() => onTool('options')}><GearSix />选项</button>
          <button data-pause-action="back" data-gamepad-back="回到暂停" onClick={onBack}><ArrowLeft />返回</button>
        </> : <>
          <button data-pause-action="worlds" data-switch-world onClick={onWorlds}><MapTrifold />换世界</button>
          <button data-pause-action="garden" onClick={onGarden}><House />回花园</button>
          <button data-pause-action="more" onClick={onMore}><DotsThree weight="bold" />更多</button>
        </>}
      </div>
      {error && <p className="pause-error" role="alert">{error}</p>}
    </div>
  </section>;
}
