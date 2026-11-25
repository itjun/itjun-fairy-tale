import { clamp, random } from './stages.js';

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
    const angles = [0];
    if (level >= 2) angles.push(-0.42, 0.42);
    if (level >= 5) angles.push(-0.83, 0.83);
    if (level >= 7) angles.push(-2.27, 2.27);
    angles.forEach((a) => fire(up + a, 9, 1 + Math.floor(level / 4), 2.1));
  } else if (gun === 2) {
    fire(up, 2.3, 2 + tier, 3.3 + tier, { blast: 11 + tier * 3 });
    if (level >= 3) {
      fire(up - 2.15, 2.7, 1, 1.8);
      fire(up + 2.15, 2.7, 1, 1.8);
    }
  } else if (gun === 3) {
    const count = Math.min(6, 1 + Math.floor(level / 1.6));
    for (let i = 0; i < count; i++)
      fire(up + (i - (count - 1) / 2) * 0.58, 2.8 + tier * 0.13, 1 + tier * 0.4, 3.1, { life: 150 });
  } else if (gun === 4) {
    const count = level >= 5 ? 3 : level >= 2 ? 2 : 1;
    const reach = 36 + tier * 5 - Math.min(15, Math.floor((s.fireRun ?? 0) / 7));
    for (let i = 0; i < count; i++)
      fire(up + (i - (count - 1) / 2) * 0.14, 3.5, 1.1 + tier * 0.36, 3.5 + tier * 0.4, {
        life: reach,
        hit: [],
        bend: p.dx * 0.36,
      });
  } else {
    const count = Math.min(5, 2 + tier);
    for (let i = 0; i < count; i++)
      fire(up + (i - (count - 1) / 2) * 0.075, 4.6, 1 + tier * 0.5, 2.2, {
        x: p.x + (i - (count - 1) / 2) * 3.2,
        hit: [],
      });
  }
  s.cooldown = Math.max(3, [0, 7, 19, 16, 7, 13][gun] - p.turbo);
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

export function bombGeometry(b, ship) {
  const p = b.power,
    t = b.age;
  if (b.kind === 'F') return { ring: Math.min(t * 1.7, 18 + p * 5), x: b.x, y: b.y };
  if (b.kind === 'B') return { x: 128 - 143 * Math.cos(t * 0.048), width: 6 + p * 2 };
  if (b.kind === 'T') {
    const x = ship.x + Math.sin(t * 0.11) * 80;
    return {
      points: [
        [x, -12],
        [256 - x * 0.65, 52],
        [x * 0.8, 117],
        [256 - x * 0.8, 174],
        [x, 247],
      ],
      width: 3 + p,
    };
  }
  const drops = [];
  if (t >= 24)
    for (let i = 0; i < 6 + p * 2; i++)
      drops.push({
        x: (29 + i * 43 + Math.floor(t / 53) * 17) % 256,
        y: (((t - 24) * 3.5 + i * 39) % 298) - 27,
      });
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

export function drop(s, x, y, kind, delay = 0) {
  s.items.push({ x, y, ox: x, age: -delay, kind, r: 6 });
}
export function supply(s, x, y) {
  const sequence = [
    'wing',
    'gun',
    'money',
    'bomb',
    'chip',
    'money',
    'gun',
    'bomb',
    'chip',
    'gun',
    'money',
    'eraser',
    'bomb',
    'chip',
    'life',
  ];
  let kind = sequence[s.supplyCount++ % sequence.length];
  if (kind === 'gun') kind = 'gun' + (1 + Math.floor(random(s) * 5));
  if (kind === 'bomb') kind = 'bomb' + 'FBTW'[Math.floor(random(s) * 4)];
  drop(s, x, y, kind);
}
export function powerUp(p) {
  p.power = Math.min(p.wing ? 8 : 3, p.power + 1);
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
