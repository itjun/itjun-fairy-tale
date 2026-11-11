import { earnedQuests } from './garden-progress.js';
import { MINI_GAMES, readMiniSession } from './mini-games/session.js';

export const GARDEN_BACKUP_LIMIT = 524288;

export function readMiniGames(data, isStrict = false) {
  if (data === undefined) return {};
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    if (isStrict) throw new Error('小游戏存档格式不正确。');
    return {};
  }
  const sessions = {};
  for (const id of Object.keys(MINI_GAMES)) {
    if (data[id] === undefined) continue;
    const session = readMiniSession(data[id], id);
    if (!session && isStrict) throw new Error('小游戏存档不完整，请选择完整的花园备份。');
    if (session) sessions[id] = session;
  }
  return sessions;
}

export function readGardenBackup(text) {
  if (text.length > GARDEN_BACKUP_LIMIT) throw new Error('备份文件太大了，请选择花园进度文件。');
  const input = JSON.parse(text), p = input?.progress;
  if (input?.type !== 'garden-progress' || ![1, 2].includes(input.version) || !p || !Number.isInteger(p.rainbow) || p.rainbow < 0 || p.rainbow > 6 || !Array.isArray(p.flowers) || p.flowers.length !== 4 || p.flowers.some(v => ![0, 1, 2].includes(v)) || !Array.isArray(p.served) || p.served.length !== 4 || p.served.some(v => typeof v !== 'boolean') || !Array.isArray(p.stamps) || p.stamps.length > 40 || p.stamps.some(v => !v || !['flower', 'heart', 'star', 'butterfly'].includes(v.type) || !Number.isFinite(v.x) || !Number.isFinite(v.y) || v.x < 0 || v.x > 100 || v.y < 0 || v.y > 100)) throw new Error('这不是有效的花园进度备份。');
  const miniGames = readMiniGames(p.miniGames, true);
  const progress = { rainbow: p.rainbow, flowers: p.flowers, served: p.served, stamps: p.stamps.map(({ type, x, y }) => ({ type, x, y })), ...(p.miniGames !== undefined ? { miniGames } : {}) };
  return { ...progress, achievements: earnedQuests({ ...progress, achievements: p.achievements }) };
}
export function mergeGardenProgress(current, incoming) {
  const stamps = [...new Map([...current.stamps, ...incoming.stamps].map(stamp => [JSON.stringify(stamp), stamp])).values()].slice(-40);
  const currentAchievements = earnedQuests(current), incomingAchievements = earnedQuests(incoming);
  const achievements = Object.fromEntries(Object.keys(currentAchievements).map(id => [id, currentAchievements[id] || incomingAchievements[id]]));
  const miniGames = { ...readMiniGames(incoming.miniGames), ...readMiniGames(current.miniGames) };
  return { rainbow: Math.max(current.rainbow, incoming.rainbow), flowers: current.flowers.map((v, i) => Math.max(v, incoming.flowers[i])), served: current.served.map((v, i) => v || incoming.served[i]), achievements, stamps, miniGames };
}
