import { randomGenerator } from '../../shared/random.js';

export const SKILLS = Object.freeze({
  blade: { name: '贯穿光刃', shortName: '光刃', image: 'light-wave', hint: '穿过平台与沿途小怪', duration: 0 },
  bubble: { name: '魔法泡泡', shortName: '泡泡', image: 'magic-bubble', hint: '泡泡炸开，击中周围小怪', duration: 32 },
  stars: { name: '彩虹星雨', shortName: '星雨', image: 'collectible-star', hint: '五颗星星向前散开', duration: 32 },
});

// 独立随机流，不改变版本 1 地图、宝物编号和历史积分。
export function createSkillRewards(world) {
  const random = randomGenerator((world.seed ^ 0x72ab1c39) >>> 0);
  const first = random() < 0.5 ? 0 : 1;
  const rewards = [];
  for (const zone of world.zones) {
    const homes = zone.platformIds.map(id => world.platforms[id])
      .filter(p => !p.isMoving && !p.isCheckpoint && p.gateId === undefined);
    for (const fraction of [0.05, 0.52]) {
      const index = Math.min(homes.length - 1, Math.floor(homes.length * fraction) + Math.floor(random() * 3));
      const platform = homes[index];
      if (!platform) continue;
      rewards.push({ id: rewards.length + 1, kind: ['bubble', 'stars'][(first + rewards.length) % 2],
        platformId: platform.id, x: platform.x - 1.1, y: platform.y + 1.45 });
    }
  }
  return rewards;
}

export function currentSkill(state, elapsed) {
  return state && state.until > elapsed ? state.kind : 'blade';
}

export function skillSeconds(state, elapsed) {
  return Math.max(0, Math.ceil(state.until - elapsed - 1e-6));
}

export function takeSkillReward(state, reward, elapsed) {
  if (state.collectedIds.includes(reward.id)) return false;
  state.collectedIds.push(reward.id);
  state.kind = reward.kind;
  state.until = elapsed + SKILLS[reward.kind].duration;
  return true;
}

export function isValidSkillState(state, rewards, elapsed) {
  if (state === undefined) return true; // 0.3.0 旧存档没有技能字段。
  return state !== null && ['blade', 'bubble', 'stars'].includes(state.kind)
    && Number.isFinite(state.until) && state.until >= 0 && state.until <= elapsed + 32.01
    && Array.isArray(state.collectedIds) && new Set(state.collectedIds).size === state.collectedIds.length
    && state.collectedIds.every(id => Number.isInteger(id) && rewards.some(r => r.id === id));
}
