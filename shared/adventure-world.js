import { randomGenerator } from './random.js';
import { MONSTERS, THEME_MONSTERS } from './adventure-catalog.js';

// 保留旧主题机关主线，在每段加入真正连接后方的双路线；长度、入口、坡向和奖励池按种子变化。
export function expandAdventureWorld(world) {
  const random = randomGenerator((world.seed ^ 0x1e4d9c27) >>> 0);
  world.version = 2; world.forks = []; world.camps = [];
  const add = (x, y, zone, extra = {}) => {
    const p = { id: world.platforms.length, x, y, width: 6, isOneWay: true, zone, progress: zone, ...extra };
    world.platforms.push(p); return p;
  };
  for (const zone of world.zones) {
    const candidates = zone.platformIds.filter((id, i, ids) => {
      const span = ids.slice(i, i + 7).map(n => world.platforms[n]);
      return span.length === 7 && !world.platforms.some(p => p.isCheckpoint && Math.abs(p.x - span[0].x) < 12) && span.every((p, j) => !p.isMoving && !p.isCheckpoint && !p.isBranch && p.gateId === undefined && !world.springs.some(s => s.platformId === p.id) && (!j || p.x > span[j - 1].x && Math.abs(p.y - span[j - 1].y) < 2.3));
    });
    if (!candidates.length) continue;
    const startId = candidates[Math.floor(random() * candidates.length)], startIndex = zone.platformIds.indexOf(startId);
    const spanIds = zone.platformIds.slice(startIndex, startIndex + 7), start = world.platforms[startId], end = world.platforms[spanIds.at(-1)];
    const familyPairs = [['flight', 'bubble'], ['frost', 'power'], ['nature', 'flight']];
    const families = familyPairs[Math.floor(random() * familyPairs.length)];
    start.width = 12;
    const fork = { id: zone.id, zone: zone.id, startId, endId: end.id, x: start.x, y: start.y, routes: [] };
    const main = { id: 'lower', name: world.levelId === 'forest' ? '树根小路' : '花间小路', family: families[1], platformIds: spanIds.slice(1, -1) };
    for (const id of main.platformIds) world.platforms[id].forkRoute = { forkId: fork.id, routeId: main.id };
    // 沿真实主线高度抬升，不跨越未知机关。入口/出口各两阶保证基础跳跃能走通。
    const upper = { id: 'upper', name: world.levelId === 'forest' ? '树冠小路' : '高台小路', family: families[0], platformIds: [] };
    let previous = start;
    const offset = 4.2 + random() * 0.5;
    const entry = add(start.x + 3, start.y + 2.4, zone.id, { width: 4.5, isBranch: true });
    upper.platformIds.push(entry.id); world.edges.push({ from: previous.id, to: entry.id, kind: 'jump' }); previous = entry;
    for (let i = 0; i < spanIds.length; i++) {
      const base = world.platforms[spanIds[i]], p = add(base.x, base.y + offset, zone.id, { isBranch: true, forkRoute: { forkId: fork.id, routeId: upper.id } });
      upper.platformIds.push(p.id); world.edges.push({ from: previous.id, to: p.id, kind: 'jump' }); previous = p;
    }
    const landing = add(end.x, end.y + 2.2, zone.id, { isBranch: true });
    upper.platformIds.push(landing.id); world.edges.push({ from: previous.id, to: landing.id, kind: 'drop' }, { from: landing.id, to: end.id, kind: 'drop' });
    fork.routes = random() < 0.5 ? [upper, main] : [main, upper];
    world.forks.push(fork);
    zone.platformIds.push(...upper.platformIds);
  }
  const pool = THEME_MONSTERS[world.levelId];
  for (const enemy of world.enemies) {
    const kind = pool[Math.floor(random() * pool.length)], definition = MONSTERS[kind];
    const base = world.platforms[enemy.platformId];
    Object.assign(enemy, { kind, behavior: definition.behavior, family: definition.family, points: definition.points,
      baseY: base.y + (['float', 'dart'].includes(definition.behavior) ? 1.5 : 0), hp: 1 + Number(world.zones.length > 5 && random() < 0.25), isElite: false });
    enemy.y = enemy.baseY;
  }
  for (const zone of world.zones) {
    const elite = world.enemies.find(e => e.zone === zone.id);
    if (elite) { elite.isElite = true; elite.hp = 3; elite.points += 15; elite.height *= 1.25; }
    const fork = world.forks.find(f => f.zone === zone.id);
    if (fork) {
      const route = fork.routes.find(r => r.id === 'upper'), p = world.platforms[route.platformIds[3]];
      const kind = pool.find(k => MONSTERS[k].family === route.family) || pool[Math.floor(random() * pool.length)], def = MONSTERS[kind];
      world.enemies.push({ id: world.enemies.length + 1, platformId: p.id, zone: zone.id, kind, behavior: def.behavior, family: def.family, points: def.points,
        x: p.x, y: p.y, baseY: p.y, minX: p.x - 1.5, maxX: p.x + 1.5, direction: 1, speed: 0.8, height: 1.5, width: 1.35, phase: random() * 6, elapsed: 0, hp: 2, isDefeated: false, drop: null });
    }
    const home = world.platforms[zone.exitId];
    world.camps.push({ id: zone.id, platformId: home.id, x: home.x - 2, y: home.y, zone: zone.id });
  }
  for (const fork of world.forks) {
    const p = world.platforms[fork.startId];
    world.camps.push({ id: `fork:${fork.id}`, platformId: p.id, x: p.x - 3, y: p.y, zone: fork.zone });
  }
  world.camps.unshift({ id: -1, platformId: 0, x: -2, y: 0, zone: 0 });
  for (const enemy of world.enemies) {
    if (!world.camps.some(c => Math.abs(c.x - enemy.x) < 7 && Math.abs(c.y - enemy.y) < 4)) continue;
    const candidates = world.zones[enemy.zone].platformIds.map(id => world.platforms[id]).filter(p => !p.isMoving && !p.isCheckpoint && p.gateId === undefined && !world.camps.some(c => Math.abs(c.x - p.x) < 9 && Math.abs(c.y - p.y) < 5));
    const p = candidates.find(p => !world.enemies.some(e => e !== enemy && Math.abs(e.x - p.x) < 8 && Math.abs(e.y - p.y) < 3));
    if (p) { enemy.platformId = p.id; enemy.x = p.x; enemy.minX = p.x - 1.5; enemy.maxX = p.x + 1.5; enemy.baseY = p.y + (enemy.behavior === 'float' ? 1.4 : 0); enemy.y = enemy.baseY; }
  }
  // 分裂出的子怪也有预先确定的编号，恢复及计分不依赖运行时生成顺序。
  for (const parent of [...world.enemies]) if (parent.kind === 'candy') {
    parent.childIds = [];
    for (let i = 0; i < 2; i++) {
      const child = { ...parent, id: world.enemies.length + 1, parentId: parent.id, childIds: undefined, isDormant: true, isElite: false, hp: 1, height: 0.8, width: 0.8, points: 5, drop: null, direction: i ? 1 : -1 };
      parent.childIds.push(child.id); world.enemies.push(child);
    }
  }
  world.maxY = Math.max(...world.platforms.map(p => p.y + (p.isMoving && p.axis === 'y' ? p.travel : 0))) + 6;
  world.signature += ':' + world.forks.map(f => `${f.startId}/${f.routes.map(r => r.family).join('/')}`).join(';');
  return world;
}
