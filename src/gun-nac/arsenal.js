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
  const level = p.power;
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
    // 1 级单发，2～3 级只往前散开，4 级起才有后向。等级越高，这一发越重。
    const angles =
      level === 1 ? [0] : level === 2 ? [-0.22, 0, 0.22] : [-0.42, -0.18, 0, 0.18, 0.42];
    if (level >= 4) angles.push(2.45, -2.45);
    angles.forEach((a) => fire(up + a, 9, 1.05 + (level - 1) * 0.28, 1.5 + (level - 1) * 0.12));
  } else if (gun === 2) {
    // 慢射、始终一发，但等级越高球越大、越重、爆开越广。不追踪、不劈弹。
    fire(up, 3.1, 6.8 + (level - 1) * 1.4, 3.2 + (level - 1) * 0.85, {
      blast: 16 + level * 6,
    });
  } else if (gun === 3) {
    // 等级是几就飞出几把，最多 8 把。换枪不改等级。
    const count = Math.min(level, 8);
    const r = crescentRadius(level);
    s.crescentFlip = -(s.crescentFlip || 1);
    const step = count <= 3 ? 0.42 : 0.22;
    for (let i = 0; i < count; i++) {
      const side = i - (count - 1) / 2;
      fire(up + side * step, 3.2, 1.25, r, {
        life: 150,
        spinDir: side === 0 ? s.crescentFlip : Math.sign(side) || s.crescentFlip,
        flare: 5,
      });
    }
  } else if (gun === 4) {
    // 火焰跟随机体左右弯，飞远后变短、伤害下降。
    const count = Math.min(level, 6);
    const baseDamage = 2.2 + tier * 0.35;
    for (let i = 0; i < count; i++)
      fire(up + (i - (count - 1) / 2) * 0.16, 4.2, baseDamage, 2.4, {
        life: 64,
        hit: [],
        baseDamage,
        bend: p.dx * 0.36,
      });
  } else {
    // 细光束穿透敌机。等级是几，就多一束，最多 8 束。
    const count = Math.min(8, level + 1);
    const gap = 4 + level * 0.7;
    for (let i = 0; i < count; i++)
      fire(up, 6.2, 2.2 + tier * 0.35, 1.4, {
        x: p.x + (i - (count - 1) / 2) * gap,
        hit: [],
      });
  }
  s.cooldown = Math.max(3, [0, 7, 18, 14, 8, 11][gun] - p.turbo);
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
  if (b.kind === 'F') return { ring: Math.min(t * 3, 48 + p * 10), x: b.x, y: b.y };
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
  if (b.kind === 'F') return Math.abs(Math.hypot(x - g.x, y - g.y) - g.ring) <= r + g.ring * 0.22;
  if (b.kind === 'B') return Math.abs(x - g.x) <= g.width + r;
  if (b.kind === 'T')
    return g.points.some((v, i) => i && segmentDistance(x, y, g.points[i - 1], v) <= g.width + r);
  return g.drops.some((d) => Math.hypot(x - d.x, y - d.y) < 10 + r + b.power);
}

export function drop(s, x, y, kind, delay = 0, extra = {}) {
  s.items.push({ x, y, ox: x, age: -delay, kind, r: 6, ...extra });
}
// 钱和芯片为主。每 16 件才一只机翼；每四只机翼里有一只换成 1UP。
const LOOT_CYCLE = [
  'money',
  'chip',
  'money',
  'gun',
  'money',
  'chip',
  'money',
  'bomb',
  'money',
  'chip',
  'money',
  'gun',
  'money',
  'chip',
  'money',
  'wing',
];
function nextLoot(s) {
  const step = s.supplyCount++;
  const round = Math.floor(step / LOOT_CYCLE.length);
  let kind = LOOT_CYCLE[step % LOOT_CYCLE.length];
  if (kind === 'wing' && round % 4 === 1) kind = 'eraser';
  if (kind === 'wing' && round % 4 === 3) kind = 'life';
  if (kind === 'gun') kind = 'gun' + (1 + Math.floor(random(s) * 5));
  if (kind === 'bomb') kind = 'bomb' + 'FBTW'[Math.floor(random(s) * 4)];
  return kind;
}
export function supply(s, x, y) {
  drop(s, x, y, nextLoot(s));
}
export function combatDrop(s, x, y) {
  drop(s, x, y, nextLoot(s));
}
export function powerUp(p) {
  p.power = Math.max(p.power, Math.min(p.wing ? 8 : 3, p.power + 1));
}
export function equip(p, gun) {
  // 同号升级。换成别的号时等级原样带走，不能掉回 1 级。
  const next = Number(gun);
  if (!Number.isInteger(next) || next < 1 || next > 5) return;
  const kept = p.power;
  if (p.gun === next) powerUp(p);
  else p.gun = next;
  if (p.power < kept) p.power = kept;
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
