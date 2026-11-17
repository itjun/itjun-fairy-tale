import assert from 'node:assert/strict';
import { GEMS } from '../../src/mini-games/rainbow.js';
import { FLOWERS, TOOLS } from '../../src/mini-games/flowers.js';
import { FLAVORS, CONTAINERS, TOPPINGS } from '../../src/mini-games/treat.js';

// 读取隔离存档里的题目来解题；每一步作答都走方向键和 A，不写盘面、不调用业务函数。
export async function completeMiniGame(id, evaluate, until) {
  const read = () => evaluate(`Object.values(localStorage).map(value=>{try{return JSON.parse(value)}catch{return null}}).find(p=>p?.miniGames?.${id}).miniGames.${id}`);
  const choose = selector => evaluate(`choose(${JSON.stringify(selector)})`);
  async function place(label, target) {
    await choose(`.mini-pick[aria-label=${JSON.stringify(label)}]`);
    await choose(`.mini-drop[data-drop="${target}"]:not(:disabled)`);
  }
  let session = await read();
  while (session.taskIndex < session.tasks.length) {
    const index = session.taskIndex, task = session.tasks[index], board = session.board;
    if (task.kind === 'find') {
      await choose(`.hidden-gem[aria-label="找到${GEMS[task.target].name}"]`);
    } else if (task.kind === 'care') {
      for (const [plantIndex, plant] of task.plants.entries()) {
        for (const tool of plant.needs.slice(board.steps[plantIndex])) await place(TOOLS[tool], plantIndex);
      }
    } else if (task.kind === 'orders') {
      for (const [orderIndex, order] of task.orders.entries()) {
        const build = board.builds[orderIndex];
        if (build.isServed) continue;
        await choose(`.order-paper[aria-label="查看${order.person}的订单"]`);
        if (!build.container) await place(CONTAINERS[order.container], orderIndex);
        for (const flavor of order.layers.slice(build.layers.length)) await place(FLAVORS[flavor].name, orderIndex);
        if (order.topping && !build.topping) await place(TOPPINGS[order.topping], orderIndex);
        await choose('.mini-task-actions .primary-button');
      }
    } else {
      for (const [slot, item] of task.answer.entries()) {
        if (board.slots[slot] === item) continue;
        const label = id === 'rainbow' ? GEMS[item].name : FLOWERS[item].name + (task.kind === 'sow' ? '种子' : '');
        await place(label, slot);
      }
      if (task.kind !== 'sow') await choose('.mini-task-actions .primary-button');
    }
    await until(async () => (await read()).taskIndex === index + 1, `${id} 第 ${index + 1} 题完成`);
    session = await read();
    console.log(`手柄小游戏：${id} ${session.taskIndex}/${session.tasks.length}`);
  }
  assert.equal(await evaluate('!!document.querySelector(".mini-finale")'), true, `${id} 显示完成页`);
  await choose('.mini-finale .primary-button');
  await until(async () => (await read()).taskIndex === 0, `${id} 再来一次`);
  assert.equal((await read()).completed.length, 0, `${id} 重玩从头开始`);
}
