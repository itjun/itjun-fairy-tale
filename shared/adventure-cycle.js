// 走完最后一个世界跨轮。提高敌人强度，地图和积分规则沿用当前版本。
export function cycleModifiers(cycle = 1) {
  return { health: 1 + (cycle - 1) * 0.2, damage: 1 + (cycle - 1) * 0.12 };
}

export function applyCycleHealth(world, cycle = 1) {
  if (world.cycle === cycle) return;
  const { health } = cycleModifiers(cycle);
  for (const enemy of world.enemies) {
    if (!enemy.isBoss && !enemy.isElite && (enemy.parentId || !['armored', 'summoner'].includes(enemy.role))) continue;
    enemy.cycleBaseHp ??= enemy.maxHp;
    const ratio = enemy.maxHp ? enemy.hp / enemy.maxHp : 1;
    enemy.maxHp = Math.round(enemy.cycleBaseHp * health);
    enemy.hp = enemy.isDefeated ? 0 : Math.max(1, Math.ceil(enemy.maxHp * ratio));
  }
  world.cycle = cycle;
}

export function carryToNextWorld(adventure, worldIndex, worldCount) {
  const carried = structuredClone(adventure);
  carried.cycle = (carried.cycle || 1) + Number(worldIndex === worldCount - 1);
  carried.revision++;
  return carried;
}
