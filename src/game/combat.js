// 固定步长内用线段扫过目标，光波再快也不会穿过小怪。
export function damageEnemy(enemy, elapsed = enemy.elapsed, source) {
  enemy.lastDamage = 0; enemy.lastBlocked = 0;
  if (enemy.isDefeated || enemy.isHidden || enemy.isDormant) return false;
  if(enemy.hasShell){enemy.hasShell=false;enemy.hitUntil=elapsed+.2;enemy.lastBlocked=Math.round(source?.damage || 12);return false;}
  // 首领放完招露出破绽时，打中伤害翻倍。
  const damage = enemy.combatVersion === 2 ? Math.max(1, Math.round((source?.damage || 12) * (enemy.attackStage === 'weak' ? 2 : 1))) : 1;
  if (enemy.isGuarding && source && Math.sign(source.x-enemy.x) === enemy.direction) { enemy.guardHits = (enemy.guardHits || 0) + 1; if (enemy.guardHits % 2) { enemy.hitUntil = elapsed + 0.16; enemy.lastBlocked = damage; return false; } }
  const reduced = enemy.isShielded ? Math.max(1, Math.round(damage * 0.7)) : damage;
  let actual = reduced;
  // 叠了很多武器时，同一小段时间里首领最多掉一成二的血，一发打不倒。单把武器一发用不满这个上限。
  if (enemy.isBoss && enemy.maxHp) {
    const cap = Math.max(1, Math.round(enemy.maxHp * 0.12));
    if (!(elapsed < enemy.hurtUntil)) { enemy.hurtUntil = elapsed + 0.45; enemy.hurtTaken = 0; }
    actual = Math.min(actual, Math.max(0, cap - enemy.hurtTaken));
    enemy.hurtTaken += actual;
  }
  enemy.lastBlocked = damage - reduced; enemy.lastDamage = Math.min(enemy.hp ?? 1, actual);
  enemy.hp = Math.max(0, (enemy.hp ?? 1) - actual);
  enemy.hitUntil = elapsed + 0.16;
  if (enemy.hp) return false;
  enemy.isDefeated = true; enemy.defeatedAt = elapsed;
  return true;
}
export function fireWave(player, elapsed, bounds = { left: -18, right: 18 }) {
  if (elapsed < (player.nextShot || 0)) return null;
  player.nextShot = elapsed + 0.4; player.attackUntil = elapsed + 0.22;
  const x = player.x + player.facing * 0.6;
  const endX = player.facing > 0 ? bounds.right + 2 : bounds.left - 2;
  const remaining = Math.max(2, (endX - x) * player.facing);
  return { kind: 'blade', x, y: player.y + 1.05, direction: player.facing, remaining,
    speed: Math.max(36, remaining / 0.75), slope: 0, age: 0, hitIds: new Set(), isActive: true };
}

export function fireSkill(player, elapsed, bounds, kind = 'blade') {
  const wave = fireWave(player, elapsed, bounds);
  if (!wave) return [];
  if (kind === 'blade') return [wave];
  player.nextShot = elapsed + (kind === 'bubble' ? 0.65 : 0.55);
  if (kind === 'bubble') return [{ ...wave, kind, speed: 22, slope: 0.04 }];
  return [-0.32, -0.16, 0, 0.16, 0.32].map(slope => ({ ...wave, kind: 'stars', slope, hitIds: new Set() }));
}

// 线段与扩大的怪物矩形相交，适用于宽屏高速光刃与斜向星弹。
function contactTime(x, y, dx, dy, enemy, radius) {
  let entry = 0, exit = 1;
  for (const [start, delta, min, max] of [
    [x, dx, enemy.x - enemy.width / 2 - radius, enemy.x + enemy.width / 2 + radius],
    [y, dy, enemy.y - radius, enemy.y + enemy.height + radius],
  ]) {
    if (Math.abs(delta) < 1e-9) { if (start < min || start > max) return null; }
    else {
      const a = (min - start) / delta, b = (max - start) / delta;
      entry = Math.max(entry, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
      if (entry > exit) return null;
    }
  }
  return entry;
}

const contactScratch = [];
export function stepWave(wave, enemies, _platforms, dt, elapsed) {
  if (!wave.isActive) return [];
  const source = { x: wave.x, damage: wave.damage };
  const distance = Math.min(wave.remaining, wave.speed * dt);
  const dx = (wave.kind==='moonblade'?wave.headingX:wave.direction) * distance, dy = (wave.kind==='moonblade'?wave.headingY:wave.slope) * distance;
  const radius = wave.kind === 'bubble' ? 0.65 : (wave.radius ?? 0.25);
  const minX = Math.min(wave.x, wave.x + dx) - radius, maxX = Math.max(wave.x, wave.x + dx) + radius;
  const minY = Math.min(wave.y, wave.y + dy) - radius, maxY = Math.max(wave.y, wave.y + dy) + radius;
  contactScratch.length = 0;
  for (const enemy of enemies) {
    if (enemy.isDefeated || enemy.isHidden || enemy.isDormant || wave.hitIds.has(enemy.id)) continue;
    if (enemy.x + enemy.width / 2 < minX || enemy.x - enemy.width / 2 > maxX || enemy.y + enemy.height < minY || enemy.y > maxY) continue;
    const time = contactTime(wave.x, wave.y, dx, dy, enemy, radius);
    if (time !== null) contactScratch.push({ enemy, time });
  }
  if (contactScratch.length > 1) contactScratch.sort((a, b) => a.time - b.time);
  const contacts = contactScratch;
  const fraction = ['bubble','stars'].includes(wave.kind) && contacts.length ? contacts[0].time : 1;
  wave.x += dx * fraction; wave.y += dy * fraction; wave.remaining -= distance; wave.age += dt;
  if (wave.remaining <= 0) wave.isActive = false;
  let targets = contacts.map(hit => hit.enemy);
  if (wave.kind === 'stars' && targets.length) { targets = targets.slice(0,1); wave.isActive = false; }
  if (wave.kind === 'bubble' && (contacts.length || !wave.isActive)) {
    wave.isActive = false;
    wave.burst = { x: wave.x, y: wave.y, radius: wave.burstRadius ?? 3.8 };
    // 大型首领边缘已被直接击中，即使中心在爆圈之外也保留这次命中。
    const directIds = new Set(targets.map(e=>e.id));
    targets = enemies.filter(e => !e.isDefeated && !e.isHidden && !e.isDormant && (directIds.has(e.id) || Math.hypot(e.x - wave.x, e.y + e.height / 2 - wave.y) <= (wave.burstRadius ?? 3.8)));
  }
  return targets.filter(enemy => !wave.hitIds.has(enemy.id)).map(enemy => {
    wave.hitIds.add(enemy.id);
    const isDefeated = damageEnemy(enemy, elapsed, source);
    return { enemy, isDefeated, damage:enemy.lastDamage, blocked:enemy.lastBlocked };
  });
}
export function moveCampaignPlatforms(lifts, elapsed) {
  for (const p of lifts) {
    const x=p.x,y=p.y, offset=(1-Math.cos(elapsed/p.period*Math.PI*2))*p.travel/2;
    p.x=p.baseX+(p.axis==='x'?offset:0); p.y=p.baseY+(p.axis==='y'?offset:0);
    p.deltaX=p.x-x; p.deltaY=p.y-y;
  }
}
