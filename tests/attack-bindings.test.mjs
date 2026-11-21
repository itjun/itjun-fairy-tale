import test from 'node:test';
import assert from 'node:assert/strict';
import { SPELLS } from '../shared/combat-catalog.js';
import { carryToNextWorld } from '../shared/adventure-cycle.js';
import { bindAttack, wheelSector } from '../src/game/attack-bindings.js';
import { weaponPressure } from '../src/game/adventure.js';
import { readAdventure, writeAdventure } from '../src/game/save.js';
import { roomFixture } from './helpers/adventure-fixtures.mjs';
import { headless, run } from './helpers/headless-engine.mjs';

function timedInput(game, actions, seconds = .02) {
  game.setGamepadInput({ actions: new Set(actions), direction: 0 });
  run(game, seconds);
}
function teachSpell(adventure, id) {
  const magic = adventure.magic;
  magic.ranks[id] = 1; magic.equipped.push(id);
  magic.charges[id] = SPELLS[id].charge; magic.ready.push(id);
}
function storage() {
  const map = new Map();
  return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) };
}

test('直接指向圆环每一格，摇杆回中不选中任何一格', () => {
  for (const count of [1, 2, 5, 6, 8]) {
    for (let slot = 0; slot < count; slot++) {
      const angle = 2 * Math.PI * slot / count;
      assert.equal(wheelSector(Math.sin(angle), -Math.cos(angle), count), slot);
    }
  }
  assert.equal(wheelSector(.19, -.08, 6), -1);
});

test('旧档以旧主武器优先填槽，交换保留其余攻法与充能，坏数据不能读入', () => {
  const { run: score, state } = roomFixture('stack'), mem = storage(), a = state.adventure;
  delete a.attackBindings;
  a.loadouts[0].weapon = 'boomerang';
  teachSpell(a, 'snow');
  writeAdventure(score, state, mem);
  const loaded = readAdventure(mem);
  assert.deepEqual(loaded.state.adventure.attackBindings, ['boomerang', 'blade', 'bubble']);
  const adventure = loaded.state.adventure;
  assert.ok(bindAttack(adventure, 2, 'snow'));
  assert.ok(bindAttack(adventure, 1, 'snow'));
  assert.deepEqual(adventure.attackBindings, ['boomerang', 'snow', 'blade']);
  assert.equal(adventure.magic.charges.snow, SPELLS.snow.charge);
  assert.ok(adventure.weapons.includes('bubble'));
  assert.deepEqual(carryToNextWorld(adventure, 2, 9).attackBindings, adventure.attackBindings);
  for (const invalid of [['bow', 'snow', 'blade'], ['snow', null, 'snow'], [], [null, null, null]]) {
    writeAdventure(score, { ...loaded.state, adventure: { ...adventure, attackBindings: invalid } }, mem);
    assert.equal(readAdventure(mem), null);
  }
});

test('实战同时按 X/Y/B 只发 X，途中换装与读档仍由同一轮弹道和冷却锁定', () => {
  const game = headless('room'), a = game.adventure;
  game.survival.character = 'dad';
  a.weapons.push('moonblade', 'lightblade'); teachSpell(a, 'snow');
  a.attackBindings = ['moonblade', 'lightblade', 'snow'];
  const sounds = [];
  game.callbacks.onSound = sound => sounds.push(sound);
  timedInput(game, ['attack', 'spell', 'back']);
  assert.deepEqual(sounds.filter(sound => /:(fire|cast)$/.test(sound)), ['moonblade:fire']);
  timedInput(game, ['back'], .1);
  assert.equal(a.magic.active.length, 0);

  game.pause(true);
  assert.ok(game.equipAttack(0, 'lightblade'));
  assert.deepEqual(a.attackBindings, ['lightblade', 'moonblade', 'snow']);
  const score = roomFixture('room').run, mem = storage();
  writeAdventure(score, game.exportState(), mem);
  const loaded = readAdventure(mem);
  const restored = headless('room');
  restored.restoreState(loaded.state);
  assert.deepEqual(restored.adventure.attackBindings, a.attackBindings);
  assert.ok(restored.players[0].nextAttackAt > restored.elapsed);
  timedInput(restored, ['attack'], .05);
  assert.deepEqual(restored.waves.map(wave => wave.firingWeapon), ['moonblade']);
  timedInput(restored, ['attack'], 3);
  assert.equal(restored.waves.length, 0, '锁定期间按下的另一把武器不会补发');
  timedInput(restored, []);
  timedInput(restored, ['attack']);
  assert.ok(restored.waves.some(wave => wave.firingWeapon === 'lightblade'));
});

test('B 只施放自己绑定的已蓄满大招，施法期间 X 与另一种大招都不能出手', () => {
  const game = headless('room'), a = game.adventure;
  teachSpell(a, 'snow'); teachSpell(a, 'fire');
  a.attackBindings = ['stars', 'fire', 'snow'];
  const sounds = [];
  game.callbacks.onSound = sound => sounds.push(sound);
  timedInput(game, ['back']);
  assert.deepEqual(a.magic.active.map(effect => effect.id), ['snow']);
  assert.deepEqual(a.magic.ready, ['fire']);
  timedInput(game, []);
  timedInput(game, ['attack', 'spell'], 1.3);
  assert.deepEqual(sounds.filter(sound => /:(fire|cast)$/.test(sound)), ['snow:cast']);
  timedInput(game, [], 1.8);
  timedInput(game, ['spell']);
  assert.deepEqual(a.magic.active.map(effect => effect.id), ['fire']);
});

test('首领开战按已绑单招估算，未绑定库存和战中换装不改变血量', () => {
  const game = headless('boss-moon'), a = game.adventure;
  const startPressure = weaponPressure(a);
  a.weapons.push('lightblade', 'flame');
  a.weaponRanks.lightblade = 8;
  assert.equal(weaponPressure(a), startPressure);
  run(game, .5);
  const boss = game.world.enemies.find(enemy => enemy.isBoss);
  assert.ok(!boss.isDormant && boss.elapsed > 0);
  const maxHp = boss.maxHp;
  game.pause(true);
  assert.ok(game.equipAttack(0, 'lightblade'));
  assert.ok(weaponPressure(a) > startPressure);
  game.pause(false);
  run(game, .5);
  assert.equal(boss.maxHp, maxHp);
});
