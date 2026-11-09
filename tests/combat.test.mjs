import test from 'node:test';
import assert from 'node:assert/strict';
import {fireWave,fireSkill,stepWave,moveCampaignPlatforms} from '../src/game/combat.js';
import {createSkillRewards,currentSkill,skillSeconds,takeSkillReward} from '../src/game/skills.js';
import {createPlayer,stepPlayer} from '../src/game/physics.js';
import {touchEnemy} from '../src/game/enemies.js';
import {createCampaignWorld,campaignScore} from '../shared/campaign.js';
import {openStore} from '../server/store.mjs';
import {readAdventure,writeAdventure} from '../src/game/save.js';
const monster=(x=4,y=0)=>({id:1,x,y,width:1,height:1.5,hp:1,elapsed:0,isDefeated:false});
test('光刃左右与空中贯穿当前屏幕、平台和多个目标，屏幕外不误伤',()=>{
 for(const facing of [-1,1]) for(const halfWidth of [12,24,80]) {
 const player={x:0,y:3,facing};
 const enemies=[4,halfWidth-1,halfWidth+6].map((x,i)=>({...monster(facing*x,3),id:i+1}));
 const wave=fireWave(player,1,{left:-halfWidth,right:halfWidth});
 const hits=stepWave(wave,enemies,[{x:facing*3,y:4.5,width:1}],2,3);
 assert.deepEqual(hits.map(h=>h.enemy.id),[1,2]);
 assert.equal(enemies[2].isDefeated,false);assert.equal(wave.isActive,false);
 }
 const strong={...monster(4),hp:2,width:5};
 const wave=fireWave({x:0,y:0,facing:1},0);
 stepWave(wave,[strong],[],0.08,0.08);
 stepWave(wave,[strong],[],0.01,0.09);
 assert.equal(strong.hp,1,'同一光刃停留在同一只怪体内不重复扣血');
});
test('按住发射间隔及双人同帧、踩头和光波不重复击败',()=>{
 const p={x:0,y:0,facing:1},e=monster();
 assert.ok(fireWave(p,0)); assert.equal(fireWave(p,0.2),null);assert.ok(fireWave(p,0.4));
 const a=fireWave({...p,nextShot:0},1),b=fireWave({...p,nextShot:0},1);
 assert.equal(stepWave(a,[e],[],0.3,1.3)[0].isDefeated,true);
 assert.deepEqual(stepWave(b,[e],[],0.3,1.3),[]);
 assert.equal(touchEnemy({x:4,y:1,vy:-3,protection:0},e,2),null);
 const strong=monster();strong.hp=2;
 assert.equal(stepWave(fireWave({...p,nextShot:0},2),[strong],[],0.3,2.3)[0].isDefeated,false);
 assert.equal(touchEnemy({x:4,y:1.5,vy:-3,protection:0},strong,2),'stomp');
});
test('魔法泡泡爆开范围命中，彩虹星雨覆盖高低目标',()=>{
 const p={x:0,y:0,facing:1};
 const enemies=[{...monster(5),id:1},{...monster(5,2),id:2},{...monster(13),id:3}];
 const [bubble]=fireSkill(p,0,{left:-24,right:24},'bubble');
 const hits=stepWave(bubble,enemies,[],0.5,0.5);
 assert.deepEqual(hits.map(h=>h.enemy.id),[1,2]);
 assert.ok(bubble.burst);assert.equal(bubble.isActive,false);
 assert.deepEqual(stepWave(bubble,enemies,[],1,1),[]);
 const stars=fireSkill({...p,nextShot:0},0,{left:-24,right:24},'stars');
 assert.equal(stars.length,5);
 const high={...monster(10,3),id:7},low={...monster(10,-3),id:8};
 for(const star of stars) stepWave(star,[high,low],[],0.5,0.5);
 assert.equal(high.isDefeated,true);assert.equal(low.isDefeated,true);
});
test('技能奖励随种子变化、落在可达主线，两种强化共享且不重复领取',()=>{
 for(const level of ['rainbow','family','sweet','beach','meadow','snow','forest','cartoon']) for(let seed=0;seed<50;seed++) {
 const world=createCampaignWorld(seed,level),before=JSON.stringify(world),rewards=createSkillRewards(world);
 assert.equal(JSON.stringify(world),before);
 assert.deepEqual(rewards,createSkillRewards(world));
 assert.equal(new Set(rewards.map(r=>r.kind)).size,2);
 assert.equal(rewards.length,world.zones.length*2);
 for(const r of rewards){assert.ok(world.mainPath.includes(r.platformId));assert.equal(world.platforms[r.platformId].isMoving,undefined);}
 }
 assert.notDeepEqual(createSkillRewards(createCampaignWorld(1,'rainbow')),createSkillRewards(createCampaignWorld(2,'rainbow')));
 const state={kind:'blade',until:0,collectedIds:[]};
 assert.equal(takeSkillReward(state,{id:1,kind:'bubble'},10),true);
 assert.equal(takeSkillReward(state,{id:1,kind:'bubble'},20),false);
 assert.equal(state.until,42);assert.equal(currentSkill(state,41.9),'bubble');assert.equal(currentSkill(state,42),'blade');
 assert.equal(takeSkillReward(state,{id:2,kind:'stars'},30),true);
 assert.equal(currentSkill(state,30),'stars');assert.equal(state.until,62);
 assert.equal(skillSeconds({until:52.32000000000001},20.32),32);
 assert.equal(skillSeconds(state,62),0);
});
test('新版服务端积分拒绝伪造分值、合并乱序奖励，终局只奖励一次',()=>{
 const store=openStore(':memory:'),world=createCampaignWorld(18,'sweet');
 try{
 const run={id:crypto.randomUUID(),startedAt:new Date().toISOString(),levelId:'sweet',players:2,seed:18,scoringVersion:3,generationVersion:1,flowers:1,collectedIds:[1],defeatedIds:[1],platform:1,seconds:10,revision:1,status:'playing',score:999999};
 const first=store.save(run);assert.equal(first.score,campaignScore(world,[1],[1],false,100).score);
 const merged=store.save({...run,collectedIds:[2],defeatedIds:[2],revision:2});
 assert.deepEqual(merged.collectedIds,[1,2]);assert.deepEqual(merged.defeatedIds,[1,2]);
 assert.equal(store.save(run).score,merged.score);
 assert.throws(()=>store.save({...run,defeatedIds:[1,1]}));
 const ids=world.treasures.slice(0,world.requiredFlowers).map(t=>t.id);
 const end=store.save({...run,collectedIds:ids,flowers:ids.length,platform:world.zones.length,defeatedIds:[1,2],status:'completed',revision:3});
 assert.equal(store.save({...run,revision:4}).score,end.score);
 }finally{store.close();}
});
test('存档同种子保留奖励、小怪生命、机关与恢复点，损坏内容不进入游戏',()=>{
 const world=createCampaignWorld(42,'sweet'), map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 const run={seed:42,levelId:'sweet',scoringVersion:3,generationVersion:1,players:1,status:'paused'};
 const state={version:1,seed:42,levelId:'sweet',elapsed:42,collectedIds:[1],defeatedIds:[1],visited:[1],switches:[0],players:[{safeId:0}],enemies:world.enemies};
 writeAdventure(run,state,storage);assert.deepEqual(readAdventure(storage),{run,state});
 state.skillState={kind:'bubble',until:62,collectedIds:[1]};
 writeAdventure(run,state,storage);assert.deepEqual(readAdventure(storage).state.skillState,state.skillState);
 assert.equal(currentSkill(readAdventure(storage).state.skillState,42),'bubble');
 state.skillState.until=999;writeAdventure(run,state,storage);assert.equal(readAdventure(storage),null);
 state.skillState={kind:'stars',until:62,collectedIds:[1,1]};writeAdventure(run,state,storage);assert.equal(readAdventure(storage),null);
 delete state.skillState;
 state.players[0].safeId=99999;writeAdventure(run,state,storage);assert.equal(readAdventure(storage),null);
});
test('八关移动台可搭乘抵达另一端，横向载人不掉队，机关桥可开通',()=>{
 for(const id of ['beach','meadow','snow','forest','cartoon']) for(let seed=0;seed<5;seed++){
 const w=createCampaignWorld(seed,id);
 for(const lift of w.lifts){
 const end=w.platforms[w.edges.find(e=>e.from===lift.id&&e.kind==='ride').to];
 const p=createPlayer(lift);
 for(let frame=1;frame<=330;frame++){
 moveCampaignPlatforms([lift],frame/120);
 stepPlayer(p,{direction:0},[lift],1/120,{minX:-10000,minY:-10000});
 assert.equal(p.ground?.id,lift.id,`${id}/${seed} 留在升降台`);
 }
 assert.ok(Math.abs(p.x-lift.x)<0.01);
 let isLanded=false;
 for(let frame=1;frame<=180;frame++){
 moveCampaignPlatforms([lift],2.75+frame/120);
 stepPlayer(p,{direction:Math.sign(end.x-p.x),jump:frame===1},[lift,end],1/120,{minX:-10000,minY:-10000});
 if(p.ground?.id===end.id){isLanded=true;break;}
 }
 assert.ok(isLanded,`${id}/${seed} 从移动台上岸`);
 }
 }
});
