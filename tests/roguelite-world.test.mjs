import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES } from '../shared/levels.js';
import { createCampaignWorld, validateCampaign } from '../shared/campaign.js';
import { createPlayer, stepPlayer } from '../src/game/physics.js';
import { hazardState, touchingHazard, stepMechanisms, takeLifeSupply, mechanismSave, restoreMechanisms } from '../src/game/hazards.js';
import { newSurvival } from '../src/game/characters.js';
import { newAdventure, newJourney, chooseReward, upgradePower, tickEffects } from '../src/game/adventure.js';
import { fireLoadout } from '../src/game/adventure-combat.js';
import { GardenEngine } from '../src/game/engine.js';
import { readAdventure, writeAdventure } from '../src/game/save.js';
import { rogueliteFixture } from './helpers/adventure-fixtures.mjs';
import { openStore } from '../server/store.mjs';

const memory = () => { const data=new Map();return {getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)}; };

test('24 小关各有结构语法，新局改变房间与分路，同一种子完整重建',()=>{
  assert.equal(STAGES.length,24);assert.equal(new Set(STAGES.map(s=>s.structure)).size,24);
  const roomKinds=new Set(),hazards=new Set();
  for(const stage of STAGES){
    const signatures=new Set();
    for(let seed=0;seed<40;seed++){
      const w=createCampaignWorld(seed,stage,4);assert.ok(validateCampaign(w),`${stage.id}/${seed}`);
      signatures.add(w.signature);w.zones.forEach(z=>roomKinds.add(z.kind));w.hazards.forEach(h=>hazards.add(h.kind));
      assert.equal(w.supplies.length,1);assert.equal(w.treasures.length,w.zones.length);assert.equal(w.requiredFlowers,0);
      assert.ok(w.hazards.length>0);assert.ok(w.forks.length>0);assert.ok(w.routeGraph.some(n=>n.next.length>1));
      if(seed===0)assert.deepEqual(w,createCampaignWorld(seed,stage,4));
    }
    assert.ok(signatures.size>15,stage.id);
  }
  assert.ok(roomKinds.size>=20);assert.equal(hazards.size,5);
});

test('全部小关主路与支路连接都能用基础跳跃、下跳、弹簧或升降台通过',()=>{
  for(const stage of STAGES)for(const seed of [1,42,137]){
    const world=createCampaignWorld(seed,stage,4);
    for(const edge of world.edges){
      const a={...world.platforms[edge.from]},b={...world.platforms[edge.to],isEnabled:true};
      if(edge.kind==='ride'){if(a.axis==='x')a.x+=a.travel;else a.y+=a.travel;}
      let isReached=false;
      for(const offset of [0,a.width/2-.5,-a.width/2+.5]){
        const p=createPlayer(a,offset);
        if(edge.kind==='spring'){p.vy=18;p.isGrounded=false;}
        for(let frame=0;frame<480;frame++){
          stepPlayer(p,{direction:Math.abs(b.x-p.x)<.08?0:Math.sign(b.x-p.x),jump:frame===0&&!['drop','spring'].includes(edge.kind),drop:frame===0&&edge.kind==='drop'},[a,b],1/120,{minX:-10000,minY:-10000});
          if(p.ground?.id===b.id){isReached=true;break;}
        }
        if(isReached)break;
      }
      assert.ok(isReached,`${stage.id}/${seed} ${edge.from}->${edge.to}`);
    }
  }
});

test('72 局连续移动经过真实坡面、冰面、坍塌和升降窗口，支路能回到终点',async()=>{
  const {play}=await import('./helpers/campaign-runner.mjs');
  for(const seed of [1,42,137])for(const stage of STAGES){
    const result=play(stage.id,seed,4);
    assert.equal(result.failed,undefined,JSON.stringify({seed,...result}));
    assert.equal(result.recoveries,0,JSON.stringify({seed,...result}));
    assert.equal(result.visited,result.total);
  }
});

test('在向下倾斜的平台行走时脚底持续贴合台面，不漏到下层',()=>{
  const ground={id:0,x:0,y:0,width:12,slope:-.22},p=createPlayer(ground);
  for(let i=0;i<100;i++){stepPlayer(p,{direction:1},[ground],1/120);assert.equal(p.isGrounded,true);assert.ok(Math.abs(p.y-p.x*ground.slope)<.001);}
});

test('陷阱预告不伤人，启动才命中；坍塌与跷跷板状态恢复不重置',()=>{
  const h={kind:'thorns',x:0,y:0,phase:0,period:7,warning:1.35,active:1.35};
  assert.ok(hazardState(h,.5).isWarning);assert.equal(touchingHazard({x:0,y:0},h,.5),false);
  assert.ok(touchingHazard({x:0,y:0},h,1.5));assert.equal(touchingHazard({x:0,y:0,protection:1},h,1.5),false);
  const world={platforms:[{id:0,isCrumbling:true},{id:1,isSeesaw:true,x:0,slope:0}]};
  stepMechanisms(world,{ground:world.platforms[0]},2,.1);assert.equal(world.platforms[0].collapseAt,4.2);
  stepMechanisms(world,{ground:world.platforms[1],x:3,y:0},4.4,.1);assert.equal(world.platforms[0].isEnabled,false);
  const clone={platforms:[{id:0,isCrumbling:true},{id:1,isSeesaw:true,x:0,slope:0}]};
  restoreMechanisms(clone,mechanismSave(world),4.4);assert.equal(clone.platforms[0].isEnabled,false);assert.equal(clone.platforms[1].slope,world.platforms[1].slope);
  stepMechanisms(clone,{},8.3,.1);assert.equal(clone.platforms[0].isEnabled,true);
});

test('补命道具只领一次，满命可留下或用已装备本领存一份备用',()=>{
  const world={supplies:[{id:'life:0',x:0,y:1}]},p={x:0,y:0},s=newSurvival(),a=newAdventure(1),claimed=[];
  assert.equal(takeLifeSupply(world,claimed,p,s,a),null);s.lives=8;
  assert.ok(takeLifeSupply(world,claimed,p,s,a));assert.equal(s.lives,9);s.lives=8;
  assert.equal(takeLifeSupply(world,claimed,p,s,a),null);assert.equal(s.lives,8);
  s.lives=9;a.upgrades.snack=1;
  assert.equal(takeLifeSupply(world,[],p,s,a,upgradePower(a)),null);
  a.loadouts[0].upgrades.push('snack');
  assert.ok(takeLifeSupply(world,[],p,s,a,upgradePower(a)));assert.equal(a.resources.snack,1);assert.equal(s.lives,9);
  assert.equal(takeLifeSupply(world,[],p,s,a,upgradePower(a)),null);
});

test('生命上限成长后地图补给继续回血，满血才存备用且不超过上限',()=>{
  const world={supplies:[{id:'life:0',x:0,y:1}]},p={x:0,y:0},s=newSurvival(),a=newAdventure(1);
  s.maxLives=12;s.lives=9;
  assert.ok(takeLifeSupply(world,[],p,s,a,upgradePower(a)));assert.equal(s.lives,10);
  a.upgrades.snack=1;a.loadouts[0].upgrades.push('snack');
  assert.ok(takeLifeSupply(world,[],p,s,a,upgradePower(a)));assert.equal(s.lives,11);assert.equal(a.resources.snack,0);
  assert.ok(takeLifeSupply(world,[],p,s,a,upgradePower(a)));assert.equal(s.lives,12);
  assert.ok(takeLifeSupply(world,[],p,s,a,upgradePower(a)));assert.equal(s.lives,12);assert.equal(a.resources.snack,1);
});

test('多武器同时发射，专属强化正确隔离，限时效果到期只移除自身',()=>{
  const a=newAdventure(1),j=newJourney();
  for(const choice of [{type:'weapon',id:'bubble'},{type:'weapon',id:'boomerang'},{type:'upgrade',id:'linger'},{type:'timed',id:'rainbowBoost'}]){
    j.pending={id:choice.id,player:0,choices:[choice]};assert.ok(chooseReward(a,j,0,newSurvival()));
  }
  const p={x:0,y:0,facing:1};const waves=fireLoadout(p,0,{left:-20,right:20},a);
  assert.deepEqual(new Set(waves.map(w=>w.kind)),new Set(['moonblade','bubble','boomerang']));assert.equal(waves.length,6);
  assert.equal(upgradePower(a,0,'blade').linger,undefined);assert.equal(upgradePower(a,0,'bubble').linger,1);
  assert.equal(fireLoadout(p,.1,{left:-20,right:20},a).length,0);
  tickEffects(a,15);assert.equal(a.effects.rainbowBoost,45);tickEffects(a,45);
  assert.deepEqual(a.effects,{});assert.equal(fireLoadout(p,61,{left:-20,right:20},a).length,3);assert.equal(a.upgrades.linger,1);
});

function atFinish(){
  const fixture=rogueliteFixture('rogue-finish'),world=createCampaignWorld(42,'rainbow-1',4);
  return Object.assign(Object.create(GardenEngine.prototype),{world,platforms:world.platforms,stage:STAGES[0],level:STAGES[0],levelKey:'rainbow-1:42',seed:42,players:[createPlayer(world.finish)],survival:fixture.state.survival,adventure:fixture.state.adventure,journey:newJourney(),isPaused:false,elapsed:1,keys:new Set(),touch:new Set(),jumps:[false],waves:[],enemyShots:[],visited:new Set(),furthestPlatform:0,checkpoint:0,checkpointId:0,distance:0,collected:0,collectedIds:[],claimedSupplies:[],defeatedIds:[],pickups:[],skillRewards:[],skillState:{kind:'blade',until:0,collectedIds:[]},camera:{right:20},cameraX:world.finish.x,skillEffects:{burst(){}},treasureViews:new Map(world.treasures.map(t=>[t.id,{isCollected:true}])),callbacks:{onSound(){},onUpdate(){},onLifeChange(){},onComplete(){}},snapshot(){return {survival:structuredClone(this.survival)};},publish(){}});
}

test('通关才弹一次奖励，连续帧与重开不重复，暂停和通关等待不耗限时',()=>{
  const game=atFinish();game.adventure.effects.rainbowBoost=40;
  game.tick();assert.ok(game.isCompleted);assert.ok(game.isPaused);assert.equal(game.journey.pending.id,'finish:rainbow-1:42');assert.equal(game.adventure.resources.balance,3);
  const remaining=game.adventure.effects.rainbowBoost;game.tick();assert.equal(game.adventure.effects.rainbowBoost,remaining);
  const fixture=rogueliteFixture('rogue-finish'),storage=memory();fixture.run.status='completed';fixture.run.platform=game.world.zones.length;
  writeAdventure(fixture.run,game.exportState(),storage);const saved=readAdventure(storage);assert.ok(saved);assert.equal(saved.state.adventure.effects.rainbowBoost,remaining);
  const restored=atFinish();restored.restoreState(saved.state);restored.pause(true);
  const id=restored.journey.pending.id;assert.ok(restored.selectReward(0,id,0));assert.equal(restored.selectReward(0,id,0),false);restored.tick();assert.equal(restored.adventure.resources.balance,3);
  assert.equal(restored.adventure.effects.rainbowBoost,remaining);
});

test('生命旧档先备份再去掉体力，24 小关服务端计分与历史主题同时兼容',()=>{
  const f=rogueliteFixture('rogue-stack'),storage=memory();f.state.survival={...f.state.survival,version:1,hp:2};
  writeAdventure(f.run,f.state,storage);const original=storage.getItem('garden-active-adventure-v1');const saved=readAdventure(storage);assert.ok(saved);
  assert.equal(saved.state.survival.hp,undefined);assert.equal(saved.state.survival.lives,6);assert.deepEqual(saved.state.adventure.effects,{rainbowBoost:40,frostTreat:75});
  writeAdventure(saved.run,saved.state,storage);assert.equal(storage.getItem('garden-active-adventure-v1-before-life-only'),original);
  const db=openStore(':memory:');try{for(const stage of STAGES){const row={...saved.run,id:crypto.randomUUID(),levelId:stage.id};assert.equal(db.save(row).levelId,stage.id);}}finally{db.close();}
});
