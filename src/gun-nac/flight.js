import {
  AREA_NAMES,
  BOSS,
  FOES,
  ROUTES,
  SHIP_SPEED,
  clamp,
  random,
  openingPoint,
  launchWave,
} from './stages.js';
import {
  aim,
  fan,
  hostile,
  ring,
  shoot,
  bomb,
  bombGeometry,
  bombTouches,
  collect,
  drop,
  equip,
  supply,
  segmentDistance,
} from './arsenal.js';
import { branchTip, bossTargets, enterBoss, hitBoss, updateBoss } from './bosses.js';

export const SAVE_KEY = 'garden-gun-nac-flight-v1';
export const RECORD_KEY = 'garden-gun-nac-record-v1';
const DOWN = Math.PI / 2;
export function newFlight({ area = 1, difficulty = 2, ricochet = false, seed = 0x47554e } = {}) {
  const s = {
    version: 1,
    area: clamp(area | 0, 0, 8),
    difficulty: clamp(difficulty | 0, 1, 4),
    ricochet,
    seed: seed >>> 0,
    serial: 0,
    frame: 0,
    score: 0,
    nextLife: 30000,
    orders: Array(9).fill(0),
    converter: false,
    ship: {
      x: 128,
      y: 161,
      dx: 0,
      speed: 1,
      lives: 2,
      wing: false,
      gun: 1,
      power: 1,
      turbo: 0,
      chips: 0,
      bomb: 'F',
      bombPower: 1,
      stock: 4,
      cash: 0,
      inv: 120,
    },
  };
  startArea(s, s.area);
  return s;
}
function startArea(s, area) {
  Object.assign(s, {
    area,
    phase: 'flight',
    areaTick: 0,
    scroll: 0,
    index: 0,
    wait: area === 1 ? 108 : 110,
    supplyCount: 0,
    kills: 0,
    boss: null,
    enemies: [],
    hostile: [],
    shots: [],
    items: [],
    effects: [],
    hazards: [],
    bombs: [],
    sounds: [],
    cooldown: 0,
    fireRun: 0,
    banner: 100,
  });
  Object.assign(s.ship, { x: 128, y: 161, dx: 0, inv: 120 });
  s.ship.stock = Math.min(20, s.ship.stock + s.orders[area]);
  s.orders[area] = 0;
}
export function continueFlight(s) {
  if (s.phase !== 'over') return false;
  Object.assign(s.ship, { lives: 2, stock: 4, gun: 1, power: 1, wing: false, chips: 0, bombPower: 1 });
  s.orders = s.orders.map((n) => Math.floor(n / 2));
  startArea(s, s.area);
  return true;
}
export function shopBuy(s, item, target = 0) {
  const p = s.ship;
  if (s.phase !== 'shop') return false;
  let price;
  if (item === 'wing' || /^gun[1-5]$/.test(item)) price = 10;
  else if (item === 'turbo') price = 6;
  else if (item === 'parcel' && Number.isInteger(target) && target > s.area && target <= 8) price = 4;
  else return false;
  if (
    p.cash < price ||
    (item === 'wing' && p.wing) ||
    (item === 'gun' + p.gun && p.power >= (p.wing ? 8 : 3)) ||
    (item === 'turbo' && p.turbo >= 5) ||
    (item === 'parcel' && s.orders[target] >= 20)
  )
    return false;
  p.cash -= price;
  if (item === 'turbo') p.turbo++;
  else if (item === 'parcel') s.orders[target] = Math.min(20, s.orders[target] + 1);
  else if (item === 'wing') p.wing = true;
  else equip(p, Number(item.slice(3)));
  return true;
}
export function depart(s) {
  if (s.phase !== 'shop') return false;
  if (s.area === 7) {
    s.converter = true;
    const traded = Math.min(20 - s.ship.stock, Math.floor(s.ship.cash / 10));
    s.ship.cash -= traded * 10;
    s.ship.stock += traded;
    s.ship.bombPower = Math.min(4, s.ship.bombPower + traded);
  }
  startArea(s, s.area + 1);
  return true;
}
export function nextSpeed(s) {
  if (s.phase === 'flight') s.ship.speed = (s.ship.speed % 4) + 1;
}
function advance(s) {
  if (s.boss || --s.wait > 0) return;
  const entry = ROUTES[s.area][s.index++];
  if (!entry) {
    s.phase = s.area === 8 ? 'ending' : 'shop';
    s.ship.inv = 0;
    s.sounds.push('clear');
    return;
  }
  if (entry.boss) {
    s.enemies = [];
    s.hostile = [];
    s.hazards = [];
    enterBoss(s, entry.boss);
  } else {
    launchWave(s, entry.wave);
    s.wait = entry.wait;
  }
}
function burst(s, x, y, kind = 'hit', life = 16) {
  s.effects.push({ x, y, kind, age: 0, life });
}
function damageShip(s) {
  const p = s.ship;
  if (p.inv > 0 || s.phase !== 'flight') return;
  p.inv = 132;
  burst(s, p.x, p.y, 'hurt', 35);
  s.sounds.push('hurt');
  if (p.wing) {
    p.wing = false;
    p.power = 1;
    return;
  }
  p.cash = Math.floor(p.cash / 2);
  p.power = 1;
  p.gun = 1;
  p.chips = 0;
  p.bombPower = 1;
  p.stock = Math.max(4, p.stock);
  if (p.lives <= 0) {
    s.phase = 'over';
    return;
  }
  p.lives--;
  p.x = 128;
  p.y = 161;
  s.hostile = [];
  s.bombs = [];
}
function enemyOpen(e) {
  return (
    e.age >= 0 &&
    !e.dead &&
    (e.kind !== 'shell' || e.age % 135 >= 53) &&
    (e.path !== 'surface' || e.age >= 34)
  );
}
function fireEnemy(s, e) {
  const a = aim(s, e.x, e.y);
  switch (e.kind) {
    case 'rabbitDrone':
      hostile(s, e.x, e.y, a, 1.21, 'carrot');
      break;
    case 'ember':
      hostile(s, e.x, e.y, a, 0.9, 'burst', { burst: 54, r: 4 });
      break;
    case 'nut':
      ring(s, e.x, e.y, 6, 1.02, a);
      e.dead = true;
      break;
    case 'arrow':
      fan(s, e.x, e.y, a, 3, 0.3, 1.05, 'seek', { turnFrames: 38 });
      e.dead = true;
      break;
    case 'turret':
      if (s.area === 8)
        hostile(s, e.x, e.y, DOWN, 1.7, 'elbow', { turnAt: 45, side: s.ship.x < e.x ? -1 : 1 });
      else fan(s, e.x, e.y, a, 2, 0.22, 1.18);
      break;
    case 'barge':
      fan(s, e.x, e.y, a, 3, 0.26, 0.95);
      break;
    case 'shell':
    case 'stump':
      fan(s, e.x, e.y, a, 3, 0.21, 1.08);
      break;
    case 'missile':
    case 'courier':
      break;
    default:
      hostile(s, e.x, e.y, a, 1.02);
      break;
  }
}
function moveEnemy(s, e) {
  e.age++;
  if (e.age < 0) return;
  const t = e.age,
    sign = e.sign,
    speed = 1 + 0.065 * (s.difficulty - 1);
  switch (e.path) {
    case 'opening':
      Object.assign(e, openingPoint(e, t));
      break;
    case 'cross':
      e.x = e.ox + sign * t * 0.87;
      e.y = e.oy + t * 0.78 * speed;
      break;
    case 'rear':
      e.x = e.ox + Math.sin(t * 0.035) * 17;
      e.y = e.oy - t * 0.92 * speed;
      break;
    case 'weave':
      e.x = clamp(e.ox + Math.sin(t * 0.029) * 69 * sign, 5, 251);
      e.y = e.oy + t * 0.62 * speed;
      break;
    case 'ground':
      e.y = e.oy + t * 0.46;
      break;
    case 'drift':
      e.x = e.ox + Math.sin(t * 0.019) * 31;
      e.y = e.oy + Math.floor(t / 135) * 42 + Math.min(t % 135, 52) * 0.8;
      break;
    case 'dive':
      if (t < 42) {
        e.x = e.ox + Math.sin(t * 0.08) * 14;
        e.y = e.oy + t * 0.75;
      } else {
        if (t === 42) e.angle = aim(s, e.x, e.y);
        e.x += Math.cos(e.angle) * 1.85 * speed;
        e.y += Math.sin(e.angle) * 1.85 * speed;
      }
      break;
    case 'hop':
      e.x = e.ox + Math.sin(t * 0.055) * 28 * sign;
      e.y = e.oy + t * 0.58 * speed - Math.abs(Math.sin(t * 0.05)) * 9;
      break;
    case 'surface':
      e.x = e.ox + Math.sin(t * 0.028) * 31;
      e.y = e.oy + 27 + t * 0.62 * speed;
      break;
    case 'tentacle':
      if (t > 104) e.dead = true;
      break;
    case 'escort':
      e.x = e.ox + sign * Math.sin(t * 0.02) * 37;
      e.y = e.oy + t * 0.75;
      break;
    default:
      e.x = e.ox + Math.sin(t * 0.025) * 22 * sign;
      e.y = e.oy + t * 0.68 * speed;
  }
  if (e.x < -25 || e.x > 281 || e.y > 261 || (e.path === 'rear' && e.y < -16)) {
    e.dead = true;
    return;
  }
  if (t >= e.shotAt && e.y > 6 && e.y < 231 && enemyOpen(e)) {
    fireEnemy(s, e);
    e.shotAt = t + Math.max(65, 150 - 15 * s.difficulty);
  }
}
function defeat(s, e) {
  if (e.dead) return;
  e.dead = true;
  s.kills++;
  s.score += e.score;
  burst(s, e.x, e.y, 'pop', 21);
  if (e.path === 'opening') {
    drop(s, e.x, e.y, 'gun' + (1 + (s.supplyCount++ % 5)), 53);
    s.score += 600 - e.score;
  } else if (e.kind === 'courier' || e.kind === 'barge') supply(s, e.x, e.y);
  else if (e.kind !== 'tentacle' && s.kills % 5 === 0) drop(s, e.x, e.y, 'money');
  if (s.ricochet) hostile(s, e.x, e.y, aim(s, e.x, e.y), 1.55);
}
function nearestTarget(s, x, y) {
  let best = null,
    dist = Infinity;
  for (const e of s.enemies) {
    if (!enemyOpen(e) || e.y < 0 || e.y > 238) continue;
    const d = (x - e.x) ** 2 + (y - e.y) ** 2;
    if (d < dist) {
      best = e;
      dist = d;
    }
  }
  for (const z of bossTargets(s.boss)) {
    const d = (x - z.x) ** 2 + (y - z.y) ** 2;
    if (d < dist) {
      best = z;
      dist = d;
    }
  }
  return best;
}
function hits(a, b, extra = 0) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 <= (a.r + b.r + extra) ** 2;
}
function moveShot(s, b) {
  b.age++;
  if (b.gun === 3 && b.age > 4) {
    const goal = nearestTarget(s, b.x, b.y);
    if (goal) {
      const old = Math.atan2(b.vy, b.vx),
        to = Math.atan2(goal.y - b.y, goal.x - b.x);
      const angle = old + clamp(Math.atan2(Math.sin(to - old), Math.cos(to - old)), -0.095, 0.095);
      const v = Math.hypot(b.vx, b.vy);
      b.vx = Math.cos(angle) * v;
      b.vy = Math.sin(angle) * v;
    }
  }
  if (b.gun === 4) b.bend = (b.bend || 0) * 0.79 + s.ship.dx * 0.16;
  b.x += b.vx + (b.bend || 0);
  b.y += b.vy;
  for (const h of s.hostile) {
    if (!h.dead && h.breakable && hits(b, h)) {
      h.breakable -= b.damage;
      if (h.breakable <= 0) h.dead = true;
      if (!b.hit) {
        b.dead = true;
        return;
      }
    }
  }
  let impacted = false;
  for (const e of s.enemies) {
    if (!enemyOpen(e) || !hits(b, e) || b.hit?.includes(e.id)) continue;
    if (e.kind === 'barge' && Math.abs(b.x - e.x) > 6) continue;
    e.hp -= b.damage;
    b.hit?.push(e.id);
    impacted = true;
    if (e.hp <= 0) defeat(s, e);
    if (!b.hit) break;
  }
  if (s.boss?.kind === 'burrow' && !s.boss.open && s.boss.tiles?.length) {
    const tile = s.boss.tiles.find((t) => t.hp > 0 && hits(b, t));
    if (tile) {
      tile.hp = Math.max(0, tile.hp - b.damage);
      impacted = true;
      burst(s, tile.x, tile.y, 'pop', 18);
    }
  }
  if (!impacted || b.hit) {
    for (const zone of bossTargets(s.boss)) {
      const key = 'boss' + (zone.part ?? 0);
      if (!hits(b, zone) || b.hit?.includes(key)) continue;
      hitBoss(s.boss, zone, b.damage);
      b.hit?.push(key);
      impacted = true;
      break;
    }
  }
  if (impacted) {
    if (b.blast) {
      burst(s, b.x, b.y, 'blast', 18);
      for (const e of s.enemies)
        if (enemyOpen(e) && !hits(b, e) && Math.hypot(e.x - b.x, e.y - b.y) < b.blast + e.r) {
          e.hp -= b.damage;
          if (e.hp <= 0) defeat(s, e);
        }
    } else burst(s, b.x, b.y);
    if (!s.sounds.includes('hit' + b.gun)) s.sounds.push('hit' + b.gun);
    if (!b.hit) b.dead = true;
  }
  if (b.age >= b.life || b.y < -14 || b.y > 255 || b.x < -12 || b.x > 268) b.dead = true;
}

function moveHostile(s, b) {
  b.age++;
  if (b.kind === 'lob') b.vy += b.gravity;
  if (b.age < b.turnFrames && ['curve', 'seek', 'carrot'].includes(b.kind)) {
    const old = Math.atan2(b.vy, b.vx),
      diff = aim(s, b.x, b.y) - old;
    const limit = b.turnLimit ?? 0.026;
    const angle =
      old + (b.kind === 'curve' ? b.turn : clamp(Math.atan2(Math.sin(diff), Math.cos(diff)), -limit, limit));
    const v = Math.hypot(b.vx, b.vy);
    b.vx = Math.cos(angle) * v;
    b.vy = Math.sin(angle) * v;
  }
  if (b.kind === 'elbow' && b.age === b.turnAt) {
    b.vx = b.side * Math.abs(b.vy);
    b.vy = 0;
  }
  b.x += b.vx;
  b.y += b.vy;
  if ((b.burst && b.age >= b.burst) || (b.burstY && b.y >= b.burstY)) {
    if (b.burstY) fan(s, b.x, b.y, -DOWN, 9, 0.31, 1.4);
    else ring(s, b.x, b.y, 7, 1.15);
    b.dead = true;
  }
  if (b.age > b.life || b.x < -18 || b.x > 274 || b.y > 255 || (b.y < -24 && b.kind !== 'lob')) b.dead = true;
}

export function flareWidth(h) {
  return h.age < 42 ? 0 : Math.max(0, Math.sin(((h.age - 42) / (h.life - 42)) * Math.PI)) * 211;
}
function updateHazards(s) {
  const p = s.ship;
  for (const h of s.hazards) {
    h.age++;
    if (h.kind === 'flare' && h.age > 42 && Math.abs(p.y - h.y) < 5 && (p.x - h.x) * h.sign <= flareWidth(h))
      damageShip(s);
    if (h.kind === 'pillar' && Math.abs(p.x - h.x) <= 4.4) damageShip(s);
    if (h.kind === 'tile' && h.age === 46) ring(s, h.x, h.y, 6, 1.25, random(s), 'shard');
  }
  const b = s.boss;
  if (b?.kind === 'tree' && b.age > 72 && (b.age - 72) % 225 < 163) {
    const tip = branchTip(b);
    if (segmentDistance(p.x, p.y, [b.x - 7, b.y + 3], [tip.x, tip.y]) < 3.7) damageShip(s);
  }
  s.hazards = s.hazards.filter((h) => h.age < h.life);
}
function updateBombs(s) {
  for (const b of s.bombs) {
    b.age++;
    const g = bombGeometry(b, s.ship);
    if (b.age === 25 || b.age % 45 === 0) s.sounds.push('pulse' + b.kind);
    for (const h of s.hostile) if (bombTouches(b, g, h.x, h.y, h.r)) h.dead = true;
    if (b.age % 8 === 0) {
      for (const e of s.enemies)
        if (enemyOpen(e) && bombTouches(b, g, e.x, e.y, e.r)) {
          e.hp -= 4 + b.power;
          if (e.hp <= 0) defeat(s, e);
        }
      for (const z of bossTargets(s.boss))
        if (bombTouches(b, g, z.x, z.y, z.r)) hitBoss(s.boss, z, 2 + b.power);
    }
    if (b.age === b.life) s.sounds.push('end' + b.kind);
  }
  s.bombs = s.bombs.filter((b) => b.age < b.life);
}
export function tick(s, input = {}) {
  s.sounds = [];
  if (s.phase !== 'flight') return;
  s.frame++;
  s.areaTick++;
  s.banner = Math.max(0, s.banner - 1);
  s.scroll += s.boss?.kind === 'rabbit' ? 0 : 0.54;
  const p = s.ship;
  const dx = clamp(input.x || 0, -1, 1),
    dy = clamp(input.y || 0, -1, 1),
    norm = Math.max(1, Math.hypot(dx, dy));
  const v = SHIP_SPEED[p.speed];
  p.dx = (dx * v) / norm;
  p.x = clamp(p.x + p.dx, 6, 250);
  p.y = clamp(p.y + (dy * v) / norm, 8, 231);
  if (p.inv > 0) p.inv--;
  if (s.cooldown > 0) s.cooldown--;
  if (input.bomb) bomb(s);
  s.fireRun = input.fire ? Math.min(180, (s.fireRun ?? 0) + 1) : 0;
  if (input.fire && !s.cooldown) shoot(s);
  advance(s);
  if (s.phase !== 'flight') return;
  if (s.boss) updateBoss(s);
  for (const e of s.enemies) moveEnemy(s, e);
  const originalCount = s.hostile.length;
  for (let i = 0; i < originalCount; i++) if (!s.hostile[i].dead) moveHostile(s, s.hostile[i]);
  updateHazards(s);
  updateBombs(s);
  for (const b of s.shots) moveShot(s, b);
  const player = { x: p.x, y: p.y, r: p.wing ? 3.4 : 2.5 };
  for (const h of s.hostile)
    if (!h.dead && !p.inv && hits(h, player)) {
      h.dead = true;
      damageShip(s);
      break;
    }
  if (!p.inv) {
    if (
      s.enemies.some((e) => enemyOpen(e) && hits(e, player)) ||
      bossTargets(s.boss).some((z) => hits(z, player))
    )
      damageShip(s);
  }
  for (const i of s.items) {
    i.age++;
    if (i.age < 0) continue;
    i.y += 0.43;
    i.x = clamp(i.ox + Math.sin(i.age * 0.037) * 13, 6, 250);
    if (hits(i, player, 3)) {
      collect(s, i);
      i.dead = true;
    }
  }
  for (const f of s.effects) f.age++;
  s.enemies = s.enemies.filter((e) => !e.dead);
  s.hostile = s.hostile.filter((h) => !h.dead);
  s.shots = s.shots.filter((b) => !b.dead);
  s.items = s.items.filter((i) => !i.dead && i.y < 250);
  s.effects = s.effects.filter((f) => f.age < f.life);
  if (s.boss && s.boss.hp <= 0.0001 && s.phase === 'flight') {
    s.score += BOSS[s.boss.kind][1] * 19;
    burst(s, s.boss.x, s.boss.y, 'boss', 60);
    s.boss = null;
    s.hostile = [];
    s.hazards = [];
    s.enemies = [];
    s.wait = 90;
    s.sounds.push('victory');
  }
  while (s.score >= s.nextLife) {
    p.lives++;
    s.nextLife = s.nextLife === 30000 ? 100000 : s.nextLife === 100000 ? 200000 : s.nextLife + 200000;
    s.sounds.push('life');
  }
}
export function decodeFlight(raw) {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (
      s?.version !== 1 ||
      !Number.isInteger(s.area) ||
      !AREA_NAMES[s.area] ||
      !['flight', 'shop', 'ending', 'over'].includes(s.phase)
    )
      return null;
    const integer = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max;
    const finite = (obj, keys) => obj && keys.every((k) => Number.isFinite(obj[k]));
    if ((s.phase === 'shop' && s.area === 8) || (s.phase === 'ending' && s.area !== 8)) return null;
    const ship = s.ship;
    if (
      !finite(s, ['areaTick', 'scroll', 'wait', 'supplyCount', 'kills', 'serial', 'cooldown', 'banner']) ||
      !integer(s.frame, 0, Number.MAX_SAFE_INTEGER) ||
      !integer(s.index, 0, ROUTES[s.area].length + 1) ||
      !integer(s.score, 0, Number.MAX_SAFE_INTEGER) ||
      !integer(s.seed, 0, 0xffffffff) ||
      !integer(s.difficulty, 1, 4) ||
      !integer(s.nextLife, s.score + 1, Number.MAX_SAFE_INTEGER) ||
      !finite(ship, ['x', 'y', 'dx', 'inv', 'lives', 'cash', 'chips', 'turbo']) ||
      !integer(ship.speed, 1, 4) ||
      !integer(ship.gun, 1, 5) ||
      !integer(ship.power, 1, 8) ||
      !integer(ship.stock, 0, 20) ||
      !integer(ship.bombPower, 1, 4) ||
      !'FBTW'.includes(ship.bomb) ||
      ship.bomb?.length !== 1
    )
      return null;
    if (!Array.isArray(s.orders) || s.orders.length !== 9 || !s.orders.every((n) => integer(n, 0, 20)))
      return null;
    for (const key of ['enemies', 'hostile', 'shots', 'items', 'effects', 'hazards', 'bombs']) {
      if (
        !Array.isArray(s[key]) ||
        s[key].length > 2048 ||
        !s[key].every((e) => finite(e, ['x', 'y', 'age']))
      )
        return null;
    }
    if (s.enemies.some((e) => !Object.hasOwn(FOES, e.kind) || !finite(e, ['ox', 'oy', 'hp', 'r', 'shotAt'])))
      return null;
    if (
      s.shots.some(
        (b) =>
          !integer(b.gun, 1, 5) ||
          !finite(b, ['vx', 'vy', 'r', 'damage', 'life']) ||
          (b.hit && !Array.isArray(b.hit)),
      )
    )
      return null;
    if (
      s.bombs.some(
        (b) => !['F', 'B', 'T', 'W'].includes(b.kind) || !integer(b.power, 1, 4) || !Number.isFinite(b.life),
      )
    )
      return null;
    if (
      s.boss?.tiles &&
      (!Array.isArray(s.boss.tiles) || !s.boss.tiles.every((t) => finite(t, ['x', 'y', 'r', 'hp'])))
    )
      return null;
    if (s.hostile.some((b) => !finite(b, ['vx', 'vy', 'r', 'life']))) return null;
    if (
      s.items.some(
        (i) =>
          typeof i.kind !== 'string' ||
          !/^(wing|money|chip|life|eraser|gun[1-5]|bomb[FBTW])$/.test(i.kind) ||
          !finite(i, ['ox', 'r']),
      )
    )
      return null;
    if (
      s.boss &&
      (!Object.hasOwn(BOSS, s.boss.kind) ||
        !finite(s.boss, ['x', 'y', 'hp', 'maxHp', 'age', 'r']) ||
        !Array.isArray(s.boss.eyes) ||
        s.boss.eyes.length !== 2 ||
        !s.boss.eyes.every(Number.isFinite))
    )
      return null;
    s.sounds = [];
    return s;
  } catch {
    return null;
  }
}
