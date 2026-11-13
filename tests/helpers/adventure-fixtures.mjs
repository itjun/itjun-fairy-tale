import { newSurvival } from '../../src/game/characters.js';
// 仅供本地隔离预览注入，生产入口不导入此文件。
import { createCampaignWorld } from '../../shared/campaign.js';
import { newAdventure, newJourney } from '../../src/game/adventure.js';
export function adventureFixture(mode = 'reward') {
  const seed = 42, levelId = 'forest', count = mode === 'duo' ? 2 : 1;
  const world = createCampaignWorld(seed, levelId, 2), adventure = newAdventure(seed, count), journey = newJourney();
  adventure.weapons = ['blade', 'boomerang', 'bubble', 'stars', 'seed', 'firefly'];
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
  if (mode !== 'duo') { state.survival = newSurvival('mom'); state.survival.hp = 2; state.survival.lives = 2; state.survival.attacks = 3; state.checkpointId = safeId; }
  if (['fallen','over'].includes(mode)) { state.survival.phase = mode; state.survival.hp = 0; if(mode === 'over')state.survival.lives=0; }
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
  survival.hp=1;
  const firstEnemy=world.enemies.find(e => e.kind==='flowerpot');
  const nearEnemy=world.platforms.filter(p => !p.isMoving && p.x < firstEnemy.x-3 && p.x > firstEnemy.x-12 && Math.abs(p.y-firstEnemy.y)<3).sort((a,b)=>b.x-a.x)[0];
  const safeId=mode==='expanded-play' ? nearEnemy?.id || 0 : 0;
  const state={version:3,seed,levelId,elapsed:0,isCompleted:false,survival,checkpointId:0,collectedIds:[],defeatedIds:[],visited:[],switches:[],enemies:world.enemies,players:[{safeId,recoveries:0,facing:1}],adventure,journey};
  const run={id:crypto.randomUUID(),startedAt:new Date().toISOString(),levelId,players:1,seed,scoringVersion:3,generationVersion:3,revision:1,status:'paused',flowers:0,collectedIds:[],defeatedIds:[],platform:0,seconds:0};
  return {run,state};
}
