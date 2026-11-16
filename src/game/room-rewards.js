import { randomGenerator } from '../../shared/random.js';
import { WEAPONS, UPGRADES } from '../../shared/adventure-catalog.js';
import { RARITIES, ROOM_TIERS, SPELLS } from '../../shared/combat-catalog.js';
import { resourcesFor, heal } from './expedition.js';
import { weaponRank } from './adventure.js';
import { setCounts } from './sets.js';

// 第 9 版的奖励：门上写的是哪一类，清完房就出哪一类的三张卡。
export const TIER_TITLES = Object.freeze({
  'door-weapon': '选一把武器', 'door-upgrade': '选一个本领', 'door-spell': '选一个大招', elite: '打赢精英，选一份奖励', boss: '打赢首领，选一份奖励',
});
export const SHOP_ITEMS = Object.freeze({
  heal: { name: '回血 50', hint: '马上回 50 点血', price: 4, image: 'supply-medkit' },
  skill: { name: '随机本领', hint: '学会一个新的本领', price: 8, image: 'collectible-star' },
  reroll: { name: '重抽券', hint: '选奖励时可以换一批卡', price: 5, image: 'upgrade-recycle' },
  tierUp: { name: '升一档', hint: '下一次奖励的品质都高一档', price: 10, image: 'collectible-rainbow' },
});
const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];

function hash(text) { let value = 2166136261; for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619); return value >>> 0; }
function isOpen(adventure, type, id) { return !adventure.locked?.includes(`${type}:${id}`); }
function pools(adventure, survival) {
  const weapons = Object.keys(WEAPONS).filter(id => weaponRank(adventure, id) < 99 && isOpen(adventure, 'weapon', id)).map(id => ({ type: 'weapon', id }));
  const upgrades = Object.entries(UPGRADES).filter(([id, item]) => (adventure.upgrades[id] || 0) < (item.maxRank || 1) && (!item.weapon || adventure.weapons.includes(item.weapon)) && isOpen(adventure, 'upgrade', id)).map(([id]) => ({ type: 'upgrade', id }));
  const spells = Object.keys(SPELLS).filter(id => (adventure.magic?.ranks[id] || 0) < 3 && isOpen(adventure, 'spell', id)).map(id => ({ type: 'spell', id }));
  const legends = [...weapons, ...Object.keys(SPELLS).filter(id => isOpen(adventure, 'spell', id) && ((adventure.magic?.ranks[id] || 0) < 3 || adventure.qualities?.[`spell:${id}`] !== 'legendary')).map(id => ({ type: 'spell', id })),
    ...(!survival || survival.lives < 999 ? [{ type: 'supply', id: 'life' }] : []), ...(!adventure.counterShield ? [{ type: 'legend', id: 'counterShield' }] : [])];
  return { weapons, upgrades, spells, legends };
}

// rarityBonus 是挑战难度多出来的好运；tierUp 是小店买的“升一档”。
export function doorChoices(adventure, eventId, tier, survival, { rarityBonus = 0, salt = 0, isTierUp = false } = {}) {
  const random = randomGenerator((adventure.seed ^ hash(`${eventId}:${salt}`) ^ adventure.revision) >>> 0);
  const { weapons, upgrades, spells, legends } = pools(adventure, survival);
  const result = [];
  const roll = () => { const value = random() - rarityBonus; return value < 0.12 ? 'epic' : value < 0.45 ? 'rare' : 'common'; };
  function pick(pool, rarity = roll()) {
    const available = pool.filter(item => !result.some(choice => choice.type === item.type && choice.id === item.id));
    if (!available.length) return false;
    result.push({ ...available[Math.floor(random() * available.length)], rarity });
    return true;
  }
  // 手里哪一系的本领最多，就多给一张那一系的，方便凑套装。
  const counts = setCounts(adventure), favorite = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  const favored = counts[favorite] ? upgrades.filter(item => UPGRADES[item.id].family === favorite) : [];
  const fill = (...order) => { for (const pool of order) while (result.length < 3 && pick(pool)); };
  if (tier === 'door-weapon') fill(weapons, upgrades);
  if (tier === 'door-upgrade') { pick(favored); fill(upgrades, weapons); }
  if (tier === 'door-spell') { pick(spells); pick(spells); fill(upgrades, weapons); }
  if (tier === 'elite') { pick([...weapons, ...spells], 'epic') || pick(upgrades, 'epic'); pick(favored); fill(upgrades, weapons); }
  if (tier === 'boss') { pick(legends, 'legendary'); pick(upgrades, 'epic') || pick(weapons, 'epic'); pick([...weapons, ...spells], 'rare'); fill(upgrades, weapons); }
  if (!result.length) result.push({ type: 'supply', id: 'fragments', rarity: 'common' });
  if (isTierUp) for (const choice of result) choice.rarity = RARITY_ORDER[Math.min(3, RARITIES[choice.rarity].rank + 1)];
  return result;
}

export function openRoomReward(adventure, journey, survival, id, tier, family, rarityBonus = 0) {
  if (journey.pending || journey.claimed.includes(id)) return journey.pending;
  const resources = resourcesFor(adventure), isTierUp = resources.tierUp > 0;
  if (isTierUp) resources.tierUp--;
  const choices = doorChoices(adventure, id, tier, survival, { rarityBonus, isTierUp });
  journey.pending = { id, family, title: TIER_TITLES[tier], tier, player: 0, choices, rewardVersion: 1, rerolls: 0, rarityBonus };
  return journey.pending;
}
export function rerollReward(adventure, journey, survival) {
  const pending = journey.pending, resources = resourcesFor(adventure);
  if (!pending || !ROOM_TIERS.includes(pending.tier) || !(resources.rerolls > 0)) return false;
  resources.rerolls--;
  pending.rerolls = (pending.rerolls || 0) + 1;
  pending.choices = doorChoices(adventure, pending.id, pending.tier, survival, { rarityBonus: pending.rarityBonus || 0, salt: pending.rerolls });
  adventure.revision++;
  return true;
}

// 小店：站到摊位前按上。每个摊位在一间小店里只卖一次。
export function canBuy(adventure, survival, id) {
  const resources = resourcesFor(adventure);
  if (survival.phase !== 'alive' || resources.balance < SHOP_ITEMS[id].price) return false;
  if (id === 'heal') return survival.hp < survival.maxHp;
  if (id === 'skill') return pools(adventure, survival).upgrades.length > 0;
  return (resources[id === 'reroll' ? 'rerolls' : 'tierUp'] || 0) < 9;
}
export function buyStall(adventure, survival, state, id) {
  const key = `${state.roomId}:${id}`;
  if (state.bought.includes(key) || !canBuy(adventure, survival, id)) return '';
  const resources = resourcesFor(adventure);
  resources.balance -= SHOP_ITEMS[id].price;
  state.bought.push(key);
  let message = '';
  if (id === 'heal') { heal(survival, 50); message = '回血 +50！'; }
  if (id === 'reroll') { resources.rerolls = (resources.rerolls || 0) + 1; message = '买到一张重抽券，选奖励时能换一批卡。'; }
  if (id === 'tierUp') { resources.tierUp = (resources.tierUp || 0) + 1; message = '下一次奖励的品质都高一档！'; }
  if (id === 'skill') {
    const random = randomGenerator((adventure.seed ^ hash(key) ^ adventure.revision) >>> 0), options = pools(adventure, survival).upgrades;
    const choice = options[Math.floor(random() * options.length)];
    adventure.upgrades[choice.id] = (adventure.upgrades[choice.id] || 0) + 1;
    for (const loadout of adventure.loadouts) if (!loadout.upgrades.includes(choice.id)) loadout.upgrades.push(choice.id);
    message = `学会了${UPGRADES[choice.id].name}！`;
  }
  adventure.revision++;
  return message;
}
