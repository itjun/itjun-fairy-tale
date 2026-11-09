import { randomGenerator } from '../../shared/random.js';

export const ROUTES = {
  stairs: { name: '阶梯分层', hint: '沿阶梯跳上高处，也能从下面绕过去。' },
  canopy: { name: '树屋回环', hint: '站上大叶子升高，再沿树枝跳下来。' },
  cave: { name: '地下探险', hint: '从洞口往下走，踩弹簧花回到地面。' },
};

// 宝物编号继续使用 1…level.platforms；地形编号独立，旧成绩无需迁移。
export function createWorld(seed, level) {
  const random = randomGenerator(seed);
  const route = level.route;
  const platforms = [], anchors = [], springs = [], lifts = [];
  function add(x, y, width, extra = {}) {
    const platform = { id: platforms.length, x, y, width, isOneWay: y !== 0, ...extra };
    platforms.push(platform);
    return platform;
  }
  function treasure(platform, offset = 0) { anchors.push({ platformId: platform.id, x: platform.x + offset, y: platform.y + 1.15 }); }
  function steps(points) { return points.map(([x, y]) => add(x + (random() - 0.5) * 0.25, y, 3.2 + random() * 0.35)); }
  const start = add(0, 0, 10, { isCheckpoint: true });
  let finish, enemyHomes;
  if (route === 'stairs') {
    const ground = [add(10, 0, 10), add(21, 0, 11), add(32, 0, 10)];
    const climb = steps([[5, 1.6], [8, 3.2], [11, 4.8], [14, 6.4]]);
    const high = [add(18.5, 6.4, 5.5), add(25, 6.4, 6, { isBridge: true, isCheckpoint: true })];
    const descent = steps([[30, 4.8], [33, 3.2], [36, 1.6]]);
    const middle = add(23, 3.1, 9);
    finish = add(42, 0, 10, { isCheckpoint: true, isFinish: true });
    springs.push({ x: 21, y: 0, platformId: ground[1].id, power: 14 });
    treasure(start, 3); climb.forEach(p => treasure(p)); high.forEach(p => treasure(p));
    descent.forEach(p => treasure(p)); treasure(middle); treasure(finish);
    enemyHomes = [[ground[0], 'jelly', 0], [high[1], 'puff', 1.5], [ground[2], 'leaf', 0]];
  } else if (route === 'canopy') {
    const ground = [add(11, 0, 12), add(23, 0, 12), add(35, 0, 12)];
    const middle = add(6, 4.2, 10, { isCheckpoint: true });
    const climb = steps([[1.5, 5.6], [4.5, 7], [7.5, 8.4]]);
    const high = [add(13, 8.4, 8), add(23, 8.4, 10, { isBridge: true, isCheckpoint: true }), add(33, 8.4, 8)];
    const descent = steps([[38, 7], [40.5, 5.6], [43, 4.2], [45.5, 2.8], [48, 1.4]]);
    finish = add(50, 0, 12, { isCheckpoint: true, isFinish: true });
    const lift = add(14, 0, 4.4, { isMoving: true, isOneWay: true, baseY: 0, travel: 4.2, period: 9 });
    lifts.push(lift);
    treasure(start, 3); treasure(ground[0], -2); treasure(middle, 2); treasure(middle, -2);
    treasure(climb[1]); high.forEach(p => treasure(p));
    treasure(descent[0]); treasure(descent[2]); treasure(descent[4]); treasure(finish);
    enemyHomes = [[ground[0], 'leaf', 0], [middle, 'jelly', 0], [high[1], 'puff', 1.4]];
  } else {
    const surface = add(21.5, 0, 25, { isCheckpoint: true });
    const down = steps([[5.8, -1.6], [8.8, -3.2], [11.8, -4.8]]);
    const floor = add(23, -6.4, 30, { isOneWay: false, isCheckpoint: true });
    const middle = add(21, -3.2, 8);
    const up = steps([[34, -4.8], [36, -3.2], [36.5, -1.6]]);
    const surfaceSteps = steps([[17, 1.4], [22, 2.8]]);
    finish = add(43, 0, 10, { isCheckpoint: true, isFinish: true });
    springs.push({ x: 29, y: -6.4, platformId: floor.id, power: 16 });
    treasure(start, 3); down.forEach(p => treasure(p)); treasure(floor, -7); treasure(middle);
    treasure(floor, 5); up.forEach(p => treasure(p)); treasure(surfaceSteps[1]); treasure(finish);
    enemyHomes = [[surface, 'leaf', 0], [floor, 'jelly', 0], [middle, 'puff', 1.5]];
  }
  // 高低层拉开到约四个角色身高；单级抬升仍在普通跳跃范围内。
  platforms.forEach(p => { p.y *= 1.4; if (p.isMoving) { p.baseY *= 1.4; p.travel *= 1.4; } });
  anchors.forEach(anchor => { anchor.y = platforms[anchor.platformId].y + 1.15; });
  springs.forEach(spring => { spring.y *= 1.4; spring.power *= 1.15; });
  const treasures = Array.from({ length: level.platforms }, (_, index) => ({
    id: index + 1, ...anchors[Math.round(index * (anchors.length - 1) / (level.platforms - 1))],
  }));
  const enemies = enemyHomes.map(([platform, kind, height], index) => {
    const range = Math.min(2.3, platform.width / 2 - 0.7);
    const x = platform.x + (random() - 0.5) * range;
    return { id: index, kind, x, y: platform.y + height, baseY: platform.y + height,
      minX: platform.x - range, maxX: platform.x + range, direction: index % 2 ? -1 : 1,
      speed: 0.7 + random() * 0.35, height: kind === 'leaf' ? 1.6 : kind === 'puff' ? 1.35 : 1.2, width: 1.35,
      phase: random() * Math.PI * 2, elapsed: 0, isDefeated: false };
  });
  platforms.forEach(p => { p.progress = Math.min(level.platforms - 1, Math.max(0, Math.floor(p.x / finish.x * level.platforms))); });
  finish.progress = level.platforms;
  return { route, platforms, treasures, enemies, lifts, springs, start, finish,
    minX: -5, maxX: finish.x + finish.width / 2, minY: Math.min(...platforms.map(p => p.y)) - 8 };
}

export function movePlatforms(lifts, elapsed) {
  for (const lift of lifts) {
    lift.previousY = lift.y;
    // 端点自然减速，给孩子留出上下台的时间。
    lift.y = lift.baseY + (1 - Math.cos(elapsed / lift.period * Math.PI * 2)) * lift.travel / 2;
    lift.deltaY = lift.y - lift.previousY;
  }
}
