export const INITIAL_LIVES = 3;
export const CHARACTERS = Object.freeze({
  dad: { name: '爸爸', image: 'dad-player', attack: 'dad-attack', height: 2.65, talent: '彩虹护盾', icon: 'collectible-rainbow', hint: '抵挡一次伤害，游玩 20 秒后恢复。', detail: '护盾挡不住掉坑。' },
  mom: { name: '妈妈', image: 'mom-player', attack: 'mom-attack', height: 2.5, talent: '花朵缠绕', icon: 'flower', hint: '每攻击四次，花朵让小怪慢下来。', detail: '命中时开花，让附近小怪减速 2 秒。' },
  sister: { name: '姐姐', image: 'sister-player', attack: 'sister-attack', height: 2.2, talent: '星雨连击', icon: 'collectible-star', hint: '每攻击四次，追加一阵向前的星雨。', detail: '可以和每一种武器搭配。' },
  little: { name: '妹妹', image: 'little-player', attack: 'little-attack', height: 1.9, talent: '轻盈二段跳', icon: 'lift-leaf', hint: '跳起来后，再按一次跳跃，还能跳一次。', detail: '落地后恢复，按住不会自动连跳。' },
});
export const INITIAL_HP = 100;
export function newSurvival(character = 'sister') {
  return { version: 4, character, lives: INITIAL_LIVES, hp: INITIAL_HP, maxHp: INITIAL_HP, phase: 'alive', shieldRemaining: 0, attacks: 0, revision: 0 };
}
export function isValidSurvival(s) {
  if (!s || ![1,2,3,4].includes(s.version) || !CHARACTERS[s.character] || !['alive','fallen','over'].includes(s.phase)) return false;
  if (!Number.isInteger(s.lives) || s.lives < 0 || s.lives > 999 || (s.phase === 'over' ? s.lives !== 0 : s.lives === 0)) return false;
  if (![s.shieldRemaining,s.attacks,s.revision].every(Number.isFinite) || s.shieldRemaining < 0 || s.shieldRemaining > 20 || !Number.isInteger(s.attacks) || s.attacks < 0 || s.attacks >= 4 || !Number.isSafeInteger(s.revision) || s.revision < 0) return false;
  if (s.version === 4) return Number.isInteger(s.maxHp) && s.maxHp >= 100 && s.maxHp <= 2100 && Number.isInteger(s.hp) && s.hp >= 0 && s.hp <= s.maxHp && (s.phase === 'alive' ? s.hp > 0 : s.hp === 0);
  if (s.version === 1) return s.lives <= 9 && Number.isInteger(s.hp) && s.hp >= 0 && s.hp <= 3 && (s.phase === 'alive' ? s.hp > 0 : s.hp === 0);
  return s.hp === undefined && (s.version === 2 ? s.lives <= 9 : Number.isInteger(s.maxLives) && s.maxLives >= 9 && s.maxLives <= 99 && s.lives <= s.maxLives);
}
export function migrateSurvival(s) {
  const migrated = structuredClone(s);
  if (s.version === 4) return migrated;
  migrated.maxHp = Math.min(2100, INITIAL_HP + Math.max(0, (s.maxLives || 9) - 9) * 20);
  migrated.hp = s.phase === 'alive' ? Math.max(1, Math.round(migrated.maxHp * (s.version === 1 ? s.hp / 3 : s.version === 2 ? 1 : s.lives / (s.maxLives || 9)))) : 0;
  migrated.lives = s.version === 3 ? (s.phase === 'over' ? 0 : INITIAL_LIVES) : s.lives;
  delete migrated.maxLives;
  migrated.version = 4;
  return migrated;
}
export function addLife(s, amount = 1) {
  if (s.phase !== 'alive' || s.lives >= 999) return false;
  s.lives = Math.min(999, s.lives + amount); s.revision++; return true;
}
export function takeDamage(s, isFall = false, amount = 10) {
  if (s.phase !== 'alive') return false;
  s.revision++;
  if (!isFall && s.character === 'dad' && s.shieldRemaining <= 0) { s.shieldRemaining = 20; return 'shield'; }
  s.hp = Math.max(0, s.hp - (isFall ? 25 : Math.max(1, Math.round(amount))));
  if (!s.hp) { s.lives = Math.max(0, s.lives - 1); s.phase = s.lives ? 'fallen' : 'over'; return 'death'; }
  return 'hurt';
}
export function reviveSurvival(s) {
  if (s.phase !== 'fallen' || s.lives <= 0) return false;
  s.phase = 'alive'; s.hp = s.maxHp; s.revision++; return true;
}
export function recordAttack(s) {
  if (s.phase !== 'alive' || !['mom','sister'].includes(s.character)) return false;
  s.attacks = (s.attacks + 1) % 4; s.revision++;
  return s.attacks === 0;
}
export function bloomAtHit(wave, hits, enemies, elapsed) {
  if (!(wave.isFloral || wave.floralCharge && !wave.floralCharge.isUsed) || !hits.length) return null;
  wave.isFloral = false; if (wave.floralCharge) wave.floralCharge.isUsed = true;
  const target = hits[0].enemy;
  for (const enemy of enemies) if (!enemy.isDefeated && !enemy.isDormant && Math.hypot(enemy.x-target.x, enemy.y-target.y) < 4) enemy.slowUntil = Math.max(enemy.slowUntil || 0, elapsed + 2);
  return { x: target.x, y: target.y + 0.8, at: elapsed };
}
