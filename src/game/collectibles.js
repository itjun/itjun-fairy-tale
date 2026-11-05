import { randomGenerator } from './physics.js';

export const COLLECTIBLES = {
  flower: { name: '小花', phrase: '一朵小花', image: 'flower', size: 1.6 },
  heart: { name: '爱心', phrase: '一颗爱心', image: 'collectible-heart', size: 1.4 },
  star: { name: '星星', phrase: '一颗星星', image: 'collectible-star', size: 1.5 },
  rainbow: { name: '彩虹', phrase: '一道彩虹', image: 'collectible-rainbow', size: 1.8 },
  icecream: { name: '冰淇淋', phrase: '一支冰淇淋', image: 'icecream', size: 1.8 },
  shell: { name: '贝壳', phrase: '一枚贝壳', image: 'collectible-shell', size: 1.6 },
  snowflake: { name: '雪花', phrase: '一片雪花', image: 'collectible-snowflake', size: 1.5 },
  mushroom: { name: '蘑菇', phrase: '一朵蘑菇', image: 'collectible-mushroom', size: 1.7 },
  balloon: { name: '气球', phrase: '一只气球', image: 'collectible-balloon', size: 1.8 },
};
export const LEVEL_COLLECTIBLES = {
  rainbow: ['rainbow', 'star', 'heart', 'flower'],
  family: ['heart', 'icecream', 'star', 'flower'],
  sweet: ['icecream', 'heart', 'rainbow', 'star', 'flower'],
  beach: ['shell', 'star', 'icecream', 'heart'],
  meadow: ['flower', 'rainbow', 'mushroom', 'heart'],
  snow: ['snowflake', 'star', 'heart', 'icecream'],
  forest: ['mushroom', 'flower', 'star', 'heart'],
  cartoon: ['balloon', 'star', 'rainbow', 'icecream', 'heart'],
};

// 用独立随机序列排列宝物，避免改变已有种子的跳台位置。
export function collectibleSequence(levelId, seed, count) {
  const random = randomGenerator(seed ^ 0x45b3a21);
  const pool = [...LEVEL_COLLECTIBLES[levelId]];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return Array.from({ length: count }, (_, index) => pool[index % pool.length]);
}
