import { newSurvival } from '../../src/game/characters.js';
// 仅供本地隔离预览注入，生产入口不导入此文件。
import { createCampaignWorld } from '../../shared/campaign.js';
import { newAdventure, newJourney } from '../../src/game/adventure.js';
import { newCombatLoot, rollCombatLoot } from '../../src/game/combat-loot.js';
export function adventureFixture(mode = 'reward') {
  const seed = 42, levelId = 'forest', count = mode === 'duo' ? 2 : 1;
  const world = createCampaignWorld(seed, levelId, 2), adventure = newAdventure(seed, count), journey = newJourney();
  adventure.weapons = ['blade', 'moonblade', 'boomerang', 'bubble', 'stars', 'seed', 'firefly'];
  adventure.upgrades = { frost:1, split:1, magnet:1, double:1, landing:1, companion:1, returnSplit:1 };
  adventure.loadouts.forEach(l => { l.weapon = 'boomerang'; l.upgrades = ['frost', 'returnSplit']; });
  if (mode === 'reward' || mode === 'duo') { delete adventure.upgrades.returnSplit; adventure.loadouts.forEach(l => { l.upgrades = ['frost', 'split']; }); }
  const fork = world.forks[0];
  let safeId = fork.startId;
  if (mode === 'reward' || mode === 'duo') journey.pending = { id:'zone:0',family:'flight',title:'蘑菇挑战完成',player:0,choices:[{type:'upgrade',id:'frost'},{type:'upgrade',id:'returnSplit'},{type:'upgrade',id:'magnet'}] };
  const isCompleted = mode === 'completed';
  if (isCompleted) safeId = world.finish.id;
  const collectedIds = isCompleted ? world.treasures.slice(0,world.requiredFlowers).map(t=>t.id) : [];
  const state = { version:2,seed,levelId,elapsed:30,isCompleted,collectedIds,defeatedIds:[],visited:isCompleted ? world.zones.map(z=>z.id+1) : [],switches:[],enemies:world.enemies,players:Array.from({length:count},()=>({safeId,recoveries:0,facing:1})),adventure,journey };
  if (mode !== 'duo') { state.survival = newSurvival('mom'); state.survival.lives = 2; state.survival.attacks = 3; state.checkpointId = safeId; }
  if (['fallen','over'].includes(mode)) { state.survival.phase = mode; state.survival.hp=0; if(mode === 'over')state.survival.lives=0; }
  if (mode === 'fallen') {
    const platform=world.platforms.find(p=>!p.isMoving && !p.isCheckpoint && p.isEnabled!==false && p.x>60);
    state.checkpointId=world.start.id;state.players[0].safeId=platform.id;state.players[0].safeX=platform.x+0.6;
    state.revival={platformId:platform.id,offsetX:0.6};
  }
  const run = { id:crypto.randomUUID(),startedAt:new Date().toISOString(),levelId,players:count,seed,scoringVersion:3,generationVersion:2,revision:1,status:mode === 'over' ? 'ended' : isCompleted?'completed':'paused',flowers:collectedIds.length,collectedIds,defeatedIds:[],platform:state.visited.length,seconds:30 };
  return {run,state};
}

export function expansionFixture(mode = 'expanded-reward') {
  const seed=42, levelId='rainbow', world=createCampaignWorld(seed,levelId,3), adventure=newAdventure(seed), journey=newJourney(), survival=newSurvival('sister');
  adventure.resources.balance=18;
  adventure.upgrades={chain:1,petal:1,recycle:1,armor:1,snack:1,bind:1,feather:1,cleanse:1,guide:1,thrift:1};
  adventure.loadouts[0].upgrades=['petal','recycle','armor'];
  if(mode==='expanded-reward') { delete adventure.upgrades.petal;delete adventure.upgrades.recycle;adventure.loadouts[0].upgrades=['armor'];journey.pending={id:'preview:choice',family:'nature',title:'挑战完成',player:0,choices:[{type:'upgrade',id:'chain'},{type:'upgrade',id:'petal'},{type:'upgrade',id:'recycle'}]}; }
  survival.lives=7;
  const firstEnemy=world.enemies.find(e => e.kind==='flowerpot');
  const nearEnemy=world.platforms.filter(p => !p.isMoving && p.x < firstEnemy.x-3 && p.x > firstEnemy.x-12 && Math.abs(p.y-firstEnemy.y)<3).sort((a,b)=>b.x-a.x)[0];
  const safeId=mode==='expanded-play' ? nearEnemy?.id || 0 : 0;
  const state={version:3,seed,levelId,elapsed:0,isCompleted:false,survival,checkpointId:0,collectedIds:[],defeatedIds:[],visited:[],switches:[],enemies:world.enemies,players:[{safeId,recoveries:0,facing:1}],adventure,journey};
  const run={id:crypto.randomUUID(),startedAt:new Date().toISOString(),levelId,players:1,seed,scoringVersion:3,generationVersion:3,revision:1,status:'paused',flowers:0,collectedIds:[],defeatedIds:[],platform:0,seconds:0};
  return {run,state};
}

export function rogueliteFixture(mode = 'rogue-play', levelId = 'rainbow-1', zoneIndex = 0) {
  const seed=42,world=createCampaignWorld(seed,levelId,4),adventure=newAdventure(seed),journey=newJourney(),survival=newSurvival('sister');
  const zone=world.zones[Math.min(zoneIndex,world.zones.length-1)];
  let safeId=zone.startId;
  if(mode==='rogue-stack'){adventure.weapons=['blade','bubble','boomerang'];adventure.loadouts[0].weapons=[...adventure.weapons];adventure.loadouts[0].weapon=adventure.weapons[0];adventure.upgrades={frost:1,chain:1,double:1,wide:1,magnet:1};adventure.loadouts[0].upgrades=Object.keys(adventure.upgrades);adventure.effects={rainbowBoost:40,frostTreat:75};}
  if(mode==='rogue-traps'){safeId=world.hazards[0]?.platformId || safeId;}
  if(mode==='rogue-finish')safeId=world.finish.id;
  if(mode==='rogue-score')safeId=world.treasures[0].platformId;
  survival.lives=6;
  if(mode==='rogue-fallen'){survival.phase='fallen';survival.hp=0;}
  const visited=world.zones.filter(z=>z.id<zoneIndex || mode==='rogue-finish').map(z=>z.id+1);
  const state={version:4,seed,levelId,elapsed:0,isCompleted:false,survival,checkpointId:safeId,collectedIds:[],defeatedIds:[],visited,switches:[],enemies:world.enemies,players:[{safeId,...(mode==='rogue-score'?{safeX:world.treasures[0].x-2}:{}),protection:2,recoveries:0,facing:1}],adventure,journey,supplies:[],mechanisms:[]};
  if(mode==='rogue-fallen')state.revival={platformId:safeId,offsetX:0};
  const run={id:crypto.randomUUID(),startedAt:new Date().toISOString(),levelId,players:1,seed,scoringVersion:3,generationVersion:4,revision:1,status:'paused',flowers:0,collectedIds:[],defeatedIds:[],platform:visited.length,seconds:0};
  return {run,state};
}

export function bossFixture(mode='boss-play',levelId='forest-3') {
  const seed=42,world=createCampaignWorld(seed,levelId,5),adventure=newAdventure(seed),journey=newJourney(),survival=newSurvival('sister');
  if(!['boss-moon','boss-homing','boss-stack-reward'].includes(mode)&&!mode.startsWith('boss-loot')) {
    adventure.weapons=['blade','bubble','boomerang'];adventure.loadouts[0].weapons=[...adventure.weapons];adventure.loadouts[0].weapon=adventure.weapons[0];adventure.growth={collected:3,power:2,hearts:3};adventure.effects={rainbowBoost:40};
    survival.maxHp=160;survival.hp=140;
  }
  const arena=world.bossArenas[['boss-small','boss-moon'].includes(mode)?0:world.bossArenas.length-1];
  const defeatedIds=[];
  for(const prior of world.bossArenas.filter(a=>a.id<arena.id)){const e=world.enemies[prior.bossId-1];e.hp=0;e.isDefeated=true;e.isDormant=false;e.defeatedAt=0;defeatedIds.push(e.id);}
  let safeId=arena.floorId,safeX=arena.left+3;
  if(mode==='boss-moon')safeX=arena.left+9;
  if(['boss-high','boss-homing'].includes(mode)){const high=world.platforms.filter(p=>p.zone===world.platforms[arena.floorId].zone&&p.id!==arena.exitId).sort((a,b)=>b.y-a.y)[0];safeId=high.id;safeX=high.x;}
  if(mode==='boss-growth'){safeId=world.treasures[0].platformId;safeX=world.treasures[0].x-2;}
  if(mode==='boss-finish'){for(const a of world.bossArenas){const e=world.enemies[a.bossId-1];e.hp=0;e.isDefeated=true;e.isDormant=false;e.defeatedAt=0;if(!defeatedIds.includes(e.id))defeatedIds.push(e.id);}safeId=world.finish.id;safeX=world.finish.x;}
  if(mode==='boss-stack-reward')journey.pending={id:'qa:weapon-stack',family:'flight',title:'小关通关啦',player:0,tier:'small',pickCount:1,choices:[{type:'weapon',id:'moonblade'},{type:'weapon',id:'stars'},{type:'upgrade',id:'frost'}]};
  let combatLoot;
  if(mode.startsWith('boss-loot')) {
    combatLoot=newCombatLoot();survival.hp=50;
    for(const enemy of world.enemies.filter(e=>!e.isBoss&&!e.parentId&&!e.isSummoned)) {
      enemy.hp=0;enemy.isDefeated=true;enemy.defeatedAt=0;defeatedIds.push(enemy.id);
      const drop=rollCombatLoot(combatLoot,world,enemy,{safe:world.start});
      if(drop){safeId=drop.platformId;safeX=world.platforms[safeId].x+drop.offsetX;if(mode==='boss-loot-pending')combatLoot.pendingId=drop.enemyId;break;}
    }
  }
  const state={version:5,seed,levelId,elapsed:0,isCompleted:false,survival,checkpointId:safeId,collectedIds:[],defeatedIds,visited:world.zones.filter(z=>z.id<world.platforms[safeId].zone).map(z=>z.id+1),switches:[],enemies:world.enemies,players:[{safeId,safeX,protection:2,recoveries:0,facing:mode==='boss-homing'?-1:1}],adventure,journey,supplies:[],mechanisms:[]};
  if(combatLoot)state.combatLoot=combatLoot;
  const run={id:crypto.randomUUID(),startedAt:new Date().toISOString(),levelId,players:1,seed,scoringVersion:3,generationVersion:5,revision:1,status:'paused',flowers:0,collectedIds:[],defeatedIds,platform:state.visited.length,seconds:0};
  return {run,state};
}
