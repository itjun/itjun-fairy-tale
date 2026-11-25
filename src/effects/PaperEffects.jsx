import { useEffect, useRef } from 'react';

export function PaperEffects({cue, dance, dragging}) {
  const canvas = useRef(null);
  const control = useRef(null);
  const previousCue = useRef(cue);

  useEffect(() => {
    const node = canvas.current;
    const root = node.parentElement;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    let view, loading, closed = false;

    async function ready() {
      if (reduce.matches || closed) return;
      try {
        loading ||= import('./paper-view.js');
        const { PaperView } = await loading;
        if (!reduce.matches && !closed) return view ||= new PaperView(node);
      } catch {
        // WebGL 不可用时，原画和操作按钮仍由页面显示。
      }
    }
    const actions = {
      async play(cue) {
        actions.cue = cue;
        if (!cue) {
          view?.stopTransient();
          return;
        }
        const scene = await ready();
        if (!scene || actions.cue !== cue) return;
        for (const target of cue.targets) {
          const anchor = target.selector && root.querySelector(target.selector);
          const art = target.art && (anchor?.matches('img,svg') ? anchor : anchor?.querySelector('img,svg'));
          scene.play(target.kind, anchor, art, target.particles, target.point);
        }
      },
      async follow(kind, selector) {
        actions[kind] = selector;
        view?.stopKind(kind);
        if (!selector) return;
        const scene = await ready();
        if (!scene || actions[kind] !== selector) return;
        const anchor = root.querySelector(selector);
        const art = anchor?.matches('img,svg') ? anchor : anchor?.querySelector('img,svg');
        if (art) scene.play(kind, anchor, art);
      },
    };
    const motionChange = () => {
      view?.clear();
      if (!reduce.matches) {
        actions.follow('dance', actions.dance);
        actions.follow('drag', actions.drag);
      }
    };
    reduce.addEventListener('change', motionChange);
    control.current = actions;
    return () => {
      closed = true;
      reduce.removeEventListener('change', motionChange);
      view?.dispose();
      control.current = null;
    };
  }, []);

  useEffect(() => {
    if (previousCue.current !== cue) control.current.play(cue);
    previousCue.current = cue;
  }, [cue]);
  useEffect(() => { control.current.follow('dance', dance); }, [dance]);
  useEffect(() => { control.current.follow('drag', dragging && '.mini-drag-ghost'); }, [dragging]);
  return <canvas ref={canvas} aria-hidden="true" className="paper-motion-layer" />;
}
