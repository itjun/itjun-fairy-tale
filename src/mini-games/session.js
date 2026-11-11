import { randomFor } from './random.js';
import { rainbowTasks, GEMS } from './rainbow.js';
import { flowerTasks, FLOWERS, TOOLS } from './flowers.js';
import { treatTasks, FLAVORS, CONTAINERS, TOPPINGS } from './treat.js';

export const MINI_GAMES = {
  rainbow: { title: '找回彩虹', phases: ['找线索', '修机关', '补彩虹'], reward: '彩虹魔法师' },
  garden: { title: '照顾花朵', phases: ['播种', '照料', '配花束'], reward: '花园小园丁' },
  treat: { title: '甜蜜分享', phases: ['认配方', '做冰淇淋', '分享派对'], reward: '甜心分享家' },
};
const generators = { rainbow: rainbowTasks, garden: flowerTasks, treat: treatTasks };
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function emptyBoard(task) {
  if (!task || task.kind === 'find') return {};
  if (task.kind === 'care') return { steps: [0, 0, 0], weatherUsed: [] };
  if (task.kind === 'orders') return { builds: task.orders.map(() => ({ container: null, layers: [], topping: null, isServed: false })) };
  return { slots: task.answer.map(() => null) };
}

export function createMiniSession(id, seed = crypto.getRandomValues(new Uint32Array(1))[0]) {
  if (!Object.hasOwn(generators, id)) throw new Error('找不到这个小游戏。');
  const tasks = generators[id](randomFor(seed)).map((task, index) => ({ ...task, id: `${id}-${index}` }));
  return { version: 1, id, seed: seed >>> 0, tasks, taskIndex: 0, completed: [], board: emptyBoard(tasks[0]), history: [], hintLevel: 0, revision: 0 };
}

export function isMiniComplete(session) { return session.taskIndex === session.tasks.length; }
export function weatherFor(task, board) {
  const turn = Math.min(2, Math.floor(board.steps.reduce((sum, step) => sum + step, 0) / 4));
  return { turn, kind: task.weather[turn], isUsed: board.weatherUsed.includes(turn) };
}

function nextTask(session) {
  const taskIndex = session.taskIndex + 1;
  return { ...session, taskIndex, completed: [...session.completed, session.tasks[session.taskIndex].id], board: emptyBoard(session.tasks[taskIndex]), history: [], hintLevel: 0 };
}

// 点击与拖拽都进入这里；任务编号和版本拒绝快速连点产生的旧操作。
export function actOnMiniSession(session, action) {
  if (isMiniComplete(session) || action.taskId !== session.tasks[session.taskIndex].id || action.revision !== session.revision) return { session, message: '' };
  const task = session.tasks[session.taskIndex];
  const board = structuredClone(session.board);
  const reject = message => ({ session, message, isSuccess: false });
  const accept = (message, isDone = false, isHistory = true) => {
    let updated = { ...session, board, revision: session.revision + 1, history: isHistory ? [...session.history, session.board].slice(-30) : session.history };
    if (isDone) updated = nextTask(updated);
    return { session: updated, message, isSuccess: true, isTaskComplete: isDone };
  };
  if (action.type === 'hint') return { session: { ...session, hintLevel: Math.min(2, session.hintLevel + 1), revision: session.revision + 1 }, message: '' };
  if (action.type === 'undo') {
    if (!session.history.length) return reject('还没有需要撤回的操作。');
    return { session: { ...session, board: session.history.at(-1), history: session.history.slice(0, -1), revision: session.revision + 1 }, message: '退回一步，可以重新搭配。' };
  }
  if (task.kind === 'find' && action.type === 'find') {
    if (action.item !== task.target) return reject('再对照一下线索里的颜色和形状。');
    return accept('线索找到啦，继续往前看看！', true, false);
  }
  if (task.kind === 'care') {
    if (action.type === 'weather') {
      const weather = weatherFor(task, board);
      if (weather.isUsed) return reject('这次天气已经帮过忙啦。');
      const tool = { rain: 'water', sunny: 'sun' }[weather.kind];
      if (!tool) return reject('云遮住了太阳，试试阳光工具。');
      const changed = board.steps.map((step, i) => task.plants[i].needs[step] === tool ? step + 1 : step);
      if (equal(changed, board.steps)) return reject('现在的小花需要别的照料，先看看需求图案。');
      board.steps = changed; board.weatherUsed.push(weather.turn);
    } else if (action.type === 'care') {
      if (!Number.isInteger(action.target) || !task.plants[action.target]) return reject('把工具送到小花这里。');
      const plant = task.plants[action.target], step = board.steps[action.target];
      if (step === plant.needs.length) return reject('这朵花已经照顾好啦，看看别的小花。');
      if (action.item !== plant.needs[step]) return reject(`先${TOOLS[plant.needs[step]]}，小花就准备好啦。`);
      board.steps[action.target]++;
    } else return reject('选一种工具，再送给小花。');
    const isDone = task.plants.every((plant, i) => board.steps[i] === plant.needs.length);
    return accept(isDone ? '三朵小花都开了，去看看下一份心愿！' : action.type === 'weather' ? '天气也帮忙啦，看看哪些需求已经完成。' : '小花收到啦，再看看下一步需要什么。', isDone);
  }
  if (task.kind === 'orders') {
    const index = action.target;
    if (!Number.isInteger(index) || !task.orders[index]) return reject('先选一位家人的订单。');
    const build = board.builds[index], order = task.orders[index];
    if (build.isServed) return reject('这份已经送到啦。');
    if (action.type === 'ingredient') {
      if (Object.hasOwn(CONTAINERS, action.item)) {
        if (build.container) return reject('已经有容器啦，需要更换可以撤回。');
        build.container = action.item;
      } else if (Object.hasOwn(FLAVORS, action.item)) {
        if (!build.container) return reject('先放一个蛋筒或小杯。');
        if (build.topping) return reject('装饰已经放好啦，要改口味可以撤回。');
        if (build.layers.length >= 3) return reject('最多放三球，可以撤回后再调整。');
        build.layers.push(action.item);
      } else if (Object.hasOwn(TOPPINGS, action.item)) {
        if (!build.layers.length) return reject('先放好冰淇淋，再加装饰。');
        if (build.topping) return reject('已经有装饰啦，可以撤回后再选。');
        build.topping = action.item;
      } else return reject('从桌上选一份材料吧。');
      return accept('放好啦！对照订单，看看下一步。');
    }
    if (action.type === 'serve') {
      if (build.container !== order.container) return reject(`${order.person}想要${CONTAINERS[order.container]}，先调整容器吧。`);
      if (!equal(build.layers, order.layers)) return reject('对照订单，从下往上看看口味和层数。');
      if (build.topping !== order.topping) return reject(order.topping ? `还要检查一下${TOPPINGS[order.topping]}装饰。` : '这份不用装饰，可以撤回最后一步。');
      build.isServed = true;
      // 已送出的订单不可撤回，避免同一份奖励重复发放。
      const result = accept(`${order.person}说：谢谢你，正是我想要的！`, board.builds.every(item => item.isServed));
      result.session.history = [];
      return result;
    }
    return reject('做好以后，送给订单上的家人。');
  }
  if (action.type === 'place') {
    if (!task.options.includes(action.item) || !Number.isInteger(action.target) || action.target < 0 || action.target >= board.slots.length) return reject('把选好的物品放到空位上。');
    if (task.kind === 'sow' && action.item !== task.answer[action.target]) return reject('看看花床上的图案，换一种种子试试。');
    if (board.slots[action.target] === action.item) return reject('这里已经放好啦。');
    board.slots[action.target] = action.item;
    return accept(task.kind === 'sow' ? '种子种好啦！' : '放好啦，还可以调整顺序。', task.kind === 'sow' && equal(board.slots, task.answer));
  }
  if (action.type === 'check') {
    if (board.slots.some(item => !item)) return reject('还有空位置，先把它们放好吧。');
    const isCorrect = task.kind === 'bouquet-count' ? equal([...board.slots].sort(), [...task.answer].sort()) : equal(board.slots, task.answer);
    if (!isCorrect) return reject('快接近啦！再对照一下图案线索，可以撤回或替换。');
    return accept(task.phase === 2 ? '这一份完成啦，离派对又近了一步！' : '机关打开啦，新的线索出现了！', true);
  }
  return reject('选好物品，再放到合适的位置。');
}

export function miniHint(session) {
  if (!session.hintLevel || isMiniComplete(session)) return '';
  const task = session.tasks[session.taskIndex], board = session.board;
  if (session.hintLevel === 1) {
    if (task.kind === 'find') return '同时看看颜色和形状，线索藏在场景里。';
    if (task.kind === 'care') return '每朵花按图案从左往右照料，天气也可以帮忙。';
    if (task.kind === 'orders') return '先看容器，再从下往上放口味，最后加装饰。';
    if (task.kind === 'pattern' || task.kind === 'bouquet-pattern') return '看看哪两个图案在重复，接着这个规律往下排。';
    if (task.kind === 'neighbors' || task.kind === 'chain') return '箭头两边的图案要紧挨着，可以把几条线索接起来。';
    if (task.kind === 'bouquet-count') return '数一数两种颜色各需要几朵，顺序可以自己选。';
    if (task.kind === 'bouquet-order') return '中间放一朵，两边像照镜子一样，再对照外侧的颜色。';
    return '对照上面的图案，把物品放到对应的位置。';
  }
  if (task.kind === 'find') return `找一找${GEMS[task.target].name}，它就在场景里。`;
  if (task.kind === 'care') {
    const index = task.plants.findIndex((plant, i) => board.steps[i] < plant.needs.length);
    return `试着给${task.plants[index].name}${TOOLS[task.plants[index].needs[board.steps[index]]] }。`;
  }
  if (task.kind === 'orders') {
    const index = board.builds.findIndex(build => !build.isServed), build = board.builds[index], order = task.orders[index];
    if (!build.container) return `先给${order.person}放一个${CONTAINERS[order.container]}。`;
    if (build.container !== order.container) return `这份需要${CONTAINERS[order.container]}，用撤回调整一下。`;
    const layer = build.layers.findIndex((flavor, i) => flavor !== order.layers[i]);
    if (layer >= 0 || build.layers.length > order.layers.length) return '有一层口味不同，先撤回到那一层再调整。';
    if (build.layers.length < order.layers.length) return `下一球放${FLAVORS[order.layers[build.layers.length]].name}。`;
    if (build.topping && build.topping !== order.topping) return '装饰和订单不同，撤回最后一步再看看。';
    return order.topping && build.topping !== order.topping ? `最后放${TOPPINGS[order.topping]}装饰。` : `做好啦，送给${order.person}吧！`;
  }
  const index = board.slots.findIndex((item, i) => item !== task.answer[i]);
  if (index < 0) return '已经搭配好啦，试一试完成按钮。';
  const item = (GEMS[task.answer[index]] || FLOWERS[task.answer[index]]).name;
  return `试着把${item}放在第 ${index + 1} 个位置。`;
}

function validBoard(board, task) {
  if (!board || typeof board !== 'object' || Array.isArray(board)) return false;
  if (!task || task.kind === 'find') return Object.keys(board).length === 0;
  if (task.kind === 'care') return Array.isArray(board.steps) && board.steps.length === 3 && board.steps.every((step, i) => Number.isInteger(step) && step >= 0 && step <= task.plants[i].needs.length) && Array.isArray(board.weatherUsed) && board.weatherUsed.length <= 3 && new Set(board.weatherUsed).size === board.weatherUsed.length && board.weatherUsed.every(turn => [0, 1, 2].includes(turn));
  if (task.kind === 'orders') return Array.isArray(board.builds) && board.builds.length === task.orders.length && board.builds.every((build, i) => {
    if (!build || !(build.container === null || Object.hasOwn(CONTAINERS, build.container)) || !Array.isArray(build.layers) || build.layers.length > 3 || !build.layers.every(item => Object.hasOwn(FLAVORS, item)) || !(build.topping === null || Object.hasOwn(TOPPINGS, build.topping)) || typeof build.isServed !== 'boolean') return false;
    if ((!build.container && (build.layers.length || build.topping)) || (!build.layers.length && build.topping)) return false;
    return !build.isServed || (build.container === task.orders[i].container && equal(build.layers, task.orders[i].layers) && build.topping === task.orders[i].topping);
  });
  return Array.isArray(board.slots) && board.slots.length === task.answer.length && board.slots.every(item => item === null || task.options.includes(item));
}

export function readMiniSession(value, id) {
  if (!Object.hasOwn(generators, id) || !value || value.version !== 1 || value.id !== id || !Number.isInteger(value.seed) || value.seed < 0 || value.seed > 0xffffffff || !Number.isSafeInteger(value.revision) || value.revision < 0) return null;
  const canonical = createMiniSession(id, value.seed);
  if (!Number.isInteger(value.taskIndex) || value.taskIndex < 0 || value.taskIndex > canonical.tasks.length || !equal(value.tasks, canonical.tasks) || !equal(value.completed, canonical.tasks.slice(0, value.taskIndex).map(task => task.id))) return null;
  const task = canonical.tasks[value.taskIndex];
  if (![0, 1, 2].includes(value.hintLevel) || !validBoard(value.board, task) || !Array.isArray(value.history) || value.history.length > 30 || !value.history.every(board => validBoard(board, task))) return null;
  // 自动推进的任务不能停在已全部完成的盘面，撤回也不能复活已送出的订单。
  const boards = [value.board, ...value.history];
  if (task?.kind === 'care' && boards.some(board => board.steps.every((step, i) => step === task.plants[i].needs.length))) return null;
  if (task?.kind === 'sow' && boards.some(board => equal(board.slots, task.answer))) return null;
  if (task?.kind === 'orders' && (value.board.builds.every(build => build.isServed) || value.history.some(board => board.builds.some((build, i) => build.isServed !== value.board.builds[i].isServed)))) return null;
  if (!task && (value.history.length || value.hintLevel)) return null;
  // 只保留已知字段；备份不带入额外数据。
  return { ...canonical, taskIndex: value.taskIndex, completed: [...value.completed], board: structuredClone(value.board), history: structuredClone(value.history), hintLevel: value.hintLevel, revision: value.revision };
}
