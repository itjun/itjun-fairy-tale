import { shuffled } from './random.js';

export const FLAVORS = { strawberry: { name: '草莓', image: 'mini-scoop-pink' }, blueberry: { name: '蓝莓', image: 'mini-scoop-blue' }, mango: { name: '芒果', image: 'mini-scoop-yellow' } };
export const CONTAINERS = { cone: '蛋筒', cup: '小杯' };
export const TOPPINGS = { star: '星星', heart: '爱心', rainbow: '彩虹' };
export const FAMILY = ['爸爸', '妈妈', '姐姐', '妹妹'];

export function treatTasks(random) {
  const tasks = [];
  function order(number, layers, isTopping) {
    const flavors = shuffled(Object.keys(FLAVORS), random);
    return { person: FAMILY[number % 4], container: random() > .5 ? 'cone' : 'cup', layers: flavors.slice(0, layers), topping: isTopping ? shuffled(Object.keys(TOPPINGS), random)[0] : null };
  }
  for (let i = 0; i < 2; i++) tasks.push({ phase: 0, kind: 'orders', title: '先做一份喜欢的口味', orders: [order(i, 1, false)] });
  for (let i = 0; i < 4; i++) tasks.push({ phase: 1, kind: 'orders', title: '按订单，从下往上做', orders: [order(i + 2, i < 2 ? 2 : 3, true)] });
  for (let i = 0; i < 3; i++) tasks.push({ phase: 2, kind: 'orders', title: '两位家人的愿望，都记好啦', orders: [order(i * 2, 3, true), order(i * 2 + 1, 2 + i % 2, true)] });
  return tasks;
}
