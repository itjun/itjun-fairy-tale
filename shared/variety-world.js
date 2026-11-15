import { createCombatWorld } from './combat-world.js';
import { EXPANDED_THEME_MONSTERS, MONSTERS } from './adventure-catalog.js';
import { STAGES } from './levels.js';
import { bossBaseline } from './boss-health.js';
import { BOSS_SKILL_FOR_BEHAVIOR, BOSS_SKILL_NAMES, monsterVitality } from './monster-roles.js';

function retuneMidBoss(world, stage) {
  const mid = world.enemies.find(enemy => enemy.isMidBoss);
  if (!mid) return;
  const pool = EXPANDED_THEME_MONSTERS[world.themeId];
  const kind = pool[(stage.chapter * 3 + stage.worldIndex) % pool.length];
  const definition = MONSTERS[kind];
  const skillKind = BOSS_SKILL_FOR_BEHAVIOR[definition.behavior] || 'charge';
  mid.kind = kind;
  mid.name = `${definition.name}队长`;
  mid.image = definition.image;
  mid.behavior = definition.behavior;
  mid.family = definition.family;
  mid.points = 65;
  mid.skills = [{ ...mid.skills[0], kind: skillKind, name: BOSS_SKILL_NAMES[skillKind] }];
  mid.patterns = [skillKind];
}

function diversify(world) {
  const pool = EXPANDED_THEME_MONSTERS[world.themeId];
  for (const zone of world.zones.filter(item => !item.isBoss)) {
    const used = new Set();
    for (const enemy of world.enemies.filter(item => item.zone === zone.id && !item.isBoss && !item.parentId)) {
      if (enemy.childIds?.length || !used.has(enemy.behavior)) { used.add(enemy.behavior); continue; }
      const replacement = pool.find(kind => !used.has(MONSTERS[kind].behavior));
      if (!replacement) continue;
      const definition = MONSTERS[replacement];
      enemy.kind = replacement;
      enemy.name = definition.name;
      enemy.behavior = definition.behavior;
      enemy.family = definition.family;
      enemy.image = definition.image;
      enemy.points = definition.points;
      enemy.hasShell = replacement === 'penguin' ? true : undefined;
      used.add(definition.behavior);
    }
  }
}

// 第 7 版不改平台和路径，只改同一条路上的对手：血量按角色分档，同一房间少放重复动作，中段首领使用自己的招式。
export function createVarietyWorld(seed, level) {
  const world = createCombatWorld(seed, level);
  const stage = STAGES.find(item => item.id === world.stageId);
  world.version = 7;
  diversify(world);
  for (const enemy of world.enemies) {
    if (enemy.isBoss) {
      const role = enemy.isMidBoss ? 'mid' : enemy.isWorldBoss ? 'world' : 'small';
      const hp = bossBaseline(stage, role, 7);
      enemy.hp = hp;
      enemy.maxHp = hp;
      continue;
    }
    if (enemy.parentId) {
      enemy.hp = 12; enemy.maxHp = 12; enemy.showBar = false; enemy.touchDamage = 8; enemy.period = 2.2; enemy.role = 'scout';
      continue;
    }
    const spec = monsterVitality(enemy.kind, stage, enemy.isElite);
    enemy.hp = spec.hp; enemy.maxHp = spec.hp; enemy.touchDamage = spec.touchDamage;
    enemy.period = spec.period; enemy.showBar = spec.showBar; enemy.role = spec.role;
  }
  retuneMidBoss(world, stage);
  world.signature += ':variety7';
  return world;
}
