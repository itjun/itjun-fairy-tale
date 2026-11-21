import { RULES, platformY, stepPlayer } from './physics.js';

const REACH = 2.6;
const CRAWL_TIME = 0.36;
const DROP_GRAB_DISTANCE = .55;
const STILL = { isJumped: false, isRescued: false };

export function caveForPlayer(room, player) {
  if (!player.safe?.isCave) return null;
  const route = room.traversal;
  return player.safe.caveId === route?.cave?.id ? route?.cave : route?.legacyCave;
}

export function caveMouthAt(room, player) {
  if (!player.isGrounded || player.crawl) return null;
  const cave = caveForPlayer(room, player) ?? room.traversal?.cave;
  return cave?.mouths.find(mouth => mouth.platformId === player.ground?.id && Math.abs(mouth.x - player.x) <= 1.38) ?? null;
}

export function beginCrawl(player, mouth) {
  player.crawl = { mouth, fromX: player.x, time: 0 };
  player.facing = mouth.direction;
  player.vx = 0;
}

export function reachableGrips(route, from) {
  return route.grips.filter(point => point !== from && point.section === from.section && !point.isJumpOnly &&
    Math.hypot(point.x - from.x, point.y - from.y) <= (from.section !== undefined ? 2.12 : REACH));
}

export function climbEntryAt(route, player) {
  if (!route || !player.isGrounded || !player.ground || player.crawl) return null;
  const id = player.ground.id;
  return route.walls.find(wall => !wall.isLedge && wall.topId === id && Math.abs(player.x - wall.x) <= 1.6)
    ?? route.grips.find(point => point.restId === id && point.y < player.y && player.y - point.y <= 1.6 && Math.abs(player.x - point.x) <= 1.6);
}

function landAt(player, platform, x) {
  Object.assign(player, { x, y: platformY(platform, x), vx: 0, vy: 0, isGrounded: true, ground: platform,
    safe: platform, safeX: x, grip: null, launch: null, coyote: RULES.coyote, buffer: 0, isAirJumpUsed: false });
}

function hold(player, point, input) {
  player.grip = { point, isReady: !input.direction && !input.vertical };
  Object.assign(player, { x: point.x, vx: 0, vy: 0, isGrounded: false, ground: null, coyote: 0, buffer: 0, launch: null });
  if (point.side) player.facing = -point.side;
  else player.y = point.y;
}

function moveToGrip(player, point, input, toY = point.y) {
  const { x, y } = player;
  hold(player, point, input);
  player.grip.move = { x, y, toY, time: 0 };
  player.x = x;
  player.y = y;
  if (!point.side && Math.abs(point.x - x) > .15) player.facing = Math.sign(point.x - x);
}

function release(player, point, input, isDrop) {
  const direction = isDrop ? (point.side || 0) * .65 : Math.sign(input.direction) || (point.isLedge ? -point.side : point.side || player.facing);
  player.grip = null;
  player.launch = { direction, point, time: isDrop ? .13 : .66, steerAt: isDrop ? 0 : .46, isDrop, fromY: player.y };
  player.vy = isDrop ? -1.8 : RULES.jump * (point.isLedge ? .95 : 1);
  player.buffer = 0;
  return { isJumped: !isDrop, isRescued: false, isDropped: isDrop };
}

function mantle(player, platform, x, isNatural) {
  if (!isNatural) { landAt(player, platform, x); return; }
  player.grip.mantle = { platform, x, fromX: player.x, fromY: player.y, time: 0 };
}

function descendToPlatform(player, platforms) {
  const platform = platforms.find(platform => {
    const height = player.y - platformY(platform, player.x);
    return platform.isEnabled !== false && Math.abs(player.x - platform.x) <= platform.width / 2 - .35 && height >= 0 && height <= 1.85;
  });
  if (platform) mantle(player, platform, player.x, true);
}

function climb(player, input, route, platforms, allPlatforms, dt) {
  const grip = player.grip, { point } = grip;
  if (input.jump || input.drop) return release(player, point, input, input.drop);
  if (grip.mantle) {
    const move = grip.mantle;
    move.time += dt;
    const progress = Math.min(1, move.time / .32);
    player.y = move.fromY + (platformY(move.platform, move.x) - move.fromY) * Math.min(1, progress * 1.6);
    player.x = move.fromX + (move.x - move.fromX) * progress * progress;
    if (progress === 1) landAt(player, move.platform, move.x);
    return STILL;
  }
  if (grip.move) {
    const move = grip.move;
    move.time += dt;
    const progress = Math.min(1, move.time / (point.section !== undefined || point.isNatural ? .25 : .15));
    player.x = move.x + (point.x - move.x) * progress;
    player.y = move.y + (move.toY - move.y) * progress;
    if (progress === 1) grip.move = null;
    else return STILL;
  }
  if (point.side) {
    if (point.isLedge) return STILL;
    grip.isMoving = !!input.vertical;
    player.y = Math.max(point.minY, Math.min(point.maxY, player.y + input.vertical * (point.isNatural ? 3 : 3.8) * dt));
    if (input.vertical > 0 && player.y >= point.maxY) {
      const top = allPlatforms[point.topId];
      mantle(player, top, point.x - point.side * 1.1, point.isNatural);
    } else if (input.vertical < 0 && player.y <= point.minY) {
      descendToPlatform(player, platforms);
    }
    return STILL;
  }
  if (!input.direction && !input.vertical) { grip.isReady = true; return STILL; }
  // 砂岩峰的主路线按顺序摆好，按住向下沿原路退，经过横着排的抓点时也不会卡住。
  const reachable = reachableGrips(route, point);
  if (input.vertical < 0 && !input.direction && point.section !== undefined && !point.isJumpOnly) {
    const previous = route.grips[route.grips.indexOf(point) - 1];
    if (reachable.includes(previous)) moveToGrip(player, previous, input);
    else descendToPlatform(player, platforms);
    return STILL;
  }
  if (!grip.isReady) return STILL;
  const angle = Math.hypot(input.direction, input.vertical);
  let best = null, rating = -Infinity;
  for (const next of reachable) {
    const dx = next.x - point.x, dy = next.y - point.y, distance = Math.hypot(dx, dy);
    const alignment = (dx * input.direction + dy * input.vertical) / (angle * distance);
    if (input.vertical < 0 && dy > .1 || alignment < 0.52 || alignment - distance * 0.06 <= rating) continue;
    best = next; rating = alignment - distance * 0.06;
  }
  if (best) moveToGrip(player, best, input);
  else if (input.vertical < 0 && !input.direction) descendToPlatform(player, platforms);
  else if (point.restId !== undefined && input.vertical > 0) {
    const top = allPlatforms[point.restId];
    mantle(player, top, Math.max(top.x - top.width / 2 + .5, Math.min(top.x + top.width / 2 - .5, player.x)), point.section !== undefined);
  }
  grip.isReady = false;
  return STILL;
}

function findGrab(player, route, direction, beforeX, isReachingUp) {
  const launch = player.launch;
  const maxY = launch?.isDrop ? launch.fromY - DROP_GRAB_DISTANCE : Infinity;
  if (player.y > maxY) return null;
  const ignored = launch?.isDrop ? null : launch?.point;
  let best = null, distance = 0.95;
  for (const point of route.grips) {
    if (point.y > maxY) continue;
    if (point.section !== undefined && player.vy > 0 && point.y < player.y - .22) continue;
    const reach = Math.hypot((player.x - point.x) * 1.10, player.y - point.y);
    if (point !== ignored && reach < Math.min(distance, point.section !== undefined ? .76 : .95)) { best = point; distance = reach; }
  }
  if (best) return best;
  return route.walls.find(wall => wall !== ignored && (direction * wall.side < 0 || launch?.isDrop && isReachingUp) && (beforeX - wall.x) * wall.side >= -0.14
    && Math.abs(player.x - wall.x) < .62 && player.y >= wall.minY && player.y <= wall.maxY) ?? null;
}

// 攀爬和钻洞只在房间内生效，普通移动仍交给原平台物理。
export function stepTraversal(player, input, platforms, allPlatforms, dt, bounds, route) {
  if (!route) return stepPlayer(player, input, platforms, dt, bounds);
  if (player.grip && player.knockTime > 0) player.grip = null;
  if (player.crawl || player.grip) {
    player.protection = Math.max(0, player.protection - dt);
    if (!player.crawl) return climb(player, input, route, platforms, allPlatforms, dt);
    const crawl = player.crawl;
    crawl.time += dt;
    player.x = crawl.fromX + crawl.mouth.direction * 0.55 * Math.min(1, crawl.time / CRAWL_TIME);
    if (crawl.time < CRAWL_TIME) return STILL;
    landAt(player, allPlatforms[crawl.mouth.targetId], crawl.mouth.targetX);
    player.crawl = null;
    return { ...STILL, isTraversed: true };
  }
  if (input.vertical < 0 && !input.drop) {
    const point = climbEntryAt(route, player);
    if (point) {
      moveToGrip(player, point, input, point.maxY ?? point.y);
      return STILL;
    }
  }
  const beforeX = player.x;
  const launch = player.launch;
  const motion = launch ? { ...input, direction: launch.time > launch.steerAt ? launch.direction : input.direction,
    speedMultiplier: (input.speedMultiplier ?? 1) * (launch.isDrop ? 1 : 1.45) } : input;
  const result = stepPlayer(player, motion, platforms, dt, bounds);
  if (launch) {
    launch.time -= dt;
    if (player.isGrounded || result.isRescued || (launch.isDrop ? result.isJumped : launch.time <= 0)) player.launch = null;
  }
  // 松手后只响应主动的抓取方向，免得自动吸回刚离开的岩壁。
  const grabDirection = player.launch?.isDrop ? input.direction : motion.direction;
  if (input.vertical >= 0 && !player.isGrounded && !player.safe?.isCave && player.knockTime <= 0 && !result.isRescued && (Math.abs(grabDirection) > .13 || input.vertical > 0)) {
    const point = findGrab(player, route, grabDirection, beforeX, input.vertical > 0);
    if (point) hold(player, point, input);
  }
  return result;
}
