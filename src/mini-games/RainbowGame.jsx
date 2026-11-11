import { ArrowRight, Check, MagnifyingGlass } from '@phosphor-icons/react';
import { GEMS } from './rainbow.js';
import { Gem, Art } from './Art.jsx';
import { PickItem, DropZone } from './Interaction.jsx';

function GemLine({ items }) { return <span className="mini-gem-line">{items.map((id, i) => <span key={i}><Gem id={id} />{i < items.length - 1 && <ArrowRight size={23} />}</span>)}</span>; }
function RainbowPiece({ id, task }) {
  const index = task.answer.indexOf(id);
  return <div className="rainbow-piece"><div className="rainbow-crop" style={{ '--pieces': task.answer.length, '--piece': index }}><img src="./assets/mini-rainbow-puzzle.png" alt="彩虹碎片" draggable="false" /></div><span className="piece-symbol"><Gem id={id} /></span></div>;
}
export function RainbowGame({ session, send }) {
  const task = session.tasks[session.taskIndex], board = session.board;
  if (task.kind === 'find') return <>
    <div className="mini-clue find-clue"><MagnifyingGlass size={28} /><span>{task.title}，找一找</span><Gem id={task.target} /><strong>{GEMS[task.target].name}</strong></div>
    <div className={`rainbow-search search-scene-${task.scene}`} aria-label={`${task.title}寻找线索`}>
      <Art name="girl-player" className="scene-girl" />
      {task.options.map((id, i) => <button className="hidden-gem" key={id} style={{ left: `${task.positions[i].x}%`, top: `${task.positions[i].y}%` }} aria-label={`找到${GEMS[id].name}`} onClick={() => send({ type: 'find', item: id })}><Gem id={id} /><span>{GEMS[id].name}</span></button>)}
    </div>
    <p className="mini-instruction">看一看画里的角落，点中符合线索的宝物。</p>
  </>;
  const isRestore = task.kind === 'restore';
  return <>
    <div className="mini-clue puzzle-clue">
      <h2>{task.title}</h2>
      {task.kind === 'sequence' && <GemLine items={task.answer} />}
      {isRestore && <div className="rainbow-reference"><Art name="mini-rainbow-puzzle" alt="完整彩虹参考" /><p>对照完整彩虹，让每一条颜色接起来。</p></div>}
      {task.kind === 'pattern' && <><GemLine items={task.example} /><p>接着这个规律，再排四个。</p></>}
      {(task.kind === 'neighbors' || task.kind === 'chain') && <><div className="pair-clues">{task.pairs.map((pair, i) => <GemLine key={i} items={pair} />)}</div><p>箭头两边紧挨着，把线索接起来。</p></>}
    </div>
    <div className={`rainbow-workspace ${isRestore ? 'is-restoring' : ''}`}>
      <Art name="girl-player" className="puzzle-girl" />
      <div className={`mini-slots ${isRestore ? 'rainbow-slots' : 'mechanism-slots'}`} aria-label={isRestore ? '拼合彩虹' : '宝石机关'}>
        {board.slots.map((item, i) => <DropZone key={i} target={i} label={`第 ${i + 1} 个${isRestore ? '碎片' : '机关'}位置`} className={item ? 'is-filled' : ''}>{item ? isRestore ? <RainbowPiece id={item} task={task} /> : <Gem id={item} /> : <span className="slot-number">{i + 1}</span>}</DropZone>)}
      </div>
    </div>
    <div className="mini-tray gem-tray" aria-label={isRestore ? '彩虹碎片' : '我的宝石'}><strong>{isRestore ? '彩虹碎片' : '我的宝石'}</strong>{task.options.map(id => <PickItem item={id} key={id} label={GEMS[id].name}>{isRestore ? <RainbowPiece id={id} task={task} /> : <Gem id={id} />}</PickItem>)}</div>
    <div className="mini-task-actions"><p>拖到空位上，也可以点选再放下。</p><button className="primary-button" onClick={() => send({ type: 'check' })}><Check size={24} />{isRestore ? '拼好啦' : '试一试机关'}</button></div>
  </>;
}
