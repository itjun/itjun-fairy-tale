import { WEAPONS } from '../../shared/adventure-catalog.js';
import { SPELLS } from '../../shared/combat-catalog.js';

export const ATTACK_KEYS = Object.freeze([
  { pad: 'X', keyboard: 'J', code: 'KeyJ', action: 'attack' },
  { pad: 'Y', keyboard: 'K', code: 'KeyK', action: 'spell' },
  { pad: 'B', keyboard: 'L', code: 'KeyL', action: 'back' },
]);

export function attackItem(id) {
  if (Object.hasOwn(WEAPONS, id)) return WEAPONS[id];
  return Object.hasOwn(SPELLS, id) ? SPELLS[id] : undefined;
}

export function ownedAttacks(adventure) {
  return [...adventure.weapons, ...(adventure.magic?.equipped || [])];
}

export function attackBindings(adventure) {
  if (adventure.attackBindings) return adventure.attackBindings;
  const loadout = adventure.loadouts[0];
  const legacy = [loadout.weapon, ...(loadout.weapons || []), ...(adventure.magic?.equipped || [])];
  const ordered = [...new Set(legacy)];
  return ATTACK_KEYS.map((_, index) => ordered[index] ?? null);
}

export function isValidAttackBindings(bindings, adventure) {
  if (bindings === undefined) return true;
  if (!Array.isArray(bindings) || bindings.length !== ATTACK_KEYS.length) return false;
  const owned = ownedAttacks(adventure), entries = bindings.filter(id => id !== null);
  return entries.length > 0 && new Set(entries).size === entries.length && entries.every(id => owned.includes(id));
}

export function bindAttack(adventure, slot, id) {
  if (!Number.isInteger(slot) || !ATTACK_KEYS[slot] || !ownedAttacks(adventure).includes(id)) return false;
  const current = attackBindings(adventure);
  if (current[slot] === id) return false;
  const next = [...current], previous = next.indexOf(id);
  if (previous >= 0) next[previous] = next[slot];
  next[slot] = id;
  adventure.attackBindings = next;
  adventure.revision++;
  return true;
}

export function wheelSector(x, y, count) {
  if (count < 1 || Math.hypot(x, y) < .52) return -1;
  const turns = (Math.atan2(x, -y) / (2 * Math.PI) + 1) % 1;
  return Math.round(turns * count) % count;
}

// Hold one weapon to repeat it. Buttons pressed during a busy round never queue an attack.
export function attackInput(state, down, canChoose) {
  const pressed = down.filter(index => !state.down.includes(index));
  state.down = down;
  if (!down.includes(state.slot)) state.slot = undefined;
  const choice = pressed.find(canChoose);
  if (choice !== undefined) state.slot = choice;
  if (state.slot === undefined || choice === undefined && down.length > 1) return null;
  return { slot: state.slot, isPressed: choice !== undefined };
}
