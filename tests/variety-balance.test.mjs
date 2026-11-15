import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES } from '../shared/levels.js';
import { createCampaignWorld, validateCampaign } from '../shared/campaign.js';
import { bossBaseline, bossTargetHp, bossToughness } from '../shared/boss-health.js';
import { MONSTERS } from '../shared/adventure-catalog.js';
import { createPlayer, stepPlayer } from '../src/game/physics.js';
import { play } from './helpers/campaign-runner.mjs';

test('第 7 版把小怪分成角色，血条只留给需要多打一下的对象', () => {
  const world = createCampaignWorld(42, 'forest-2', 7);
  assert.equal(world.version, 7);
  assert.ok(validateCampaign(world));
  const mobs = world.enemies.filter(enemy => !enemy.isBoss && !enemy.parentId);
  assert.ok(mobs.some(enemy => enemy.role === 'armored' && enemy.showBar && enemy.hp >= 64));
  assert.ok(mobs.some(enemy => enemy.showBar === false && enemy.hp <= 20));
  assert.ok(new Set(mobs.map(enemy => enemy.period)).size >= 3);
  for (const zone of world.zones.filter(zone => !zone.isBoss)) {
    const behaviors = world.enemies.filter(enemy => enemy.zone === zone.id && !enemy.isBoss && !enemy.parentId && !enemy.childIds?.length).map(enemy => enemy.behavior);
    assert.equal(new Set(behaviors).size, behaviors.length, `${world.stageId} 房间 ${zone.id}`);
  }
});

test('中段首领不再只轮换三种招式，单武器时长呈缓坡，叠武器最多 1.8 倍', () => {
  const skills = new Set();
  for (const stage of STAGES) {
    const world = createCampaignWorld(7, stage.id, 7);
    const mid = world.enemies.find(enemy => enemy.isMidBoss);
    skills.add(mid.patterns[0]);
    assert.equal(mid.hp, bossBaseline(stage, 'mid', 7));
    assert.ok(mid.hp / 120 >= 6.5 && mid.hp / 120 <= 8.1, stage.id);
    const small = world.enemies.find(enemy => enemy.isBoss && !enemy.isMidBoss && !enemy.isWorldBoss);
    assert.ok(small.hp / 120 >= 8 && small.hp / 120 <= 10.1, stage.id);
  }
  assert.ok(skills.size >= 6, [...skills].join(','));
  const meadow = STAGES.find(stage => stage.id === 'meadow-3');
  assert.equal(bossBaseline(meadow, 'world', 6), 880);
  assert.equal(bossBaseline(meadow, 'world', 7), 1060);
  assert.ok(bossToughness(meadow.index, 8, 6) > 8);
  assert.equal(bossToughness(meadow.index, 8, 7), 1.8);
  assert.equal(bossTargetHp(meadow, 'world', 8, 7), Math.round(1060 * 1.8));
  const legacy = createCampaignWorld(42, 'cartoon-3', 6);
  const worldBoss = legacy.enemies.find(enemy => enemy.isWorldBoss);
  assert.equal(worldBoss.hp, 1180);
});

test('第 7 版主路仍然连得起来，妹妹的二段跳更高', () => {
  for (const id of ['rainbow-1', 'beach-2', 'cartoon-3']) for (const seed of [1, 42]) {
    const result = play(id, seed, 7);
    assert.equal(result.failed, undefined, JSON.stringify(result));
    assert.equal(result.visited, result.total, id);
  }
  const floor = { id: 0, x: 0, y: 0, width: 30, isOneWay: true };
  const air = character => {
    const player = createPlayer(floor);
    player.character = character;
    stepPlayer(player, { direction: 0, jump: true }, [floor], 1 / 120);
    for (let i = 0; i < 24; i++) stepPlayer(player, { direction: 0 }, [floor], 1 / 120);
    stepPlayer(player, { direction: 0, jump: true }, [floor], 1 / 120);
    return player.vy;
  };
  assert.ok(air('little') > air('dad') * 1.1);
  assert.equal(MONSTERS.leafshield.behavior, 'guard');
});
