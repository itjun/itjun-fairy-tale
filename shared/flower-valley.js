import { addGardenChapters } from './story-expeditions.js';
import { placeEnemy } from './room-terrain.js';

export const WATER_CHANNELS = ['demo', 'flower', 'pond', 'bridge'];
export const GROW_SECONDS = 0.38;
export function newWaterState() {
  return { demo: null, flower: null, pond: null, bridge: null, flow: null };
}

export function buildFlowerValley(world, stage, builder, placeBoss, extended = false) {
  if (extended) world.expedition = true;
  let offset = 0;
  const random = builder.random;
  const loop = random() < .5;
  const valley = world.valley = { layout: loop ? 'aqueduct' : 'river', controls: [], beds: [] };
  let room;
  function begin(kind, name, reward = null) {
    const id = world.rooms.length;
    builder.state.zoneId = id;
    room = { id, depth: id, name, kind, reward, path: [], enemyIds: [], childIds: [], platformIds: [], waves: 0 };
    world.rooms.push(room);
  }
  function land(x, y, width, extra = {}) {
    const p = builder.add(x + offset, y, width, { roomId: room.id, ...extra });
    room.platformIds.push(p.id);
    room.path.push(p.id);
    return p;
  }
  function grow(x, y, width, channel, delay, skin = 'water-leaf') {
    return land(x, y, width, { skin, channel, delay, isEnabled: false });
  }
  function bed(x, y, channel, height) {
    valley.beds.push({ roomId: room.id, x: x + offset, y, channel, height });
  }
  function control(platform, x, channel) {
    valley.controls.push({ channel, x, y: platform.y, platformId: platform.id });
  }
  function treasure(p) {
    world.treasures.push({ id: world.treasures.length + 1, roomId: room.id, platformId: p.id,
      kind: ['star', 'heart', 'rainbow', 'flower'][Math.floor(random() * 4)], x: p.x, y: p.y + 1.25 });
  }
  function finish(start, exit) {
    exit.milestone = room.depth + 1;
    const tiles = room.platformIds.map(id => world.platforms[id]);
    const left = Math.min(...tiles.map(p => p.x - p.width / 2)), right = Math.max(...tiles.map(p => p.x + p.width / 2));
    const bottom = Math.min(...tiles.map(p => p.y)), top = Math.max(...tiles.map(p => p.y));
    Object.assign(room, { startId: start.id, exitId: exit.id, exitPlatformIds: [exit.id], left, right, bottom, top, fallY: bottom - 5 });
    world.mainPath.push(...room.path);
    world.zones.push({ id: room.id, kind: room.kind, name: room.name, isBoss: room.kind === 'boss', roomIds: [room.id],
      startId: start.id, exitId: exit.id, platformIds: room.platformIds, minX: left, maxX: right, baseY: 0 });
  }
  begin('mechanism', loop ? '高渠回环' : '双岸河谷');
  const start = land(0, 0, 12, { isOneWay: false });
  world.start = start;
  control(start, 2, 'demo');
  grow(9.6, .35, 4.5, 'demo', .24);
  bed(5.45, -.12, 'demo', 4.4);
  const bank = land(18, 0, 11, { isOneWay: false });
  const near = land(15.8, 1.45, 2.5, { skin: 'water-treadle' });
  const far = land(20.4, 1.45, 2.5, { skin: 'water-treadle' });
  control(near, near.x, 'pond');
  control(far, far.x, 'flower');
  valley.forkX = (near.x + far.x) / 2;
  bed(22.9, -.12, 'flower', 8.8);
  const ridge = [[26.4, 1.9, 4.5], [32.6, 4.2, 5], [39, 6.5, 5.6], [45.5, 8, 6.2]];
  const pool = [[26.6, -1.9, 5.5], [33.9, -3, 6.3], [41.6, -3, 6.5], [49.3, -2.5, 6.4], [57, -1.8, 6.6]];
  const high = ridge.map(([x,y,w], i) => grow(x, y, w, 'flower', .45 + i * .17));
  const low = pool.map(([x,y,w], i) => grow(x, y, w, 'pond', .45 + i * .17, 'water-lily'));
  valley.pool = { left: bank.x + bank.width / 2, right: 61, y: -4.15 };
  treasure(high[1 + Math.floor(random()*2)]);
  treasure(low[1 + Math.floor(random()*3)]);
  let exit;
  if (loop) {
    // 两条支路分别从西侧的高叶和东侧的池塘登上同一条回流水渠。
    const rise = [[63, .5], [68, 3], [63, 5.6], [57, 8.1], [50.8, 10.4]];
    for (const [x,y] of rise) land(x, y, 5, { skin: 'rock' });
    land(44.4, 12.8, 5.4, { skin: 'plank' });
    land(36.2, 14.4, 8.4, { skin: 'plank' });
    const gate = land(25.7, 14.4, 10.4, { skin: 'plank' });
    control(gate, 23.4, 'bridge');
    for (const [i,x] of [16.6, 10.3, 4].entries()) grow(x, 14.4, 5, 'bridge', .4 + i * .16);
    exit = land(-4.7, 14.4, 10);
    treasure(gate);
  } else {
    grow(52.2, 5.6, 5.4, 'flower', 1.16);
    grow(58.6, 3.2, 5.4, 'flower', 1.28);
    exit = land(67, .2, 11);
  }
  finish(start, exit);

  // 分岔在河谷内部做决定；守卫与庭院各有一扇单向门，沿用清场、选卡与续关。
  if (extended) {
    addGardenChapters(world,stage,builder,false);
    offset = world.rooms.at(-1).right + 54 - 126;
  }
  begin('battle', '城堡桥头', 'upgrade');
  const approach = land(126, 0, 15, { isCheckpoint: true });
  const span = land(143, 0, 16, { skin: 'plank' });
  const perch = land(144, 2.7, 6, { skin: 'leaf' });
  const end = land(160.5, 0, 16);
  const defenders = random() < .5 ? ['jelly', 'puff', 'flowerpot'] : ['puff', 'flowerpot', 'jelly'];
  for (const [index, home] of [span, perch, end].entries()) {
    const enemy = placeEnemy(world, stage, home, defenders[index], random);
    Object.assign(enemy, { roomId: room.id, wave: 0, isDormant: false });
    room.enemyIds.push(enemy.id);
  }
  room.waves = 1;
  room.encounters = [{ endId: end.id, lastWave: 0 }];
  treasure(perch);
  finish(approach, end);

  if (extended) {
    addGardenChapters(world,stage,builder,true);
    offset = world.rooms.at(-1).right + 54 - 223;
  }
  begin('boss', '花王庭院');
  const entry = land(223, 0, 10, { isCheckpoint: true });
  const floor = land(245, 0, 32, { isBossFloor: true, isOneWay: false });
  const flag = land(268, 0, 11, { isFinish: true });
  for (const [x, y] of [[235, 2.7], [242, 5.2], [252, 2.7]]) grow(x, y, 5.5, 'flower', 0);
  for (const x of [241.5, 258.8]) grow(x, 2.4, 6.4, 'pond', 0, 'water-lily');
  bed(234, 0, 'flower', 6);
  const boss = placeBoss(world, stage, room, floor);
  boss.skills = [{ name: '花田涟漪', kind: 'wave', image: 'magic-bubble', speed: 8 }, ...boss.skills.slice(0, 1)];
  boss.patterns = boss.skills.map(skill => skill.kind);
  world.bossArenas.push({ id: 0, bossId: boss.id, floorId: floor.id, exitId: flag.id, left: floor.x - 15, right: floor.x + 15, y: 0, layout: 'platform' });
  world.supplies.push({ id: 'medkit:0', kind: 'medkit', platformId: entry.id, x: entry.x + 2, y: 1.1 });
  finish(entry, flag);
  for (const source of world.rooms.slice(0,-1)) {
    const target = world.rooms[source.id + 1];
    world.doors.push({ id: source.id, roomId: source.id, targetRoomId: target.id, platformId: source.exitId,
      offsetX: source.id === 0 && loop ? -2.3 : 3, kind: target.kind, reward: target.reward });
  }
  Object.assign(world, { finish: flag, minX: world.rooms[0].left, maxX: world.rooms.at(-1).right, minY: extended ? Math.min(...world.rooms.map(r => r.fallY)) - 2 : -10, maxY: 25,
    requiredFlowers: 0, signature: [valley.layout, ...defenders, ...world.treasures.map(item => item.platformId + ':' + item.kind)].join('|') });
}

export function growthFraction(p, water, elapsed) {
  const start = water[p.channel];
  if (start === null) return 0;
  return Math.max(0, Math.min(1, (elapsed - start - p.delay) / GROW_SECONDS));
}
export function syncWaterRoutes(world, water, elapsed) {
  for (const p of world.platforms) if (p.channel) p.isEnabled = growthFraction(p, water, elapsed) >= .8;
}
export function canLeaveValley(world, water) {
  return !!water.flow && (world.valley.layout === 'river' || water.bridge !== null);
}
export function validWaterState(world, water) {
  return !!water && WATER_CHANNELS.every(key => water[key] === null || Number.isFinite(water[key]) && water[key] >= 0)
    && (water.flow === null ? water.flower === null && water.pond === null : ['flower','pond'].includes(water.flow) && water[water.flow] !== null && water.demo !== null)
    && (water.bridge === null || world.valley.layout === 'aqueduct' && !!water.flow);
}
export function waterUnderfoot(world, water, player, elapsed) {
  if (!player.isGrounded) return null;
  const control = world.valley.controls.find(item => item.platformId === player.ground?.id && Math.abs(player.x - item.x) < 1.1);
  if (!control) return null;
  const key = control.channel;
  const fork = key === 'flower' || key === 'pond';
  if (water[key] !== null && (!fork || water.flow === key) || key === 'bridge' && !water.flow) return null;
  water.demo ??= elapsed;
  water[key] ??= elapsed;
  if (fork) water.flow = key;
  return key;
}
