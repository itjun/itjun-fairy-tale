import { takeDamage } from './characters.js';

export function newResources() {
  return { balance: 0, petals: 0, snack: 0, reserveHearts: 0, kills: 0, wreathShield: 0, bindCooldown: 0, lureCooldown: 0, cleanseCooldown: 0,
    armorZones: [], clearedZones: [], courageLevels: [], camps: [], routes: [], rewardedEnemies: [] };
}
export function resourcesFor(adventure) { return adventure.resources ||= newResources(); }
export function isValidResources(r) {
  if (r === undefined) return true; // 旧背包加载后再补充，不改变原生命和奖励。
  if (!r || typeof r !== 'object') return false;
  const counters = ['balance', 'petals', 'snack', 'kills', 'wreathShield'];
  const lists = ['armorZones', 'clearedZones', 'courageLevels', 'camps', 'routes', 'rewardedEnemies'];
  return counters.every(k => Number.isSafeInteger(r[k]) && r[k] >= 0 && r[k] <= 100000)
    && ['rerolls','tierUp'].every(k => r[k] === undefined || Number.isInteger(r[k]) && r[k] >= 0 && r[k] <= 9)
    && r.snack <= 1 && r.wreathShield <= 1 && (r.reserveHearts===undefined||[0,2,25].includes(r.reserveHearts))
    && ['bindCooldown', 'lureCooldown', 'cleanseCooldown'].every(k => Number.isFinite(r[k]) && r[k] >= 0 && r[k] <= 8)
    && lists.every(k => Array.isArray(r[k]) && r[k].length <= 10000 && new Set(r[k]).size === r[k].length && r[k].every(id => typeof id === 'string' && id.length < 120));
}
export function heal(survival, amount = 25) {
  if (survival.phase !== 'alive' || survival.hp >= survival.maxHp) return false;
  survival.hp = Math.min(survival.maxHp, survival.hp + amount); survival.revision++;
  return true;
}
export function useRecovery(adventure, survival, powers, isHurt = false) {
  const r = resourcesFor(adventure);
  if (survival.phase !== 'alive' || survival.hp >= survival.maxHp) return false;
  if (isHurt && r.reserveHearts) { const amount=r.reserveHearts === 2 ? 25 : r.reserveHearts;r.reserveHearts=0;return heal(survival,amount); }
  if (isHurt && powers.snack && r.snack) { r.snack--; return heal(survival); }
  if (powers.petal && r.petals >= 12) { r.petals -= 12; return heal(survival,10); }
  return false;
}
export function damageWithBuild(adventure, survival, powers, levelKey, zone, isFall = false, amount = isFall ? 25 : 10) {
  const r = resourcesFor(adventure), zoneKey = `${levelKey}:${zone}`;
  if (survival.phase !== 'alive') return false;
  if (!isFall && !(survival.character === 'dad' && survival.shieldRemaining <= 0)) {
    if (powers.armor && !r.armorZones.includes(zoneKey)) { r.armorZones.push(zoneKey); return 'armor'; }
    if (powers.wreath && r.wreathShield) { r.wreathShield = 0; return 'armor'; }
  }
  if (!isFall && powers.courage && survival.hp <= survival.maxHp * .2 && !r.courageLevels.includes(levelKey)) { r.courageLevels.push(levelKey); return 'courage'; }
  const result = takeDamage(survival, isFall, amount);
  if (result === 'hurt') useRecovery(adventure, survival, powers, true);
  return result;
}
export function recordDefeat(adventure, survival, powers, enemy, levelKey) {
  const r = resourcesFor(adventure), key = `${levelKey}:${enemy.id}`;
  if (r.rewardedEnemies.includes(key)) return null;
  r.rewardedEnemies.push(key); r.kills++;
  if (powers.petal && !enemy.parentId && !enemy.isBoss) r.petals++;
  let message = '';
  if (useRecovery(adventure, survival, powers)) message = '花瓣或备用点心恢复了血量';
  return { message, milestone: null };
}
export function completeEncounter(adventure, powers, world, zone, levelKey) {
  const r = resourcesFor(adventure), key = `${levelKey}:${zone}`;
  const enemies = world.enemies.filter(e => e.zone === zone);
  // 未召唤子怪在父怪被击败后不阻碍清场；已经召唤的仍需击败。
  if (!enemies.length || enemies.some(e => !e.isDefeated && !(e.isDormant && e.parentId && world.enemies[e.parentId - 1].isDefeated)) || r.clearedZones.includes(key)) return false;
  r.clearedZones.push(key);
  if (powers.wreath) r.wreathShield = 1;
  return true;
}
export function tickResources(adventure, dt) {
  const r = resourcesFor(adventure);
  for (const key of ['bindCooldown', 'lureCooldown', 'cleanseCooldown']) r[key] = Math.max(0, r[key] - dt);
}
