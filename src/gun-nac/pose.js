// 画面插值：逻辑仍按 60 步/秒推进，画面在上一步与这一步之间按时间比例取位置。
// 屏幕刷新率是 120 Hz 时，飞机和敌人不会每两帧才动一次，看起来更顺。
// 只影响渲染：渲染前改写位置，渲染后还原，逻辑、存档和固定输入回放都不受影响。

// 单步位移超过这个值视为瞬移（复活、换区、回环），直接显示当前位置，不做插值。
const TELEPORT_LIMIT = 24;
// 背景滚动单步超过这个值视为换区重置，不做插值。
const SCROLL_LIMIT = 4;
const LISTS = ['enemies', 'hostile', 'shots', 'items', 'effects', 'hazards', 'bombs'];

function trackedObjects(s) {
  const out = [];
  if (s.ship) out.push(s.ship);
  if (s.boss) out.push(s.boss);
  for (const key of LISTS) if (Array.isArray(s[key])) out.push(...s[key]);
  return out;
}

// 每走一步逻辑前调用，记下这一步开始时各对象的位置。
export function capturePose(s) {
  const pose = new Map();
  for (const o of trackedObjects(s)) {
    if (Number.isFinite(o.x) && Number.isFinite(o.y)) pose.set(o, { x: o.x, y: o.y });
  }
  return { pose, scroll: s.scroll };
}

// 渲染前调用：alpha 为 0 到 1 之间，表示当前时刻在上一步与这一步之间的位置。
// 返回还原函数，渲染结束后必须调用。
export function applyPose(s, prev, alpha) {
  if (!prev || !(alpha < 1)) return () => {};
  const t = Math.max(0, alpha);
  const restores = [];
  for (const o of trackedObjects(s)) {
    const before = prev.pose.get(o);
    if (!before || !Number.isFinite(o.x) || !Number.isFinite(o.y)) continue;
    const dx = o.x - before.x;
    const dy = o.y - before.y;
    if (Math.abs(dx) > TELEPORT_LIMIT || Math.abs(dy) > TELEPORT_LIMIT) continue;
    restores.push([o, o.x, o.y]);
    o.x = before.x + dx * t;
    o.y = before.y + dy * t;
  }
  const scrollNow = s.scroll;
  const scrollWas = prev.scroll;
  const canScroll =
    Number.isFinite(scrollNow) && Number.isFinite(scrollWas) && Math.abs(scrollNow - scrollWas) <= SCROLL_LIMIT;
  if (canScroll) s.scroll = scrollWas + (scrollNow - scrollWas) * t;
  return () => {
    for (const [o, x, y] of restores) {
      o.x = x;
      o.y = y;
    }
    s.scroll = scrollNow;
  };
}
