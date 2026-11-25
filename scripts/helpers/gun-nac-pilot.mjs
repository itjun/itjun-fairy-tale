// 测试飞手只给方向、射击和炸弹，运行的是游戏自己的逐帧战斗。
import { bossTargets } from '../../src/gun-nac/bosses.js';
import { clamp, SHIP_SPEED } from '../../src/gun-nac/stages.js';
export const moves = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
];
export function makePilot() {
  let decided = -10,
    last = { x: 0, y: 0, fire: true, bomb: false };
  return (s) => {
    if (s.frame - decided < 6 && s.frame >= decided) return { ...last, bomb: false };
    decided = s.frame;
    const p = s.ship,
      v = SHIP_SPEED[p.speed];
    const zones = bossTargets(s.boss);
    const target =
      zones[0] || s.boss || s.enemies.find((e) => e.age >= 0 && e.x > 8 && e.x < 248 && e.y < p.y - 8);
    let targetX = target?.x ?? 128,
      targetY = s.boss ? 195 : 174;
    if (p.gun === 4 && target) targetY = target.y + 34;
    if (s.boss?.kind === 'moon' && p.gun !== 3) {
      // Lead the moving crescent. A slow sphere aimed at its current position falls behind.
      const speed = [0, 9, 2.3, 2.8, 3.5, 4.6][p.gun];
      if (p.gun !== 4) targetY = 151;
      const ahead = Math.max(0, (p.y - s.boss.y - 5) / speed);
      targetX = 128 + Math.sin((s.boss.age - 72 + ahead) * .025) * 91;
    }
    const clay = s.boss?.kind === 'clay' ? s.boss : null;
    const laserCycle = clay ? (clay.age - 72) % 180 : -1;
    if (clay) {
      targetY = Math.min(224, clay.y + 43);
      if (laserCycle >= 66 && laserCycle < 116) targetX = clamp(clay.x + (p.x < clay.x ? -39 : 39), 12, 244);
    }
    if (!s.boss) {
      const item = s.items
        .filter((i) => i.age >= 0 && i.y > 80 && i.y < 225 && Math.abs(i.x - p.x) < 100)
        .sort((a, b) => b.y - a.y)[0];
      if (item) {
        targetX = item.x;
        targetY = item.y + 3;
      }
    }
    let best = Infinity,
      choice;
    for (const [dx, dy] of moves) {
      const unit = dx && dy ? Math.SQRT1_2 : 1;
      let danger = 0;
      for (const t of [5, 12, 20, 30]) {
        const x = clamp(p.x + dx * v * t * unit, 6, 250),
          y = clamp(p.y + dy * v * t * unit, 8, 231);
        if (p.inv < 25) {
          for (const h of s.hostile) {
            const d = Math.hypot(h.x + h.vx * t - x, h.y + h.vy * t - y) - h.r - 3.5;
            if (d < 12) danger += Math.max(0, 12 - d) ** 2 * (t < 15 ? 1.8 : 1);
          }
          for (const e of s.enemies) {
            if (e.age < 0) continue;
            const d = Math.hypot(e.x - x, e.y + 0.55 * t - y) - e.r - 4;
            if (d < 8) danger += (8 - d) ** 2;
          }
          if (s.boss?.open && Math.hypot(s.boss.x - x, s.boss.y - y) < s.boss.r + 10) danger += 850;
          if (clay && laserCycle + t >= 90 && laserCycle + t < 115 && Math.abs(x - clay.x) < 12)
            danger += 900;
          for (const h of s.hazards)
            if (h.kind === 'pillar' && h.age + t < h.life && Math.abs(x - h.x) < 9) danger += 900;
          for (const h of s.hazards)
            if (
              h.kind === 'flare' &&
              h.age + t > 35 &&
              h.age + t < 131 &&
              Math.abs(h.y - y) < 13 &&
              (x - h.x) * h.sign < 219
            )
              danger += 300;
        }
      }
      const px = clamp(p.x + dx * v * 12 * unit, 6, 250),
        py = clamp(p.y + dy * v * 12 * unit, 8, 231);
      const cost =
        danger +
        Math.abs(targetX - px) * 1.1 +
        Math.abs(targetY - py) * 0.72 +
        Math.max(0, 24 - px, px - 232, 28 - py, py - 221) * 0.9;
      if (cost < best) {
        best = cost;
        choice = { x: dx, y: dy, fire: true, bomb: danger > 105 && p.stock > 0 };
      }
    }
    last = choice;
    return choice;
  };
}
