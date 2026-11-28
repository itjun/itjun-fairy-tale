import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FLOORS,
  WORLD_THEMES,
  findSupportY,
  getFloor,
} from '../src/snow-sisters/floors.js';
import {
  CHAIN_SCORES,
  SUSHI_SCORES,
  addScore,
  awardLetter,
  collectItem,
  dropItemForKill,
  spawnItem,
} from '../src/snow-sisters/items.js';
import { TIME_CODE, matchTimeCode, startSlotBonus } from '../src/snow-sisters/bonus.js';
import {
  INITIAL_LIVES,
  continueSnowGame,
  decodeSnowGame,
  joinSecondPlayer,
  loadFloor,
  newSnowGame,
  tickSnow,
} from '../src/snow-sisters/engine.js';
import { makeEnemy } from '../src/snow-sisters/enemies.js';
import { bounceSnowballUp, createSnowballFromEnemy, kickSnowball } from '../src/snow-sisters/snowball.js';
import { BOSS_REWARDS, hitBossWithShot, isBossDefeated } from '../src/snow-sisters/bosses.js';
import { SNOW_TRACKS } from '../src/snow-sisters/sound.js';

test('50 层塔楼、五大主题、Boss、循环坑与隐藏彩蛋完整且平台可达', () => {
  assert.equal(FLOORS.length, 50);
  assert.equal(WORLD_THEMES.length, 5);

  for (const f of FLOORS) {
    assert.ok(f.platforms.length >= 4, `第 ${f.floor} 层应有主平台与地面`);
    if (f.floor % 10 === 0) {
      assert.equal(f.isBoss, true, `第 ${f.floor} 层应为 Boss 层`);
    }
    if (f.floor >= 41 && f.floor <= 49) {
      assert.equal(f.pit, true, `第 ${f.floor} 层应开启底部循环坑`);
    }
    // 除 24/26/28 相扑高台外，普通跳跃（~45px）均可逐级登上任意平台
    const ys = [...new Set(f.platforms.map((pl) => pl.y))].sort((a, b) => b - a);
    for (let i = 1; i < ys.length; i++) {
      const gap = ys[i - 1] - ys[i];
      assert.ok(gap <= 44, `第 ${f.floor} 层平台层距过大: ${gap}`);
    }
  }

  for (const warpFloor of [12, 23, 33, 42]) {
    assert.equal(getFloor(warpFloor).hidden?.kind, 'warp', `第 ${warpFloor} 层应有跳关红包隐藏点`);
  }
  for (const sumoFloor of [24, 26, 28]) {
    assert.ok(getFloor(sumoFloor).spawns.some((sp) => sp.kind === 'sumo'));
  }
});

test('折线坡落到左右落脚台', () => {
  for (const floor of [4, 14, 21, 31, 44]) {
    const f = getFloor(floor);
    assert.equal(findSupportY(f, 36, 170, 200, true), 188, `第 ${floor} 层左坡应落到左台`);
    assert.equal(findSupportY(f, 220, 170, 200, true), 188, `第 ${floor} 层右坡应落到右台`);
    assert.equal(findSupportY(f, 128, 140, 160, true), 152, `第 ${floor} 层中层平台仍可站`);
  }
});

test('贴身推动静止雪球会顺着方向滚起来', () => {
  const s = newSnowGame({ players: 1, skipIntro: true });
  s.enemies = [];
  const p = s.players[0];
  p.x = 100;
  p.y = 224;
  p.dir = 1;
  p.onGround = true;
  s.snowballs = [
    {
      id: 1,
      x: 114,
      y: 224,
      vx: 0,
      vy: 0,
      state: 'still',
      color: 'white',
      owner: 1,
      chain: 0,
      bounces: 0,
      thaw: 420,
      riders: [],
      sweepGroup: 0,
    },
  ];
  tickSnow(s, { right: true });
  const ball = s.snowballs[0];
  assert.equal(ball.state, 'rolling', '推到雪球上应开始滚动');
  assert.ok(ball.vx > 2, `雪球应向右滚，实际 vx=${ball.vx}`);
  assert.ok(ball.x > 114, '雪球应离开原来的位置');
});

test('斜坡槽可以进去，也能从槽底掉到下层平台', () => {
  for (const floor of [3, 11, 19, 37]) {
    const f = getFloor(floor);
    assert.equal(findSupportY(f, 128, 88, 100, true), null, `第 ${floor} 层槽口不应被顶盖挡住`);
    assert.equal(findSupportY(f, 70, 70, 86, true), 80, `第 ${floor} 层应能落在槽顶左侧`);
    assert.equal(findSupportY(f, 128, 140, 160, true), 152, `第 ${floor} 层应从槽底掉到下层平台`);
  }

  const s = newSnowGame({ players: 1, startFloor: 3, skipIntro: true });
  s.enemies = [];
  const p = s.players[0];
  p.x = 70;
  p.y = 80;
  p.vx = 0;
  p.vy = 0;
  p.invuln = 0;
  p.onGround = true;
  let escaped = false;
  for (let i = 0; i < 160; i++) {
    tickSnow(s, { right: true });
    if (p.y >= 150) {
      escaped = true;
      break;
    }
  }
  assert.equal(escaped, true, `姐姐应沿斜坡走出槽口，实际停在 (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`);
  assert.ok(p.y >= 150 && p.y <= 156);

  const ballGame = newSnowGame({ players: 1, startFloor: 3, skipIntro: true });
  ballGame.enemies = [];
  ballGame.snowballs.push({
    id: 1,
    x: 128,
    y: 96,
    vx: 0,
    vy: 0,
    state: 'still',
    color: 'white',
    owner: 1,
    chain: 0,
    bounces: 0,
    thaw: 420,
    riders: [],
  });
  for (let i = 0; i < 90; i++) tickSnow(ballGame, {});
  const ball = ballGame.snowballs[0];
  assert.ok(ball, '雪球不应在槽里消失');
  assert.equal(ball.y, 152, `雪球应从槽底掉到下层，实际 y=${ball.y}`);
});

test('状态序列化与中断后逐帧确定性回放一致', () => {
  const s = newSnowGame({ players: 2, seed: 0x12345678, skipIntro: true });
  for (let i = 0; i < 180; i++) {
    tickSnow(s, {
      p1: { right: i % 40 < 20, left: i % 40 >= 20, jump: i % 30 === 3, shoot: i % 9 === 0 },
      p2: { left: i % 50 < 25, right: i % 50 >= 25, jump: i % 40 === 5, shoot: i % 12 === 0 },
    });
  }
  const restored = decodeSnowGame(JSON.stringify(s));
  assert.ok(restored);

  for (let i = 0; i < 180; i++) {
    const inp = {
      p1: { right: i % 30 < 15, jump: i % 25 === 2, shoot: i % 11 === 0 },
      p2: { left: i % 25 < 12, jump: i % 35 === 4, shoot: i % 14 === 0 },
    };
    tickSnow(s, inp);
    tickSnow(restored, inp);
  }
  assert.deepEqual(restored, s);
  assert.equal(decodeSnowGame('{}'), null);
  assert.equal(decodeSnowGame('bad json'), null);
});

test('雪片结球、推动、底顶、垫高、踢飞、双色连锁与一球全灭红包雨', () => {
  const s = newSnowGame({ players: 1, skipIntro: true });
  const p1 = s.players[0];

  // 基础 9 击成球
  s.enemies = [makeEnemy(s, 'goblin', 140, 224, -1)];
  s.stageEnemyTotal = 1;
  p1.x = 100;
  p1.y = 224;
  p1.dir = 1;
  for (let i = 0; i < 140 && s.snowballs.length === 0; i++) {
    tickSnow(s, { p1: { shoot: i % 9 === 0 } });
  }
  assert.equal(s.snowballs.length, 1, '9 发雪片应将紫魔怪裹成雪球');
  assert.equal(s.enemies.length, 0);

  // 底顶雪球弹跳与站立踩雪球
  const ball = s.snowballs[0];
  const prevBallY = ball.y;
  bounceSnowballUp(s, ball);
  assert.ok(ball.vy < 0);
  tickSnow(s, {});
  assert.ok(ball.y < prevBallY);

  // 等雪球落稳后测试双色连锁 + 一球全灭红包雨
  for (let i = 0; i < 60; i++) tickSnow(s, {});
  s.enemies = [
    makeEnemy(s, 'goblin', 180, 224, -1),
    makeEnemy(s, 'fireSpitter', 208, 224, -1),
  ];
  s.stageEnemyTotal = 3;
  const ball2 = createSnowballFromEnemy(s, makeEnemy(s, 'goblin', 145, 224, 1), 1);
  ball.x = 110;
  ball.y = 224;
  p1.x = 98;
  p1.dir = 1;
  kickSnowball(s, ball, p1);
  // 用第1颗踢出的雪球撞击第2颗静止雪球，触发蓝球连锁并清屏
  for (let i = 0; i < 30; i++) {
    tickSnow(s, {});
  }
  assert.ok(s.snowballs.length <= 2);
  assert.equal(s.enemies.length, 0, '双色连锁应碾碎沿途所有怪物');
  assert.ok(p1.score >= 16000, '蓝色连锁雪球击杀应奖 8,000 分');
  assert.equal(s.sweepTriggered, true, '一球全灭应触发 10,000 分祝字红包雨');
  assert.ok(s.items.filter((it) => it.kind === 'money10k').length >= 1);
  assert.ok(s.items.some((it) => it.kind === 'sushi' && it.tier === 9), '连锁球击破必掉最高档海胆寿司');
});

test('红蓝黄绿四种药水、第24层黄药水限制、S-N-O-W奖命与10万/60万奖命', () => {
  const s = newSnowGame({ players: 1, skipIntro: true });
  const p1 = s.players[0];

  // 蓝药水加速 3 发成球，黄药水增加射程，红药水提升速度
  collectItem(s, p1, { kind: 'red', x: p1.x, y: p1.y });
  collectItem(s, p1, { kind: 'blue', x: p1.x, y: p1.y });
  collectItem(s, p1, { kind: 'yellow', x: p1.x, y: p1.y });
  assert.equal(p1.potions.speed, true);
  assert.equal(p1.potions.power, true);
  assert.equal(p1.potions.range, true);

  // 重复拿红药水加 1000 分
  const before = p1.score;
  collectItem(s, p1, { kind: 'red', x: p1.x, y: p1.y });
  assert.equal(p1.score, before + 1000);

  // 绿药水巨大化无敌
  collectItem(s, p1, { kind: 'green', x: p1.x, y: p1.y });
  assert.ok(p1.giantTimer > 500);

  // 第 24 层以后不再掉落黄药水
  loadFloor(s, 24);
  for (let k = 0; k < 200; k++) {
    dropItemForKill(s, 120, 180, { chainCount: 3, allowPotion: true });
  }
  assert.equal(s.items.some((it) => it.kind === 'yellow'), false, '第24层及以后不可掉落黄药水');

  // S-N-O-W 集齐奖 1UP
  const livesBefore = p1.lives;
  for (const ch of ['S', 'N', 'O', 'W']) awardLetter(s, p1, ch);
  assert.equal(p1.lives, livesBefore + 1);
  assert.equal(p1.letters.length, 0);

  // 100,000 和 600,000 分奖 1UP
  addScore(s, p1, 100000);
  assert.equal(p1.lives, livesBefore + 2);
  addScore(s, p1, 500000);
  assert.equal(p1.lives, livesBefore + 3);
  assert.equal(SUSHI_SCORES.length, 10);
  assert.equal(CHAIN_SCORES.length, 6);
});

test('第12层隐藏跳关红包与Boss战后老虎机3轮依次拍停', () => {
  const s = newSnowGame({ players: 1, startFloor: 12, skipIntro: true });
  const f12 = getFloor(12);
  const p1 = s.players[0];
  p1.x = f12.hidden.x + 22;
  p1.y = f12.hidden.y;
  p1.dir = -1;

  // 连射 6 次打出隐藏跳关红包
  for (let i = 0; i < 80 && !s.hiddenRevealed; i++) {
    tickSnow(s, { p1: { shoot: i % 9 === 0 } });
  }
  assert.equal(s.hiddenRevealed, true);
  assert.ok(s.items.some((it) => it.kind === 'warp'));

  // 拾取跳关红包进入 warpSlot
  p1.x = f12.hidden.x;
  p1.y = f12.hidden.y;
  for (let i = 0; i < 15 && s.phase === 'play'; i++) tickSnow(s, {});
  assert.equal(s.phase, 'warpSlot');

  // 长按一次只会停 1 轮（防连发误触），3 次独立按键才停满 3 轮并跳层
  tickSnow(s, { p1: { jump: true } });
  tickSnow(s, { p1: { jump: true } });
  assert.equal(s.bonus.activeReel, 1, '长按不可连续停掉多轮');
  tickSnow(s, { p1: { jump: false } });
  tickSnow(s, { p1: { jump: true } });
  tickSnow(s, { p1: { jump: false } });
  tickSnow(s, { p1: { jump: true } });
  assert.equal(s.bonus.activeReel, 3);
  for (let i = 0; i < 90; i++) tickSnow(s, {});
  assert.equal(s.phase, 'play');
  assert.ok(s.floor >= 13 && s.floor <= 19, `跳关后应在 13~19 层之间，实际第 ${s.floor} 层`);

  // Boss 老虎机验证
  loadFloor(s, 10);
  startSlotBonus(s, 'boss');
  assert.equal(s.phase, 'slot');
  for (let r = 0; r < 3; r++) {
    tickSnow(s, { p1: { shoot: true } });
    tickSnow(s, { p1: { shoot: false } });
  }
  for (let i = 0; i < 90; i++) tickSnow(s, {});
  assert.equal(s.phase, 'play');
  assert.equal(s.floor, 11);
});

test('五大Boss配置、2P血量平衡、50层尖刺与Time模式倒计时', () => {
  for (const bossFloor of [10, 20, 30, 40, 50]) {
    const s1 = newSnowGame({ players: 1, startFloor: bossFloor, skipIntro: true });
    const s2 = newSnowGame({ players: 2, startFloor: bossFloor, skipIntro: true });
    assert.ok(s1.boss && s2.boss);
    const hp1 = s1.boss.units.reduce((a, u) => a + u.maxHp, 0);
    const hp2 = s2.boss.units.reduce((a, u) => a + u.maxHp, 0);
    assert.ok(hp2 > hp1, `第 ${bossFloor} 层 Boss 在 2P 模式下应提高血量保持合作乐趣`);
  }

  // 40F Time 模式大鼻绿魔墨镜彩蛋
  const tm = newSnowGame({ players: 1, startFloor: 40, timeMode: true, skipIntro: true });
  assert.equal(tm.boss.name, '墨镜大鼻魔');
  assert.equal(matchTimeCode(TIME_CODE.slice(0, -1), TIME_CODE.at(-1)).matched, true);
  assert.equal(matchTimeCode(['up'], 'down').matched, false);

  // 50F Boss 尖刺随时间下降并在通关后进入 ending
  const f50 = newSnowGame({ players: 1, startFloor: 50, skipIntro: true });
  const startSpike = f50.boss.spikeY;
  for (let i = 0; i < 200; i++) tickSnow(f50, {});
  assert.ok(f50.boss.spikeY > startSpike);
  f50.boss.units.forEach((u) => {
    u.hp = 0;
  });
  f50.enemies = [];
  f50.snowballs = [];
  assert.equal(isBossDefeated(f50.boss), true);
  for (let i = 0; i < 120; i++) tickSnow(f50, {});
  assert.equal(f50.phase, 'ending');

  // Time 模式时间耗尽触发 Game Over
  tm.timeLeft = 2;
  tickSnow(tm, {});
  tickSnow(tm, {});
  assert.equal(tm.phase, 'over');
});

test('超时刷出南瓜头与幽灵、2P中途加入以及命用完后继续', () => {
  const s = newSnowGame({ players: 1, skipIntro: true });
  assert.equal(INITIAL_LIVES, 5);
  assert.equal(s.players[0].lives, 5);
  assert.equal(s.players[1].active, false);
  tickSnow(s, { p2: { join: true } });
  assert.equal(s.players[1].active, true);
  assert.equal(s.players[1].lives, 5);
  assert.equal(s.mode, 2);

  // 推进超时刷出南瓜头
  s.stageTimer = 4799;
  tickSnow(s, {});
  assert.ok(s.enemies.some((e) => e.kind === 'pumpkin'), '超时后应出现南瓜头');

  // 全灭后从本层继续，再给 5 条命，分数和字母留着，可以一直继续
  s.phase = 'over';
  s.players[0].score = 17900;
  s.players[0].letters = ['S', 'N'];
  s.players[1].score = 800;
  assert.equal(continueSnowGame(s), true);
  assert.equal(s.phase, 'play');
  assert.equal(s.players[0].lives, 5);
  assert.equal(s.players[1].lives, 5);
  assert.equal(s.players[0].score, 17900);
  assert.deepEqual(s.players[0].letters, ['S', 'N']);
  assert.equal(s.players[1].score, 800);
  s.phase = 'over';
  assert.equal(continueSnowGame(s), true);
  assert.equal(s.players[0].lives, 5);
  assert.equal(s.players[0].score, 17900);

  // 12 首原声曲目检查
  assert.equal(SNOW_TRACKS.length, 12);
  for (const track of SNOW_TRACKS) {
    assert.equal(track.melody.length, 64, `${track.id} 主旋律应为 64 步`);
    assert.equal(track.bass.length, 64, `${track.id} 低音线应为 64 步`);
  }
});

test('五大 Boss 击破分数、绿药水撞怪掉高档寿司、双怪鸟俯冲', () => {
  assert.deepEqual(BOSS_REWARDS, { lizard: 50000, frog: 80000, birds: 50000, bigNose: 100000, bubbleStatues: 100000 });
  for (const bossFloor of [10, 20, 30, 40, 50]) {
    const s = newSnowGame({ players: 1, startFloor: bossFloor, skipIntro: true });
    const unit = s.boss.units[0];
    unit.hp = 1;
    const before = s.players[0].score;
    assert.equal(hitBossWithShot(s, { owner: 1, x: unit.x, y: unit.y - 10, power: 1 }), true);
    assert.equal(unit.hp, 0);
    assert.equal(s.players[0].score - before, 20 + BOSS_REWARDS[s.boss.kind], `第 ${bossFloor} 层击破分数不对`);
  }

  // 绿药水巨大化撞怪：8,000 分并掉海胆寿司
  const g = newSnowGame({ players: 1, skipIntro: true });
  const gp = g.players[0];
  gp.giantTimer = 300;
  gp.invuln = 0;
  g.enemies = [makeEnemy(g, 'goblin', gp.x, gp.y, 1)];
  const gBefore = gp.score;
  tickSnow(g, {});
  // 8,000 分撞怪奖励 + 同位置掉落并立刻拾取的海胆寿司 2,000 分。
  assert.equal(gp.score - gBefore, 8000 + SUSHI_SCORES[9], '绿药水撞怪应掉高档寿司');

  // 30 层双怪鸟：计时到点后瞄准玩家斜线俯冲，之后回到高空
  const b = newSnowGame({ players: 1, startFloor: 30, skipIntro: true });
  const bird = b.boss.units[0];
  const startY = bird.y;
  b.players[0].invuln = 9999;
  bird.timer = 259;
  tickSnow(b, {});
  assert.ok(bird.diveTimer > 0, '计时到点后应开始俯冲');
  let maxY = bird.y;
  for (let i = 0; i < 70; i++) {
    tickSnow(b, {});
    maxY = Math.max(maxY, bird.y);
  }
  assert.ok(maxY > startY + 60, `俯冲应明显下压，实际最低 ${maxY}`);
  assert.equal(bird.diveTimer, 0);
  assert.ok(bird.vy < 0, '俯冲结束后应转向高空');
});

test('蓝蝙蝠第 44 层起出场，连锁雪球跟随 1P 红／2P 紫并兼容旧存档', () => {
  for (const f of FLOORS) {
    const hasBat = f.spawns.some((sp) => sp.kind === 'blueBat');
    if (f.floor < 44) assert.equal(hasBat, false, `第 ${f.floor} 层不应出现蓝蝙蝠`);
  }
  assert.ok(FLOORS.slice(43, 49).some((f) => f.spawns.some((sp) => sp.kind === 'blueBat')));

  for (const owner of [1, 2]) {
    const s = newSnowGame({ players: 2, skipIntro: true });
    s.enemies = [];
    const player = s.players[owner - 1];
    player.x = 90;
    player.y = 224;
    player.dir = 1;
    const a = createSnowballFromEnemy(s, makeEnemy(s, 'goblin', 110, 224, 1), owner);
    const other = createSnowballFromEnemy(s, makeEnemy(s, 'goblin', 140, 224, 1), owner);
    kickSnowball(s, a, player);
    for (let i = 0; i < 30 && other.state === 'still'; i++) tickSnow(s, {});
    assert.equal(other.state, 'rolling');
    assert.equal(other.color, owner === 1 ? 'p1' : 'p2');
  }

  const legacy = newSnowGame({ players: 1, skipIntro: true });
  legacy.snowballs.push({ id: 900, x: 100, y: 224, vx: 0, vy: 0, state: 'still', color: 'blue', owner: 1, chain: 0, bounces: 0, thaw: 300, enemyKind: 'goblin', letter: null, isBossMinion: false, riders: [], sweepGroup: 0 });
  legacy.snowballs.push({ ...legacy.snowballs[0], id: 901, color: 'red' });
  const restored = decodeSnowGame(JSON.stringify(legacy));
  assert.deepEqual(restored.snowballs.map((ball) => ball.color), ['p1', 'p2']);
});

test('每一种可雪封的小怪都能被 9 发雪片裹成雪球', () => {
  for (const kind of ['goblin', 'yellowMonkey', 'fireSpitter', 'fireYeti', 'ogre', 'blueBat', 'tornado']) {
    const s = newSnowGame({ players: 1, skipIntro: true });
    const p = s.players[0];
    p.x = 80;
    p.y = 224;
    p.dir = 1;
    p.invuln = 9999;
    s.enemies = [makeEnemy(s, kind, 140, 224, -1, { aiTimer: 1 })];
    for (let i = 0; i < 160 && s.snowballs.length === 0; i++) tickSnow(s, { p1: { shoot: i % 9 === 0 } });
    assert.equal(s.snowballs.length, 1, `${kind} 应能被裹成雪球`);
    assert.equal(s.snowballs[0].enemyKind, kind);
  }
});

test('完整流程：1P 与 2P 从第 1 层贯通五大 Boss、过关老虎机直到结局', () => {
  for (const players of [1, 2]) {
    const s = newSnowGame({ players, skipIntro: true, seed: 0x2468ace });
    const visited = new Set();
    const slots = [];
    let press = false;
    let guard = 0;
    while (s.phase !== 'ending' && guard++ < 40000) {
      if (s.phase === 'play') {
        visited.add(s.floor);
        s.players.forEach((p) => {
          p.invuln = 9999;
        });
        s.enemies = [];
        s.snowballs = [];
        s.hazards = [];
        s.snowHeadTimer = 0;
        if (s.boss) s.boss.units.forEach((u) => {
          u.hp = 0;
        });
        tickSnow(s, {});
      } else if (s.phase === 'slot' || s.phase === 'warpSlot') {
        if (!slots.includes(s.floor)) slots.push(s.floor);
        press = !press;
        tickSnow(s, { p1: { shoot: press }, p2: { shoot: press } });
      } else {
        assert.fail(`不应进入 ${s.phase}`);
      }
      if (guard % 97 === 0) {
        s.sounds = [];
        const copy = decodeSnowGame(JSON.stringify(s));
        assert.ok(copy, '中途存档应可读取');
        assert.equal(copy.floor, s.floor);
        assert.equal(copy.phase, s.phase);
      }
    }
    assert.equal(s.phase, 'ending', `${players}P 应通关进入结局`);
    assert.equal(visited.size, 50, `${players}P 应经过全部 50 层`);
    assert.deepEqual(slots, [10, 20, 30, 40], '前四个 Boss 后应各有一次过关老虎机');
    assert.ok(s.players[0].lives >= INITIAL_LIVES);
  }
});

test('高清图集：每格 1024 像素，背景 2560×1920，墙体与平台同步放大', async () => {
  const { default: sharp } = await import('sharp');
  const expected = {
    'characters.webp': [5120, 4096],
    'enemies.webp': [5120, 4096],
    'items.webp': [5120, 4096],
    'bosses.webp': [4096, 4096],
    'platform-bank.webp': [4608, 1152],
    'field-1.webp': [2560, 1920],
    'field-5.webp': [2560, 1920],
    'title.webp': [2560, 1920],
    'ending.webp': [2560, 1920],
    'wall-1.webp': [512, 512],
    'wall-5.webp': [512, 512],
  };
  for (const [file, [width, height]] of Object.entries(expected)) {
    const meta = await sharp(new URL(`../public/snow-sisters/${file}`, import.meta.url).pathname).metadata();
    assert.equal(meta.width, width, `${file} 宽度`);
    assert.equal(meta.height, height, `${file} 高度`);
  }
});

test('1P、2P 雪球是金黄加星星与薰衣草紫加爱心，和红裙、紫裙拉开', async () => {
  const { default: sharp } = await import('sharp');
  const path = new URL('../public/snow-sisters/items.webp', import.meta.url).pathname;
  const cell = async (index) => {
    const { data } = await sharp(path)
      .extract({ left: (index % 5) * 1024 + 512 - 180, top: Math.floor(index / 5) * 1024 + 512 + 20, width: 60, height: 60 })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const n = data.length / 4;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; }
    return [r / n, g / n, b / n];
  };
  const [r1, g1, b1] = await cell(12);
  const [r2, g2, b2] = await cell(13);
  assert.ok(r1 > 190 && g1 > 140 && b1 < 130 && r1 - b1 > 100, `1P 雪球应偏金黄：${[r1, g1, b1]}`);
  assert.ok(b2 > r2 && b2 > g2 && b2 > 190, `2P 雪球应偏薰衣草紫：${[r2, g2, b2]}`);
});
