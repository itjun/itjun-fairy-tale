// 检查敌弹上一帧到当前帧的路径，避免高速弹丸穿过刀光。
export function findProjectileClash(wave, shots, halfWidth) {
  let nearest = null;
  for (const shot of shots) {
    if (!shot.isActive) continue;
    const sx = shot.previousX ?? shot.x, sy = shot.previousY ?? shot.y;
    const radius = (shot.size || .7) / 2;
    let enter = 0, leave = 1;
    for (const [position, delta, extent] of [
      [sx - wave.x, shot.x - sx, halfWidth + radius],
      [sy - wave.y, shot.y - sy, wave.halfHeight + radius],
    ]) {
      if (Math.abs(delta) < 1e-9) { if (Math.abs(position) > extent) { enter = 2; break; } }
      else {
        const a = (-extent - position) / delta, b = (extent - position) / delta;
        enter = Math.max(enter, Math.min(a,b)); leave = Math.min(leave, Math.max(a,b));
      }
    }
    if (enter <= leave && (!nearest || enter < nearest.time)) nearest = {shot,time:enter,x:sx+(shot.x-sx)*enter,y:sy+(shot.y-sy)*enter};
  }
  return nearest;
}
