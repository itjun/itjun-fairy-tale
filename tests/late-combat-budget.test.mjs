import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WEAPONS } from '../shared/adventure-catalog.js';
import { newAdventure } from '../src/game/adventure.js';
import { fireLoadout, stepAdventureWave } from '../src/game/adventure-combat.js';
import { createPlayer, stepPlayer } from '../src/game/physics.js';
import { SkillEffects } from '../src/game/skill-effects.js';

test('很多技能叠在一起时，弹道画面不跟着每帧拆掉重建', () => {
  const scene = new THREE.Scene();
  const geometry = new THREE.PlaneGeometry(1, 1);
  const materials = Object.fromEntries(['blade', 'stars', 'bubble', 'moonblade', 'flame', 'dragon'].map(kind => [kind, new THREE.MeshBasicMaterial()]));
  const effects = new SkillEffects(scene, geometry, materials, true);
  const waves = Array.from({ length: 200 }, (_, index) => ({ kind: 'blade', isActive: true, x: index * 0.2, y: 1, direction: 1, slope: 0, age: 0, headingX: 1, headingY: 0 }));
  const players = [{ x: 20, y: 0 }];
  let added = 0;
  const add = scene.add.bind(scene);
  scene.add = (...items) => { added += items.length; return add(...items); };
  for (let frame = 0; frame < 20; frame++) effects.update(waves, players, frame / 60, 20, 18, ['blade']);
  added = 0;
  effects.update(waves, players, 1, 20, 18, ['blade']);
  assert.equal(added, 0);
  waves.splice(0, 1);
  effects.update(waves, players, 1.02, 20, 18, ['blade']);
  assert.ok(added <= 8, `少了一发弹道却新建了 ${added} 个画面`);
  geometry.dispose();
  for (const material of Object.values(materials)) material.dispose();
});

test('后期按住攻击并连续跳跃，单步结算仍然留在一帧里面', () => {
  const adventure = newAdventure(1, 1);
  adventure.weapons = Object.keys(WEAPONS);
  adventure.weaponRanks = Object.fromEntries(adventure.weapons.map(id => [id, 4]));
  adventure.qualities = Object.fromEntries(adventure.weapons.map(id => [`weapon:${id}`, 'legendary']));
  adventure.upgrades = { double: 1, split: 1, chain: 3, area: 3, rapid: 3, fan: 3, seek: 1, wide: 2, frost: 2 };
  adventure.loadouts[0] = { weapon: 'moonblade', weapons: adventure.weapons, upgrades: Object.keys(adventure.upgrades) };
  adventure.effects = { rainbowBoost: 60, quickTreat: 90 };
  adventure.growth = { power: 6 };
  const platforms = Array.from({ length: 40 }, (_, index) => ({ id: index, x: index * 6, y: 0, width: 5, isEnabled: true }));
  const enemies = Array.from({ length: 12 }, (_, index) => ({ id: index + 1, x: 12 + index * 3, y: 1, width: 1.2, height: 1.4, hp: 400, direction: -1, isBoss: index === 11, isDefeated: false }));
  const player = createPlayer(platforms[1]);
  player.weaponShots = {};
  player.weaponCycles = {};
  const bounds = { left: -30, right: 55 };
  const step = 1 / 120;
  let waves = [];
  const times = [];
  for (let n = 0; n < 240; n++) {
    const started = performance.now();
    stepPlayer(player, { direction: 1, jump: n % 45 === 0, speedMultiplier: 1.15 }, platforms, step, { minY: -20, maxX: 240 });
    waves.push(...fireLoadout(player, n * step, bounds, adventure, 0));
    const spawned = [];
    const next = [];
    for (const wave of waves) {
      const result = stepAdventureWave(wave, enemies, platforms, step, n * step);
      spawned.push(...result.spawned);
      if (wave.isActive) next.push(wave);
    }
    waves = next.concat(spawned);
    times.push(performance.now() - started);
  }
  times.sort((a, b) => a - b);
  const p95 = times[Math.floor(times.length * 0.95)];
  assert.ok(p95 < 4, `后期战斗单步 p95 ${p95.toFixed(2)}ms`);
  assert.ok(enemies.some(enemy => enemy.hp < 400), '弹道仍然打得到前面的小怪');
});
