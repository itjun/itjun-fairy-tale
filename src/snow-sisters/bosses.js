// 第 10/20/30/40/50 层五大 Boss 逻辑与 2P 合作血量平衡。

import { WALL_LEFT, WALL_RIGHT, findSupportY } from './floors.js';
import { addScore, spawnItem, spawnPopup } from './items.js';
import { makeEnemy, nearestPlayer } from './enemies.js';

export function createBossForFloor(s, floorNum) {
  const coopMult = s.players.filter((p) => p.active).length > 1 ? 1.45 : 1;
  const scaleHp = (base) => Math.round(base * coopMult);

  if (floorNum === 10) {
    return {
      kind: 'lizard',
      name: '喷火巨蜥',
      units: [
        {
          id: ++s.serial,
          x: 204,
          y: 224,
          vx: 0,
          vy: 0,
          dir: -1,
          hp: scaleHp(120),
          maxHp: scaleHp(120),
          timer: 40,
          hurtTimer: 0,
          phase: 0,
          onGround: true,
        },
      ],
      spikeY: 0,
    };
  }
  if (floorNum === 20) {
    return {
      kind: 'frog',
      name: '炮弹巨蛙',
      units: [
        {
          id: ++s.serial,
          x: 206,
          y: 224,
          vx: 0,
          vy: 0,
          dir: -1,
          hp: scaleHp(160),
          maxHp: scaleHp(160),
          timer: 50,
          hurtTimer: 0,
          phase: 0,
          onGround: true,
        },
      ],
      spikeY: 0,
    };
  }
  if (floorNum === 30) {
    return {
      kind: 'birds',
      name: '双怪巨鸟',
      units: [
        {
          id: ++s.serial,
          x: 78,
          y: 86,
          vx: 1.0,
          vy: 0.4,
          dir: 1,
          hp: scaleHp(110),
          maxHp: scaleHp(110),
          timer: 30,
          hurtTimer: 0,
          phase: 0,
          diveTimer: 0,
        },
        {
          id: ++s.serial,
          x: 178,
          y: 112,
          vx: -1.0,
          vy: -0.4,
          dir: -1,
          hp: scaleHp(110),
          maxHp: scaleHp(110),
          timer: 95,
          hurtTimer: 0,
          phase: 0,
          diveTimer: 0,
        },
      ],
      spikeY: 0,
    };
  }
  if (floorNum === 40) {
    return {
      kind: 'bigNose',
      name: s.timeMode ? '墨镜大鼻魔' : '大鼻绿魔',
      units: [
        {
          id: ++s.serial,
          x: 196,
          y: 224,
          vx: 0,
          vy: 0,
          dir: -1,
          hp: scaleHp(200),
          maxHp: scaleHp(200),
          timer: 45,
          hurtTimer: 0,
          phase: 0,
          onGround: true,
        },
      ],
      spikeY: 0,
    };
  }
  if (floorNum === 50) {
    return {
      kind: 'bubbleStatues',
      name: '双泡泡石像',
      units: [
        {
          id: ++s.serial,
          x: 44,
          y: 176,
          vx: 0,
          vy: 0,
          dir: 1,
          hp: scaleHp(140),
          maxHp: scaleHp(140),
          timer: 40,
          hurtTimer: 0,
          phase: 0,
          side: 'left',
        },
        {
          id: ++s.serial,
          x: 212,
          y: 176,
          vx: 0,
          vy: 0,
          dir: -1,
          hp: scaleHp(140),
          maxHp: scaleHp(140),
          timer: 95,
          hurtTimer: 0,
          phase: 0,
          side: 'right',
        },
      ],
      spikeY: 22,
      spikeTimer: 0,
    };
  }
  return null;
}

export function isBossDefeated(boss) {
  return !boss || boss.units.every((u) => u.hp <= 0);
}

// 原版击破分数：巨蜥 5 万、炮弹蛙 8 万、双怪鸟各 5 万、大鼻绿魔 10 万、泡泡石像各 10 万。
export const BOSS_REWARDS = {
  lizard: 50000,
  frog: 80000,
  birds: 50000,
  bigNose: 100000,
  bubbleStatues: 100000,
};

function defeatBossUnit(s, b, u, owner) {
  const reward = BOSS_REWARDS[b.kind] || 10000;
  addScore(s, owner, reward);
  spawnPopup(s, u.x, u.y - 30, `+${reward}`, '#ffdf7b');
  s.sounds.push('bossDown');
}

export function hitBossWithShot(s, shot) {
  const b = s.boss;
  if (!b) return false;
  for (const u of b.units) {
    if (u.hp <= 0) continue;
    const hw = b.kind === 'bubbleStatues' ? 18 : 20;
    const hh = b.kind === 'bubbleStatues' ? 28 : 24;
    if (Math.abs(shot.x - u.x) < hw && Math.abs(shot.y - (u.y - hh * 0.5)) < hh * 0.65) {
      u.hp = Math.max(0, u.hp - shot.power);
      u.hurtTimer = 8;
      addScore(s, shot.owner, 20);
      s.sounds.push('bossHit');
      if (u.hp === 0) defeatBossUnit(s, b, u, shot.owner);
      return true;
    }
  }
  return false;
}

export function hitBossWithBall(s, ball) {
  const b = s.boss;
  if (!b) return false;
  for (const u of b.units) {
    if (u.hp <= 0) continue;
    const hw = 22;
    const hh = 26;
    if (Math.abs(ball.x - u.x) < hw && Math.abs(ball.y - (u.y - hh * 0.5)) < hh * 0.7) {
      const dmg = ball.color !== 'white' ? 28 : 18;
      u.hp = Math.max(0, u.hp - dmg);
      u.hurtTimer = 14;
      addScore(s, ball.owner, 1000);
      spawnPopup(s, u.x, u.y - 28, `雪球重击! -${dmg}`, '#82e6ff');
      s.sounds.push('bossHit');
      if (u.hp === 0) defeatBossUnit(s, b, u, ball.owner);
      return true;
    }
  }
  return false;
}

export function updateBoss(s, floorDef, onPlayerHit) {
  const b = s.boss;
  if (!b) return;

  // 50 层：随时间缓缓下降的尖刺天花板（击破 Boss 后停止）
  if (b.kind === 'bubbleStatues' && !isBossDefeated(b)) {
    b.spikeTimer++;
    if (b.spikeTimer % 180 === 0 && b.spikeY < 104) {
      b.spikeY += 4;
    }
    for (const p of s.players) {
      if (!p.active || p.state !== 'alive' || p.invuln > 0) continue;
      if (p.y - 16 <= b.spikeY) onPlayerHit(p, 'hurt');
    }
  }

  for (const u of b.units) {
    if (u.hp <= 0) continue;
    if (u.hurtTimer > 0) u.hurtTimer--;
    u.timer++;

    if (b.kind === 'lizard') {
      // 10 层喷火巨蜥：蓄力大跳到上方或对面，落地吐出 2 只小恐龙
      if (u.onGround && u.timer % 120 === 0) {
        u.vy = -4.9;
        u.vx = (u.x > 128 ? -1 : 1) * 1.45;
        u.dir = u.vx >= 0 ? 1 : -1;
        u.onGround = false;
      }
      if (!u.onGround) {
        const prevY = u.y;
        u.x = Math.max(WALL_LEFT + 18, Math.min(WALL_RIGHT - 18, u.x + u.vx));
        u.vy = Math.min(4.2, u.vy + 0.2);
        u.y += u.vy;
        if (u.vy >= 0) {
          const sy = findSupportY(floorDef, u.x, prevY, u.y, true);
          if (sy != null) {
            u.y = sy;
            u.vy = 0;
            u.vx = 0;
            u.onGround = true;
          }
        }
      }
      if (u.timer % 150 === 75 && s.enemies.length < 4) {
        const d = u.x > 128 ? -1 : 1;
        u.dir = d;
        s.enemies.push(makeEnemy(s, 'togera', u.x + d * 14, u.y, d, { isBossMinion: true }));
      }
    } else if (b.kind === 'frog') {
      // 20 层炮弹巨蛙：在高层与地面之间瞬移，放出可自爆的炸弹兵
      if (u.timer % 175 === 0) {
        const spots = [
          { x: 204, y: 224, dir: -1 },
          { x: 52, y: 224, dir: 1 },
          { x: 128, y: 128, dir: -1 },
          { x: 206, y: 128, dir: -1 },
        ];
        const nextSpot = spots[(Math.floor(u.timer / 175)) % spots.length];
        u.x = nextSpot.x;
        u.y = nextSpot.y;
        u.dir = nextSpot.dir;
        s.sounds.push('bounce');
      }
      if (u.timer % 125 === 60 && s.enemies.length < 4) {
        s.enemies.push(makeEnemy(s, 'bombJoe', u.x + u.dir * 16, u.y, u.dir, { isBossMinion: true }));
      }
    } else if (b.kind === 'birds') {
      // 30 层双怪鸟：按血量由黄(0) -> 粉(1) -> 蓝(2) 加速；高空盘旋、产卵并斜角俯冲
      const ratio = u.hp / u.maxHp;
      u.phase = ratio > 0.66 ? 0 : ratio > 0.33 ? 1 : 2;
      const spdMult = 1 + u.phase * 0.35;
      if (u.diveTimer > 0) {
        // 斜线俯冲：先瞄准最近的玩家，冲到底或时间到后回到高空盘旋。
        u.diveTimer--;
        u.x = Math.max(WALL_LEFT + 18, Math.min(WALL_RIGHT - 18, u.x + u.diveVx));
        u.y = Math.min(200, u.y + u.diveVy);
        u.dir = u.diveVx >= 0 ? 1 : -1;
        if (u.diveTimer === 0 || u.y >= 200) {
          u.diveTimer = 0;
          u.vx = u.dir * Math.abs(u.vx || 1);
          u.vy = -Math.abs(u.vy || 0.4);
        }
      } else {
        u.x += u.vx * spdMult;
        u.y += u.vy * spdMult;
        if (u.x < WALL_LEFT + 18 || u.x > WALL_RIGHT - 18) u.vx = -u.vx;
        if (u.y < 52 || u.y > 194) u.vy = -u.vy;
        u.dir = u.vx >= 0 ? 1 : -1;
        if (u.timer % Math.max(150, 260 - u.phase * 40) === 0) {
          const target = nearestPlayer(s, u.x, u.y);
          const dx = target.x - u.x;
          const dy = Math.max(20, target.y - u.y);
          const len = Math.hypot(dx, dy) || 1;
          u.diveVx = (dx / len) * 2.3;
          u.diveVy = (dy / len) * 2.3;
          u.diveTimer = 60;
          s.sounds.push('bounce');
        }
      }

      if (u.timer % Math.max(95, 155 - u.phase * 25) === 0 && s.enemies.length < 4) {
        s.enemies.push(makeEnemy(s, 'beep', u.x, u.y + 8, u.dir, { isBossMinion: true }));
      }
    } else if (b.kind === 'bigNose') {
      // 40 层大鼻绿魔（FC 单只版本）：跳上跳下巡逻，吐可被雪球裹住的 Pang Pang 火怪
      const prevY = u.y;
      u.x += u.dir * 1.15;
      if (u.x < WALL_LEFT + 18 || u.x > WALL_RIGHT - 18) u.dir = -u.dir;
      u.vy = Math.min(4.0, u.vy + 0.22);
      u.y += u.vy;
      u.onGround = false;
      if (u.vy >= 0) {
        const sy = findSupportY(floorDef, u.x, prevY, u.y, true);
        if (sy != null) {
          u.y = sy;
          u.vy = 0;
          u.onGround = true;
        }
      }
      if (u.onGround && u.timer % 110 === 0) {
        u.vy = -4.6;
        u.onGround = false;
      }
      if (u.timer % 115 === 55 && s.enemies.length < 4) {
        s.enemies.push(makeEnemy(s, 'pangPang', u.x + u.dir * 12, u.y - 6, u.dir, { isBossMinion: true }));
      }
    } else if (b.kind === 'bubbleStatues') {
      // 50 层最终 Boss 双泡泡石像：轮流吹出空泡 / 药水泡 / 小恐龙 / 火球泡
      if (u.timer % 120 === 0) {
        const seq = ['empty', 'redPotion', 'dino', 'bluePotion', 'fire'];
        const bKind = seq[Math.floor(u.timer / 120) % seq.length];
        const dir = u.side === 'left' ? 1 : -1;
        if (bKind === 'dino' && s.enemies.length < 3) {
          s.enemies.push(makeEnemy(s, 'togera', u.x + dir * 20, u.y, dir, { isBossMinion: true }));
        } else if (bKind === 'redPotion') {
          spawnItem(s, 'red', u.x + dir * 24, u.y - 16, { vy: -1.4, life: 360 });
        } else if (bKind === 'bluePotion') {
          spawnItem(s, 'blue', u.x + dir * 24, u.y - 16, { vy: -1.4, life: 360 });
        } else {
          s.hazards.push({
            id: ++s.serial,
            kind: bKind === 'fire' ? 'flame' : 'trapBubble',
            x: u.x + dir * 20,
            y: u.y - 20,
            vx: dir * (bKind === 'fire' ? 1.5 : 1.05),
            vy: bKind === 'fire' ? 0.35 : -0.35,
            life: 165,
            r: 9,
          });
        }
      }
    }

    // 接触玩家
    for (const p of s.players) {
      if (!p.active || p.state !== 'alive' || p.invuln > 0 || p.ridingBallId) continue;
      if (Math.abs(p.x - u.x) < 17 && Math.abs(p.y - u.y) < 22) {
        if (p.giantTimer > 0) {
          u.hp = Math.max(0, u.hp - 4);
          u.hurtTimer = 8;
          if (u.hp === 0) defeatBossUnit(s, b, u, p);
        } else {
          onPlayerHit(p, 'hurt');
        }
      }
    }
  }
}
