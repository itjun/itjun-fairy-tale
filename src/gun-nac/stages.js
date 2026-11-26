import { sunAt } from './terrain.js';

// 每个字母是一波完整编队。小首领会停住关卡时钟，打倒后才展开下一段。
export const AREA_NAMES = [
  '隐藏星域',
  '月面基地',
  '熔岩火山',
  '海上舰队',
  '深林树冠',
  '金钱世界',
  '陶土遗迹',
  '太阳表面',
  '太阳内部',
];
export const GUN_NAMES = ['散射', '爆破球', '圆月弯刀', '火龙', '宽幅光束'];
export const BOMB_NAMES = { F: '火环', B: '冰壁', T: '雷电', W: '水弹' };

const roads = [
  ['V S P G D W C V S G J W P S D V J G W C S V R P W D G V C J P S W G D V C', '!clay'],
  [
    'V S C D V P S W C R G V S D C R P H V C S G R C P H V W R D V C',
    '!orb',
    'R V G W C H R S P D R C G V W R S C H V G H R W C S R P H G R V',
    '!rabbit',
  ],
  [
    'V K S C P M T G M K C S M P W T M C V M K D T S P W K T C M V',
    '!battery',
    'K T M V W C M S G T K P M C W M K T S V T W M G P K M T C D K M W V',
    '!lava',
  ],
  [
    'F V L C S F W L P G F C L V F W S L C F V P G L W S F C L W G',
    '!siren',
    'W F L G P F C S L F W F G L C V F P S W L W F G L C W S F L P W',
    '!octopus',
  ],
  [
    'S U A C G W P A U V A S C U A W P V U W A C G U S A P V G A W',
    '!acorn',
    'U A W G C A S U P A V G C U A W S A P U G A W C U D A S G P A U W',
    '!tree',
  ],
  [
    'O Q V C S O Q P G O W Q C O D Q P V O Q W C D O G P Q V O D',
    '!cat',
    'Q D O W P Q C G O D Q S C O G Q O W P D Q G O C W Q P D V O Q G W',
    '!gold',
  ],
  [
    'G E J P V C J S E W J P C E J G S W J V G E S C J W E J P D',
    '!clay',
    'E J W G C J S E P J D E V C J G W P J S E W J G C E P J V D J W',
    '!tower',
  ],
  [
    'Y V Y S C Y G W Y P S Y W C Y V P Y G Y W G Y V Y C S W Y P G Y W',
    'Y S G Y W C Y V P Y S Y G W Y P Y C Y V Y W G Y S P Y V Y C Y W',
    '!moon',
  ],
  [
    'T X S X C G T P X V T W X G C V T P X W',
    '!orb',
    'X G T W P X S T C V T X W C S T',
    '!acorn',
    'T X V P G X C W X T W T S X C P',
    '!battery',
    'X T C P W X T S G X C W T P S X',
    '!burrow',
    '!alien',
  ],
];

// 间隔用逻辑帧，顺序固定；同一波左右镜像及瞄准由可保存的随机序列决定。
export const ROUTES = roads.map((parts, area) => {
  // Travel between encounters is separate from time spent fighting a boss.
  const before = [232, 250, 278, 226, 217, 208, 270, 219, 228][area];
  const after = [232, 207, 291, 259, 197, 250, 190, 219, 228][area];
  let frames = before;
  const route = [];
  for (const part of parts) {
    if (part.startsWith('!')) {
      route.push({ boss: part.slice(1) });
      frames = after;
    } else
      for (const wave of part.split(' '))
        route.push({ wave, wait: frames + (wave === 'L' || wave === 'Y' ? 46 : 0) });
  }
  return route;
});

export const FOES = {
  scout: [2, 5, 60],
  rabbitDrone: [3, 7, 100],
  courier: [4, 7, 120],
  missile: [1, 4, 70],
  ember: [3, 6, 90],
  fish: [2, 6, 80],
  barge: [9, 12, 300],
  nut: [3, 6, 90],
  stump: [5, 8, 160],
  coin: [2, 6, 100],
  shell: [4, 7, 160],
  arrow: [2, 6, 100],
  turret: [5, 8, 200],
  fighter: [3, 6, 100],
  tentacle: [3, 6, 80],
};
export const BOSS = {
  orb: ['流浪月球', 62, 15],
  battery: ['重装炮台', 70, 17],
  siren: ['双潮海妖', 74, 16],
  acorn: ['蓝橡果', 68, 14],
  cat: ['招财猫', 85, 18],
  clay: ['巡游陶偶', 55, 14],
  rabbit: ['月面机械兔', 96, 27],
  lava: ['熔岩守卫', 110, 21],
  octopus: ['深海章鱼', 95, 19],
  tree: ['伸枝树精', 122, 21],
  gold: ['黄金机械像', 132, 20],
  tower: ['沙中古塔', 93, 18],
  moon: ['弯月', 120, 17],
  burrow: ['地底异兽', 85, 15],
  alien: ['要塞核心', 155, 22],
};
export const SHIP_SPEED = [0, 2.8125, 3.75, 4.6875, 5.625];
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export function playBounds(s) {
  void s;
  // 飞行战场固定 256×240（4∶3），左右侧栏放 HUD，不再随窗口拓宽。
  return { width: 256, left: 0, right: 256, span: 1 };
}
export function random(s) {
  s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0;
  return s.seed / 4294967296;
}

export function spawnFoe(s, kind, x, y, path = 'sine', sign = 1, delay = 0) {
  const [hp, r, score] = FOES[kind];
  const enemy = {
    id: ++s.serial,
    kind,
    x,
    y,
    ox: x,
    oy: y,
    path,
    sign,
    age: -delay,
    hp,
    r,
    score,
    shotAt: 45 + Math.floor(random(s) * 70),
  };
  s.enemies.push(enemy);
  return enemy;
}

export function launchWave(s, wave) {
  const { width, left, right } = playBounds(s);
  const sign = random(s) < 0.5 ? -1 : 1;
  const side = sign > 0 ? left + 18 : right - 18;
  const center = left + 40 + random(s) * (width - 80);
  const local = ['scout', 'rabbitDrone', 'ember', 'fish', 'nut', 'coin', 'arrow', 'fighter', 'fighter'][
    s.area
  ];
  const line = (kind, path, count, interval, start = center) => {
    for (let i = 0; i < count; i++) spawnFoe(s, kind, start, -8, path, sign, i * interval);
  };
  switch (wave) {
    case 'V':
      for (let i = -2; i <= 2; i++)
        spawnFoe(s, 'scout', center + i * 15, -8 - Math.abs(i) * 11, 'sine', sign);
      break;
    case 'S':
      line(local, 'cross', 6, 16, side);
      break;
    case 'G':
      line(local, 'cross', 4, 22, side);
      for (let i = 0; i < 4; i++) spawnFoe(s, 'fighter', 256 - side, -8, 'cross', -sign, 52 + i * 21);
      break;
    case 'D':
      for (let i = 0; i < 5; i++)
        spawnFoe(s, local, left + 36 + i * ((width - 72) / 4), 250, 'rear', sign, i * 14);
      break;
    case 'W':
      line(local, 'weave', 6, 22);
      break;
    case 'C':
      line('courier', 'sine', 1, 0);
      line(local, 'cross', 3, 19, side);
      break;
    case 'P':
      line('courier', 'weave', 1, 0);
      line('scout', 'sine', 3, 17, 256 - center);
      break;
    case 'R':
      line('rabbitDrone', 'hop', 5, 32);
      break;
    case 'H':
      line('turret', 'ground', 2, 91);
      line('rabbitDrone', 'cross', 3, 22, side);
      break;
    case 'M':
      line('missile', 'dive', 6, 22);
      break;
    case 'K':
      line('ember', 'weave', 5, 29);
      break;
    case 'T':
      line('turret', 'ground', 3, 57);
      break;
    case 'F':
      line('fish', 'surface', 5, 33);
      break;
    case 'L':
      line('barge', 'ground', 1, 0);
      line('fish', 'surface', 4, 23, 256 - center);
      break;
    case 'A':
      line('nut', 'sine', 5, 26);
      break;
    case 'U':
      line('stump', 'ground', 3, 38);
      break;
    case 'O':
      line('coin', 'weave', 6, 18);
      break;
    case 'Q':
      line('shell', 'drift', 4, 40);
      break;
    case 'J':
      line('arrow', 'dive', 5, 21);
      break;
    case 'E':
      line('turret', 'ground', 2, 55);
      line('arrow', 'cross', 3, 18, side);
      break;
    case 'Y': {
      const height = 58 + random(s) * 131;
      const bands = s.index > 30 && s.index % 3 === 0 ? [height, height + 32] : [height];
      for (const y of bands) {
        const dir = sunAt(s.scroll + 35, y);
        s.hazards.push({ kind: 'flare', x: dir === 1 ? left : right, y, sign: dir, age: 0, life: 132 });
      }
      line('fighter', 'cross', 3, 23, side);
      break;
    }
    case 'X':
      line('turret', 'ground', 2, 44);
      line('fighter', 'weave', 4, 20, 256 - center);
      break;
  }
}
