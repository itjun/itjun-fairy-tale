import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_ACTS } from '../shared/levels.js';
import { UPGRADES } from '../shared/adventure-catalog.js';
import { SPELLS, ROOM_TIERS, RARITY_FRAGMENTS } from '../shared/combat-catalog.js';
import { newJourney, chooseReward, upgradePower, isValidJourney, isValidAdventure } from '../src/game/adventure.js';
import { starterAdventure, recommendedStarter } from '../src/game/starter-build.js';
import { newSurvival } from '../src/game/characters.js';
import { resourcesFor } from '../src/game/expedition.js';
import { newRoomState } from '../src/game/rooms.js';
import { createRoomWorld } from '../shared/room-world.js';
import { doorChoices, openRoomReward, rerollReward, buyStall, canBuy, SHOP_ITEMS, TIER_TITLES } from '../src/game/room-rewards.js';
import { SETS, SET_STEPS, setCounts, setLevel } from '../src/game/sets.js';
import { damageEnemy } from '../src/game/combat.js';
import { stepBosses, bossStatus, isValidBossState, WEAK_SECONDS } from '../src/game/bosses.js';
import { stepMagic, newMagic, CHARGE_PER_HIT } from '../src/game/magic.js';
import { createPlayer } from '../src/game/physics.js';

function run(seed = 42) {
  const adventure = starterAdventure(seed, recommendedStarter('sister'));
  adventure.ruleset = 9;
  return { adventure, journey: newJourney(), survival: newSurvival('sister') };
}
const WORLD = createRoomWorld(42, WORLD_ACTS[0]);
const withFamily = (adventure, family, count) => {
  for (const id of Object.keys(UPGRADES).filter(key => UPGRADES[key].family === family && !UPGRADES[key].weapon).slice(0, count)) adventure.upgrades[id] = 1;
};

test('门上写哪一类，三张卡就出哪一类；同一间房重开不换卡', () => {
  const { adventure, survival } = run();
  assert.deepEqual(Object.keys(TIER_TITLES), ROOM_TIERS);
  for (let room = 0; room < 30; room++) {
    const id = `room:test:${room}`;
    const weapons = doorChoices(adventure, id, 'door-weapon', survival), upgrades = doorChoices(adventure, id, 'door-upgrade', survival), spells = doorChoices(adventure, id, 'door-spell', survival);
    assert.deepEqual(doorChoices(adventure, id, 'door-weapon', survival), weapons);
    for (const choices of [weapons, upgrades, spells]) {
      assert.equal(choices.length, 3);
      assert.equal(new Set(choices.map(choice => `${choice.type}:${choice.id}`)).size, 3, '三张不重样');
      assert.equal(choices.every(choice => ['common', 'rare', 'epic'].includes(choice.rarity)), true, '普通的门不出传奇');
    }
    assert.equal(weapons.every(choice => choice.type === 'weapon'), true);
    assert.equal(upgrades.every(choice => choice.type === 'upgrade'), true);
    assert.equal(spells.filter(choice => choice.type === 'spell').length, 2);
    const elite = doorChoices(adventure, id, 'elite', survival), boss = doorChoices(adventure, id, 'boss', survival);
    assert.equal(elite[0].rarity, 'epic');
    assert.equal(boss[0].rarity, 'legendary');
    assert.equal(boss[1].rarity, 'epic');
  }
});

test('画册里没解锁的东西不进奖励池', () => {
  const { adventure, survival } = run();
  adventure.locked = ['weapon:boomerang', 'weapon:seed', 'upgrade:wreath', 'spell:thunder'];
  assert.equal(isValidAdventure(adventure, 1), true);
  for (let room = 0; room < 60; room++) for (const tier of ROOM_TIERS) {
    const keys = doorChoices(adventure, `room:lock:${room}`, tier, survival).map(choice => `${choice.type}:${choice.id}`);
    assert.equal(keys.some(key => adventure.locked.includes(key)), false, keys.join(' '));
  }
  adventure.locked = ['weapon:../x'];
  assert.equal(isValidAdventure(adventure, 1), false);
});

test('挑战难度的好运让高品质多起来', () => {
  const { adventure, survival } = run();
  const count = rarityBonus => { let total = 0; for (let room = 0; room < 200; room++) total += doorChoices(adventure, `room:luck:${room}`, 'door-upgrade', survival, { rarityBonus }).filter(choice => choice.rarity !== 'common').length; return total; };
  assert.ok(count(0.2) > count(0) * 1.25);
});

test('手里哪一系最多，本领门的第一张就给那一系', () => {
  const { adventure, survival } = run();
  adventure.upgrades = {}; withFamily(adventure, 'frost', 2);
  for (let room = 0; room < 20; room++) assert.equal(UPGRADES[doorChoices(adventure, `room:set:${room}`, 'door-upgrade', survival)[0].id].family, 'frost');
});

test('清房奖励要主动选，领一次；品质高的多给碎片', () => {
  const { adventure, journey, survival } = run();
  const pending = openRoomReward(adventure, journey, survival, 'room:a:1', 'door-upgrade', 'power');
  assert.equal(pending.title, '选一个本领');
  assert.equal(isValidJourney(journey, 1), true);
  assert.equal(openRoomReward(adventure, journey, survival, 'room:a:2', 'door-weapon', 'power'), pending, '没选完不开下一份');
  pending.choices[0].rarity = 'epic';
  const before = resourcesFor(adventure).balance, id = pending.choices[0].id;
  assert.equal(chooseReward(adventure, journey, 0, survival), true);
  assert.equal(adventure.upgrades[id], 1);
  assert.equal(resourcesFor(adventure).balance, before + RARITY_FRAGMENTS.epic);
  assert.equal(journey.pending, null);
  assert.deepEqual(journey.claimed, ['room:a:1']);
  assert.equal(openRoomReward(adventure, journey, survival, 'room:a:1', 'door-upgrade', 'power'), null, '领过的不再给');
  assert.equal(chooseReward(adventure, journey, 0, survival), false);
});

test('重抽券换一批卡，升一档把这次的品质都抬高', () => {
  const { adventure, journey, survival } = run();
  openRoomReward(adventure, journey, survival, 'room:b:1', 'door-upgrade', 'power');
  assert.equal(rerollReward(adventure, journey, survival), false, '没有券不能重抽');
  resourcesFor(adventure).rerolls = 1;
  const before = structuredClone(journey.pending.choices);
  assert.equal(rerollReward(adventure, journey, survival), true);
  assert.notDeepEqual(journey.pending.choices, before);
  assert.equal(journey.pending.rerolls, 1);
  assert.equal(resourcesFor(adventure).rerolls, 0);
  assert.equal(isValidJourney(journey, 1), true);
  assert.equal(rerollReward(adventure, journey, survival), false);
  chooseReward(adventure, journey, 0, survival);

  const plain = doorChoices(adventure, 'room:b:2', 'door-weapon', survival);
  resourcesFor(adventure).tierUp = 1;
  const raised = openRoomReward(adventure, journey, survival, 'room:b:2', 'door-weapon', 'power').choices;
  const order = ['common', 'rare', 'epic', 'legendary'];
  assert.deepEqual(raised.map(choice => order.indexOf(choice.rarity)), plain.map(choice => order.indexOf(choice.rarity) + 1));
  assert.equal(resourcesFor(adventure).tierUp, 0);
});

test('小店每个摊位只卖一次，碎片不够或用不上就不卖', () => {
  const { adventure, survival } = run();
  const world = createRoomWorld(42, WORLD_ACTS[0]), state = newRoomState(world), resources = resourcesFor(adventure);
  assert.equal(buyStall(adventure, survival, state, 'heal'), '', '没有碎片');
  resources.balance = 40;
  assert.equal(canBuy(adventure, survival, 'heal'), false, '血是满的');
  survival.hp = 30;
  assert.equal(buyStall(adventure, survival, state, 'heal'), '回血 +50！');
  assert.equal(survival.hp, 80);
  assert.equal(resources.balance, 40 - SHOP_ITEMS.heal.price);
  survival.hp = 30;
  assert.equal(buyStall(adventure, survival, state, 'heal'), '', '这个摊位卖过了');
  const owned = Object.keys(adventure.upgrades).length;
  assert.match(buyStall(adventure, survival, state, 'skill'), /^学会了/);
  assert.equal(Object.keys(adventure.upgrades).length, owned + 1);
  assert.ok(buyStall(adventure, survival, state, 'reroll'));
  assert.ok(buyStall(adventure, survival, state, 'tierUp'));
  assert.deepEqual([resources.rerolls, resources.tierUp], [1, 1]);
  assert.equal(resources.balance, 40 - 4 - 8 - 5 - 10);
  assert.deepEqual(state.bought, ['0:heal', '0:skill', '0:reroll', '0:tierUp']);
  assert.equal(isValidAdventure(adventure, 1), true);
});

test('同系本领凑 3 个和 5 个各升一档，只在第 9 版规则里生效', () => {
  assert.deepEqual(SET_STEPS, [3, 5]);
  assert.deepEqual(Object.keys(SETS), ['power', 'bubble', 'flight', 'frost', 'nature']);
  const { adventure } = run();
  adventure.upgrades = {}; adventure.loadouts[0].upgrades = [];
  withFamily(adventure, 'power', 2);
  assert.equal(setLevel(adventure, 'power'), 0);
  const base = upgradePower(adventure).attackGrowth || 0;
  withFamily(adventure, 'power', 3);
  assert.equal(setCounts(adventure).power, 3);
  assert.equal(setLevel(adventure, 'power'), 1);
  assert.equal(upgradePower(adventure).attackGrowth, base + 1.5);
  withFamily(adventure, 'power', 5);
  assert.equal(setLevel(adventure, 'power'), 2);
  assert.equal(upgradePower(adventure).attackGrowth, base + 3);
  withFamily(adventure, 'flight', 3);
  assert.equal(upgradePower(adventure).rapid, 0.62);
  delete adventure.ruleset;
  assert.equal(setLevel(adventure, 'power'), 0, '旧冒险不吃套装');
  assert.equal(upgradePower(adventure).attackGrowth || 0, base);
});

test('首领先只用一招，半血后两招轮着来；放完招露出破绽，这时打中翻倍', () => {
  const world = createRoomWorld(42, WORLD_ACTS[2]), arena = world.bossArenas[0], boss = world.enemies[arena.bossId - 1];
  const player = createPlayer(world.platforms[arena.floorId]), shots = [];
  let elapsed = 0;
  const until = stage => { for (let frame = 0; frame < 120 * 12 && boss.attackStage !== stage; frame++) { elapsed += 1 / 120; stepBosses(world, player, 1 / 120, elapsed, shots); } assert.equal(boss.attackStage, stage); };
  stepBosses(world, player, 1 / 120, elapsed, shots);
  assert.equal(boss.isDormant, false);
  // 预告里写着招式的名字，用它看首领这一轮出的是哪一招。
  const skillName = () => bossStatus(world, elapsed).warning.split('：')[0];
  const names = new Set();
  for (let round = 0; round < 3; round++) { until('warning'); names.add(skillName()); until('weak'); }
  assert.deepEqual([...names], [boss.skills[0].name], '半血前一直是第一招');
  assert.equal(bossStatus(world, elapsed).isWeak, true);
  const saved = { isDormant: false, isShielded: boss.isShielded, attackStage: 'weak', attackIndex: boss.attackIndex, attackTime: boss.attackTime, shieldUntil: boss.shieldUntil };
  assert.equal(['rest', 'weak'].every(stage => typeof isValidBossState({ ...saved, attackStage: stage }, boss, elapsed) === 'boolean'), true);
  const hp = boss.hp;
  damageEnemy(boss, elapsed, { damage: 40, x: boss.x - 3 });
  assert.equal(hp - boss.hp, 80);
  const weakAt = elapsed;
  until('rest');
  assert.ok(Math.abs(elapsed - weakAt - WEAK_SECONDS) < 0.05);
  damageEnemy(boss, elapsed, { damage: 40, x: boss.x - 3 });
  assert.equal(hp - boss.hp, 120, '破绽过了恢复原伤害');
  boss.hp = Math.floor(boss.maxHp / 2);
  until('weak');
  assert.equal(boss.isEnraged, true);
  const used = new Set();
  for (let round = 0; round < 2; round++) { until('warning'); used.add(skillName()); until('weak'); }
  assert.equal(used.size, 2);
});

test('轻松档首领预告更久', () => {
  const measure = bonus => {
    const world = createRoomWorld(42, WORLD_ACTS[0]), arena = world.bossArenas[0], boss = world.enemies[arena.bossId - 1], player = createPlayer(world.platforms[arena.floorId]);
    world.warningBonus = bonus;
    let elapsed = 0, warning = 0;
    while (boss.attackStage !== 'attack' && elapsed < 20) { elapsed += 1 / 120; stepBosses(world, player, 1 / 120, elapsed, []); if (boss.attackStage === 'warning') warning += 1 / 120; }
    return warning;
  };
  assert.ok(Math.abs(measure(0.6) - measure(0) - 0.6) < 0.05);
});

test('大招靠武器打中充能，按所绑定的技能才释放', () => {
  const { adventure, survival } = run();
  const id = Object.keys(SPELLS)[0], need = SPELLS[id].charge;
  adventure.magic = { ...newMagic(), ranks: { [id]: 1 }, equipped: [id], charges: { [id]: 0 } };
  const player = { x: 0, y: 0, facing: 1 }, enemy = { id: 1, x: 3, y: 0, height: 1, hp: 500, maxHp: 500, combatVersion: 2 };
  const bounds = { left: -20, right: 20 };
  const step = manual => stepMagic(adventure, survival, player, [enemy], [], 1 / 120, 1, bounds, manual);
  for (let frame = 0; frame < 600; frame++) step({ hits: 0 });
  assert.equal(adventure.magic.charges[id], 0, '光按着攻击不打中不涨');
  step({ hits: 2 });
  assert.equal(adventure.magic.charges[id], Math.min(need, 2 * CHARGE_PER_HIT));
  step({ hits: Math.ceil(need / CHARGE_PER_HIT) });
  assert.deepEqual(adventure.magic.ready, [id]);
  assert.deepEqual(step().events, [], '满了不按不放');
  assert.deepEqual(step({ castId: 'snow' }).events, [], '按其他招式的键不会代放');
  assert.deepEqual(step({ castId: id }).events, [{ type: 'cast', id }]);
  assert.deepEqual(adventure.magic.ready, []);
});
