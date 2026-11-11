import { Check, ArrowRight } from '@phosphor-icons/react';
import { FLOWERS, TOOLS } from './flowers.js';
import { weatherFor } from './session.js';
import { Art, Bloom, Gem, Tool } from './Art.jsx';
import { PickItem, DropZone } from './Interaction.jsx';

function BouquetClue({ task }) {
  if (task.kind === 'bouquet-count') return <div className="bouquet-clue">{Object.keys(FLOWERS).filter(id => task.answer.includes(id)).map(id => <span key={id}><Bloom id={id} />需要 {task.answer.filter(item => item === id).length} 朵</span>)}<p>颜色和数量配对就好，顺序自己选。</p></div>;
  if (task.kind === 'bouquet-order') return <div className="bouquet-clue"><span>两边是<Bloom id={task.answer[0]} /></span><span>中间是<Bloom id={task.answer[2]} /></span><span>剩下两朵<Bloom id={task.answer[1]} /></span><p>两边像照镜子一样。</p></div>;
  return <div className="bouquet-clue">{task.answer.slice(0, 2).map((id, i) => <span key={i}><Bloom id={id} /><ArrowRight size={24} /></span>)}<p>两种花交替排，重复两次。</p></div>;
}
export function GardenGame({ session, send }) {
  const task = session.tasks[session.taskIndex], board = session.board;
  const isCare = task.kind === 'care', isSow = task.kind === 'sow';
  const weather = isCare ? weatherFor(task, board) : null;
  if (isCare || isSow) return <>
    <Art name="girl-player" className="garden-girl" />
    <div className="mini-clue garden-clue"><h2>{task.title}</h2><span className="mini-count">花床 {task.batch * 3 + 1}～{task.batch * 3 + 3} / 6</span>
      {isCare && <button className="weather-control quiet-button" onClick={() => send({ type: 'weather' })} disabled={weather.isUsed || weather.kind === 'cloudy'}><Tool id={weather.kind} size={30} /><span>{weather.kind === 'cloudy' ? '云遮住了太阳，用工具送阳光' : weather.isUsed ? '天气已经帮过忙啦' : weather.kind === 'rain' ? '请小雨帮忙浇水' : '请晴天帮忙晒太阳'}</span></button>}
    </div>
    <div className="garden-plants">
      {task.plants.map((plant, i) => {
        const step = isCare ? board.steps[i] : board.slots[i] ? 1 : 0;
        const isDone = isCare && step === plant.needs.length;
        return <div className="garden-plant" key={plant.name}>
          <div className="plant-need">{isSow ? <><Gem id={FLOWERS[plant.variety].symbol} /><span>种{FLOWERS[plant.variety].name}</span></> : <><span>照料顺序</span><div className="need-sequence">{plant.needs.map((need, j) => <span key={j} className={j < step ? 'need-done' : j === step ? 'need-current' : ''}><Tool id={need} size={29} />{j < step && <Check size={17} weight="bold" />}</span>)}</div></>}</div>
          <DropZone target={i} action={isCare ? 'care' : 'place'} label={`${isCare ? '照顾' : '播种到'}${plant.name}`} className={`plant-target growth-${Math.min(step, 4)}`} isDisabled={isDone || (isSow && !!board.slots[i])}>
            {isCare ? isDone ? <Bloom id={plant.variety} /> : <Art name={step < 2 ? "mini-sprout" : "mini-bud"} alt={step < 2 ? "小花幼苗" : "小花花苞"} className="growing-plant" /> : step ? <Art name="mini-sprout" alt="刚种下的小芽" className="growing-plant" /> : <span className="seed-bed">放种子</span>}
            <strong>{plant.name}{isDone && <Check size={24} />}</strong>
          </DropZone>
        </div>;
      })}
    </div>
    <div className="mini-tray garden-tray">{isSow ? task.options.map(id => <PickItem key={id} item={id} label={`${FLOWERS[id].name}种子`}><Bloom id={id} /><Gem id={FLOWERS[id].symbol} className="seed-symbol" /></PickItem>) : Object.entries(TOOLS).map(([id, label]) => <PickItem key={id} item={id} label={label}><Tool id={id} size={74} /></PickItem>)}</div>
    <p className="mini-instruction">{isSow ? '看看图案，选好种子，再送到花床。' : '选好工具，再送给需要的小花。天气也可以帮忙。'}</p>
  </>;
  return <>
    <div className="mini-clue garden-clue"><h2>{task.title}</h2><BouquetClue task={task} /></div>
    <div className="bouquet-workspace"><div className="mini-slots bouquet-slots">{board.slots.map((id, i) => <DropZone key={i} target={i} label={`花束第 ${i + 1} 个位置`}>{id ? <Bloom id={id} /> : <span className="slot-number">{i + 1}</span>}</DropZone>)}</div></div>
    <div className="mini-tray garden-tray">{task.options.map(id => <PickItem key={id} item={id} label={FLOWERS[id].name}><Bloom id={id} /></PickItem>)}</div>
    <div className="mini-task-actions"><p>可以自由替换，配好以后送给家人。</p><button className="primary-button" onClick={() => send({ type: 'check' })}><Check size={22} />花束配好啦</button></div>
  </>;
}
