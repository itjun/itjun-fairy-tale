import { EXPANDED_THEME_MONSTERS } from '../adventure-catalog.js';
import { placeEnemy } from '../room-terrain.js';

// 等地形、宝物和首领都生成以后再补怪，旧局的编号和随机地图才能原样续玩。
export function addTrailEnemies(world, stage, random) {
  const kinds = EXPANDED_THEME_MONSTERS[stage.themeId].filter(kind => kind !== 'paint' && kind !== 'candy');
  for (const room of world.rooms) {
    if (room.kind !== 'mechanism' && !world.forest) continue;
    const reserved = new Set([room.startId, room.exitId]);
    const landmarks = [
      ...(room.stops || []), ...(room.stations || []), ...(room.traversal?.cave?.mouths || []),
      ...(world.valley?.controls || []), ...world.springs, ...world.hazards,
    ];
    for (const item of landmarks) reserved.add(item.platformId);
    for (const wall of room.traversal?.walls || []) reserved.add(wall.topId);
    if (world.forest) {
      for (const route of Object.values(world.forest.trails)) for (const stop of route) reserved.add(stop.platformId);
      for (const id of world.forest.fireflies) reserved.add(id);
    }
    const occupied = room.enemyIds.map(id => world.enemies[id - 1]);
    const start = world.platforms[room.startId];
    let kindIndex = Math.floor(random() * kinds.length);
    for (const id of room.platformIds) {
      const p = world.platforms[id];
      if (reserved.has(id) || p.isMoving || p.isEnabled === false || p.isCrumbling || p.isBridge || p.slope || p.width < 4) continue;
      if (Math.hypot(p.x - start.x, p.y - start.y) < 12) continue;
      if (world.forest && !p.isCave && p.y < 8 && p.x <= world.bossArenas[0].right + 5) continue;
      if (occupied.some(e => Math.abs(e.x - p.x) < 15 && Math.abs(e.baseY - p.y) < 7)) continue;
      const guard = placeEnemy(world, stage, p, kinds[kindIndex++ % kinds.length], random);
      Object.assign(guard, { roomId: room.id, wave: 0, isDormant: false, isReinforcement: true });
      occupied.push(guard);
      room.enemyIds.push(guard.id);
    }
  }
}
