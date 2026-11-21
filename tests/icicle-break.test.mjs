import test from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS } from '../shared/adventure-catalog.js';
import { fireAdventureWeapon, stepAdventureWave } from '../src/game/adventure-combat.js';
import { starterAdventure } from '../src/game/starter-build.js';
import { hazardState, icicleTargets, touchingHazard } from '../src/game/hazards.js';
import { rescue } from '../src/game/physics.js';
import { readAdventure, writeAdventure } from '../src/game/save.js';
import { roomFixture } from './helpers/adventure-fixtures.mjs';
import { headless, run } from './helpers/headless-engine.mjs';

const level = 'snow-world';

function scenario(weapon, phase = .9) {
  const game = headless('room', level);
  const player = game.players[0];
  const ice = game.world.hazards.find(hazard => hazard.kind === 'icicle' && !game.platforms[hazard.platformId].slope);
  game.adventure = starterAdventure(game.seed, { weapons: [weapon], upgrades: [] });
  game.world.enemies.forEach(enemy => { enemy.isDormant = true; });
  rescue(player, game.platforms[ice.platformId], ice.x - 2);
  game.snapCamera();
  game.elapsed = ice.period * 3 - ice.phase + ice.warning + ice.active * phase;
  return { game, player, ice };
}

test('近战光刀和每种远程武器都能打碎下落冰锥，无怪物奖励', () => {
  for (const weapon of Object.keys(WEAPONS)) {
    const { game, ice } = scenario(weapon);
    const before = { defeated: [...game.defeatedIds], combo: game.roomState.combo };
    const elapsed = game.elapsed;
    const sounds = [];
    game.callbacks.onSound = sound => sounds.push(sound);
    assert.equal(hazardState(ice, elapsed).isActive, true);
    game.setTouch('attack', true);
    run(game, .12);
    assert.equal(hazardState(ice, elapsed).isActive, false, weapon);
    assert.equal(touchingHazard({ x: ice.x, y: ice.y, protection: 0 }, ice, elapsed), false, weapon);
    assert.ok(sounds.includes(`${weapon}:hit`), weapon);
    assert.deepEqual(game.defeatedIds, before.defeated, weapon);
    assert.equal(game.roomState.combo, before.combo, weapon);
  }
});

test('挥斩能打掉悬挂中的冰锥，破坏状态随第 11 版存档恢复', () => {
  const { game, ice, player } = scenario('lightblade', -0.5);
  const warningAt = game.elapsed;
  player.y = ice.y + 3.25; player.isGrounded = false; player.ground = null;
  assert.equal(hazardState(ice, warningAt).isWarning, true);
  game.setTouch('attack', true);
  run(game, .08);
  assert.equal(hazardState(ice, warningAt).isWarning, false);

  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  const { run: savedRun } = roomFixture('room', level);
  const savedState = game.exportState();
  const { brokenIcicles, ...oldState } = savedState;
  assert.deepEqual(brokenIcicles, [ice.id]);
  writeAdventure(savedRun, oldState, storage);
  assert.ok(readAdventure(storage), '没有冰锥记录的旧存档仍可读取');
  const otherHazard = game.world.hazards.find(hazard => hazard.kind === 'block');
  writeAdventure(savedRun, { ...oldState, brokenIcicles: [otherHazard.id] }, storage);
  assert.equal(readAdventure(storage), null, '其他陷阱不能记为冰锥');
  writeAdventure(savedRun, savedState, storage);
  const restored = headless('room', level);
  restored.restoreState(readAdventure(storage).state);
  assert.equal(hazardState(restored.world.hazards[ice.id], warningAt + ice.period).isWarning, false);
  assert.equal(hazardState(restored.world.hazards[ice.id], warningAt).isWarning, false);
});

test('远程光刃只碰到路径上的第一个目标，隐藏的冰锥不挡弹道', () => {
  const { game, ice, player } = scenario('blade');
  player.x = ice.x - 5;
  const bounds = { left: player.x - 20, right: player.x + 20 };
  const fire = () => fireAdventureWeapon({ ...player, nextShot: 0 }, game.elapsed, bounds, 'blade')[0];
  const enemy = { id: 1, x: ice.x - 2, y: player.y, width: 1, height: 1.55, hp: 16, combatVersion: 2 };
  const iceInPlay = icicleTargets(game.world, game.roomState.roomId, game.elapsed);
  assert.ok(iceInPlay.some(target => target.hazard === ice));
  const first = stepAdventureWave(fire(), [enemy], [], .3, game.elapsed, player, [], iceInPlay);
  assert.deepEqual(first.hits.map(hit => hit.enemy.id), [enemy.id]);
  assert.equal(ice.isBroken, false);

  const hiddenAt = game.elapsed + ice.active;
  const iceOutOfPlay = icicleTargets(game.world, game.roomState.roomId, hiddenAt);
  assert.ok(iceOutOfPlay.every(target => target.hazard !== ice));
  const second = fire();
  stepAdventureWave(second, [], [], .3, hiddenAt, player, [], iceOutOfPlay);
  assert.ok(second.x > ice.x);
  assert.equal(ice.isBroken, false);
});
