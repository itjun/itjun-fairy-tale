import { takeDamage } from './characters.js';

export function newResources() {
  return { balance: 0, petals: 0, snack: 0, kills: 0, wreathShield: 0, bindCooldown: 0, lureCooldown: 0, cleanseCooldown: 0,
    armorZones: [], clearedZones: [], courageLevels: [], camps: [], routes: [], rewardedEnemies: [] };
}
export function resourcesFor(adventure) { return adventure.resources ||= newResources(); }
export function isValidResources(r) {
  if (r === undefined) return true; // 旧背包加载后再补充，不改变原生命和奖励。
  if (!r || typeof r !== 'object') return false;
  const counters = ['balance', 'petals', 'snack', 'kills', 'wreathShield'];
  const lists = ['armorZones', 'clearedZones', 'courageLevels', 'camps', 'routes', 'rewardedEnemies'];
  return counters.every(k => Number.isSafeInteger(r[k]) && r[k] >= 0 && r[k] <= 100000)
    && r.snack <= 1 && r.wreathShield <= 1
    && ['bindCooldown', 'lureCooldown', 'cleanseCooldown'].every(k => Number.isFinite(r[k]) && r[k] >= 0 && r[k] <= 8)
    && lists.every(k => Array.isArray(r[k]) && r[k].length <= 10000 && new Set(r[k]).size === r[k].length && r[k].every(id => typeof id === 'string' && id.length < 120));
}
export function heal(survival, amount = 1) {
  if (survival.phase !== 'alive' || survival.hp >= 3) return false;
  survival.hp = Math.min(3, survival.hp + amount); survival.revision++;
  return true;
}
export function collectFood(adventure, survival, powers) {
  if (heal(survival)) return '恢复了 1 格体力';
  if (powers.snack && survival.phase === 'alive' && !resourcesFor(adventure).snack) {
    adventure.resources.snack = 1; return '存好一份备用点心';
  }
  resourcesFor(adventure).balance++; return '满血补给换成了 1 片碎片';
}
export function useRecovery(adventure, survival, powers) {
  const r = resourcesFor(adventure);
  if (survival.phase !== 'alive' || survival.hp >= 3) return false;
  if (powers.snack && r.snack) { r.snack--; return heal(survival); }
  if (powers.petal && r.petals >= 6) { r.petals -= 6; return heal(survival); }
  return false;
}
export function damageWithBuild(adventure, survival, powers, levelKey, zone, isFall = false) {
  const r = resourcesFor(adventure), zoneKey = `${levelKey}:${zone}`;
  if (survival.phase !== 'alive') return false;
  if (!isFall && !(survival.character === 'dad' && survival.shieldRemaining <= 0)) {
    if (powers.armor && !r.armorZones.includes(zoneKey)) { r.armorZones.push(zoneKey); return 'armor'; }
    if (powers.wreath && r.wreathShield) { r.wreathShield = 0; return 'armor'; }
  }
  const result = takeDamage(survival, isFall);
  if (result === 'hurt') {
    if (powers.courage && survival.hp === 1 && !r.courageLevels.includes(levelKey)) {
      r.courageLevels.push(levelKey); useRecovery(adventure, survival, powers); return 'courage';
    }
    useRecovery(adventure, survival, powers);
  }
  return result;
}
export function recordDefeat(adventure, survival, powers, enemy, levelKey) {
  const r = resourcesFor(adventure), key = `${levelKey}:${enemy.id}`;
  if (r.rewardedEnemies.includes(key)) return null;
  r.rewardedEnemies.push(key); r.kills++; r.balance++;
  if (powers.petal) r.petals++;
  let message = '';
  if (enemy.isElite && powers.pocket) { r.balance += 2; message = collectFood(adventure, survival, powers); }
  else if (r.kills % 6 === 0) message = collectFood(adventure, survival, powers);
  if (useRecovery(adventure, survival, powers)) message = '花瓣或备用点心恢复了体力';
  return { message, milestone: r.kills === 6 || r.kills > 6 && (r.kills - 6) % 8 === 0 ? r.kills : null };
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
export function completeRoute(adventure, powers, levelKey, zone) {
  const r = resourcesFor(adventure), key = `${levelKey}:${zone}`;
  if (r.routes.includes(key)) return false;
  r.routes.push(key);
  if (powers.explorer) r.balance += 3;
  return !!powers.explorer;
}
export function campPrice(powers) { return powers.thrift ? 3 : 5; }
export function buyRecovery(adventure, survival, powers, campKey) {
  const r = resourcesFor(adventure), price = campPrice(powers);
  if (survival.phase !== 'alive' || survival.hp >= 3 || r.camps.includes(campKey) || r.balance < price) return false;
  r.balance -= price; r.camps.push(campKey); heal(survival); adventure.revision++; return true;
}
export function tickResources(adventure, dt) {
  const r = resourcesFor(adventure);
  for (const key of ['bindCooldown', 'lureCooldown', 'cleanseCooldown']) r[key] = Math.max(0, r[key] - dt);
}
