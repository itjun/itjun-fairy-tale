import { placeEnemy } from './room-terrain.js';

export const FOREST_TRAILS = ['crown', 'roots'];
export const FOREST_STOPS = {
  crown: ['敲响蘑菇铃', '放下枝桥', '解开藤结', '接到树冠幼鸟'],
  roots: ['点亮萤火灯', '推出树皮桥', '打开树根暗门', '接到树根幼鸟'],
};
export const FOLLOWING = 4;
export const HOME = 5;

// 每条路线都折回大树，在四片相连的地形里完成不同的动作。端点留给机关，
// 平段的长度、落差和守卫独立配置；回巢无需原路走完四片地形。
const CROWN = [
  { name: '蘑菇坡', heights: [0, 1, 2, 1, 0, 0], skin: 'root', foes: ['mushroom', 'squirrel'] },
  { name: '风叶栈道', heights: [0, 0, 1, 2, 2, 1], skin: 'leaf', foes: ['dandelion', 'leaf'] },
  { name: '枝桥谷', heights: [0, -1, -2, -1, 0, 1], skin: 'plank', foes: ['leafshield', 'moth'] },
  { name: '紫藤树梢', heights: [0, 1, 1, 0, -1, 0], skin: 'leaf', foes: ['firefly', 'squirrel'] },
];
const ROOTS = [
  { name: '萤火洞口', heights: [0, -1, -2, -1, -1, 0], skin: 'rock', foes: ['burrow', 'moth'] },
  { name: '回声石窟', heights: [0, -1, 0, 1, 2, 1], skin: 'root', foes: ['mushroom', 'burrow'] },
  { name: '地下溪桥', heights: [0, 1, 2, 1, 0, 0], skin: 'plank', foes: ['wool', 'leafshield'] },
  { name: '暖灯育巢', heights: [0, 0, -1, -2, -1, 0], skin: 'root', foes: ['moth', 'flowerpot'] },
];

export function buildForestRescue(world, stage, builder, placeBoss) {
  const { random } = builder;
  const room = { id: 0, depth: 0, kind: 'boss', reward: null, waves: 1, enemyIds: [], childIds: [], platformIds: [], path: [] };
  world.rooms.push(room);
  const route = room.traversal = { name: '树冠救援', hint: '往右上树冠，或在鸟巢左边钻进树根', walls: [], grips: [], art: [] };
  const cave = route.cave = { id: 'owl-roots', name: '萤火树根洞', mouths: [], left: -255, right: 16, floorY: -108 };
  const forest = world.forest = { linked: random() < .5, trails: {}, bridges: {}, fireflies: [], nestX: 0 };
  const add = (x, y, width, trail, extra = {}) => {
    const platform = builder.add(x, y, width, { roomId: 0, ...(trail === 'roots' ? { isCave: true, caveId: cave.id } : {}), ...extra });
    room.platformIds.push(platform.id);
    room.path.push(platform.id);
    return platform;
  };
  const nest = add(0, 0, 32, 'crown', { isCheckpoint: true });
  world.start = nest;
  forest.nestId = nest.id;
  const exit = add(20.4, 0, 6, 'crown', { isFinish: true, milestone: 1 });
  const rootEntry = add(0, -56, 14, 'roots');
  const art = (image, x, y, width, height, isCave = false) => route.art.push({ image, x, y, width, height, ...(isCave ? { caveId: cave.id } : {}) });
  const mouth = (from, to, offset, targetOffset, label, unlock) => {
    const entry = { platformId: from.id, x: from.x + offset, targetId: to.id, targetX: to.x + targetOffset, direction: offset > 0 ? 1 : -1, label, unlock };
    cave.mouths.push(entry);
    return entry;
  };
  mouth(nest, rootEntry, -8, 1, '进树根洞');
  mouth(rootEntry, nest, 3, -6, '回到鸟巢');
  for (const [x, level] of [[-9, 1], [-5, 2], [6, 1], [10, 2], [1, 3]]) add(x, level * 2.4, 5, 'crown', { skin: 'leaf' });

  function trail(branch, designs, turns, baseY, rise) {
    const inside = branch === 'roots';
    const stops = forest.trails[branch] = [];
    const trailStart = inside ? rootEntry : exit;
    let previous = trailStart;
    for (const [index, design] of designs.entries()) {
      const startX = turns[index], endX = turns[index + 1];
      const direction = Math.sign(endX - startX);
      const y = baseY + rise * index;
      const path = [];
      if (index) {
        // 两端真正连起来：五块外伸的歇脚台把上下两层接成回环。
        for (let step = 1; step <= 5; step++) {
          const dx = [6, 10, 13, 8.8, 5][step - 1];
          path.push(add(previous.x - direction * dx, previous.y + (y - previous.y) * step / 6, 5, branch).id);
        }
      }
      const length = Math.abs(endX - startX);
      const count = Math.round(length / 10);
      const spacing = length / count;
      let first;
      for (let n = index ? 0 : 1; n <= count; n++) {
        const x = startX + direction * spacing * n;
        const edge = n === 0 || n === count || n === count - 1;
        const height = y + (edge ? 0 : design.heights[(n - 1) % design.heights.length] * 1.65);
        const width = spacing - (edge ? 1.1 : 1.3 + random() * 1.1);
        const platform = add(x, height, width, branch, { skin: design.skin });
        path.push(platform.id);
        first ??= platform;
        if (n === count) {
          stops.push({ platformId: platform.id, name: design.name, action: FOREST_STOPS[branch][index], direction, path });
          previous = platform;
          continue;
        }
        if (!edge && n === 2 && index === 2) {
          platform.isBridge = true;
          platform.isEnabled = false;
          forest.bridges[branch] = platform.id;
        } else if (!edge && index === 0 && n % 5 === 2 && !inside) {
          world.springs.push({ platformId: platform.id, x: x + direction * 2, y: height, power: 16 });
        } else if (!edge && n % 5 === 3) {
          const kind = design.foes[Math.floor(random() * design.foes.length)];
          const enemy = placeEnemy(world, stage, platform, kind, random);
          Object.assign(enemy, { roomId: 0, wave: 0, isDormant: false });
          room.enemyIds.push(enemy.id);
        } else if (!edge && n % 6 === 4) {
          const perch = add(x + direction, height + 2.8, 3.8, branch, { skin: inside ? 'rock' : 'leaf' });
          const kind = ['star', 'flower', 'mushroom'][Math.floor(random() * 3)];
          world.treasures.push({ id: world.treasures.length + 1, roomId: 0, kind, platformId: perch.id, x: perch.x, y: perch.y + 1.1 });
        } else if (!edge && n % 7 === 5) {
          builder.trap(platform, 'thorns');
        }
        if (index === 1 && n % 6 === 1 && !edge) {
          Object.assign(platform, { isMoving: true, axis: 'y', baseX: x, baseY: height, travel: 1.5, period: 5, skin: 'leaf' });
          world.lifts.push(platform);
        }
        // 地下溪桥的几块浮木踩久会沉；树梢则能在枝头短桥和安全下路间选择。
        if (!edge && inside && index === 2 && n % 5 === 1 && !platform.isMoving) {
          platform.isCrumbling = true;
          platform.skin = 'plank';
        }
        if (!inside && index === 3 && n >= 4 && n <= 8) {
          add(x, y + (n === 4 || n === 8 ? 3.4 : 5.8), width - 1.2, branch, { skin: 'plank', isBridge: true });
        }
        // 洞口三只萤火虫分别停在石龛、低台与上层石架；带它们到洞底点灯。
        if (inside && index === 0 && [3, 8, 13].includes(n)) {
          const high = n !== 8;
          if (high) add(x - 2.6, height + 2.5, 3.4, branch, { skin: 'rock' });
          const home = high ? add(x + 1.8, height + 5.1, 4.1, branch, { skin: 'rock' }) : platform;
          forest.fireflies.push(home.id);
        }
        if (inside && n % 4 === 2) art('adventure-root-cave', x, height + 2, 14, 8, true);
        if (!inside && n % 7 === 5) art('treehouse-tall', x, height + 2, 8, 14);
      }
      stops[index].entryId = first.id;
    }
  }

  const span = 8 * Math.floor(random() * 5);
  trail('crown', CROWN, [20.4, 170 + span, 43, 195 + span, 8], 0, 14.4);
  trail('roots', ROOTS, [0, -160 - span, -32, -195 - span, -17], -56, -13.2);
  // 前两段外侧的树干可以直接攀上新一层，也能走外圈的歇脚台。
  forest.trunkWalls = forest.trails.crown.slice(0, 2).map((stop, index) => {
    const base = world.platforms[stop.platformId], top = world.platforms[forest.trails.crown[index + 1].entryId];
    const side = stop.direction;
    const x = top.x + side * (top.width / 2 + .18);
    art('treehouse-tall', x - side * 1.8, (top.y + base.y) / 2, 7.5, top.y - base.y + 2);
    return { x, side, topId: top.id, minY: base.y + .2, maxY: top.y - .45 };
  });
  const crownTop = world.platforms[forest.trails.crown.at(-1).platformId];
  const rootEnd = world.platforms[forest.trails.roots.at(-1).platformId];
  // 藤梯的实际攀爬面从鸟巢地面贯通树梢；暗门返回巢边。
  forest.vine = { topId: crownTop.id, x: crownTop.x - crownTop.width / 2 - .18, side: -1, minY: .15, maxY: crownTop.y - .4 };
  mouth(rootEnd, nest, 2.5, -3, '推开树皮门回巢', 'roots');
  if (forest.linked) {
    const rootFork = world.platforms[forest.trails.roots[0].platformId];
    mouth(crownTop, rootFork, 2.5, 0, '穿树心去萤火灯', 'crown');
    mouth(rootFork, crownTop, 2.5, 0, '沿树心上树冠', 'crown');
  }
  forest.rootEntryId = rootEntry.id;
  const battlePerch = world.platforms.find(p => p.x === 6 && p.y === 2.4);
  forest.lowerVine = { ...forest.vine, topId: battlePerch.id, maxY: battlePerch.y - .15 };
  const boss = placeBoss(world, stage, room, nest);
  world.bossArenas = [{ id: 0, bossId: boss.id, floorId: nest.id, exitId: exit.id, left: -15, right: 15, y: 0, layout: 'platform', isLocked: true }];
  world.supplies.push({ id: 'medkit:0', kind: 'medkit', platformId: nest.id, x: -12, y: 1 });
  Object.assign(room, { startId: nest.id, exitId: exit.id, exitPlatformIds: [exit.id], left: -16, right: 242, bottom: 0, top: crownTop.y + 5, fallY: -8 });
  world.zones.push({ id: 0, kind: 'boss', name: '树冠救援', isBoss: true, roomIds: [0], platformIds: room.platformIds, startId: nest.id, exitId: exit.id, baseY: 0, minX: room.left, maxX: room.right });
  Object.assign(world, { finish: exit, mainPath: room.path, requiredFlowers: 0, minX: cave.left, minY: cave.floorY - 6, maxX: room.right, maxY: room.top + 8,
    signature: [forest.linked, ...room.path.map(id => world.platforms[id].x.toFixed(1))].join('|') });
}

export function syncForestRoutes(world, progress) {
  const route = world.rooms[0].traversal;
  const home = FOREST_TRAILS.every(side => progress[side] === HOME);
  route.walls = [...world.forest.trunkWalls];
  if (progress.crown >= 3) route.walls.push(home ? world.forest.lowerVine : world.forest.vine);
  for (const side of FOREST_TRAILS) world.platforms[world.forest.bridges[side]].isEnabled = progress[side] >= 2;
  for (const mouth of route.cave.mouths) mouth.isClosed = home || (!!mouth.unlock && progress[mouth.unlock] < FOLLOWING);
  world.bossArenas[0].isLocked = !home;
}
