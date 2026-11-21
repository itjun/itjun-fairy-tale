import { damageEnemy } from './combat.js';
import { breakIcicle } from './hazards.js';
import { findProjectileClash } from './projectile-clash.js';

// 刀光跟随持刀人，方向在本刀出手时确定；不会作为弹丸向前飞。
export function placeLightblade(wave, owner) {
  wave.x = owner.x + wave.direction * (wave.reach + .25) / 2;
  wave.y = owner.y + 1.05;
}

export function stepLightblade(wave, enemies, dt, elapsed, owner, hostileShots, icicles) {
  if (owner) placeLightblade(wave, owner);
  const previous = wave.age;
  wave.age += dt;
  const end = wave.delay + wave.duration;
  if (wave.age >= end) wave.isActive = false;
  if (wave.age < wave.delay || previous >= end) return [];
  const halfWidth = (wave.reach - .25) / 2;
  const clash = findProjectileClash(wave, hostileShots, halfWidth);
  if (clash) {
    wave.isActive = false;
    clash.shot.isActive = false;
    wave.clash = { x: clash.x, y: clash.y };
    return [];
  }
  const ice = findProjectileClash(wave, icicles, halfWidth);
  if (ice) {
    breakIcicle(wave, ice.shot);
    return [];
  }
  const source = { x:wave.x - wave.direction * (wave.reach + .25) / 2, damage:wave.damage };
  return enemies.filter(enemy => !enemy.isDefeated && !enemy.isHidden && !enemy.isDormant && !wave.hitIds.has(enemy.id)
    && enemy.x + enemy.width / 2 >= wave.x - halfWidth && enemy.x - enemy.width / 2 <= wave.x + halfWidth
    && enemy.y + enemy.height >= wave.y - wave.halfHeight && enemy.y <= wave.y + wave.halfHeight).map(enemy => {
    // 硬壳和护盾也算这一刀已碰到，不能一刀先破盾又连续扣血。
    wave.hitIds.add(enemy.id);
    const isDefeated = damageEnemy(enemy, elapsed, source);
    return {enemy,isDefeated,damage:enemy.lastDamage,blocked:enemy.lastBlocked};
  });
}
