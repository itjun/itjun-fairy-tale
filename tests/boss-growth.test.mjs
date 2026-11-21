import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_ACTS } from '../shared/levels.js';
import { createRoomWorld } from '../shared/room-world.js';
import { newSurvival, takeDamage } from '../src/game/characters.js';
import { newAdventure, weaponPressure } from '../src/game/adventure.js';
import { bossBaseline, bossTargetHp } from '../shared/boss-health.js';
import { collectGrowth, weaponDamage } from '../src/game/growth.js';
import { heal } from '../src/game/expedition.js';
import { damageEnemy } from '../src/game/combat.js';
import { fireLoadout, stepAdventureWave } from '../src/game/adventure-combat.js';
import { stepBosses, constrainBossArena, currentBoss } from '../src/game/bosses.js';
import { createPlayer, rescue } from '../src/game/physics.js';
import { readAdventure, writeAdventure } from '../src/game/save.js';
import { roomFixture } from './helpers/adventure-fixtures.mjs';
import { headless, run } from './helpers/headless-engine.mjs';
import { validateRun } from '../server/store.mjs';

const storage=()=>{const data=new Map();return {getItem:key=>data.get(key) ?? null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};
const bossOf=world=>world.enemies[world.bossArenas[0].bossId-1];

test('每个世界各有一场首领，开战前睡着，同一个种子不变',()=>{
  for(const act of WORLD_ACTS)for(const seed of [1,42,137]) {
    const w=createRoomWorld(seed,act),b=bossOf(w);
    assert.equal(w.bossArenas.length,1,act.id);assert.deepEqual(w,createRoomWorld(seed,act));
    assert.ok(b.isDormant);assert.equal(b.hp,b.maxHp);assert.equal(b.maxHp,bossBaseline(act));assert.equal(b.skills.length,2);
    assert.equal(w.finish.id,w.bossArenas[0].exitId,'终点就是首领房的出口');
  }
});

test('同一次发射各武器伤害不同，命中扣真实血量，往返与连锁不会沿用固定 1 点',()=>{
  const a=newAdventure(1);a.weapons=['blade','bubble','stars','boomerang','seed','firefly'];a.loadouts[0].weapons=[...a.weapons];a.growth.power=2;
  const p={x:0,y:0,facing:1},shots=fireLoadout(p,0,{left:-25,right:25},a);
  for(const id of a.weapons)assert.equal(shots.find(s=>s.kind===id).damage,weaponDamage(id,2));
  assert.deepEqual(a.weapons.map(id=>weaponDamage(id)),[30,55,32,34,72,22]);
  const enemy={id:1,x:3,y:0,width:2,height:3,hp:100,maxHp:100,combatVersion:2};
  const blade=shots.find(s=>s.kind==='blade');const result=stepAdventureWave(blade,[enemy],[],.2,.2);
  assert.equal(enemy.hp,64);assert.equal(result.hits[0].damage,36);
  assert.equal(stepAdventureWave(blade,[enemy],[],.01,.21).hits.length,0);
  assert.equal(fireLoadout(p,.29,{left:-25,right:25},a).length,0);
  assert.deepEqual(fireLoadout(p,.31,{left:-25,right:25},a),[], '飞行中的萤火不能继续连发');
  stepAdventureWave(shots.find(s=>s.kind==='firefly'),[enemy],[],.2,.35);
  assert.deepEqual(fireLoadout(p,.36,{left:-25,right:25},a).map(s=>s.kind),['firefly']);
});

test('收集四份材料增长血量上限和全部武器攻击，命数不变',()=>{
  const a=newAdventure(1),s=newSurvival();s.hp=70;
  for(let i=0;i<3;i++)assert.equal(collectGrowth(a,s),false);
  assert.equal(collectGrowth(a,s),true);assert.equal(s.maxHp,120);assert.equal(s.hp,90);assert.equal(s.lives,3);assert.equal(a.growth.power,1);
  heal(s,90);assert.equal(s.hp,120);takeDamage(s,false,20);assert.equal(s.hp,100);
  assert.equal(weaponDamage('blade',a.growth.power),33);assert.equal(weaponDamage('seed',a.growth.power),79);
});

test('首领进了场地才醒，活着时出不了场地，半血后两招轮着来',()=>{
  const w=createRoomWorld(42,WORLD_ACTS[6]),arena=w.bossArenas[0],boss=bossOf(w),p=createPlayer(w.platforms[arena.floorId]);
  p.x=arena.left-2;const shots=[];stepBosses(w,p,.1,.1,shots);assert.equal(currentBoss(w),undefined);
  assert.equal(damageEnemy(boss,.1,{damage:100}),false);assert.equal(boss.hp,boss.maxHp);
  p.x=arena.left+2;stepBosses(w,p,.1,.2,shots);assert.equal(currentBoss(w).id,boss.id);assert.equal(boss.isShielded,false);
  damageEnemy(boss,.3,{damage:20});assert.equal(boss.lastDamage,20);
  p.x=arena.right+5;constrainBossArena(w,p);assert.ok(p.x<arena.right);
  p.x=arena.left-5;constrainBossArena(w,p);assert.ok(p.x>arena.left);
  boss.hp=Math.floor(boss.maxHp/2);stepBosses(w,p,.1,.4,shots);assert.ok(boss.isEnraged);
});

test('每场首领出招前先预告至少 2 秒，站在场地外不会挨打',()=>{
  for(const act of WORLD_ACTS){
    const w=createRoomWorld(42,act),arena=w.bossArenas[0],b=bossOf(w),p=createPlayer(w.platforms[arena.floorId]),shots=[];
    p.x=arena.left-3;for(let n=0;n<600;n++)stepBosses(w,p,1/120,n/120,shots);
    assert.equal(shots.length,0,act.id);assert.ok(b.isDormant);
    p.x=arena.left+2;let firstWarning,firstShot;
    for(let n=0;n<900;n++){const t=n/120;stepBosses(w,p,1/120,t,shots);if(b.isWarning&&firstWarning===undefined)firstWarning=t;if(shots.length&&firstShot===undefined)firstShot=t;}
    assert.ok(firstWarning>=.19&&firstWarning<.3,act.id);assert.ok(firstShot-firstWarning>=1.99,act.id);
  }
});

test('首领没打倒不能通关，也不能伪造通关成绩；打倒后走到出口只奖励一次',()=>{
  const game=headless('finish'),boss=bossOf(game.world);
  boss.isDefeated=false;boss.hp=boss.maxHp;game.defeatedIds=game.defeatedIds.filter(id=>id!==boss.id);
  game.tick();assert.equal(game.isCompleted,false);assert.equal(game.journey.pending,null);
  const f=roomFixture('finish');f.run.status='completed';f.run.platform=game.world.zones.length;f.run.defeatedIds=f.run.defeatedIds.filter(id=>id!==boss.id);
  assert.throws(()=>validateRun(f.run),/BOSS/);
  const before={balance:game.adventure.resources.balance,maxHp:game.survival.maxHp,power:game.adventure.growth.power};
  boss.hp=0;boss.isDefeated=true;game.defeatedIds.push(boss.id);rescue(game.players[0],game.world.finish);game.tick();
  assert.ok(game.isCompleted);assert.equal(game.journey.pending.id,`finish:${game.levelKey}`);assert.equal(game.journey.pending.tier,'boss');
  assert.ok(game.journey.pending.choices.some(choice=>choice.rarity==='legendary'),'首领保底一张传奇');
  assert.equal(game.adventure.resources.balance,before.balance+6);assert.equal(game.survival.maxHp,before.maxHp+20);assert.equal(game.adventure.growth.power,before.power+1);
  // 领完奖励还站在出口上，不会再发第二份。
  assert.ok(game.selectReward(0,game.journey.pending.id,0));const claimed=structuredClone(game.adventure.growth),balance=game.adventure.resources.balance;
  game.isPaused=false;game.tick();assert.equal(game.journey.pending,null);assert.deepEqual(game.adventure.growth,claimed);assert.equal(game.adventure.resources.balance,balance);
});

test('首领的血量、招式、预告落点和成长随存档保留，改坏的状态不收',()=>{
  const g=headless('boss','forest-world');g.tick();const b=currentBoss(g.world);
  b.hp-=37;b.attackTime=.8;b.attackStage='warning';b.warningX=b.x-5;b.warningY=b.baseY+5.2;g.adventure.growth.collected=2;
  const f=roomFixture('boss','forest-world'),mem=storage();writeAdventure(f.run,g.exportState(),mem);
  const saved=readAdventure(mem);assert.ok(saved);
  const restored=headless('boss','forest-world');restored.restoreState(saved.state);const again=currentBoss(restored.world);
  assert.deepEqual([again.hp,again.maxHp,again.attackTime,again.attackStage,again.warningX,again.warningY],[b.hp,b.maxHp,.8,'warning',b.x-5,b.baseY+5.2]);
  assert.deepEqual(restored.adventure.growth,g.adventure.growth);assert.equal(restored.survival.maxHp,160);
  const invalid=structuredClone(saved);invalid.state.enemies.find(e=>e.id===b.id).attackStage='skip';writeAdventure(invalid.run,invalid.state,mem);assert.equal(readAdventure(mem),null);
});

test('轻松难度只带一把没强化的弯刀，主动跳跃躲招能在 20 秒内打赢八位首领',t=>{
  const results=[];
  for(const act of WORLD_ACTS) {
    const g=headless('boss-moon',act.id),boss=bossOf(g.world),start=g.elapsed;
    g.adventure.difficulty='easy';g.applyRoomRules();g.survival=newSurvival('little');g.players[0].protection=0;g.keys.add('KeyJ');
    run(g,25,()=>{
      if (boss.isWarning && boss.attackTime > 2 && g.players[0].isGrounded) g.keys.add('Space');
      else g.keys.delete('Space');
      return boss.isDefeated||g.survival.phase!=='alive';
    });
    const result={stage:act.id,boss:boss.name,seconds:Number((g.elapsed-start).toFixed(2)),lives:g.survival.lives,hp:boss.hp};results.push(result);
    assert.ok(boss.isDefeated,JSON.stringify(result));assert.ok(result.seconds<=20,JSON.stringify(result));assert.equal(g.survival.lives,3,JSON.stringify(result));
    assert.ok(g.defeatedIds.includes(boss.id));assert.equal(g.adventure.growth.power,0);assert.deepEqual(g.adventure.loadouts[0].weapons,['moonblade']);
    assert.ok(g.damageNumbers.filter(item=>item.enemyId===boss.id).length<=3,'伤害数字不挤在同一处');
  }
  t.diagnostic(`单弯刀战斗：${Math.min(...results.map(r=>r.seconds))}–${Math.max(...results.map(r=>r.seconds))} 秒`);
});

test('同一小段时间里首领最多掉一成二的血，普通小怪仍是一下打倒', () => {
  const boss = { isBoss: true, combatVersion: 2, hp: 1200, maxHp: 1200, isDefeated: false, attackStage: 'rest' };
  let dealt = 0;
  for (let i = 0; i < 40; i++) { damageEnemy(boss, 1, { damage: 400, x: 0 }); dealt += boss.lastDamage; }
  assert.equal(boss.isDefeated, false);
  assert.equal(dealt, Math.round(1200 * 0.12));
  damageEnemy(boss, 1.5, { damage: 400, x: 0 });
  assert.equal(boss.lastDamage, 0);
  damageEnemy(boss, 2.5, { damage: 400, x: 0 });
  assert.equal(boss.lastDamage, Math.round(1200 * 0.12));
  assert.ok(boss.hp > boss.maxHp * 0.7);
  const minion = { hp: 10, combatVersion: 2, isDefeated: false, attackStage: 'rest' };
  assert.equal(damageEnemy(minion, 1, { damage: 30, x: 0 }), true);
});

test('叠满武器按住攻击，半秒打不倒首领', () => {
  const g = headless('boss-moon', 'meadow-world');
  g.adventure.difficulty = 'normal'; g.applyRoomRules();
  g.adventure.growth.power = 6;
  g.adventure.weapons = ['blade', 'bubble', 'stars', 'boomerang', 'seed', 'firefly', 'flame', 'moonblade'];
  g.adventure.weaponRanks = Object.fromEntries(g.adventure.weapons.map(id => [id, 4]));
  g.adventure.upgrades = { double: 1, split: 1, fan: 2, rapid: 3, area: 2 };
  g.adventure.loadouts[0].weapons = [...g.adventure.weapons];
  g.adventure.loadouts[0].upgrades = Object.keys(g.adventure.upgrades);
  const boss = bossOf(g.world);
  g.keys.add('KeyJ');
  run(g, 0.5, () => boss.isDefeated);
  assert.equal(boss.isDefeated, false);
  assert.ok(boss.hp > boss.maxHp * 0.5, `半秒后还剩 ${boss.hp}/${boss.maxHp}`);
});

test('叠厚的武器开战才加厚首领，最多 1.8 倍；单把弯刀保持原血量，打掉的比例随存档保留',()=>{
  const act=WORLD_ACTS[4],plain=newAdventure(7),baseline=bossBaseline(act);
  const untouched=createRoomWorld(42,act),arena=untouched.bossArenas[0],boss=bossOf(untouched);
  stepBosses(untouched,{x:arena.left+2,y:arena.y},1/60,1,[],plain);
  assert.ok(weaponPressure(plain)<=1);assert.equal(boss.maxHp,baseline);
  const stacked=newAdventure(7);
  stacked.growth.power=5;stacked.weapons=['blade','boomerang','stars','seed','firefly','bubble','moonblade'];stacked.weaponRanks={blade:2,moonblade:2};stacked.upgrades={double:1,fan:1};
  stacked.loadouts[0].weapons=[...stacked.weapons];stacked.loadouts[0].weapon='blade';stacked.loadouts[0].upgrades=['double','fan'];
  const world=createRoomWorld(42,act),enemy=bossOf(world),half=Math.floor(baseline/2),target=bossTargetHp(act,weaponPressure(stacked));
  enemy.hp=half;stepBosses(world,{x:arena.left+2,y:arena.y},1/60,1,[],stacked);
  assert.equal(target,Math.round(baseline*1.8));assert.equal(enemy.maxHp,target);assert.equal(enemy.hp,Math.ceil(half/baseline*target));
  stepBosses(world,{x:arena.left+2,y:arena.y},1/60,2,[],stacked);assert.equal(enemy.maxHp,target,'加厚只算一次');
  const f=roomFixture('boss',act.id),mem=storage(),live=f.state.enemies.find(e=>e.isBoss&&!e.isDefeated);
  live.isDormant=false;live.maxHp=target;live.hp=target-80;
  writeAdventure(f.run,f.state,mem);const saved=readAdventure(mem);
  assert.ok(saved);assert.deepEqual([saved.state.enemies[live.id-1].maxHp,saved.state.enemies[live.id-1].hp],[target,target-80]);
  for(const corrupt of [{maxHp:target*2},{maxHp:0},{hp:target+1},{hp:-1}]) {
    const broken=roomFixture('boss',act.id);Object.assign(broken.state.enemies.find(e=>e.isBoss),{isDormant:false,maxHp:target,hp:target-80},corrupt);
    writeAdventure(broken.run,broken.state,mem);assert.equal(readAdventure(mem),null,JSON.stringify(corrupt));
  }
});

test('每位首领会用技能打到停在地面或高台不动的人，自己也会挪位置',()=>{
  const failures=[];
  for(const act of WORLD_ACTS)for(const mode of ['boss','boss-high']){
    const g=headless(mode,act.id),boss=bossOf(g.world);
    g.adventure.difficulty='normal';g.applyRoomRules();g.players[0].protection=0;
    const initialHp=g.survival.hp,initialX=boss.x;let distance=0;
    run(g,20,()=>{distance=Math.max(distance,Math.abs(boss.x-initialX));return g.survival.phase!=='alive';});
    if(g.survival.hp===initialHp||distance<1)failures.push({stage:act.id,boss:boss.name,mode,lost:initialHp-g.survival.hp,moved:Math.round(distance*10)/10});
  }
  assert.deepEqual(failures,[],'停在平台上不能一直躲过技能；首领不能一直站在原地');
});

test('高台上的落点锁定后走下高台就能躲掉，暂停冻结出招，打倒首领立刻清掉它的技能',()=>{
  const attempt=isDodge=>{
    const g=headless('boss-high','forest-world'),boss=bossOf(g.world),p=g.players[0],start=g.elapsed;p.protection=0;
    run(g,10,()=>boss.isWarning);
    const target={x:boss.warningX,y:boss.warningY},initial=g.survival.hp,warnedAt=g.elapsed;
    g.isPaused=true;const frozen=JSON.stringify({boss,p,shots:g.enemyShots});for(let i=0;i<240;i++)g.tick();assert.equal(JSON.stringify({boss,p,shots:g.enemyShots}),frozen);g.isPaused=false;
    if(isDodge)g.keys.add('ArrowLeft');
    run(g,5,()=>{if(g.elapsed>warnedAt+.8)g.keys.clear();return g.elapsed>=warnedAt+4.4;});
    assert.ok(warnedAt-start<1.2);assert.equal(boss.warningX,target.x);assert.equal(boss.warningY,target.y);
    const lost=initial-g.survival.hp;
    boss.hp=0;boss.isDefeated=true;g.rewardEnemy(boss);assert.ok(g.enemyShots.every(s=>s.bossId!==boss.id||!s.isActive));
    return lost;
  };
  assert.ok(attempt(false)>0,'站在高台原地会被打到');assert.equal(attempt(true),0,'预告时走下高台可以避开');
});
