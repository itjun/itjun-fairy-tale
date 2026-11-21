import { randomGenerator } from './random.js';
import { isCrowding, LAYER } from './room-terrain.js';

function scenery(route, image, x, bottom, width, height, caveId) {
  route.art.push({ image, x, y: bottom + height / 2, width, height, caveId });
}

function prize(world, room, platform, kind) {
  world.treasures.push({ id: world.treasures.length + 1, kind, platformId: platform.id,
    roomId: room.id, x: platform.x, y: platform.y + 1.4 });
}

function addCliffWall(route, top, bottom, baseY) {
  const border = top.x - top.width / 2;
  const x = border - .19;
  const wall = { x, side: -1, minY: bottom + .18, maxY: top.y - .5,
    topId: top.id, isNatural: true };
  route.walls.push(wall);
  route.ridges.push({ x: x + .08, y: top.y - .06 });
  scenery(route, 'desert-cliff', top.x - .58, baseY - .45, top.width + .7, top.y - baseY + .45);
}

function raiseCanyon(world, room, add) {
  const route = room.traversal;
  const floor = world.platforms[room.path[1]], ledge = world.platforms[room.path[2]], shoulder = world.platforms[room.path[3]];
  const edge = shoulder.x - shoulder.width / 2;
  const upperShelf = add(world, room, edge + 5.6, floor.y + 11.2, 6.0, 'sand');
  const top = add(world, room, edge + 8.0, floor.y + 18.5, 6.4, 'sand');
  route.name = '砂岩大峡谷';
  route.hint = '跳抓岩缝，沿岩壁爬上歇脚台';
  route.art = [];
  route.walls = [];
  route.ridges = [];
  const inner = ledge.x + ledge.width / 2 + .19;
  route.walls.push({ x: inner, side: 1, minY: floor.y + .2, maxY: ledge.y - .5, topId: ledge.id, isNatural: true });
  scenery(route, 'desert-cliff', ledge.x, floor.y - .45, ledge.width, ledge.y - floor.y + .45);
  addCliffWall(route, shoulder, floor.y, floor.y);
  addCliffWall(route, upperShelf, shoulder.y, floor.y);
  addCliffWall(route, top, upperShelf.y, floor.y);
  route.practiceUntilX = top.x + top.width / 2 + 1;
}

const HOLDS = [
  [[-3.2, 1.1], [-2.8, 2.7], [-1.6, 4.1], [-.1, 4.15], [.25, 5.55], [.8, 6.55]],
  [[1, 8.4], [2.2, 9.85], [3.9, 9.9], [4.5, 11.55], [4.3, 13.25], [5, 14.85], [5.5, 15.95]],
  [[5.9, 17.9], [7.0, 19.35], [8.75, 19.4], [9.7, 21.0], [9.2, 22.75], [10.35, 24.3], [11.5, 25.6]],
];

function raiseMountain(world, room, add) {
  const route = room.traversal;
  const floor = world.platforms[room.path[1]], x = floor.x, y = floor.y;
  const shelves = [[.8, 7.2, 6.4], [5.7, 16.8, 6.4], [10.5, 26.4, 9.2]]
    .map(([offset, height, width]) => add(world, room, x + offset, y + height, width, 'sand'));
  const summit = shelves.at(-1);
  route.name = '砂岩峰';
  route.hint = '踩着凸石往上，遇到岩棱就横着换手';
  route.ridges = [{ x: summit.x + summit.width / 2 - .25, y: summit.y - .06 }];
  route.art = [];
  route.grips = [];
  for (const [section, holds] of HOLDS.entries()) {
    for (const [index, [dx, dy]] of holds.entries()) {
      route.grips.push({ x: x + dx, y: y + dy, section, restId: index === holds.length - 1 ? shelves[section].id : undefined });
    }
  }
  const sideShelf = add(world, room, x + 2, y + 20.3, 4.2, 'sand');
  route.grips.push({ x: sideShelf.x + .55, y: sideShelf.y - .55, section: 2, isJumpOnly: true, restId: sideShelf.id });
  prize(world, room, sideShelf, 'star');
  scenery(route, 'desert-mountain', x + 3.5, y - .65, 25, 27.05);
  scenery(route, 'desert-cliff', x + 12.2, y - .45, 7.5, 26.85);
  route.practiceUntilX = summit.x + summit.width / 2 + 1;
}

function separateWindmillFloor(world, room) {
  const platforms = room.platformIds.map(id => world.platforms[id]);
  const floor = platforms.find(platform => platform.isWindmillCatchFloor);
  if (!floor) return;
  const fits = y => platforms.every(other => other === floor || !isCrowding({ ...floor, y }, other));
  if (fits(floor.y)) return;
  const y = [-1, -2, -3, 1].map(offset => floor.y + offset * LAYER).find(fits);
  if (y === undefined) return;
  floor.y = y;
  room.bottom = Math.min(room.bottom, y);
  room.fallY = room.bottom - 6;
}

// 新洞室及其宝物最后追加，原短洞仍能从旧的落脚点向两端出去。
function createCaveMap(world, room, add) {
  const route = room.traversal, old = route.cave;
  const [first, last, fromFirst, fromLast] = old.mouths;
  const caveId = `oasis:${room.id}`;
  const random = randomGenerator(world.seed ^ Math.imul(8069, room.id + 1));
  const hasPool = random() < .5;
  const length = Math.min(68, room.right - room.left - 4);
  const left = room.left + 1.5;
  const y = old.floorY - 39;
  const section = length / 8;
  const elevations = hasPool ? [5.2, 3.1, 1.2, 0, 0, 1.7, 3.8, 5.9] : [0, 1.1, 2.9, 5.1, 6.9, 5.8, 7.9, 9.7];
  const floor = (x, at, width) => Object.assign(add(world, room, x, at, width, 'cave-stone'), { isCave: true, caveId });
  const path = elevations.map((height, index) => {
    const gap = index && index < 7 ? 1.25 + .6 * random() : 1.1;
    return floor(left + (index + .5) * section, y + height, section - gap);
  });
  const upperPath = [2, 3, 4, 5].map((index, i) => floor(path[index].x, path[index].y + 2.45 + (i % 2) * .12, section - 1.65));
  const right = path.at(-1);
  prize(world, room, upperPath[1], 'star');
  prize(world, room, path[5], hasPool ? 'shell' : 'heart');
  const enter = (mouth, target) => ({ ...mouth, targetId: target.id, targetX: target.x + mouth.direction * 1.5 });
  const exit = (mouth, source) => ({ ...mouth, platformId: source.id, x: source.x });
  const mouths = [enter(first, path[0]), enter(last, right), exit(fromFirst, path[0]), exit(fromLast, right)];
  route.legacyCave = { ...old, mouths: [fromFirst, fromLast] };
  route.cave = { id: caveId, name: hasPool ? '晶潭洞窟' : '风蚀石窟', left: path[0].x - .95,
    right: right.x + .95, floorY: y, ridgeX: old.ridgeX,
    pathIds: path.map(p => p.id), branchIds: upperPath.map(p => p.id), mouths };
  for (const bank of path) scenery(route, 'desert-cave-crag', bank.x, y - 5.8, bank.width * 1.06, bank.y - y + 5.5, caveId);
  for (const shelf of [upperPath[0], upperPath.at(-1)]) {
    scenery(route, 'desert-cave-crag', shelf.x + shelf.width * .29, shelf.y - 3, Math.min(2.5, shelf.width * .43), 2.8, caveId);
  }
  for (const mouth of mouths.slice(2)) scenery(route, 'desert-cave-mouth', mouth.x, world.platforms[mouth.platformId].y, 3.7, 3.05, caveId);
  if (hasPool) scenery(route, 'desert-cave-pool', (path[3].x + path[4].x) / 2, y - 1.15, section * 2.55, 3.1, caveId);
}

export function expandDesertExpedition(world, appendPlatform) {
  for (const room of world.rooms) {
    if (room.depth === 0) raiseCanyon(world, room, appendPlatform);
    if (room.depth === 1) raiseMountain(world, room, appendPlatform);
    if (room.depth === 2) separateWindmillFloor(world, room);
    if (room.depth === 3) createCaveMap(world, room, appendPlatform);
  }
  world.minY = Math.min(...world.rooms.map(room => room.fallY));
  world.maxY = Math.max(...world.rooms.map(room => room.top)) + 7;
}
