import { LEVEL_COLLECTIBLES } from './collectibles.js';
import { LAYER } from './room-terrain.js';

const DESERT_ROOMS = [
  ['砂岩峡谷', '朝蓝绿色标记跳，抓住后往上爬'],
  ['攀岩墙', '用方向换抓点，远一点的抓点可以跳过去'],
  ['风车遗迹', '抓住石柱或横梁，再跳到下一处'],
  ['绿洲洞窟', '走近提灯的洞口，往上推就能钻进去'],
  ['沙漠首领场', '两边的抓点可以帮你换层躲招'],
];

function traversal(room, name, hint) {
  return room.traversal ??= { name, hint, walls: [], grips: [], art: [] };
}

function wall(route, top, baseY, side = -1, isLedge = false) {
  route.walls.push({ x: top.x + side * (top.width / 2 + 0.18), minY: baseY + 0.22,
    maxY: top.y - (isLedge ? 0.08 : 0.6), side, topId: top.id, isLedge });
}

function art(route, image, x, bottom, width, height) {
  route.art.push({ image, x, y: bottom + height / 2, width, height });
}

export function buildDesertRoute(builder, room, random) {
  const route = traversal(room, ...DESERT_ROOMS[room.depth]);
  const variant = random() < 0.5 ? -0.35 : 0.35;
  const floor = builder.next(0, 12, 0, { isOneWay: false });
  const { x, y } = floor;
  if (room.depth === 0) {
    const ledge = builder.hop(x + 2.5, y + LAYER, 5);
    const far = builder.hop(x + 11.4 + variant, y + LAYER * 2, 8);
    builder.add(x + 12, y, 12, { isOneWay: false });
    art(route, 'desert-face', ledge.x, y - .45, ledge.width, LAYER + .45);
    art(route, 'desert-face', far.x, y - .45, far.width, LAYER * 2 + .45);
    wall(route, ledge, y);
    wall(route, ledge, y, 1);
    wall(route, far, y);
  } else if (room.depth === 1) {
    const rest = builder.hop(x + 0.8, y + LAYER, 6);
    builder.hop(x + 5.7, y + LAYER * 2, 6);
    const top = builder.hop(x + 10.4 + variant, y + LAYER * 3, 9);
    art(route, 'desert-face', x + 4.9, y - .45, 19.5, top.y - y + .45);
    for (const [dx, dy] of [[-3.5, 1.05], [-2.55, 2.65], [-1.25, 4.15], [.3, 5.7], [2.25, 6.6], [4.4, 7.25], [6.55, 7.4]]) {
      route.grips.push({ x: x + dx, y: y + dy });
    }
    route.grips[2].restId = rest.id;
    route.grips.at(-1).restId = top.id;
    const bonus = builder.place(x + 5.8, y + LAYER * 4, 4.4, { spot: 'high' });
    if (bonus) {
      route.grips.push({ x: bonus.x - 0.4, y: bonus.y - 0.45, restId: bonus.id, isJumpOnly: true });
      route.bonusId = bonus.id;
    }
  } else if (room.depth === 2) {
    const low = builder.hop(x + 3.7, y + LAYER, 5);
    const pillar = builder.hop(x + 9.7 + variant, y + LAYER * 2, 5.2);
    const beam = builder.hop(x + 16.6, y + LAYER * 3, 6.8, { skin: 'plank' });
    builder.add(x + 14, y, 16, { isOneWay: false, isWindmillCatchFloor: true });
    art(route, 'desert-face', low.x, y - .45, low.width, low.y - y + .45);
    art(route, 'desert-pillar', pillar.x, y - .45, pillar.width - .3, pillar.y - y + .45);
    art(route, 'desert-windmill', beam.x + 0.5, y, 10, 12);
    for (const ledge of [low, pillar, beam]) wall(route, ledge, ledge.y - 1.9, -1, true);
  } else if (room.depth === 3) {
    const shore = builder.next(0, 20, 0, { isOneWay: false });
    route.entrances = [floor.id, shore.id];
    room.look = 'down';
  }
  if (room.depth < 2) {
    const last = builder.state.cursor;
    route.practiceUntilX = last.x + last.width / 2 - .15;
    for (const platform of builder.world.platforms.slice(room.startId)) platform.isTraversalPractice = true;
  }
}

function addTreasure(world, room, platform, kind) {
  world.treasures.push({ id: world.treasures.length + 1, kind, platformId: platform.id, roomId: room.id, x: platform.x, y: platform.y + 1.4 });
}

function addCave(world, room, route, [a, b], appendPlatform) {
  const x1 = a.x, x2 = b.x;
  const y = room.bottom - 29;
  const span = x2 - x1, midpoint = (x1 + x2) / 2;
  const add = (x, height, width) => {
    const platform = appendPlatform(world, room, x, height, width, a.skin);
    platform.isCave = true;
    return platform;
  };
  const path = [add(x1 + span / 6 - 1, y, span / 3 + 2), add(midpoint, y, span / 3), add(x2 - span / 6 + 1, y, span / 3 + 2)];
  const treasure = add(midpoint, y + LAYER, 4.8);
  const mouths = [
    { platformId: a.id, x: x1, targetId: path[0].id, targetX: x1 + 1.65, direction: 1 },
    { platformId: b.id, x: x2, targetId: path[2].id, targetX: x2 - 1.65, direction: -1 },
    { platformId: path[0].id, x: x1, targetId: a.id, targetX: x1 + 1.65, direction: -1 },
    { platformId: path[2].id, x: x2, targetId: b.id, targetX: x2 - 1.65, direction: 1 },
  ];
  route.cave = { left: x1 - .95, right: x2 + .95, floorY: y, mouths };
  if (world.themeId === 'desert') {
    // 地表岩壁隔开两个洞口，地下通道可以来回走。
    route.cave.ridgeX = midpoint;
    art(route, 'desert-face', midpoint, a.y - .3, 2.5, 10.2);
  }
  for (const mouth of mouths) art(route, 'desert-cave-mouth', mouth.x, world.platforms[mouth.platformId].y, 3.15, 2.5);
  const kinds = LEVEL_COLLECTIBLES[world.themeId];
  addTreasure(world, room, treasure, kinds.includes('star') ? 'star' : kinds[0]);
}

export function finishTraversal(world, appendPlatform) {
  const isDesert = world.themeId === 'desert';
  for (const room of world.rooms) {
    if (isDesert) {
      const route = room.traversal;
      if (route.bonusId !== undefined) addTreasure(world, room, world.platforms[route.bonusId], 'star');
      if (route.entrances) addCave(world, room, route, route.entrances.map(id => world.platforms[id]), appendPlatform);
      if (room.kind === 'boss') {
        const floor = world.platforms[world.bossArenas[0].floorId];
        for (const side of [-1, 1]) {
          const x = floor.x + side * 10;
          const land = room.platformIds.map(id => world.platforms[id]).find(p => p.x === x && p.y === floor.y + LAYER * 2)
            ?? room.platformIds.map(id => world.platforms[id]).find(p => p.x === x && p.y === floor.y + LAYER);
          route.grips.push({ x: x - 1.2, y: floor.y + 1.1 }, { x, y: floor.y + 2.55, restId: land.id });
        }
      }
      continue;
    }
    if (room.depth !== 0) continue;
    const start = world.platforms[room.startId];
    const path = room.path.map(id => world.platforms[id]);
    const end = path.find(p => p.x - start.x >= 19 && p.width >= 5 && p.isEnabled !== false && !p.isMoving && !p.isCrumbling && !p.isSeesaw && !p.slope);
    if (!end) continue;
    const route = traversal(room, '', '朝标记跳可以抓住，靠近提灯可钻进洞');
    addCave(world, room, route, [start, end], appendPlatform);
    const step = path.find((p, i) => i > 0 && p.x > start.x + 8 && p.y - path[i-1].y >= 1.7 && p.width >= 4 && p.isEnabled !== false && !p.isMoving && !p.isCrumbling && !p.isSeesaw && !p.slope);
    if (step) {
      const x = step.x - step.width / 2 - 0.18;
      const below = step.y - LAYER;
      if (['family', 'beach', 'forest'].includes(world.themeId)) {
        route.grips.push({ x: x - 0.8, y: below + 0.6 }, { x, y: step.y - 0.5, restId: step.id });
      } else {
        wall(route, step, below, -1, ['sweet', 'cartoon', 'meadow'].includes(world.themeId));
      }
    }
  }
}
