import { newSurvival, isValidSurvival, migrateSurvival } from './characters.js';
import { createCampaignWorld, GENERATION_VERSION } from '../../shared/campaign.js';
import { createSkillRewards, isValidSkillState } from './skills.js';
import { isValidAdventure, isValidJourney, migrateAdventure } from './adventure.js';
import { WEAPONS } from '../../shared/adventure-catalog.js';
import { isValidBossState } from './bosses.js';
import { isValidCombatLoot } from './combat-loot.js';
import { STAGES } from '../../shared/levels.js';
const KEY = ['garden','active','adventure','v1'].join('-');
export function writeAdventure(run,state,storage=localStorage) {
  const original = storage.getItem(KEY);
  if (original && !JSON.parse(original).state?.survival && !storage.getItem(`${KEY}-before-single-player`)) storage.setItem(`${KEY}-before-single-player`, original);
  if (original && JSON.parse(original).state?.survival?.version === 1 && !storage.getItem(`${KEY}-before-life-only`)) storage.setItem(`${KEY}-before-life-only`, original);
  if (original && JSON.parse(original).state?.survival?.version < 3 && !storage.getItem(`${KEY}-before-boss-growth`)) storage.setItem(`${KEY}-before-boss-growth`, original);
  if (original && JSON.parse(original).state?.enemies?.some(e=>e.attackStage&&e.maxHp===undefined) && !storage.getItem(`${KEY}-before-easier-combat`)) storage.setItem(`${KEY}-before-easier-combat`, original);
  storage.setItem(KEY,JSON.stringify({run,state}));
}
export function clearAdventure(storage=localStorage) { storage.removeItem(KEY); }
export function readAdventure(storage=localStorage) {
  try {
    const saved=JSON.parse(storage.getItem(KEY));
    if(!saved) return null;
    const {run,state}=saved;
    if(run.scoringVersion!==3 || ![1,2,3,4,5].includes(run.generationVersion) || !['playing','paused','completed','ended'].includes(run.status) || ![1,2].includes(run.players) || !Number.isInteger(run.seed) || !Number.isFinite(state.elapsed) || state.elapsed<0 || state.version!==run.generationVersion || state.seed!==run.seed || state.levelId!==run.levelId) return null;
    const count = state.survival ? 1 : run.players;
    if (state.survival && (!isValidSurvival(state.survival) || state.isCompleted && state.survival.phase !== 'alive' || run.status === 'ended' && state.survival.phase !== 'over')) return null;
    if (!state.survival && run.status === 'ended') return null;
    const world=createCampaignWorld(run.seed,run.levelId,run.generationVersion);
    if (state.version >= 2 && (!isValidAdventure(state.adventure, count) || !isValidJourney(state.journey, world, count))) return null;
    if (!isValidSkillState(state.skillState, createSkillRewards(world), state.elapsed)) return null;
    if(!Array.isArray(state.players)||state.players.length!==count||state.players.some(p=>!world.platforms[p.safeId]||world.platforms[p.safeId].isMoving))return null;
    if (state.players.some(p => p.safeX !== undefined && (!Number.isFinite(p.safeX) || Math.abs(p.safeX-world.platforms[p.safeId].x) > world.platforms[p.safeId].width/2))) return null;
    if (state.revival !== undefined) {
      const platform = state.revival && world.platforms[state.revival.platformId];
      if (!platform || !Number.isInteger(state.revival.platformId) || !Number.isFinite(state.revival.offsetX) || Math.abs(state.revival.offsetX) > Math.max(0,platform.width/2-0.35) || !['fallen','over'].includes(state.survival?.phase)) return null;
    }
    const isIds=(ids,limit,start=1)=>Array.isArray(ids)&&ids.every(id=>Number.isInteger(id)&&id>=start&&id<=limit)&&new Set(ids).size===ids.length;
    if(!isIds(state.collectedIds,world.treasures.length)||!isIds(state.defeatedIds,world.enemies.length)||!isIds(state.visited,world.zones.length)||!isIds(state.switches,world.switches.length-1,0))return null;
    if(!Array.isArray(state.enemies)||state.enemies.length!==world.enemies.length||state.enemies.some((e,i)=>e.id!==i+1||![e.x,e.y,e.hp,e.elapsed,e.direction].every(Number.isFinite)))return null;
    if(state.version>=5) {
      const stage=STAGES.find(s=>s.id===world.stageId);
      for(const enemy of state.enemies) {
        const current=world.enemies[enemy.id-1];
        if(!current.isBoss)continue;
        const oldMax=current.isWorldBoss?660+stage.worldIndex*650:240+stage.index*90;
        const savedMax=enemy.maxHp ?? oldMax;
        if(![oldMax,current.maxHp].includes(savedMax)||enemy.hp<0||enemy.hp>savedMax)return null;
        // 保留已经打掉的比例，读档后直接使用适龄血量，不重置战斗。
        if(savedMax!==current.maxHp)enemy.hp=Math.ceil(enemy.hp/savedMax*current.maxHp);
        enemy.maxHp=current.maxHp;
      }
    }
    if (state.version >= 2 && state.enemies.some((e,i) => e.hp < 0 || e.hp > world.enemies[i].hp || e.elapsed < 0 || ![-1,1].includes(e.direction) || typeof e.isDefeated !== 'boolean' || e.isDefeated !== state.defeatedIds.includes(e.id))) return null;
    if (state.version >= 3) {
      const isOptionalNumber = (value, max) => value === undefined || Number.isFinite(value) && value >= 0 && value <= max;
      if (state.enemies.some(e => !isOptionalNumber(e.boundUntil, state.elapsed+2) || !isOptionalNumber(e.guardHits, 100000) || ['isHidden','isGuarding','isSummoned','isDormant'].some(k => e[k] !== undefined && typeof e[k] !== 'boolean'))) return null;
      if (state.players.some(p => !isOptionalNumber(p.protection, 10) || !isOptionalNumber(p.shotRemaining, 2) || !isOptionalNumber(p.inkRemaining, 1))) return null;
      if (state.lure && (![state.lure.x,state.lure.y,state.lure.until].every(Number.isFinite) || state.lure.until > state.elapsed+3)) return null;
    }
    if (state.checkpointId !== undefined && (!world.platforms[state.checkpointId] || world.platforms[state.checkpointId].isMoving)) return null;
    if (state.version >= 4) {
      if (!Array.isArray(state.supplies) || new Set(state.supplies).size !== state.supplies.length || state.supplies.some(id => !world.supplies.some(s => s.id === id))) return null;
      if (!Array.isArray(state.mechanisms) || new Set(state.mechanisms.map(p=>p.id)).size !== state.mechanisms.length || state.mechanisms.some(p => !world.platforms[p.id] || p.collapseAt !== undefined && (!world.platforms[p.id].isCrumbling || !Number.isFinite(p.collapseAt) || p.collapseAt < state.elapsed-4 || p.collapseAt > state.elapsed+2.3) || p.slope !== undefined && (!world.platforms[p.id].isSeesaw || !Number.isFinite(p.slope) || Math.abs(p.slope) > .23))) return null;
    }
    if (state.version >= 5) {
      if(state.enemies.some((e,i)=>world.enemies[i].isBoss&&!isValidBossState(e,world.enemies[i],state.elapsed)))return null;
      if(state.isCompleted && world.bossArenas.some(a=>!state.defeatedIds.includes(a.bossId)))return null;
    }
    if (!isValidCombatLoot(state.combatLoot,world,state.defeatedIds)) return null;
    if (state.combatLoot?.pendingId!=null && (state.survival?.phase!=='alive'||state.isCompleted||state.journey?.pending)) return null;
    if (state.players.some(p => p.weaponShots && Object.entries(p.weaponShots).some(([id,value])=>!WEAPONS[id] || !Number.isFinite(value) || value<0 || value>2))) return null;
    if (!state.survival) {
      // 保留原双人记录的计分人数；玩法只迁移第一位，背包仍完整保留。
      state.survival = newSurvival('sister'); state.players = state.players.slice(0,1);
      state.checkpointId = state.players[0].safeId;
      if (state.adventure) { state.adventure.loadouts = state.adventure.loadouts.slice(0,1); if (state.journey.pending) state.journey.pending.player = 0; }
    }
    state.survival = migrateSurvival(state.survival);
    if (state.adventure?.version === 1) state.journey.queued = [];
    if (state.adventure) migrateAdventure(state.adventure);
    return saved;
  } catch { return null; }
}
