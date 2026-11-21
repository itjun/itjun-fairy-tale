import { WORLD_ACTS } from '../../shared/levels.js';
import { createRoomWorld } from '../../shared/room-world.js';
import { GardenEngine } from '../../src/game/engine.js';
import { createPlayer } from '../../src/game/physics.js';
import { roomFixture } from './adventure-fixtures.mjs';

// 不起画面的引擎：从固定存档恢复，只跑规则。画面相关的东西用空壳顶上。
export function headless(mode = 'boss', levelId = WORLD_ACTS[0].id) {
  const fixture = roomFixture(mode, levelId), stage = WORLD_ACTS.find(act => act.id === levelId), world = createRoomWorld(fixture.run.seed, stage);
  const game = Object.assign(Object.create(GardenEngine.prototype), {
    world, platforms: world.platforms, stage, seed: fixture.run.seed, levelKey: `${levelId}:${fixture.run.seed}`,
    players: [createPlayer(world.start)], isPaused: false, keys: new Set(), touch: new Set(), gamepad: new Set(), jumps: [false],
    damageNumbers: [], damageSequence: 0, pickups: [], checkpoint: 0, distance: 0, rewardAt: 0, spellHits: 0, attackGate: { next: 0 },
    camera: { right: 24 }, cameraX: 0, cameraY: 0, skillEffects: { burst() {} },
    treasureViews: new Map(world.treasures.map(item => [item.id, { isCollected: false, kind: item.kind, mesh: { visible: true } }])),
    supplyViews: new Map(world.supplies.map(item => [item.id, { visible: true }])),
    callbacks: { onSound() {}, onUpdate() {}, onLifeChange() {}, onComplete() {}, onAlbum() {}, onReward() {} },
    snapshot() { return { survival: structuredClone(this.survival) }; }, publish() {},
  });
  game.restoreState(fixture.state);
  game.players[0].character = game.survival.character;
  return game;
}
// 按 1/120 秒一步往前跑，跑到条件成立或者时间用完。
export function run(game, seconds, isDone = () => false) {
  for (let step = 0; step < seconds * 120 && !isDone(); step++) { game.elapsed += 1 / 120; game.tick(); }
}
