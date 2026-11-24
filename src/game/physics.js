export { randomGenerator } from '../../shared/random.js';
export const RULES = Object.freeze({ speed: 6, gravity: 23, jump: 12.6, radius: 0.28, coyote: 0.14, buffer: 0.16 });
// 给四位角色的平地二段跳留足安全高度。
export function landingDamage(height) { return Math.min(100, Math.ceil(Math.max(0, height - 8.5) * 4)); }
export function platformY(platform, x) {
  const offset = Math.max(-platform.width / 2, Math.min(platform.width / 2, x - platform.x));
  if (platform.skin === 'safety-net') {
    const distance = offset / (platform.width / 2);
    return platform.y + platform.width * .12 * distance ** 2;
  }
  return platform.y + (platform.slope || 0) * offset;
}
export function createPlayer(platform, offset = 0) {
  return { x: platform.x + offset, y: platformY(platform,platform.x+offset), vx: 0, vy: 0, isGrounded: true, ground: platform, coyote: RULES.coyote, buffer: 0, safe: platform, safeX: platform.x + offset, facing: 1, recoveries: 0, protection: 0, knockTime: 0, dropTime: 0, springTime: 0 };
}
export function rescue(player, platform = player.safe, x = platform.x) {
  Object.assign(player, { x, y: platformY(platform,x), vx: 0, vy: 0, isGrounded: true, ground: platform, coyote: RULES.coyote, buffer: 0, protection: 2, knockTime: 0, dropTime: 0, springTime: 0, isAirJumpUsed: false, grip: null, launch: null, crawl: null });
  if (!platform.isMoving) { player.safe = platform; player.safeX = x; }
  player.recoveries += 1;
}
export function revivalPoint(player, platforms, isFall) {
  // 掉坑回到最后站稳的位置；受伤死亡优先原地或脚下的平台，不退回旧旗子。
  let platform = !isFall && player.isGrounded && player.ground?.isEnabled !== false ? player.ground : null;
  if (!platform && !isFall) platform = platforms.filter(p => p.isEnabled !== false && p.y <= player.y + 0.01 && player.y - p.y < 8 && Math.abs(player.x - p.x) <= p.width / 2 - 0.35).sort((a,b) => b.y-a.y)[0];
  const x = platform ? player.x : player.safeX ?? player.safe.x;
  platform ||= player.safe;
  const margin = Math.max(0, platform.width / 2 - 0.35);
  return { platformId: platform.id, offsetX: Math.max(-margin, Math.min(margin, x-platform.x)) };
}
// 固定 120 Hz 步长。落地只检查下降穿过台面，孩子可从下方跳上台。
export function stepPlayer(player, input, platforms, dt, bounds = {}) {
  player.protection = Math.max(0, player.protection - dt);
  player.knockTime = Math.max(0, player.knockTime - dt);
  player.dropTime = Math.max(0, player.dropTime - dt);
  player.springTime = Math.max(0, player.springTime - dt);
  if (player.isGrounded && player.ground?.isMoving) { player.y += player.ground.deltaY || 0; player.x += player.ground.deltaX || 0; }
  if (input.drop && player.isGrounded && player.ground?.isOneWay) {
    player.ignoredPlatform = player.ground.id; player.dropTime = 0.3;
    player.isGrounded = false; player.coyote = 0; player.buffer = 0; player.y -= 0.08;
  }
  if (input.jump) player.buffer = RULES.buffer;
  else player.buffer = Math.max(0, player.buffer - dt);
  player.coyote = player.isGrounded ? RULES.coyote : Math.max(0, player.coyote - dt);
  const targetVx = input.direction * RULES.speed * (input.speedMultiplier ?? 1);
  player.vx = player.knockTime > 0 ? player.knockVx : player.isGrounded && player.ground?.isIce ? player.vx + Math.max(-12*dt, Math.min(12*dt,targetVx-player.vx)) : targetVx;
  if (player.isGrounded && player.ground?.conveyor) player.x += player.ground.conveyor * dt;
  if (input.direction) player.facing = Math.sign(input.direction);
  let isJumped = false;
  if (player.buffer > 0 && player.coyote > 0) {
    player.vy = RULES.jump; player.buffer = 0; player.coyote = 0; player.isGrounded = false; isJumped = true;
  }
  if (!isJumped && input.jump && !player.isGrounded && !player.isAirJumpUsed && player.dropTime <= 0) {
    player.vy = player.character === 'little' ? RULES.jump * 1.16 : RULES.jump;
    player.buffer = 0; player.coyote = 0; player.isAirJumpUsed = true; isJumped = true;
  }
  const support = player.isGrounded && player.ground && (player.ground.slope || player.ground.isSeesaw || player.ground.skin === 'safety-net') && Math.abs(player.y-platformY(player.ground,player.x))<.05 ? player.ground : null;
  const previousY = player.y, previousX = player.x;
  player.x += player.vx * dt;
  player.x = Math.max(bounds.minX ?? platforms[0].x - platforms[0].width / 2 + RULES.radius, Math.min(bounds.maxX ?? Infinity, player.x));
  player.vy -= RULES.gravity * dt;
  player.y += player.vy * dt;
  player.isGrounded = false;
  let landing = support?.isEnabled !== false && support && Math.abs(player.x-support.x)<support.width/2+RULES.radius ? support : null;
  if (player.vy <= 0) {
    for (const platform of platforms) {
      if (platform.isEnabled === false || player.dropTime > 0 && platform.id === player.ignoredPlatform) continue;
      // 升降台这一帧往上走了多少，就把它上一帧的台面往下算多少，不然人会从正在上升的台面穿过去。
      const lifted = Math.max(0, Math.min(0.1, platform.deltaY || 0));
      if (previousY >= platformY(platform,previousX) - lifted - 0.01 && player.y <= platformY(platform,player.x) && Math.abs(player.x - platform.x) < platform.width / 2 + RULES.radius && (!landing || platformY(platform,player.x) > platformY(landing,player.x))) landing = platform;
    }
  }
  player.ground = landing;
  if (landing) {
    player.y = platformY(landing,player.x); player.vy = 0; player.isGrounded = true; player.isAirJumpUsed = false;
    // 记录最近站稳的平台及横向位置，掉坑后不退回平台中央或检查点。
    if (!landing.isMoving && !landing.isCrumbling && !landing.isSeesaw && Math.abs(player.x - landing.x) < landing.width / 2 - 0.35) { player.safe = landing; player.safeX = player.x; }
  }
  const isRescued = player.y < (bounds.minY ?? -7);
  if (isRescued && !bounds.isFiniteLife) rescue(player);
  return { isJumped, isRescued };
}
