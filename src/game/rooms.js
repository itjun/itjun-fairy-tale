import { DOOR_REWARDS, SHOP_STALLS, doorPosition, spotPosition } from '../../shared/room-world.js';

// 房间进度：在哪间房、第几波、门开没开、星星和连击。只由固定游玩步长推进，随局保存。
export const COMBO_WINDOW = 3;
export const COMBO_REWARD_EVERY = 3;
const CARD_CLOSE_SECONDS = 0.9;

function newPuzzle(room) {
  if (room.puzzle?.kind === 'tiles') return { step: 0, lastTile: -1 };
  if (room.puzzle?.kind === 'cards') return { open: [], matched: [], closeLeft: 0 };
  if (room.puzzle?.kind === 'keys') return { found: [] };
  return null;
}
export function newRoomState(world) {
  return { roomId: 0, wave: 0, path: [0], cleared: [], stars: {}, isHurt: false, isFallen: false, downs: 0, combo: 0, comboLeft: 0, drops: [], bought: [], puzzle: newPuzzle(world.rooms[0]) };
}
export function currentRoom(world, state) { return world.rooms[state.roomId]; }
export function isRoomCleared(state, roomId = state.roomId) { return state.cleared.includes(roomId); }
export function starTotal(state) { return Object.values(state.stars).reduce((sum, value) => sum + value, 0); }

// 挑战那一波只在挑战难度里算数。
function waveCount(room, isExtraWave) { return room.waves + (isExtraWave && room.hasChallenge ? 1 : 0); }
function waveEnemies(world, room, wave) { return room.enemyIds.map(id => world.enemies[id - 1]).filter(enemy => enemy.wave === wave); }
export function roomProgress(world, state, isExtraWave) {
  const room = currentRoom(world, state), total = waveCount(room, isExtraWave);
  const left = room.enemyIds.map(id => world.enemies[id - 1]).filter(enemy => enemy.wave <= state.wave && enemy.wave < total && !enemy.isDefeated).length
    + room.childIds.map(id => world.enemies[id - 1]).filter(enemy => !enemy.isDormant && !enemy.isDefeated).length;
  return { wave: Math.min(state.wave + 1, Math.max(1, total)), waves: total, left };
}

function stepPuzzle(world, room, puzzle, player, dt, events) {
  const definition = room.puzzle;
  if (definition.kind === 'tiles') {
    const tile = player.isGrounded ? definition.tiles.findIndex(item => item.platformId === player.ground?.id) : -1;
    if (player.isGrounded && tile !== puzzle.lastTile) {
      puzzle.lastTile = tile;
      if (tile < 0) return false;
      const color = definition.tiles[tile].color;
      if (color === definition.order[puzzle.step]) { puzzle.step++; events.push({ type: 'puzzle', isRight: true }); }
      else { puzzle.step = color === definition.order[0] ? 1 : 0; events.push({ type: 'puzzle', isRight: false }); }
    }
    return puzzle.step === definition.order.length;
  }
  if (definition.kind === 'cards') {
    if (puzzle.closeLeft > 0) {
      puzzle.closeLeft = Math.max(0, puzzle.closeLeft - dt);
      if (!puzzle.closeLeft) puzzle.open = [];
      return false;
    }
    // 往上跳、头顶到牌才翻，路过不会碰翻。
    const index = player.vy > 0 ? definition.cards.findIndex((card, n) => {
      const spot = spotPosition(world, card);
      return !puzzle.open.includes(n) && !puzzle.matched.includes(n) && Math.abs(player.x - spot.x) < 0.9 && player.y + 1.7 >= spot.y - 0.5 && player.y <= spot.y + 0.5;
    }) : -1;
    if (index < 0) return false;
    puzzle.open.push(index);
    if (puzzle.open.length < 2) { events.push({ type: 'puzzle', isRight: true }); return false; }
    const [first, second] = puzzle.open;
    if (definition.cards[first].face === definition.cards[second].face) { puzzle.matched.push(first, second); puzzle.open = []; events.push({ type: 'puzzle', isRight: true }); }
    else { puzzle.closeLeft = CARD_CLOSE_SECONDS; events.push({ type: 'puzzle', isRight: false }); }
    return puzzle.matched.length === definition.cards.length;
  }
  definition.keys.forEach((key, n) => {
    const spot = spotPosition(world, key);
    if (!puzzle.found.includes(n) && Math.abs(player.x - spot.x) < 0.9 && Math.abs(player.y + 0.9 - spot.y) < 1.3) { puzzle.found.push(n); events.push({ type: 'puzzle', isRight: true }); }
  });
  return puzzle.found.length === definition.keys.length;
}

export function dropPosition(world, room) {
  const exit = world.platforms[room.exitId];
  return { x: exit.x - 3.8, y: exit.y + 1.1 };
}

// 每个固定步长调用一次。返回这一步发生的事，发奖励、播声音都由引擎按事件去做。
export function stepRoom(world, state, player, dt, isExtraWave = false) {
  const events = [], room = currentRoom(world, state);
  state.comboLeft = Math.max(0, state.comboLeft - dt);
  if (!state.comboLeft) state.combo = 0;
  if (!isRoomCleared(state)) {
    const total = waveCount(room, isExtraWave);
    const isWaveDone = waveEnemies(world, room, state.wave).every(enemy => enemy.isDefeated);
    const isLastWave = state.wave + 1 >= total;
    if (isWaveDone && !isLastWave) {
      state.wave++;
      for (const enemy of waveEnemies(world, room, state.wave)) enemy.isDormant = false;
      events.push({ type: 'wave', wave: state.wave, total });
    }
    let isCleared = false;
    if (['battle', 'elite'].includes(room.kind)) isCleared = isWaveDone && isLastWave && room.childIds.every(id => { const child = world.enemies[id - 1]; return child.isDormant || child.isDefeated; });
    else if (room.kind === 'boss') isCleared = world.enemies[room.bossId - 1].isDefeated;
    else if (room.kind === 'puzzle') isCleared = stepPuzzle(world, room, state.puzzle, player, dt, events);
    else if (room.kind === 'shop') isCleared = true;
    else isCleared = player.isGrounded && player.ground?.id === room.exitId;
    if (isCleared) {
      state.cleared.push(room.id);
      state.stars[room.id] = 1 + Number(!state.isHurt) + Number(!state.isFallen);
      if (room.reward && !DOOR_REWARDS[room.reward].isChoice) state.drops.push({ roomId: room.id, kind: room.reward, isTaken: false });
      events.push({ type: 'clear', room, stars: state.stars[room.id] });
    }
  }
  const drop = state.drops.find(item => item.roomId === room.id && !item.isTaken);
  if (drop) {
    const spot = dropPosition(world, room);
    if (Math.abs(player.x - spot.x) < 1.3 && Math.abs(player.y + 0.9 - spot.y) < 2) { drop.isTaken = true; events.push({ type: 'drop', kind: drop.kind }); }
  }
  return events;
}

// 打倒一只怪记一次连击。每连 3 只返回 true，引擎发 1 片碎片。
export function recordCombo(state) {
  state.combo = state.comboLeft > 0 ? state.combo + 1 : 1;
  state.comboLeft = COMBO_WINDOW;
  return state.combo % COMBO_REWARD_EVERY === 0;
}
export function recordHurt(state, isFall, isDown) {
  if (isFall) state.isFallen = true; else state.isHurt = true;
  if (isDown) state.downs++;
}

export function doorAt(world, state, player) {
  if (!isRoomCleared(state) || !player.isGrounded) return null;
  return world.doors.find(door => door.roomId === state.roomId && player.ground?.id === door.platformId && Math.abs(player.x - doorPosition(world, door).x) < 1.4) || null;
}
export function enterDoor(world, state, door) {
  const room = world.rooms[door.targetRoomId];
  Object.assign(state, { roomId: room.id, wave: 0, isHurt: false, isFallen: false, downs: 0, puzzle: newPuzzle(room) });
  state.path.push(room.id);
  return room;
}
export function stallAt(world, state, player) {
  const room = currentRoom(world, state);
  if (room.kind !== 'shop' || !player.isGrounded) return null;
  return room.stalls.find(stall => player.ground?.id === stall.platformId && Math.abs(player.x - spotPosition(world, stall).x) < 1.5) || null;
}
export function isStallSold(state, stall) { return state.bought.includes(`${state.roomId}:${stall.id}`); }

export function isValidRoomState(state, world) {
  const isFlag = value => typeof value === 'boolean';
  const isCount = (value, max) => Number.isInteger(value) && value >= 0 && value <= max;
  if (!state || !Array.isArray(state.path) || !Array.isArray(state.cleared) || !Array.isArray(state.drops) || !Array.isArray(state.bought) || !state.stars || Array.isArray(state.stars)) return false;
  const room = world.rooms[state.roomId];
  if (!room || state.path[0] !== 0 || state.path.at(-1) !== state.roomId || state.path.length > world.zones.length) return false;
  if (state.path.some((id, index) => world.rooms[id]?.depth !== index)) return false;
  if (new Set(state.cleared).size !== state.cleared.length || state.cleared.some(id => !state.path.includes(id))) return false;
  // 只有当前这间可以还没清完。
  if (state.path.slice(0, -1).some(id => !state.cleared.includes(id))) return false;
  if (!isCount(state.wave, room.waves) || !isFlag(state.isHurt) || !isFlag(state.isFallen) || !isCount(state.downs, 999) || !isCount(state.combo, 100000)) return false;
  if (!Number.isFinite(state.comboLeft) || state.comboLeft < 0 || state.comboLeft > COMBO_WINDOW) return false;
  if (Object.entries(state.stars).some(([id, stars]) => !state.cleared.includes(Number(id)) || ![1, 2, 3].includes(stars)) || Object.keys(state.stars).length !== state.cleared.length) return false;
  if (new Set(state.drops.map(drop => drop.roomId)).size !== state.drops.length || state.drops.some(drop => !state.cleared.includes(drop.roomId) || world.rooms[drop.roomId].reward !== drop.kind || DOOR_REWARDS[drop.kind].isChoice || !isFlag(drop.isTaken))) return false;
  if (new Set(state.bought).size !== state.bought.length || state.bought.some(key => { const [id, stall] = String(key).split(':'); return world.rooms[id]?.kind !== 'shop' || !state.path.includes(Number(id)) || !SHOP_STALLS.includes(stall); })) return false;
  const puzzle = state.puzzle, definition = room.puzzle;
  if (!definition) return puzzle === null;
  const isIndexList = (list, size) => Array.isArray(list) && new Set(list).size === list.length && list.every(n => isCount(n, size - 1));
  if (!puzzle) return false;
  if (definition.kind === 'tiles') return isCount(puzzle.step, definition.order.length) && Number.isInteger(puzzle.lastTile) && puzzle.lastTile >= -1 && puzzle.lastTile < definition.tiles.length;
  if (definition.kind === 'cards') return isIndexList(puzzle.open, definition.cards.length) && puzzle.open.length <= 2 && isIndexList(puzzle.matched, definition.cards.length) && puzzle.matched.length % 2 === 0 && !puzzle.open.some(n => puzzle.matched.includes(n)) && Number.isFinite(puzzle.closeLeft) && puzzle.closeLeft >= 0 && puzzle.closeLeft <= CARD_CLOSE_SECONDS;
  return isIndexList(puzzle.found, definition.keys.length);
}
