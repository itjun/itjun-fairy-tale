// 9 类小怪 + 南瓜头 + 幽灵 + Boss 召唤怪 AI 与敌人弹幕逻辑。

import { WALL_LEFT, WALL_RIGHT, findSupportY, resolveWallX, slopeAt } from './floors.js';
import { nextRng, spawnPopup } from './items.js';

export function makeEnemy(s, kind, x, y, dir = 1, extra = {}) {
  return {
    id: ++s.serial,
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    dir: dir || 1,
    snow: 0,
    thawTimer: 0,
    aiTimer: Math.floor(nextRng(s) * 40),
    spinTimer: 0,
    chargeTimer: 0,
    rollTimer: 0,
    fuseTimer: kind === 'bombJoe' ? 300 : 0,
    onGround: false,
    ...extra,
  };
}

export function nearestPlayer(s, x, y) {
  let best = null;
  let dist = Infinity;
  for (const p of s.players) {
    if (!p.active || p.state !== 'alive') continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < dist) {
      dist = d;
      best = p;
    }
  }
  return best || s.players[0];
}

function enemyBlocks(s, x, y, selfId) {
  for (const m of s.enemies) {
    if (m.id === selfId || m.snow <= 0 || m.snow >= 9) continue;
    if (Math.abs(m.x - x) < 12 && Math.abs(m.y - y) < 12) return true;
  }
  return false;
}

export function updateEnemies(s, floorDef, onPlayerHit) {
  const speedScale = s.timeMode ? 1.15 : 1 + Math.min(0.32, s.floor * 0.005);

  for (let i = s.enemies.length - 1; i >= 0; i--) {
    const e = s.enemies[i];
    e.aiTimer++;

    // 解冻衰减
    if (e.snow > 0) {
      e.thawTimer--;
      if (e.thawTimer <= 0) {
        e.snow--;
        e.thawTimer = 50;
      }
      // 被部分雪包裹时暂停移动（除非正在滚动）
      if (e.rollTimer <= 0 && e.spinTimer <= 0) continue;
    }

    const target = nearestPlayer(s, e.x, e.y);

    // 蓝蝙蝠、旋风状态、幽灵、南瓜头使用空中移动
    if (e.kind === 'blueBat') {
      e.x += e.dir * 0.85 * speedScale;
      e.y += Math.sin(e.aiTimer * 0.08) * 0.65;
      if (e.x <= WALL_LEFT + 8 || e.x >= WALL_RIGHT - 8) e.dir = -e.dir;
      e.y = Math.max(36, Math.min(212, e.y));
    } else if (e.kind === 'ghost') {
      const dx = target.x - e.x;
      const dy = target.y - e.y;
      const len = Math.hypot(dx, dy) || 1;
      e.x += (dx / len) * 0.82;
      e.y += (dy / len) * 0.82;
    } else if (e.kind === 'pumpkin') {
      const dx = target.x - e.x;
      const dy = target.y - e.y;
      const len = Math.hypot(dx, dy) || 1;
      const spd = Math.min(1.35, 0.72 + s.pumpkinElapsed * 0.0004);
      e.x += (dx / len) * spd;
      e.y += (dy / len) * spd;
      if (e.aiTimer % 220 === 0 && s.enemies.filter((m) => m.kind === 'ghost').length < 6) {
        s.enemies.push(makeEnemy(s, 'ghost', e.x, e.y, 1));
      }
    } else if (e.kind === 'sumo') {
      // 相扑手坚守顶台，定期向下四向散射能量球
      e.dir = target.x >= e.x ? 1 : -1;
      if (e.aiTimer % 130 === 60) {
        for (const angle of [0.85, 1.35, 1.79, 2.29]) {
          s.hazards.push({
            id: ++s.serial,
            kind: 'orb',
            x: e.x,
            y: e.y - 6,
            vx: Math.cos(angle) * 1.35,
            vy: Math.sin(angle) * 1.35,
            life: 210,
          });
        }
      }
    } else if (e.kind === 'tornado' && e.spinTimer > 0) {
      e.spinTimer--;
      const dx = target.x - e.x;
      const dy = target.y - e.y;
      const len = Math.hypot(dx, dy) || 1;
      e.x += (dx / len) * 1.25;
      e.y += (dy / len) * 1.05;
      e.x = Math.max(WALL_LEFT + 8, Math.min(WALL_RIGHT - 8, e.x));
      e.y = Math.max(36, Math.min(224, e.y));
    } else {
      // 地面平台寻路与动作
      let moveSpd = 0.72 * speedScale;
      if (e.kind === 'ogre') moveSpd = e.chargeTimer > 0 ? 1.85 : 0.92;
      if (e.kind === 'goblin' && e.rollTimer > 0) {
        e.rollTimer--;
        moveSpd = 1.65;
      }
      if (e.kind === 'bombJoe') {
        e.fuseTimer--;
        if (e.fuseTimer <= 0) {
          s.hazards.push({ id: ++s.serial, kind: 'blast', x: e.x, y: e.y - 8, vx: 0, vy: 0, life: 22, r: 16 });
          s.enemies.splice(i, 1);
          continue;
        }
      }

      const sl = slopeAt(floorDef, e.x, e.y);
      if (e.kind === 'goblin' && sl && e.onGround) {
        e.dir = sl.downDir || e.dir;
        e.rollTimer = 24;
      }

      const nextX = e.x + e.dir * moveSpd;
      const wallRes = resolveWallX(floorDef, nextX, e.y, 7);
      if (wallRes.hit || enemyBlocks(s, wallRes.x, e.y, e.id)) {
        e.dir = -e.dir;
      } else {
        e.x = wallRes.x;
      }

      // 物理重力与落台
      const prevY = e.y;
      e.vy = Math.min(4.0, e.vy + 0.24);
      e.y += e.vy;
      e.onGround = false;

      if (sl && e.vy >= 0) {
        e.y = sl.y;
        e.vy = 0;
        e.onGround = true;
      } else if (e.vy >= 0) {
        const sy = findSupportY(floorDef, e.x, prevY, e.y, true);
        if (sy != null) {
          e.y = sy;
          e.vy = 0;
          e.onGround = true;
        }
      }

      // 41-49 层底部循环坑：掉入后从顶部落回
      if (floorDef.pit && e.y > 238) {
        e.y = 20;
        e.vy = 0.6;
      } else if (e.y > 224 && !floorDef.pit) {
        e.y = 224;
        e.vy = 0;
        e.onGround = true;
      }

      // 跳跃决策（黄猴积极往上追、21 层起保持高位；普通怪随机上跳）
      if (e.onGround && e.kind !== 'bonusKun' && e.kind !== 'bombJoe') {
        const wantUp =
          e.kind === 'yellowMonkey'
            ? s.floor >= 21
              ? e.y > 120 || target.y < e.y - 20
              : target.y < e.y - 24
            : target.y < e.y - 26 && nextRng(s) < 0.03;
        if (wantUp && e.aiTimer % 45 === 0) {
          e.vy = -4.2;
          e.onGround = false;
        }
      }

      // 独角怪水平冲撞、紫魔 21F+ 平地滚动、喷火怪、忍者旋风/手里剑、火焰怪抛弹
      if (e.kind === 'goblin' && s.floor >= 21 && e.onGround && Math.abs(target.y - e.y) < 12 && e.aiTimer % 140 === 0) {
        e.dir = target.x >= e.x ? 1 : -1;
        e.rollTimer = 46;
      }
      if (e.kind === 'ogre' && e.onGround && Math.abs(target.y - e.y) < 14 && e.aiTimer % 95 === 0) {
        e.dir = target.x >= e.x ? 1 : -1;
        e.chargeTimer = 44;
      }
      if (e.chargeTimer > 0) e.chargeTimer--;

      if (e.kind === 'fireSpitter' && e.aiTimer % 115 === 0) {
        if (s.floor >= 21 && target.y > e.y + 24 && Math.abs(target.x - e.x) < 28) {
          s.hazards.push({ id: ++s.serial, kind: 'flame', x: e.x, y: e.y - 4, vx: 0, vy: 1.65, life: 70 });
        } else {
          const d = target.x >= e.x ? 1 : -1;
          e.dir = d;
          s.hazards.push({ id: ++s.serial, kind: 'flame', x: e.x + d * 8, y: e.y - 8, vx: d * 1.75, vy: 0, life: 48 });
        }
      }
      if (e.kind === 'tornado' && e.aiTimer % 140 === 0) {
        if (nextRng(s) < 0.52) {
          e.spinTimer = 85;
        } else {
          const d = target.x >= e.x ? 1 : -1;
          s.hazards.push({ id: ++s.serial, kind: 'shuriken', x: e.x + d * 6, y: e.y - 8, vx: d * 2.2, vy: 0, life: 80 });
        }
      }
      if (e.kind === 'fireYeti' && e.aiTimer % 130 === 0) {
        const d = target.x >= e.x ? 1 : -1;
        e.dir = d;
        s.hazards.push({ id: ++s.serial, kind: 'fireBomb', x: e.x + d * 6, y: e.y - 10, vx: d * 1.45, vy: -2.2, life: 110 });
      }
    }

    // 接触玩家判定（FC 版 Bonus Kun 无碰触致死判定！）
    if (e.kind !== 'bonusKun' && e.snow === 0) {
      for (const p of s.players) {
        if (!p.active || p.state !== 'alive') continue;
        if (Math.abs(p.x - e.x) < 11 && Math.abs(p.y - e.y) < 13) {
          if (p.giantTimer > 0) {
            if (!['pumpkin', 'ghost'].includes(e.kind)) {
              s.enemies.splice(i, 1);
              s.usedGreenThisFloor = true;
              onPlayerHit(p, 'giantKill', e);
              break;
            }
          } else if (p.invuln <= 0 && !p.ridingBallId) {
            onPlayerHit(p, 'hurt');
          }
        }
      }
    }
  }

  // 更新敌人弹幕与残火危险物
  const keepHaz = [];
  for (const h of s.hazards) {
    h.life--;
    if (h.life <= 0) continue;
    if (h.kind === 'fireBomb') {
      const prevY = h.y;
      h.x += h.vx;
      h.y += h.vy;
      h.vy += 0.14;
      const sy = findSupportY(floorDef, h.x, prevY, h.y, true);
      if (sy != null && h.vy > 0) {
        keepHaz.push({ id: ++s.serial, kind: 'firePatch', x: h.x, y: sy, vx: 0, vy: 0, life: 150 });
        continue;
      }
    } else if (h.kind === 'firePatch') {
      // 地面残火会缓缓融化附近雪球
      for (const b of s.snowballs) {
        if (b.state === 'still' && Math.hypot(b.x - h.x, b.y - h.y) < 16) b.thaw = Math.max(1, b.thaw - 3);
      }
    } else {
      h.x += h.vx;
      h.y += h.vy;
      if (h.x < WALL_LEFT || h.x > WALL_RIGHT || h.y < 12 || h.y > 236) continue;
    }

    let hitPlayer = false;
    for (const p of s.players) {
      if (!p.active || p.state !== 'alive' || p.invuln > 0 || p.giantTimer > 0 || p.ridingBallId) continue;
      const r = h.r || 7;
      if (Math.abs(p.x - h.x) < r + 4 && Math.abs((p.y - 8) - (h.y - 4)) < r + 5) {
        onPlayerHit(p, 'hurt');
        hitPlayer = true;
        break;
      }
    }
    if (!hitPlayer) keepHaz.push(h);
  }
  s.hazards = keepHaz;
}

export function spawnPumpkinIfTimedOut(s) {
  if (s.floor % 10 === 0 || s.snowHeadTimer > 0) return;
  s.stageTimer++;
  const limit = s.timeMode ? 1200 : 2100;
  if (s.stageTimer === limit && !s.enemies.some((e) => e.kind === 'pumpkin')) {
    s.enemies.push(makeEnemy(s, 'pumpkin', 128, 36, 1));
    s.sounds.push('pumpkin');
    spawnPopup(s, 128, 52, '快清怪！南瓜头来了', '#ff9942');
  }
  if (s.stageTimer > limit) s.pumpkinElapsed++;
}
