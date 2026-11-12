// 先预告再行动；弹道只在附近更新，碰撞仍使用游戏原有的温柔击退与保护。
export function stepAdventureEnemies(enemies, players, dt, elapsed, projectiles) {
  for (const enemy of enemies) {
    if (enemy.isDefeated || enemy.isDormant) continue;
    enemy.elapsed += dt * (enemy.slowUntil > elapsed ? 0.35 : 1);
    const cycle = (enemy.elapsed + enemy.phase) % 3.6;
    const slow = enemy.slowUntil > elapsed ? 0.35 : 1;
    enemy.isWarning = cycle > 1.9 && cycle < 2.5;
    let speed = enemy.speed;
    enemy.y = enemy.baseY;
    if (enemy.behavior === 'float') enemy.y += Math.sin(enemy.elapsed * 1.5 + enemy.phase) * 0.7;
    if (enemy.behavior === 'dart') { speed *= cycle < 2.5 ? 0.1 : 3; enemy.y += Math.sin(enemy.elapsed * 2) * 0.9; }
    if (['hop', 'leap', 'bounce'].includes(enemy.behavior)) {
      const height = enemy.behavior === 'bounce' ? 2.6 : enemy.behavior === 'leap' ? 1.5 : 0.7;
      enemy.y += cycle >= 2.5 ? Math.sin((cycle - 2.5) / 1.1 * Math.PI) * height : 0;
      speed *= cycle < 2.5 ? 0.2 : 1.8;
    }
    if (['roll', 'charge', 'scuttle'].includes(enemy.behavior)) speed *= cycle < 2.5 ? 0.12 : enemy.behavior === 'charge' ? 4 : 2.7;
    if (['bubble', 'fan', 'lob'].includes(enemy.behavior)) {
      speed = 0;
      const beat = Math.floor((enemy.elapsed + enemy.phase) / 3.6);
      if (cycle > 2.5 && enemy.lastShotBeat !== beat) {
        enemy.lastShotBeat = beat;
        const target = players.reduce((a, b) => Math.abs(a.x - enemy.x) < Math.abs(b.x - enemy.x) ? a : b);
        enemy.direction = Math.sign(target.x - enemy.x) || 1;
        const slopes = enemy.behavior === 'fan' ? [-0.35, 0, 0.35] : [enemy.behavior === 'lob' ? 1.1 : 0];
        for (const slope of slopes) projectiles.push({ x: enemy.x, y: enemy.y + 1, vx: enemy.direction * 4, vy: slope * 4, gravity: enemy.behavior === 'lob' ? 6 : 0, age: 0, kind: enemy.behavior, id: `${enemy.id}:${beat}:${slope}`, isActive: true });
      }
    }
    if (enemy.isWarning && enemy.behavior !== 'float') speed = 0;
    enemy.x += enemy.direction * speed * slow * dt;
    if (enemy.x >= enemy.maxX) { enemy.x = enemy.maxX; enemy.direction = -1; }
    if (enemy.x <= enemy.minX) { enemy.x = enemy.minX; enemy.direction = 1; }
  }
  for (const shot of projectiles) {
    shot.age += dt; shot.vy -= shot.gravity * dt; shot.x += shot.vx * dt; shot.y += shot.vy * dt;
    if (shot.age > 4) shot.isActive = false;
  }
}
export function releaseCandyChildren(enemy, all) {
  for (const id of enemy.childIds || []) {
    const child = all[id - 1];
    child.isDormant = false; child.x = enemy.x + child.direction * 0.5; child.y = enemy.baseY; child.baseY = enemy.baseY;
  }
}
