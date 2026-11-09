import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMPAIGNS, createCampaignWorld, campaignScore, validateCampaign } from '../shared/campaign.js';
import { createPlayer, stepPlayer } from '../src/game/physics.js';

test('八关各 200 个种子：可复现、结构不重复、奖励可完成、内容逐级增加', () => {
  for (let seed = 0; seed < 200; seed++) {
    let previousSize = 0;
    for (const [id, profile] of Object.entries(CAMPAIGNS)) {
      const world = createCampaignWorld(seed, id);
      assert.equal(world.isFallback, undefined, `${id}/${seed} 不应依赖回退`);
      assert.ok(validateCampaign(world));
      assert.equal(world.milestones.length, profile.index + 3);
      assert.ok(world.mainPath.length > previousSize); previousSize = world.mainPath.length;
      assert.ok(world.treasures.filter(t => !t.isBranch).length >= world.requiredFlowers);
      assert.ok(world.enemies.every(e => !world.platforms[e.platformId].isCheckpoint));
      if (seed < 3) assert.deepEqual(world, createCampaignWorld(seed, id));
      assert.notEqual(world.signature, createCampaignWorld(seed + 1, id).signature);
    }
  }
});

function canJump(world, from, to, kind) {
  for (const targetX of [to.x, to.x + Math.sign(to.x - from.x) * (to.width / 2 - 0.6)]) {
    for (const offset of [0, from.width / 2 - 0.5, -from.width / 2 + 0.5]) {
      const player = createPlayer(from); player.x += offset;
      if (kind === 'spring') { player.vy = 18; player.isGrounded = false; player.ground = null; }
      for (let frame = 0; frame < 360; frame++) {
        const delta = targetX - player.x;
        stepPlayer(player, { direction: Math.abs(delta) > 0.15 ? Math.sign(delta) : 0, jump: frame === 0 && kind !== 'spring' && kind !== 'drop', drop: frame === 0 && kind === 'drop' }, [from,to], 1 / 120, {minX:-10000,minY:-10000});
        if (player.ground?.id === to.id) return true;
        if (player.y < Math.min(from.y,to.y)-8) break;
      }
    }
  }
  return false;
}
test('真实物理验证各关多个种子的静态连接、弹跳和支路返回', () => {
  for (const id of Object.keys(CAMPAIGNS)) for (let seed=0;seed<5;seed++) {
    const world=createCampaignWorld(seed,id);
    for(const edge of world.edges) {
      if(['board','ride','gate'].includes(edge.kind))continue;
      const a=world.platforms[edge.from],b=world.platforms[edge.to];
      assert.ok(canJump(world,a,b,edge.kind),`${id}/${seed} ${edge.kind} ${a.id}(${a.x},${a.y})->${b.id}(${b.x},${b.y})`);
    }
  }
});
test('打怪和额外掉落按种子确定，重复编号不重复得分',()=>{
 const world=createCampaignWorld(8,'beach');
 const ids=world.enemies.map(e=>e.id);
 const score=campaignScore(world,[1,2],ids,false,80);
 assert.equal(score.combatScore,world.enemies.reduce((sum,e)=>sum+e.points,0));
 assert.deepEqual(score,campaignScore(world,[1,2,1],[...ids,...ids],false,80));
 assert.equal(campaignScore(world,[1,2],ids,true,80).score,score.score+80);
});

test('生成版本 1 的已发放地图与奖励清单保持兼容',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {createHash}=await import('node:crypto');
 const fixtures=JSON.parse(await readFile(new URL('./helpers/generation-v1.json',import.meta.url),'utf8'));
 for(const row of fixtures){
  const w=createCampaignWorld(row.seed,row.levelId,1);
  const payload={platforms:w.platforms,treasures:w.treasures,enemies:w.enemies,switches:w.switches,springs:w.springs};
  assert.equal(createHash('sha256').update(JSON.stringify(payload)).digest('hex'),row.sha256,'生成规则改动应新增版本并保留旧版实现，不覆盖此存档契约');
 }
});
