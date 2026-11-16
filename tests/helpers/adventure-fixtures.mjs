import { newSurvival } from '../../src/game/characters.js';
// 仅供本地隔离预览、测试和烟测注入，生产入口不导入此文件。
import { ADVENTURE_GENERATION_VERSION } from '../../shared/adventure-catalog.js';
import { createRoomWorld } from '../../shared/room-world.js';
import { newAdventure, newJourney } from '../../src/game/adventure.js';
import { newCombatLoot } from '../../src/game/combat-loot.js';
import { WORLD_ACTS } from '../../shared/levels.js';
import { newRoomState, enterDoor } from '../../src/game/rooms.js';
import { openRoomReward } from '../../src/game/room-rewards.js';
import { starterAdventure, recommendedStarter } from '../../src/game/starter-build.js';

function defeat(enemy, defeatedIds) {
  Object.assign(enemy, { hp: 0, isDefeated: true, isDormant: false, defeatedAt: 0 });
  defeatedIds.push(enemy.id);
}
// 把当前这间房算作清完：怪都打倒，记三颗星。
function clearRoom(world, rooms, defeatedIds) {
  const room = world.rooms[rooms.roomId];
  for (const id of room.enemyIds) defeat(world.enemies[id - 1], defeatedIds);
  if (room.bossId) defeat(world.enemies[room.bossId - 1], defeatedIds);
  rooms.cleared.push(room.id); rooms.stars[room.id] = 3;
  return room;
}
function firstDoor(world, room) { return world.doors.find(door => door.roomId === room.id); }

// 第 10 版选门闯房间的固定存档。mode 决定人站在哪儿、带着什么：
// door 开场房清完站在出口，不站在门上，恢复后不会马上被送走；stack 同上但叠了三把武器和限时道具；reward 开场房清完、奖励还没选；
// score 站在开场房一件宝物左边；loot、loot-pending 脚边有一份小怪掉的补给；fallen、over 血条耗尽；
// boss、boss-moon、boss-high 一路清到首领房；finish 首领打完站在终点；room 一路清到 roomId 那间房，站在它的起点。
export function roomFixture(mode = 'door', levelId = WORLD_ACTS[0].id, { seed = 42, roomId = 0 } = {}) {
  const world = createRoomWorld(seed, levelId), journey = newJourney(), key = `${levelId}:${seed}`;
  const isBossRoom = mode.startsWith('boss') || mode === 'finish', isDown = ['fallen', 'over'].includes(mode);
  const survival = newSurvival(isDown ? 'mom' : 'sister');
  const adventure = isBossRoom ? newAdventure(seed) : starterAdventure(seed, recommendedStarter(survival.character));
  adventure.ruleset = 9; adventure.difficulty = 'easy'; adventure.locked = [];
  if (['boss', 'boss-high', 'finish', 'stack'].includes(mode)) {
    adventure.weapons = ['blade', 'bubble', 'boomerang']; adventure.loadouts[0].weapons = [...adventure.weapons]; adventure.loadouts[0].weapon = adventure.weapons[0];
    adventure.growth = { collected: 3, power: 2, hearts: 3 }; adventure.effects = { rainbowBoost: 40 };
    survival.maxHp = 160; survival.hp = 140;
  }
  if (mode === 'stack') { adventure.upgrades = { frost: 1, chain: 1, double: 1, wide: 1, magnet: 1 }; adventure.loadouts[0].upgrades = Object.keys(adventure.upgrades); adventure.effects.frostTreat = 75; }

  const rooms = newRoomState(world), defeatedIds = [];
  // 一路走到要去的那间房：有门直通就走那扇，没有就走第一扇；路过的房间奖励都算领过。
  const targetId = isBossRoom ? world.rooms.at(-1).id : mode === 'room' ? roomId : 0;
  while (rooms.roomId !== targetId) {
    const passed = clearRoom(world, rooms, defeatedIds);
    journey.claimed.push(`room:${key}:${passed.id}`);
    enterDoor(world, rooms, world.doors.find(door => door.roomId === passed.id && door.targetRoomId === targetId) || firstDoor(world, passed));
  }
  const room = world.rooms[rooms.roomId], inRoom = platform => platform.roomId === room.id;
  let safeId = room.startId, safeX, doorKind, combatLoot, revival;
  if (mode === 'room') safeX = world.platforms[room.startId].x - 2;
  if (['door', 'stack', 'reward'].includes(mode)) {
    clearRoom(world, rooms, defeatedIds);
    const exit = world.platforms[room.exitId];
    safeId = exit.id; safeX = exit.x; doorKind = firstDoor(world, room).kind;
    if (mode === 'reward') openRoomReward(adventure, journey, survival, `room:${key}:${room.id}`, room.reward ? `door-${room.reward}` : 'door-upgrade', 'power');
    else journey.claimed.push(`room:${key}:${room.id}`);
  }
  if (mode === 'score') {
    // 站在一件宝物左边两步，往右走就能捡到。先挑没有怪和陷阱的平台，没有就退一步只要平台不动。
    const home = item => world.platforms[item.platformId];
    const reachable = world.treasures.filter(item => item.roomId === room.id && !home(item).isMoving && !home(item).isCrumbling && !home(item).isSeesaw && item.x - 2 > home(item).x - home(item).width / 2 + 0.4);
    const treasure = reachable.find(item => !world.enemies.some(enemy => enemy.platformId === item.platformId) && !world.hazards.some(hazard => hazard.platformId === item.platformId)) || reachable[0];
    safeId = treasure.platformId; safeX = treasure.x - 2;
  }
  if (mode.startsWith('loot')) {
    const enemy = world.enemies[room.enemyIds[0] - 1], platform = world.platforms[enemy.platformId];
    defeat(enemy, defeatedIds);
    const offsetX = Math.max(-platform.width / 2 + 0.5, Math.min(platform.width / 2 - 0.5, enemy.x - platform.x));
    combatLoot = newCombatLoot(); combatLoot.drops.push({ enemyId: enemy.id, platformId: platform.id, offsetX, choice: null });
    if (mode === 'loot-pending') combatLoot.pendingId = enemy.id;
    safeId = platform.id; safeX = platform.x + offsetX; survival.hp = 50;
  }
  if (isDown) {
    const platform = world.platforms.find(item => inRoom(item) && item.id !== room.startId && !item.isMoving && !item.isCrumbling && !item.isCheckpoint && !item.slope && !item.isSeesaw && item.width >= 5);
    safeId = platform.id; safeX = platform.x + 0.6; revival = { platformId: platform.id, offsetX: 0.6 };
    Object.assign(survival, { lives: mode === 'over' ? 0 : 2, attacks: 3, phase: mode, hp: 0 });
  }
  if (mode.startsWith('boss')) {
    const arena = world.bossArenas[0];
    safeId = arena.floorId; safeX = arena.left + (mode === 'boss-moon' ? 9 : 3);
    if (mode === 'boss-high') { const high = world.platforms.filter(platform => inRoom(platform) && platform.id !== arena.exitId).sort((a, b) => b.y - a.y)[0]; safeId = high.id; safeX = high.x; }
  }
  if (mode === 'finish') {
    clearRoom(world, rooms, defeatedIds);
    safeId = world.finish.id; safeX = world.finish.x;
  }
  const visited = world.zones.filter(zone => zone.id < room.depth || rooms.cleared.includes(room.id) && zone.id === room.depth).map(zone => zone.id + 1);
  const state = { version: ADVENTURE_GENERATION_VERSION, seed, levelId, elapsed: 20, isCompleted: false, survival, checkpointId: isDown ? world.start.id : safeId, collectedIds: [], defeatedIds, visited, switches: [],
    enemies: world.enemies, players: [{ safeId, safeX, protection: 2, recoveries: 0, facing: 1 }], adventure, journey, supplies: [], mechanisms: [], rooms };
  if (combatLoot) state.combatLoot = combatLoot;
  if (revival) state.revival = revival;
  const run = { id: crypto.randomUUID(), startedAt: new Date().toISOString(), levelId, players: 1, seed, scoringVersion: 3, generationVersion: ADVENTURE_GENERATION_VERSION, revision: 1, status: mode === 'over' ? 'ended' : 'paused',
    flowers: 0, collectedIds: [], defeatedIds, platform: visited.length, seconds: 20 };
  return { run, state, doorKind };
}
