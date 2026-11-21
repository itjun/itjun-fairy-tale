// 地图里记下的是单武器血量：一把基础弯刀打一场首领大约 10 到 14 秒。
import { cycleModifiers } from './adventure-cycle.js';

export function bossBaseline(stage, cycle = 1) {
  return Math.round((1200 + stage.worldIndex * 68) * cycleModifiers(cycle).health);
}

// 开战时根据绑定招式的最高单武器输出加厚，最多到 1.8 倍。
export function bossToughness(pressure) {
  const piled = Math.max(1, Number.isFinite(pressure) ? pressure : 1);
  return 1 + Math.min(0.8, (piled - 1) * 0.18);
}

export function bossTargetHp(stage, pressure, cycle = 1) {
  const baseline = bossBaseline(stage, cycle);
  return Math.max(baseline, Math.round(baseline * bossToughness(pressure)));
}
