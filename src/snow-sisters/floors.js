// FC《雪人兄弟》50 层单屏地图数据（256 × 240 逻辑坐标）。
// 包含 5 大主题塔层、单向平台、斜坡、墙壁阻挡、底部循环坑（41-49 层）、相扑台（24/26/28 层）、
// FC 隐藏射出美食与跳关红包坐标，以及 5 座 Boss 场地。

export const SCREEN_WIDTH = 256;
export const SCREEN_HEIGHT = 240;
export const WALL_LEFT = 8;
export const WALL_RIGHT = 248;
export const GROUND_Y = 224;

export const WORLD_THEMES = [
  { id: 1, name: '城墙冰阶', subtitle: '第 1～10 层', wallColor: '#5c84c8', topColor: '#e8f6ff', bg: 1 },
  { id: 2, name: '机械糖屋', subtitle: '第 11～20 层', wallColor: '#48a89a', topColor: '#fff2cc', bg: 2 },
  { id: 3, name: '云端斜坡', subtitle: '第 21～30 层', wallColor: '#6b7ce0', topColor: '#eef8ff', bg: 3 },
  { id: 4, name: '熔岩地牢', subtitle: '第 31～40 层', wallColor: '#b84c42', topColor: '#ffe0b8', bg: 4 },
  { id: 5, name: '暗夜尖塔', subtitle: '第 41～50 层', wallColor: '#474f9e', topColor: '#d9ecff', bg: 5 },
];

const BOSS_NAMES = {
  10: { kind: 'lizard', name: '巨蜥莫格拉' },
  20: { kind: 'clam', name: '炮弹蛙卡玛吉' },
  30: { kind: 'birds', name: '双怪鸟爸爸妈妈' },
  40: { kind: 'bigNose', name: '大鼻绿魔' },
  50: { kind: 'bubbleStatues', name: '双泡泡石像' },
};

const p = (x1, x2, y, oneWay = true) => ({ x1, x2, y, oneWay });
const s = (x1, y1, x2, y2) => ({ x1, y1, x2, y2 });
const w = (x1, x2, y1, y2) => ({ x1, x2, y1, y2 });
const e = (kind, x, y, dir = 1) => ({ kind, x, y, dir });

// 平台几何模板（垂直层距 <= 38px，保证无红药水时普通跳跃 42px 均可逐级到达；
// 仅 24/26/28 的高台相扑位与 39 层特殊处需要踩雪球跳高）
function layoutTemplate(kind, pit = false) {
  const ground = pit
    ? [p(8, 102, 224, false), p(154, 248, 224, false)]
    : [p(8, 248, 224, false)];
  switch (kind) {
    case 'pyramid':
      return {
        platforms: [...ground, p(24, 104, 188), p(152, 232, 188), p(64, 192, 152), p(24, 96, 116), p(160, 232, 116), p(76, 180, 80)],
        slopes: [],
        walls: [],
      };
    case 'twinSteps':
      return {
        platforms: [...ground, p(40, 216, 188), p(16, 88, 152), p(168, 240, 152), p(64, 192, 116), p(24, 112, 80), p(144, 232, 80)],
        slopes: [],
        walls: [],
      };
    case 'slopeBowl':
      return {
        platforms: [...ground, p(20, 76, 188), p(180, 236, 188), p(72, 184, 152), p(16, 68, 114), p(188, 240, 114), p(68, 188, 80)],
        slopes: [s(68, 80, 128, 116), s(188, 80, 128, 116)],
        walls: [],
      };
    case 'zigSlope':
      return {
        platforms: [...ground, p(16, 112, 188), p(144, 240, 188), p(56, 200, 152), p(16, 92, 116), p(164, 240, 116), p(64, 192, 78)],
        slopes: [s(56, 152, 120, 188), s(200, 152, 136, 188)],
        walls: [],
      };
    case 'caves':
      return {
        platforms: [...ground, p(16, 96, 188), p(160, 240, 188), p(56, 200, 152), p(16, 84, 116), p(172, 240, 116), p(72, 184, 80)],
        slopes: [],
        walls: [w(84, 96, 188, 224), w(160, 172, 188, 224)],
      };
    case 'centerShaft':
      return {
        platforms: [...ground, p(16, 108, 188), p(148, 240, 188), p(36, 112, 152), p(144, 220, 152), p(16, 104, 116), p(152, 240, 116), p(68, 188, 80)],
        slopes: [],
        walls: [w(122, 134, 120, 188)],
      };
    case 'sumoPerch':
      return {
        platforms: [...ground, p(16, 104, 188), p(152, 240, 188), p(56, 200, 152), p(16, 84, 116), p(172, 240, 116), p(84, 172, 82), p(96, 160, 48)],
        slopes: [],
        walls: [],
      };
    case 'islandHop':
      return {
        platforms: [...ground, p(24, 92, 188), p(164, 232, 188), p(88, 168, 152), p(20, 80, 116), p(176, 236, 116), p(80, 176, 80)],
        slopes: [s(80, 80, 128, 104), s(176, 80, 128, 104)],
        walls: [w(118, 138, 152, 188)],
      };
    case 'spirePit':
      return {
        platforms: [...ground, p(16, 98, 188), p(158, 240, 188), p(64, 192, 152), p(16, 88, 116), p(168, 240, 116), p(72, 184, 80)],
        slopes: [],
        walls: [],
      };
    case 'bossLizard':
      return {
        platforms: [p(8, 248, 224, false), p(16, 112, 184), p(16, 96, 144), p(16, 104, 104), p(164, 240, 132)],
        slopes: [],
        walls: [],
      };
    case 'bossClam':
      return {
        platforms: [p(8, 248, 224, false), p(16, 86, 184), p(170, 240, 184), p(76, 180, 144), p(16, 82, 106), p(174, 240, 106)],
        slopes: [],
        walls: [],
      };
    case 'bossBirds':
      return {
        platforms: [p(8, 248, 224, false), p(24, 96, 184), p(160, 232, 184), p(84, 172, 144), p(24, 90, 106), p(166, 232, 106)],
        slopes: [],
        walls: [],
      };
    case 'bossBigNose':
      return {
        platforms: [p(8, 248, 224, false), p(16, 96, 184), p(160, 240, 184), p(72, 184, 146), p(16, 92, 108), p(164, 240, 108), p(84, 172, 74)],
        slopes: [],
        walls: [],
      };
    default: // bossBubbleStatues
      return {
        platforms: [p(8, 248, 224, false), p(52, 106, 184), p(150, 204, 184), p(84, 172, 144), p(54, 102, 108), p(154, 202, 108)],
        slopes: [],
        walls: [],
      };
  }
}

// 1-50 层逐层敌人编排（忠实还原 GameFAQs FC 全 50 层配置与隐藏彩蛋点）
const FLOOR_SPECS = {
  1: { tpl: 'pyramid', spawns: [e('goblin', 92, 80, 1), e('goblin', 164, 80, -1), e('goblin', 88, 152, 1), e('goblin', 168, 152, -1)], hidden: { x: 48, y: 188, kind: 'pie', hitsNeeded: 6 } },
  2: { tpl: 'twinSteps', spawns: [e('fireSpitter', 80, 80, 1), e('fireSpitter', 176, 80, -1), e('goblin', 72, 116, 1), e('goblin', 184, 116, -1), e('yellowMonkey', 128, 188, 1)] },
  3: { tpl: 'slopeBowl', spawns: [e('goblin', 96, 80, 1), e('goblin', 160, 80, -1), e('fireSpitter', 128, 152, 1), e('fireSpitter', 48, 188, 1), e('goblin', 208, 188, -1)], hidden: { x: 204, y: 114, kind: 'pie', hitsNeeded: 6 } },
  4: { tpl: 'zigSlope', spawns: [e('yellowMonkey', 88, 78, 1), e('yellowMonkey', 168, 78, -1), e('fireSpitter', 96, 152, 1), e('fireSpitter', 160, 152, -1), e('yellowMonkey', 64, 188, 1)] },
  5: { tpl: 'caves', spawns: [e('goblin', 96, 80, 1), e('goblin', 160, 80, -1), e('fireSpitter', 104, 152, 1), e('fireSpitter', 152, 152, -1), e('goblin', 128, 224, 1)] },
  6: { tpl: 'centerShaft', spawns: [e('fireSpitter', 96, 80, 1), e('fireSpitter', 160, 80, -1), e('fireSpitter', 54, 152, 1), e('fireSpitter', 202, 152, -1), e('goblin', 128, 224, -1)] },
  7: { tpl: 'pyramid', spawns: [e('goblin', 90, 80, 1), e('goblin', 166, 80, -1), e('goblin', 48, 116, 1), e('goblin', 208, 116, -1), e('goblin', 88, 152, 1), e('goblin', 168, 152, -1)] },
  8: { tpl: 'islandHop', spawns: [e('yellowMonkey', 100, 80, 1), e('yellowMonkey', 156, 80, -1), e('fireSpitter', 112, 152, 1), e('fireSpitter', 144, 152, -1), e('yellowMonkey', 56, 188, 1)] },
  9: { tpl: 'twinSteps', spawns: [e('yellowMonkey', 64, 80, 1), e('yellowMonkey', 192, 80, -1), e('yellowMonkey', 128, 116, 1), e('fireSpitter', 128, 188, -1)] },
  10: { tpl: 'bossLizard', spawns: [] },

  11: { tpl: 'slopeBowl', spawns: [e('goblin', 92, 80, 1), e('goblin', 164, 80, -1), e('goblin', 128, 152, 1), e('fireSpitter', 48, 188, 1)], hidden: { x: 44, y: 114, kind: 'milk', hitsNeeded: 6 } },
  12: { tpl: 'caves', spawns: [e('goblin', 92, 80, 1), e('goblin', 164, 80, -1), e('tornado', 50, 116, 1), e('tornado', 206, 116, -1)], hidden: { x: 24, y: 224, kind: 'warp', hitsNeeded: 6 } },
  13: { tpl: 'pyramid', spawns: [e('yellowMonkey', 92, 80, 1), e('yellowMonkey', 164, 80, -1), e('tornado', 64, 116, 1), e('tornado', 192, 116, -1)] },
  14: { tpl: 'zigSlope', spawns: [e('goblin', 88, 78, 1), e('goblin', 168, 78, -1), e('tornado', 54, 116, 1), e('tornado', 202, 116, -1)] },
  15: { tpl: 'centerShaft', spawns: [e('yellowMonkey', 96, 80, 1), e('yellowMonkey', 160, 80, -1), e('fireSpitter', 64, 152, 1), e('fireSpitter', 192, 152, -1)], hidden: { x: 204, y: 116, kind: 'milk', hitsNeeded: 6 } },
  16: { tpl: 'twinSteps', spawns: [e('yellowMonkey', 72, 80, 1), e('yellowMonkey', 184, 80, -1), e('fireSpitter', 96, 116, 1), e('fireSpitter', 160, 116, -1)] },
  17: { tpl: 'islandHop', spawns: [e('goblin', 96, 80, 1), e('goblin', 160, 80, -1), e('goblin', 128, 152, 1), e('tornado', 56, 116, -1)] },
  18: { tpl: 'caves', spawns: [e('yellowMonkey', 96, 80, 1), e('yellowMonkey', 160, 80, -1), e('tornado', 52, 116, 1), e('tornado', 204, 116, -1)], hidden: { x: 128, y: 152, kind: 'milk', hitsNeeded: 6 } },
  19: { tpl: 'slopeBowl', spawns: [e('goblin', 96, 80, 1), e('goblin', 160, 80, -1), e('fireSpitter', 92, 152, 1), e('fireSpitter', 164, 152, -1)] },
  20: { tpl: 'bossClam', spawns: [] },

  21: { tpl: 'zigSlope', spawns: [e('goblin', 88, 78, 1), e('goblin', 168, 78, -1), e('fireSpitter', 96, 152, 1), e('fireSpitter', 160, 152, -1)] },
  22: { tpl: 'centerShaft', spawns: [e('goblin', 88, 80, 1), e('goblin', 128, 80, -1), e('goblin', 168, 80, -1), e('fireSpitter', 68, 152, 1), e('fireSpitter', 188, 152, -1)] },
  23: { tpl: 'twinSteps', spawns: [e('goblin', 56, 80, 1), e('goblin', 88, 80, -1), e('fireSpitter', 168, 80, 1), e('fireSpitter', 204, 80, -1)], hidden: { x: 224, y: 224, kind: 'warp', hitsNeeded: 6 } },
  24: { tpl: 'sumoPerch', spawns: [e('yellowMonkey', 100, 82, 1), e('yellowMonkey', 156, 82, -1), e('tornado', 48, 116, 1), e('sumo', 128, 48, -1)] },
  25: { tpl: 'islandHop', spawns: [e('tornado', 96, 80, 1), e('tornado', 160, 80, -1), e('tornado', 128, 152, 1), e('yellowMonkey', 52, 188, 1), e('yellowMonkey', 204, 188, -1)] },
  26: { tpl: 'sumoPerch', spawns: [e('yellowMonkey', 100, 82, 1), e('yellowMonkey', 156, 82, -1), e('tornado', 208, 116, -1), e('sumo', 128, 48, 1)] },
  27: { tpl: 'pyramid', spawns: [e('goblin', 92, 80, 1), e('goblin', 128, 80, -1), e('goblin', 164, 80, -1), e('fireSpitter', 128, 152, 1)] },
  28: { tpl: 'sumoPerch', spawns: [e('tornado', 100, 82, 1), e('tornado', 156, 82, -1), e('yellowMonkey', 128, 152, 1), e('sumo', 128, 48, -1)] },
  29: { tpl: 'caves', spawns: [e('tornado', 92, 80, 1), e('tornado', 128, 80, -1), e('tornado', 164, 80, 1), e('yellowMonkey', 56, 188, 1), e('yellowMonkey', 200, 188, -1)] },
  30: { tpl: 'bossBirds', spawns: [] },

  31: { tpl: 'zigSlope', spawns: [e('goblin', 92, 78, 1), e('goblin', 164, 78, -1), e('fireYeti', 96, 152, 1), e('fireYeti', 160, 152, -1)], hidden: { x: 48, y: 116, kind: 'burger', hitsNeeded: 6 } },
  32: { tpl: 'caves', spawns: [e('fireYeti', 92, 80, 1), e('fireYeti', 128, 80, -1), e('fireYeti', 164, 80, 1), e('goblin', 48, 188, 1), e('goblin', 208, 188, -1)] },
  33: { tpl: 'pyramid', spawns: [e('goblin', 92, 80, 1), e('goblin', 164, 80, -1), e('fireYeti', 84, 152, 1), e('fireYeti', 172, 152, -1)], hidden: { x: 230, y: 188, kind: 'warp', hitsNeeded: 6 } },
  34: { tpl: 'centerShaft', spawns: [e('yellowMonkey', 96, 80, 1), e('yellowMonkey', 160, 80, -1), e('tornado', 56, 116, 1), e('tornado', 200, 116, -1)], hidden: { x: 64, y: 152, kind: 'burger', hitsNeeded: 6 } },
  35: { tpl: 'twinSteps', spawns: [e('yellowMonkey', 64, 80, 1), e('yellowMonkey', 192, 80, -1), e('tornado', 96, 116, 1), e('tornado', 160, 116, -1)] },
  36: { tpl: 'islandHop', spawns: [e('yellowMonkey', 96, 80, 1), e('yellowMonkey', 160, 80, -1), e('tornado', 52, 116, 1), e('tornado', 204, 116, -1)] },
  37: { tpl: 'slopeBowl', spawns: [e('goblin', 92, 80, 1), e('goblin', 128, 80, -1), e('goblin', 164, 80, 1), e('fireYeti', 88, 152, 1), e('fireYeti', 168, 152, -1)] },
  38: { tpl: 'caves', spawns: [e('tornado', 92, 80, 1), e('tornado', 164, 80, -1), e('tornado', 54, 116, 1), e('tornado', 202, 116, -1)], hidden: { x: 128, y: 224, kind: 'burger', hitsNeeded: 6 } },
  39: { tpl: 'centerShaft', spawns: [e('yellowMonkey', 96, 80, 1), e('yellowMonkey', 160, 80, -1), e('tornado', 64, 152, 1), e('tornado', 192, 152, -1)] },
  40: { tpl: 'bossBigNose', spawns: [] },

  41: { tpl: 'spirePit', pit: true, spawns: [e('ogre', 92, 80, 1), e('ogre', 164, 80, -1), e('ogre', 84, 152, 1), e('ogre', 172, 152, -1)], hidden: { x: 40, y: 188, kind: 'sundae', hitsNeeded: 6 } },
  // 原版第 44 层起蓝蝙蝠才出场，41～43 层仍以独角冲撞怪与地形怪为主。
  42: { tpl: 'pyramid', pit: true, spawns: [e('ogre', 92, 80, 1), e('ogre', 164, 80, -1), e('goblin', 64, 116, 1), e('goblin', 192, 116, -1), e('ogre', 128, 152, 1)], hidden: { x: 216, y: 188, kind: 'warp', hitsNeeded: 6 } },
  43: { tpl: 'twinSteps', pit: true, spawns: [e('ogre', 70, 80, 1), e('ogre', 190, 80, -1), e('yellowMonkey', 128, 116, 1), e('ogre', 40, 152, 1), e('ogre', 208, 152, -1)] },
  44: { tpl: 'zigSlope', pit: true, spawns: [e('ogre', 92, 78, 1), e('ogre', 164, 78, -1), e('ogre', 128, 152, 1), e('blueBat', 64, 96, 1), e('blueBat', 192, 96, -1)] },
  45: { tpl: 'spirePit', pit: true, spawns: [e('ogre', 92, 80, 1), e('ogre', 164, 80, -1), e('ogre', 84, 152, 1), e('ogre', 172, 152, -1), e('ogre', 56, 188, 1)], hidden: { x: 128, y: 152, kind: 'sundae', hitsNeeded: 6 } },
  46: { tpl: 'caves', pit: true, spawns: [e('ogre', 92, 80, 1), e('ogre', 164, 80, -1), e('blueBat', 64, 96, 1), e('blueBat', 192, 96, -1)] },
  47: { tpl: 'islandHop', pit: true, spawns: [e('ogre', 96, 80, 1), e('ogre', 160, 80, -1), e('ogre', 48, 188, 1), e('ogre', 208, 188, -1)] },
  48: { tpl: 'spirePit', pit: true, spawns: [e('blueBat', 64, 68, 1), e('blueBat', 128, 108, -1), e('blueBat', 192, 68, -1), e('ogre', 128, 152, 1)], hidden: { x: 204, y: 116, kind: 'sundae', hitsNeeded: 6 } },
  49: { tpl: 'twinSteps', pit: true, spawns: [e('ogre', 64, 80, 1), e('ogre', 192, 80, -1), e('ogre', 96, 116, 1), e('ogre', 160, 116, -1)] },
  50: { tpl: 'bossBubbleStatues', spawns: [] },
};

export const FLOORS = Array.from({ length: 50 }, (_, index) => {
  const floor = index + 1;
  const spec = FLOOR_SPECS[floor];
  const geo = layoutTemplate(spec.tpl, !!spec.pit);
  const boss = BOSS_NAMES[floor] || null;
  const theme = Math.ceil(floor / 10);
  return {
    floor,
    theme,
    world: WORLD_THEMES[theme - 1],
    isBoss: !!boss,
    bossKind: boss?.kind || null,
    bossName: boss?.name || null,
    pit: !!spec.pit,
    platforms: geo.platforms,
    slopes: geo.slopes,
    walls: geo.walls,
    spawns: spec.spawns,
    hidden: spec.hidden || null,
    playerSpawns: [
      { x: 36, y: 224 },
      { x: 220, y: 224 },
    ],
  };
});

export function getFloor(floorNumber) {
  return FLOORS[Math.max(0, Math.min(49, (floorNumber | 0) - 1))];
}

// 查询某位置 (x, prevY -> nextY) 踩踏的可站立高度，包含单向平台、底层地面和斜坡。
export function findSupportY(floorDef, x, prevY, nextY, allowOneWay = true) {
  let best = Infinity;
  for (const plat of floorDef.platforms) {
    if (!allowOneWay && plat.oneWay) continue;
    if (x < plat.x1 - 5 || x > plat.x2 + 5) continue;
    if (prevY <= plat.y + 3.5 && nextY >= plat.y - 0.5) {
      if (plat.y < best) best = plat.y;
    }
  }
  for (const sl of floorDef.slopes) {
    const minX = Math.min(sl.x1, sl.x2);
    const maxX = Math.max(sl.x1, sl.x2);
    if (x < minX - 2 || x > maxX + 2) continue;
    const t = Math.max(0, Math.min(1, (x - sl.x1) / (sl.x2 - sl.x1 || 1)));
    const sy = sl.y1 + (sl.y2 - sl.y1) * t;
    if (prevY <= sy + 6 && nextY >= sy - 3 && sy < best) best = sy;
  }
  return best === Infinity ? null : best;
}

// 如果站在斜坡上，返回当前斜坡及其倾斜方向（向下滑的方向）
export function slopeAt(floorDef, x, y) {
  for (const sl of floorDef.slopes) {
    const minX = Math.min(sl.x1, sl.x2);
    const maxX = Math.max(sl.x1, sl.x2);
    if (x < minX - 2 || x > maxX + 2) continue;
    const t = Math.max(0, Math.min(1, (x - sl.x1) / (sl.x2 - sl.x1 || 1)));
    const sy = sl.y1 + (sl.y2 - sl.y1) * t;
    if (Math.abs(y - sy) <= 5) {
      const downDir = sl.y2 > sl.y1 ? Math.sign(sl.x2 - sl.x1) : Math.sign(sl.x1 - sl.x2);
      return { y: sy, downDir, slope: sl };
    }
  }
  return null;
}

export function resolveWallX(floorDef, x, y, halfW = 6) {
  let out = Math.max(WALL_LEFT + halfW, Math.min(WALL_RIGHT - halfW, x));
  let hit = out !== x;
  for (const wall of floorDef.walls) {
    if (y > wall.y1 + 2 && y - 14 < wall.y2 - 1) {
      if (out + halfW > wall.x1 && out - halfW < wall.x2) {
        const leftDist = Math.abs(out - (wall.x1 - halfW));
        const rightDist = Math.abs(out - (wall.x2 + halfW));
        out = leftDist < rightDist ? wall.x1 - halfW : wall.x2 + halfW;
        hit = true;
      }
    }
  }
  return { x: out, hit };
}
