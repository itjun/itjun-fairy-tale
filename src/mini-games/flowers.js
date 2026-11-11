import { shuffled } from './random.js';

export const FLOWERS = {
  pink: { name: '粉花', image: 'flower', symbol: 'heart' },
  blue: { name: '蓝花', image: 'mini-flower-blue', symbol: 'snow' },
  yellow: { name: '黄花', image: 'mini-flower-yellow', symbol: 'star' },
};
export const TOOLS = { water: '浇水', sun: '阳光', pollen: '授粉' };
export const FLOWER_NAMES = ['小粉', '朵朵', '花花', '小芽', '小蓝', '小晴'];

export function flowerTasks(random) {
  const varieties = shuffled(['pink', 'blue', 'yellow', 'pink', 'blue', 'yellow'], random);
  const needs = [
    ...shuffled([['water', 'water', 'sun', 'pollen'], ['sun', 'water', 'sun', 'pollen'], ['water', 'sun', 'pollen', 'water']], random),
    ...shuffled([['water', 'sun', 'water', 'pollen', 'sun'], ['sun', 'water', 'pollen', 'sun', 'water'], ['water', 'water', 'sun', 'sun', 'pollen']], random),
  ];
  const plants = varieties.map((variety, i) => ({ name: FLOWER_NAMES[i], variety, needs: needs[i] }));
  const tasks = [];
  for (let batch = 0; batch < 2; batch++) tasks.push({ phase: 0, kind: 'sow', title: '把种子送到合适的花床', plants: plants.slice(batch * 3, batch * 3 + 3), answer: varieties.slice(batch * 3, batch * 3 + 3), options: shuffled(Object.keys(FLOWERS), random), batch });
  for (let batch = 0; batch < 2; batch++) {
    // 天气只随操作推进；天气图案明示作用，不会在离开后改变。
    tasks.push({ phase: 1, kind: 'care', title: '看看小花需要什么', plants: plants.slice(batch * 3, batch * 3 + 3), weather: shuffled(['rain', 'sunny', 'cloudy'], random), batch });
  }
  const colors = shuffled(Object.keys(FLOWERS), random);
  tasks.push({ phase: 2, kind: 'bouquet-count', title: '配一束双色小花', answer: [colors[0], colors[1], colors[0]], options: Object.keys(FLOWERS) });
  tasks.push({ phase: 2, kind: 'bouquet-pattern', title: '让花束有自己的规律', answer: [colors[1], colors[2], colors[1], colors[2]], options: Object.keys(FLOWERS) });
  tasks.push({ phase: 2, kind: 'bouquet-order', title: '为派对配好最后一束', answer: [colors[0], colors[1], colors[2], colors[1], colors[0]], options: Object.keys(FLOWERS) });
  return tasks;
}
