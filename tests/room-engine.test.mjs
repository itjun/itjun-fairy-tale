import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_ACTS } from '../shared/levels.js';
import { createRoomWorld, doorPosition, spotPosition } from '../shared/room-world.js';
import { GardenEngine } from '../src/game/engine.js';
import { newJourney } from '../src/game/adventure.js';
import { openRoomReward } from '../src/game/room-rewards.js';
import { starterAdventure, recommendedStarter } from '../src/game/starter-build.js';
import { newSurvival } from '../src/game/characters.js';
import { resourcesFor } from '../src/game/expedition.js';
import { createPlayer } from '../src/game/physics.js';
import { newRoomState, dropPosition, isValidRoomState, isRoomCleared } from '../src/game/rooms.js';

// 不起画面，只拿引擎里管房间的那几段来跑。
function engine({ seed = 42, act = WORLD_ACTS[0], difficulty = 'normal', locked } = {}) {
  const world = createRoomWorld(seed, act), log = { sounds: [], messages: [], album: [], rewards: 0, pauses: 0 };
  const game = Object.assign(Object.create(GardenEngine.prototype), {
    world, platforms: world.platforms, players: [createPlayer(world.start)], roomState: newRoomState(world), adventure: starterAdventure(seed, recommendedStarter('sister')),
    journey: newJourney(), survival: newSurvival('sister'), levelKey: `${act.id}:${seed}`, elapsed: 5, rewardAt: 0, isPaused: false, isInteracting: false, waves: [{}], enemyShots: [{}],
    camera: { right: 16 }, cameraX: 0, cameraY: 0, skillEffects: { burst() {} },
    callbacks: { onSound: name => log.sounds.push(name), onAlbum: event => log.album.push(event), onReward: () => log.rewards++, onLifeChange() {} },
    publish(message) { if (message) log.messages.push(message); }, pause() { this.isPaused = true; log.pauses++; }, snapshot() { return {}; },
  });
  game.applyRoomRules(difficulty, locked);
  return { game, world, log, player: game.players[0] };
}
const step = game => game.stepRooms(game.players[0], {});
const stand = (game, platform, x = platform.x) => Object.assign(game.players[0], createPlayer(platform, x - platform.x));
const land = (game, world, door) => {
  const platform = world.platforms[door.platformId];
  stand(game, platform, doorPosition(world, door).x);
  step(game);
};
function clearIntro(game, world) {
  stand(game, world.platforms[world.rooms[0].exitId]); step(game);
  game.elapsed += 1; step(game);
}

test('新冒险记下难度和画册里还锁着的东西', () => {
  const { game } = engine({ difficulty: 'hard', locked: ['weapon:seed'] });
  assert.deepEqual([game.adventure.ruleset, game.adventure.difficulty, game.adventure.locked], [9, 'hard', ['weapon:seed']]);
  assert.equal(game.difficulty.isExtraWave, true);
  game.applyRoomRules('easy');
  assert.equal(game.adventure.difficulty, 'hard', '难度出发后不再变');
  const easy = engine({ difficulty: 'easy' });
  assert.equal(easy.world.warningBonus, 0.6);
  assert.equal(easy.world.enemies.filter(enemy => !enemy.isBoss).every(enemy => Math.abs(enemy.period - enemy.basePeriod * 1.15) < 1e-9), true);
  easy.game.applyRoomRules();
  assert.equal(easy.world.enemies.filter(enemy => !enemy.isBoss).every(enemy => Math.abs(enemy.period - enemy.basePeriod * 1.15) < 1e-9), true, '读档再套一次不会越放越慢');
});

test('清完开场房不弹选卡，跳到发光的门上才进下一间', () => {
  const { game, world, log } = engine();
  step(game);
  assert.equal(game.journey.pending, null);
  stand(game, world.platforms[world.rooms[0].exitId]); step(game);
  assert.equal(isRoomCleared(game.roomState), true);
  assert.deepEqual(log.album, [{ type: 'stars', count: 3 }]);
  game.elapsed += 1; step(game);
  assert.equal(game.journey.pending, null, '开场房不给选卡');
  assert.deepEqual([log.pauses, log.rewards], [0, 0]);
  assert.equal(game.roomState.roomId, 0, '站在出口上不会自动进门');
  const door = world.doors.find(item => item.roomId === 0);
  land(game, world, door);
  assert.equal(game.roomState.roomId, door.targetRoomId);
});

test('跳到门上进下一间：人到新房间起点，镜头只看这一间，旧子弹清掉', () => {
  const { game, world, player } = engine();
  clearIntro(game, world);
  const exit = world.platforms[world.rooms[0].exitId], door = world.doors.filter(item => item.roomId === 0)[1];
  stand(game, exit, exit.x - exit.width / 2 + 0.6);
  assert.equal(game.canInteract(), false);
  game.isInteracting = true; step(game);
  assert.equal(game.roomState.roomId, 0, '没跳到门上不会进');
  assert.equal(game.roomSnapshot().prompt, '');
  assert.equal(game.roomSnapshot().doors.some(item => item.name || item.reward), false, '门上不写后面是什么');
  land(game, world, door);
  const room = world.rooms[door.targetRoomId], start = world.platforms[room.startId];
  assert.equal(game.roomState.roomId, room.id);
  assert.equal(player.ground, start);
  assert.equal(player.recoveries, 0, '进门不算掉坑');
  assert.deepEqual([game.waves, game.enemyShots, game.checkpointId], [[], [], start.id]);
  assert.deepEqual(game.roomBounds(), { minX: room.left + 0.3, maxX: room.right - 0.3, minY: room.fallY });
  for (const x of [room.left + 1, (room.left + room.right) / 2, room.right - 1]) {
    player.x = x;
    const target = game.cameraTarget();
    assert.ok(target.x - game.camera.right >= room.left - 3.01 && target.x + game.camera.right <= room.right + 3.01 || room.right - room.left < game.camera.right * 2 - 6, `镜头 ${target.x} 出了房间`);
  }
  const view = game.roomSnapshot();
  assert.deepEqual([view.roomId, view.depth, view.isCleared], [room.id, 1, false]);
  assert.deepEqual(view.layers.map(layer => layer.kind), ['intro', room.kind, null, null, 'boss']);
  assert.equal(view.layers[0].stars, 3);
  assert.equal(isValidRoomState(structuredClone(game.roomState), world), true);
});

test('掉在门边的爱心、碎片和贴纸各有各的用处', () => {
  for (const [kind, check] of [
    ['heart', ({ game }) => assert.equal(game.survival.hp, 90)],
    ['fragments', ({ game }) => assert.equal(resourcesFor(game.adventure).balance, 6)],
    ['sticker', ({ log }) => assert.deepEqual(log.album.filter(event => event.type === 'gift'), [{ type: 'gift' }])],
  ]) {
    let found = null;
    for (let seed = 1; seed < 80 && !found; seed++) for (const act of WORLD_ACTS) {
      const run = engine({ seed, act }), room = run.world.rooms.find(item => item.depth === 1 && item.kind === 'mechanism' && item.reward === kind);
      if (room) { found = { ...run, room }; break; }
    }
    const { game, world, room } = found;
    clearIntro(game, world);
    resourcesFor(game.adventure).balance = 0;
    land(game, world, world.doors.find(door => door.targetRoomId === room.id));
    game.survival.hp = 40;
    const exit = world.platforms[room.exitId];
    stand(game, exit, exit.x + 4); step(game);
    assert.equal(game.journey.pending, null, '这种门不弹三选一');
    stand(game, exit, dropPosition(world, room).x); step(game);
    check(found);
    game.elapsed += 2; step(game);
    assert.equal(game.journey.pending, null);
  }
});

test('小店站到摊位前按上买，卖完和碎片不够都有话说', () => {
  let found = null;
  for (let seed = 1; seed < 200 && !found; seed++) {
    const run = engine({ seed }), room = run.world.rooms.find(item => item.depth === 1 && item.kind === 'shop');
    if (room) found = { ...run, room };
  }
  const { game, world, room, log } = found;
  clearIntro(game, world);
  land(game, world, world.doors.find(door => door.targetRoomId === room.id));
  const stall = room.stalls.find(item => item.id === 'reroll');
  stand(game, world.platforms[stall.platformId], spotPosition(world, stall).x);
  resourcesFor(game.adventure).balance = 0;
  assert.equal(game.roomSnapshot().prompt, '买重抽券');
  game.isInteracting = true; step(game);
  assert.match(log.messages.at(-1), /碎片不够/);
  resourcesFor(game.adventure).balance = 20;
  game.isInteracting = true; step(game);
  assert.equal(resourcesFor(game.adventure).rerolls, 1);
  assert.equal(resourcesFor(game.adventure).balance, 15);
  game.isInteracting = true; step(game);
  assert.equal(log.messages.at(-1), '这个摊位卖完了。');
  assert.equal(game.roomSnapshot().prompt, '卖完了');
  assert.equal(resourcesFor(game.adventure).balance, 15);
});

test('选奖励时用重抽券换一批，重复点不多扣', () => {
  const { game } = engine();
  openRoomReward(game.adventure, game.journey, game.survival, 'room:test', 'door-upgrade', 'power');
  game.isPaused = true;
  const id = game.journey.pending.id, before = structuredClone(game.journey.pending.choices);
  assert.equal(game.rerollPending(id), false, '没有券');
  resourcesFor(game.adventure).rerolls = 1;
  assert.equal(game.rerollPending('别的奖励'), false);
  assert.equal(game.rerollPending(id), true);
  assert.notDeepEqual(game.journey.pending.choices, before);
  assert.equal(game.rerollPending(id), false);
  assert.equal(resourcesFor(game.adventure).rerolls, 0);
});
