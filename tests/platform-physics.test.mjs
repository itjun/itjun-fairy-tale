import test from 'node:test';
import assert from 'node:assert/strict';
import { RULES, createPlayer, firstPlatform, nextPlatform, randomGenerator, stepPlayer, rescue, regroup, prunePlatforms } from '../src/game/physics.js';
const dt = 1 / 120;

test('1000 个种子的连续平台均可从边缘留有余量地跳到下一台', () => {
  for (let seed = 0; seed < 1000; seed++) {
    const random = randomGenerator(seed);
    let current = firstPlatform();
    for (let n = 0; n < 50; n++) {
      const next = nextPlatform(current, random);
      const player = createPlayer(current);
      player.x = current.x + current.width / 2 - 0.6;
      let isLanded = false;
      for (let frame = 0; frame < 180; frame++) {
        stepPlayer(player, { direction: player.x < next.x ? 1 : 0, jump: frame === 0 }, [current, next], dt);
        if (player.safe.id === next.id && player.isGrounded) { isLanded = true; break; }
      }
      assert.ok(isLanded, `seed ${seed}, platform ${next.id}`);
      current = next;
    }
  }
});
test('相同种子生成相同地图，不同种子改变地图', () => {
  function map(seed) { const random = randomGenerator(seed); const platforms = [firstPlatform()]; for (let i = 0; i < 20; i++) platforms.push(nextPlatform(platforms.at(-1), random)); return platforms; }
  assert.deepEqual(map(42), map(42)); assert.notDeepEqual(map(42), map(43));
});
test('无输入时落地稳定，掉落可无限复活到安全台', () => {
  const platform = firstPlatform(), player = createPlayer(platform);
  for (let i = 0; i < 1200; i++) stepPlayer(player, { direction: 0, jump: false }, [platform], dt);
  assert.equal(player.y, 0); assert.equal(player.isGrounded, true);
  for (let life = 1; life <= 100; life++) {
    player.y = -8;
    assert.equal(stepPlayer(player, { direction: 0, jump: false }, [platform], dt).isRescued, true);
    assert.equal(player.y, platform.y); assert.equal(player.recoveries, life);
  }
});
test('离台宽容时间与提前按跳可用，空中不能无限连跳', () => {
  const platform = firstPlatform(), player = createPlayer(platform);
  player.x = 7; player.isGrounded = false; player.coyote = 0.08;
  assert.equal(stepPlayer(player, { direction: 1, jump: true }, [platform], dt).isJumped, true);
  assert.equal(stepPlayer(player, { direction: 1, jump: true }, [platform], dt).isJumped, false);
  rescue(player); player.y = 0.05; player.vy = -2; player.isGrounded = false; player.coyote = 0;
  stepPlayer(player, { direction: 0, jump: true }, [platform], dt);
  let isBufferedJump = false;
  for (let i = 0; i < 10; i++) isBufferedJump ||= stepPlayer(player, { direction: 0, jump: false }, [platform], dt).isJumped;
  assert.ok(isBufferedJump); assert.ok(RULES.jump > 0);
});
test('双人分开太远会在领先者安全台会合，清理后保留两人安全台', () => {
  const random = randomGenerator(4), platforms = [firstPlatform()];
  for (let i = 0; i < 1000; i++) platforms.push(nextPlatform(platforms.at(-1), random));
  const a = createPlayer(platforms[990]), b = createPlayer(platforms[995]);
  assert.equal(regroup([a, b]), true); assert.equal(a.safe.id, b.safe.id);
  const retained = prunePlatforms(platforms, [a, b]);
  assert.ok(retained.some(platform => platform.id === a.safe.id)); assert.ok(retained.length < 12);
});

test('全部关卡的不同难度在 300 个种子下均可跳通', async () => {
  const { LEVELS, hasCompleted, calculateScore } = await import('../shared/levels.js');
  for (const level of LEVELS) for (let seed=0;seed<300;seed++) {
    const random = randomGenerator(seed); let current=firstPlatform();
    for(let i=0;i<level.platforms;i++) {
      const next=nextPlatform(current,random,level), player=createPlayer(current);
      player.x=current.x+current.width/2-0.6;
      let isLanded=false;
      for(let frame=0;frame<180;frame++) {
        stepPlayer(player,{direction:player.x<next.x?1:0,jump:frame===0},[current,next],dt);
        if(player.safe.id===next.id&&player.isGrounded){isLanded=true;break;}
      }
      assert.ok(isLanded,`${level.id}, seed ${seed}, platform ${next.id}`); current=next;
    }
    assert.equal(hasCompleted(level,level.requiredFlowers-1,level.platforms),false);
    assert.equal(hasCompleted(level,level.requiredFlowers,level.platforms),true);
    assert.equal(calculateScore(4,false,level),40);
    assert.equal(calculateScore(4,true,level),40+level.bonus);
  }
});
