import { BOSS, clamp, playBounds, random, spawnFoe } from './stages.js';
import { aim, fan, hostile, ring } from './arsenal.js';

const DOWN = Math.PI / 2;
export function enterBoss(s, kind) {
  const [, base, r] = BOSS[kind];
  const hp = Math.round(base * (0.82 + s.difficulty * 0.16));
  s.boss = {
    kind,
    hp,
    maxHp: hp,
    r,
    x: 128,
    y: -26,
    age: 0,
    open: true,
    anchor: 128,
    eyes: [Math.ceil(hp / 2), Math.floor(hp / 2)],
    branchX: 128,
    branchY: 170,
  };
  if (['burrow', 'tower', 'octopus'].includes(kind)) s.boss.open = false;
  if (kind === 'burrow')
    s.boss.tiles = [-1, 0, 1].map((n, i) => ({ x: 128 + n * 19, y: 78 + (i % 2) * 12, r: 8, hp: 3 }));
  s.sounds.push('warning');
}
export function rabbitEye(b, side) {
  return { x: b.x + side * 9.5, y: b.y + 4.2, r: 5.1 };
}
export function bossTargets(b) {
  if (!b || !b.open || b.age < 72) return [];
  if (b.kind === 'rabbit')
    return [-1, 1].flatMap((side, i) => (b.eyes[i] > 0 ? [{ ...rabbitEye(b, side), part: i }] : []));
  return [{ x: b.x, y: b.y, r: b.r * 0.85 }];
}
export function hitBoss(b, zone, damage) {
  if (zone.part != null) {
    const amount = Math.min(b.eyes[zone.part], damage);
    b.eyes[zone.part] -= amount;
    b.hp -= amount;
  } else b.hp -= damage;
  b.flash = 4;
}
export function branchTip(b) {
  const t = (b.age - 72) % 225;
  const f = clamp(t < 100 ? t / 100 : (162 - t) / 62, 0, 1);
  return { x: b.x + (b.branchX - b.x) * f, y: b.y + (b.branchY - b.y) * f };
}
export function updateBoss(s) {
  const b = s.boss,
    p = s.ship,
    kind = b.kind;
  b.age++;
  b.flash = Math.max(0, (b.flash || 0) - 1);
  if (b.age <= 72) {
    const stop = kind === 'rabbit' ? 97 : kind === 'clay' && s.area === 0 ? 179 : 47;
    b.y = -26 + ((stop + 26) * b.age) / 72;
    return;
  }
  const t = b.age - 72,
    start = (x) => t % x === 1;
  const { width, left, right, span } = playBounds(s);
  const scale = Math.min(1.55, span);
  const aimed = (n, spread, v, type, opts) =>
    fan(s, b.x, b.y + 5, aim(s, b.x, b.y), n, spread, v, type, opts);
  const wobble = (range, speed = 0.018) => 128 + Math.sin(t * speed) * range * scale;
  switch (kind) {
    case 'orb':
      b.x += clamp(p.x - b.x, -0.52, 0.52);
      b.y += clamp(p.y - b.y, -0.34, 0.34);
      if (start(94)) aimed(5, 0.36, 1.12, 'pearl', { breakable: 1 });
      break;
    case 'battery':
      b.x = wobble(76);
      b.y = 46 + Math.sin(t * 0.022) * 9;
      if (start(62))
        for (const side of [-1, 1])
          hostile(s, b.x + side * 10, b.y + 4, DOWN + side * 0.19, 1.8, 'missile', { breakable: 2, r: 4 });
      if (start(116)) aimed(3, 0.26, 1.05, 'pearl', { breakable: 1 });
      break;
    case 'siren':
      b.x = wobble(64, 0.013);
      if (start(58))
        for (const side of [-1, 1])
          hostile(s, b.x + side * 13, b.y, DOWN - side * 0.86, 1.25, 'curve', {
            turn: side * 0.015,
            turnFrames: 58,
            r: 3.4,
          });
      break;
    case 'acorn':
      b.x = wobble(81, 0.018);
      b.y = 50 + Math.sin(t * 0.029) * 11;
      if (start(55)) fan(s, b.x, b.y, -DOWN, 5, 0.32, 1.6, 'lob', { gravity: 0.024 });
      break;
    case 'cat':
      b.x = wobble(68, 0.011);
      if (start(91))
        for (let i = 0; i < 9; i++) {
          const angle = (i * 2 * Math.PI) / 9;
          const x = b.x + Math.cos(angle) * 91,
            y = b.y + Math.sin(angle) * 91;
          hostile(s, x, y, angle + Math.PI, 0.86, 'returnCoin', { breakable: 1, r: 4, life: 126 });
        }
      break;
    case 'clay': {
      const cycle = t % 180;
      b.open = cycle >= 85;
      if (cycle === 1) b.anchor = left + 40 + random(s) * (width - 80);
      if (!b.open) b.x += clamp(b.anchor - b.x, -1.4, 1.4);
      b.y = s.area === 0 ? 179 : 75 + Math.sin(t * 0.014) * 19;
      if (cycle === 96) {
        s.hazards.push({ kind: 'pillar', x: b.x, y: b.y, age: 0, life: 16 });
        aimed(3, 0.3, 1.25);
      }
      break;
    }
    case 'rabbit': {
      b.x = 128;
      b.y = 97;
      b.open = t % 180 < 68;
      if (t % 180 === 27) {
        for (const side of [-1, 1]) {
          if (b.eyes[(side + 1) / 2] <= 0) continue;
          hostile(s, b.x + side * 34, b.y - 17, side < 0 ? Math.PI : 0, 1.27, 'carrot', {
            r: 3,
            turnFrames: 98,
            turnLimit: 0.044,
          });
        }
      }
      if (start(180))
        for (const side of [-1, 1])
          if (b.eyes[(side + 1) / 2] > 0) spawnFoe(s, 'rabbitDrone', b.x + side * 22, b.y, 'escort', side);
      break;
    }
    case 'lava': {
      const pass = t % 218;
      b.x = wobble(22, 0.018);
      b.y = 44 + (pass > 119 ? Math.sin(((pass - 120) / 98) * Math.PI) * 133 : 0);
      if (pass === 32)
        for (const side of [-1, 1])
          hostile(s, b.x, b.y, -DOWN + side * 0.98, 1.18, 'burst', { burst: 35, r: 5 });
      if (pass === 94) aimed(3, 0.24, 1.32, 'pearl', { breakable: 1 });
      break;
    }
    case 'octopus': {
      const tide = t % 225;
      b.open = tide < 102;
      if (tide === 200) {
        b.x = left + 44 + random(s) * (width - 88);
        b.y = 46 + random(s) * 54;
      }
      if (tide === 23 || tide === 79) ring(s, b.x, b.y, 8, 1.18, t * 0.006);
      if (tide === 119)
        for (let i = 0; i < 4; i++)
          spawnFoe(
            s,
            'tentacle',
            left + 30 + i * ((width - 72) / 3) + random(s) * 12,
            100 + random(s) * 65,
            'tentacle',
            1,
            i * 12,
          );
      break;
    }
    case 'tree': {
      b.x = wobble(37, 0.009);
      const branch = t % 225;
      if (branch === 1) {
        b.branchX = p.x;
        b.branchY = Math.min(229, p.y + 18);
      }
      if (branch >= 103 && branch < 160 && branch % 8 === 0) {
        const tip = branchTip(b);
        hostile(s, tip.x, tip.y, DOWN, 0.88);
      }
      if (start(67)) aimed(3, 0.31, 1.1);
      break;
    }
    case 'gold':
      b.x = wobble(68, 0.017);
      if (start(68))
        for (const side of [-1, 1])
          hostile(s, b.x + side * 14, b.y, DOWN - side * 1.08, 1.3, 'curve', {
            turn: side * 0.02,
            turnFrames: 65,
          });
      if (start(98)) {
        const x = clamp(p.x + (random(s) - 0.5) * 66, left + 8, right - 8);
        s.hazards.push({ kind: 'tile', x, y: clamp(p.y + 12, 70, 219), age: 0, life: 49 });
      }
      break;
    case 'tower': {
      const cycle = t % 172;
      b.open = cycle >= 37 && cycle < 132;
      if (cycle === 1) {
        b.x = left + 32 + random(s) * (width - 64);
        b.y = 38 + random(s) * 90;
      }
      if (cycle === 62) {
        aimed(5, 0.28, 1.24, 'shard');
      }
      if (cycle === 106) aimed(2, 0.15, 1.7);
      break;
    }
    case 'moon':
      b.x = wobble(91, 0.025);
      b.y = 66 + Math.sin(t * 0.031) * 29;
      if (start(42)) aimed(4, 0.23, 1.38, 'moon', { breakable: 1, r: 4 });
      break;
    case 'burrow': {
      const cycle = t % 195;
      b.open = cycle >= 37 && cycle < 151;
      if (t < 130 && b.tiles?.some((tile) => tile.hp > 0)) b.open = false;
      if (cycle === 1) {
        b.anchor = t === 1 ? 128 : left + 38 + random(s) * (width - 76);
        b.x = b.anchor;
        b.y = 77;
      }
      if (b.open) {
        b.x = clamp(b.anchor + Math.sin((cycle - 38) * 0.033) * 86 * scale, left + 19, right - 19);
        b.y = 74 + Math.sin((cycle - 38) * 0.028) * 96;
      }
      if (cycle === 48 || cycle === 99) ring(s, b.x, b.y, 7, 1.13, t * 0.04, 'shard');
      break;
    }
    case 'alien':
      b.x = wobble(56, 0.014);
      b.y = 56 + Math.cos(t * 0.021) * 12;
      if (start(74))
        for (const side of [-1, 1])
          hostile(s, b.x + side * 20, b.y, DOWN, 2.2, 'elbow', {
            turnAt: 30 + Math.floor(random(s) * 38),
            side: -side,
          });
      if (start(123)) hostile(s, b.x, b.y, DOWN, 1.65, 'bubble', { r: 6, burstY: 222 });
      if (start(55)) aimed(3, 0.32, 1.07);
      break;
  }
}
