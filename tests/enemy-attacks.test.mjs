import test from 'node:test';
import assert from 'node:assert/strict';
import { MONSTERS } from '../shared/adventure-catalog.js';
import { monsterVitality } from '../shared/monster-roles.js';
import { stepAdventureEnemies, enemyTiming } from '../src/game/adventure-enemies.js';
const enemy = (id, x, extra = {}) => ({id, x, y:0, width:1, height:2, hp:1000, maxHp:1000, combatVersion:2, ...extra});

test('每一种小怪都会在完整预告后主动发出攻击', () => {
  for (const [kind, spec] of Object.entries(MONSTERS)) {
    const vitality = monsterVitality(kind, {index:0});
    const e = {...enemy(1, 5), ...vitality, kind, behavior:spec.behavior, phase:0, elapsed:0, baseY:0, minX:2, maxX:8, direction:1, speed:1};
    const shots = [], timing = enemyTiming(e);
    let firstShot = null;
    for (let frame = 1; frame <= 1200; frame++) {
      stepAdventureEnemies([e], [{x:0, y:3}], 1/120, frame/120, shots);
      if (shots.length && firstShot === null) firstShot = frame / 120;
    }
    assert.ok(shots.length >= 2, `${kind} 没有重复主动攻击`);
    assert.ok(firstShot >= timing.rest + timing.warning - 1/120, kind);
    assert.ok(shots.every(s => s.damage === 20 && Number.isFinite(s.vx) && Number.isFinite(s.vy)), kind);
  }
});
