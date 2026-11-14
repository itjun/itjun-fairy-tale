import { randomGenerator } from '../../shared/random.js';
import { newResources, resourcesFor, isValidResources, heal } from './expedition.js';
import { WEAPONS, UPGRADES, TIMED_ITEMS, upgradeCategory } from '../../shared/adventure-catalog.js';
import { newGrowth, isValidGrowth, grow, weaponDamage } from './growth.js';
export { WEAPONS, UPGRADES };

export function newAdventure(seed, count = 1) {
  return { version: 2, starterVersion:1, seed, resources: newResources(), growth:newGrowth(), effects: {}, weapons: ['moonblade'], weaponRanks:{}, upgrades: {}, loadouts: Array.from({ length: count }, () => ({ weapon: 'moonblade', weapons: ['moonblade'], upgrades: [] })), revision: 0 };
}
export function newJourney() { return { routes: {}, claimed: [], pending: null, queued: [], fragments: 0 }; }
export function activeWeapons(adventure, index = 0) { return adventure.loadouts[index].weapons || [adventure.loadouts[index].weapon]; }
export function weaponRank(adventure,id) { return adventure.weaponRanks?.[id] || (adventure.weapons.includes(id)?1:0); }
export function weaponShotCount(weapon,powers={}) { return ((powers.weaponRank || 1)+(weapon==='stars'?(powers.fan || 0)*2:weapon==='firefly'?Number(!!powers.seek):0))*(powers.double?2:1); }
export function migrateAdventure(adventure) {
  adventure.growth ||= newGrowth();
  if (adventure.version !== 2) {
    adventure.version = 2; adventure.effects = {};
    for (const loadout of adventure.loadouts) { loadout.weapons = [...adventure.weapons]; loadout.upgrades = Object.keys(adventure.upgrades); }
  }
  // 只补发一次；孩子在休息点取下后，恢复存档不会重新装上。
  if (adventure.starterVersion !== 1) {
    if (!adventure.weapons.includes('moonblade')) adventure.weapons.push('moonblade');
    for (const loadout of adventure.loadouts) if (!loadout.weapons.includes('moonblade')) loadout.weapons.push('moonblade');
    adventure.starterVersion=1;adventure.revision++;
  }
  return adventure;
}
export function upgradePower(adventure, index = 0, weapon) {
  const loadout = adventure.loadouts[index], weapons = activeWeapons(adventure,index);
  const powers = Object.fromEntries(loadout.upgrades.filter(id => !UPGRADES[id].weapon || (weapon ? UPGRADES[id].weapon === weapon : weapons.includes(UPGRADES[id].weapon))).map(id => [id, adventure.upgrades[id]]));
  for (const [id, remaining] of Object.entries(adventure.effects || {})) if (remaining > 0) for (const [key, rank] of Object.entries(TIMED_ITEMS[id].powers)) powers[key] = Math.max(powers[key] || 0, rank);
  if (adventure.growth?.power) powers.attackGrowth=adventure.growth.power;
  if (weapon) powers.weaponRank=weaponRank(adventure,weapon);
  return powers;
}
export function tickEffects(adventure, dt) {
  for (const id of Object.keys(adventure.effects || {})) { adventure.effects[id] = Math.max(0, adventure.effects[id] - dt); if (!adventure.effects[id]) { delete adventure.effects[id]; adventure.revision++; } }
}
function hash(text) { let value = 2166136261; for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619); return value >>> 0; }
export function rewardChoices(adventure, eventId, family, player = 0, survival, tier) {
  const random = randomGenerator((adventure.seed ^ hash(eventId) ^ adventure.revision) >>> 0);
  const weapons = activeWeapons(adventure, player);
  const candidates = [
    ...Object.entries(WEAPONS).filter(([id]) => weaponRank(adventure,id)<99).map(([id, definition]) => ({ type: 'weapon', id, ...definition })),
    ...Object.entries(UPGRADES).filter(([id, d]) => (adventure.upgrades[id] || 0) < (d.maxRank || 1) && (!d.weapon || weapons.includes(d.weapon))).map(([id, definition]) => ({ type: 'upgrade', id, ...definition })),
    ...Object.entries(TIMED_ITEMS).map(([id, definition]) => ({ type: 'timed', id, ...definition })),
  ].map(item => ({ ...item, order: random() + (item.family === family ? 1.2 : 0) }));
  const result = [];
  const take = condition => { const next = candidates.filter(item => !result.includes(item) && condition(item)).sort((a, b) => b.order - a.order)[0]; if (next) result.push(next); };
  take(item => item.type === 'weapon' || item.type === 'timed' || upgradeCategory(item.id) === 'attack');
  take(item => item.type === 'upgrade' && upgradeCategory(item.id) === 'survival');
  take(item => item.type === 'upgrade' && upgradeCategory(item.id) === 'resource');
  while (result.length < Math.min(3, candidates.length)) take(() => true);
  const choices = result.map(({ type, id }) => ({ type, id }));
  if (survival?.lives < (survival?.maxLives || 9)) choices[Math.min(1, choices.length)] = { type: 'supply', id: 'heal' };
  if (upgradePower(adventure, player).duplicate) {
    const duplicates = Object.keys(adventure.upgrades).filter(id => adventure.upgrades[id] >= (UPGRADES[id].maxRank || 1));
    if (duplicates.length && random() < 0.5) choices[Math.min(2, choices.length)] = { type: 'salvage', id: duplicates[Math.floor(random() * duplicates.length)] };
  }
  if (!choices.length) choices.push({ type: 'supply', id: 'fragments' });
  // 每次仍保证生存/资源选择，探索技能轮换替代攻击位。
  const utility = candidates.filter(item => item.type === 'upgrade' && upgradeCategory(item.id) === 'utility').sort((a,b) => b.order-a.order)[0];
  if (utility && random() < 0.25 && choices.length === 3) choices[0] = { type: 'upgrade', id: utility.id };
  if (tier) {
    const growth={type:'growth',id:(survival?.maxLives || 9)<99 && random()<0.5?'heart':'power'};
    if(tier==='world') {
      choices[1]=growth;
      const extra=candidates.filter(item=>(item.type==='weapon'||item.type==='timed'||upgradeCategory(item.id)==='attack')&&!choices.some(c=>c.type===item.type&&c.id===item.id)).sort((a,b)=>b.order-a.order)[0];
      choices.push(extra?{type:extra.type,id:extra.id}:{type:'growth',id:growth.id==='heart'?'power':'heart'});
    } else choices[2]=growth;
  }
  return choices;
}
export function queueReward(journey, id, family, title, tier) {
  if (journey.claimed.includes(id) || journey.pending?.id === id || journey.queued.some(e => e.id === id)) return false;
  journey.queued.push({ id, family, title, ...(tier?{tier}:{}) }); return true;
}
export function openReward(adventure, journey, survival) {
  if (journey.pending || !journey.queued.length) return journey.pending;
  const event = journey.queued.shift();
  const choices = rewardChoices(adventure, event.id, event.family, 0, survival, event.tier);
  if (!choices.length) { journey.claimed.push(event.id); return null; }
  journey.pending = { ...event, player: 0, choices, ...(event.tier?{pickCount:event.tier==='world'?2:1}:{}) };
  return journey.pending;
}
export function chooseReward(adventure, journey, choiceIndex, survival) {
  const pending = journey.pending, indices=Array.isArray(choiceIndex)?choiceIndex:[choiceIndex];
  if (!pending || indices.length!==(pending.pickCount || 1) || new Set(indices).size!==indices.length || indices.some(index=>!Number.isInteger(index)||!pending.choices[index])) return false;
  const choices=indices.map(index=>pending.choices[index]);
  if(choices.some(choice=>choice.type==='supply'&&choice.id==='heal'&&(!survival||survival.phase!=='alive'||survival.lives>=(survival.maxLives || 9))))return false;
  if(choices.some(choice=>choice.type==='growth'&&(!survival||survival.phase!=='alive'||choice.id==='heart'&&(survival.maxLives || 9)>=99)))return false;
  if(choices.some(choice=>choice.type==='weapon'&&weaponRank(adventure,choice.id)>=99))return false;
  for(const choice of choices) applyReward(adventure,pending,choice,survival);
  return finishReward(adventure, journey);
}
function applyReward(adventure, pending, choice, survival) {
  const loadout = adventure.loadouts[pending.player];
  if (choice.type === 'weapon') {
    adventure.weaponRanks ||= {};
    adventure.weaponRanks[choice.id]=weaponRank(adventure,choice.id)+1;
    if (!adventure.weapons.includes(choice.id)) adventure.weapons.push(choice.id);
    loadout.weapon = choice.id;
    loadout.weapons ||= [loadout.weapon];
    if (!loadout.weapons.includes(choice.id)) loadout.weapons.push(choice.id);
  } else if (choice.type === 'timed') {
    adventure.effects ||= {};
    adventure.effects[choice.id] = Math.min(TIMED_ITEMS[choice.id].duration * 2, (adventure.effects[choice.id] || 0) + TIMED_ITEMS[choice.id].duration);
  } else if (choice.type === 'growth') {
    grow(adventure,survival,choice.id,2);
  } else if (choice.type === 'supply') {
    if (choice.id === 'heal') { if (!survival || !heal(survival)) return false; }
    else resourcesFor(adventure).balance += 3;
  } else if (choice.type === 'salvage') {
    resourcesFor(adventure).balance += upgradePower(adventure, pending.player).duplicate ? 5 : 2;
  } else {
    adventure.upgrades[choice.id] = Math.min(UPGRADES[choice.id].maxRank || 1, (adventure.upgrades[choice.id] || 0) + 1);
    if (!loadout.upgrades.includes(choice.id) ) loadout.upgrades.push(choice.id);
  }
}
export function recycleReward(adventure, journey) {
  if (!journey.pending) return false;
  resourcesFor(adventure).balance += upgradePower(adventure, journey.pending.player).recycle ? 3 : 1;
  return finishReward(adventure, journey);
}
function finishReward(adventure, journey) {
  const pending = journey.pending;
  adventure.revision++;
  if (pending.player + 1 < adventure.loadouts.length) {
    pending.player++; pending.choices = rewardChoices(adventure, `${pending.id}:partner`, pending.family, pending.player);
    if (pending.choices.length) return true;
  }
  journey.claimed.push(pending.id); journey.pending = null;
  return true;
}
export function equipWeapon(adventure, player, id) {
  const loadout = adventure.loadouts[player];
  if (!loadout || !adventure.weapons.includes(id)) return false;
  loadout.weapons ||= [loadout.weapon];
  if (loadout.weapons.includes(id)) { if (loadout.weapons.length === 1) return false; loadout.weapons = loadout.weapons.filter(key => key !== id); }
  else loadout.weapons.push(id);
  loadout.weapon = loadout.weapons[0]; adventure.revision++; return true;
}
export function toggleUpgrade(adventure, player, id) {
  const loadout = adventure.loadouts[player];
  if (!loadout || !adventure.upgrades[id]) return false;
  if (loadout.upgrades.includes(id)) loadout.upgrades = loadout.upgrades.filter(value => value !== id);
  else loadout.upgrades.push(id);
  adventure.revision++; return true;
}
export function isValidAdventure(adventure, count) {
  const isUnique = (items, definitions) => Array.isArray(items) && new Set(items).size === items.length && items.every(id => Object.hasOwn(definitions, id));
  return [1,2].includes(adventure?.version) && isValidResources(adventure.resources) && isValidGrowth(adventure.growth) && Number.isInteger(adventure.seed) && adventure.seed >= 0 && adventure.seed <= 0xffffffff
    && (adventure.starterVersion===undefined || adventure.starterVersion===1)
    && Number.isSafeInteger(adventure.revision) && adventure.revision >= 0
    && (adventure.version === 1 || adventure.effects && Object.entries(adventure.effects).every(([id,seconds]) => TIMED_ITEMS[id] && Number.isFinite(seconds) && seconds > 0 && seconds <= TIMED_ITEMS[id].duration * 2))
    && isUnique(adventure.weapons, WEAPONS) && adventure.weapons.length>0
    && (adventure.weaponRanks===undefined || adventure.weaponRanks && !Array.isArray(adventure.weaponRanks) && Object.entries(adventure.weaponRanks).every(([id,rank])=>adventure.weapons.includes(id)&&Number.isInteger(rank)&&rank>=1&&rank<=99))
    && adventure.upgrades && !Array.isArray(adventure.upgrades) && Object.entries(adventure.upgrades).every(([id, rank]) => Object.hasOwn(UPGRADES, id) && Number.isInteger(rank) && rank >= 1 && rank <= (UPGRADES[id].maxRank || 1))
    && Array.isArray(adventure.loadouts) && adventure.loadouts.length === count && adventure.loadouts.every(l => adventure.weapons.includes(l.weapon) && isUnique(l.upgrades, UPGRADES) && (adventure.version === 2 ? isUnique(l.weapons, WEAPONS) && l.weapons.length > 0 && l.weapons.every(id => adventure.weapons.includes(id)) : l.upgrades.length <= 3) && l.upgrades.every(id => adventure.upgrades[id]));
}
export function isValidJourney(journey, world, count) {
  const isEvent = e => e && typeof e.id === 'string' && e.id.length < 120 && ['power', 'bubble', 'flight', 'frost', 'nature'].includes(e.family) && typeof e.title === 'string' && (e.tier===undefined||['small','world'].includes(e.tier));
  const isRoute = ([id, route]) => world.forks.some(f => String(f.id) === id && f.routes.some(r => r.id === route));
  if (!journey || !journey.routes || !Object.entries(journey.routes).every(isRoute) || !Array.isArray(journey.claimed) || journey.claimed.length > 100 || !journey.claimed.every(id => typeof id === 'string') || new Set(journey.claimed).size !== journey.claimed.length || !Array.isArray(journey.queued) || journey.queued.length > 30 || !journey.queued.every(isEvent) || !Number.isInteger(journey.fragments) || journey.fragments < 0) return false;
  const pending = journey.pending;
  return pending === null || isEvent(pending) && (pending.pickCount===undefined||pending.pickCount===(pending.tier==='world'?2:1)) && !journey.claimed.includes(pending.id) && Number.isInteger(pending.player) && pending.player >= 0 && pending.player < count && Array.isArray(pending.choices) && pending.choices.length > 0 && pending.choices.length <= (pending.tier==='world'?4:3) && pending.choices.every(c => c && (['weapon', 'upgrade', 'salvage'].includes(c.type) && Object.hasOwn(c.type === 'weapon' ? WEAPONS : UPGRADES, c.id) || c.type === 'supply' && ['heal', 'fragments'].includes(c.id) || c.type === 'timed' && Object.hasOwn(TIMED_ITEMS,c.id) || c.type==='growth'&&['heart','power'].includes(c.id))) && new Set(pending.choices.map(c => `${c.type}:${c.id}`)).size === pending.choices.length;
}

export function rewardItem(choice, adventure) {
  if (choice.type === 'growth') return choice.id==='heart'?{name:'生命长大',hint:'生命上限 +2，同时补充 2 点生命',image:'collectible-heart',category:'survival'}:{name:'攻击成长',hint:'所有武器攻击力 +20%，本次冒险持续生效',image:'light-wave',category:'attack'};
  if (choice.type === 'timed') return TIMED_ITEMS[choice.id];
  if (choice.type === 'supply') return choice.id === 'heal' ? { name: '生命补给', hint: '现在补充 1 条生命', image: 'life-potion', category: 'survival' } : { name: '彩笔碎片', hint: '收下 3 片碎片，去休息点换补给', image: 'upgrade-recycle', category: 'resource' };
  const item = (choice.type === 'weapon' ? WEAPONS : UPGRADES)[choice.id];
  if(choice.type==='weapon'&&adventure) {
    const rank=weaponRank(adventure,choice.id),next=rank+1;
    return {...item,name:rank?`${item.name}叠加`:item.name,hint:rank?`基础数量 ${rank} → ${next}，每枚伤害 ${weaponDamage(choice.id,adventure.growth?.power || 0,rank)} → ${weaponDamage(choice.id,adventure.growth?.power || 0,next)}`:`获得 1 件，与现有武器一起使用。${item.hint}`,category:'attack'};
  }
  return choice.type === 'salvage' ? { ...item, name: '重复变宝', hint: `${item.name}已学会，回收得 5 片碎片`, category: 'resource' } : { ...item, category: choice.type === 'weapon' ? 'attack' : upgradeCategory(choice.id) };
}
