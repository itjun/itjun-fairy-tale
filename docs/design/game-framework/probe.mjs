import { writeFile } from 'node:fs/promises';
import { WORLD_ACTS } from '../../../shared/levels.js';
import { createRoomWorld } from '../../../shared/room-world.js';
import { newSurvival } from '../../../src/game/characters.js';
import { headless, run } from '../../../tests/helpers/headless-engine.mjs';

const rooms = {};
const seedsPerWorld = 40;
for (const stage of WORLD_ACTS) for (let seed = 1; seed <= seedsPerWorld; seed++) {
  const world = createRoomWorld(seed, stage);
  for (const room of world.rooms) {
    const counts = rooms[room.kind] ||= [];
    counts.push(room.enemyIds.map(id => world.enemies[id - 1]).filter(enemy => !enemy.isChallenge).length);
  }
}
const battles = [];
for (const stage of WORLD_ACTS) for (const cycle of [1, 2, 3]) for (const build of ['moon', 'stack']) {
  const game = headless('boss-moon', stage.id);
  Object.assign(game.adventure, { cycle, difficulty: 'easy' });
  if (build === 'stack') {
    const a = game.adventure;
    a.weapons = ['blade','bubble','stars','boomerang','seed','firefly','flame','moonblade'];
    a.attackBindings = ['moonblade', 'blade', 'bubble'];
    a.weaponRanks = Object.fromEntries(a.weapons.map(id => [id, 4]));
    a.upgrades = { double: 1, split: 1, fan: 2, rapid: 3, area: 2 };
    a.loadouts[0].weapons = [...a.weapons]; a.loadouts[0].upgrades = Object.keys(a.upgrades); a.growth.power = 6;
  }
  game.applyRoomRules(); game.survival = newSurvival('little'); game.players[0].protection = 0;
  const boss = game.world.enemies.find(enemy => enemy.isBoss), start = game.elapsed;
  game.keys.add('KeyJ'); let casts = 0, previous = boss.attackStage;
  run(game, 60, () => {
    if (boss.attackStage === 'attack' && previous !== 'attack') casts++;
    previous = boss.attackStage;
    if (boss.isWarning && boss.attackTime > 2 && game.players[0].isGrounded) game.jumps[0] = true;
    return boss.isDefeated || game.survival.phase !== 'alive';
  });
  battles.push({ world: stage.name, cycle, build, seconds: +(game.elapsed - start).toFixed(2), casts, isDefeated: boss.isDefeated, remainingBossHp: boss.hp, maxBossHp: boss.maxHp, playerHp: game.survival.hp, lives: game.survival.lives });
}
const result = { date: new Date().toISOString().slice(0, 10), method: '实际 GardenEngine，固定种子 42，轻松档，妹妹，持续攻击并在预告后跳跃；不是人工完整通关。单弯刀无成长；强化组使用 4 级弯刀，绑定光刃和泡泡，攻击成长 6，附双发、分裂、扇形、攻速与范围。', mapSamples: WORLD_ACTS.length * seedsPerWorld, candidateRooms: Object.values(rooms).reduce((sum, values) => sum + values.length, 0), rooms: Object.fromEntries(Object.entries(rooms).map(([id, values]) => [id, { min: Math.min(...values), max: Math.max(...values), samples: values.length }])), battles };
await writeFile(new URL('./probe-results.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ battles: battles.length, wins: battles.filter(row => row.isDefeated).length, rooms: result.rooms, ranges: [1,2,3].map(cycle => Object.fromEntries(['moon','stack'].map(build => { const rows = battles.filter(row => row.cycle === cycle && row.build === build); return [build, { cycle, min: Math.min(...rows.map(r => r.seconds)), max: Math.max(...rows.map(r => r.seconds)), minCasts: Math.min(...rows.map(r => r.casts)) }]; }))) }, null, 2));
