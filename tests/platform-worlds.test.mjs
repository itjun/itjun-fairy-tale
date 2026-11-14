import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../shared/levels.js';
import { createWorld, movePlatforms } from '../src/game/world.js';
import { createPlayer, stepPlayer, regroup } from '../src/game/physics.js';
import { stepEnemies, touchEnemy, touchSpring } from '../src/game/enemies.js';
const dt = 1 / 120;

test('八关使用三种真正分层的地图，宝物编号兼容已有计分，随机种子可重现', () => {
  assert.equal(new Set(LEVELS.map(level => level.route)).size, 3);
  for (const level of LEVELS) for (let seed = 0; seed < 80; seed++) {
    const world = createWorld(seed, level);
    assert.deepEqual(world, createWorld(seed, level));
    assert.notDeepEqual(world, createWorld(seed + 1, level));
    assert.deepEqual(world.treasures.map(t => t.id), Array.from({length:level.platforms}, (_, i) => i + 1));
    assert.ok(Math.max(...world.platforms.map(p => p.y)) - Math.min(...world.platforms.map(p => p.y)) >= 6.4);
    assert.ok(world.platforms.some(a => world.platforms.some(b => a.y - b.y > 3 && Math.abs(a.x - b.x) < (a.width + b.width) / 2)));
    for (const treasure of world.treasures) {
      const support = world.platforms.find(p => p.id === treasure.platformId);
      assert.ok(Math.abs(treasure.x - support.x) < support.width / 2);
      assert.equal(treasure.y, support.y + 1.15);
    }
    assert.equal(world.enemies.length, 3);
    assert.equal(world.finish.progress, level.platforms);
  }
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

test('叶台完整往返时角色稳定随行，离台起跳与静态复活点独立', () => {
  const world=createWorld(7,LEVELS.find(l=>l.id==='forest')), lift=world.lifts[0];
  const player=createPlayer(world.start); player.x=lift.x; player.y=lift.y; player.ground=lift;
  for(let frame=1;frame<=1080;frame++) {
    movePlatforms(world.lifts,frame*dt);
    stepPlayer(player,{direction:0},world.platforms,dt,world);
    assert.ok(Math.abs(player.y-lift.y)<0.001, `frame ${frame}`);
    assert.ok(!player.safe.isMoving);
  }
  assert.equal(stepPlayer(player,{direction:-1,jump:true},world.platforms,dt,world).isJumped,true);
  assert.ok(player.vy>0);
});

test('地下底部不会误触发掉落恢复，弹簧花跳高和深坑恢复都有效', () => {
  const world=createWorld(1,LEVELS.find(l=>l.id==='sweet'));
  const spring=world.springs[0], floor=world.platforms.find(p=>p.id===spring.platformId);
  const player=createPlayer(floor); player.x=spring.x;
  for(let i=0;i<300;i++) stepPlayer(player,{direction:0},world.platforms,dt,world);
  assert.equal(player.recoveries,0); assert.equal(player.y,floor.y);
  assert.equal(touchSpring(player,spring),true);
  let highest=player.y;
  for(let i=0;i<70;i++) {stepPlayer(player,{direction:0},world.platforms,dt,world);highest=Math.max(highest,player.y);}
  assert.ok(highest>floor.y+6);
  player.y=world.minY-1;
  assert.equal(stepPlayer(player,{direction:0},world.platforms,dt,world).isRescued,true);
  assert.equal(player.safe.id,floor.id);
});

test('小怪巡逻不会离台，踩头只触发一次，侧碰保护避免连撞', () => {
  const world=createWorld(4,LEVELS[0]), enemy=world.enemies[0];
  for(let i=0;i<6000;i++) {stepEnemies(world.enemies,dt);assert.ok(enemy.x>=enemy.minX&&enemy.x<=enemy.maxX);}
  const player=createPlayer(world.start);player.x=enemy.x;player.y=enemy.y+enemy.height-0.05;player.vy=-3;
  assert.equal(touchEnemy(player,enemy,enemy.y+enemy.height+0.1),'stomp');
  assert.ok(player.vy>0);assert.equal(enemy.isDefeated,true);
  assert.equal(touchEnemy(player,enemy,player.y),null);
  const other=world.enemies[2];player.x=other.x-0.2;player.y=other.y;player.vy=0;
  assert.equal(touchEnemy(player,other,player.y),'bump');
  assert.equal(player.protection,1);assert.equal(touchEnemy(player,other,player.y),null);
  assert.equal(other.isDefeated,false);
});

test('双人纵向分离后会合到静态安全台', () => {
  const world=createWorld(6,LEVELS[0]), a=createPlayer(world.start),b=createPlayer(world.finish);
  a.x=b.x;a.y=20;
  assert.equal(regroup([a,b]),true);assert.equal(a.y,b.safe.y);
});

// 直接运行游戏物理，逐条寻找可落地的跳跃/下跳，再检查所有宝物均可到达且可返回终点。
function canReach(world, from, to) {
  const platforms = world.platforms.map(p => ({...p, y: p.isMoving ? (p.id === from.id ? p.baseY + p.travel : 0.1) : p.y}));
  const a = platforms[from.id], b = platforms[to.id];
  for (const isJump of [true, false]) {
    const player = createPlayer(a);
    player.x = Math.max(a.x-a.width/2+0.6, Math.min(a.x+a.width/2-0.6,b.x));
    for(let frame=0;frame<240;frame++) {
      stepPlayer(player, {direction:Math.abs(player.x-b.x)>.1?Math.sign(b.x-player.x):0, jump:isJump&&frame===0, drop:!isJump&&frame===0},platforms,dt,world);
      if(player.ground?.id===b.id)return true;
      if(player.recoveries)break;
    }
  }
  return false;
}
function reachable(edges, start) {
  const seen=new Set([start]),queue=[start];
  while(queue.length)for(const id of edges.get(queue.shift())||[])if(!seen.has(id)){seen.add(id);queue.push(id);}
  return seen;
}
test('各路线在 20 个种子下所有平台和宝物可达，且均能返回终点', () => {
  for(const level of LEVELS)for(let seed=0;seed<20;seed++) {
    const world=createWorld(seed,level),edges=new Map(),reverse=new Map();
    for(const a of world.platforms)for(const b of world.platforms)if(a.id!==b.id&&canReach(world,a,b)) {
      if(!edges.has(a.id))edges.set(a.id,[]);edges.get(a.id).push(b.id);
      if(!reverse.has(b.id))reverse.set(b.id,[]);reverse.get(b.id).push(a.id);
    }
    const fromStart=reachable(edges,world.start.id),toFinish=reachable(reverse,world.finish.id);
    for(const p of world.platforms) {
      assert.ok(fromStart.has(p.id),`${level.id}/${seed}: 无法到达 ${p.id}`);
      assert.ok(toFinish.has(p.id),`${level.id}/${seed}: ${p.id} 无法返回终点`);
    }
  }
});
