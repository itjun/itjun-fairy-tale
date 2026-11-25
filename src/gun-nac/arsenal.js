import { clamp, random } from './stages.js';
import { crescentRadius } from './crescent.js';

const TAU = Math.PI * 2;
export function hostile(s, x, y, angle, speed, kind = 'round', options = {}) {
  const v = speed * (0.86 + s.difficulty * 0.12);
  const b = {
    x,
    y,
    vx: Math.cos(angle) * v,
    vy: Math.sin(angle) * v,
    age: 0,
    kind,
    r: 2.5,
    life: 430,
    ...options,
  };
  s.hostile.push(b);
  return b;
}
export const aim = (s, x, y) => Math.atan2(s.ship.y - y, s.ship.x - x);
export function fan(s, x, y, angle, count, spread, speed, kind, options) {
  for (let i = 0; i < count; i++)
    hostile(s, x, y, angle + (i - (count - 1) / 2) * spread, speed, kind, options);
}
export function ring(s, x, y, count, speed, offset = 0, kind = 'round', options) {
  for (let i = 0; i < count; i++) hostile(s, x, y, (TAU * i) / count + offset, speed, kind, options);
}
export function shoot(s) {
  const p = s.ship;
  const gun = s.bombs.length ? 1 : p.gun;
  const level = s.bombs.length ? 1 : p.power;
  const tier = Math.floor((level - 1) / 2);
  const fire = (angle, speed, damage, r, extra = {}) =>
    s.shots.push({
      x: p.x,
      y: p.y - 5,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      gun,
      age: 0,
      r,
      damage,
      life: 125,
      ...extra,
    });
  const up = -Math.PI / 2;
  if (gun === 1) {
    const angles = [-0.07, 0.07];
    if (level >= 2) angles.push(-0.38, 0.38);
    if (level >= 4) angles.push(0, -0.74, 0.74);
    if (level >= 7) angles.push(-2.25, 2.25);
    const dmg = 1.3 + Math.floor(level / 3) * 0.55;
    angles.forEach((a) => fire(up + a, 9.4, dmg, 2.7));
  } else if (gun === 2) {
    fire(up, 3.3, 3.2 + tier * 1.3, 4 + tier * 0.9, { blast: 17 + tier * 4.5 });
    if (level >= 2) {
      fire(up - 0.52, 3.6, 1.5 + tier * 0.4, 2.2);
      fire(up + 0.52, 3.6, 1.5 + tier * 0.4, 2.2);
    }
    if (level >= 5) {
      fire(up - 2.15, 3.2, 1.5, 2.1);
      fire(up + 2.15, 3.2, 1.5, 2.1);
    }
  } else if (gun === 3) {
    // 3 号圆月弯刀为最强主武器：大尺寸原画月牙、高伤、可连斩穿透、最多 6 把齐飞追敌。
    const count = Math.min(6, Math.max(1, level));
    const r = crescentRadius(level);
    const dmg = 3.4 + level * 0.6;
    const pierce = 2 + Math.floor(level / 2);
    s.crescentFlip = -(s.crescentFlip || 1);
    for (let i = 0; i < count; i++) {
      const side = i - (count - 1) / 2;
      fire(up + side * 0.54, 3.1 + tier * 0.18, dmg, r, {
        life: 175,
        hit: [],
        pierce,
        spinDir: side === 0 ? s.crescentFlip : Math.sign(side) || s.crescentFlip,
        flare: 5,
      });
    }
  } else if (gun === 4) {
    // 火龙向前持续喷涌，多级扩展并行火柱且不随长按缩水。
    const count = level >= 7 ? 4 : level >= 4 ? 3 : level >= 2 ? 2 : 1;
    const reach = 82 + tier * 8;
    for (let i = 0; i < count; i++)
      fire(up + (i - (count - 1) / 2) * 0.14, 4.2, 1.55 + tier * 0.5, 4.4 + tier * 0.55, {
        life: reach,
        hit: [],
        bend: p.dx * 0.36,
      });
  } else {
    const count = Math.min(6, 2 + Math.floor(level / 2));
    for (let i = 0; i < count; i++)
      fire(up + (i - (count - 1) / 2) * 0.068, 5.8, 1.45 + tier * 0.55, 2.8, {
        x: p.x + (i - (count - 1) / 2) * 4.2,
        hit: [],
      });
  }
  s.cooldown = Math.max(3, [0, 7, 15, 13, 7, 11][gun] - p.turbo);
  s.sounds.push('shot' + gun);
}

export function bomb(s) {
  const p = s.ship;
  if (p.stock <= 0 || s.bombs.length || s.phase !== 'flight') return;
  const cost = Math.min(p.stock, p.bombPower === 1 ? 1 : 2);
  p.stock -= cost;
  s.bombs.push({
    kind: p.bomb,
    power: p.bombPower,
    age: 0,
    x: p.x,
    y: p.y,
    life: { F: 156, B: 145, T: 122, W: 162 }[p.bomb] + p.bombPower * 6,
  });
  s.sounds.push('bomb' + p.bomb);
}

export function bombGeometry(b, ship, width = 256) {
  const p = b.power,
    t = b.age,
    half = width / 2,
    left = 128 - half,
    span = width / 256;
  if (b.kind === 'F') return { ring: Math.min(t * 1.7, 18 + p * 5), x: b.x, y: b.y };
  if (b.kind === 'B') return { x: 128 - (half + 15) * Math.cos(t * 0.048), width: 6 + p * 2 };
  if (b.kind === 'T') {
    const x = ship.x + Math.sin(t * 0.11) * 80 * span;
    const rx = (k) => 128 + (x - 128) * k;
    return {
      points: [
        [x, -12],
        [rx(-0.65), 52],
        [rx(0.8), 117],
        [rx(-0.8), 174],
        [x, 247],
      ],
      width: 3 + p,
    };
  }
  const drops = [];
  if (t >= 24) {
    const count = Math.round((6 + p * 2) * span);
    for (let i = 0; i < count; i++)
      drops.push({
        x: left + ((29 + i * 43 + Math.floor(t / 53) * 17) % width),
        y: (((t - 24) * 3.5 + i * 39) % 298) - 27,
      });
  }
  return { drops };
}

export function segmentDistance(x, y, a, b) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    k = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(x - a[0] - k * dx, y - a[1] - k * dy);
}
export function bombTouches(b, g, x, y, r) {
  if (b.kind === 'F') return Math.abs(Math.hypot(x - g.x, y - g.y) - g.ring) <= r + 5;
  if (b.kind === 'B') return Math.abs(x - g.x) <= g.width + r;
  if (b.kind === 'T')
    return g.points.some((v, i) => i && segmentDistance(x, y, g.points[i - 1], v) <= g.width + r);
  return g.drops.some((d) => Math.hypot(x - d.x, y - d.y) < 10 + r + b.power);
}

export function drop(s, x, y, kind, delay = 0, extra = {}) {
  s.items.push({ x, y, ox: x, age: -delay, kind, r: 6, ...extra });
}
export function supply(s, x, y) {
  const sequence = [
    'wing',
    'gun',
    'wing',
    'gun',
    'bomb',
    'wing',
    'chip',
    'gun',
    'wing',
    'eraser',
    'gun',
    'life',
  ];
  let kind = sequence[s.supplyCount++ % sequence.length];
  if (kind === 'gun') kind = 'gun' + (1 + Math.floor(random(s) * 5));
  if (kind === 'bomb') kind = 'bomb' + 'FBTW'[Math.floor(random(s) * 4)];
  drop(s, x, y, kind);
}
const COMBAT_DROPS = ['wing', 'gun', 'wing', 'chip', 'gun', 'wing', 'bomb', 'gun', 'wing', 'money'];
export function combatDrop(s, x, y) {
  const step = Math.max(0, Math.floor(s.kills / 6) - 1);
  let kind = COMBAT_DROPS[step % COMBAT_DROPS.length];
  if (!s.ship.wing && (kind === 'money' || kind === 'chip')) kind = 'wing';
  if (kind === 'gun') kind = 'gun' + (1 + Math.floor(random(s) * 5));
  if (kind === 'bomb') kind = 'bomb' + 'FBTW'[Math.floor(random(s) * 4)];
  drop(s, x, y, kind);
}
export function powerUp(p) {
  p.power = Math.max(p.power, Math.min(p.wing ? 8 : 3, p.power + 1));
}
export function equip(p, gun) {
  if (p.gun === gun) powerUp(p);
  else {
    p.gun = gun;
    p.power = 1;
  }
}
export function collect(s, item) {
  const p = s.ship,
    k = item.kind;
  if (k.startsWith('gun')) equip(p, Number(k.slice(3)));
  else if (k.startsWith('bomb')) {
    const type = k.slice(4);
    p.stock = Math.min(20, p.stock + 1);
    p.bombPower = p.bomb === type ? Math.min(4, p.bombPower + 1) : 1;
    p.bomb = type;
  } else if (k === 'wing') {
    if (p.wing) powerUp(p);
    p.wing = true;
  } else if (k === 'chip') {
    if (++p.chips >= 2) {
      powerUp(p);
      p.chips = 0;
    }
  } else if (k === 'life') {
    p.lives++;
    p.wing = true;
  } else if (k === 'money') {
    p.cash += 3;
    if (s.converter) {
      while (p.cash >= 10 && p.stock < 20) {
        p.cash -= 10;
        p.stock++;
        p.bombPower = Math.min(4, p.bombPower + 1);
      }
    }
  } else if (k === 'eraser') {
    s.score += s.enemies.filter((e) => e.age >= 0).reduce((sum, e) => sum + e.score, 0);
    s.enemies = s.enemies.filter((e) => e.age < 0);
    s.hostile = [];
    s.effects.push({ kind: 'clear', x: p.x, y: p.y, age: 0, life: 28 });
  }
  s.sounds.push('pickup');
}
