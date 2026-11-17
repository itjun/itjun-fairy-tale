import { WEAPONS } from '../../shared/adventure-catalog.js';

export function saveProjectiles(waves,shots) {
  const charges = new Map();
  const saved = waves.filter(w=>w.isActive).map(w=>{
    const copy = {...w,hitIds:[...(w.hitIds || [])]};
    for (const key of ['bindingCharge','floralCharge']) if (w[key]) {
      if (!charges.has(w[key])) charges.set(w[key],charges.size);
      copy[`${key}Id`] = charges.get(w[key]);
    }
    return structuredClone(copy);
  });
  return {waves:saved,shots:structuredClone(shots.filter(s=>s.isActive))};
}
export function restoreProjectiles(state) {
  const charges = new Map();
  const waves = (state?.waves || []).map(w=>{
    const copy = {...structuredClone(w),hitIds:new Set(w.hitIds)};
    for (const key of ['bindingCharge','floralCharge']) if (w[key] && Number.isInteger(w[`${key}Id`])) {
      const id = `${key}:${w[`${key}Id`]}`;
      if (!charges.has(id)) charges.set(id,copy[key]);
      copy[key] = charges.get(id);
    }
    return copy;
  });
  return {waves,shots:structuredClone(state?.shots || [])};
}
export function isValidProjectiles(state,world) {
  if(state===undefined)return true;
  const numbersAreFinite=value=>{
    if(typeof value==='number')return Number.isFinite(value)&&Math.abs(value)<1e8;
    if(Array.isArray(value))return value.every(numbersAreFinite);
    if(value&&typeof value==='object')return Object.values(value).every(numbersAreFinite);
    return true;
  };
  return !!state && Array.isArray(state.waves)&&state.waves.length<=15000&&Array.isArray(state.shots)&&state.shots.length<=128&&numbersAreFinite(state)
    && state.waves.every(w => w && (w.firingWeapon === undefined || WEAPONS[w.firingWeapon] || ['companion','talent'].includes(w.firingWeapon))
      && (w.ownerIndex === undefined || w.ownerIndex === 0)
      && (w.isCoasting === undefined || typeof w.isCoasting === 'boolean')
      && (w.flightBounds === undefined || w.flightBounds && [w.flightBounds.left,w.flightBounds.right].every(Number.isFinite) && w.flightBounds.left < w.flightBounds.right
        && ['top','bottom'].every(key => w.flightBounds[key] === undefined || Number.isFinite(w.flightBounds[key]))
        && (w.flightBounds.bottom === undefined || w.flightBounds.top === undefined || w.flightBounds.bottom < w.flightBounds.top)))
    && state.waves.every(w=>w&&(WEAPONS[w.kind]||w.kind==='pulse')&&[w.x,w.y,w.age,w.damage].every(Number.isFinite)&&w.age>=0&&w.age<30&&typeof w.isActive==='boolean'&&Array.isArray(w.hitIds)&&w.hitIds.every(id=>Number.isInteger(id)&&world.enemies[id-1])&&(w.kind==='pulse'?Number.isFinite(w.delay)&&Number.isFinite(w.radius):[w.direction,w.speed,w.remaining,w.slope].every(Number.isFinite)&&w.remaining>=0))
    && state.shots.every(s=>s&&[s.x,s.y,s.vx,s.vy,s.gravity,s.age].every(Number.isFinite)&&typeof s.isActive==='boolean'&&(!s.bossId||world.enemies[s.bossId-1]?.isBoss));
}
