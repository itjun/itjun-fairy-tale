// 《小雪人姐妹》60fps 核心逻辑引擎：双人移动跳跃、雪球推顶踢与连锁、50 层推进与状态序列化。

import { WALL_LEFT, WALL_RIGHT, findSupportY, getFloor, resolveWallX, slopeAt } from './floors.js';
import { addScore, collectItem, dropItemForKill, spawnPopup } from './items.js';
import { startSlotBonus, stepSlotBonus } from './bonus.js';
import {
  bounceSnowballUp,
  fireSnowShot,
  kickSnowball,
  releaseRiders,
  updateShots,
  updateSnowballs,
} from './snowball.js';
import { makeEnemy, spawnPumpkinIfTimedOut, updateEnemies } from './enemies.js';
import { createBossForFloor, hitBossWithBall, hitBossWithShot, isBossDefeated, updateBoss } from './bosses.js';

export const SAVE_KEY = 'garden-snow-sisters-v1';
export const RECORD_KEY = 'garden-snow-sisters-record-v1';
export const FIXED_DT = 1000 / 60;
export const INITIAL_LIVES = 3;
export const INITIAL_CONTINUES = 9;

function makePlayer(id, active, x = 104, y = 224) {
  return {
    id,
    active,
    x,
    y,
    vx: 0,
    vy: 0,
    dir: id === 2 ? -1 : 1,
    lives: INITIAL_LIVES,
    score: 0,
    nextExtend: 100000,
    letters: [],
    potions: { speed: false, power: false, range: false },
    giantTimer: 0,
    invuln: 120,
    state: active ? 'alive' : 'dead',
    deathTimer: 0,
    cooldown: 0,
    throwPose: 0,
    onGround: true,
    ridingBallId: null,
    jumpHeld: false,
    shotHeld: false,
    kickGrace: 0,
  };
}

export function loadFloor(s, floorNum) {
  const num = Math.max(1, Math.min(50, floorNum | 0));
  const f = getFloor(num);
  s.floor = num;
  s.clearDelay = 0;
  s.stageTimer = 0;
  s.pumpkinElapsed = 0;
  s.snowHeadTimer = 0;
  s.snowHeadUsed = false;
  s.usedGreenThisFloor = false;
  s.sweepTriggered = false;
  s.sweepCounts = {};
  s.firstClearingGroup = null;
  s.sweepDisqualified = false;
  s.hiddenHits = 0;
  s.hiddenRevealed = false;
  s.warpCollectorId = null;

  s.enemies = f.spawns.map((sp) => makeEnemy(s, sp.kind, sp.x, sp.y, sp.dir || 1));
  s.stageEnemyTotal = s.enemies.filter((e) => e.kind !== 'sumo').length;
  s.snowballs = [];
  s.shots = [];
  s.items = [];
  s.hazards = [];
  s.popups = [];
  s.boss = num % 10 === 0 ? createBossForFloor(s, num) : null;

  const [sp1, sp2] = f.playerSpawns;
  const p1 = s.players[0];
  const p2 = s.players[1];
  if (p1.active && p1.state !== 'dead') {
    p1.x = sp1.x;
    p1.y = sp1.y;
    p1.vx = 0;
    p1.vy = 0;
    p1.dir = 1;
    p1.invuln = 90;
    p1.ridingBallId = null;
    p1.giantTimer = 0;
    p1.state = 'alive';
  }
  if (p2.active && p2.state !== 'dead') {
    p2.x = sp2.x;
    p2.y = sp2.y;
    p2.vx = 0;
    p2.vy = 0;
    p2.dir = -1;
    p2.invuln = 90;
    p2.ridingBallId = null;
    p2.giantTimer = 0;
    p2.state = 'alive';
  }
  s.sounds.push('stageStart');
}

export function newSnowGame({
  players = 1,
  startFloor = 1,
  timeMode = false,
  skipIntro = false,
  seed = 0x534e4f57,
  hiScore = 0,
} = {}) {
  const numPlayers = players === 2 ? 2 : 1;
  const s = {
    version: 1,
    mode: numPlayers,
    floor: Math.max(1, Math.min(50, startFloor | 0)),
    phase: skipIntro || startFloor > 1 ? 'play' : 'intro',
    introTimer: skipIntro || startFloor > 1 ? 0 : 150,
    timeMode: !!timeMode,
    timeLeft: timeMode ? 120 * 60 : 0,
    seed: seed >>> 0,
    serial: 0,
    sweepSerial: 0,
    frame: 0,
    hiScore: Math.max(0, hiScore | 0),
    continues: INITIAL_CONTINUES,
    players: [makePlayer(1, true), makePlayer(2, numPlayers === 2)],
    enemies: [],
    snowballs: [],
    shots: [],
    items: [],
    hazards: [],
    popups: [],
    sounds: [],
    boss: null,
    bonus: null,
    stageEnemyTotal: 0,
    clearDelay: 0,
    stageTimer: 0,
    pumpkinElapsed: 0,
    snowHeadTimer: 0,
    snowHeadUsed: false,
    usedGreenThisFloor: false,
    sweepTriggered: false,
    sweepCounts: {},
    firstClearingGroup: null,
    sweepDisqualified: false,
    hiddenHits: 0,
    hiddenRevealed: false,
    warpCollectorId: null,
  };
  loadFloor(s, s.floor);
  return s;
}

export function joinSecondPlayer(s) {
  if (!s || s.phase === 'over' || s.phase === 'ending') return false;
  const p2 = s.players[1];
  if (p2.active && p2.state === 'alive') return false;
  const f = getFloor(s.floor);
  const sp2 = f.playerSpawns[1];
  Object.assign(p2, makePlayer(2, true, sp2.x, sp2.y));
  s.mode = 2;
  s.sounds.push('oneUp');
  spawnPopup(s, sp2.x, sp2.y - 16, '2P 加入!', '#ff8fb8');
  return true;
}

export function continueSnowGame(s) {
  if (!s || s.phase !== 'over' || s.continues <= 0) return false;
  s.continues--;
  const f = getFloor(s.floor);
  s.players.forEach((p, idx) => {
    if (p.active || idx === 0) {
      const sp = f.playerSpawns[idx];
      p.active = true;
      p.lives = INITIAL_LIVES;
      p.score = 0;
      p.nextExtend = 100000;
      p.letters = [];
      p.potions = { speed: false, power: false, range: false };
      p.giantTimer = 0;
      p.invuln = 150;
      p.state = 'alive';
      p.deathTimer = 0;
      p.ridingBallId = null;
      p.x = sp.x;
      p.y = sp.y;
      p.vx = 0;
      p.vy = 0;
    }
  });
  if (s.timeMode) s.timeLeft = 120 * 60;
  s.phase = 'play';
  loadFloor(s, s.floor);
  return true;
}

function hurtPlayer(s, p) {
  if (!p || p.state !== 'alive' || p.invuln > 0 || p.giantTimer > 0) return;
  p.lives = Math.max(0, p.lives - 1);
  p.state = 'dying';
  p.deathTimer = 56;
  p.giantTimer = 0;
  p.potions = { speed: false, power: false, range: false };
  p.ridingBallId = null;
  s.sounds.push('melt');
}

function spawnBonusKuns(s) {
  const letters = ['S', 'N', 'O', 'W'];
  const spots = [
    { x: 48, y: 188, dir: 1 },
    { x: 208, y: 188, dir: -1 },
    { x: 64, y: 116, dir: 1 },
    { x: 192, y: 116, dir: -1 },
  ];
  letters.forEach((letter, idx) => {
    const sp = spots[idx];
    s.enemies.push(makeEnemy(s, 'bonusKun', sp.x, sp.y, sp.dir, { letter }));
  });
  s.snowHeadTimer = 600;
}

function stepPlayer(s, p, inp, floorDef) {
  if (!p.active) return;
  if (p.invuln > 0) p.invuln--;
  if (p.cooldown > 0) p.cooldown--;
  if (p.throwPose > 0) p.throwPose--;
  if (p.kickGrace > 0) p.kickGrace--;
  if (p.giantTimer > 0) p.giantTimer--;

  const jumpNow = !!inp.jump;
  const shootNow = !!inp.shoot;
  const jumpEdge = jumpNow && !p.jumpHeld;
  const shootEdge = shootNow && !p.shotHeld;
  p.jumpHeld = jumpNow;
  p.shotHeld = shootNow;

  if (p.state === 'dying') {
    p.deathTimer--;
    if (p.deathTimer <= 0) {
      if (p.lives > 0) {
        const sp = floorDef.playerSpawns[p.id - 1];
        p.x = sp.x;
        p.y = sp.y;
        p.vx = 0;
        p.vy = 0;
        p.invuln = 150;
        p.state = 'alive';
      } else {
        p.state = 'dead';
      }
    }
    return;
  }

  if (p.state !== 'alive') return;

  // 若玩家正卷入滚雪球中，按跳即可弹跳脱离
  if (p.ridingBallId != null) {
    const ball = s.snowballs.find((b) => b.id === p.ridingBallId);
    if (!ball) {
      p.ridingBallId = null;
    } else if (jumpEdge) {
      releaseRiders(s, ball, true);
      s.sounds.push('jump');
    }
    return;
  }

  const moveDir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  if (moveDir !== 0) p.dir = moveDir;

  // 绿药水巨大化无敌飞行模式
  if (p.giantTimer > 0) {
    p.x = Math.max(WALL_LEFT + 12, Math.min(WALL_RIGHT - 12, p.x + moveDir * 2.35));
    const vMove = (inp.down ? 1 : 0) - (inp.up || inp.jump ? 1 : 0);
    p.y = Math.max(36, Math.min(224, p.y + vMove * 2.1));
    p.vx = moveDir * 2.35;
    p.vy = vMove * 2.1;
    p.onGround = p.y >= 224;
    if (shootEdge || (shootNow && p.cooldown === 0)) fireSnowShot(s, p);
    return;
  }

  const moveSpeed = p.potions.speed ? 2.15 : 1.55;
  p.vx = moveDir * moveSpeed;

  // 水平移动并推动静止雪球
  const prevX = p.x;
  let nextX = p.x + p.vx;
  const wallRes = resolveWallX(floorDef, nextX, p.y, 7);
  nextX = wallRes.x;

  if (moveDir !== 0) {
    for (const ball of s.snowballs) {
      if (ball.state !== 'still') continue;
      if (Math.abs(p.y - ball.y) < 12 && Math.abs(nextX - ball.x) < 13) {
        const pushRes = resolveWallX(floorDef, ball.x + moveDir * 0.95, ball.y, 8);
        ball.x = pushRes.x;
        nextX = prevX + moveDir * 0.85;
      }
    }
  }
  p.x = nextX;

  // 跳跃起跳
  if (jumpEdge && p.onGround) {
    p.vy = p.potions.speed ? -5.15 : -4.75;
    p.onGround = false;
    s.sounds.push('jump');
  }

  // 垂直重力、向上顶雪球、落台踩雪球
  const prevY = p.y;
  p.vy = Math.min(4.4, p.vy + 0.23);
  p.y += p.vy;
  p.onGround = false;

  // 从下往上顶到静止雪球 -> 把雪球顶跳到上层平台
  if (p.vy < 0) {
    for (const ball of s.snowballs) {
      if (ball.state !== 'still') continue;
      if (Math.abs(p.x - ball.x) < 13 && prevY - 14 >= ball.y - 2 && p.y - 14 <= ball.y + 4) {
        bounceSnowballUp(s, ball);
        p.vy = 0.6;
        break;
      }
    }
  }

  const sl = slopeAt(floorDef, p.x, p.y);
  if (sl && p.vy >= 0) {
    p.y = sl.y;
    p.vy = 0;
    p.onGround = true;
  } else if (p.vy >= 0) {
    let landedY = findSupportY(floorDef, p.x, prevY, p.y, true);
    // 可踩在静止雪球顶部垫高跳向高台
    for (const ball of s.snowballs) {
      if (ball.state !== 'still') continue;
      const topY = ball.y - 14;
      if (Math.abs(p.x - ball.x) < 13 && prevY <= topY + 3 && p.y >= topY) {
        if (landedY == null || topY < landedY) landedY = topY;
      }
    }
    if (landedY != null) {
      p.y = landedY;
      p.vy = 0;
      p.onGround = true;
    }
  }

  // 41-49 层底部穿顶坑循环
  if (floorDef.pit && p.y > 238) {
    p.y = 18;
    p.vy = 0.5;
  } else if (!floorDef.pit && p.y > 224) {
    p.y = 224;
    p.vy = 0;
    p.onGround = true;
  }

  // 触碰滚动中的雪球 -> 卷入无敌同滚
  if (p.kickGrace <= 0 && p.invuln <= 0) {
    for (const ball of s.snowballs) {
      if (ball.state !== 'rolling') continue;
      if (Math.abs(p.x - ball.x) < 12 && Math.abs(p.y - ball.y) < 13) {
        if (!ball.riders.includes(p.id)) {
          ball.riders.push(p.id);
          p.ridingBallId = ball.id;
          s.sounds.push('jump');
          break;
        }
      }
    }
  }

  // 攻击输入：身前有静止雪球则一脚踢飞，否则发射雪片
  if (shootEdge) {
    let kicked = false;
    for (const ball of s.snowballs) {
      if (ball.state !== 'still') continue;
      const dx = ball.x - p.x;
      if (Math.abs(dx) < 16 && Math.abs(p.y - ball.y) < 12 && (dx === 0 || Math.sign(dx) === p.dir || Math.abs(dx) < 10)) {
        kickSnowball(s, ball, p);
        p.kickGrace = 10;
        kicked = true;
        break;
      }
    }
    if (!kicked) fireSnowShot(s, p);
  } else if (shootNow && p.cooldown === 0) {
    fireSnowShot(s, p);
  }
}

function updateItems(s, floorDef) {
  const keep = [];
  for (const it of s.items) {
    it.life--;
    if (it.life <= 0) continue;

    const prevY = it.y;
    it.vy = Math.min(3.0, it.vy + 0.16);
    it.y += it.vy;
    if (it.vy >= 0) {
      const sy = findSupportY(floorDef, it.x, prevY, it.y, true);
      if (sy != null) {
        it.y = sy;
        it.vy = 0;
      } else if (it.y > 224) {
        it.y = 224;
        it.vy = 0;
      }
    }

    let picked = false;
    for (const p of s.players) {
      if (!p.active || p.state !== 'alive') continue;
      if (Math.abs(p.x - it.x) < 13 && Math.abs(p.y - it.y) < 14) {
        const res = collectItem(s, p, it);
        picked = true;
        if (res === 'warp') {
          s.warpCollectorId = p.id;
          startSlotBonus(s, 'warp');
          return;
        }
        if (res === 'snowHead') {
          spawnBonusKuns(s);
        }
        break;
      }
    }
    if (!picked) keep.push(it);
  }
  s.items = keep;
}

function updatePopups(s) {
  const keep = [];
  for (const pop of s.popups) {
    pop.y -= 0.28;
    pop.life--;
    if (pop.life > 0) keep.push(pop);
  }
  s.popups = keep;
}

function normalizeInput(rawInput = {}) {
  if (rawInput.p1 || rawInput.p2) {
    return {
      p1: rawInput.p1 || {},
      p2: rawInput.p2 || {},
    };
  }
  return { p1: rawInput, p2: {} };
}

export function tickSnow(s, rawInput = {}) {
  if (!s) return;
  s.sounds = [];
  s.frame++;
  const { p1: in1, p2: in2 } = normalizeInput(rawInput);

  if (s.phase === 'over' || s.phase === 'ending') return;

  if (s.phase === 'intro') {
    s.introTimer--;
    if (s.introTimer <= 0 || in1.jump || in1.shoot || in2.jump || in2.shoot) {
      s.phase = 'play';
    }
    return;
  }

  if (s.phase === 'slot' || s.phase === 'warpSlot') {
    const p1 = s.players[0];
    const p2 = s.players[1];
    const p1Press = !!(in1.jump || in1.shoot);
    const p2Press = !!(in2.jump || in2.shoot);
    const stopIds = [];
    if (p1Press && !p1.jumpHeld && !p1.shotHeld) stopIds.push(1);
    if (p2Press && !p2.jumpHeld && !p2.shotHeld) stopIds.push(2);
    p1.jumpHeld = !!in1.jump;
    p1.shotHeld = !!in1.shoot;
    p2.jumpHeld = !!in2.jump;
    p2.shotHeld = !!in2.shoot;
    const done = stepSlotBonus(s, stopIds);
    if (done) {
      const targetFloor =
        done.kind === 'warp' ? Math.min(50, s.floor + 1 + (done.skip || 0)) : Math.min(50, s.floor + 1);
      s.phase = 'play';
      loadFloor(s, targetFloor);
    }
    return;
  }

  // 检查 2P 中途按加入键
  if (in2.join && !s.players[1].active) {
    joinSecondPlayer(s);
  }

  // Time 竞速模式倒计时
  if (s.timeMode) {
    s.timeLeft--;
    if (s.timeLeft <= 0) {
      s.timeLeft = 0;
      s.phase = 'over';
      s.sounds.push('gameOver');
      return;
    }
  }

  if (s.snowHeadTimer > 0) {
    s.snowHeadTimer--;
    if (s.snowHeadTimer === 0) {
      s.enemies = s.enemies.filter((e) => e.kind !== 'bonusKun');
    }
  }

  const floorDef = getFloor(s.floor);

  stepPlayer(s, s.players[0], in1, floorDef);
  stepPlayer(s, s.players[1], in2, floorDef);

  updateShots(s, floorDef, (shot) => hitBossWithShot(s, shot));
  updateSnowballs(s, floorDef, (ball) => hitBossWithBall(s, ball));
  updateEnemies(s, floorDef, (p, kind, mob) => {
    if (kind === 'giantKill') {
      addScore(s, p, 8000);
      spawnPopup(s, mob.x, mob.y - 12, '+8000', '#72ff98');
      dropItemForKill(s, mob.x, mob.y, { isGreenKill: true });
      s.sounds.push('squash');
    } else {
      hurtPlayer(s, p);
    }
  });
  updateBoss(s, floorDef, (p) => hurtPlayer(s, p));
  updateItems(s, floorDef);
  if (s.phase !== 'play') return;

  updatePopups(s);
  spawnPumpkinIfTimedOut(s);

  // 检查全体败北
  const activePlayers = s.players.filter((p) => p.active);
  if (activePlayers.length > 0 && activePlayers.every((p) => p.state === 'dead' && p.lives <= 0)) {
    s.phase = 'over';
    s.sounds.push('gameOver');
    return;
  }

  // 检查过关（消灭所有必需敌怪与雪球，且 Boss 已倒下）
  const reqMobs = s.enemies.filter(
    (e) => !['sumo', 'pumpkin', 'ghost', 'bonusKun'].includes(e.kind) && !e.isBossMinion,
  ).length;
  const reqBalls = s.snowballs.filter((b) => !b.isBossMinion).length;
  const bossDone = s.floor % 10 !== 0 || isBossDefeated(s.boss);

  if (reqMobs === 0 && reqBalls === 0 && bossDone && s.snowHeadTimer <= 0) {
    if (s.clearDelay === 0) {
      s.clearDelay = s.sweepTriggered ? 160 : s.items.length > 0 ? 110 : 72;
      s.enemies = [];
      s.hazards = [];
    } else {
      s.clearDelay--;
      if (s.clearDelay <= 0) {
        if (s.floor >= 50) {
          s.phase = 'ending';
          s.sounds.push('ending');
        } else if (s.floor % 10 === 0) {
          startSlotBonus(s, 'boss');
        } else {
          loadFloor(s, s.floor + 1);
        }
      }
    }
  }
}

export function decodeSnowGame(raw) {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (
      s?.version !== 1 ||
      ![1, 2].includes(s.mode) ||
      !Number.isInteger(s.floor) ||
      s.floor < 1 ||
      s.floor > 50 ||
      !['intro', 'play', 'slot', 'warpSlot', 'over', 'ending'].includes(s.phase) ||
      !Array.isArray(s.players) ||
      s.players.length !== 2
    ) {
      return null;
    }
    const okNum = (n) => Number.isFinite(n);
    if (!okNum(s.seed) || !okNum(s.frame) || !okNum(s.hiScore) || !okNum(s.continues)) return null;
    for (const p of s.players) {
      if (
        !p ||
        ![1, 2].includes(p.id) ||
        typeof p.active !== 'boolean' ||
        !okNum(p.x) ||
        !okNum(p.y) ||
        !okNum(p.lives) ||
        !okNum(p.score) ||
        !Array.isArray(p.letters) ||
        !p.potions
      ) {
        return null;
      }
    }
    for (const k of ['enemies', 'snowballs', 'shots', 'items', 'hazards', 'popups']) {
      if (!Array.isArray(s[k])) return null;
    }
    // 旧存档的连锁球颜色名是 blue / red，按推球者衣服颜色改成 p1 / p2。
    for (const ball of s.snowballs) {
      if (ball.color === 'blue') ball.color = 'p1';
      else if (ball.color === 'red') ball.color = 'p2';
    }
    s.sounds = [];
    return s;
  } catch {
    return null;
  }
}
