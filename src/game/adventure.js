import { newResources, resourcesFor, isValidResources, heal } from './expedition.js';
import { WEAPONS, UPGRADES, TIMED_ITEMS, upgradeCategory } from '../../shared/adventure-catalog.js';
import { newGrowth, isValidGrowth, grow, weaponDamage } from './growth.js';
import { RARITIES, SPELLS, LEGENDARY_EFFECTS, ROOM_TIERS, RARITY_FRAGMENTS } from '../../shared/combat-catalog.js';
import { setLevel } from './sets.js';
import { DIFFICULTIES } from './difficulty.js';
import { addLife } from './characters.js';
import { newMagic, isValidMagic, CHARGE_PER_HIT } from './magic.js';
export { WEAPONS, UPGRADES };

export function newAdventure(seed, count = 1) {
  return { version: 2, starterVersion:1, seed, resources: newResources(), growth:newGrowth(), effects: {}, weapons: ['moonblade'], weaponRanks:{}, qualities:{}, magic:newMagic(), revivalWaves:0, counterShield:0, upgrades: {}, loadouts: Array.from({ length: count }, () => ({ weapon: 'moonblade', weapons: ['moonblade'], upgrades: [] })), revision: 0 };
}
export function newJourney() { return { routes: {}, claimed: [], pending: null, queued: [], fragments: 0 }; }
export function activeWeapons(adventure, index = 0) { return adventure.loadouts[index].weapons || [adventure.loadouts[index].weapon]; }
export function weaponRank(adventure,id) { return adventure.weaponRanks?.[id] || (adventure.weapons.includes(id)?1:0); }
export function weaponShotCount(weapon,powers={}) { return ((powers.weaponRank || 1)+(weapon==='stars'?(powers.fan || 0)*2:weapon==='firefly'?Number(!!powers.seek):0))*(powers.double?2:1); }
// 相对一把基础弯刀的持续输出。小于 1 的单武器也按 1 看待，避免开局首领被减血。
export function weaponPressure(adventure, index = 0) {
  if (!adventure) return 1;
  let dps = 0;
  for (const id of activeWeapons(adventure, index)) {
    const weapon = WEAPONS[id];
    if (!weapon?.interval) continue;
    const powers = upgradePower(adventure, index, id);
    const damage = weaponDamage(id, powers.attackGrowth || 0, powers.weaponRank || 1);
    const shots = weaponShotCount(id, powers);
    const interval = weapon.interval / (1 + 0.18 * (powers.rapid || 0));
    dps += damage * shots / interval;
  }
  // 厚度仍以原来「一把基础弯刀、每 0.18 秒」为 1。弯刀放慢后不再把首领血量跟着抬高。
  const reference = 48 / 0.18;
  return dps > 0 ? dps / reference : 1;
}
export function migrateAdventure(adventure) {
  adventure.growth ||= newGrowth();
  adventure.qualities ||= {}; adventure.magic ||= newMagic(); adventure.revivalWaves ||= 0; adventure.counterShield ||= 0;
  if (adventure.version !== 2) {
    adventure.version = 2; adventure.effects = {};
    for (const loadout of adventure.loadouts) { loadout.weapons = [...adventure.weapons]; loadout.upgrades = Object.keys(adventure.upgrades); }
  }
  return adventure;
}
export function upgradePower(adventure, index = 0, weapon) {
  const loadout = adventure.loadouts[index], weapons = activeWeapons(adventure,index);
  const powers = Object.fromEntries(loadout.upgrades.filter(id => !UPGRADES[id].weapon || (weapon ? UPGRADES[id].weapon === weapon : weapons.includes(UPGRADES[id].weapon))).map(id => [id, adventure.upgrades[id]]));
  for (const [id, remaining] of Object.entries(adventure.effects || {})) if (remaining > 0) for (const [key, rank] of Object.entries(TIMED_ITEMS[id].powers)) powers[key] = Math.max(powers[key] || 0, rank);
  if (adventure.growth?.power) powers.attackGrowth=adventure.growth.power;
  // 套装：力量系加攻击，飞行系出手更快。0.62 和 1.39 换算下来是间隔缩短一成和两成。
  const powerSet = setLevel(adventure, 'power'), flightSet = setLevel(adventure, 'flight');
  if (powerSet) powers.attackGrowth = (powers.attackGrowth || 0) + powerSet * 1.5;
  if (flightSet) powers.rapid = (powers.rapid || 0) + (flightSet === 1 ? 0.62 : 1.39);
  if (weapon) powers.weaponRank=weaponRank(adventure,weapon);
  if(weapon && adventure.qualities?.[`weapon:${weapon}`] === 'legendary'){powers.legendary = 1;if(weapon==='firefly')powers.seek=Math.max(1,powers.seek || 0);}
  return powers;
}
export function tickEffects(adventure, dt) {
  for (const id of Object.keys(adventure.effects || {})) { adventure.effects[id] = Math.max(0, adventure.effects[id] - dt); if (!adventure.effects[id]) { delete adventure.effects[id]; adventure.revision++; } }
}
// 旧待选奖励保留原卡片，再补一张传奇；只迁移一次，不重抽候选。
export function migratePendingReward(adventure, journey) {
  const pending=journey?.pending;
  if(!pending || pending.rewardVersion===1)return;
  for(const choice of pending.choices)choice.rarity ||= 'epic';
  const needed=1-pending.choices.filter(c=>c.rarity==='legendary').length;
  const existing=new Set(pending.choices.map(c=>`${c.type}:${c.id}`));
  const additions=[{type:'supply',id:'life'},...Object.keys(WEAPONS).filter(id=>weaponRank(adventure,id)<99).map(id=>({type:'weapon',id}))].filter(c=>!existing.has(`${c.type}:${c.id}`));
  pending.choices.push(...additions.slice(0,Math.max(0,needed)).map(c=>({...c,rarity:'legendary'})));pending.rewardVersion=1;
}
export function chooseReward(adventure, journey, choiceIndex, survival) {
  const pending = journey.pending, indices=Array.isArray(choiceIndex)?choiceIndex:[choiceIndex];
  if (!pending || indices.length!==(pending.pickCount || 1) || new Set(indices).size!==indices.length || indices.some(index=>!Number.isInteger(index)||!pending.choices[index])) return false;
  const choices=indices.map(index=>pending.choices[index]);
  if(choices.some(choice=>choice.type==='supply'&&choice.id==='heal'&&(!survival||survival.phase!=='alive'||survival.hp>=survival.maxHp)))return false;
  if(choices.some(choice=>choice.type==='growth'&&(!survival||survival.phase!=='alive'||choice.id==='heart'&&survival.maxHp>=2100)))return false;
  if(choices.some(choice=>choice.type==='weapon'&&weaponRank(adventure,choice.id)>=99))return false;
  if(choices.some(c=>c.type==='spell'&&(adventure.magic?.ranks[c.id] || 0)>=3 && (c.rarity!=='legendary'||adventure.qualities?.[`spell:${c.id}`]==='legendary')))return false;
  if(choices.some(c=>c.type==='supply'&&c.id==='life'&&(!survival||survival.phase!=='alive'||survival.lives>=999)))return false;
  for(const choice of choices) applyReward(adventure,pending,choice,survival);
  return finishReward(adventure, journey);
}
function applyReward(adventure, pending, choice, survival) {
  const loadout = adventure.loadouts[pending.player];
  adventure.qualities ||= {};
  const key=`${choice.type}:${choice.id}`,rarity=choice.rarity || 'common';
  if(RARITIES[rarity].rank > RARITIES[adventure.qualities[key] || 'common'].rank)adventure.qualities[key]=rarity;
  if(ROOM_TIERS.includes(pending.tier))resourcesFor(adventure).balance+=RARITY_FRAGMENTS[rarity];
  if(choice.type==='spell') {
    const magic=adventure.magic ||= newMagic();magic.ranks[choice.id]=Math.min(3,(magic.ranks[choice.id] || 0)+1);
    if(!magic.equipped.includes(choice.id))magic.equipped.push(choice.id);
    magic.charges[choice.id] ||= 0;return;
  }
  if(choice.type==='legend'){adventure.counterShield=1;return;}

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
    if(choice.id==='life'){addLife(survival);if(choice.rarity==='epic')heal(survival,25);if(choice.rarity==='legendary')adventure.revivalWaves=(adventure.revivalWaves || 0)+1;}
    else if (choice.id === 'heal') { if (!survival || !heal(survival,choice.rarity==='epic'?50:25)) return false; }
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
  journey.claimed.push(pending.id); journey.pending = null;
  return true;
}
export function isValidAdventure(adventure, count) {
  const isUnique = (items, definitions) => Array.isArray(items) && new Set(items).size === items.length && items.every(id => Object.hasOwn(definitions, id));
  return [1,2].includes(adventure?.version) && isValidResources(adventure.resources) && isValidGrowth(adventure.growth) && Number.isInteger(adventure.seed) && adventure.seed >= 0 && adventure.seed <= 0xffffffff
    && isValidMagic(adventure.magic)
    && [undefined, 9].includes(adventure.ruleset) && (adventure.difficulty === undefined || Object.hasOwn(DIFFICULTIES, adventure.difficulty))
    && (adventure.locked === undefined || Array.isArray(adventure.locked) && adventure.locked.length <= 60 && adventure.locked.every(key => /^(weapon|upgrade|spell):[a-zA-Z]+$/.test(key)))
    && (adventure.qualities===undefined || adventure.qualities && !Array.isArray(adventure.qualities) && Object.entries(adventure.qualities).every(([key,quality])=>/^(weapon|upgrade|spell|growth|supply|timed|legend):[a-zA-Z]+$/.test(key)&&Object.hasOwn(RARITIES,quality)))
    && ['revivalWaves','counterShield'].every(k=>adventure[k]===undefined||Number.isInteger(adventure[k])&&adventure[k]>=0&&adventure[k]<=10000)
    && (adventure.starter===undefined || adventure.starter && Array.isArray(adventure.starter.weapons)&&adventure.starter.weapons.length===1&&adventure.starter.weapons.every(id=>WEAPONS[id])&&Array.isArray(adventure.starter.upgrades)&&adventure.starter.upgrades.length<=2&&adventure.starter.upgrades.every(id=>UPGRADES[id]))
    && (adventure.starterVersion===undefined || adventure.starterVersion===1)
    && Number.isSafeInteger(adventure.revision) && adventure.revision >= 0
    && (adventure.version === 1 || adventure.effects && Object.entries(adventure.effects).every(([id,seconds]) => TIMED_ITEMS[id] && Number.isFinite(seconds) && seconds > 0 && seconds <= TIMED_ITEMS[id].duration * 2))
    && isUnique(adventure.weapons, WEAPONS) && adventure.weapons.length>0
    && (adventure.weaponRanks===undefined || adventure.weaponRanks && !Array.isArray(adventure.weaponRanks) && Object.entries(adventure.weaponRanks).every(([id,rank])=>adventure.weapons.includes(id)&&Number.isInteger(rank)&&rank>=1&&rank<=99))
    && adventure.upgrades && !Array.isArray(adventure.upgrades) && Object.entries(adventure.upgrades).every(([id, rank]) => Object.hasOwn(UPGRADES, id) && Number.isInteger(rank) && rank >= 1 && rank <= (UPGRADES[id].maxRank || 1))
    && Array.isArray(adventure.loadouts) && adventure.loadouts.length === count && adventure.loadouts.every(l => adventure.weapons.includes(l.weapon) && isUnique(l.upgrades, UPGRADES) && (adventure.version === 2 ? isUnique(l.weapons, WEAPONS) && l.weapons.length > 0 && l.weapons.every(id => adventure.weapons.includes(id)) : l.upgrades.length <= 3) && l.upgrades.every(id => adventure.upgrades[id]));
}
export function isValidJourney(journey, count) {
  const isEvent = e => e && typeof e.id === 'string' && e.id.length < 120 && ['power', 'bubble', 'flight', 'frost', 'nature'].includes(e.family) && typeof e.title === 'string' && (e.tier===undefined||ROOM_TIERS.includes(e.tier));
  // 选门的地图没有分岔路牌，routes 只能是空的。
  if (!journey || !journey.routes || Object.keys(journey.routes).length || !Array.isArray(journey.claimed) || journey.claimed.length > 100 || !journey.claimed.every(id => typeof id === 'string') || new Set(journey.claimed).size !== journey.claimed.length || !Array.isArray(journey.queued) || journey.queued.length > 30 || !journey.queued.every(isEvent) || !Number.isInteger(journey.fragments) || journey.fragments < 0) return false;
  const pending = journey.pending;
  if (pending && ['rerolls','rarityBonus'].some(key => pending[key] !== undefined && !(Number.isFinite(pending[key]) && pending[key] >= 0 && pending[key] <= 100))) return false;
  return pending === null || isEvent(pending) && (pending.pickCount===undefined||pending.pickCount===1) && !journey.claimed.includes(pending.id) && Number.isInteger(pending.player) && pending.player >= 0 && pending.player < count && Array.isArray(pending.choices) && pending.choices.length > 0 && pending.choices.length <= 4 && pending.choices.every(c => c && (c.rarity===undefined||Object.hasOwn(RARITIES,c.rarity)) && (['weapon', 'upgrade', 'salvage'].includes(c.type) && Object.hasOwn(c.type === 'weapon' ? WEAPONS : UPGRADES, c.id) || c.type === 'supply' && ['heal', 'fragments','life'].includes(c.id) || c.type === 'timed' && Object.hasOwn(TIMED_ITEMS,c.id) || c.type==='spell'&&Object.hasOwn(SPELLS,c.id)||c.type==='legend'&&c.id==='counterShield'||c.type==='growth'&&['heart','power'].includes(c.id))) && new Set(pending.choices.map(c => `${c.type}:${c.id}`)).size === pending.choices.length;
}

export function rewardItem(choice, adventure) {
  const isRooms=adventure?.ruleset>=9;
  if(choice.type==='spell'){
    // 第 9 版大招靠打中怪攒能量，说明里的秒数换成要打中几下。
    const spell=SPELLS[choice.id],hint=isRooms?spell.hint.replace(/^战斗充能 \d+ 秒/,`打中怪 ${Math.ceil(spell.charge/CHARGE_PER_HIT)} 下攒满`):spell.hint;
    return {...spell,category:'attack',hint:`${hint}。${choice.rarity==='legendary'?LEGENDARY_EFFECTS[choice.id]:'重复获得提升大招等级，最高 3 级'}`};
  }
  if(choice.type==='legend')return {name:'护盾反击',hint:'护盾挡伤时反击周围敌人，冷却 6 秒',image:'monster-leafshield',category:'survival'};
  if(choice.type==='supply'&&choice.id==='life')return {name:choice.rarity==='legendary'?'守护血瓶':'生命血瓶',hint:`增加 1 条命${choice.rarity==='legendary'?'，下次复活清除附近普通敌弹':choice.rarity==='epic'?'，并回血 25':'，当前血量不变'}`,image:'life-potion',category:'survival'};

  if (choice.type === 'growth') return choice.id==='heart'?{name:'血量长大',hint:'血量上限 +40，同时回血 40',image:'collectible-heart',category:'survival'}:{name:'攻击成长',hint:'所有武器攻击力 +20%，本次冒险持续生效',image:'light-wave',category:'attack'};
  if (choice.type === 'timed') return TIMED_ITEMS[choice.id];
  if (choice.type === 'supply') return choice.id === 'heal' ? { name: '回血药包', hint: choice.rarity==='epic'?'回血 50':'回血 25', image: 'supply-medkit', category: 'survival' } : { name: '彩笔碎片', hint: isRooms ? '收下 3 片碎片，去小店花' : '收下 3 片碎片，去休息点换补给', image: 'upgrade-recycle', category: 'resource' };
  const item = (choice.type === 'weapon' ? WEAPONS : UPGRADES)[choice.id];
  if(choice.type==='weapon'&&adventure) {
    const rank=weaponRank(adventure,choice.id),next=rank+1;
    return {...item,legend:choice.rarity==='legendary'?LEGENDARY_EFFECTS[choice.id]:null,name:rank?`${item.name}叠加`:item.name,hint:rank?`基础数量 ${rank} → ${next}，每枚伤害 ${weaponDamage(choice.id,adventure.growth?.power || 0,rank)} → ${weaponDamage(choice.id,adventure.growth?.power || 0,next)}`:`获得 1 件，与现有武器一起使用。${item.hint}`,category:'attack'};
  }
  return choice.type === 'salvage' ? { ...item, name: '重复变宝', hint: `${item.name}已学会，回收得 5 片碎片`, category: 'resource' } : { ...item, category: choice.type === 'weapon' ? 'attack' : upgradeCategory(choice.id) };
}
