// 地图里记下的是单武器血量：一把基础弯刀打一场首领大约 10 到 14 秒。
export function bossBaseline(stage) {
  return 1200 + stage.worldIndex * 68;
}

// 一把基础弯刀的压力是 1，血量不变。叠了更多武器时，开战再把首领加厚，最多到 1.8 倍。
export function bossToughness(pressure) {
  const piled = Math.max(1, Number.isFinite(pressure) ? pressure : 1);
  return 1 + Math.min(0.8, (piled - 1) * 0.18);
}

export function bossTargetHp(stage, pressure) {
  const baseline = bossBaseline(stage);
  return Math.max(baseline, Math.round(baseline * bossToughness(pressure)));
}
