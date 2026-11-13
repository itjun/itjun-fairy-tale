import { randomGenerator } from './random.js';
import { MONSTERS, EXPANDED_THEME_MONSTERS } from './adventure-catalog.js';

// 独立版本：旧局保留原敌人编号与计分，新局才增加密度和行为。
export function expandEncounters(world) {
  const random = randomGenerator((world.seed ^ 0x3a7126ef) >>> 0);
  const previous = world.enemies.filter(e => !e.parentId);
  const pool = EXPANDED_THEME_MONSTERS[world.levelId];
  world.version = 3;
  world.enemies = [];
  for (const zone of world.zones) {
    const candidates = zone.platformIds.map(id => world.platforms[id]).filter(p => !p.isMoving && !p.isCheckpoint && !p.conveyor && p.gateId === undefined && p.width >= 4.5
      && p.x > 16 && !world.camps.some(c => Math.abs(c.x - p.x) < 9 && Math.abs(c.y - p.y) < 5)
      && !world.springs.some(s => s.platformId === p.id));
    const shuffled = candidates.map(p => ({ p, order: random() })).sort((a, b) => a.order - b.order);
    const target = Math.ceil(previous.filter(e => e.zone === zone.id).length * 1.6);
    const selected = [];
    for (const { p } of shuffled) {
      if (selected.some(other => Math.abs(other.x - p.x) < 5 && Math.abs(other.y - p.y) < 3)) continue;
      selected.push(p);
      if (selected.length >= target) break;
      // 相邻两只形成短遭遇，其间仍保留空地，不把加量全摊成孤立小怪。
      const partner = candidates.filter(other => !selected.includes(other) && Math.abs(other.x-p.x)>=5 && Math.abs(other.x-p.x)<18 && Math.abs(other.y-p.y)<3
        && selected.every(chosen => Math.abs(chosen.x-other.x)>=5 || Math.abs(chosen.y-other.y)>=3)).sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x))[0];
      if (partner) selected.push(partner);
      if (selected.length >= target) break;
    }
    selected.sort((a, b) => a.x - b.x || a.y - b.y);
    const offset = Math.floor(random() * pool.length);
    for (const [index, p] of selected.entries()) {
      const kind = pool[(offset + index) % pool.length], definition = MONSTERS[kind];
      const isElite = index === selected.length - 1;
      const height = kind === 'wool' ? 0.85 : kind === 'pillow' ? 1.8 : 1.5;
      world.enemies.push({ id: world.enemies.length + 1, platformId: p.id, zone: zone.id, kind, ...definition, x: p.x, y: p.y, baseY: p.y,
        minX: p.x - Math.min(1.5, p.width / 2 - 1.2), maxX: p.x + Math.min(1.5, p.width / 2 - 1.2), direction: random() < 0.5 ? -1 : 1,
        width: kind === 'wool' ? 2.6 : kind === 'pillow' ? 2.3 : 1.3, height, speed: 0.65 + random() * 0.4,
        phase: random() * 1.2, elapsed: 0, hp: isElite ? 3 : kind === 'leafshield' ? 2 : 1, isElite, isDefeated: false,
        points: definition.points + (isElite ? 15 : 0), drop: null, encounter: zone.id });
    }
  }
  // 召唤和障碍预分配固定编号。读档不能重新生成子怪或重复发奖。
  for (const parent of [...world.enemies]) {
    if (!['candy', 'paint', 'bell', 'sandcastle'].includes(parent.kind)) continue;
    parent.childIds = [];
    const count = ['paint', 'candy'].includes(parent.kind) ? 2 : 1;
    for (let index = 0; index < count; index++) {
      const kind = parent.kind === 'sandcastle' ? 'sandcastle' : parent.kind === 'candy' ? 'candy' : 'ink';
      const child = { ...parent, ...MONSTERS[kind], kind, id: world.enemies.length + 1, parentId: parent.id,
        childIds: undefined, isDormant: true, isElite: false, hp: 1, height: 0.7, width: 0.8, points: 5, direction: index ? 1 : -1 };
      if (parent.kind === 'sandcastle') { child.behavior = 'obstacle'; child.speed = 0; }
      parent.childIds.push(child.id); world.enemies.push(child);
    }
  }
  world.signature += ':encounters3:' + world.enemies.map(e => `${e.kind}/${e.platformId}`).join(';');
  return world;
}
