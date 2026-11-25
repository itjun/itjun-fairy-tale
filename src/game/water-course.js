// 一段水路用飞行时间参数化。水滴离开槽口后保留水平速度，重力只改变竖直速度。
const GRAVITY = 16;
const fallTime = (height, vy) => (vy + Math.sqrt(vy * vy + 2 * GRAVITY * height)) / GRAVITY;

// 两张叶子原画中间隆起，两端收尖。只给水使用这条上缘，角色仍踩原来的落脚面。
function waterSurface(p) {
  const half = p.width / 2, slope = p.slope || 0;
  if (p.skin === 'water-lily') return {y:p.y+.126, slope:slope+.082/half, bend:.377/(half*half)};
  if (p.skin === 'water-leaf') return {y:p.y+.137, slope:slope+.32/half, bend:.34/(half*half)};
  return {y:p.y, slope, bend:0};
}

export function waterCourse(source, platforms, surface) {
  const parts = [];
  let { x, y, vx = 7, vy = -.55 } = source;
  let start = 0;
  while (y > surface) {
    let flight = fallTime(y - surface, vy);
    let hit = null;
    for (const p of platforms) {
      if (p.isEnabled === false || p.caveId !== source.caveId) continue;
      const farX = x + vx*flight;
      if (p.x+p.width/2 < Math.min(x,farX) || p.x-p.width/2 > Math.max(x,farX)) continue;
      const top = waterSurface(p), dx = x-p.x;
      const height = y - (top.y + dx*(top.slope-top.bend*dx));
      const relativeVy = vy - vx*(top.slope-2*top.bend*dx);
      const gravity = GRAVITY - 2*top.bend*vx*vx;
      const disc = relativeVy*relativeVy + 2*gravity*height;
      if (disc < 0) continue;
      // 下降穿过台面的根。有理化后在两条曲率相等时也能解。
      const root = Math.sqrt(disc), divisor = root-relativeVy;
      const t = Math.abs(divisor) > 1e-8 ? 2*height/divisor : (relativeVy+root)/gravity;
      if (!Number.isFinite(t) || t <= .001 || t >= flight || Math.abs(x+vx*t-p.x) > p.width/2) continue;
      flight = t;
      hit = p;
    }
    parts.push({ x, y, vx, vy, gravity: GRAVITY, start, duration: flight });
    x += vx * flight;
    y += vy * flight - GRAVITY * flight * flight / 2;
    start += flight;
    if (!hit) break;

    // 来水带着水平速度漫过叶面。斜坡上的水则向低处排出。
    const top = waterSurface(hit);
    const direction = hit.slope ? -Math.sign(hit.slope) : Math.sign(vx);
    const edge = hit.x + direction * hit.width / 2;
    vx = direction * 5.4;
    const travel = Math.abs((edge-x)/vx);
    if (travel > .001) {
      const slope = top.slope-2*top.bend*(x-hit.x);
      parts.push({x,y,vx,vy:vx*slope,gravity:2*top.bend*vx*vx,isSheet:true,start,duration:travel});
    }
    start += travel;
    x = edge;
    const dx = edge-hit.x;
    y = top.y + dx*(top.slope-top.bend*dx);
    vx = direction * 2.1;
    vy = -.7;
  }
  return parts;
}
