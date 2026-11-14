import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowCounterClockwise, Check, Lightbulb, SpeakerHigh, SpeakerSlash } from '@phosphor-icons/react';
import { MINI_GAMES, actOnMiniSession, isMiniComplete, miniHint } from './session.js';
import { RainbowGame } from './RainbowGame.jsx';
import { GardenGame } from './GardenGame.jsx';
import { TreatGame } from './TreatGame.jsx';
import { InteractionProvider } from './Interaction.jsx';
import { Art, Gem, Bloom, Ingredient, Tool } from './Art.jsx';
import { TOOLS } from './flowers.js';
import { narrationFile, narrationText } from './narration.js';
import './mini-games.css';

export function MiniGame({ session, onChange, onExit, onReplay, isSound, onSound, onChime, isSaved }) {
  const current = useRef(session);
  current.current = session;
  const [feedback, setFeedback] = useState({ message: '', isSuccess: false });
  const title = useRef(null);
  const narration = useRef(null);
  const [narrationRequest, setNarrationRequest] = useState(0);
  const game = MINI_GAMES[session.id], task = session.tasks[session.taskIndex];
  const isComplete = isMiniComplete(session);
  const phase = task?.phase ?? 2;
  useEffect(() => { window.scrollTo(0, 0); title.current?.focus({ preventScroll: true }); }, [session.id, session.seed, session.taskIndex]);
  useEffect(() => { narration.current?.pause(); }, [session.taskIndex]);
  useEffect(() => {
    const audio = narration.current;
    if (!isSound || !audio) return;
    audio.src = `./audio/guidance/${narrationFile(narrationText(session))}`;
    audio.volume = 0.85;
    audio.play().catch(() => { /* 系统阻止播放时保留文字提示，不回退到机械朗读。 */ });
    return () => { audio.pause(); audio.removeAttribute('src'); audio.load(); };
  }, [isSound, session.seed, phase, isComplete, narrationRequest]);
  useEffect(() => {
    window.gardenDesktop?.updateSafe(isComplete);
    return () => window.gardenDesktop?.updateSafe(true);
  }, [isComplete]);
  function send(action) {
    if (action.type === 'hint') setNarrationRequest(value => value + 1);
    const result = actOnMiniSession(current.current, { ...action, taskId: task?.id, revision: session.revision });
    if (result.session !== current.current) {
      current.current = result.session;
      onChange(result.session);
      if (result.isSuccess) onChime(result.isTaskComplete);
    }
    if (result.message || action.type === 'hint') setFeedback({ message: result.message, isSuccess: result.isSuccess });
  }
  function renderItem(item) {
    if (session.id === 'rainbow') return <Gem id={item} />;
    if (session.id === 'treat') return <Ingredient id={item} />;
    return Object.hasOwn(TOOLS, item) ? <Tool id={item} size={64} /> : <Bloom id={item} />;
  }
  const Game = { rainbow: RainbowGame, garden: GardenGame, treat: TreatGame }[session.id];
  return <main className={`mini-game mini-${session.id}`} data-gamepad-page={`${session.id}:${session.seed}:${session.taskIndex}`}>
    <audio ref={narration} preload="none" aria-hidden="true" />
    <header className="mini-header"><button className={`quiet-button ${isComplete ? 'is-placeholder' : ''}`} aria-hidden={isComplete || undefined} tabIndex={isComplete ? -1 : undefined} data-gamepad-back onClick={onExit}><ArrowLeft size={24} />回花园</button><h1 ref={title} tabIndex={-1}>{game.title}</h1><button className="icon-button" aria-label={isSound ? '关闭声音' : '打开声音'} onClick={onSound}>{isSound ? <SpeakerHigh size={28} /> : <SpeakerSlash size={28} />}</button></header>
    <nav className="mini-phases" aria-label="冒险进度">{game.phases.map((name, i) => <span className={`${i === phase ? 'is-current' : ''} ${i < phase || isComplete ? 'is-finished' : ''}`} key={name} aria-current={i === phase ? 'step' : undefined}>{(i < phase || isComplete) && <Check size={22} />}<b>{name}</b>{i < 2 && <ArrowRight size={22} className="phase-arrow" />}</span>)}</nav>
    {isComplete ? <section className="mini-finale"><Art name={session.id === 'rainbow' ? 'collectible-rainbow' : session.id === 'garden' ? 'flower' : 'icecream'} /><h2>{game.title}，完成啦！</h2><p>你是「{game.reward}」！这一份快乐，留在花园里。</p><div className="mini-finale-actions"><button className="primary-button" onClick={() => { setFeedback({ message: '', isSuccess: false }); onReplay(); }}><ArrowCounterClockwise size={23} />再来一次</button><button className="quiet-button" data-gamepad-back onClick={onExit}><ArrowLeft size={22} />回花园</button></div></section> : <>
      <div className="mini-progress-copy"><span>{game.phases[phase]}的小心愿</span><span>{session.taskIndex + 1} / {session.tasks.length}</span></div>
      <section className={`mini-stage ${session.hintLevel ? 'is-hinting' : ''}`} data-scene={task.kind === 'find' ? task.scene : undefined} aria-label={task.title}>
        <InteractionProvider key={`${session.id}-${session.seed}-${task.id}`} resetKey={`${session.seed}-${task.id}`} onDrop={send} renderItem={renderItem}><Game session={session} send={send} /></InteractionProvider>
      </section>
      <section className="mini-assistance"><div className={`mini-feedback ${feedback.isSuccess ? 'is-success' : ''}`} role="status">{miniHint(session) || feedback.message || '不着急，看看线索，试着搭配。'}</div><div className="mini-assistance-actions"><button className="quiet-button" disabled={!session.history.length} onClick={() => send({ type: 'undo' })}><ArrowCounterClockwise size={21} />撤回</button><button className="quiet-button" onClick={() => send({ type: 'hint' })}><Lightbulb size={24} />{session.hintLevel === 1 ? '提示下一步' : '看提示'}</button></div></section>
    </>}
    <p className={`mini-save-status ${!isSaved ? 'save-warning' : ''}`} role="status">{isSaved ? '进度已记住，随时可以回花园休息。' : '这次进度暂时无法保存，请先留在游戏里。'}</p>
  </main>;
}
