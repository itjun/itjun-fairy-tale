import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_ACTS } from '../shared/levels.js';
import { createRoomWorld } from '../shared/room-world.js';
import { ARENAS, LAYER, ROOM_SHAPES, isCrowding, pickHome } from '../shared/room-terrain.js';
import { monsterVitality } from '../shared/monster-roles.js';

const SEEDS = [1, 7, 42, 137, 999, 2024, 31337, 20261115];
const eachWorld = visit => { for (const act of WORLD_ACTS) for (const seed of SEEDS) visit(createRoomWorld(seed, act), act, seed); };
const platformsOf = (world, room) => room.platformIds.map(id => world.platforms[id]);
const hazardsOf = (world, room) => world.hazards.filter(hazard => room.platformIds.includes(hazard.platformId));

// 这里不用生成器自己的判断，单独再量一遍：平台占的横向范围、上下差多少。
function span(platform) {
  const x = platform.baseX ?? platform.x, y = platform.baseY ?? platform.y, lean = Math.abs(platform.slope || 0) * platform.width / 2;
  return { left: x - platform.width / 2, right: x + platform.width / 2 + (platform.axis === 'x' ? platform.travel : 0), low: y - lean, high: y + lean + (platform.axis === 'y' ? platform.travel : 0) };
}

test('两块平台不会贴在一起：左右有重叠的上下至少差一层', () => {
  eachWorld((world, act, seed) => {
    for (const room of world.rooms) {
      const platforms = platformsOf(world, room);
      for (let i = 0; i < platforms.length; i++) for (let j = i + 1; j < platforms.length; j++) {
        const a = span(platforms[i]), b = span(platforms[j]);
        const overlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const apart = Math.max(a.low - b.high, b.low - a.high);
        if (overlap > 0.05) assert.ok(apart >= LAYER - 0.21, `${act.id} ${seed} ${room.kind} ${room.shape || room.arena || ''}：平台 ${platforms[i].id} 和 ${platforms[j].id} 左右重叠 ${overlap.toFixed(1)}，上下只差 ${apart.toFixed(2)}`);
      }
    }
  });
});

test('同一层的平台要么接成一整块，要么留出看得清的缝；移动台走的路上没有别的平台', () => {
  eachWorld((world, act, seed) => {
    for (const room of world.rooms) {
      const platforms = platformsOf(world, room);
      for (let i = 0; i < platforms.length; i++) for (let j = i + 1; j < platforms.length; j++) {
        assert.equal(isCrowding(platforms[i], platforms[j]), false, `${act.id} ${seed} ${room.kind} ${room.shape || room.arena || ''}：平台 ${platforms[i].id} 和 ${platforms[j].id} 贴得太近`);
      }
    }
  });
  const flat = { x: 0, y: 0, width: 6 };
  assert.equal(isCrowding(flat, { x: 6, y: 0, width: 6 }), false, '首尾相接、一样高，是一整块地面');
  assert.equal(isCrowding(flat, { x: 6.5, y: 0, width: 6 }), true, '同一层只留半格缝');
  assert.equal(isCrowding(flat, { x: 7.2, y: 0, width: 6 }), false);
  assert.equal(isCrowding(flat, { x: 3, y: 1, width: 6 }), true, '截图里的情况：重叠着只差一点高');
  assert.equal(isCrowding(flat, { x: 3, y: LAYER, width: 6 }), false);
  assert.equal(isCrowding(flat, { x: 2, y: -3, width: 5, isMoving: true, axis: 'y', baseX: 2, baseY: -3, travel: 6 }), true, '平台伸进了升降台的路');
});

test('开场房和机关房用五种房型，挨着的两间不重样，房间有高有低', () => {
  const seen = new Set();
  eachWorld((world, act, seed) => {
    const shaped = world.rooms.filter(room => ['intro', 'mechanism'].includes(room.kind));
    assert.equal(world.rooms[0].kind, 'intro');
    for (const [index, room] of shaped.entries()) {
      assert.ok(ROOM_SHAPES[room.shape], `${act.id} ${seed} ${room.shape}`);
      room.sections.forEach(section => seen.add(section.shape));
      if (index) assert.notEqual(room.shape, shaped[index - 1].shape, `${act.id} ${seed} 连着两间 ${room.shape}`);
      assert.ok(room.top - room.bottom >= LAYER * 2 || room.shape === 'river', `${act.id} ${seed} ${room.shape} 只有 ${room.top - room.bottom} 高`);
      assert.equal(room.look, ROOM_SHAPES[room.shape].look);
    }
    const arenas = world.rooms.filter(room => ['battle', 'elite'].includes(room.kind));
    for (const [index, room] of arenas.entries()) {
      assert.ok(ARENAS[room.arena]);
      const sequence = arenas.flatMap(item => item.encounters.map(encounter => encounter.arena));
      sequence.forEach((arena, n) => { if (n) assert.notEqual(arena, sequence[n - 1]); });
      assert.ok(room.top - room.bottom >= LAYER);
    }
    for (const room of world.rooms.filter(item => ['puzzle', 'shop'].includes(item.kind))) assert.ok(room.top - room.bottom >= LAYER * 2 - 0.01, `${room.kind} 是平的`);
    assert.equal(world.rooms.every(room => room.fallY === room.bottom - 6), true);
  });
  assert.deepEqual([...seen].sort(), Object.keys(ROOM_SHAPES).sort());
});

test('陷阱和障碍按规则摆：数量、离边距离、互相的间隔', () => {
  const kinds = new Set();
  eachWorld((world, act, seed) => {
    for (const room of world.rooms) {
      const hazards = hazardsOf(world, room), label = `${act.id} ${seed} ${room.kind} ${room.shape || room.arena || ''}`;
      if (['puzzle', 'shop', 'boss'].includes(room.kind)) assert.equal(hazards.length, 0, label);
      if (room.kind === 'intro') assert.ok(hazards.length >= 2 && hazards.length <= 3, `${label} ${hazards.length} 处`);
      if (room.kind === 'mechanism') assert.ok(hazards.length >= 4 && hazards.length <= 6, `${label} ${hazards.length} 处`);
      if (['battle', 'elite'].includes(room.kind)) assert.equal(hazards.length, (room.depth >= 2 ? 2 : 0) + (['family', 'beach', 'snow'].includes(act.themeId) ? 3 : 0), label);
      for (const hazard of hazards) {
        kinds.add(hazard.kind);
        const platform = world.platforms[hazard.platformId];
        assert.ok(![room.startId, room.exitId].includes(platform.id) && !platform.isMoving && !platform.isCrumbling, `${label} 陷阱放错了平台`);
        assert.ok(platform.width / 2 - Math.abs(hazard.x - platform.x) >= 3, `${label} 陷阱离平台边不到 3`);
        if (hazard.kind === 'block') assert.ok(['thorns', 'blocks'].includes(hazard.skin));
        else assert.ok(hazard.warning >= 1.3 && hazard.period > hazard.warning + hazard.active, '带节拍的陷阱有预告，也有歇着的时候');
      }
      for (let i = 0; i < hazards.length; i++) for (let j = i + 1; j < hazards.length; j++) {
        assert.ok(Math.hypot(hazards[i].x - hazards[j].x, hazards[i].y - hazards[j].y) >= 6, `${label} 两处陷阱挨得太近`);
      }
      const timed = hazards.filter(hazard => hazard.kind !== 'block').map(hazard => room.path.indexOf(hazard.platformId)).sort((a, b) => a - b);
      for (let i = 1; i < timed.length; i++) assert.ok(timed[i] - timed[i - 1] >= 2, `${label} 两处带节拍的陷阱中间没有安全平台`);
    }
  });
  assert.ok(kinds.has('block') && kinds.size >= 4, [...kinds].join(','));
});

test('怪按落脚点摆，数量比原来多，离起点远一点', () => {
  eachWorld((world, act, seed) => {
    for (const room of world.rooms) {
      const enemies = room.enemyIds.map(id => world.enemies[id - 1]), start = world.platforms[room.startId];
      const label = `${act.id} ${seed} ${room.kind} ${room.shape || room.arena || ''}`;
      if (room.kind === 'intro') assert.ok(enemies.length >= 8 && enemies.length <= 13, `${label} ${enemies.length} 只`);
      if (room.kind === 'mechanism') assert.ok(enemies.length >= 12 && enemies.length <= 21, `${label} ${enemies.length} 只`);
      for (const enemy of enemies) {
        assert.ok(enemy.x - (start.x - 2) >= 6, `${label} 怪离起点太近`);
        const home = world.platforms[enemy.platformId];
        assert.ok(enemy.minX <= enemy.x && enemy.x <= enemy.maxX && enemy.minX >= home.x - home.width / 2 && enemy.maxX <= home.x + home.width / 2, `${label} 怪的巡逻范围出了平台`);
        for (const hazard of world.hazards) if (hazard.kind === 'block' && hazard.platformId === home.id) {
          assert.ok(Math.abs(enemy.x - hazard.x) >= 4 && (enemy.maxX < hazard.x || enemy.minX > hazard.x), `${label} 怪走进了障碍`);
        }
        if (['battle', 'elite'].includes(room.kind) && home.spot === 'perch') assert.equal(enemy.role, 'shooter', `${label} 高台上只站会射的`);
      }
      if (['intro', 'mechanism'].includes(room.kind)) {
        for (let section = 0; section < 3; section++) {
          const group = enemies.filter(enemy => enemy.section === section);
          assert.equal(new Set(group.map(enemy => enemy.behavior)).size, group.length, `${label} 同一段动作不重复`);
        }
        for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) assert.ok(Math.hypot(enemies[i].x - enemies[j].x, enemies[i].y - enemies[j].y) >= 6, `${label} 两只怪挤在一起`);
      }
    }
  });
  const battle = seed => createRoomWorld(seed, WORLD_ACTS[5]).rooms.filter(room => room.kind === 'battle');
  const waves = SEEDS.flatMap(battle).map(room => room.enemyIds.length);
  assert.ok(Math.min(...waves) >= 5, `战斗房最少 ${Math.min(...waves)} 只`);
});

test('挑落脚点：会射的上高台，会飞的守坑和竖井，会冲的去长平地，会跳的上台阶', () => {
  const homes = ['perch', 'air', 'run', 'step', undefined].map((spot, id) => ({ id, spot }));
  const random = () => 0.3;
  assert.equal(pickHome(homes, 'shooter', random).spot, 'perch');
  assert.equal(pickHome(homes, 'flyer', random).spot, 'air');
  assert.equal(pickHome(homes, 'charger', random).spot, 'run');
  assert.equal(pickHome(homes, 'hopper', random).spot, 'step');
  assert.ok([undefined, 'run'].includes(pickHome(homes, 'armored', random).spot));
  assert.equal(pickHome(homes.filter(home => home.spot !== 'perch'), 'shooter', () => 0).spot, 'run', '没有高台就退到平地');
  assert.equal(pickHome([{ id: 9, spot: 'air' }], 'charger', random).id, 9, '只剩一块也得放');
  assert.equal(monsterVitality('fish', WORLD_ACTS[3]).role, 'shooter');
});
