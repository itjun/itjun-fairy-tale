import { collectionPoints } from './collectibles.js';

// 客户端和本机服务共用确定性奖励清单；不接受客户端提供的分值。
export function campaignScore(world, collectedIds, defeatedIds, isCompleted, bonus) {
  const collection = {}, drops = {};
  for (const id of new Set(collectedIds)) { const t = world.treasures[id - 1]; if (!t) throw new Error('宝物编号不正确'); collection[t.kind] = (collection[t.kind] || 0) + 1; }
  let combatScore = 0;
  for (const id of new Set(defeatedIds)) {
    const e = world.enemies[id - 1]; if (!e) throw new Error('小怪编号不正确');
    combatScore += e.points;
    if (e.drop) { collection[e.drop] = (collection[e.drop] || 0) + 1; drops[e.drop] = (drops[e.drop] || 0) + 1; }
  }
  const treasureScore = collectionPoints(collection);
  return { collection, drops, combatScore, treasureScore, score: treasureScore + combatScore + (isCompleted ? bonus : 0) };
}
