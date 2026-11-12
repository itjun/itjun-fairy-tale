import { newSurvival, isValidSurvival } from './characters.js';
import { createCampaignWorld, GENERATION_VERSION } from '../../shared/campaign.js';
import { createSkillRewards, isValidSkillState } from './skills.js';
import { isValidAdventure, isValidJourney } from './adventure.js';
const KEY = ['garden','active','adventure','v1'].join('-');
export function writeAdventure(run,state,storage=localStorage) {
  const original = storage.getItem(KEY);
  if (original && !JSON.parse(original).state?.survival && !storage.getItem(`${KEY}-before-single-player`)) storage.setItem(`${KEY}-before-single-player`, original);
  storage.setItem(KEY,JSON.stringify({run,state}));
}
export function clearAdventure(storage=localStorage) { storage.removeItem(KEY); }
export function readAdventure(storage=localStorage) {
  try {
    const saved=JSON.parse(storage.getItem(KEY));
    if(!saved) return null;
    const {run,state}=saved;
    if(run.scoringVersion!==3 || ![1,2].includes(run.generationVersion) || !['playing','paused','completed','ended'].includes(run.status) || ![1,2].includes(run.players) || !Number.isInteger(run.seed) || !Number.isFinite(state.elapsed) || state.elapsed<0 || state.version!==run.generationVersion || state.seed!==run.seed || state.levelId!==run.levelId) return null;
    const count = state.survival ? 1 : run.players;
    if (state.survival && (!isValidSurvival(state.survival) || state.isCompleted && state.survival.phase !== 'alive' || run.status === 'ended' && state.survival.phase !== 'over')) return null;
    if (!state.survival && run.status === 'ended') return null;
    const world=createCampaignWorld(run.seed,run.levelId,run.generationVersion);
    if (state.version === 2 && (!isValidAdventure(state.adventure, count) || !isValidJourney(state.journey, world, count))) return null;
    if (!isValidSkillState(state.skillState, createSkillRewards(world), state.elapsed)) return null;
    if(!Array.isArray(state.players)||state.players.length!==count||state.players.some(p=>!world.platforms[p.safeId]||world.platforms[p.safeId].isMoving))return null;
    const isIds=(ids,limit,start=1)=>Array.isArray(ids)&&ids.every(id=>Number.isInteger(id)&&id>=start&&id<=limit)&&new Set(ids).size===ids.length;
    if(!isIds(state.collectedIds,world.treasures.length)||!isIds(state.defeatedIds,world.enemies.length)||!isIds(state.visited,world.zones.length)||!isIds(state.switches,world.switches.length-1,0))return null;
    if(!Array.isArray(state.enemies)||state.enemies.length!==world.enemies.length||state.enemies.some((e,i)=>e.id!==i+1||![e.x,e.y,e.hp,e.elapsed,e.direction].every(Number.isFinite)))return null;
    if (state.version === 2 && state.enemies.some((e,i) => e.hp < 0 || e.hp > world.enemies[i].hp || e.elapsed < 0 || ![-1,1].includes(e.direction) || typeof e.isDefeated !== 'boolean' || e.isDefeated !== state.defeatedIds.includes(e.id))) return null;
    if (state.checkpointId !== undefined && (!world.platforms[state.checkpointId] || world.platforms[state.checkpointId].isMoving)) return null;
    if (!state.survival) {
      // 保留原双人记录的计分人数；玩法只迁移第一位，背包仍完整保留。
      state.survival = newSurvival('sister'); state.players = state.players.slice(0,1);
      state.checkpointId = state.players[0].safeId;
      if (state.adventure) { state.adventure.loadouts = state.adventure.loadouts.slice(0,1); if (state.journey.pending) state.journey.pending.player = 0; }
    }
    return saved;
  } catch { return null; }
}
