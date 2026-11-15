import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES, WORLD_ACTS } from '../shared/levels.js';
import { createCampaignWorld, validateCampaign } from '../shared/campaign.js';
import { bossBaseline } from '../shared/boss-health.js';
import { play } from './helpers/campaign-runner.mjs';

test('第 8 版收成 8 个世界关，每关一条规则、一场首领', () => {
  assert.equal(WORLD_ACTS.length, 8);
  assert.equal(STAGES.length, 24);
  for (const act of WORLD_ACTS) {
    const kinds = new Set();
    for (const seed of [1, 42, 137]) {
      const world = createCampaignWorld(seed, act.id, 8);
      assert.equal(world.version, 8);
      assert.equal(validateCampaign(world), true, act.id);
      assert.equal(world.zones.filter(zone => !zone.isBoss).every(zone => zone.kind === act.structure), true, act.id);
      kinds.add(world.zones.filter(zone => !zone.isBoss).map(zone => zone.kind).join(','));
      const bosses = world.enemies.filter(enemy => enemy.isBoss);
      assert.equal(bosses.length, 1, act.id);
      assert.equal(bosses[0].isWorldBoss, true);
      assert.equal(world.enemies.some(enemy => enemy.isMidBoss), false);
      assert.equal(bosses[0].hp, bossBaseline(act, 'world', 8));
      assert.ok(bosses[0].hp / 120 >= 10 && bosses[0].hp / 120 <= 14, act.id);
      const mobs = world.enemies.filter(enemy => !enemy.isBoss && !enemy.parentId);
      assert.ok(mobs.length >= 8 && mobs.length <= 12, `${act.id} ${mobs.length}`);
      const early = mobs.filter(enemy => enemy.zone < 2);
      assert.equal(early.every(enemy => enemy.showBar === false), true, act.id);
      for (const enemy of mobs) {
        const near = mobs.filter(other => Math.abs(other.x - enemy.x) < 13 && Math.abs(other.y - enemy.y) < 6);
        assert.ok(near.length <= 3, act.id);
      }
    }
    assert.equal(kinds.size, 1, act.id);
  }
  const again = createCampaignWorld(42, 'cartoon-world', 8);
  assert.equal(again.signature, createCampaignWorld(42, 'cartoon-world', 8).signature);
  const legacy = createCampaignWorld(42, 'cartoon-3', 7);
  assert.equal(legacy.enemies.some(enemy => enemy.isMidBoss), true);
});

test('第 8 版八个世界的主路仍然连得起来', () => {
  for (const act of WORLD_ACTS) for (const seed of [1, 42]) {
    const result = play(act.id, seed, 8);
    assert.equal(result.failed, undefined, `${act.id} ${JSON.stringify(result)}`);
    assert.ok(result.visited >= result.total - 1, act.id);
  }
});
