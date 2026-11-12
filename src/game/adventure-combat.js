import { fireSkill, stepWave, damageEnemy } from './combat.js';

export function fireAdventureWeapon(player, elapsed, bounds, weapon, powers = {}) {
  const base = fireSkill(player, elapsed, bounds, ['blade', 'bubble', 'stars'].includes(weapon) ? weapon : 'blade');
  if (!base.length) return [];
  const root = base[0];
  let shots = base;
  if (weapon === 'boomerang') shots = [{ ...root, kind: weapon, speed: 22, remaining: Math.min(root.remaining, 15), originX: root.x, leg: 0 }];
  if (weapon === 'seed') shots = [{ ...root, kind: weapon, speed: 13, velocityY: 9, slope: 9 / 13, remaining: 24 }];
  if (weapon === 'firefly') shots = Array.from({ length: 1 + Number(!!powers.seek) }, (_, i) => ({ ...root, kind: weapon, speed: 18, slope: i ? 0.2 : 0, remaining: 25, hitIds: new Set() }));
  if (weapon === 'stars' && powers.fan) shots = Array.from({ length: 7 + powers.fan * 2 }, (_, i) => ({ ...root, kind: 'stars', slope: (i - (6 + powers.fan * 2) / 2) * 0.12, hitIds: new Set() }));
  if (powers.double) shots = shots.flatMap(shot => [shot, { ...shot, y: shot.y + 0.65, hitIds: new Set() }]);
  player.nextShot = elapsed + (weapon === 'bubble' || weapon === 'seed' ? 0.7 : weapon === 'boomerang' ? 0.65 : 0.4) / (1 + 0.18 * (powers.rapid || 0));
  return shots.map(shot => ({ ...shot, powers: { ...powers }, burstRadius: 3.8 + (powers.area || 0) * 0.7, radius: 0.25 + (powers.area || 0) * 0.12 + (weapon === 'blade' ? (powers.wide || 0) * 0.25 : 0), hitIds: new Set(shot.hitIds) }));
}
export function areaAttack(x, y, radius, enemies, elapsed, powers = {}) {
  return enemies.filter(e => !e.isDefeated && !e.isDormant && Math.hypot(e.x - x, e.y + e.height / 2 - y) < radius).map(enemy => {
    if (powers.frost) enemy.slowUntil = elapsed + 1.5 + powers.frost;
    return { enemy, isDefeated: damageEnemy(enemy, elapsed) };
  });
}
export function stepAdventureWave(wave, enemies, platforms, dt, elapsed) {
  if (!wave.isActive) return { hits: [], spawned: [] };
  const powers = wave.powers || {}, spawned = [];
  const active = enemies.filter(e => !e.isDormant);
  if (wave.kind === 'pulse') {
    wave.age += dt;
    if (wave.age < wave.delay) return { hits: [], spawned };
    wave.isActive = false;
    wave.burst = { x: wave.x, y: wave.y, radius: wave.radius };
    return { hits: areaAttack(wave.x, wave.y, wave.radius, active, elapsed, powers), spawned };
  }
  if (wave.kind === 'seed') { wave.velocityY -= 17 * dt; wave.slope = wave.velocityY / wave.speed; }
  if (wave.kind === 'firefly') {
    const target = active.filter(e => !e.isDefeated && (e.x - wave.x) * wave.direction > -0.5 && Math.abs(e.x - wave.x) < 18).sort((a, b) => Math.hypot(a.x - wave.x, a.y - wave.y) - Math.hypot(b.x - wave.x, b.y - wave.y))[0];
    if (target) wave.slope = Math.max(-1, Math.min(1, (target.y + target.height / 2 - wave.y) / Math.max(1, Math.abs(target.x - wave.x))));
  }
  const previousY = wave.y;
  let hits = stepWave(wave, active, platforms, dt, elapsed);
  if (wave.kind === 'seed' && (hits.length || !wave.isActive || wave.velocityY < 0 && platforms.some(p => p.isEnabled !== false && Math.abs(p.x - wave.x) < p.width / 2 && previousY >= p.y && wave.y <= p.y))) {
    wave.isActive = false;
    const radius = 2.8 + (powers.area || 0) * 0.5;
    const ids = new Set(hits.map(h => h.enemy.id));
    hits.push(...areaAttack(wave.x, wave.y, radius, active.filter(e => !ids.has(e.id)), elapsed, powers));
    wave.burst = { x: wave.x, y: wave.y, radius };
    if (powers.bloom) spawned.push({ kind: 'pulse', x: wave.x + wave.direction * 1.5, y: wave.y, radius, age: 0, delay: 0.6, isActive: true, powers });
  }
  if (wave.kind === 'bubble' && wave.burst && powers.linger) {
    for (let i = 1; i <= 2; i++) spawned.push({ kind: 'pulse', x: wave.x, y: wave.y, radius: 3.8, age: 0, delay: i * 0.65, isActive: true, powers });
  }
  if (wave.kind === 'boomerang' && !wave.isActive && wave.leg === 0) {
    wave.leg = 1; wave.isActive = true; wave.direction *= -1; wave.remaining = Math.abs(wave.x - wave.originX); wave.hitIds = new Set();
    if (powers.returnSplit) for (const slope of [-0.2, 0.2]) spawned.push({ ...wave, kind: 'stars', slope, powers: {}, hitIds: new Set() });
  }
  for (const hit of [...hits]) {
    if (powers.frost) hit.enemy.slowUntil = elapsed + 1.5 + powers.frost;
    if (powers.chain && !wave.isChained) {
      const targets = active.filter(e => !e.isDefeated && !wave.hitIds.has(e.id) && Math.hypot(e.x - hit.enemy.x, e.y - hit.enemy.y) < 4 + powers.chain).slice(0, powers.chain);
      for (const enemy of targets) { wave.hitIds.add(enemy.id); hits.push({ enemy, isDefeated: damageEnemy(enemy, elapsed) }); }
    }
    if (powers.split && !wave.isSplit) for (const slope of [-0.25, 0.25]) spawned.push({ ...wave, kind: 'stars', x: hit.enemy.x, y: hit.enemy.y + 1, slope, remaining: 8, age: 0, isActive: true, isSplit: true, powers: {}, hitIds: new Set([hit.enemy.id]) });
  }
  return { hits, spawned };
}
