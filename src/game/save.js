import { validField, hasMark } from '../../shared/trails/field-progress.js';
import { isValidProjectiles } from './projectile-state.js';
import { isValidSurvival, migrateSurvival } from './characters.js';
import { createRoomWorld } from '../../shared/room-world.js';
import { isValidAdventure, isValidJourney, migrateAdventure, migratePendingReward } from './adventure.js';
import { bossBaseline, bossTargetHp } from '../../shared/boss-health.js';
import { ADVENTURE_GENERATION_VERSION, WEAPONS } from '../../shared/adventure-catalog.js';
import { isValidBossState } from './bosses.js';
import { isValidCombatLoot } from './combat-loot.js';
import { findStage } from '../../shared/levels.js';
import { validStoryState } from '../../shared/story-mechanisms.js';
import { WATER_CHANNELS, growthFraction } from '../../shared/flower-valley.js';
import { isValidRoomState } from './rooms.js';
import { saveEnemy } from './enemies.js';
import { balloonCeiling, caveForPlayer } from './traversal.js';
const KEY = ['garden','active','adventure','v1'].join('-');
const PARKED_PREFIX = 'garden-parked-adventure-v1:';
// 以前换规则时留下的旧存档备份，现在跟旧地图一起清掉。
const OLD_BACKUPS = ['single-player', 'life-only', 'boss-growth', 'easier-combat', 'hp-lives'];
export function writeAdventure(run, state, storage = localStorage) {
  storage.setItem(KEY, JSON.stringify({ run, state }));
  storage.removeItem(PARKED_PREFIX + run.id);
}

export function clearAdventure(storage = localStorage) {
  const saved = readAdventure(storage);
  if (saved) storage.removeItem(PARKED_PREFIX + saved.run.id);
  storage.removeItem(KEY);
}

// 进入另一局前留一份完整存档。原活动档一直保留到目标关卡首次保存成功。
export function parkActiveAdventure(nextRunId, storage = localStorage) {
  const raw = storage.getItem(KEY);
  if (!raw) return;
  const { run } = JSON.parse(raw);
  if (run.id !== nextRunId) storage.setItem(PARKED_PREFIX + run.id, raw);
}

export function readWorldAdventures(storage = localStorage) {
  const active = readAdventure(storage);
  const saves = active ? [active] : [];
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
  for (const key of keys) {
    if (!key?.startsWith(PARKED_PREFIX) || key === PARKED_PREFIX + active?.run.id) continue;
    const saved = readSave(key, storage);
    if (saved && key === PARKED_PREFIX + saved.run.id) saves.push(saved);
  }
  return saves;
}

export function readAdventure(storage = localStorage) {
  try {
    for (const name of OLD_BACKUPS) storage.removeItem(`${KEY}-before-${name}`);
    return readSave(KEY, storage);
  } catch { return null; }
}

// 旧档记的是原台边的位置。只有原本在台面内的落脚点才移到收窄后的边缘。
function fitSavedPosition(platform, x, center, margin) {
  if (!platform?.previousWidth || !Number.isFinite(x)) return x;
  const offset = x - center;
  if (Math.abs(offset) > platform.previousWidth / 2 - margin) return x;
  const limit = Math.max(0, platform.width / 2 - Math.max(.35, margin));
  return Math.abs(offset) > limit ? center + Math.sign(offset) * limit : x;
}

function readSave(key, storage) {
  try {
    let saved;
    try { saved = JSON.parse(storage.getItem(key)); } catch { saved = undefined; }
    if (saved === null) return null;
    if (saved?.run?.generationVersion !== ADVENTURE_GENERATION_VERSION || saved.state?.version !== ADVENTURE_GENERATION_VERSION) {
      storage.removeItem(key);
      return null;
    }
    const {run,state}=saved;
    if(run.scoringVersion!==3 || !['playing','paused','completed','ended'].includes(run.status) || run.players!==1 || !Number.isInteger(run.seed) || !Number.isFinite(state.elapsed) || state.elapsed<0 || state.seed!==run.seed || state.levelId!==run.levelId) return null;
    const stage=findStage(run.levelId);
    if (!isValidSurvival(state.survival) || state.isCompleted && state.survival.phase !== 'alive' || run.status === 'ended' && state.survival.phase !== 'over') return null;
    if (!isValidAdventure(state.adventure, 1) || !isValidJourney(state.journey, 1)) return null;
    const cycle = state.adventure.cycle || 1;
    const world=createRoomWorld(run.seed,stage,cycle);
    // 第 11 版只在尾部追加守卫；原编号和已清房间保持原样，不重抽本局。
    const originalCount = world.enemies.findIndex(e => e.isReinforcement);
    if (originalCount >= 0 && Array.isArray(state.enemies) && state.enemies.length === originalCount && isValidRoomState(state.rooms, world)) {
      for (const enemy of world.enemies.slice(originalCount)) {
        const isCurrent = enemy.roomId === state.rooms.roomId && !state.rooms.cleared.includes(enemy.roomId);
        state.enemies.push(saveEnemy({ ...enemy, isDormant:!isCurrent || enemy.wave !== state.rooms.wave }));
      }
      if (world.field) {
        for (const player of state.players) {
          const p = world.platforms[player.safeId];
          if (p && player.safeX !== undefined) player.safeX = fitSavedPosition(p, player.safeX, p.x, 0);
        }
        if (state.revival) {
          const r = state.revival;
          r.offsetX = fitSavedPosition(world.platforms[r.platformId], r.offsetX, 0, .35);
        }
        for (const drop of state.combatLoot?.drops || []) {
          drop.offsetX = fitSavedPosition(world.platforms[drop.platformId], drop.offsetX, 0, 0);
        }
      }
    }
    if(!Array.isArray(state.players)||state.players.length!==1||state.players.some(p=>!world.platforms[p.safeId]||world.platforms[p.safeId].isMoving))return null;
    if (state.players.some(p => p.safeX !== undefined && (!Number.isFinite(p.safeX) || Math.abs(p.safeX-world.platforms[p.safeId].x) > world.platforms[p.safeId].width/2))) return null;
    if (state.revival !== undefined) {
      const platform = state.revival && world.platforms[state.revival.platformId];
      if (!platform || !Number.isInteger(state.revival.platformId) || !Number.isFinite(state.revival.offsetX) || Math.abs(state.revival.offsetX) > Math.max(0,platform.width/2-0.35) || !['fallen','over'].includes(state.survival.phase)) return null;
    }
    const isIds=(ids,limit,start=1)=>Array.isArray(ids)&&ids.every(id=>Number.isInteger(id)&&id>=start&&id<=limit)&&new Set(ids).size===ids.length;
    if(!isIds(state.collectedIds,world.treasures.length)||!isIds(state.defeatedIds,world.enemies.length)||!isIds(state.visited,world.zones.length)||!isIds(state.switches,world.switches.length-1,0))return null;
    if (state.brokenIcicles !== undefined && (!isIds(state.brokenIcicles, world.hazards.length - 1, 0) || state.brokenIcicles.some(id => world.hazards[id].kind !== 'icicle'))) return null;
    if(!Array.isArray(state.enemies)||state.enemies.length!==world.enemies.length||state.enemies.some((e,i)=>e.id!==i+1||![e.x,e.y,e.hp,e.elapsed,e.direction].every(Number.isFinite)))return null;
    // 首领开战时按当时的武器加厚过，存下来的血量上限只能在单武器血量和最多加厚之间。
    const thickest=bossTargetHp(stage,100,cycle);
    for(const enemy of state.enemies) {
      if(!world.enemies[enemy.id-1].isBoss)continue;
      enemy.maxHp ??= bossBaseline(stage,cycle);
      if(!Number.isInteger(enemy.maxHp)||enemy.maxHp<bossBaseline(stage,cycle)||enemy.maxHp>thickest||enemy.hp>enemy.maxHp)return null;
    }
    if (state.enemies.some((e,i) => e.hp < 0 || e.hp > (world.enemies[i].isBoss ? e.maxHp : world.enemies[i].hp) || e.elapsed < 0 || ![-1,1].includes(e.direction) || typeof e.isDefeated !== 'boolean' || e.isDefeated !== state.defeatedIds.includes(e.id))) return null;
    const isOptionalNumber = (value, max) => value === undefined || Number.isFinite(value) && value >= 0 && value <= max;
    if (state.enemies.some(e => !isOptionalNumber(e.windUntil,state.elapsed+.6) || !isOptionalNumber(e.boundUntil, state.elapsed+2) || !isOptionalNumber(e.guardHits, 100000) || !isOptionalNumber(e.frozenUntil,state.elapsed+1.1) || !isOptionalNumber(e.freezeImmuneUntil,state.elapsed+4.1) || ['isHidden','isGuarding','isSummoned','isDormant','hasShell'].some(k => e[k] !== undefined && typeof e[k] !== 'boolean'))) return null;
    if (state.players.some(p => !isOptionalNumber(p.protection, 10) || !isOptionalNumber(p.shotRemaining, 2) || !isOptionalNumber(p.inkRemaining, 1))) return null;
    if (state.lure && (![state.lure.x,state.lure.y,state.lure.until].every(Number.isFinite) || state.lure.until > state.elapsed+3)) return null;
    if (state.checkpointId !== undefined && (!world.platforms[state.checkpointId] || world.platforms[state.checkpointId].isMoving)) return null;
    if (!Array.isArray(state.supplies) || new Set(state.supplies).size !== state.supplies.length || state.supplies.some(id => !world.supplies.some(s => s.id === id))) return null;
    if (!Array.isArray(state.mechanisms) || new Set(state.mechanisms.map(p=>p.id)).size !== state.mechanisms.length || state.mechanisms.some(p => !world.platforms[p.id] || p.collapseAt !== undefined && (!world.platforms[p.id].isCrumbling || !Number.isFinite(p.collapseAt) || p.collapseAt < state.elapsed-4 || p.collapseAt > state.elapsed+2.3) || p.slope !== undefined && (!world.platforms[p.id].isSeesaw || !Number.isFinite(p.slope) || Math.abs(p.slope) > .23))) return null;
    for (const { id, net } of state.mechanisms) {
      if (net === undefined) continue;
      if (world.platforms[id].skin !== 'safety-net' || !Number.isFinite(net?.bend) || Math.abs(net.bend) > 3 ||
          !Number.isFinite(net.speed) || Math.abs(net.speed) > 30 || !Number.isFinite(net.focus) || Math.abs(net.focus) > 1) return null;
    }
    if(state.enemies.some((e,i)=>world.enemies[i].isBoss&&!isValidBossState(e,world.enemies[i],state.elapsed)))return null;
    if(state.isCompleted && world.bossArenas.some(a=>!state.defeatedIds.includes(a.bossId)))return null;
    // 房间进度要和地图对得上，人也得站在当前这间房里。
    if (!isValidRoomState(state.rooms, world) || state.players.some(p => world.platforms[p.safeId].roomId !== state.rooms.roomId)) return null;
    for (const player of state.players) {
      const position = player.balloonPosition;
      if (position === undefined) continue;
      const room = world.rooms[state.rooms.roomId], safe = world.platforms[player.safeId];
      const cave = caveForPlayer(room, { safe });
      if (!state.adventure.effects?.hotAirBalloon || state.survival.phase !== 'alive' || player.ride ||
          !Number.isFinite(position?.x) || !Number.isFinite(position.y) ||
          position.x < (cave?.left ?? room.left) || position.x > (cave?.right ?? room.right) ||
          position.y < (cave ? cave.floorY - 4 : room.fallY) || position.y > balloonCeiling(room, { safe })) return null;
    }
    if (world.expedition) {
      if (!validStoryState(world,state.rooms,state.elapsed)) return null;
      const safe = [...state.players.map(p=>p.safeId),state.revival?.platformId].filter(id=>id!=null);
      if (safe.some(id=>world.platforms[id].needsMark && !Object.hasOwn(state.rooms.story.marks,world.platforms[id].needsMark))) return null;
    }
    if (world.valley) {
      const water = state.rooms.water;
      if (WATER_CHANNELS.some(key => water[key] > state.elapsed)) return null;
      const savedTiles = [...state.players.map(p => p.safeId), state.revival?.platformId].filter(id => id != null);
      if (savedTiles.some(id => world.platforms[id].channel && growthFraction(world.platforms[id], water, state.elapsed) < .8)) return null;
    }
    for (const {ride} of state.players) {
      if (ride===undefined) continue;
      const deck=world.platforms[ride?.id];
      if (!world.field || !Number.isInteger(ride?.id) || !deck?.isMoving || deck.roomId!==state.rooms.roomId ||
          !Number.isFinite(ride.offset) || Math.abs(ride.offset)>deck.width/2+.29) return null;
    }
    if (world.field) {
      if (!validField(world,state.rooms,state.elapsed)) return null;
      const safe = [...state.players.map(p=>p.safeId),state.revival?.platformId].filter(id=>id!=null);
      if (safe.some(id=>world.platforms[id].fieldGate && !hasMark(world.rooms[world.platforms[id].roomId],state.rooms.field,world.platforms[id].fieldGate))) return null;
    }
    if (world.forest && (state.rooms.forest.crown !== 5 || state.rooms.forest.roots !== 5)) {
      const boss = state.enemies[world.rooms[0].bossId - 1];
      if (!boss.isDormant || boss.isDefeated || state.rooms.cleared.length) return null;
    }
    if(!isValidProjectiles(state.projectiles,world))return null;
    if (!isValidCombatLoot(state.combatLoot,world,state.defeatedIds)) return null;
    if (state.combatLoot?.pendingId!=null && (state.survival.phase!=='alive'||state.isCompleted||state.journey.pending)) return null;
    if(state.players.some(p=>p.weaponCycles&&Object.entries(p.weaponCycles).some(([id,n])=>!WEAPONS[id]||!Number.isInteger(n)||n<0||n>=60)))return null;
    if (state.players.some(p => p.weaponShots && Object.entries(p.weaponShots).some(([id,value])=>!WEAPONS[id] || !Number.isFinite(value) || value<0 || value>2))) return null;
    if (state.players.some(p => !isOptionalNumber(p.attackRemaining, 2.500001) || !isOptionalNumber(p.companionRemaining, 3.000001))) return null;
    state.survival = migrateSurvival(state.survival);
    migrateAdventure(state.adventure);migratePendingReward(state.adventure,state.journey);
    return saved;
  } catch { return null; }
}
