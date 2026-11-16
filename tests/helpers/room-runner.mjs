import { createPlayer, stepPlayer } from '../../src/game/physics.js';
import { moveCampaignPlatforms } from '../../src/game/combat.js';
import { stepMechanisms } from '../../src/game/hazards.js';
import { touchSpring } from '../../src/game/enemies.js';

// 让一个只会走主路的小人从房间起点走到出口，检查每间房都走得通。只按一次跳，不用空中再跳。会改动传入的地图（开桥、塌云）。
export function playRoom(world, room) {
  const path = room.path, player = createPlayer(world.platforms[room.startId]);
  const bounds = { ...world, minX: room.left + 0.3, maxX: room.right - 0.3, minY: room.fallY };
  let elapsed = 0, index = 0, furthest = 0, lastAdvance = 0, isStraying = false;
  // 站到主路的哪一块就从哪一块接着走；掉回前面的平台也一样。
  const sync = () => {
    const reached = player.isGrounded ? path.indexOf(player.ground.id) : -1;
    if (reached >= 0) index = reached;
    if (index > furthest) { furthest = index; lastAdvance = elapsed; }
  };
  for (let frame = 0; frame < 120 * 600; frame++) {
    elapsed += 1 / 120;
    moveCampaignPlatforms(world.lifts, elapsed);
    stepMechanisms(world, player, elapsed, 1 / 120);
    const next = world.platforms[path[index + 1]];
    if (!next) return { seconds: Math.round(elapsed), recoveries: player.recoveries };
    let direction = isStraying ? 1 : Math.sign(next.x - player.x), jump = false;
    if (player.isGrounded) {
      const ground = player.ground, delta = next.x - player.x;
      const isUnder = next.y > ground.y + 0.5 && Math.abs(delta) < next.width / 2 - 0.4;
      // 跳到了主路以外的高台上：一直往右走，走下去，落回主路再接着走。
      isStraying = !path.includes(ground.id);
      if (isStraying) direction = 1;
      else if (next.isEnabled === false && next.isCrumbling) direction = 0;
      else if (next.isMoving && (Math.abs(next.y - player.y) > 2 || Math.abs(delta) > ground.width / 2 + next.width / 2 + 3)) direction = 0;
      // 升降台正往上走就等它下来再跳，只跳一次追不上它。
      else if (next.isMoving && next.deltaY > 0.004 && next.y > player.y + 0.5) direction = 0;
      else if (ground.isMoving) { if (next.y - ground.y > 2 || Math.abs(delta) > 7) direction = 0; else jump = true; }
      // 下一块在头顶就原地起跳；在下面就直接走下去，不跳。
      else if (isUnder) jump = true;
      else if (next.y < ground.y - 1) jump = false;
      else if (ground.id !== next.id && (ground.x + direction * (ground.width / 2 - 0.65) - player.x) * direction <= 0.05) jump = true;
    }
    const result = stepPlayer(player, { direction, jump, drop: false }, world.platforms.filter(platform => Math.abs(platform.x - player.x) < 25), 1 / 120, bounds);
    if (result.isRescued) lastAdvance = elapsed;
    sync();
    for (const spring of world.springs) touchSpring(player, spring);
    for (const item of world.switches) if (player.ground?.id === item.platformId && Math.abs(player.x - item.x) < 1) { item.isOpen = true; world.platforms[item.bridgeId].isEnabled = true; }
    if (player.recoveries > 3 || elapsed - lastAdvance > 15) return { failed: index, next: next.id, ground: player.ground?.id, position: [player.x, player.y], recoveries: player.recoveries };
  }
  return { failed: 'timeout' };
}
