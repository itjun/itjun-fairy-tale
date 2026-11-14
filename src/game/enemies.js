import { damageEnemy } from './combat.js';
import { RULES } from './physics.js';

const SAVE_FIELDS=['windUntil','frozenUntil','freezeImmuneUntil','hasShell','id','x','y','hp','maxHp','direction','elapsed','isDefeated','defeatedAt','isDormant','slowUntil','lastShotBeat','lastActionBeat','isSummoned','boundUntil','guardHits','isHidden','isGuarding','isShielded','shieldUntil','isEnraged','attackIndex','attackTime','attackStage','warningX','warningY'];
export function saveEnemy(enemy) { return Object.fromEntries(SAVE_FIELDS.filter(key=>enemy[key]!==undefined).map(key=>[key,enemy[key]])); }
export function restoreEnemy(enemy, saved) { for(const key of SAVE_FIELDS) if(Object.hasOwn(saved,key))enemy[key]=saved[key]; }

export function stepEnemies(enemies, dt) {
  for (const enemy of enemies) {
    enemy.elapsed += dt;
    if (enemy.isDefeated) continue;
    enemy.x += enemy.direction * enemy.speed * dt;
    if (enemy.x >= enemy.maxX) { enemy.x = enemy.maxX; enemy.direction = -1; }
    if (enemy.x <= enemy.minX) { enemy.x = enemy.minX; enemy.direction = 1; }
    if (enemy.kind === 'puff') enemy.y = enemy.baseY + Math.sin(enemy.elapsed * 1.5 + enemy.phase) * 0.35;
  }
}

export function touchEnemy(player, enemy, previousY, elapsed = enemy.elapsed) {
  if (enemy.isDefeated || enemy.isHidden || player.protection > 0) return null;
  if (Math.abs(player.x - enemy.x) > enemy.width / 2 + RULES.radius) return null;
  const top = enemy.y + enemy.height;
  if (player.vy <= 0 && previousY >= top - 0.15 && player.y <= top + 0.08) {
    const isDefeated = damageEnemy(enemy, elapsed);
    player.y = top; player.vy = RULES.jump * 0.88;
    player.isGrounded = false; player.ground = null; player.coyote = 0;
    return isDefeated ? 'stomp' : 'hit';
  }
  if (player.y >= top || player.y + 1.65 < enemy.y) return null;
  player.protection = 1; player.knockTime = 0.25;
  player.knockVx = player.x < enemy.x ? -4 : 4;
  player.vy = 5; player.isGrounded = false; player.ground = null; player.coyote = 0;
  return 'bump';
}

export function touchSpring(player, spring) {
  if (!player.isGrounded || player.ground?.id !== spring.platformId || player.springTime > 0 || Math.abs(player.x - spring.x) > 0.7) return false;
  player.vy = spring.power; player.isGrounded = false; player.ground = null;
  player.coyote = 0; player.buffer = 0; player.springTime = 0.5;
  return true;
}
