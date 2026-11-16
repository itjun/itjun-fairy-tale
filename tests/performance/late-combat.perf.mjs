import test from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS } from '../../shared/adventure-catalog.js';
import { newAdventure } from '../../src/game/adventure.js';
import { fireLoadout, stepAdventureWave } from '../../src/game/adventure-combat.js';
import { createPlayer, stepPlayer } from '../../src/game/physics.js';

// 真实耗时预算单独运行，功能检查仍然并行；门槛不因机器争抢资源而放宽。
test('后期按住攻击并连续跳跃，单步结算仍然留在一帧里面', t => {
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
  const cpuTimes = [];
  let peakWaves = 0;
  for (let n = 0; n < 240; n++) {
    const started = performance.now();
    const cpuStarted = process.threadCpuUsage();
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
    peakWaves = Math.max(peakWaves, waves.length);
    const cpu = process.threadCpuUsage(cpuStarted);
    cpuTimes.push((cpu.user + cpu.system) / 1000);
    times.push(performance.now() - started);
  }
  times.sort((a, b) => a - b);
  const p95 = times[Math.floor(times.length * 0.95)];
  cpuTimes.sort((a, b) => a - b);
  t.diagnostic(JSON.stringify({ p95, cpuP95: cpuTimes[Math.floor(cpuTimes.length * 0.95)], peakWaves }));
  assert.ok(p95 < 4, `后期战斗单步 p95 ${p95.toFixed(2)}ms`);
  assert.ok(enemies.some(enemy => enemy.hp < 400), '弹道仍然打得到前面的小怪');
});
