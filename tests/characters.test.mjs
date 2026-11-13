import test from 'node:test';
import assert from 'node:assert/strict';
import { newSurvival, takeDamage, reviveSurvival, recordAttack, bloomAtHit, isValidSurvival } from '../src/game/characters.js';
import { createPlayer, stepPlayer, rescue, revivalPoint } from '../src/game/physics.js';
import { fireAdventureWeapon } from '../src/game/adventure-combat.js';
import { readAdventure, writeAdventure } from '../src/game/save.js';
import { adventureFixture } from './helpers/adventure-fixtures.mjs';
import { GardenEngine } from '../src/game/engine.js';
import { createCampaignWorld } from '../shared/campaign.js';

function storage(){ const map=new Map();return {getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)}; }
test('三格体力、九条命；扣命先进入死亡状态，重复伤害不能再扣，零命不能复活',()=>{
 const s=newSurvival('mom');
 for(let lives=8;lives>=0;lives--){assert.equal(takeDamage(s),'hurt');assert.equal(s.hp,2);assert.equal(takeDamage(s),'hurt');assert.equal(takeDamage(s),'death');assert.equal(s.lives,lives);assert.equal(takeDamage(s,true),false);assert.ok(isValidSurvival(s));assert.equal(reviveSurvival(s),lives>0);if(lives)assert.equal(s.hp,3);}
 assert.equal(s.phase,'over');assert.equal(s.hp,0);
});
test('爸爸护盾只挡怪物伤害，冷却和攻击计数序列化保留，掉坑直接扣命',()=>{
 const s=newSurvival('dad');assert.equal(takeDamage(s),'shield');assert.equal(s.hp,3);assert.equal(s.shieldRemaining,20);
 assert.equal(takeDamage(s),'hurt');assert.equal(s.hp,2);
 const restored=JSON.parse(JSON.stringify(s));assert.equal(takeDamage(restored,true),'death');assert.equal(restored.lives,8);assert.equal(restored.shieldRemaining,20);
 assert.ok(reviveSurvival(restored));assert.equal(restored.shieldRemaining,20);
});
test('妈妈姐姐按真实发射累计，每四次触发一次；花朵只在首次命中减速附近小怪',()=>{
 for(const character of ['mom','sister']){const s=newSurvival(character),p={x:0,y:0,facing:1};let emissions=0,triggers=0;
 for(let i=0;i<400;i++){const shots=fireAdventureWeapon(p,i/120,{left:0,right:20},'blade');if(shots.length){emissions++;if(recordAttack(s))triggers++;}}
 assert.equal(triggers,Math.floor(emissions/4));assert.equal(s.attacks,emissions%4);}
 const enemies=[{x:5,y:0},{x:7,y:0},{x:15,y:0}],wave={isFloral:true};
 assert.equal(bloomAtHit(wave,[],enemies,10),null);assert.ok(bloomAtHit(wave,[{enemy:enemies[0]}],enemies,10));assert.equal(enemies[1].slowUntil,12);assert.equal(enemies[2].slowUntil,undefined);assert.equal(bloomAtHit(wave,[{enemy:enemies[0]}],enemies,11),null);
 const floralCharge={isUsed:false};assert.ok(bloomAtHit({floralCharge},[{enemy:enemies[1]}],enemies,13));assert.equal(bloomAtHit({floralCharge},[{enemy:enemies[0]}],enemies,14),null);
});
test('妹妹空中只能再跳一次，落地才恢复，下跳不刷新；其他角色保持基础跳跃',()=>{
 const floor={id:0,x:0,y:0,width:30,isOneWay:true};
 for(const isDoubleJump of [false,true]){const p=createPlayer(floor);stepPlayer(p,{direction:0,jump:true,isDoubleJump},[floor],1/120);for(let i=0;i<24;i++)stepPlayer(p,{direction:0,isDoubleJump},[floor],1/120);
 const second=stepPlayer(p,{direction:0,jump:true,isDoubleJump},[floor],1/120);assert.equal(second.isJumped,isDoubleJump);
 assert.equal(stepPlayer(p,{direction:0,jump:true,isDoubleJump},[floor],1/120).isJumped,false);
 for(let i=0;i<400;i++)stepPlayer(p,{direction:0,isDoubleJump},[floor],1/120);
 assert.equal(p.isGrounded,true);assert.equal(p.isAirJumpUsed,false);p.isAirJumpUsed=true;stepPlayer(p,{direction:0,drop:true,isDoubleJump},[floor],1/120);assert.equal(p.isAirJumpUsed,true);}
});
test('旧双人存档迁移为单人，原记录备份和完整背包保留，旧成绩人数不篡改',()=>{
 const original=adventureFixture('duo'),mem=storage();writeAdventure(original.run,original.state,mem);const raw=mem.getItem('garden-active-adventure-v1');const migrated=readAdventure(mem);
 assert.equal(migrated.run.players,2);assert.equal(migrated.state.players.length,1);assert.equal(migrated.state.adventure.loadouts.length,1);assert.equal(migrated.state.journey.pending.player,0);assert.deepEqual(migrated.state.adventure.weapons,original.state.adventure.weapons);
 writeAdventure(migrated.run,migrated.state,mem);assert.equal(mem.getItem('garden-active-adventure-v1-before-single-player'),raw);assert.deepEqual(readAdventure(mem),migrated);
});
test('死亡、零命、体力和累计存档恢复原样，非法状态不能进入游戏',()=>{
 for(const mode of ['workbench','fallen','over']){const f=adventureFixture(mode),mem=storage();writeAdventure(f.run,f.state,mem);assert.deepEqual(readAdventure(mem),f);}
 const nine=adventureFixture('workbench'),nineStorage=storage();nine.state.survival.lives=9;writeAdventure(nine.run,nine.state,nineStorage);assert.equal(readAdventure(nineStorage).state.survival.lives,9);nine.state.survival.lives=10;writeAdventure(nine.run,nine.state,nineStorage);assert.equal(readAdventure(nineStorage),null);
 const f=adventureFixture('over'),mem=storage();f.state.survival.hp=3;writeAdventure(f.run,f.state,mem);assert.equal(readAdventure(mem),null);
});
function headless(){
 const f=adventureFixture('workbench'),g=Object.create(GardenEngine.prototype),world=createCampaignWorld(42,'forest',2);
 Object.assign(g,{world,platforms:world.platforms,players:[createPlayer(world.start)],survival:newSurvival('mom'),adventure:f.state.adventure,journey:f.state.journey,isPaused:false,elapsed:1,keys:new Set(),touch:new Set(),jumps:[false],waves:[],enemyShots:[],visited:new Set(),furthestPlatform:0,checkpoint:0,checkpointId:0,distance:0,collected:0,collectedIds:[],defeatedIds:[],pickups:[],skillRewards:[],camera:{right:20},cameraX:0,skillEffects:{burst(){}},treasureViews:new Map(world.treasures.map(t=>[t.id,{isCollected:true}])),callbacks:{onSound(){},onUpdate(){},onLifeChange(){}},snapshot(){return {survival:structuredClone(this.survival)};},publish(){}});
 return g;
}
test('引擎同帧掉坑和怪物接触只扣一命，死亡停住；零命不能解除暂停',()=>{
 const g=headless(),p=g.players[0];p.y=-100;p.isGrounded=false;p.safe=g.world.start;g.world.enemies[0].x=p.x;g.world.enemies[0].y=p.y;
 let saves=0;g.callbacks.onLifeChange=()=>saves++;g.tick();assert.equal(g.survival.lives,8);assert.equal(g.survival.phase,'fallen');assert.equal(g.isPaused,true);assert.equal(saves,1);
 g.tick();assert.equal(g.survival.lives,8);assert.equal(g.revive(),true);assert.equal(p.x,g.world.start.x);assert.equal(g.survival.hp,3);
 while(g.survival.lives > 0){g.hurt(true);g.revive();}g.pause(false);assert.equal(g.isPaused,true);assert.equal(g.revive(),false);
});
test('远离检查点死亡在原处复活，扣命一次且保留奖励与构筑',()=>{
 const g=headless(),p=g.players[0],platform=g.platforms.find(p=>!p.isMoving && !p.isCheckpoint && p.isEnabled!==false && p.x>50);
 rescue(p,platform,platform.x+0.5);g.survival.hp=1;
 g.collectedIds=[1];g.defeatedIds=[2];g.visited=new Set([1]);
 const adventure=structuredClone(g.adventure),journey=structuredClone(g.journey),x=p.x;
 g.hurt();assert.equal(g.survival.lives,8);assert.equal(g.survival.phase,'fallen');
 assert.equal(g.revive(),true);assert.equal(p.x,x);assert.equal(p.y,platform.y);assert.equal(p.isGrounded,true);assert.equal(p.protection,2);assert.equal(g.survival.hp,3);assert.equal(g.survival.lives,8);
 assert.notEqual(p.x,g.platforms[g.checkpointId].x);assert.deepEqual(g.adventure,adventure);assert.deepEqual(g.journey,journey);assert.deepEqual(g.collectedIds,[1]);assert.deepEqual(g.defeatedIds,[2]);assert.deepEqual([...g.visited],[1]);assert.equal(g.revive(),false);
});
test('掉坑回到最后站稳的边缘，空中死亡落到脚下，移动台死亡可原地继续',()=>{
 const floor={id:1,x:100,y:0,width:20},p=createPlayer(floor);p.x=108;
 stepPlayer(p,{direction:0},[floor],1/120);assert.equal(p.safeX,108);
 p.x=115;p.y=-20;p.isGrounded=false;p.ground=undefined;
 assert.deepEqual(revivalPoint(p,[floor],true),{platformId:1,offsetX:8});
 p.x=105;p.y=3;assert.deepEqual(revivalPoint(p,[floor],false),{platformId:1,offsetX:5});
 const lift={id:2,x:120,y:5,width:6,isMoving:true};p.x=121;p.y=5;p.isGrounded=true;p.ground=lift;
 const point=revivalPoint(p,[floor,lift],false);assert.deepEqual(point,{platformId:2,offsetX:1});rescue(p,lift,lift.x+point.offsetX);assert.equal(p.x,121);assert.equal(p.safe.id,1);assert.equal(p.safeX,108);
});
test('死亡后保存重开仍在附近继续，旧存档用最近安全平台而非旧检查点',()=>{
 const g=headless(),p=g.players[0],f=adventureFixture('fallen'),platform=g.platforms.find(p=>!p.isMoving && p.isEnabled!==false && p.x>60);
 g.seed=42;g.level={id:'forest'};g.skillState={kind:'blade',until:0,collectedIds:[]};rescue(p,platform,platform.x+0.6);g.hurt(true);
 const state=g.exportState(),mem=storage();writeAdventure(f.run,state,mem);const saved=readAdventure(mem);assert.ok(saved);assert.deepEqual(saved.state.revival,state.revival);
 const restored=headless();restored.seed=42;restored.level={id:'forest'};restored.restoreState(saved.state);assert.equal(restored.revive(),true);assert.equal(restored.players[0].x,platform.x+0.6);assert.equal(restored.survival.lives,8);
 delete saved.state.revival;delete saved.state.players[0].safeX;writeAdventure(f.run,saved.state,mem);const legacy=readAdventure(mem);restored.restoreState(legacy.state);restored.revive();assert.equal(restored.players[0].x,platform.x);
 for(const revival of [{platformId:999999,offsetX:0},{platformId:platform.id,offsetX:9999}]){writeAdventure(f.run,{...state,revival},mem);assert.equal(readAdventure(mem),null);}
});
test('引擎接触伤害保护避免同帧连扣，暂停不推进护盾冷却',()=>{
 const g=headless(),p=g.players[0];g.world.enemies=g.world.enemies.slice(0,2).map(e=>({...e,x:p.x,y:p.y,baseY:p.y,minX:p.x,maxX:p.x,speed:0,behavior:'walk',isDormant:false,isDefeated:false}));
 g.tick();assert.equal(g.survival.hp,2);g.tick();assert.equal(g.survival.hp,2);
 g.survival.character='dad';g.survival.shieldRemaining=10;g.pause(true);const before=structuredClone(g.survival);assert.deepEqual(g.snapshot().survival,before);
});
