export { randomGenerator } from '../../shared/random.js';
export const RULES = Object.freeze({ speed: 6, gravity: 23, jump: 10.8, radius: 0.28, coyote: 0.14, buffer: 0.16 });
export function firstPlatform() { return { id: 0, x: 0, y: 0, width: 12, isCheckpoint: true }; }
export function nextPlatform(previous, random, level) {
  const id = previous.id + 1;
  const isCheckpoint = id % 6 === 0;
  const width = isCheckpoint ? 7 : 3.8 + random() * 1.6;
  const gap = (level?.gapMin ?? 0.9) + random() * (level?.gapRange ?? 0.7);
  const y = Math.max(-0.5, Math.min(2.5, previous.y + (random() - 0.4) * (level?.rise ?? 1.2)));
  return { id, width, x: previous.x + previous.width / 2 + gap + width / 2, y, isCheckpoint };
}
export function createPlayer(platform, offset = 0) {
  return { x: platform.x + offset, y: platform.y, vx: 0, vy: 0, isGrounded: true, coyote: RULES.coyote, buffer: 0, safe: platform, facing: 1, recoveries: 0 };
}
export function rescue(player, platform = player.safe) {
  Object.assign(player, { x: platform.x, y: platform.y, vx: 0, vy: 0, isGrounded: true, coyote: RULES.coyote, buffer: 0, safe: platform });
  player.recoveries += 1;
}
// 固定 120 Hz 步长。落地只检查下降穿过台面，孩子可从下方跳上台。
export function stepPlayer(player, input, platforms, dt) {
  if (input.jump) player.buffer = RULES.buffer;
  else player.buffer = Math.max(0, player.buffer - dt);
  player.coyote = player.isGrounded ? RULES.coyote : Math.max(0, player.coyote - dt);
  player.vx = input.direction * RULES.speed;
  if (input.direction) player.facing = input.direction;
  let isJumped = false;
  if (player.buffer > 0 && player.coyote > 0) {
    player.vy = RULES.jump; player.buffer = 0; player.coyote = 0; player.isGrounded = false; isJumped = true;
  }
  const previousY = player.y;
  player.x += player.vx * dt;
  player.x = Math.max(platforms[0].x - platforms[0].width / 2 + RULES.radius, player.x);
  player.vy -= RULES.gravity * dt;
  player.y += player.vy * dt;
  player.isGrounded = false;
  if (player.vy <= 0) {
    for (const platform of platforms) {
      if (previousY >= platform.y - 0.01 && player.y <= platform.y && Math.abs(player.x - platform.x) < platform.width / 2 + RULES.radius) {
        player.y = platform.y; player.vy = 0; player.isGrounded = true;
        // 只在脚下有足够空间时记录安全台，避免边缘反复掉落。
        if (Math.abs(player.x - platform.x) < platform.width / 2 - 0.35) player.safe = platform;
        break;
      }
    }
  }
  const isRescued = player.y < -7;
  if (isRescued) rescue(player);
  return { isJumped, isRescued };
}
export function regroup(players, maxDistance = 13) {
  if (players.length < 2 || Math.abs(players[0].x - players[1].x) <= maxDistance) return false;
  const leader = players[0].x > players[1].x ? players[0] : players[1];
  const follower = leader === players[0] ? players[1] : players[0];
  rescue(follower, leader.safe);
  return true;
}
export function prunePlatforms(platforms, players) {
  const minSafe = Math.min(...players.map(player => player.safe.x));
  return platforms.filter(platform => platform.x + platform.width / 2 > minSafe - 22);
}
