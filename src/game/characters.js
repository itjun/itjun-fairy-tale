export const INITIAL_LIVES = 9;
export const CHARACTERS = Object.freeze({
  dad: { name: '爸爸', image: 'dad-player', attack: 'dad-attack', height: 2.65, talent: '彩虹护盾', icon: 'collectible-rainbow', hint: '抵挡一次伤害，游玩 20 秒后恢复。', detail: '护盾挡不住掉坑。' },
  mom: { name: '妈妈', image: 'mom-player', attack: 'mom-attack', height: 2.5, talent: '花朵缠绕', icon: 'flower', hint: '每攻击四次，花朵让小怪慢下来。', detail: '命中时开花，让附近小怪减速 2 秒。' },
  sister: { name: '姐姐', image: 'sister-player', attack: 'sister-attack', height: 2.2, talent: '星雨连击', icon: 'collectible-star', hint: '每攻击四次，追加一阵向前的星雨。', detail: '可以和每一种武器搭配。' },
  little: { name: '妹妹', image: 'little-player', attack: 'little-attack', height: 1.9, talent: '轻盈二段跳', icon: 'lift-leaf', hint: '跳起来后，再按一次跳跃，还能跳一次。', detail: '落地后恢复，按住不会自动连跳。' },
});
export function newSurvival(character = 'sister') {
  return { version: 1, character, hp: 3, lives: INITIAL_LIVES, phase: 'alive', shieldRemaining: 0, attacks: 0, revision: 0 };
}
export function isValidSurvival(s) {
  return !!s && s.version === 1 && !!CHARACTERS[s.character] && Number.isInteger(s.hp) && s.hp >= 0 && s.hp <= 3 && Number.isInteger(s.lives) && s.lives >= 0 && s.lives <= INITIAL_LIVES && ['alive','fallen','over'].includes(s.phase) && (s.phase === 'alive' ? s.hp > 0 && s.lives > 0 : s.hp === 0 && (s.phase === 'over' ? s.lives === 0 : s.lives > 0)) && Number.isFinite(s.shieldRemaining) && s.shieldRemaining >= 0 && s.shieldRemaining <= 20 && Number.isInteger(s.attacks) && s.attacks >= 0 && s.attacks < 4 && Number.isInteger(s.revision) && s.revision >= 0;
}
export function takeDamage(s, isFall = false) {
  if (s.phase !== 'alive') return false;
  s.revision++;
  if (!isFall && s.character === 'dad' && s.shieldRemaining <= 0) { s.shieldRemaining = 20; return 'shield'; }
  s.hp = isFall ? 0 : Math.max(0, s.hp - 1);
  if (s.hp === 0) { s.lives--; s.phase = s.lives ? 'fallen' : 'over'; return 'death'; }
  return 'hurt';
}
export function reviveSurvival(s) {
  if (s.phase !== 'fallen' || s.lives <= 0) return false;
  s.hp = 3; s.phase = 'alive'; s.revision++; return true;
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
