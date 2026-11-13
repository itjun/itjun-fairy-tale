import { randomGenerator } from '../../shared/random.js';
import { newResources, resourcesFor, isValidResources, heal } from './expedition.js';
import { WEAPONS, UPGRADES, upgradeCategory } from '../../shared/adventure-catalog.js';
export { WEAPONS, UPGRADES };

export function newAdventure(seed, count = 1) {
  return { version: 1, seed, resources: newResources(), weapons: ['blade'], upgrades: {}, loadouts: Array.from({ length: count }, () => ({ weapon: 'blade', upgrades: [] })), revision: 0 };
}
export function newJourney() { return { routes: {}, claimed: [], pending: null, queued: [], fragments: 0 }; }
export function upgradePower(adventure, index = 0) {
  const loadout = adventure.loadouts[index];
  return Object.fromEntries(loadout.upgrades.filter(id => !UPGRADES[id].weapon || UPGRADES[id].weapon === loadout.weapon).map(id => [id, adventure.upgrades[id]]));
}
function hash(text) { let value = 2166136261; for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619); return value >>> 0; }
export function rewardChoices(adventure, eventId, family, player = 0, survival) {
  const random = randomGenerator((adventure.seed ^ hash(eventId) ^ adventure.revision) >>> 0);
  const weapon = adventure.loadouts[player].weapon;
  const candidates = [
    ...Object.entries(WEAPONS).filter(([id]) => !adventure.weapons.includes(id)).map(([id, definition]) => ({ type: 'weapon', id, ...definition })),
    ...Object.entries(UPGRADES).filter(([id, d]) => (adventure.upgrades[id] || 0) < (d.maxRank || 1) && (!d.weapon || d.weapon === weapon)).map(([id, definition]) => ({ type: 'upgrade', id, ...definition })),
  ].map(item => ({ ...item, order: random() + (item.family === family ? 1.2 : 0) }));
  const result = [];
  const take = condition => { const next = candidates.filter(item => !result.includes(item) && condition(item)).sort((a, b) => b.order - a.order)[0]; if (next) result.push(next); };
  take(item => item.type === 'weapon' || upgradeCategory(item.id) === 'attack');
  take(item => item.type === 'upgrade' && upgradeCategory(item.id) === 'survival');
  take(item => item.type === 'upgrade' && upgradeCategory(item.id) === 'resource');
  while (result.length < Math.min(3, candidates.length)) take(() => true);
  const choices = result.map(({ type, id }) => ({ type, id }));
  if (survival?.hp < 3) choices[Math.min(1, choices.length)] = { type: 'supply', id: 'heal' };
  if (upgradePower(adventure, player).duplicate) {
    const duplicates = Object.keys(adventure.upgrades).filter(id => adventure.upgrades[id] >= (UPGRADES[id].maxRank || 1));
    if (duplicates.length && random() < 0.5) choices[Math.min(2, choices.length)] = { type: 'salvage', id: duplicates[Math.floor(random() * duplicates.length)] };
  }
  if (!choices.length) choices.push({ type: 'supply', id: 'fragments' });
  // 每次仍保证生存/资源选择，探索技能轮换替代攻击位。
  const utility = candidates.filter(item => item.type === 'upgrade' && upgradeCategory(item.id) === 'utility').sort((a,b) => b.order-a.order)[0];
  if (utility && random() < 0.25 && choices.length === 3) choices[0] = { type: 'upgrade', id: utility.id };
  return choices;
}
export function queueReward(journey, id, family, title) {
  if (journey.claimed.includes(id) || journey.pending?.id === id || journey.queued.some(e => e.id === id)) return false;
  journey.queued.push({ id, family, title }); return true;
}
export function openReward(adventure, journey, survival) {
  if (journey.pending || !journey.queued.length) return journey.pending;
  const event = journey.queued.shift();
  const choices = rewardChoices(adventure, event.id, event.family, 0, survival);
  if (!choices.length) { journey.claimed.push(event.id); return null; }
  journey.pending = { ...event, player: 0, choices };
  return journey.pending;
}
export function chooseReward(adventure, journey, choiceIndex, survival) {
  const pending = journey.pending, choice = pending?.choices[choiceIndex];
  if (!choice || !Number.isInteger(choiceIndex)) return false;
  const loadout = adventure.loadouts[pending.player];
  if (choice.type === 'weapon') {
    if (!adventure.weapons.includes(choice.id)) adventure.weapons.push(choice.id);
    loadout.weapon = choice.id;
    loadout.upgrades = loadout.upgrades.filter(id => !UPGRADES[id].weapon || UPGRADES[id].weapon === choice.id);
  } else if (choice.type === 'supply') {
    if (choice.id === 'heal') { if (!survival || !heal(survival)) return false; }
    else resourcesFor(adventure).balance += 3;
  } else if (choice.type === 'salvage') {
    resourcesFor(adventure).balance += upgradePower(adventure, pending.player).duplicate ? 5 : 2;
  } else {
    adventure.upgrades[choice.id] = Math.min(UPGRADES[choice.id].maxRank || 1, (adventure.upgrades[choice.id] || 0) + 1);
    if (!loadout.upgrades.includes(choice.id) && loadout.upgrades.length < 3) loadout.upgrades.push(choice.id);
  }
  return finishReward(adventure, journey);
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
  if (!adventure.loadouts[player] || !adventure.weapons.includes(id)) return false;
  adventure.loadouts[player].weapon = id;
  adventure.loadouts[player].upgrades = adventure.loadouts[player].upgrades.filter(key => !UPGRADES[key].weapon || UPGRADES[key].weapon === id);
  adventure.revision++; return true;
}
export function toggleUpgrade(adventure, player, id) {
  const loadout = adventure.loadouts[player];
  if (!loadout || !adventure.upgrades[id] || UPGRADES[id].weapon && UPGRADES[id].weapon !== loadout.weapon) return false;
  if (loadout.upgrades.includes(id)) loadout.upgrades = loadout.upgrades.filter(value => value !== id);
  else if (loadout.upgrades.length < 3) loadout.upgrades.push(id);
  else return false;
  adventure.revision++; return true;
}
export function isValidAdventure(adventure, count) {
  const isUnique = (items, definitions) => Array.isArray(items) && new Set(items).size === items.length && items.every(id => Object.hasOwn(definitions, id));
  return adventure?.version === 1 && isValidResources(adventure.resources) && Number.isInteger(adventure.seed) && adventure.seed >= 0 && adventure.seed <= 0xffffffff
    && Number.isSafeInteger(adventure.revision) && adventure.revision >= 0
    && isUnique(adventure.weapons, WEAPONS) && adventure.weapons.includes('blade')
    && adventure.upgrades && !Array.isArray(adventure.upgrades) && Object.entries(adventure.upgrades).every(([id, rank]) => Object.hasOwn(UPGRADES, id) && Number.isInteger(rank) && rank >= 1 && rank <= (UPGRADES[id].maxRank || 1))
    && Array.isArray(adventure.loadouts) && adventure.loadouts.length === count && adventure.loadouts.every(l => adventure.weapons.includes(l.weapon) && isUnique(l.upgrades, UPGRADES) && l.upgrades.length <= 3 && l.upgrades.every(id => adventure.upgrades[id]));
}
export function isValidJourney(journey, world, count) {
  const isEvent = e => e && typeof e.id === 'string' && e.id.length < 120 && ['power', 'bubble', 'flight', 'frost', 'nature'].includes(e.family) && typeof e.title === 'string';
  const isRoute = ([id, route]) => world.forks.some(f => String(f.id) === id && f.routes.some(r => r.id === route));
  if (!journey || !journey.routes || !Object.entries(journey.routes).every(isRoute) || !Array.isArray(journey.claimed) || journey.claimed.length > 100 || !journey.claimed.every(id => typeof id === 'string') || new Set(journey.claimed).size !== journey.claimed.length || !Array.isArray(journey.queued) || journey.queued.length > 30 || !journey.queued.every(isEvent) || !Number.isInteger(journey.fragments) || journey.fragments < 0) return false;
  const pending = journey.pending;
  return pending === null || isEvent(pending) && !journey.claimed.includes(pending.id) && Number.isInteger(pending.player) && pending.player >= 0 && pending.player < count && Array.isArray(pending.choices) && pending.choices.length > 0 && pending.choices.length <= 3 && pending.choices.every(c => c && (['weapon', 'upgrade', 'salvage'].includes(c.type) && Object.hasOwn(c.type === 'weapon' ? WEAPONS : UPGRADES, c.id) || c.type === 'supply' && ['heal', 'fragments'].includes(c.id))) && new Set(pending.choices.map(c => `${c.type}:${c.id}`)).size === pending.choices.length;
}

export function rewardItem(choice) {
  if (choice.type === 'supply') return choice.id === 'heal' ? { name: '恢复点心', hint: '现在恢复 1 格体力', image: 'icecream', category: 'survival' } : { name: '彩笔碎片', hint: '收下 3 片碎片，去休息点换补给', image: 'upgrade-recycle', category: 'resource' };
  const item = (choice.type === 'weapon' ? WEAPONS : UPGRADES)[choice.id];
  return choice.type === 'salvage' ? { ...item, name: '重复变宝', hint: `${item.name}已学会，回收得 5 片碎片`, category: 'resource' } : { ...item, category: choice.type === 'weapon' ? 'attack' : upgradeCategory(choice.id) };
}
