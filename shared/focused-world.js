import { randomGenerator } from './random.js';
import { WORLD_ACTS, themeFor } from './levels.js';
import { LEVEL_COLLECTIBLES } from './collectibles.js';
import { EXPANDED_THEME_MONSTERS, MONSTERS } from './adventure-catalog.js';
import { bossBaseline } from './boss-health.js';
import { BOSS_THEMES } from './boss-world.js';
import { bossSkills } from './boss-skills.js';
import { monsterVitality, roleForBehavior } from './monster-roles.js';
import { openLiftShafts } from './roguelite-world.js';

const SURFACES = { rainbow:'bank', family:'roof', sweet:'cookie', beach:'rock', meadow:'bank', snow:'ice', forest:'root', cartoon:'blocks' };
const BEAT_NAMES = ['先学会这一下', '换条路过去', '收紧再见面'];
const BOSS_SKILL_INDEX = { rainbow: 0, family: 1, sweet: 1, beach: 0, meadow: 2, snow: 0, forest: 0, cartoon: 1 };

function patternsFor(structure) {
  return {
    'spring-cloud'(b) {
      b.spring();
      b.next(1.6, 4.6, b.gap(), { isCrumbling: true, skin: 'cloud' });
      b.next(-1.6, 7, b.gap());
    },
    'roof-pendulum'(b) {
      b.next(2, 5, 0, { skin: 'roof', depth: 5 });
      b.next(0, 14, b.gap(), { isBridge: true, skin: 'roof' });
      b.hazard(b.state.cursor, 'pendulum');
      b.next(-2, 8);
    },
    'gate-belt'(b) {
      b.next(0, 8);
      const base = b.state.cursor;
      const bridge = b.next(0, 12, 0, { isBridge: true, gateId: b.world.switches.length, isEnabled: false });
      b.world.edges.at(-1).kind = 'gate';
      b.world.switches.push({ id: b.world.switches.length, x: base.x, y: base.y, platformId: base.id, bridgeId: bridge.id, isOpen: false });
      b.next(0, 12, b.gap(), { conveyor: 1.4 });
    },
    tide(b) {
      b.next(0, 7, b.gap(), { skin: 'rock' });
      b.lift('x', 10, 'raft');
      b.next(0, 12, b.gap(), { skin: 'rock' });
      b.hazard(b.state.cursor, 'geyser');
      b.next(1.2, 8);
    },
    rise(b) {
      b.next(0, 12, b.gap(), { isSeesaw: true, slope: 0, skin: 'plank' });
      b.lift('y', 6, 'gear');
    },
    ice(b) {
      b.next(0, 10, 0, { isIce: true });
      b.slope(-2, 12);
      b.state.cursor.isIce = true;
      b.hazard(b.state.cursor, 'icicle');
      b.next(0, 8, b.gap(), { isIce: true });
    },
    climb(b) {
      b.lift('y', 6, 'leaf');
      b.spring();
    },
    relay(b) {
      b.next(0, 10, b.gap(), { conveyor: 1.4 });
      b.next(0, 6, 1.05, { isCrumbling: true, skin: 'blocks' });
      b.next(0, 8, 1.05);
      b.lift('y', 5.5, 'gear');
    },
  }[structure];
}

function createBuilder(world, theme, random) {
  const state = { zoneId: 0, cursor: null };
  const add = (x, y, width = 6, extra = {}) => {
    const platform = { id: world.platforms.length, x, y, width, isOneWay: true, zone: state.zoneId, progress: state.zoneId, skin: SURFACES[theme.id], ...extra };
    world.platforms.push(platform);
    return platform;
  };
  const edge = (from, to, kind = 'jump') => world.edges.push({ from: from.id, to: to.id, kind });
  const next = (dy = 0, width = 6, gap = 1.2, extra = {}) => {
    const platform = add(state.cursor.x + state.cursor.width / 2 + gap + width / 2, state.cursor.y + dy, width, extra);
    edge(state.cursor, platform);
    state.cursor = platform;
    world.mainPath.push(platform.id);
    return platform;
  };
  const lift = (axis, travel, skin) => {
    const base = state.cursor;
    const platform = add(base.x + base.width / 2 + 3, base.y, 5, { isMoving: true, axis, baseX: base.x + base.width / 2 + 3, baseY: base.y, travel, period: 7, skin });
    edge(base, platform, 'board');
    world.lifts.push(platform);
    world.mainPath.push(platform.id);
    state.cursor = platform;
    const exit = add(platform.x + (axis === 'x' ? travel : 0) + 6, platform.y + (axis === 'y' ? travel : 0), 7);
    edge(platform, exit, 'ride');
    state.cursor = exit;
    world.mainPath.push(exit.id);
  };
  const hazard = (platform, kind) => {
    if (!platform || platform.width < 7 || platform.isMoving || platform.isCheckpoint) return;
    world.hazards.push({ id: world.hazards.length, kind, platformId: platform.id, x: platform.x, y: platform.y, period: 6.5, phase: random() * 2, length: 5, warning: 1.35, active: 1.35 });
  };
  const slope = (rise, width = 10) => next(rise / 2, width, 0, { slope: rise / width, depth: 3.5 });
  const spring = () => {
    const platform = state.cursor;
    world.springs.push({ x: platform.x, y: platform.y, platformId: platform.id, power: 18 });
    const top = add(platform.x + 5, platform.y + 5.5, 6, { skin: theme.id === 'forest' ? 'leaf' : SURFACES[theme.id] });
    edge(platform, top, 'spring');
    state.cursor = top;
    world.mainPath.push(top.id);
  };
  return { world, state, add, edge, next, lift, hazard, slope, spring, gap: () => 1.15 + random() * 0.45, random };
}

function addFork(world, builder, zone, entry, exit) {
  const { add, edge, random } = builder;
  const isUpper = random() < 0.5;
  const sign = isUpper ? 1 : -1;
  const routeId = isUpper ? 'upper' : 'lower';
  const span = exit.x - entry.x;
  const count = Math.max(4, Math.ceil(span / 7));
  const ids = [];
  let prior = entry;
  for (let n = 1; n < count; n++) {
    const rise = Math.min(n, count - n, 2) * 2.3;
    const platform = add(entry.x + span * n / count, entry.y + sign * rise, 5 + random() * 1.5, {
      isBranch: true, isTunnel: !isUpper, skin: !isUpper ? 'rock' : world.themeId === 'forest' ? 'leaf' : SURFACES[world.themeId],
      forkRoute: { forkId: zone.id, routeId },
    });
    ids.push(platform.id);
    edge(prior, platform, n === 1 && !isUpper ? 'drop' : 'jump');
    prior = platform;
  }
  edge(prior, exit, isUpper ? 'drop' : 'jump');
  const mainIds = zone.platformIds.filter(id => id !== exit.id);
  for (const id of mainIds) world.platforms[id].forkRoute = { forkId: zone.id, routeId: 'main' };
  world.forks.push({
    id: zone.id, zone: zone.id, startId: entry.id, endId: exit.id, x: entry.x, y: entry.y,
    routes: [
      { id: 'main', name: '原来的路', family: 'power', platformIds: mainIds },
      { id: routeId, name: isUpper ? '高处绕行' : '低处绕行', family: 'flight', platformIds: ids },
    ],
  });
  zone.platformIds.push(...ids);
  const node = world.routeGraph.find(item => item.id === `room:${zone.id}`);
  node.next.push(`detour:${zone.id}`);
  world.routeGraph.push({ id: `detour:${zone.id}`, kind: routeId, next: [`room:${zone.id}`, 'room:2'] });
}

function homesOf(world, zone) {
  return zone.platformIds.map(id => world.platforms[id]).filter(platform => !platform.isMoving && !platform.isCheckpoint && !platform.isCrumbling && platform.gateId === undefined && !platform.slope && !platform.isSeesaw && !platform.isBranch && platform.width >= 5);
}

function placeEnemy(world, stage, platform, kind, random) {
  const definition = MONSTERS[kind];
  const spec = monsterVitality(kind, stage, false);
  const enemy = {
    id: world.enemies.length + 1, platformId: platform.id, zone: platform.zone, kind, ...definition,
    x: platform.x, y: platform.y, baseY: platform.y, minX: platform.x - platform.width / 2 + 1, maxX: platform.x + platform.width / 2 - 1,
    direction: random() < 0.5 ? -1 : 1, speed: 0.7, width: 1.3, height: 1.55, phase: random() * 3, elapsed: 0,
    hp: spec.hp, maxHp: spec.hp, touchDamage: spec.touchDamage, period: spec.period, showBar: spec.showBar, role: spec.role,
    isElite: false, isDefeated: false, drop: null, combatVersion: 2,
  };
  world.enemies.push(enemy);
  return enemy;
}

function placeMobs(world, stage, random) {
  const pool = EXPANDED_THEME_MONSTERS[stage.themeId];
  const light = pool.filter(kind => !monsterVitality(kind, stage).showBar);
  const heavy = pool.filter(kind => monsterVitality(kind, stage).showBar);
  const counts = [2 + Math.floor(random() * 2), 2, 4];
  const usedHeavy = new Set();
  for (const zone of world.zones.filter(item => !item.isBoss)) {
    const used = new Set();
    const homes = homesOf(world, zone).sort((a, b) => a.x - b.x);
    let placed = 0;
    const want = counts[zone.id] || 0;
    const kinds = [];
    if (zone.id === 2) {
      for (const kind of heavy) {
        const role = roleForBehavior(MONSTERS[kind].behavior);
        if (usedHeavy.has(role)) continue;
        kinds.push(kind);
        usedHeavy.add(role);
        if (kinds.length === 2) break;
      }
    }
    for (const kind of light) if (!used.has(MONSTERS[kind].behavior)) kinds.push(kind);
    for (const home of homes) {
      if (placed >= want) break;
      const crowded = world.enemies.filter(enemy => !enemy.isBoss && Math.abs(enemy.x - home.x) < 13 && Math.abs(enemy.y - home.y) < 6).length;
      if (crowded >= 2) continue;
      const kind = kinds.find(item => !used.has(MONSTERS[item].behavior));
      if (!kind) break;
      placeEnemy(world, stage, home, kind, random);
      used.add(MONSTERS[kind].behavior);
      placed += 1;
    }
  }
}

function addBoss(world, stage) {
  const theme = BOSS_THEMES[world.themeId];
  const previous = world.finish;
  previous.isFinish = false;
  const zone = world.zones.length;
  const add = (x, y, width, extra = {}) => {
    const platform = { id: world.platforms.length, x, y, width, isOneWay: true, zone, progress: zone, skin: previous.skin, ...extra };
    world.platforms.push(platform);
    return platform;
  };
  const floor = add(previous.x + previous.width / 2 + 16, previous.y, 32, { isCheckpoint: true, isBossFloor: true });
  world.edges.push({ from: previous.id, to: floor.id, kind: 'jump' });
  world.mainPath.push(floor.id);
  const low = add(floor.x - 10, floor.y + 2.2, 6);
  const high = add(floor.x - 5.5, floor.y + 4.4, 6);
  world.edges.push({ from: floor.id, to: low.id, kind: 'jump' }, { from: low.id, to: high.id, kind: 'jump' }, { from: high.id, to: floor.id, kind: 'drop' });
  const skills = [bossSkills(world.themeId, 0, true)[BOSS_SKILL_INDEX[world.themeId]]];
  const hp = bossBaseline(stage, 'world', 8);
  const boss = {
    id: world.enemies.length + 1, kind: theme.kinds[0], image: theme.image, name: theme.leader,
    isBoss: true, isWorldBoss: true, isMidBoss: false, arenaId: 0, combatVersion: 2,
    platformId: floor.id, zone, x: floor.x + 7, y: floor.y, baseY: floor.y, minX: floor.x - 10, maxX: floor.x + 11, direction: -1, speed: 0,
    width: 5.8, height: 7.5, hp, maxHp: hp, elapsed: 0, phase: 0, points: 250, family: theme.family,
    skills, patterns: skills.map(skill => skill.kind), isDormant: true, isDefeated: false, isShielded: false,
    shieldUntil: 0, attackIndex: 0, attackTime: 0, attackStage: 'rest', warningX: floor.x, drop: null,
  };
  world.enemies.push(boss);
  const exit = add(floor.x + floor.width / 2 + 4, floor.y, 8, { isCheckpoint: true, milestone: zone + 1 });
  world.edges.push({ from: floor.id, to: exit.id, kind: 'jump' });
  world.mainPath.push(exit.id);
  world.milestones.push(exit.id);
  const ids = [floor.id, low.id, high.id, exit.id];
  world.bossArenas = [{ id: 0, bossId: boss.id, floorId: floor.id, exitId: exit.id, left: floor.x - 15, right: floor.x + 15, y: floor.y, layout: 'platform', switchX: floor.x - 9, switchY: floor.y }];
  world.zones.push({ id: zone, name: boss.name, kind: 'boss', isBoss: true, startId: floor.id, exitId: exit.id, minX: floor.x - 15, maxX: exit.x + 4, baseY: floor.y, platformIds: ids });
  world.finish = exit;
  exit.isFinish = true;
  world.maxX = exit.x + 5;
  world.maxY = Math.max(world.maxY, ...world.platforms.map(platform => platform.y + 7));
}

// 第 8 版每个世界只走一条规则。种子改落点、岔路左右和宝物位置，不改这一关在练什么。
export function createFocusedWorld(seed, selected) {
  const requestedId = typeof selected === 'string' ? selected : selected.id;
  const stage = WORLD_ACTS.find(item => item.id === requestedId);
  if (!stage) throw new Error('找不到这个世界关');
  const theme = themeFor(stage);
  const random = randomGenerator((seed ^ Math.imul(stage.worldIndex + 1, 0x45d9f3b)) >>> 0);
  const world = {
    version: 8, seed, levelId: stage.id, stageId: stage.id, themeId: theme.id, route: stage.structure,
    platforms: [], treasures: [], enemies: [], springs: [], lifts: [], switches: [], zones: [], milestones: [],
    decorations: [], mainPath: [], edges: [], forks: [], camps: [], hazards: [], supplies: [], routeGraph: [], bossArenas: [],
  };
  const builder = createBuilder(world, theme, random);
  const pattern = patternsFor(stage.structure);
  builder.state.cursor = builder.add(0, 0, 14, { isCheckpoint: true });
  world.start = builder.state.cursor;
  world.mainPath.push(world.start.id);
  for (let beat = 0; beat < 3; beat++) {
    builder.state.zoneId = beat;
    const entry = builder.state.cursor;
    const first = world.platforms.length;
    const zone = { id: beat, name: `${BEAT_NAMES[beat]}`, kind: stage.structure, startId: entry.id, minX: entry.x, baseY: entry.y, platformIds: [] };
    world.zones.push(zone);
    const repeats = beat === 2 ? 2 : 1;
    for (let time = 0; time < repeats; time++) pattern(builder);
    while (Math.abs(builder.state.cursor.y - entry.y) > 2.3) builder.next(Math.sign(entry.y - builder.state.cursor.y) * 2, 5, 1.1);
    const exit = builder.next(entry.y - builder.state.cursor.y, 10, 1.1, { isCheckpoint: true, milestone: beat + 1 });
    zone.exitId = exit.id;
    world.milestones.push(exit.id);
    zone.maxX = exit.x + exit.width / 2;
    zone.platformIds = world.platforms.slice(first).map(platform => platform.id);
    world.routeGraph.push({ id: `room:${beat}`, kind: stage.structure, next: beat < 2 ? [`room:${beat + 1}`] : ['boss'] });
    if (beat === 1) addFork(world, builder, zone, entry, exit);
    const grounds = homesOf(world, zone);
    if (grounds.length) {
      const home = grounds[Math.floor(random() * grounds.length)];
      const treasureKind = LEVEL_COLLECTIBLES[theme.id][Math.floor(random() * LEVEL_COLLECTIBLES[theme.id].length)];
      world.treasures.push({ id: world.treasures.length + 1, kind: treasureKind, platformId: home.id, x: home.x, y: home.y + 1.4 });
    }
    world.decorations.push({ kind: theme.id, x: (entry.x + exit.x) / 2, y: entry.y - 4, width: Math.max(12, exit.x - entry.x), height: 18, zone: beat });
  }
  world.finish = builder.state.cursor;
  world.finish.isFinish = true;
  placeMobs(world, stage, random);
  addBoss(world, stage);
  const supplyHome = world.zones[1].platformIds.map(id => world.platforms[id]).find(platform => !platform.isMoving && !platform.isBranch) || world.start;
  world.supplies.push({ id: 'life:0', kind: 'life', platformId: supplyHome.id, x: supplyHome.x, y: supplyHome.y + 1.1 });
  world.camps = [{ id: 'start', platformId: 0, x: -3, y: 0, zone: 0 }];
  world.requiredFlowers = 0;
  world.minX = -7;
  world.maxX = world.finish.x + 5;
  world.minY = Math.min(...world.platforms.map(platform => platform.y)) - 14;
  world.maxY = Math.max(...world.platforms.map(platform => platform.y + (platform.axis === 'y' ? platform.travel : 0))) + 6;
  openLiftShafts(world);
  for (const parent of [...world.enemies]) if (['candy', 'paint'].includes(parent.kind) && !parent.isBoss) {
    parent.childIds = [];
    for (let i = 0; i < 2; i++) {
      const child = { ...parent, id: world.enemies.length + 1, parentId: parent.id, childIds: undefined, isDormant: true, isElite: false, hp: 12, maxHp: 12, showBar: false, height: 0.8, width: 0.8, points: 5, direction: i ? 1 : -1 };
      parent.childIds.push(child.id);
      world.enemies.push(child);
    }
  }
  world.signature = `${stage.structure}:${world.forks.map(fork => fork.routes[1].id).join(',')}:${world.mainPath.map(id => { const platform = world.platforms[id]; return `${platform.x.toFixed(1)},${platform.y.toFixed(1)}`; }).join(';')}`;
  return world;
}
