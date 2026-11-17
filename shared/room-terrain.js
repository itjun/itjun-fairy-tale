import { MONSTERS } from './adventure-catalog.js';
import { monsterVitality } from './monster-roles.js';

// 一层高 2.4，人一次能跳 3.4。左右有重叠的平台上下至少差一层；同一层要么接成一整块地面，要么留出看得清的缝。
export const LAYER = 2.4;
export const MIN_GAP = 1.1;
const LAYER_SLACK = 0.2;
const SURFACES = { rainbow: 'bank', family: 'roof', sweet: 'cookie', beach: 'rock', meadow: 'bank', snow: 'ice', forest: 'root', cartoon: 'blocks' };
// 补进房间的陷阱都贴着地面。钟摆要一整座桥才摆得开，只留在家人小镇自己的屋顶机关里。
const TRAPS = { rainbow: 'thorns', family: 'thorns', sweet: 'steam', beach: 'geyser', meadow: 'thorns', snow: 'icicle', forest: 'thorns', cartoon: 'steam' };
const BLOCKS = { rainbow: 'thorns', family: 'blocks', sweet: 'blocks', beach: 'thorns', meadow: 'thorns', snow: 'thorns', forest: 'thorns', cartoon: 'blocks' };
const LIFTS = { rainbow: 'leaf', family: 'gear', sweet: 'gear', beach: 'raft', meadow: 'gear', snow: 'ice', forest: 'leaf', cartoon: 'gear' };
const CRUMBLES = { rainbow: 'cloud', family: 'cloud', sweet: 'cookie', beach: 'cloud', meadow: 'cloud', snow: 'ice', forest: 'cloud', cartoon: 'blocks' };
// 怪按行动方式挑落脚点：会射的站高台，会飞的守坑和竖井，会冲的放长平地，会跳的放台阶。
const SPOT_FOR_ROLE = { shooter: 'perch', flyer: 'air', charger: 'run', hopper: 'step' };

// 平台占的地方。移动台按走过的整段路算，斜坡按两头的高度算。
function extent(platform) {
  const baseX = platform.baseX ?? platform.x, baseY = platform.baseY ?? platform.y;
  const lean = Math.abs(platform.slope || 0) * platform.width / 2;
  return {
    left: baseX - platform.width / 2, right: baseX + platform.width / 2 + (platform.axis === 'x' ? platform.travel : 0),
    bottom: baseY - lean, top: baseY + lean + (platform.axis === 'y' ? platform.travel : 0),
  };
}

// 两块平台是不是贴得太近。接成一整块地面的不算，移动台只看有没有别的平台伸进它的路。
export function isCrowding(a, b) {
  const first = extent(a), second = extent(b);
  if (Math.max(first.bottom - second.top, second.bottom - first.top) >= LAYER - LAYER_SLACK) return false;
  const gap = Math.max(first.left, second.left) - Math.min(first.right, second.right);
  if (a.isMoving || b.isMoving) return gap < -0.05;
  if (gap >= MIN_GAP - 0.01) return false;
  const [left, right] = a.x <= b.x ? [a, b] : [b, a];
  const leftEnd = left.y + (left.slope || 0) * left.width / 2, rightEnd = right.y - (right.slope || 0) * right.width / 2;
  return Math.abs(gap) > 0.05 || Math.abs(leftEnd - rightEnd) > 0.05;
}

export function createBuilder(world, theme, random) {
  const state = { zoneId: 0, cursor: null, firstId: 0, lastShape: '', lastArena: '' };
  const add = (x, y, width = 6, extra = {}) => {
    const platform = { id: world.platforms.length, x, y, width, isOneWay: true, zone: state.zoneId, progress: state.zoneId, skin: SURFACES[theme.id], ...extra };
    world.platforms.push(platform);
    return platform;
  };
  // 主路上的下一块：接在当前这块的右边（side 为 -1 时接在左边）。
  const step = (side, dy, width, gap, extra) => {
    const platform = add(state.cursor.x + side * (state.cursor.width / 2 + gap + width / 2), state.cursor.y + dy, width, extra);
    state.cursor = platform;
    world.mainPath.push(platform.id);
    return platform;
  };
  const next = (dy = 0, width = 6, gap = 1.2, extra = {}) => step(1, dy, width, gap, extra);
  const back = (dy = 0, width = 6, gap = 1.2, extra = {}) => step(-1, dy, width, gap, extra);
  // 主路上放在指定位置的一块，竖井里左右交错时用。
  const hop = (x, y, width, extra = {}) => {
    const platform = add(x, y, width, extra);
    state.cursor = platform;
    world.mainPath.push(platform.id);
    return platform;
  };
  // 主路以外的平台都从这里放：和这间房已有的平台贴得太近就抬高一层，还放不下就不放。
  const place = (x, y, width, extra = {}) => {
    const others = world.platforms.slice(state.firstId);
    for (const layerY of [y, y + LAYER]) {
      if (others.every(other => !isCrowding({ x, y: layerY, width }, other))) return add(x, layerY, width, extra);
    }
    return null;
  };
  const lift = (axis, travel, skin = LIFTS[theme.id]) => {
    const base = state.cursor;
    const x = base.x + base.width / 2 + 3;
    const platform = add(x, base.y, 5, { isMoving: true, axis, baseX: x, baseY: base.y, travel, period: 7, skin });
    world.lifts.push(platform);
    world.mainPath.push(platform.id);
    const exit = add(x + (axis === 'x' ? travel : 0) + 6, base.y + (axis === 'y' ? travel : 0), 7);
    state.cursor = exit;
    world.mainPath.push(exit.id);
    return exit;
  };
  const trap = (platform, kind = TRAPS[theme.id], x = platform.x) => {
    world.hazards.push({ id: world.hazards.length, kind, platformId: platform.id, x, y: platform.y, period: 6.5, phase: random() * 2, length: 5, warning: 1.35, active: 1.35 });
  };
  // 不动的障碍：刺丛或积木堆，一直在原地，要跳过去。
  const block = platform => {
    world.hazards.push({ id: world.hazards.length, kind: 'block', skin: BLOCKS[theme.id], platformId: platform.id, x: platform.x, y: platform.y });
  };
  const slope = (rise, width = 10) => next(rise / 2, width, 0, { slope: rise / width });
  const spring = () => {
    const platform = state.cursor;
    world.springs.push({ x: platform.x, y: platform.y, platformId: platform.id, power: 18 });
    return hop(platform.x + 5, platform.y + 5.5, 6, { skin: theme.id === 'forest' ? 'leaf' : SURFACES[theme.id] });
  };
  return { world, theme, state, random, add, next, back, hop, place, lift, trap, block, slope, spring, gap: () => 1.15 + random() * 0.45, crumbleSkin: CRUMBLES[theme.id] };
}

// 每个世界自己的那条机关，嵌在房型后面走一遍。
export function patternsFor(structure) {
  return {
    'spring-cloud'(b) {
      b.spring();
      b.next(1.6, 4.6, b.gap(), { isCrumbling: true, skin: 'cloud' });
      b.next(-1.6, 7, b.gap());
    },
    'roof-pendulum'(b) {
      b.next(LAYER, 5, 1.2, { skin: 'roof' });
      const bridge = b.next(0, 14, b.gap(), { isBridge: true, skin: 'roof' });
      b.trap(bridge, 'pendulum');
      b.next(-LAYER, 8);
    },
    'gate-belt'(b) {
      const base = b.next(0, 8);
      const bridge = b.next(0, 12, 0, { isBridge: true, gateId: b.world.switches.length, isEnabled: false });
      b.world.switches.push({ id: b.world.switches.length, x: base.x, y: base.y, platformId: base.id, bridgeId: bridge.id, isOpen: false });
      b.next(0, 12, b.gap(), { conveyor: 1.4 });
    },
    tide(b) {
      b.next(0, 7, b.gap(), { skin: 'rock' });
      b.lift('x', 10, 'raft');
      const rock = b.next(0, 12, b.gap(), { skin: 'rock' });
      b.trap(rock, 'geyser');
      b.next(1.2, 8);
    },
    rise(b) {
      b.next(0, 12, b.gap(), { isSeesaw: true, slope: 0, skin: 'plank' });
      b.lift('y', 6, 'gear');
    },
    ice(b) {
      b.next(0, 10, 0, { isIce: true });
      const ramp = b.slope(-2, 12);
      ramp.isIce = true;
      b.trap(ramp, 'icicle');
      b.next(0, 8, b.gap(), { isIce: true });
    },
    climb(b) {
      b.lift('y', 6, 'leaf');
      b.spring();
    },
    relay(b) {
      b.next(0, 10, b.gap(), { conveyor: 1.4 });
      b.next(0, 6, 1.15, { isCrumbling: true, skin: 'blocks' });
      b.next(0, 8, 1.15);
      b.lift('y', 5.5, 'gear');
    },
  }[structure];
}

// 五种房型。每种都停在一块空着的宽平台上，后面好接这个世界的机关。look 告诉镜头多看上面还是下面。
export const ROOM_SHAPES = Object.freeze({
  hill: { name: '上山下山', build(b) {
    b.next(LAYER, 6, 1.2, { spot: 'step' });
    b.next(LAYER, 6, 1.2, { spot: 'step' });
    b.next(LAYER, 10, 1.2, { spot: 'perch', isTrapSpot: true });
    b.next(-LAYER, 6, 1.2, { spot: 'step' });
    b.next(-LAYER, 8, 1.2, { spot: 'run' });
  } },
  decks: { name: '上下两层', build(b) {
    const first = b.next(0, 10, 1.2, { spot: 'run' });
    const left = first.x - first.width / 2, low = first.y + LAYER, high = first.y + LAYER * 2;
    b.next(0, 9, LAYER, { spot: 'run', isTrapSpot: true });
    b.next(0, 10, LAYER, { spot: 'run' });
    // 下层两个坑的正上方各有一块台子，掉下去前能踩一脚，也能从这里换层。
    for (const x of [3, 11.2, 22.6, 31.8]) b.place(left + x, low, 4, { spot: 'step' });
    for (const x of [8, 15, 22, 29]) b.place(left + x, high, 5, { spot: 'perch' });
    b.next(0, 7, 1.2, { spot: 'run' });
  } },
  shaft: { name: '往上爬的竖井', look: 'up', build(b) {
    const floor = b.next(0, 12, 1.2, { isOneWay: false, spot: 'run' });
    b.hop(floor.x + 3, floor.y + LAYER, 5, { spot: 'air' });
    b.hop(floor.x - 3, floor.y + LAYER * 2, 5, { spot: 'air' });
    b.hop(floor.x + 3, floor.y + LAYER * 3, 5, { spot: 'air' });
    b.lift('y', LAYER * 2).spot = 'perch';
  } },
  cave: { name: '往下跳的洞', look: 'down', build(b) {
    b.next(-LAYER, 6, 1.2, { spot: 'air' });
    b.next(-LAYER, 6, 1.2, { spot: 'air' });
    b.back(-LAYER, 6, 1.2, { spot: 'air' });
    const last = b.back(-LAYER, 6, 1.2, { spot: 'air' });
    b.hop(last.x + 10, last.y - LAYER, 26, { isOneWay: false, spot: 'run', isTrapSpot: true });
    b.next(0, 8, 1.2, { spot: 'run' });
  } },
  river: { name: '坑上过河', build(b) {
    b.next(0, 7, 1.2, { spot: 'run' });
    b.lift('x', 9).spot = 'air';
    b.next(0, 4.5, 1.3, { isCrumbling: true, skin: b.crumbleSkin, isIce: b.crumbleSkin === 'ice' });
    b.next(0, 4.5, 1.3, { isCrumbling: true, skin: b.crumbleSkin, isIce: b.crumbleSkin === 'ice' });
    b.next(0, 16, 1.3, { spot: 'run', isTrapSpot: true });
    b.next(LAYER, 8, 1.2, { spot: 'perch' });
  } },
});

// 战斗房和精英房的三种场地。grounds 是地面，perches 是怪能站的高台，trapX 是陷阱的位置。
export const ARENAS = Object.freeze({
  pit(b) {
    const left = b.next(0, 10, 1.1, { isOneWay: false, spot: 'run' });
    const right = b.next(0, 10, LAYER, { isOneWay: false, spot: 'run' });
    const perches = [b.place(left.x - 1.5, left.y + LAYER, 5, { spot: 'perch' }), b.place(right.x + 1.5, right.y + LAYER, 5, { spot: 'perch' })];
    return { grounds: [left, right], perches, trapHome: right, trapX: right.x };
  },
  tiers(b) {
    const floor = b.next(0, 22, 1.1, { isOneWay: false, spot: 'run' });
    const perches = [b.place(floor.x - 6.5, floor.y + LAYER, 6, { spot: 'perch' }), b.place(floor.x + 6.5, floor.y + LAYER, 6, { spot: 'perch' })];
    b.place(floor.x, floor.y + LAYER * 2, 6, { spot: 'high' });
    return { grounds: [floor], perches, trapHome: floor, trapX: floor.x };
  },
  lift(b) {
    const floor = b.next(0, 24, 1.1, { isOneWay: false, spot: 'run' });
    const lift = b.add(floor.x, floor.y + LAYER, 5, { isMoving: true, axis: 'y', baseX: floor.x, baseY: floor.y + LAYER, travel: LAYER, period: 7, skin: LIFTS[b.theme.id] });
    b.world.lifts.push(lift);
    for (const side of [-1, 1]) b.place(floor.x + side * 6.6, floor.y + LAYER * 2, 5, { spot: 'high' });
    return { grounds: [floor], perches: [], trapHome: floor, trapX: floor.x + 6 };
  },
});

// 怪能站的位置：平台不动、不塌、不是斜坡和跷跷板，够宽。16 以上的宽平台左右各算一处，怪只在自己那半边走；
// 中间摆了障碍的平台不够宽就不站怪。
export function homesOf(world, room) {
  return room.platformIds.map(id => world.platforms[id]).filter(platform => platform.id !== room.startId && platform.id !== room.exitId
    && !platform.isMoving && !platform.isCrumbling && platform.gateId === undefined && !platform.slope && !platform.isSeesaw && platform.width >= 5)
    .flatMap(platform => {
      if (platform.width >= 16) return [-1, 1].map(side => ({ platform, x: platform.x + side * platform.width / 4, y: platform.y, spot: platform.spot, reach: platform.width / 4 - 1.5 }));
      const hasBlock = world.hazards.some(hazard => hazard.kind === 'block' && hazard.platformId === platform.id);
      return hasBlock ? [] : [{ platform, x: platform.x, y: platform.y, spot: platform.spot, reach: platform.width }];
    });
}

// 先找合这只怪的落脚点，没有就退到长平地，再没有就随便一块。
export function pickHome(homes, role, random) {
  const pick = list => list[Math.floor(random() * list.length)];
  const fit = homes.filter(home => home.spot === SPOT_FOR_ROLE[role]);
  if (fit.length) return pick(fit);
  const plain = homes.filter(home => !home.spot || home.spot === 'run');
  return pick(plain.length ? plain : homes);
}

export function placeEnemy(world, stage, platform, kind, random) {
  const definition = MONSTERS[kind];
  const spec = monsterVitality(kind, stage, false);
  const enemy = {
    id: world.enemies.length + 1, platformId: platform.id, zone: platform.zone, kind, ...definition,
    x: platform.x, y: platform.y, baseY: platform.y, minX: platform.x - platform.width / 2 + 1, maxX: platform.x + platform.width / 2 - 1,
    direction: random() < 0.5 ? -1 : 1, speed: 0.84, width: 1.3, height: 1.55, phase: random() * 3, elapsed: 0,
    hp: spec.hp, maxHp: spec.hp, touchDamage: spec.touchDamage, period: spec.period, showBar: spec.showBar, role: spec.role,
    isElite: false, isDefeated: false, drop: null, combatVersion: 2,
    // 硬壳怪先挡一下，壳掉了才打得动。
    ...(spec.role === 'shell' ? { hasShell: true } : {}),
  };
  world.enemies.push(enemy);
  return enemy;
}

// 给一间房补陷阱和障碍，凑到 count 处。起点、出口不放；离平台边至少 3；两处之间至少隔 6；
// 带节拍的陷阱不放在主路上相邻的两块平台上，中间总有一块能喘口气。
export function addTraps(world, room, builder, count) {
  const { random } = builder;
  const path = room.path.map(id => world.platforms[id]);
  const inRoom = () => world.hazards.filter(hazard => room.platformIds.includes(hazard.platformId));
  const isTimed = platform => !!platform && inRoom().some(hazard => hazard.kind !== 'block' && hazard.platformId === platform.id);
  const isBusy = platform => world.springs.some(item => item.platformId === platform.id) || world.switches.some(item => item.platformId === platform.id) || inRoom().some(hazard => hazard.platformId === platform.id);
  const candidates = path.filter((platform, index) => index > 0 && platform.id !== room.exitId && !platform.isMoving && !platform.isCheckpoint && !platform.isCrumbling
    && !platform.slope && !platform.isSeesaw && platform.gateId === undefined && !platform.conveyor && !platform.isIce && platform.width >= 7 && !isBusy(platform))
    .map(platform => ({ platform, order: (platform.isTrapSpot ? 0 : 1) + random() }))
    .sort((a, b) => a.order - b.order).map(item => item.platform);
  let isBlockNext = random() < 0.5;
  for (const platform of candidates) {
    if (inRoom().length >= count) break;
    if (inRoom().some(hazard => Math.hypot(hazard.x - platform.x, hazard.y - platform.y) < 6)) continue;
    const index = path.indexOf(platform);
    const canTime = !isTimed(path[index - 1]) && !isTimed(path[index + 1]);
    const isBlock = platform.width >= 8 && (isBlockNext || !canTime);
    if (!isBlock && !canTime) continue;
    if (isBlock) builder.block(platform); else builder.trap(platform);
    isBlockNext = !isBlock;
  }
}
