import test from 'node:test';
import assert from 'node:assert/strict';
import { RULES, createPlayer, stepPlayer, rescue } from '../src/game/physics.js';
import { touchEnemy } from '../src/game/enemies.js';
const dt = 1 / 120;
const ground = { id: 0, x: 0, y: 0, width: 12 };

test('无输入时落地稳定，掉落可无限复活到安全台', () => {
  const platform = ground, player = createPlayer(platform);
  for (let i = 0; i < 1200; i++) stepPlayer(player, { direction: 0, jump: false }, [platform], dt);
  assert.equal(player.y, 0); assert.equal(player.isGrounded, true);
  for (let life = 1; life <= 100; life++) {
    player.y = -8;
    assert.equal(stepPlayer(player, { direction: 0, jump: false }, [platform], dt).isRescued, true);
    assert.equal(player.y, platform.y); assert.equal(player.recoveries, life);
  }
});
test('离台宽容时间与提前按跳可用，空中不能无限连跳', () => {
  const platform = ground, player = createPlayer(platform);
  player.x = 7; player.isGrounded = false; player.coyote = 0.08;
  assert.equal(stepPlayer(player, { direction: 1, jump: true }, [platform], dt).isJumped, true);
  assert.equal(stepPlayer(player, { direction: 1, jump: true }, [platform], dt).isJumped, true);
  assert.equal(stepPlayer(player, { direction: 1, jump: true }, [platform], dt).isJumped, false);
  rescue(player); player.y = 0.05; player.vy = -2; player.isGrounded = false; player.coyote = 0; player.isAirJumpUsed = true;
  stepPlayer(player, { direction: 0, jump: true }, [platform], dt);
  let isBufferedJump = false;
  for (let i = 0; i < 10; i++) isBufferedJump ||= stepPlayer(player, { direction: 0, jump: false }, [platform], dt).isJumped;
  assert.ok(isBufferedJump); assert.ok(RULES.jump > 0);
});
test('旧关卡的通关目标和计分还按原来的规则', async () => {
  const { LEVELS, hasCompleted, calculateScore } = await import('../shared/levels.js');
  for (const level of LEVELS) {
    assert.equal(hasCompleted(level,level.requiredFlowers-1,level.platforms),false);
    assert.equal(hasCompleted(level,level.requiredFlowers,level.platforms),true);
    assert.equal(calculateScore(4,false,level),40);
    assert.equal(calculateScore(4,true,level),40+level.bonus);
  }
});

test('人落向正在上升的升降台时站得住，不会从台面穿过去', () => {
  // 升降台最快每帧升 0.022；从各个高度落下来，都要落在台面上。
  for (let start = 1; start < 3; start += 0.013) {
    const lift = { id: 1, x: 0, y: 0, width: 5, isMoving: true, isOneWay: true, deltaX: 0, deltaY: 0 };
    const player = { ...createPlayer(lift), y: start, vy: 0, isGrounded: false, ground: null, coyote: 0 };
    for (let frame = 0; frame < 120 && !player.isGrounded; frame++) {
      lift.deltaY = 0.022; lift.y += lift.deltaY;
      stepPlayer(player, { direction: 0, jump: false, drop: false }, [lift], dt, { minY: -50 });
    }
    assert.equal(player.ground?.id, 1, `从 ${start.toFixed(2)} 高落下穿过了升降台`);
    assert.ok(Math.abs(player.y - lift.y) < 1e-9);
  }
  // 人在台面下面往下掉时，不会被吸到台面上。
  const lift = { id: 1, x: 0, y: 0, width: 5, isMoving: true, isOneWay: true, deltaX: 0, deltaY: 0.022 };
  const below = { ...createPlayer(lift), y: -0.5, vy: -1, isGrounded: false, ground: null, coyote: 0 };
  stepPlayer(below, { direction: 0, jump: false, drop: false }, [lift], dt, { minY: -50 });
  assert.equal(below.isGrounded, false);
});

test('多层台按首次穿过的最高台面落地，与数组顺序无关', () => {
  const floor = {id:0,x:0,y:0,width:10}, upper = {id:1,x:0,y:3,width:6,isOneWay:true};
  const player = createPlayer(upper); player.y = 3.2; player.vy = -30; player.isGrounded = false;
  stepPlayer(player,{direction:0,jump:false},[floor,upper],0.15);
  assert.equal(player.y,3); assert.equal(player.ground.id,1);
  stepPlayer(player,{direction:0,drop:true},[floor,upper],dt);
  for (let i=0;i<100;i++) stepPlayer(player,{direction:0},[floor,upper],dt);
  assert.equal(player.y,0);
  stepPlayer(player,{direction:0,drop:true},[floor,upper],dt);
  assert.equal(player.y,0, '实心地面不会被下跳穿透');
});

test('踩头只算一次，侧碰后有一小段保护，不会连着撞', () => {
  const floor = {id:0,x:0,y:0,width:20};
  const monster = x => ({id:1,x,y:0,width:1.3,height:1.55,hp:1,elapsed:0,isDefeated:false});
  const enemy = monster(3), player = createPlayer(floor);
  player.x = enemy.x; player.y = enemy.y + enemy.height - 0.05; player.vy = -3;
  assert.equal(touchEnemy(player, enemy, enemy.y + enemy.height + 0.1), 'stomp');
  assert.ok(player.vy > 0); assert.equal(enemy.isDefeated, true);
  assert.equal(touchEnemy(player, enemy, player.y), null);
  const other = monster(8); player.x = other.x - 0.2; player.y = other.y; player.vy = 0;
  assert.equal(touchEnemy(player, other, player.y), 'bump');
  assert.equal(player.protection, 1); assert.equal(touchEnemy(player, other, player.y), null);
  assert.equal(other.isDefeated, false);
});
