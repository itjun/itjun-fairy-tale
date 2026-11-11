import { useState } from 'react';
import { ArrowUp, Check } from '@phosphor-icons/react';
import { FLAVORS, CONTAINERS, TOPPINGS } from './treat.js';
import { Art, Ingredient, IceCream } from './Art.jsx';
import { PickItem, DropZone } from './Interaction.jsx';

export function TreatGame({ session, send }) {
  const task = session.tasks[session.taskIndex], board = session.board;
  const [choice, setChoice] = useState({ taskId: task.id, index: 0 });
  let index = choice.taskId === task.id ? choice.index : 0;
  if (board.builds[index]?.isServed) index = board.builds.findIndex(build => !build.isServed);
  if (index < 0) index = 0;
  const order = task.orders[index], build = board.builds[index];
  return <>
    <div className={`treat-workspace ${task.orders.length === 2 ? 'has-two-orders' : ''}`}>
      <div className="family-orders" aria-label="家人的订单">{task.orders.map((item, i) => <button key={i} className={`order-paper ${index === i ? 'is-selected' : ''}`} aria-label={`查看${item.person}的订单`} aria-pressed={index === i} disabled={board.builds[i].isServed} onClick={() => setChoice({ taskId: task.id, index: i })}>
        <strong>{item.person}的订单{board.builds[i].isServed && <Check size={25} />}</strong>
        <div className="recipe-picture"><ArrowUp size={23} /><IceCream build={item} className="recipe-icecream" /><div className="recipe-labels">{item.topping && <span>{TOPPINGS[item.topping]}</span>}{[...item.layers].reverse().map((flavor, j) => <span key={j}>{FLAVORS[flavor].name}</span>)}<span>{CONTAINERS[item.container]}</span></div></div><small>从下往上做</small>
      </button>)}</div>
      <div className="icecream-making-area"><h2>{task.title}</h2><DropZone target={index} action="ingredient" label={`给${order.person}制作冰淇淋`} className={`icecream-drop ${build.container ? 'has-container' : ''}`}><IceCream build={build} />{!build.container && <span className="empty-recipe">先放蛋筒或小杯</span>}<strong>我的冰淇淋</strong></DropZone></div>
      <Art name="family" className="treat-family" />
    </div>
    <div className="mini-tray ingredient-tray" aria-label="冰淇淋材料">
      <div className="ingredient-group containers">{Object.entries(CONTAINERS).map(([id, label]) => <PickItem key={id} item={id} label={label}><Ingredient id={id} /></PickItem>)}</div>
      <div className="ingredient-group flavors">{Object.entries(FLAVORS).map(([id, flavor]) => <PickItem key={id} item={id} label={flavor.name}><Ingredient id={id} /></PickItem>)}</div>
      {task.phase > 0 && <div className="ingredient-group toppings">{Object.entries(TOPPINGS).map(([id, label]) => <PickItem key={id} item={id} label={label}><Ingredient id={id} /></PickItem>)}</div>}
    </div>
    <div className="mini-task-actions"><p>按订单搭配，做好再送给家人。</p><button className="primary-button" onClick={() => send({ type: 'serve', target: index })}><Check size={23} />做好啦，送给{order.person}</button></div>
  </>;
}
