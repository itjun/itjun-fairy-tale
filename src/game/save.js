import { createCampaignWorld, GENERATION_VERSION } from '../../shared/campaign.js';
import { createSkillRewards, isValidSkillState } from './skills.js';
const KEY = ['garden','active','adventure','v1'].join('-');
export function writeAdventure(run,state,storage=localStorage) { storage.setItem(KEY,JSON.stringify({run,state})); }
export function clearAdventure(storage=localStorage) { storage.removeItem(KEY); }
export function readAdventure(storage=localStorage) {
  try {
    const saved=JSON.parse(storage.getItem(KEY));
    if(!saved) return null;
    const {run,state}=saved;
    if(run.scoringVersion!==3 || run.generationVersion!==GENERATION_VERSION || !['playing','paused'].includes(run.status) || ![1,2].includes(run.players) || !Number.isInteger(run.seed) || !Number.isFinite(state.elapsed) || state.elapsed<0 || state.version!==GENERATION_VERSION || state.seed!==run.seed || state.levelId!==run.levelId) return null;
    const world=createCampaignWorld(run.seed,run.levelId);
    if (!isValidSkillState(state.skillState, createSkillRewards(world), state.elapsed)) return null;
    if(!Array.isArray(state.players)||state.players.length!==run.players||state.players.some(p=>!world.platforms[p.safeId]||world.platforms[p.safeId].isMoving))return null;
    const isIds=(ids,limit,start=1)=>Array.isArray(ids)&&ids.every(id=>Number.isInteger(id)&&id>=start&&id<=limit)&&new Set(ids).size===ids.length;
    if(!isIds(state.collectedIds,world.treasures.length)||!isIds(state.defeatedIds,world.enemies.length)||!isIds(state.visited,world.zones.length)||!isIds(state.switches,world.switches.length-1,0))return null;
    if(!Array.isArray(state.enemies)||state.enemies.length!==world.enemies.length||state.enemies.some((e,i)=>e.id!==i+1||![e.x,e.y,e.hp,e.elapsed,e.direction].every(Number.isFinite)))return null;
    return saved;
  } catch { return null; }
}
