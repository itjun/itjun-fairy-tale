import { shuffled } from './random.js';

export const GEMS = {
  heart: { name: '粉色爱心', image: 'collectible-heart' },
  star: { name: '黄色星星', image: 'collectible-star' },
  shell: { name: '紫色贝壳', image: 'collectible-shell' },
  snow: { name: '蓝色圆宝石', image: 'mini-gem-blue' },
  leaf: { name: '绿色叶子', image: 'mini-gem-leaf' },
  balloon: { name: '橙色三角', image: 'mini-gem-orange' },
};
export const GEM_IDS = Object.keys(GEMS);

export function rainbowTasks(random) {
  const tasks = [];
  const targets = shuffled(GEM_IDS, random);
  for (let i = 0; i < 6; i++) {
    const options = shuffled(GEM_IDS, random);
    tasks.push({ phase: 0, kind: 'find', scene: Math.floor(i / 2), title: ['小溪边', '城堡前', '彩虹树下'][Math.floor(i / 2)], target: targets[i], options,
      positions: options.map((_, index) => ({ x: 12 + (index % 3) * 33 + Math.floor(random() * 8), y: 23 + Math.floor(index / 3) * 37 + Math.floor(random() * 10) })) });
  }
  const order = shuffled(GEM_IDS, random).slice(0, 3);
  tasks.push({ phase: 1, kind: 'sequence', title: '按线索排好宝石', answer: order, options: shuffled(GEM_IDS, random) });
  const pattern = shuffled(GEM_IDS, random).slice(0, 2);
  tasks.push({ phase: 1, kind: 'pattern', title: '找到接下来的规律', example: [...pattern, ...pattern], answer: [...pattern, ...pattern], options: shuffled(GEM_IDS, random) });
  const neighbors = shuffled(GEM_IDS, random).slice(0, 4);
  tasks.push({ phase: 1, kind: 'neighbors', title: '让好朋友挨在一起', answer: neighbors, pairs: shuffled(neighbors.slice(1).map((item, i) => [neighbors[i], item]), random), options: shuffled(GEM_IDS, random) });
  const chain = shuffled(GEM_IDS, random).slice(0, 5);
  tasks.push({ phase: 1, kind: 'chain', title: '把所有线索连起来', answer: chain, pairs: shuffled(chain.slice(1).map((item, i) => [chain[i], item]), random), options: shuffled(GEM_IDS, random) });
  for (let i = 0; i < 3; i++) {
    const answer = shuffled(GEM_IDS, random).slice(0, i + 4);
    tasks.push({ phase: 2, kind: 'restore', title: ['接好第一段彩虹', '让彩虹越过城堡', '最后一段，彩虹回来啦'][i], answer, options: shuffled(answer, random), pairs: answer.slice(1).map((item, j) => [answer[j], item]) });
  }
  return tasks;
}
