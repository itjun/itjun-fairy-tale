import { newAdventure } from './adventure.js';
import { WEAPONS, UPGRADES } from '../../shared/adventure-catalog.js';

const RECOMMENDED = {
  dad: { weapons:['moonblade'], upgrades:['armor','petal'] },
  mom: { weapons:['moonblade'], upgrades:['frost','petal'] },
  sister: { weapons:['moonblade'], upgrades:['rapid','magnet'] },
  little: { weapons:['moonblade'], upgrades:['feather','safeLanding'] },
};
export const EXPLORATION_UPGRADES = new Set(['double','split','fan','seek','returnSplit','bloom','companion','linger']);
export function recommendedStarter(character) { return structuredClone(RECOMMENDED[character] || RECOMMENDED.sister); }
export function isValidStarter(build) {
  const isList=(items,catalog,min)=>Array.isArray(items)&&items.length>=min&&items.length<=2&&new Set(items).size===items.length&&items.every(id=>Object.hasOwn(catalog,id));
  return !!build&&isList(build.weapons,WEAPONS,1)&&build.weapons.length===1&&isList(build.upgrades,UPGRADES,0)&&build.upgrades.every(id=>!EXPLORATION_UPGRADES.has(id)&&(!UPGRADES[id].weapon||build.weapons.includes(UPGRADES[id].weapon)));
}
export function starterAdventure(seed,build) {
  if(!isValidStarter(build))return null;
  const adventure=newAdventure(seed);
  adventure.weapons=[...build.weapons];
  adventure.upgrades=Object.fromEntries(build.upgrades.map(id=>[id,1]));
  adventure.loadouts=[{weapon:build.weapons[0],weapons:[...build.weapons],upgrades:[...build.upgrades]}];
  return adventure;
}
