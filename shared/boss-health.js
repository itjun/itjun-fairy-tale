// 地图里记下的是单武器血量。实际开战时再按输出加厚，避免后程叠技能后一下清空。
// 第 7 版把交战时长排成缓坡：中段先看清一招，终点略长，大关再长一截。第 6 版及更早的存档继续用原公式。
export function bossBaseline(stage, role, version = 6) {
  if (version >= 8) return 1200 + stage.worldIndex * 68;
  if (version >= 7) {
    if (role === 'mid') return 780 + stage.index * 6;
    if (role === 'world') return 900 + stage.worldIndex * 40;
    return 960 + stage.index * 10;
  }
  if (role === 'mid') return 140 + stage.worldIndex * 18;
  if (role === 'world') return 480 + stage.worldIndex * 100;
  return 180 + stage.index * 24;
}

export function bossRole(boss) {
  if (boss.isMidBoss) return 'mid';
  if (boss.isWorldBoss) return 'world';
  return 'small';
}

// 一把基础弯刀的压力是 1，血量不变。第 7 版只把额外输出加厚到 1.8 倍；更早的版本仍按关卡深度成倍加厚。
export function bossToughness(stageIndex, pressure, version = 6) {
  const piled = Math.max(1, Number.isFinite(pressure) ? pressure : 1);
  if (version >= 7) return 1 + Math.min(0.8, (piled - 1) * 0.18);
  const depth = 1 + stageIndex * 0.85;
  return 1 + (piled - 1) * depth;
}

export function bossTargetHp(stage, role, pressure, version = 6) {
  const baseline = bossBaseline(stage, role, version);
  return Math.max(baseline, Math.round(baseline * bossToughness(stage.index, pressure, version)));
}
