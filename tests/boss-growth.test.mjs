import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES } from '../shared/levels.js';
import { createCampaignWorld, validateCampaign } from '../shared/campaign.js';
import { newSurvival, takeDamage } from '../src/game/characters.js';
import { newAdventure, newJourney, queueReward, openReward, chooseReward } from '../src/game/adventure.js';
import { collectGrowth, weaponDamage } from '../src/game/growth.js';
import { heal } from '../src/game/expedition.js';
import { damageEnemy } from '../src/game/combat.js';
import { fireLoadout, stepAdventureWave } from '../src/game/adventure-combat.js';
import { stepBosses, constrainBossArena, currentBoss } from '../src/game/bosses.js';
import { createPlayer, rescue } from '../src/game/physics.js';
import { GardenEngine } from '../src/game/engine.js';
import { readAdventure, writeAdventure } from '../src/game/save.js';
import { bossFixture, rogueliteFixture } from './helpers/adventure-fixtures.mjs';
import { validateRun } from '../server/store.mjs';

const storage=()=>{const data=new Map();return {getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};};
function headless(mode='boss-play',level='rainbow-1') {
  const f=bossFixture(mode,level),w=createCampaignWorld(f.run.seed,level,5),state=f.state;
  state.enemies.forEach((e,i)=>Object.assign(w.enemies[i],e));
  const player=createPlayer(w.platforms[state.players[0].safeId]);player.x=state.players[0].safeX;player.safeX=player.x;
  return Object.assign(Object.create(GardenEngine.prototype),{world:w,platforms:w.platforms,stage:STAGES.find(s=>s.id===level),level:STAGES.find(s=>s.id===level),levelKey:`${level}:42`,seed:42,
    players:[player],survival:state.survival,adventure:state.adventure,journey:state.journey,isPaused:false,elapsed:0,keys:new Set(),touch:new Set(),jumps:[false],waves:[],enemyShots:[],damageNumbers:[],damageSequence:0,
    visited:new Set(state.visited),furthestPlatform:state.visited.length,checkpoint:0,checkpointId:state.checkpointId,distance:0,collected:0,collectedIds:[],claimedSupplies:[],defeatedIds:state.defeatedIds,pickups:[],skillRewards:[],skillState:{kind:'blade',until:0,collectedIds:[]},
    camera:{right:24},cameraX:player.x+8,skillEffects:{burst(){}},treasureViews:new Map(w.treasures.map(t=>[t.id,{isCollected:false,kind:t.kind,mesh:{visible:true}}])),supplyViews:new Map(w.supplies.map(s=>[s.id,{visible:true}])),
    callbacks:{onSound(){},onUpdate(){},onLifeChange(){},onComplete(){}},snapshot(){return {survival:structuredClone(this.survival)};},publish(){}});
}

test('24 个小关首领与 8 个大关首领都有可达场地，旧地图保持原样',()=>{
  let bosses=0,worldBosses=0;
  for(const stage of STAGES)for(const seed of [1,42,137]) {
    const w=createCampaignWorld(seed,stage,5);assert.ok(validateCampaign(w),stage.id);
    assert.equal(w.bossArenas.length,stage.chapter===2?2:1);
    assert.deepEqual(w,createCampaignWorld(seed,stage,5));
    for(const arena of w.bossArenas){const b=w.enemies[arena.bossId-1];assert.ok(b.isDormant);assert.equal(b.hp,b.maxHp);assert.ok(b.patterns.length>=2);if(seed===1){bosses++;if(b.isWorldBoss)worldBosses++;}}
    const old=createCampaignWorld(seed,stage,4);assert.equal(old.bossArenas,undefined);assert.equal(old.treasures.length,stage.roomCount);
  }
  assert.equal(bosses,32);assert.equal(worldBosses,8);
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
  assert.deepEqual(fireLoadout(p,.31,{left:-25,right:25},a).map(s=>s.kind),['firefly']);
});

test('收集四份材料增长单一生命条和全部武器攻击，补命使用新上限',()=>{
  const a=newAdventure(1),s=newSurvival();s.lives=7;
  for(let i=0;i<3;i++)assert.equal(collectGrowth(a,s),false);
  assert.equal(collectGrowth(a,s),true);assert.equal(s.maxLives,10);assert.equal(s.lives,8);assert.equal(s.hp,undefined);assert.equal(a.growth.power,1);
  heal(s,9);assert.equal(s.lives,10);takeDamage(s,false,2);assert.equal(s.lives,8);
  assert.equal(weaponDamage('blade',a.growth.power),33);assert.equal(weaponDamage('seed',a.growth.power),79);
});

test('BOSS 进入场地才激活，活着时出口封闭，机关破盾和半血第二阶段有效',()=>{
  const w=createCampaignWorld(42,'forest-3',5),arena=w.bossArenas[1],boss=w.enemies[arena.bossId-1],p=createPlayer(w.platforms[arena.floorId]);
  const prior=w.enemies[w.bossArenas[0].bossId-1];prior.isDefeated=true;prior.hp=0;
  p.x=arena.left-2;const shots=[];stepBosses(w,p,.1,.1,shots);assert.equal(currentBoss(w),undefined);
  assert.equal(damageEnemy(boss,.1,{damage:100}),false);assert.equal(boss.hp,boss.maxHp);
  p.x=arena.left+2;stepBosses(w,p,.1,.2,shots);assert.equal(currentBoss(w).id,boss.id);assert.ok(boss.isShielded);
  damageEnemy(boss,.3,{damage:20});assert.equal(boss.lastDamage,14);assert.equal(boss.lastBlocked,6);
  p.x=arena.right+5;constrainBossArena(w,p);assert.ok(p.x<arena.right);
  p.x=arena.switchX;stepBosses(w,p,.1,.4,shots);assert.equal(boss.isShielded,false);damageEnemy(boss,.4,{damage:20});assert.equal(boss.lastDamage,20);
  p.x=arena.left+2;stepBosses(w,p,.1,12.5,shots);assert.ok(boss.isShielded);
  boss.hp=Math.floor(boss.maxHp/2);stepBosses(w,p,.1,12.6,shots);assert.ok(boss.isEnraged);
});

test('每场 BOSS 各招式先预告至少 2 秒，不能从远处触发伤害',()=>{
  for(const stage of STAGES){const w=createCampaignWorld(42,stage,5);for(const arena of w.bossArenas){
    for(const earlier of w.bossArenas.filter(a=>a.id<arena.id)){w.enemies[earlier.bossId-1].isDefeated=true;w.enemies[earlier.bossId-1].hp=0;}
    const p=createPlayer(w.platforms[arena.floorId]);p.x=arena.left+2;const shots=[];let firstWarning,firstShot;
    for(let n=0;n<900;n++){const t=n/120;stepBosses(w,p,1/120,t,shots);const b=w.enemies[arena.bossId-1];if(b.isWarning&&firstWarning===undefined)firstWarning=t;if(shots.length&&firstShot===undefined)firstShot=t;}
    assert.ok(firstWarning>=.99&&firstWarning<1.1);assert.ok(firstShot-firstWarning>=1.99,`${stage.id}/${arena.id}`);
  }}
});

test('BOSS 未击败不能通关或伪造通关计分；完成后只奖励一次',()=>{
  const game=headless('boss-finish','rainbow-3'),last=game.world.enemies.at(-1);last.isDefeated=false;last.hp=last.maxHp;game.defeatedIds=game.defeatedIds.filter(id=>id!==last.id);
  game.tick();assert.equal(game.isCompleted,undefined);assert.equal(game.journey.pending,null);
  const f=bossFixture('boss-finish','rainbow-3');f.run.status='completed';f.run.platform=game.world.zones.length;f.run.defeatedIds=[];assert.throws(()=>validateRun(f.run),/BOSS/);
  last.hp=0;last.isDefeated=true;game.defeatedIds.push(last.id);rescue(game.players[0],game.world.finish);game.tick();assert.ok(game.isCompleted);assert.equal(game.journey.pending.tier,'world');assert.equal(game.journey.pending.choices.length,4);assert.equal(game.journey.pending.pickCount,2);
  assert.equal(game.adventure.resources.balance,12);assert.equal(game.survival.maxLives,13);assert.equal(game.adventure.growth.power,3);
  const frozen=game.adventure.effects.rainbowBoost;game.tick();assert.equal(game.adventure.effects.rainbowBoost,frozen);assert.equal(game.adventure.resources.balance,12);
});

test('大关四选二必须两项不同，确认一次共同发放，恢复后候选不重抽',()=>{
  const a=newAdventure(42),j=newJourney(),s=newSurvival();queueReward(j,'boss:test','nature','大关胜利','world');openReward(a,j,s);
  const original=structuredClone(j);assert.equal(chooseReward(a,j,0,s),false);assert.equal(chooseReward(a,j,[0,0],s),false);assert.deepEqual(j,original);
  assert.equal(chooseReward(a,j,[0,1],s),true);assert.equal(j.pending,null);const after=structuredClone(a);assert.equal(chooseReward(a,j,[0,1],s),false);assert.deepEqual(a,after);
  assert.equal(queueReward(j,'boss:test','nature','大关胜利','world'),false);
});

test('BOSS 血量、招式、护盾剩余时间与成长完整续存，非法状态拒绝',()=>{
  const g=headless('boss-play','forest-3');g.tick();const b=currentBoss(g.world);b.hp-=37;b.attackTime=.8;b.attackStage='warning';b.warningX=b.x-5;b.warningY=b.baseY+5.2;b.shieldUntil=5;g.adventure.growth.collected=2;g.elapsed=1;
  const f=bossFixture(),mem=storage();writeAdventure(f.run,g.exportState(),mem);const saved=readAdventure(mem);assert.ok(saved);const restored=headless('boss-play','forest-3');restored.restoreState(saved.state);
  assert.equal(currentBoss(restored.world).hp,b.hp);assert.equal(currentBoss(restored.world).attackTime,.8);assert.equal(currentBoss(restored.world).shieldUntil,5);assert.equal(currentBoss(restored.world).warningX,b.x-5);assert.equal(currentBoss(restored.world).warningY,b.baseY+5.2);assert.deepEqual(restored.adventure.growth,g.adventure.growth);assert.equal(restored.survival.maxLives,12);
  const invalid=structuredClone(saved);invalid.state.enemies.find(e=>e.id===b.id).attackStage='skip';writeAdventure(invalid.run,invalid.state,mem);assert.equal(readAdventure(mem),null);
});

test('旧生命档先备份再升级，旧版地图和剩余生命不被重抽',()=>{
  const f=rogueliteFixture(),mem=storage();f.state.survival.version=2;delete f.state.survival.maxLives;delete f.state.adventure.growth;
  writeAdventure(f.run,f.state,mem);const original=mem.getItem('garden-active-adventure-v1');const saved=readAdventure(mem);assert.ok(saved);assert.equal(saved.state.version,4);assert.equal(saved.state.survival.lives,6);assert.equal(saved.state.survival.maxLives,9);
  writeAdventure(saved.run,saved.state,mem);assert.equal(mem.getItem('garden-active-adventure-v1-before-boss-growth'),original);
});

test('初始单光刃能打赢首关 BOSS，伤害数字不挤在同一处',()=>{
  const g=headless('boss-small','rainbow-1');g.adventure=newAdventure(42);g.adventure.weapons=['blade'];g.adventure.loadouts[0].weapons=['blade'];g.survival=newSurvival('dad');g.keys.add('KeyJ');
  const b=g.world.enemies.at(-1);for(let n=0;n<3600&&!b.isDefeated&&g.survival.phase==='alive';n++){g.elapsed+=1/120;g.tick();}
  assert.ok(b.isDefeated);assert.ok(g.elapsed<30);assert.ok(g.survival.lives>0);assert.ok(g.defeatedIds.includes(b.id));
  assert.ok(g.damageNumbers.filter(item=>item.enemyId===b.id).length<=3);
});

test('未强化的一把弯刀能在 35 秒内打赢全部 32 位 BOSS，保留足够生命容错',t=>{
  const results=[];
  for(const stage of STAGES)for(const index of stage.chapter===2?[0,1]:[0]) {
    const g=headless(index===0?'boss-small':'boss-play',stage.id),arena=g.world.bossArenas[index],boss=g.world.enemies[arena.bossId-1];
    g.adventure=newAdventure(42);g.survival=newSurvival('little');
    rescue(g.players[0],g.world.platforms[arena.floorId],arena.left+3);g.players[0].protection=0;g.keys.add('KeyJ');
    // 不走位、不踩破盾机关、无护盾或追加攻击天赋，验证初始单武器的容错。
    for(let n=0;n<4200&&!boss.isDefeated&&g.survival.phase==='alive';n++){g.elapsed+=1/120;g.tick();}
    const result={stage:stage.id,boss:boss.name,seconds:Number(g.elapsed.toFixed(2)),lives:g.survival.lives,hp:boss.hp};results.push(result);
    assert.ok(boss.isDefeated,JSON.stringify(result));assert.ok(g.survival.lives>=3,JSON.stringify(result));
    assert.equal(g.adventure.growth.power,0);assert.deepEqual(g.adventure.loadouts[0].weapons,['moonblade']);
  }
  assert.equal(results.length,32);
  t.diagnostic(`单弯刀战斗：${Math.min(...results.map(r=>r.seconds))}–${Math.max(...results.map(r=>r.seconds))} 秒；最少剩余 ${Math.min(...results.map(r=>r.lives))}/9 生命`);
});

test('旧 BOSS 按剩余比例降低血量，死亡状态和重复存取稳定，首次覆盖前备份',()=>{
  for(const hasMaxHp of [false,true])for(const fraction of [0,.37,1]) {
    const f=bossFixture('boss-play','forest-3'),stage=STAGES.find(s=>s.id===f.run.levelId),mem=storage();
    const boss=f.state.enemies.at(-1),currentMax=boss.maxHp;
    for(const e of f.state.enemies)if(e.isBoss){const oldMax=e.isWorldBoss?660+stage.worldIndex*650:240+stage.index*90;e.maxHp=oldMax;e.hp=e.isDefeated?0:oldMax;}
    boss.hp=Math.floor(boss.maxHp*fraction);const expected=Math.ceil(boss.hp/boss.maxHp*currentMax);
    if(!fraction){boss.isDefeated=true;f.state.defeatedIds.push(boss.id);}
    if(!hasMaxHp)for(const e of f.state.enemies)delete e.maxHp;
    writeAdventure(f.run,f.state,mem);const original=mem.getItem('garden-active-adventure-v1');
    const saved=readAdventure(mem);assert.ok(saved);assert.equal(saved.state.enemies.at(-1).hp,expected);assert.equal(saved.state.enemies.at(-1).maxHp,currentMax);
    assert.deepEqual(saved.state.defeatedIds,f.state.defeatedIds);assert.deepEqual(saved.state.adventure,f.state.adventure);
    for(let i=0;i<3;i++){writeAdventure(saved.run,saved.state,mem);assert.deepEqual(readAdventure(mem),saved);}
    if(!hasMaxHp)assert.equal(mem.getItem('garden-active-adventure-v1-before-easier-combat'),original);
  }
  for(const corrupt of [{maxHp:999999},{maxHp:0},{hp:4561},{hp:-1}]) {
    const f=bossFixture('boss-play','forest-3'),mem=storage();Object.assign(f.state.enemies.at(-1),{maxHp:4560,hp:2280},corrupt);
    writeAdventure(f.run,f.state,mem);assert.equal(readAdventure(mem),null);
  }
});

test('包含首领场地的 72 局主路连续可达，沿途平台玩法仍完整',async()=>{
  const {play}=await import('./helpers/campaign-runner.mjs');
  for(const stage of STAGES)for(const seed of [1,42,137]){
    const result=play(stage.id,seed,5);assert.equal(result.failed,undefined,JSON.stringify({seed,...result}));assert.equal(result.recoveries,0,stage.id);assert.equal(result.visited,result.total,stage.id);
  }
});

test('每位 BOSS 会用技能威胁停留在地面或高台的玩家，并主动调整位置',()=>{
  const failures=[];
  for(const stage of STAGES)for(const index of stage.chapter===2?[0,1]:[0])for(const isHigh of [false,true]){
    const g=headless(index===0?'boss-small':'boss-play',stage.id),arena=g.world.bossArenas[index],boss=g.world.enemies[arena.bossId-1];
    const ledges=g.world.platforms.filter(p=>p.zone===g.world.platforms[arena.floorId].zone && p.id!==arena.exitId);
    const perch=isHigh?ledges.reduce((a,b)=>a.y>b.y?a:b):g.world.platforms[arena.floorId];
    rescue(g.players[0],perch,isHigh?perch.x:arena.left+2);g.players[0].protection=0;
    const initialLives=g.survival.lives,initialX=boss.x;let distance=0;
    for(let n=0;n<2400 && g.survival.phase==='alive';n++){g.elapsed+=1/120;g.tick();distance=Math.max(distance,Math.abs(boss.x-initialX));}
    if(g.survival.lives===initialLives || distance<1)failures.push({stage:stage.id,boss:boss.name,isHigh,lost:initialLives-g.survival.lives,moved:Math.round(distance*10)/10});
  }
  assert.deepEqual(failures,[], '停在平台不能永久躲过技能；BOSS 不能始终站在原地');
});


test('高台树根锁定位置后可躲开，暂停冻结出招，击败立即清除其技能',()=>{
  const run=isDodge=>{
    const g=headless('boss-high','forest-3'),boss=g.world.enemies.at(-1),p=g.players[0];p.protection=0;
    while(!boss.isWarning){g.elapsed+=1/120;g.tick();}
    const target={x:boss.warningX,y:boss.warningY},initial=g.survival.lives;
    g.isPaused=true;const frozen=JSON.stringify({boss,p,shots:g.enemyShots});for(let i=0;i<240;i++)g.tick();assert.equal(JSON.stringify({boss,p,shots:g.enemyShots}),frozen);g.isPaused=false;
    if(isDodge)g.keys.add('ArrowLeft');
    while(g.elapsed<3.4){if(g.elapsed>1.3)g.keys.clear();g.elapsed+=1/120;g.tick();}
    assert.equal(boss.warningX,target.x);assert.equal(boss.warningY,target.y);
    const lost=initial-g.survival.lives;
    boss.hp=0;boss.isDefeated=true;g.rewardEnemy(boss);assert.ok(g.enemyShots.every(s=>s.bossId!==boss.id||!s.isActive));
    return lost;
  };
  assert.ok(run(false)>0,'站在高台原地会被树根打到');assert.equal(run(true),0,'预告时离开高台落点可以避开');
});
