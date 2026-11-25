// 网两端各有一个绳结，只让绳结之间的网面受力。
export function netOffset(net, x, previous = false) {
  const motion = net.netMotion;
  if (!motion) return 0;
  const u = (x - net.x) / (net.width * .46);
  if (Math.abs(u) >= 1) return 0;
  const focus = previous ? motion.previousFocus : motion.focus;
  const bend = previous ? motion.previousBend : motion.bend;
  return -bend * (1 - u * u) * Math.exp(-1.6 * (u - focus) ** 2);
}

function motionOf(net) {
  return net.netMotion ??= { bend: 0, speed: 0, focus: 0, previousBend: 0, previousFocus: 0 };
}

export function landOnNet(net, vy) {
  const motion = motionOf(net);
  motion.speed = Math.min(10, motion.speed + Math.max(0, -vy) * .48);
}

export function stepNet(net, player, dt, isReducedMotion) {
  const isLoaded = player.isGrounded && player.ground === net;
  if (!isLoaded && !net.netMotion) return;
  const motion = motionOf(net);
  motion.previousBend = motion.bend;
  motion.previousFocus = motion.focus;
  if (isLoaded) motion.focus = Math.max(-1, Math.min(1, (player.x - net.x) / (net.width * .46)));
  const target = isLoaded ? .42 : 0;
  const damping = isReducedMotion ? 22 : 4.8;
  motion.speed += ((target - motion.bend) * 108 - motion.speed * damping) * dt;
  motion.bend += motion.speed * dt;
  if (isLoaded) player.y += netOffset(net, player.x) - netOffset(net, player.x, true);
  if (!isLoaded && Math.abs(motion.bend) < .001 && Math.abs(motion.speed) < .005) delete net.netMotion;
}
