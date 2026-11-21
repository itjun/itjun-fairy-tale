import test from 'node:test';
import assert from 'node:assert/strict';
import { difficultyOf } from '../src/game/difficulty.js';
import { landingDamage } from '../src/game/physics.js';
import { headless, run } from './helpers/headless-engine.mjs';

function flatGround(difficulty = 'normal') {
  const game = headless('room');
  game.difficulty = difficultyOf(difficulty);
  game.platforms = [game.world.start];
  for (const enemy of game.world.enemies) enemy.isDormant = true;
  game.world.hazards = [];
  game.world.treasures = [];
  game.world.springs = [];
  const player = game.players[0];
  function drop(height) {
    Object.assign(player, { y: height, vy: 0, isGrounded: false, ground: null });
    run(game, 2, () => player.isGrounded);
    assert.equal(player.ground, game.world.start);
  }
  return { game, player, drop };
}

function equip(game, id) {
  game.adventure.upgrades[id] = 1;
  game.adventure.loadouts[0].upgrades.push(id);
}

test('落地按实际高度扣血，轻松档减半，同一次落地只结算一次', () => {
  const normal = flatGround();
  normal.drop(8.5);
  assert.equal(normal.game.survival.hp, 100);
  normal.drop(12);
  assert.equal(normal.game.survival.hp, 86);
  normal.drop(18);
  assert.equal(normal.game.survival.hp, 48);
  run(normal.game, 1);
  assert.equal(normal.game.survival.hp, 48);
  assert.equal(normal.game.survival.lives, 3);
  assert.equal(normal.game.roomState.isHurt, true);
  assert.equal(normal.game.roomState.isFallen, false);

  const easy = flatGround('easy');
  easy.drop(18);
  assert.equal(easy.game.survival.hp, 81);
  assert.equal(easy.game.damageNumbers.at(-1).damage, 19);
});

test('血条扣空只少一条命，在实际落地处继续', () => {
  const { game, player, drop } = flatGround();
  player.safe = { ...game.world.start, id: 999, y: 18 };
  game.survival.hp = 10;
  drop(18);
  assert.equal(game.survival.phase, 'fallen');
  assert.equal(game.survival.lives, 2);
  assert.equal(game.revival.platformId, game.world.start.id);
  run(game, 1);
  assert.equal(game.survival.lives, 2);
  assert.ok(game.revive());
  assert.equal(game.survival.hp, 100);
  assert.equal(player.y, game.world.start.y);
});

test('妹妹平地二段跳安全，安稳落脚减伤，轻羽缓落能避免撞击伤害', () => {
  const jumping = flatGround();
  jumping.player.character = 'little';
  jumping.game.jumps[0] = true;
  run(jumping.game, .65);
  jumping.game.jumps[0] = true;
  run(jumping.game, 2, () => jumping.player.isGrounded);
  assert.equal(jumping.game.survival.hp, 100);

  const soft = flatGround();
  equip(soft.game, 'safeLanding');
  soft.drop(18);
  assert.equal(soft.game.survival.hp, 100 - landingDamage(18) / 2);

  const feather = flatGround();
  equip(feather.game, 'feather');
  feather.game.keys.add('Space');
  Object.assign(feather.player, { y: 18, vy: 0, isGrounded: false, ground: null });
  run(feather.game, 7, () => feather.player.isGrounded);
  assert.ok(feather.player.isGrounded);
  assert.equal(feather.game.survival.hp, 100);
});
