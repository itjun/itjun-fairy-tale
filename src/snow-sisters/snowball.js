// 雪片投射、结冰/融化、雪球推顶踢、双色连锁、卷入同行与一球全灭清屏奖励。

import { WALL_LEFT, WALL_RIGHT, findSupportY, resolveWallX, slopeAt } from './floors.js';
import {
  CHAIN_SCORES,
  addScore,
  awardLetter,
  dropItemForKill,
  spawnItem,
  spawnPopup,
} from './items.js';

export function fireSnowShot(s, p) {
  if (p.cooldown > 0 || p.state !== 'alive') return false;
  const activeCount = s.shots.filter((sh) => sh.owner === p.id).length;
  if (activeCount >= 4) return false;
  const speed = p.potions.range ? 4.0 : 3.1;
  const life = p.potions.range ? 28 : 16;
  const power = p.potions.power ? 3 : 1;
  s.shots.push({
    id: ++s.serial,
    owner: p.id,
    x: p.x + p.dir * 8,
    y: p.y - 9,
    vx: p.dir * speed,
    vy: -0.35,
    life,
    power,
    r: p.potions.power ? 6 : 4.5,
  });
  p.cooldown = 8;
  p.throwPose = 8;
  s.sounds.push('shot');
  return true;
}

export function createSnowballFromEnemy(s, enemy, owner = 1) {
  const ball = {
    id: ++s.serial,
    x: enemy.x,
    y: enemy.y,
    vx: 0,
    vy: 0,
    state: 'still',
    color: 'white',
    owner,
    chain: 0,
    bounces: 0,
    thaw: 420,
    enemyKind: enemy.kind,
    letter: enemy.letter || null,
    isBossMinion: !!enemy.isBossMinion,
    riders: [],
    sweepGroup: 0,
  };
  s.snowballs.push(ball);
  s.sounds.push('wrap');
  return ball;
}

export function kickSnowball(s, ball, player) {
  if (!ball || ball.state !== 'still') return false;
  const dir = player.dir || (ball.x >= player.x ? 1 : -1);
  ball.state = 'rolling';
  ball.vx = dir * 4.2;
  ball.vy = 0;
  ball.owner = player.id;
  ball.color = 'white';
  ball.bounces = 0;
  ball.chain = 0;
  ball.sweepGroup = ++s.sweepSerial;
  s.sweepCounts[ball.sweepGroup] = 0;
  s.sounds.push('kick');
  return true;
}

export function bounceSnowballUp(s, ball) {
  if (!ball || ball.state !== 'still') return false;
  ball.vy = -4.4;
  s.sounds.push('jump');
  return true;
}

export function releaseRiders(s, ball, jumpOut = false) {
  for (const pid of ball.riders) {
    const p = s.players.find((item) => item.id === pid);
    if (p && p.ridingBallId === ball.id) {
      p.ridingBallId = null;
      p.invuln = Math.max(p.invuln, 36);
      if (jumpOut) {
        p.vy = -4.2;
        p.onGround = false;
      }
    }
  }
  ball.riders = [];
}

function noteClearingGroup(s, groupId) {
  if (!groupId) return;
  if (s.firstClearingGroup == null) s.firstClearingGroup = groupId;
  else if (s.firstClearingGroup !== groupId) s.sweepDisqualified = true;
}

function checkSweepClear(s) {
  if (s.sweepTriggered || s.sweepDisqualified || s.usedGreenThisFloor || s.floor % 10 === 0) return;
  const remaining = s.enemies.filter(
    (m) => !['sumo', 'pumpkin', 'ghost', 'bonusKun'].includes(m.kind) && !m.isBossMinion,
  ).length;
  const stillBalls = s.snowballs.filter((b) => b.state === 'still' && !b.isBossMinion).length;
  if (remaining === 0 && stillBalls === 0 && s.firstClearingGroup != null) {
    triggerSweepRain(s);
  }
}

function triggerSweepRain(s) {
  if (s.sweepTriggered || s.usedGreenThisFloor || s.floor % 10 === 0) return;
  s.sweepTriggered = true;
  spawnPopup(s, 128, 86, '一球全灭! 祝红包雨!', '#ffdf7b');
  for (let i = 0; i < 5; i++) {
    spawnItem(s, 'money10k', 44 + i * 42, 28 + (i % 2) * 14, { vy: 0.4, life: 420 });
  }
  s.sounds.push('oneUp');
}

export function updateShots(s, floorDef, onHitBoss) {
  const keep = [];
  for (const shot of s.shots) {
    shot.x += shot.vx;
    shot.y += shot.vy;
    shot.vy += 0.065;
    shot.life--;
    if (shot.life <= 0 || shot.x < WALL_LEFT || shot.x > WALL_RIGHT || shot.y > 236) continue;

    // 检查 FC 隐藏连续射击彩蛋点
    if (floorDef.hidden && !s.hiddenRevealed) {
      if (Math.hypot(shot.x - floorDef.hidden.x, shot.y - (floorDef.hidden.y - 8)) < 14) {
        s.hiddenHits++;
        if (s.hiddenHits >= floorDef.hidden.hitsNeeded) {
          s.hiddenRevealed = true;
          spawnItem(s, floorDef.hidden.kind, floorDef.hidden.x, floorDef.hidden.y - 6, { vy: -2.6, life: 540 });
          s.sounds.push('letter');
          spawnPopup(s, floorDef.hidden.x, floorDef.hidden.y - 20, '隐藏宝物!', '#ff9ce6');
        }
      }
    }

    let consumed = false;
    for (let i = s.enemies.length - 1; i >= 0; i--) {
      const e = s.enemies[i];
      if (e.kind === 'ghost') continue;
      if (Math.abs(shot.x - e.x) < 11 + shot.r && Math.abs(shot.y - (e.y - 8)) < 11 + shot.r) {
        if (e.kind === 'tornado' && e.spinTimer > 0) {
          consumed = true;
          break;
        }
        if (e.kind === 'pumpkin') {
          addScore(s, shot.owner, 10);
          e.teleportCooldown = 1;
          e.x = 32 + ((s.frame * 37 + e.id * 53) % 192);
          e.y = [80, 116, 152, 188, 224][e.id % 5];
          consumed = true;
          break;
        }
        if (e.kind === 'sumo') {
          addScore(s, shot.owner, 500);
          spawnItem(s, 'money20k', e.x, e.y);
          s.enemies.splice(i, 1);
          s.sounds.push('squash');
          consumed = true;
          break;
        }
        e.snow = Math.min(9, e.snow + shot.power);
        e.thawTimer = 165;
        addScore(s, shot.owner, 10);
        s.sounds.push('freeze');
        if (e.snow >= 9) {
          createSnowballFromEnemy(s, e, shot.owner);
          s.enemies.splice(i, 1);
        }
        consumed = true;
        break;
      }
    }

    if (!consumed && s.boss) {
      consumed = onHitBoss(shot);
    }

    if (!consumed) keep.push(shot);
  }
  s.shots = keep;
}

export function updateSnowballs(s, floorDef, onBallHitBoss) {
  const keepBalls = [];
  for (const ball of s.snowballs) {
    if (ball.state === 'still') {
      ball.thaw--;
      if (ball.thaw <= 0) {
        releaseRiders(s, ball, false);
        s.enemies.push({
          id: ++s.serial,
          kind: ball.enemyKind,
          x: ball.x,
          y: ball.y,
          vx: 0.75,
          vy: 0,
          dir: 1,
          snow: 4,
          thawTimer: 90,
          aiTimer: 0,
          spinTimer: 0,
          letter: ball.letter,
          isBossMinion: ball.isBossMinion,
          onGround: false,
        });
        continue;
      }

      const prevY = ball.y;
      ball.vy = Math.min(4.2, ball.vy + 0.24);
      ball.y += ball.vy;
      if (ball.vy >= 0) {
        const sy = findSupportY(floorDef, ball.x, prevY, ball.y, true);
        if (sy != null) {
          ball.y = sy;
          ball.vy = 0;
        }
      }
      const wallRes = resolveWallX(floorDef, ball.x, ball.y, 8);
      ball.x = wallRes.x;
      keepBalls.push(ball);
      continue;
    }

    // 滚动状态
    const prevY = ball.y;
    ball.x += ball.vx;
    const wallRes = resolveWallX(floorDef, ball.x, ball.y, 8);
    if (wallRes.hit) {
      ball.x = wallRes.x;
      ball.vx = -ball.vx;
      ball.bounces++;
      addScore(s, ball.owner, 10);
      s.sounds.push('bounce');
      if (ball.bounces >= 6) {
        if (!ball.isBossMinion) noteClearingGroup(s, ball.sweepGroup);
        releaseRiders(s, ball, true);
        s.sounds.push('squash');
        continue;
      }
    }

    const sl = slopeAt(floorDef, ball.x, ball.y);
    if (sl) {
      ball.y = sl.y;
      ball.vy = 0;
    } else {
      ball.vy = Math.min(4.6, ball.vy + 0.26);
      ball.y += ball.vy;
      if (ball.vy >= 0) {
        const sy = findSupportY(floorDef, ball.x, prevY, ball.y, true);
        if (sy != null && sy >= prevY - 1) {
          ball.y = sy;
          ball.vy = 0;
        }
      }
    }

    if (ball.y > 238) {
      if (!ball.isBossMinion) noteClearingGroup(s, ball.sweepGroup);
      releaseRiders(s, ball, true);
      s.sounds.push('squash');
      continue;
    }

    // 撞击怪物
    for (let i = s.enemies.length - 1; i >= 0; i--) {
      const e = s.enemies[i];
      if (e.kind === 'pumpkin' || e.kind === 'ghost') continue;
      if (Math.abs(ball.x - e.x) < 15 && Math.abs(ball.y - e.y) < 16) {
        if (e.kind === 'sumo') {
          spawnItem(s, 'money20k', e.x, e.y);
          s.enemies.splice(i, 1);
          s.sounds.push('squash');
          continue;
        }
        if (e.kind === 'bonusKun') {
          addScore(s, ball.owner, 30000);
          const ownerP = s.players.find((p) => p.id === ball.owner) || s.players[0];
          awardLetter(s, ownerP, e.letter);
          s.enemies.splice(i, 1);
          s.sounds.push('squash');
          continue;
        }

        ball.chain++;
        const pts = ball.color !== 'white' ? 8000 : CHAIN_SCORES[Math.min(5, ball.chain - 1)];
        addScore(s, ball.owner, pts);
        spawnPopup(s, e.x, e.y - 12, `+${pts}`, ball.color !== 'white' ? '#78e6ff' : '#ffdf7b');
        s.sounds.push(ball.chain > 1 ? 'chain' : 'squash');

        const isStageMob = !e.isBossMinion;
        const ex = e.x;
        const ey = e.y;
        s.enemies.splice(i, 1);
        dropItemForKill(s, ex, ey, {
          chainCount: ball.chain,
          wasColoredBall: ball.color !== 'white',
          allowPotion: isStageMob,
        });

        if (isStageMob) {
          s.sweepCounts[ball.sweepGroup] = (s.sweepCounts[ball.sweepGroup] || 0) + 1;
          noteClearingGroup(s, ball.sweepGroup);
          checkSweepClear(s);
        }
      }
    }

    // 撞击另一颗静止雪球 -> 变色连锁滚出！
    for (const other of s.snowballs) {
      if (other === ball || other.state !== 'still') continue;
      if (Math.abs(ball.x - other.x) < 15 && Math.abs(ball.y - other.y) < 15) {
        other.state = 'rolling';
        other.owner = ball.owner;
        // 连锁球跟随推球者的衣服颜色：1P 姐姐红、2P 妹妹紫。
        other.color = ball.owner === 2 ? 'p2' : 'p1';
        other.vx = (Math.sign(other.x - ball.x) || Math.sign(ball.vx) || 1) * 4.3;
        other.vy = 0;
        other.bounces = 0;
        other.sweepGroup = ball.sweepGroup;
        if (!ball.isBossMinion) noteClearingGroup(s, ball.sweepGroup);
        s.sounds.push('chain');
        checkSweepClear(s);
      }
    }

    // 撞击 Boss
    if (s.boss && onBallHitBoss(ball)) {
      releaseRiders(s, ball, true);
      continue;
    }

    // 携带卷入其中的玩家同行
    for (const pid of ball.riders) {
      const p = s.players.find((item) => item.id === pid);
      if (p) {
        p.x = ball.x;
        p.y = ball.y - 1;
        p.vx = ball.vx;
        p.vy = 0;
      }
    }

    keepBalls.push(ball);
  }
  s.snowballs = keepBalls;
}
