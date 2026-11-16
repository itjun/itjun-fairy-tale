import { UPGRADES } from '../../shared/adventure-catalog.js';

// 同系本领凑够 3 个触发，5 个加强。只在第 9 版的冒险里生效，旧存档的数值不变。
export const SET_STEPS = [3, 5];
export const SETS = Object.freeze({
  power: { name: '力量', steps: ['攻击 +15%', '攻击 +30%'] },
  bubble: { name: '泡泡', steps: ['受伤 −15%', '受伤 −30%'] },
  flight: { name: '飞行', steps: ['出手快 10%', '出手快 20%'] },
  frost: { name: '冰霜', steps: ['打中后小怪慢 1 秒', '打中后小怪慢 2 秒'] },
  nature: { name: '自然', steps: ['清完一间房回血 8', '清完一间房回血 16'] },
});
export function setCounts(adventure) {
  const counts = Object.fromEntries(Object.keys(SETS).map(family => [family, 0]));
  for (const id of Object.keys(adventure?.upgrades || {})) counts[UPGRADES[id].family]++;
  return counts;
}
export function setLevel(adventure, family) {
  if (!(adventure?.ruleset >= 9)) return 0;
  const count = setCounts(adventure)[family];
  return SET_STEPS.filter(step => count >= step).length;
}
