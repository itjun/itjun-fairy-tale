import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
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
