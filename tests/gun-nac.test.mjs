import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newFlight,
  tick,
  decodeFlight,
  shopBuy,
  depart,
  continueFlight,
  nextSpeed,
} from '../src/gun-nac/flight.js';
import { BOSS, ROUTES } from '../src/gun-nac/stages.js';
import { bomb, collect, shoot } from '../src/gun-nac/arsenal.js';
import { enterBoss, bossTargets, hitBoss, updateBoss } from '../src/gun-nac/bosses.js';
import { makePilot } from '../scripts/helpers/gun-nac-pilot.mjs';

test('固定输入与战斗中断保存逐帧一致', () => {
  const s = newFlight({ seed: 6 });
  for (let i = 0; i < 700; i++) tick(s, { fire: true, x: i < 20 ? -1 : 0 });
  const restored = decodeFlight(JSON.stringify(s));
  for (let i = 0; i < 240; i++) {
    const input = { fire: true, x: i % 70 < 33 ? 1 : -1, bomb: i === 5 };
    tick(s, input);
    tick(restored, input);
  }
  assert.deepEqual(restored, s);
  assert.equal(decodeFlight('{}'), null);
  assert.equal(decodeFlight('bad'), null);
});
test('五种武器、机翼与四档机速通过实际拾取与开火生效', () => {
  const s = newFlight();
  for (let g = 1; g <= 5; g++) {
    collect(s, { kind: 'gun' + g });
    s.shots = [];
    shoot(s);
    assert.ok(s.shots.every((b) => b.gun === g));
  }
  for (let i = 0; i < 12; i++) collect(s, { kind: 'gun5' });
  assert.equal(s.ship.power, 3);
  collect(s, { kind: 'wing' });
  for (let i = 0; i < 12; i++) collect(s, { kind: 'gun5' });
  assert.equal(s.ship.power, 8);
  const speeds = [];
  for (let i = 0; i < 4; i++) {
    nextSpeed(s);
    speeds.push(s.ship.speed);
  }
  assert.equal(new Set(speeds).size, 4);
  const beforeBack = s.ship.speed;
  nextSpeed(s, -1);
  assert.equal(s.ship.speed, ((beforeBack - 2 + 4) % 4) + 1);
  nextSpeed(s, 1);
  assert.equal(s.ship.speed, beforeBack);
  for (const t of 'FBTW') {
    s.bombs = [];
    s.ship.stock = 10;
    collect(s, { kind: 'bomb' + t });
    bomb(s);
    assert.equal(s.bombs[0].kind, t);
    assert.ok(s.ship.stock < 11);
  }
});
test('击落、续关、商店和预送炸弹各结算一次', () => {
  const s = newFlight();
  s.ship.cash = 50;
  s.phase = 'shop';
  assert.equal(shopBuy(s, 'parcel', 3), true);
  assert.equal(s.orders[3], 1);
  assert.equal(shopBuy(s, 'turbo'), true);
  assert.equal(s.ship.cash, 40);
  assert.equal(depart(s), true);
  assert.equal(depart(s), false);
  assert.equal(shopBuy(s, 'wing'), false);
  s.phase = 'shop';
  depart(s);
  assert.equal(s.area, 3);
  assert.equal(s.ship.stock, 5);
  assert.equal(s.orders[3], 0);
  s.ship.inv = 0;
  s.ship.lives = 0;
  s.hostile.push({ x: s.ship.x, y: s.ship.y, vx: 0, vy: 0, r: 3, age: 0, life: 10 });
  tick(s);
  assert.equal(s.phase, 'over');
  assert.equal(s.ship.cash, 20);
  assert.equal(continueFlight(s), true);
  assert.equal(continueFlight(s), false);
  assert.equal(s.area, 3);
  assert.equal(s.ship.turbo, 1);
});
test('兔眼独立，海底、沙下与陶偶行走期间不受枪击', () => {
  for (const kind of ['rabbit', 'octopus', 'tower', 'clay']) {
    const s = newFlight();
    enterBoss(s, kind);
    for (let i = 0; i < 90; i++) updateBoss(s);
    if (kind === 'rabbit') {
      const z = bossTargets(s.boss);
      assert.equal(z.length, 2);
      hitBoss(s.boss, z[0], 1000);
      assert.equal(bossTargets(s.boss).length, 1);
    } else {
      const open = new Set();
      for (let i = 0; i < 280; i++) {
        updateBoss(s);
        open.add(!!bossTargets(s.boss).length);
      }
      assert.equal(open.size, 2);
    }
  }
});
test('正常输入从隐藏区飞到一区，再连续打过八区与结局', () => {
  const s = newFlight({ area: 0, seed: 0x16f00d }),
    pilot = makePilot(),
    seen = new Map(),
    times = [],
    restored = new Set();
  let previous = s.area,
    start = s.frame,
    midSave = false,
    tries = 0;
  while (s.phase !== 'ending' && s.frame < 390000) {
    if (s.phase === 'over') {
      assert.ok(++tries < 6, '飞手多次坠毁 ' + s.area);
      continueFlight(s);
    }
    if (s.phase === 'shop') {
      const copy = decodeFlight(JSON.stringify(s));
      assert.deepEqual(copy, { ...s, sounds: [] });
      if (s.ship.cash >= 6) shopBuy(s, 'turbo');
      depart(s);
    }
    if (previous !== s.area) {
      times.push([previous, Math.round((s.frame - start) / 60)]);
      start = s.frame;
      previous = s.area;
    }
    if (s.boss) {
      const group = seen.get(s.area) || new Set();
      group.add(s.boss.kind);
      seen.set(s.area, group);
      if (s.boss.hp < s.boss.maxHp * 0.62 && !restored.has(s.area)) {
        restored.add(s.area);
        assert.deepEqual(decodeFlight(JSON.stringify(s)).boss, s.boss);
        midSave = true;
      }
    }
    tick(s, pilot(s));
  }
  times.push([s.area, Math.round((s.frame - start) / 60)]);
  assert.equal(
    s.phase,
    'ending',
    JSON.stringify({ area: s.area, frame: s.frame, boss: s.boss, ship: s.ship }),
  );
  assert.ok(midSave);
  for (let i = 0; i < 9; i++)
    assert.deepEqual(
      [...seen.get(i)],
      ROUTES[i].filter((e) => e.boss).map((e) => e.boss),
    );
  assert.equal(seen.get(7).size, 1);
  assert.ok(Object.keys(BOSS).length >= 15);
  console.log('全程实飞各区秒数', JSON.stringify(times), '续关', tries);
});

test('汉化版首段固定输入保留四档位移、子弹与补给时序', () => {
  const speeds = [56, 75, 93, 112];
  for (let i = 0; i < 4; i++) {
    const s = newFlight();
    s.ship.speed = i + 1;
    for (let f = 0; f < 20; f++) tick(s, { x: 1 });
    assert.equal(Math.trunc(s.ship.x - 128), speeds[i]);
  }
  const s = newFlight();
  let firstEnemy, firstItem;
  for (let f = 1; f <= 300; f++) {
    tick(s, { x: f <= 20 ? 1 : 0, fire: true });
    if (f === 8) {
      assert.equal(s.shots.length, 2);
      assert.equal(s.shots[1].vy, -9);
      assert.equal(s.shots[1].y - s.shots[0].y, 63);
    }
    if (s.enemies.length) firstEnemy ??= f;
    if (s.items.some((item) => item.age >= 0)) firstItem ??= f;
  }
  assert.equal(firstEnemy, 108);
  assert.ok(Math.abs(firstItem - 205) <= 2);
  enterBoss(s, 'rabbit');
  for (let f = 0; f < 72; f++) updateBoss(s);
  let open = 0;
  for (let f = 0; f < 180; f++) {
    updateBoss(s);
    if (bossTargets(s.boss).length) open++;
  }
  assert.equal(open, 68);
});
test('击破场景物件、折向光束和落底泡弹各自触发', () => {
  const s = newFlight({ area: 8 });
  s.wait = 10000;
  s.ship.inv = 999;
  s.hostile.push({
    x: 100,
    y: 60,
    vx: 0,
    vy: 2,
    side: -1,
    age: 29,
    turnAt: 30,
    r: 2,
    life: 90,
    kind: 'elbow',
  });
  tick(s);
  assert.equal(s.hostile[0].vx, -2);
  assert.equal(s.hostile[0].vy, 0);
  s.hostile = [{ x: 128, y: 221, vx: 0, vy: 2, r: 6, life: 120, age: 0, kind: 'bubble', burstY: 222 }];
  tick(s);
  assert.equal(s.hostile.length, 9);
  assert.ok(s.hostile.every((b) => b.vy < 0));
  enterBoss(s, 'burrow');
  const tile = s.boss.tiles[0];
  s.ship.x = tile.x;
  s.ship.y = tile.y + 14;
  for (let n = 0; n < 17; n++) tick(s, { fire: true });
  assert.equal(tile.hp, 0);
});
test('商店可寄下一关，终关换弹和封顶余额可跨保存恢复', () => {
  const s = newFlight({ area: 7 });
  s.phase = 'shop';
  s.ship.cash = 53;
  s.ship.stock = 15;
  assert.ok(shopBuy(s, 'parcel', 8));
  const restored = decodeFlight(JSON.stringify(s));
  assert.ok(depart(restored));
  assert.equal(restored.area, 8);
  assert.equal(restored.ship.stock, 20);
  assert.equal(restored.ship.cash, 9);
  assert.equal(restored.orders[8], 0);
  assert.ok(!depart(restored));
  assert.equal(decodeFlight(JSON.stringify({ ...restored, ship: { ...restored.ship, gun: 7 } })), null);
});
