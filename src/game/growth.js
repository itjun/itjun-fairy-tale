import { WEAPONS } from '../../shared/adventure-catalog.js';

export function newGrowth() { return { collected:0, power:0, hearts:0 }; }
export function isValidGrowth(g) {
  return g === undefined || !!g && Number.isInteger(g.collected) && g.collected >= 0 && g.collected < 4 && ['power','hearts'].every(key => Number.isInteger(g[key]) && g[key] >= 0 && g[key] <= 100);
}
export function grow(adventure, survival, kind, amount = 1) {
  if (!survival || survival.phase !== 'alive') return false;
  const g = adventure.growth ||= newGrowth();
  if (kind === 'heart') {
    const gained = Math.min(amount, 99 - (survival.maxLives || 9));
    if (gained <= 0) return false;
    survival.maxLives = (survival.maxLives || 9) + gained;
    survival.lives += gained; survival.revision++; g.hearts += gained;
  } else if (kind === 'power') g.power = Math.min(100, g.power + amount);
  else return false;
  adventure.revision++; return true;
}
export function collectGrowth(adventure, survival) {
  const g = adventure.growth ||= newGrowth();
  g.collected++;
  if (g.collected < 4) return false;
  g.collected = 0; grow(adventure,survival,'heart'); grow(adventure,survival,'power'); return true;
}
export function weaponDamage(id, power = 0, rank = 1) { return Math.max(1, Math.round(WEAPONS[id].damage * (1 + power * 0.1 + (rank-1)*0.2))); }
