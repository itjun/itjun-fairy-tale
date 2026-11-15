import { MONSTERS } from './adventure-catalog.js';

// 三十个名字原先共用一个 3.6 秒节拍和接近的血量。这里按行动方式分成八种角色，
// 让血条只出现在需要多打一下的对象上，周期也不再齐步走。
export const MONSTER_ROLES = Object.freeze({
  scout: { hp: 16, touch: 8, period: 2.6, bar: false },
  hopper: { hp: 16, touch: 8, period: 2.0, bar: false },
  flyer: { hp: 16, touch: 8, period: 2.9, bar: false },
  charger: { hp: 20, touch: 15, period: 4.4, bar: false },
  shooter: { hp: 16, touch: 8, period: 3.4, bar: false },
  armored: { hp: 64, touch: 12, period: 3.8, bar: true },
  shell: { hp: 16, touch: 10, period: 4.6, bar: true },
  summoner: { hp: 56, touch: 8, period: 5.0, bar: true },
});

const BEHAVIOR_ROLE = Object.freeze({
  hop: 'hopper', leap: 'hopper', bounce: 'hopper', crawl: 'scout', breeze: 'scout', burrow: 'scout',
  swoop: 'flyer', balloon: 'flyer', float: 'flyer', glide: 'flyer', dart: 'flyer', orbit: 'flyer', drop: 'flyer',
  roll: 'charger', charge: 'charger', scuttle: 'charger', iceslide: 'shell',
  bubble: 'shooter', fan: 'shooter', lob: 'shooter', inklob: 'shooter', twins: 'shooter', vine: 'shooter', inkhop: 'hopper',
  guard: 'armored', stomp: 'armored', build: 'armored',
  alarm: 'summoner', summon: 'summoner', split: 'summoner',
});

export const BOSS_SKILL_FOR_BEHAVIOR = Object.freeze({
  swoop: 'charge', balloon: 'bounce', inklob: 'lob', iceslide: 'charge', twins: 'ring', breeze: 'fan',
  hop: 'bounce', leap: 'bounce', float: 'aimed', bounce: 'bounce', scuttle: 'charge', bubble: 'lob',
  roll: 'charge', fan: 'fan', lob: 'lob', dart: 'aimed', charge: 'charge', vine: 'roots', glide: 'wave',
  alarm: 'ring', inkhop: 'lob', guard: 'return', crawl: 'wave', orbit: 'aimed', stomp: 'rain',
  build: 'roots', drop: 'rain', burrow: 'roots', summon: 'fan', split: 'bounce',
});

export const BOSS_SKILL_NAMES = Object.freeze({
  aimed: '瞄准追击', fan: '往高处散射', roots: '脚下冒芽', charge: '直线冲锋', rain: '从头顶落下',
  bounce: '弹来弹去', lob: '抛物投掷', return: '飞出去再回来', ring: '环形音浪', wave: '贴地浪花',
});

export function roleForBehavior(behavior) { return BEHAVIOR_ROLE[behavior] || 'scout'; }

export function monsterVitality(kind, stage, isElite = false) {
  const behavior = MONSTERS[kind]?.behavior;
  const role = roleForBehavior(behavior);
  const spec = MONSTER_ROLES[role];
  const growth = role === 'armored' || role === 'summoner' ? Math.floor((stage?.index || 0) / 8) * 8 : 0;
  const hp = (isElite ? Math.max(64, spec.hp + 32) : spec.hp) + growth;
  return { role, hp, touchDamage: spec.touch, period: spec.period, showBar: spec.bar || !!isElite };
}
