import test from 'node:test';
import assert from 'node:assert/strict';
import { newSurvival, takeDamage, reviveSurvival, recordAttack, bloomAtHit, isValidSurvival } from '../src/game/characters.js';
import { createPlayer, stepPlayer, rescue, revivalPoint } from '../src/game/physics.js';
import { fireAdventureWeapon } from '../src/game/adventure-combat.js';
import { readAdventure, writeAdventure } from '../src/game/save.js';
import { roomFixture } from './helpers/adventure-fixtures.mjs';
import { headless } from './helpers/headless-engine.mjs';

function storage(){ const map=new Map();return {getItem:k=>map.get(k) ?? null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)}; }
test('三条命包含当前血条；受伤扣血，归零扣一命，继续不再扣命，零命禁止复活',()=>{
 const s=newSurvival('mom');assert.equal(s.hp,100);assert.equal(s.lives,3);
 assert.equal(takeDamage(s),'hurt');assert.equal(s.hp,90);assert.equal(s.lives,3);
 assert.equal(takeDamage(s,true),'hurt');assert.equal(s.hp,65);assert.equal(s.phase,'alive');
 for(let lives=2;lives>=0;lives--){
   assert.equal(takeDamage(s,false,9999),'death');assert.equal(s.lives,lives);assert.equal(s.hp,0);assert.ok(isValidSurvival(s));
   assert.equal(takeDamage(s),false);assert.equal(reviveSurvival(s),lives>0);assert.equal(s.lives,lives);
   if(lives)assert.equal(s.hp,100);
 }
 assert.equal(s.phase,'over');assert.equal(reviveSurvival(s),false);
});
test('爸爸护盾先挡伤害，冷却与血量序列化保留，掉坑只扣血',()=>{
 const s=newSurvival('dad');assert.equal(takeDamage(s),'shield');assert.equal(s.hp,100);assert.equal(s.lives,3);assert.equal(s.shieldRemaining,20);
 assert.equal(takeDamage(s),'hurt');assert.equal(s.hp,90);
 const restored=JSON.parse(JSON.stringify(s));assert.equal(takeDamage(restored,true),'hurt');assert.equal(restored.hp,65);assert.equal(restored.shieldRemaining,20);
 restored.hp=10;assert.equal(takeDamage(restored,true),'death');assert.equal(restored.lives,2);assert.ok(reviveSurvival(restored));assert.equal(restored.shieldRemaining,20);assert.equal(restored.hp,100);
});
test('妈妈姐姐按真实发射累计，每四次触发一次；花朵只在首次命中减速附近小怪',()=>{
 for(const character of ['mom','sister']){const s=newSurvival(character),p={x:0,y:0,facing:1};let emissions=0,triggers=0;
 for(let i=0;i<400;i++){const shots=fireAdventureWeapon(p,i/120,{left:0,right:20},'blade');if(shots.length){emissions++;if(recordAttack(s))triggers++;}}
 assert.equal(triggers,Math.floor(emissions/4));assert.equal(s.attacks,emissions%4);}
 const enemies=[{x:5,y:0},{x:7,y:0},{x:15,y:0}],wave={isFloral:true};
 assert.equal(bloomAtHit(wave,[],enemies,10),null);assert.ok(bloomAtHit(wave,[{enemy:enemies[0]}],enemies,10));assert.equal(enemies[1].slowUntil,12);assert.equal(enemies[2].slowUntil,undefined);assert.equal(bloomAtHit(wave,[{enemy:enemies[0]}],enemies,11),null);
 const floralCharge={isUsed:false};assert.ok(bloomAtHit({floralCharge},[{enemy:enemies[1]}],enemies,13));assert.equal(bloomAtHit({floralCharge},[{enemy:enemies[0]}],enemies,14),null);
});
test('四位角色空中只能再跳一次，落地才恢复，下跳不刷新',()=>{
 const floor={id:0,x:0,y:0,width:30,isOneWay:true};
 for(const character of ['dad','mom','sister','little']){const p=createPlayer(floor);p.character=character;stepPlayer(p,{direction:0,jump:true},[floor],1/120);for(let i=0;i<24;i++)stepPlayer(p,{direction:0},[floor],1/120);
 const second=stepPlayer(p,{direction:0,jump:true},[floor],1/120);assert.equal(second.isJumped,true,character);
 assert.equal(stepPlayer(p,{direction:0,jump:true},[floor],1/120).isJumped,false,character);
 for(let i=0;i<400;i++)stepPlayer(p,{direction:0},[floor],1/120);
 assert.equal(p.isGrounded,true,character);assert.equal(p.isAirJumpUsed,false,character);p.isAirJumpUsed=true;stepPlayer(p,{direction:0,drop:true},[floor],1/120);assert.equal(p.isAirJumpUsed,true,character);}
});
test('死亡、零命和累计存档恢复原样，非法状态不能进入游戏',()=>{
 for(const mode of ['door','fallen','over']){const {run,state}=roomFixture(mode),mem=storage();writeAdventure(run,state,mem);assert.deepEqual(readAdventure(mem),JSON.parse(JSON.stringify({run,state})));}
 const nine=roomFixture(),nineStorage=storage();nine.state.survival.lives=9;writeAdventure(nine.run,nine.state,nineStorage);assert.equal(readAdventure(nineStorage).state.survival.lives,9);nine.state.survival.lives=1000;writeAdventure(nine.run,nine.state,nineStorage);assert.equal(readAdventure(nineStorage),null);
 const f=roomFixture('over'),mem=storage();f.state.survival.hp=3;writeAdventure(f.run,f.state,mem);assert.equal(readAdventure(mem),null);
});
// 开场房清完的森林关，标准难度（轻松档掉坑不扣血），人放回起点。
function game(){
 const g=headless('door','forest-world');g.adventure.difficulty='normal';g.applyRoomRules();g.survival=newSurvival('mom');
 rescue(g.players[0],g.world.start);g.players[0].recoveries=0;g.players[0].protection=0;
 return g;
}
const quiet=g=>g.platforms.find(p=>p.roomId===0&&p.id!==g.world.start.id&&!p.isMoving&&!p.isCrumbling&&!p.isSeesaw&&!p.slope&&!p.isCheckpoint&&p.isEnabled!==false&&p.width>=4);
test('引擎同帧掉坑和怪物接触只扣一命，死亡停住；零命不能解除暂停',()=>{
 const g=game(),p=g.players[0];g.survival.hp=20;p.y=-100;p.isGrounded=false;p.safe=g.world.start;g.world.enemies[0].x=p.x;g.world.enemies[0].y=p.y;
 let saves=0;g.callbacks.onLifeChange=()=>saves++;g.tick();assert.equal(g.survival.lives,2);assert.equal(g.survival.phase,'fallen');assert.equal(g.isPaused,true);assert.equal(saves,1);
 g.tick();assert.equal(g.survival.lives,2);assert.equal(g.revive(),true);assert.equal(p.x,g.world.start.x);assert.equal(g.survival.hp,100);
 while(g.survival.lives > 0){g.hurt(true);g.revive();}g.pause(false);assert.equal(g.isPaused,true);assert.equal(g.revive(),false);
});
test('轻松档掉坑不扣血，只送回刚才站稳的地方',()=>{
 const g=game(),p=g.players[0];g.adventure.difficulty='easy';g.applyRoomRules();
 p.y=-100;p.isGrounded=false;g.tick();
 assert.equal(g.survival.hp,100);assert.equal(g.survival.lives,3);assert.equal(p.x,g.world.start.x);assert.equal(p.y,g.world.start.y);assert.equal(g.roomState.isFallen,true);
});
test('离起点很远的地方死亡在原处复活，扣命一次且保留奖励与构筑',()=>{
 const g=game(),p=g.players[0],platform=quiet(g);
 rescue(p,platform,platform.x+0.5);
 g.collectedIds=[1];g.visited=new Set([1]);
 const adventure=structuredClone(g.adventure),journey=structuredClone(g.journey),defeated=[...g.defeatedIds],x=p.x;
 g.survival.hp=20;g.hurt(true);assert.equal(g.survival.lives,2);assert.equal(g.survival.phase,'fallen');
 assert.equal(g.revive(),true);assert.equal(p.x,x);assert.equal(p.y,platform.y);assert.equal(p.isGrounded,true);assert.equal(p.protection,3);assert.equal(g.survival.hp,100);assert.equal(g.survival.lives,2);
 assert.notEqual(p.x,g.world.start.x);assert.deepEqual(g.adventure,adventure);assert.deepEqual(g.journey,journey);assert.deepEqual(g.collectedIds,[1]);assert.deepEqual(g.defeatedIds,defeated);assert.deepEqual([...g.visited],[1]);assert.equal(g.revive(),false);
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
test('死亡后保存重开仍在原处继续，复活点对不上地图的存档不收',()=>{
 const g=game(),p=g.players[0],f=roomFixture('door','forest-world'),platform=quiet(g);
 rescue(p,platform,platform.x+0.6);g.survival.hp=20;g.hurt(true);
 const state=g.exportState(),mem=storage();writeAdventure(f.run,state,mem);const saved=readAdventure(mem);assert.ok(saved);assert.deepEqual(saved.state.revival,state.revival);
 const restored=game();restored.restoreState(saved.state);assert.equal(restored.revive(),true);assert.equal(restored.players[0].x,platform.x+0.6);assert.equal(restored.survival.lives,2);
 for(const revival of [{platformId:999999,offsetX:0},{platformId:platform.id,offsetX:9999}]){writeAdventure(f.run,{...state,revival},mem);assert.equal(readAdventure(mem),null);}
});
test('引擎接触伤害保护避免同帧连扣，暂停不推进护盾冷却',()=>{
 const g=game(),p=g.players[0];
 for(const e of g.world.enemies.slice(0,2))Object.assign(e,{x:p.x,y:p.y,baseY:p.y,minX:p.x,maxX:p.x,speed:0,behavior:'walk',touchDamage:undefined,hp:1,isDormant:false,isDefeated:false});
 g.tick();assert.equal(g.survival.hp,90);assert.equal(g.survival.lives,3);g.tick();assert.equal(g.survival.hp,90);
 g.survival.character='dad';g.survival.shieldRemaining=10;g.pause(true);const before=structuredClone(g.survival);assert.deepEqual(g.snapshot().survival,before);
});
