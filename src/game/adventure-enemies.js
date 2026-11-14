// 先预告再行动；弹道只在附近更新，碰撞仍使用游戏原有的温柔击退与保护。
export function stepAdventureEnemies(enemies, players, dt, elapsed, projectiles, options = {}) {
  const active = options.bounds ? enemies.filter(e => !e.isDefeated && !e.isDormant && !e.isBoss && Math.abs(e.y-players[0].y)<12 && e.x > options.bounds.left && e.x < options.bounds.right)
    .sort((a,b) => Math.abs(a.x-players[0].x)-Math.abs(b.x-players[0].x)).slice(0, options.maxAttackers || 4) : enemies;
  for (const enemy of enemies) {
    if (enemy.isDefeated || enemy.isDormant || enemy.isBoss) continue;
    enemy.isWaiting = !active.includes(enemy);
    if (enemy.isWaiting || enemy.boundUntil > elapsed || enemy.frozenUntil > elapsed) { enemy.isWarning = false; continue; }
    enemy.elapsed += dt * (enemy.slowUntil > elapsed ? 0.35 : 1);
    const cycle = (enemy.elapsed + enemy.phase) % 3.6;
    const slow = enemy.slowUntil > elapsed ? 0.35 : 1;
    enemy.isWarning = cycle > 1.9 && cycle < 2.5;
    let speed = enemy.speed;
    const target = options.lure && options.lure.until > elapsed && Math.abs(enemy.x-options.lure.x) < 9 ? options.lure : players.reduce((a,b) => Math.abs(a.x-enemy.x) < Math.abs(b.x-enemy.x) ? a : b);
    const beat = Math.floor((enemy.elapsed + enemy.phase) / 3.6);
    const isActing = cycle >= 2.5;
    const emit = (kind, vx, vy, y = enemy.baseY + 0.8, life = 4) => projectiles.push({ x: enemy.x, y, vx, vy, gravity: 0, age: 0, kind, life, id: `${enemy.id}:${beat}:${projectiles.length}`, isActive: true });
    enemy.y = enemy.baseY;
    enemy.isHidden = false; enemy.isGuarding = false;
    if(enemy.behavior==='swoop'){enemy.y+=isActing?3-Math.sin((cycle-2.5)/1.1*Math.PI)*3:3;speed*=isActing?3.5:.08;}
    if(enemy.behavior==='balloon'){enemy.y+=2.3+Math.sin(enemy.elapsed*.8)*2.3;speed*=.25;}
    if(enemy.behavior==='iceslide'){speed*=enemy.hasShell?.08:isActing?3.6:.08;enemy.isGuarding=false;}
    if(enemy.behavior==='twins'){enemy.isGuarding=cycle<1.7;speed=0;}
    if(['inklob','breeze'].includes(enemy.behavior))speed=0;
    if(enemy.behavior==='breeze'&&isActing)for(const other of active)if(other!==enemy&&Math.abs(other.x-enemy.x)<9){other.direction=Math.sign(target.x-other.x)||1;other.windUntil=elapsed+.5;}
    if(enemy.windUntil>elapsed)speed*=1.35;
    if (enemy.behavior === 'glide') { enemy.y += isActing ? Math.max(0, 3 * (1 - (cycle - 2.5) / 1.1)) : 0; speed *= isActing ? 0.6 : 0.15; }
    if (enemy.behavior === 'inkhop') { enemy.y += isActing ? Math.sin((cycle-2.5)/1.1*Math.PI) * (beat % 2 ? 1.8 : 0.8) : 0; speed *= isActing ? 2 : 0.1; }
    if (enemy.behavior === 'guard') { enemy.isGuarding = cycle < 2.5; speed *= isActing ? 2.4 : 0.1; }
    if (enemy.behavior === 'crawl') { speed *= 0.6; enemy.y += Math.sin(enemy.elapsed*4)*0.08; }
    if (enemy.behavior === 'orbit') { enemy.y += 1.8 + Math.sin(enemy.elapsed*2)*1.1; speed *= isActing ? 3 : 0.3; }
    if (enemy.behavior === 'drop') { enemy.y += cycle < 2.5 ? 3.6 : Math.max(0, 3.6-(cycle-2.5)*9); speed *= cycle > 2.9 ? 0.7 : 0; }
    if (enemy.behavior === 'burrow') { enemy.isHidden = cycle < 1.4; speed = 0; if (enemy.isHidden) enemy.x = beat % 2 ? enemy.minX : enemy.maxX; }
    if (['vine','alarm','stomp','build','summon','obstacle'].includes(enemy.behavior)) speed = 0;
    const canAct = () => !options.attackGate || elapsed >= options.attackGate.next;
    const claimAction = () => { if (options.attackGate) options.attackGate.next = elapsed + 0.7; };
    if (isActing && enemy.lastActionBeat !== beat && (!['vine','stomp','alarm','summon','build'].includes(enemy.behavior) || canAct())) {
      enemy.lastActionBeat = beat;
      if (['vine','stomp','alarm','summon','build'].includes(enemy.behavior)) claimAction();
      enemy.direction = Math.sign(target.x-enemy.x) || enemy.direction;
      if (enemy.behavior === 'vine') emit('vine', enemy.direction*2.2, 0, enemy.baseY+0.2, 1.2);
      if (enemy.behavior === 'inkhop') emit('ink', 0, 0, enemy.baseY+0.12, 2.5);
      if (enemy.behavior === 'stomp') { emit('shock', -3.5, 0, enemy.baseY+0.15, 2); emit('shock', 3.5, 0, enemy.baseY+0.15, 2); }
      if (['alarm','summon','build'].includes(enemy.behavior) && !enemy.isSummoned) {
        enemy.isSummoned = true;
        releaseCandyChildren(enemy, options.allEnemies || enemies);
      }
    }
    if (options.lure && target === options.lure) enemy.direction = Math.sign(target.x-enemy.x) || 1;
    if (enemy.behavior === 'float') enemy.y += Math.sin(enemy.elapsed * 1.5 + enemy.phase) * 0.7;
    if (enemy.behavior === 'dart') { speed *= cycle < 2.5 ? 0.1 : 3; enemy.y += Math.sin(enemy.elapsed * 2) * 0.9; }
    if (['hop', 'leap', 'bounce'].includes(enemy.behavior)) {
      const height = enemy.behavior === 'bounce' ? 2.6 : enemy.behavior === 'leap' ? 1.5 : 0.7;
      enemy.y += cycle >= 2.5 ? Math.sin((cycle - 2.5) / 1.1 * Math.PI) * height : 0;
      speed *= cycle < 2.5 ? 0.2 : 1.8;
    }
    if (['roll', 'charge', 'scuttle'].includes(enemy.behavior)) speed *= cycle < 2.5 ? 0.12 : enemy.behavior === 'charge' ? 4 : 2.7;
    if (['bubble', 'fan', 'lob','inklob','twins'].includes(enemy.behavior)) {
      speed = 0;
      const beat = Math.floor((enemy.elapsed + enemy.phase) / 3.6);
      if (cycle > 2.5 && enemy.lastShotBeat !== beat && canAct()) {
        enemy.lastShotBeat = beat; claimAction();
        enemy.direction = Math.sign(target.x - enemy.x) || 1;
        const slopes = enemy.behavior === 'fan' ? [-0.35, 0, 0.35] : [['lob','inklob'].includes(enemy.behavior) ? 1.1 : 0];
        for (const slope of slopes) projectiles.push({ x: enemy.x, y: enemy.y + 1, vx: enemy.direction * 4, vy: slope * 4, floorY:enemy.behavior==='inklob'?enemy.baseY+.1:undefined,gravity: ['lob','inklob'].includes(enemy.behavior) ? 6 : 0, age: 0, kind: enemy.behavior, id: `${enemy.id}:${beat}:${slope}`, isActive: true });
      }
    }
    if (enemy.isWarning && enemy.behavior !== 'float') speed = 0;
    enemy.x += enemy.direction * speed * slow * dt;
    if (enemy.x >= enemy.maxX) { enemy.x = enemy.maxX; enemy.direction = -1; }
    if (enemy.x <= enemy.minX) { enemy.x = enemy.minX; enemy.direction = 1; }
  }
  for (const shot of projectiles) {
    if (shot.turnAt !== undefined && !shot.isReturning && shot.age >= shot.turnAt) { shot.vx *= -1; shot.vy *= -1; shot.isReturning=true; }
    shot.age += dt; shot.vy -= shot.gravity * dt; shot.x += shot.vx * dt; shot.y += shot.vy * dt;
    if(shot.kind==='inklob' && shot.y<=shot.floorY){shot.kind='ink';shot.y=shot.floorY;shot.vx=0;shot.vy=0;shot.gravity=0;shot.age=0;shot.life=2.5;}
    if (shot.floorY !== undefined && shot.y < shot.floorY && shot.vy < 0) { shot.y=shot.floorY;shot.vy=Math.abs(shot.vy)*0.8;shot.bounces++;if(shot.bounces>3)shot.isActive=false; }
    if (shot.age > (shot.life || 4)) shot.isActive = false;
  }
}
export function releaseCandyChildren(enemy, all) {
  for (const id of enemy.childIds || []) {
    const child = all.find(e => e.id === id);
    if (!child || child.isDefeated || !child.isDormant) continue;
    child.isDormant = false; child.x = enemy.x + child.direction * 0.5; child.y = enemy.baseY; child.baseY = enemy.baseY;
  }
}
