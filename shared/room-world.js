import { randomGenerator } from './random.js';
import { WORLD_ACTS, themeFor } from './levels.js';
import { LEVEL_COLLECTIBLES } from './collectibles.js';
import { ADVENTURE_GENERATION_VERSION, EXPANDED_THEME_MONSTERS, MONSTERS } from './adventure-catalog.js';
import { bossBaseline } from './boss-health.js';
import { BOSS_THEMES, bossSkills } from './boss-skills.js';
import { ELITE_TRAITS, monsterVitality } from './monster-roles.js';
import { ARENAS, LAYER, ROOM_SHAPES, addTraps, createBuilder, homesOf, patternsFor, pickHome, placeEnemy } from './room-terrain.js';

export const ROOM_KINDS = Object.freeze({
  intro: { name: '开场房', hint: '先熟悉这个世界的机关' },
  battle: { name: '战斗房', hint: '打完几波怪，门就开了' },
  mechanism: { name: '机关房', hint: '走到出口就过关' },
  puzzle: { name: '宝箱房', hint: '没有怪，解开小谜题' },
  shop: { name: '小店', hint: '用彩笔碎片换东西' },
  elite: { name: '精英房', hint: '一只带特点的大怪，奖励高一档' },
  boss: { name: '首领房', hint: '打赢首领' },
});
// isChoice 的奖励清完房弹三选一；其余的直接掉在门边。
export const DOOR_REWARDS = Object.freeze({
  weapon: { name: '武器', image: 'weapon-moonblade', isChoice: true },
  upgrade: { name: '本领', image: 'collectible-star', isChoice: true },
  spell: { name: '大招', image: 'flame-stream', isChoice: true },
  heart: { name: '爱心', image: 'collectible-heart', isChoice: false },
  fragments: { name: '碎片', image: 'upgrade-recycle', isChoice: false },
  sticker: { name: '画册贴纸', image: 'flower', isChoice: false },
});
export const PUZZLES = Object.freeze({
  tiles: { name: '彩虹砖', hint: '按牌子上的顺序踩彩虹砖' },
  cards: { name: '翻牌配对', hint: '跳起来顶牌子，找到一样的两张' },
  keys: { name: '星星钥匙', hint: '找齐三颗星星钥匙' },
});
export const TILE_COLORS = Object.freeze(['#e8747c', '#f2c14e', '#6fb6e0', '#8ccf7e']);
export const SHOP_STALLS = Object.freeze(['heal', 'skill', 'reroll', 'tierUp']);
const ROLE_COST = { scout: 1, hopper: 1, flyer: 1, charger: 2, shooter: 2, armored: 3, shell: 2, summoner: 3 };
const PICKUPS = ['heart', 'fragments', 'sticker'];
const CARDS = { battle: ['weapon', 'upgrade', 'spell'], elite: ['weapon', 'spell', 'upgrade'] };
// 房间隔得够远，镜头锁在一间房里时看不到别的房间。
const ROOM_GAP = 70;

function shuffled(items, random) {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// 第二到第四间各两间候选。两扇门的房型和奖励都不一样，相邻两层不连着出同一种房，小店一章最多一间，精英房从第三个世界起出现。
// 选卡一章只在中间那一层给一次；这一层有精英房就只给精英房。开场和最后一间不弹，免得进门前领一份、打完再领一份。
function planDoors(stage, random) {
  const plan = [];
  let hasShop = false, previous = { kind: '' };
  for (let depth = 1; depth <= 3; depth++) {
    const isEliteOpen = stage.worldIndex >= 2 && depth >= 2;
    const first = shuffled(['battle', 'mechanism', ...(isEliteOpen ? ['elite'] : [])].filter(kind => kind !== previous.kind), random)[0];
    const others = ['puzzle', 'battle', 'mechanism', ...(hasShop ? [] : ['shop']), ...(isEliteOpen ? ['elite'] : [])].filter(kind => kind !== first);
    const second = shuffled(others, random)[0];
    hasShop ||= second === 'shop';
    plan.push([{ kind: first, reward: null }, { kind: second, reward: null }]);
    previous = { kind: first };
  }
  const eliteLayer = plan.findIndex((layer, index) => index < 2 && layer.some(room => room.kind === 'elite'));
  const cardAt = eliteLayer === -1 ? 1 : eliteLayer;
  for (const [index, layer] of plan.entries()) {
    const isEliteCard = index === cardAt && layer.some(room => room.kind === 'elite');
    let used = '';
    for (const room of layer) {
      if (room.kind === 'shop') continue;
      const isCard = index === cardAt && (isEliteCard ? room.kind === 'elite' : room.kind === 'battle');
      const pool = (isCard ? CARDS[room.kind] : PICKUPS).filter(reward => reward !== used);
      room.reward = shuffled(pool.length ? pool : (isCard ? CARDS[room.kind] : PICKUPS), random)[0];
      used = room.reward;
    }
  }
  return plan;
}

function beginRoom(world, builder, depth, kind, reward, left) {
  builder.state.zoneId = depth;
  builder.state.firstId = world.platforms.length;
  const start = builder.add(left + 4, 0, 8, { isCheckpoint: true, isOneWay: false });
  builder.state.cursor = start;
  const room = { id: world.rooms.length, depth, kind, reward, startId: start.id, pathStart: world.mainPath.length, enemyIds: [], childIds: [], waves: 0, hasChallenge: false };
  world.rooms.push(room);
  world.mainPath.push(start.id);
  return room;
}

// 门是传送，出口就接在主路最后一块的右边，高低都可以。
function endRoom(world, builder, room, extra = {}) {
  const exit = builder.next(0, 12, 1.1, { isCheckpoint: true, isOneWay: false, milestone: room.depth + 1, ...extra });
  room.exitId = exit.id;
  room.platformIds = world.platforms.slice(room.startId).map(platform => platform.id);
  const platforms = room.platformIds.map(id => world.platforms[id]);
  for (const platform of platforms) platform.roomId = room.id;
  room.path = world.mainPath.slice(room.pathStart);
  delete room.pathStart;
  room.left = Math.min(...platforms.map(platform => platform.x - platform.width / 2));
  room.right = Math.max(...platforms.map(platform => platform.x + platform.width / 2 + (platform.axis === 'x' ? platform.travel : 0)));
  room.bottom = Math.min(...platforms.map(platform => platform.baseY ?? platform.y));
  room.top = Math.max(...platforms.map(platform => platform.y + (platform.axis === 'y' ? platform.travel : 0)));
  // 掉到这间房最低的平台下面 6 就算掉坑，高房间里不用等很久。
  room.fallY = room.bottom - 6;
  return exit;
}

function addTreasures(world, room, theme, random, count) {
  const kinds = LEVEL_COLLECTIBLES[theme.id];
  const homes = room.platformIds.map(id => world.platforms[id]).filter(platform => !platform.isMoving && !platform.isCrumbling && platform.id !== room.startId && platform.id !== room.exitId);
  const high = homes.filter(platform => ['perch', 'high'].includes(platform.spot));
  const placed = [];
  for (let n = 0; n < count && homes.length; n++) {
    // 第一件放在高处，爬上去有东西拿。
    // 同一块平台上的宝物至少隔开 1.6，不叠在一起，离陷阱和障碍至少 3。试几次都挤，这一件就不放。
    for (let attempt = 0; attempt < 10; attempt++) {
      const pool = n === 0 && high.length && attempt < 4 ? high : homes;
      const home = pool[Math.floor(random() * pool.length)];
      const x = home.x + (random() - 0.5) * Math.max(0, home.width - 3);
      if (placed.some(treasure => treasure.platformId === home.id && Math.abs(treasure.x - x) < 1.6)) continue;
      if (world.hazards.some(hazard => hazard.platformId === home.id && Math.abs(hazard.x - x) < 3)) continue;
      placed.push({ id: world.treasures.length + 1, kind: kinds[Math.floor(random() * kinds.length)], platformId: home.id, roomId: room.id, x, y: home.y + 1.4 + (home.slope || 0) * (x - home.x) });
      world.treasures.push(placed.at(-1));
      break;
    }
  }
}

function addEnemy(world, stage, room, platform, kind, random, wave, x, reach = 6) {
  const enemy = placeEnemy(world, stage, platform, kind, random);
  if (x !== undefined) {
    enemy.x = x;
    enemy.minX = Math.max(platform.x - platform.width / 2 + 1, x - reach);
    enemy.maxX = Math.min(platform.x + platform.width / 2 - 1, x + reach);
  }
  enemy.roomId = room.id;
  enemy.wave = wave;
  enemy.isDormant = wave > 0;
  room.enemyIds.push(enemy.id);
  return enemy;
}

function addElite(world, stage, room, platform, kind, trait, random, wave, x) {
  const enemy = addEnemy(world, stage, room, platform, kind, random, wave, x);
  const spec = monsterVitality(kind, stage, true), bonus = ELITE_TRAITS[trait];
  const hp = Math.round(spec.hp * bonus.hp);
  Object.assign(enemy, {
    isElite: true, trait, hp, maxHp: hp, showBar: true, points: enemy.points * 2, touchDamage: spec.touchDamage + 4,
    height: 1.55 * bonus.size, width: 1.3 * bonus.size, speed: 0.7 * bonus.speed, period: spec.period * bonus.period,
    ...(trait === 'shield' ? { hasShell: true } : {}),
  });
  return enemy;
}

// 按预算挑一波怪：贵的少放，同一波里动作不重复，最多四只。
function pickWave(stage, budget, random, isLightOnly) {
  const pool = shuffled(EXPANDED_THEME_MONSTERS[stage.themeId], random);
  const kinds = [], behaviors = new Set();
  let left = budget;
  for (const kind of pool) {
    const spec = monsterVitality(kind, stage), cost = ROLE_COST[spec.role];
    if (kinds.length >= 4 || cost > left || behaviors.has(MONSTERS[kind].behavior) || isLightOnly && spec.showBar) continue;
    kinds.push(kind);
    behaviors.add(MONSTERS[kind].behavior);
    left -= cost;
  }
  if (!kinds.length) kinds.push(pool.find(kind => ROLE_COST[monsterVitality(kind, stage).role] === 1) || pool[0]);
  return kinds;
}

// 战斗房和精英房的场地三选一，同一章里挨着的两间不重样。
function buildArena(builder, room, random) {
  const names = Object.keys(ARENAS).filter(name => name !== builder.state.lastArena);
  room.arena = builder.state.lastArena = names[Math.floor(random() * names.length)];
  return ARENAS[room.arena](builder);
}

// 会射的站高台，一块高台只站一只；其余的在地面上散开。
function fillWave(world, stage, room, arena, kinds, random, wave) {
  const perches = shuffled(arena.perches.filter(Boolean), random);
  const spots = shuffled(arena.grounds.flatMap(ground => (ground.width >= 20 ? [-7, -2.5, 2.5, 7] : [-2.5, 2.5]).map(offset => ({ ground, x: ground.x + offset }))), random);
  kinds.forEach((kind, index) => {
    const perch = monsterVitality(kind, stage).role === 'shooter' ? perches.pop() : null;
    const spot = spots[index % spots.length];
    if (perch) addEnemy(world, stage, room, perch, kind, random, wave);
    else addEnemy(world, stage, room, spot.ground, kind, random, wave, spot.x);
  });
}

function heavyKind(stage, random) {
  const pool = shuffled(EXPANDED_THEME_MONSTERS[stage.themeId], random);
  return pool.find(kind => monsterVitality(kind, stage).showBar) || pool[0];
}

// 第二层门起，场地的地面上多一处带预告的陷阱。
function addArenaTrap(builder, room, arena) {
  if (room.depth >= 2) builder.trap(arena.trapHome, undefined, arena.trapX);
}

function buildBattle(world, builder, stage, room, random) {
  const arena = buildArena(builder, room, random);
  const waves = stage.worldIndex >= 3 ? 3 : 2;
  const budget = 5 + stage.worldIndex + room.depth;
  for (let wave = 0; wave < waves; wave++) fillWave(world, stage, room, arena, pickWave(stage, Math.max(2, Math.round(budget / waves)), random, wave === 0), random, wave);
  room.waves = waves;
  // 挑战难度才叫醒的一波：一只精英带一只小怪。别的难度里它们一直睡着，不算进清场。
  const traits = Object.keys(ELITE_TRAITS);
  const far = arena.grounds.at(-1), near = arena.grounds[0];
  const elite = addElite(world, stage, room, far, heavyKind(stage, random), traits[Math.floor(random() * traits.length)], random, waves, far.x + 2.5);
  const helper = addEnemy(world, stage, room, near, pickWave(stage, 1, random, true)[0], random, waves, near.x - 2.5);
  elite.isChallenge = true;
  helper.isChallenge = true;
  room.hasChallenge = true;
  addArenaTrap(builder, room, arena);
}

function buildElite(world, builder, stage, room, random) {
  const arena = buildArena(builder, room, random);
  const traits = Object.keys(ELITE_TRAITS);
  const far = arena.grounds.at(-1);
  room.trait = traits[Math.floor(random() * traits.length)];
  addElite(world, stage, room, far, heavyKind(stage, random), room.trait, random, 0, far.x + 2.5);
  fillWave(world, stage, room, { ...arena, perches: [] }, pickWave(stage, 2, random, true).slice(0, 2), random, 0);
  room.waves = 1;
  if (stage.worldIndex >= 4) {
    fillWave(world, stage, room, arena, pickWave(stage, 3, random, true), random, 1);
    room.waves = 2;
  }
  addArenaTrap(builder, room, arena);
}

// 宝箱房和小店进门先上或先下一级台阶，谜题和摊位在另一层。
function buildPuzzle(world, builder, room, random) {
  const kind = Object.keys(PUZZLES)[Math.floor(random() * 3)];
  const rise = random() < 0.5 ? LAYER : -LAYER;
  builder.next(rise, 5, 1.2, { spot: 'step' });
  const floor = builder.next(rise, 24, 1.2, { isOneWay: false });
  room.floorId = floor.id;
  const ledge = (x, y) => builder.place(x, y, 4.2);
  if (kind === 'tiles') {
    const tiles = [-8.4, -2.8, 2.8, 8.4].map((offset, color) => ({ platformId: ledge(floor.x + offset, floor.y + LAYER).id, color }));
    room.puzzle = { kind, tiles, order: shuffled([0, 1, 2, 3], random) };
  } else if (kind === 'cards') {
    const faces = shuffled([0, 0, 1, 1, 2, 2], random);
    room.puzzle = { kind, cards: faces.map((face, index) => ({ platformId: floor.id, offsetX: -10 + index * 4, height: 3.4, face })) };
  } else {
    const low = ledge(floor.x - 6, floor.y + LAYER), high = ledge(floor.x - 1, floor.y + LAYER * 2), side = ledge(floor.x + 7, floor.y + LAYER);
    room.puzzle = { kind, keys: [{ platformId: low.id, offsetX: 0, height: 1.4 }, { platformId: high.id, offsetX: 0, height: 1.4 }, { platformId: side.id, offsetX: 0, height: 4.2 }] };
  }
}

function buildShop(builder, room) {
  builder.next(LAYER, 5, 1.2, { spot: 'step' });
  builder.next(LAYER, 6, 1.2, { spot: 'high' });
  const floor = builder.next(-LAYER, 22, 1.2, { isOneWay: false });
  room.floorId = floor.id;
  room.stalls = SHOP_STALLS.map((id, index) => ({ id, platformId: floor.id, offsetX: -7.5 + index * 5 }));
}

// 开场房和机关房：先走一种房型，再接这个世界自己的机关。同一章里挨着的两间房型不重样。
function buildMechanism(builder, stage, room, random) {
  const names = Object.keys(ROOM_SHAPES).filter(name => name !== builder.state.lastShape);
  room.shape = builder.state.lastShape = names[Math.floor(random() * names.length)];
  const shape = ROOM_SHAPES[room.shape];
  shape.build(builder);
  if (shape.look) room.look = shape.look;
  patternsFor(stage.structure)(builder);
}

// 怪按落脚点摆：离起点 6 以内不放，两只之间至少隔 6。重的怪前三个世界不出，后面最多两只。
function fillMechanism(world, stage, room, random, count) {
  const start = world.platforms[room.startId];
  const homes = homesOf(world, room).filter(home => home.x - start.x >= 8);
  const kinds = [], behaviors = new Set();
  let heavy = stage.worldIndex < 3 ? 0 : 2;
  for (const kind of shuffled(EXPANDED_THEME_MONSTERS[stage.themeId], random)) {
    const spec = monsterVitality(kind, stage);
    if (kinds.length >= count || behaviors.has(MONSTERS[kind].behavior) || spec.showBar && heavy-- <= 0) continue;
    kinds.push(kind);
    behaviors.add(MONSTERS[kind].behavior);
  }
  for (const kind of kinds) {
    const free = homes.filter(home => !room.enemyIds.some(id => { const other = world.enemies[id - 1]; return Math.hypot(other.x - home.x, other.y - home.y) < 6; }));
    if (!free.length) break;
    const home = pickHome(free, monsterVitality(kind, stage).role, random);
    addEnemy(world, stage, room, home.platform, kind, random, 0, home.x, home.reach);
  }
  room.waves = room.enemyIds.length ? 1 : 0;
}

function buildBoss(world, builder, stage, room) {
  const theme = BOSS_THEMES[world.themeId];
  const floor = builder.next(0, 32, 1.1, { isCheckpoint: true, isBossFloor: true, isOneWay: false });
  for (const [x, level] of [[-10, 1], [-5.5, 2], [10, 1]]) builder.place(floor.x + x, floor.y + LAYER * level, 6);
  // 前半段只用第一招，半血后两招轮着来。
  const skills = bossSkills(world.themeId);
  const hp = bossBaseline(stage);
  const boss = {
    id: world.enemies.length + 1, kind: theme.kinds[0], image: theme.image, name: theme.leader,
    isBoss: true, isWorldBoss: true, hasPhases: true, arenaId: 0, combatVersion: 2, roomId: room.id,
    platformId: floor.id, zone: room.depth, x: floor.x + 7, y: floor.y, baseY: floor.y, minX: floor.x - 10, maxX: floor.x + 11, direction: -1, speed: 0,
    width: 5.8, height: 7.5, hp, maxHp: hp, elapsed: 0, phase: 0, points: 250, family: theme.family,
    skills, patterns: skills.map(skill => skill.kind), isDormant: true, isDefeated: false, isShielded: false,
    shieldUntil: 0, attackIndex: 0, attackTime: 0, attackStage: 'rest', warningX: floor.x, drop: null,
  };
  world.enemies.push(boss);
  room.bossId = boss.id;
  return { floor, boss };
}

// 一章是开场房、三层各两间候选房和首领房。门负责把人送到下一间，种子决定门后是什么。
export function createRoomWorld(seed, selected) {
  const requestedId = typeof selected === 'string' ? selected : selected.id;
  const stage = WORLD_ACTS.find(item => item.id === requestedId);
  if (!stage) throw new Error('找不到这个世界关');
  const theme = themeFor(stage);
  const random = randomGenerator((seed ^ Math.imul(stage.worldIndex + 1, 0x2c1b3c6d)) >>> 0);
  const world = {
    version: ADVENTURE_GENERATION_VERSION, seed, levelId: stage.id, stageId: stage.id, themeId: theme.id, route: stage.structure,
    platforms: [], treasures: [], enemies: [], springs: [], lifts: [], switches: [], zones: [],
    decorations: [], mainPath: [], hazards: [], supplies: [], bossArenas: [],
    rooms: [], doors: [],
  };
  const builder = createBuilder(world, theme, random);
  const layers = [[{ kind: 'intro', reward: null }], ...planDoors(stage, random), [{ kind: 'boss', reward: null }]];
  let left = 0;
  for (const [depth, layer] of layers.entries()) {
    const zone = { id: depth, name: ROOM_KINDS[layer[0].kind].name, kind: layer[0].kind, isBoss: depth === 4, roomIds: [], platformIds: [] };
    world.zones.push(zone);
    for (const { kind, reward } of layer) {
      const room = beginRoom(world, builder, depth, kind, reward, left);
      let bossParts = null;
      if (['intro', 'mechanism'].includes(kind)) buildMechanism(builder, stage, room, random);
      if (kind === 'battle') buildBattle(world, builder, stage, room, random);
      if (kind === 'elite') buildElite(world, builder, stage, room, random);
      if (kind === 'puzzle') buildPuzzle(world, builder, room, random);
      if (kind === 'shop') buildShop(builder, room);
      if (kind === 'boss') bossParts = buildBoss(world, builder, stage, room);
      const exit = endRoom(world, builder, room, kind === 'boss' ? { isFinish: true } : {});
      if (kind === 'intro') { addTraps(world, room, builder, 1); fillMechanism(world, stage, room, random, 3); }
      if (kind === 'mechanism') { addTraps(world, room, builder, 2 + Math.floor(random() * 2)); fillMechanism(world, stage, room, random, 4 + Math.floor(random() * 3)); }
      if (bossParts) {
        const { floor, boss } = bossParts;
        world.bossArenas = [{ id: 0, bossId: boss.id, floorId: floor.id, exitId: exit.id, left: floor.x - 15, right: floor.x + 15, y: floor.y, layout: 'platform', switchX: floor.x - 9, switchY: floor.y }];
        const start = world.platforms[room.startId];
        world.supplies.push({ id: 'life:0', kind: 'life', platformId: start.id, x: start.x + 0.5, y: start.y + 1.1 }, { id: 'medkit:0', kind: 'medkit', platformId: start.id, x: start.x + 2.5, y: start.y + 1.1 });
      } else addTreasures(world, room, theme, random, kind === 'puzzle' ? 4 : kind === 'shop' ? 1 : 3);
      zone.roomIds.push(room.id);
      zone.platformIds.push(...room.platformIds);
      zone.startId ??= room.startId;
      zone.exitId ??= room.exitId;
      zone.minX ??= room.left;
      zone.maxX = room.right;
      zone.baseY = 0;
      world.decorations.push({ kind: theme.id, x: (room.left + room.right) / 2, y: room.bottom - 4, width: Math.max(12, room.right - room.left), height: Math.max(18, room.top - room.bottom + 10), zone: depth });
      left = room.right + ROOM_GAP;
    }
  }
  for (const room of world.rooms) {
    const targets = world.rooms.filter(next => next.depth === room.depth + 1);
    const exit = world.platforms[room.exitId];
    room.exitPlatformIds = [exit.id];
    // 两扇门都在通关旗前方：走过去进低门，顺着两级台阶进高门。
    if (targets.length === 2) room.exitPlatformIds.push(appendRoomPlatform(world, room, exit.x - 0.5, exit.y + LAYER, 4.4, exit.skin).id);
    const high = targets.length === 2 ? appendRoomPlatform(world, room, exit.x + 3.8, exit.y + LAYER * 2, 4.4, exit.skin) : null;
    if (high) room.exitPlatformIds.push(high.id);
    targets.forEach((target, index) => {
      const platform = high && index === 0 ? high : exit;
      world.doors.push({ id: world.doors.length, roomId: room.id, targetRoomId: target.id, platformId: platform.id, offsetX: platform === exit ? 3.8 : 0, kind: target.kind, reward: target.reward });
    });
  }
  const bossRoom = world.rooms.at(-1), floor = world.platforms[world.bossArenas[0].floorId];
  // 保留原来的三块，再补齐中间、右侧和第三层，左右都能连续跳上去躲招。
  for (const [x, level] of [[0, 1], [5.5, 2], [-10, 3], [0, 3], [10, 3]]) {
    appendRoomPlatform(world, bossRoom, floor.x + x, floor.y + LAYER * level, 6, floor.skin);
  }
  world.start = world.platforms[world.rooms[0].startId];
  world.finish = world.platforms[world.rooms.at(-1).exitId];
  world.requiredFlowers = 0;
  world.minX = -1;
  world.maxX = world.finish.x + 6;
  world.minY = Math.min(...world.rooms.map(room => room.fallY));
  world.maxY = Math.max(...world.rooms.map(room => room.top)) + 7;
  // 会分身的怪：糖果团、彩笔桶和带“会分身”特点的精英，子怪先睡着，打倒或召唤时再放出来。
  for (const parent of [...world.enemies]) if (!parent.isBoss && (['candy', 'paint'].includes(parent.kind) || parent.trait === 'split')) {
    parent.childIds = [];
    for (let i = 0; i < 2; i++) {
      const child = { ...parent, id: world.enemies.length + 1, parentId: parent.id, childIds: undefined, trait: undefined, wave: undefined, isChallenge: undefined, isDormant: true, isElite: false, hasShell: undefined, hp: 12, maxHp: 12, showBar: false, height: 0.8, width: 0.8, speed: 0.7, points: 5, direction: i ? 1 : -1 };
      parent.childIds.push(child.id);
      world.rooms[parent.roomId].childIds.push(child.id);
      world.enemies.push(child);
    }
  }
  world.signature = `${world.rooms.map(room => `${room.kind}:${room.reward || '-'}:${room.puzzle?.kind || room.trait || room.shape || room.arena || ''}`).join('|')}#${world.mainPath.map(id => { const platform = world.platforms[id]; return `${platform.x.toFixed(1)},${platform.y.toFixed(1)}`; }).join(';')}`;
  return world;
}

// 原图生成完才追加平台，不改变随机数序列和已有编号，第 10 版存档仍回到原落脚点。
function appendRoomPlatform(world, room, x, y, width, skin) {
  const platform = { id: world.platforms.length, x, y, width, isOneWay: true, zone: room.depth, progress: room.depth, skin, roomId: room.id };
  world.platforms.push(platform);
  room.platformIds.push(platform.id);
  world.zones[room.depth].platformIds.push(platform.id);
  room.top = Math.max(room.top, y);
  return platform;
}

export function doorPosition(world, door) {
  const platform = world.platforms[door.platformId];
  return { x: platform.x + door.offsetX, y: platform.y };
}
export function spotPosition(world, spot) {
  const platform = world.platforms[spot.platformId];
  return { x: platform.x + (spot.offsetX || 0), y: platform.y + (spot.height || 0) };
}
