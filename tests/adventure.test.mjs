import test from 'node:test';
import assert from 'node:assert/strict';
import { createCampaignWorld, validateCampaign, campaignScore } from '../shared/campaign.js';
import { WEAPONS, UPGRADES, MONSTERS } from '../shared/adventure-catalog.js';
import { newAdventure, newJourney, rewardChoices, queueReward, openReward, chooseReward, equipWeapon, toggleUpgrade, upgradePower, isValidAdventure } from '../src/game/adventure.js';
import { fireAdventureWeapon, stepAdventureWave } from '../src/game/adventure-combat.js';
import { stepAdventureEnemies, releaseCandyChildren } from '../src/game/adventure-enemies.js';
import { createPlayer, stepPlayer } from '../src/game/physics.js';
import { readAdventure, writeAdventure } from '../src/game/save.js';
import { openStore } from '../server/store.mjs';
const levels = ['rainbow','family','sweet','beach','meadow','snow','forest','cartoon'];
const monster = (id, x, y=0) => ({id,x,y,width:1.5,height:2,hp:20,isDefeated:false});

test('新版各主题随机分岔连接主线，旧生成版本不改变，奖励计分可复现', () => {
  const seen = new Set();
  for (const level of levels) for (let seed = 0; seed < 40; seed++) {
    const w = createCampaignWorld(seed,level,2), old = createCampaignWorld(seed,level,1);
    assert.equal(w.version,2); assert.equal(old.version,1); assert.ok(validateCampaign(w));
    assert.ok(w.forks.length >= 1, `${level}/${seed}`);
    assert.equal(w.camps.length,w.zones.length+w.forks.length+1);
    assert.ok(w.platforms.length > old.platforms.length);
    for (const f of w.forks) { assert.equal(f.routes.length,2); assert.ok(w.mainPath.includes(f.startId)); assert.ok(w.mainPath.includes(f.endId)); }
    for (const e of w.enemies) { seen.add(e.kind); assert.ok(MONSTERS[e.kind]); assert.ok(!w.platforms[e.platformId].isCheckpoint); }
    if(seed===0) assert.deepEqual(w,createCampaignWorld(seed,level,2));
    const ids=w.enemies.map(e=>e.id); assert.deepEqual(campaignScore(w,[],ids,false,0),campaignScore(w,[],[...ids,...ids],false,0));
  }
  assert.equal(seen.size,12);
});

test('新分岔每条连接使用基础跳跃可达，不需要抽到特定技能',()=>{
 for(const level of levels) for(let seed=0;seed<6;seed++) {
  const w=createCampaignWorld(seed,level,2);
  const oldCount=createCampaignWorld(seed,level,1).platforms.length;
  for(const edge of w.edges.filter(e=>e.from>=oldCount||e.to>=oldCount)) {
   const a=w.platforms[edge.from],b=w.platforms[edge.to];let isReached=false;
   for(const offset of [0,a.width/2-0.5,-a.width/2+0.5]) {
    const p=createPlayer(a);p.x+=offset;
    for(let i=0;i<360;i++) {
     stepPlayer(p,{direction:Math.abs(b.x-p.x)<0.1?0:Math.sign(b.x-p.x),jump:i===0&&edge.kind!=='drop',drop:i===0&&edge.kind==='drop'},[a,b],1/120,{minX:-10000,minY:-10000});
     if(p.ground?.id===b.id){isReached=true;break;}
    }
    if(isReached)break;
   }
   assert.ok(isReached,`${level}/${seed} ${edge.from}->${edge.to}`);
  }
 }
});

test('候选由种子固定，双人依次选择，共享收集但分别装备，重复奖励不发放',()=>{
 const a=newAdventure(42,2),j=newJourney();
 assert.equal(queueReward(j,'zone:1','flight','树冠挑战'),true);assert.equal(queueReward(j,'zone:1','flight','重复'),false);
 openReward(a,j);const pending=structuredClone(j.pending);
 assert.deepEqual(pending.choices,rewardChoices(a,'zone:1','flight'));
 assert.equal(chooseReward(a,j,999),false);assert.equal(a.revision,0);
 assert.equal(chooseReward(a,j,1),true);assert.equal(j.pending.player,1);assert.equal(a.loadouts[1].weapon,'moonblade');
 assert.equal(chooseReward(a,j,0),true);assert.equal(j.pending,null);assert.deepEqual(j.claimed,['zone:1']);
 assert.equal(queueReward(j,'zone:1','flight','重复'),false);assert.equal(chooseReward(a,j,0),false);
 assert.ok(isValidAdventure(a,2));
 const nextLevel=structuredClone(a);assert.deepEqual(nextLevel,a);assert.equal(newJourney().pending,null);
});

test('搭配可超过三个且不丢弃已收集的技能，武器专属强化按武器生效',()=>{
 const a=newAdventure(1);a.weapons.push('bubble');Object.assign(a.upgrades,{frost:1,magnet:2,rapid:1,linger:1,shield:1});
 for(const id of ['frost','magnet','rapid'])assert.ok(toggleUpgrade(a,0,id));
 assert.ok(toggleUpgrade(a,0,'shield'));assert.ok(toggleUpgrade(a,0,'linger'));assert.equal(upgradePower(a).linger,undefined);assert.equal(a.loadouts[0].upgrades.length,5);
 assert.ok(toggleUpgrade(a,0,'rapid'));assert.ok(equipWeapon(a,0,'bubble'));
 assert.equal(upgradePower(a).linger,1);equipWeapon(a,0,'bubble');assert.equal(upgradePower(a).linger,undefined);
 assert.equal(a.upgrades.linger,1);
});

test('各种武器确实命中，光刃贯穿、星镖往返、花种范围、追踪与组合有效',()=>{
 for(const weapon of Object.keys(WEAPONS)) {
  const enemies=[monster(1,6),monster(2,13)],player={x:0,y:0,facing:1};
  let waves=fireAdventureWeapon(player,0,{left:-20,right:20},weapon,{frost:1,area:1});let hits=0;
  assert.ok(waves.length);
  for(let i=1;i<480;i++){
   const spawned=[];
   for(const wave of waves){const r=stepAdventureWave(wave,enemies,[{x:10,y:0,width:40}],1/120,i/120);hits+=r.hits.length;spawned.push(...r.spawned);}
   waves=[...waves.filter(w=>w.isActive),...spawned];
  }
  assert.ok(hits>0,weapon);assert.ok(enemies.some(e=>e.slowUntil>0),weapon);
 }
 const p={x:0,y:0,facing:1};const stars=fireAdventureWeapon(p,0,{left:0,right:20},'stars',{fan:2,double:1});assert.equal(stars.length,10);
 const targets=[monster(1,6)],[blade]=fireAdventureWeapon({...p,nextShot:0},1,{left:0,right:20},'blade');
 for(let i=1;i<180;i++)stepAdventureWave(blade,targets,[],1/120,i/120+1);
 assert.equal(targets[0].hp,19);
 const [returning]=fireAdventureWeapon({...p,nextShot:0},0,{left:0,right:20},'boomerang');const enemy=monster(1,6);
 for(let i=1;i<250;i++)stepAdventureWave(returning,[enemy],[],1/120,i/120);
 assert.equal(enemy.hp,18,'去程返程各命中一次');
});

test('怪物预告、攻击和糖果分裂有界',()=>{
 const w=createCampaignWorld(19,'cartoon',2),all=Object.keys(MONSTERS).map((kind,i)=>({...monster(i+1,5),kind,behavior:MONSTERS[kind].behavior,phase:0,elapsed:0,baseY:0,minX:3,maxX:7,direction:1,speed:1}));
 const shots=[];for(let i=1;i<400;i++)stepAdventureEnemies(all,[{x:0}],1/120,i/120,shots);
 assert.ok(shots.some(s=>s.kind==='bubble'));assert.ok(shots.some(s=>s.kind==='fan'));assert.ok(shots.some(s=>s.kind==='lob'));
 const parent=w.enemies.find(e=>e.childIds);assert.ok(parent);releaseCandyChildren(parent,w.enemies);
 assert.ok(parent.childIds.every(id=>!w.enemies[id-1].isDormant));

});

test('新存档恢复候选与搭配，服务端接受新版积分且保留旧版本',()=>{
 const w=createCampaignWorld(3,'rainbow',2),a=newAdventure(3),j=newJourney();queueReward(j,'zone:0','flight','树冠挑战');openReward(a,j);
 const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 const run={id:crypto.randomUUID(),startedAt:new Date().toISOString(),seed:3,levelId:'rainbow',scoringVersion:3,generationVersion:2,players:1,status:'paused',revision:1,flowers:0,collectedIds:[],defeatedIds:[],platform:0,seconds:3};
 const state={version:2,seed:3,levelId:'rainbow',elapsed:3,collectedIds:[],defeatedIds:[],visited:[],switches:[],enemies:w.enemies,players:[{safeId:0}],adventure:a,journey:j};
 writeAdventure(run,state,storage);assert.deepEqual(readAdventure(storage).state.journey.pending,j.pending);
 state.adventure.loadouts[0].weapon='missing';writeAdventure(run,state,storage);assert.equal(readAdventure(storage),null);
 const store=openStore(':memory:');try { assert.equal(store.save(run).generationVersion,2);assert.equal(store.save({...run,id:crypto.randomUUID(),generationVersion:1}).generationVersion,1); }finally{store.close();}
});

test('新版完整主线连续移动经过所有区域、拿够宝物，内容用时逐关增加',async()=>{
 const {play}=await import('./helpers/campaign-runner.mjs');
 for(const seed of [1,42,137]){
  let previous=0;
  for(const id of levels){const result=play(id,seed,2);assert.equal(result.failed,undefined,JSON.stringify({seed,...result}));assert.equal(result.visited,result.total);assert.ok(result.collected>=result.required);assert.ok(result.seconds>previous,`${seed}/${id}`);previous=result.seconds;}
 }
});

test('快速连点和双人上一位玩家的旧事件不会领走下一份奖励',async()=>{
 const {GardenEngine}=await import('../src/game/engine.js');
 const game=Object.create(GardenEngine.prototype);
 Object.assign(game,{adventure:newAdventure(7,2),journey:newJourney(),isPaused:true,players:[{x:0,y:0}],elapsed:1,skillEffects:{burst(){}},callbacks:{onSound(){}},publish(){}});
 queueReward(game.journey,'elite','flight','精英挑战');openReward(game.adventure,game.journey);
 assert.ok(game.selectReward(0,'elite',0));
 const after=structuredClone(game.adventure);
 assert.equal(game.selectReward(0,'elite',0),false);assert.deepEqual(game.adventure,after);
 assert.ok(game.selectReward(0,'elite',1));assert.equal(game.journey.pending,null);
 assert.equal(game.selectReward(0,'elite',1),false);
});

 test('收齐武器后仍提供三个不同且有效的本领候选',()=>{
 const a=newAdventure(42);a.weapons=Object.keys(WEAPONS);
 const choices=rewardChoices(a,'all-weapons','flight');
 assert.equal(choices.length,3);assert.equal(new Set(choices.map(c=>c.id)).size,3);
 assert.ok(choices.every(c=>['upgrade','timed'].includes(c.type)));
 });
