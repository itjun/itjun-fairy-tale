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
  setFlightWidth,
  isSelectingOpeningWeapon,
} from '../src/gun-nac/flight.js';
import { BOSS, ROUTES, OPENING_LANES, launchWave, playBounds, spawnFoe } from '../src/gun-nac/stages.js';
import { bomb, collect, shoot, supply } from '../src/gun-nac/arsenal.js';
import { enterBoss, bossTargets, hitBoss, updateBoss } from '../src/gun-nac/bosses.js';
import { STAGE_THEMES, BOSS_THEME } from '../src/gun-nac/sound.js';
import { BASE_SHIP_SIZE, WINGED_SHIP_WIDTH, WINGED_SHIP_HEIGHT } from '../src/gun-nac/ship-art.js';
import { crescentDrawSize } from '../src/gun-nac/crescent.js';
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
  // 4 号火龙要明显向前喷出；自动连射时仍保留可用射程
  collect(s, { kind: 'gun4' });
  s.ship.power = 2;
  s.shots = [];
  s.fireRun = 180;
  shoot(s);
  assert.ok(s.shots.length >= 2);
  assert.ok(s.shots.every((b) => b.gun === 4 && b.life >= 52));
  s.shots = [];
  s.cooldown = 0;
  tick(s, { autoFire: false });
  assert.equal(s.shots.length, 0);
  tick(s, {});
  assert.ok(s.shots.some((b) => b.gun === 4));
  const flameY = s.shots.find((b) => b.gun === 4).y;
  for (let i = 0; i < 18; i++) tick(s, { autoFire: false });
  assert.ok(s.shots.some((b) => b.gun === 4 && b.y < flameY - 40));
  // 3 号圆月弯刀：与跳台同款大尺寸，为最强主武器，可连斩穿透、等级几就齐射几道
  collect(s, { kind: 'gun3' });
  s.ship.power = 1;
  s.shots = [];
  shoot(s);
  assert.equal(s.shots.length, 1);
  assert.equal(s.shots[0].gun, 3);
  assert.ok(s.shots[0].spinDir === 1 || s.shots[0].spinDir === -1);
  assert.equal(s.shots[0].flare, 5);
  assert.ok(s.shots[0].r >= 6.5);
  assert.ok(crescentDrawSize(s.shots[0].r) >= 26);
  assert.ok(s.shots[0].damage >= 4);
  assert.ok(s.shots[0].pierce >= 2);
  const rLow = s.shots[0].r;
  s.ship.power = 3;
  s.shots = [];
  shoot(s);
  assert.equal(s.shots.length, 3);
  s.ship.power = 8;
  s.shots = [];
  shoot(s);
  assert.ok(s.shots[0].r > rLow);
  assert.equal(s.shots.length, 6);
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
  assert.equal(s.ship.lives, 30);
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
  assert.equal(s.ship.lives, 30);
  assert.equal(s.area, 3);
  assert.equal(s.ship.turbo, 1);
});
test('掉机翼、坠机扣命和续关都继承此前的武器系统', () => {
  const s = newFlight();
  s.wait = 10000;
  collect(s, { kind: 'gun3' });
  collect(s, { kind: 'wing' });
  for (let i = 0; i < 5; i++) collect(s, { kind: 'gun3' });
  collect(s, { kind: 'chip' });
  collect(s, { kind: 'bombB' });
  collect(s, { kind: 'bombB' });
  collect(s, { kind: 'bombB' });
  assert.equal(s.ship.gun, 3);
  assert.equal(s.ship.power, 6);
  assert.equal(s.ship.bomb, 'B');
  assert.equal(s.ship.bombPower, 3);
  // 第一次受击：机翼挡伤，武器类型和火力等级保持不变，再拾同号不会倒退
  s.ship.inv = 0;
  s.hostile.push({ x: s.ship.x, y: s.ship.y, vx: 0, vy: 0, r: 3, age: 0, life: 10 });
  tick(s);
  assert.equal(s.ship.wing, false);
  assert.equal(s.ship.lives, 30);
  assert.equal(s.ship.gun, 3);
  assert.equal(s.ship.power, 6);
  collect(s, { kind: 'gun3' });
  assert.equal(s.ship.power, 6);
  // 第二次受击：扣一命，仍完整继承 3 号武器、火力、芯片和炸弹等级
  s.ship.inv = 0;
  s.hostile.push({ x: s.ship.x, y: s.ship.y, vx: 0, vy: 0, r: 3, age: 0, life: 10 });
  tick(s);
  assert.equal(s.ship.lives, 29);
  assert.equal(s.ship.gun, 3);
  assert.equal(s.ship.power, 6);
  assert.equal(s.ship.chips, 1);
  assert.equal(s.ship.bomb, 'B');
  assert.equal(s.ship.bombPower, 3);
  // 零命结束后续关：补满 30 命，依然继承原武器系统
  s.ship.lives = 0;
  s.ship.inv = 0;
  s.hostile.push({ x: s.ship.x, y: s.ship.y, vx: 0, vy: 0, r: 3, age: 0, life: 10 });
  tick(s);
  assert.equal(s.phase, 'over');
  assert.equal(continueFlight(s), true);
  assert.equal(s.ship.lives, 30);
  assert.equal(s.ship.gun, 3);
  assert.equal(s.ship.power, 6);
  assert.equal(s.ship.bomb, 'B');
  assert.equal(s.ship.bombPower, 3);
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
    tick(s, { x: f <= 34 ? -1 : 0, fire: true });
    if (f === 8) {
      assert.equal(s.shots.length, 4);
      assert.ok(s.shots.every((b) => b.vy < -9));
    }
    if (s.enemies.length) firstEnemy ??= f;
    if (s.items.some((item) => item.age >= 0)) firstItem ??= f;
  }
  assert.equal(firstEnemy, 108);
  assert.ok(firstItem >= 120 && firstItem <= 180);
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
  tick(s, { autoFire: false });
  assert.equal(s.hostile[0].vx, -2);
  assert.equal(s.hostile[0].vy, 0);
  s.hostile = [{ x: 128, y: 221, vx: 0, vy: 2, r: 6, life: 120, age: 0, kind: 'bubble', burstY: 222 }];
  tick(s, { autoFire: false });
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
test('每关开局出现 1～5 五种武器且战场固定 4∶3', () => {
  for (let area = 0; area <= 8; area++) {
    assert.equal(ROUTES[area][0].wave, 'I', `第 ${area} 区应以开局五武器编队起手`);
    const s = newFlight({ area, width: 426 });
    assert.equal(s.width, 256);
    launchWave(s, 'I');
    const guns = s.enemies.map((e) => e.dropGun).sort((a, b) => a - b);
    assert.deepEqual(guns, [1, 2, 3, 4, 5], `第 ${area} 区开局应提供 1~5 全部五种武器`);
    assert.equal(s.supplyCount, 0);
  }
  const flight = newFlight({ area: 1, width: 426 });
  flight.wait = 10000;
  const { left, right, width } = playBounds(flight);
  assert.equal(width, 256);
  assert.equal(left, 0);
  assert.equal(right, 256);
  for (let i = 0; i < 120; i++) tick(flight, { x: -1 });
  assert.equal(flight.ship.x, left + 6);
  for (let i = 0; i < 240; i++) tick(flight, { x: 1 });
  assert.equal(flight.ship.x, right - 6);
  flight.ship.x = 400;
  setFlightWidth(flight, 540);
  assert.equal(flight.width, 256);
  assert.equal(flight.ship.x, 250);
});

test('开局五武器分五条独立航道逐架慢出，选枪期间不提前刷怪且不串道误触', () => {
  assert.equal(OPENING_LANES.length, 5);
  for (let i = 1; i < OPENING_LANES.length; i++) {
    assert.ok(OPENING_LANES[i] - OPENING_LANES[i - 1] >= 44, '相邻武器航道留足安全间距');
  }
  const direct = newFlight({ area: 1, gun: 3 });
  assert.equal(direct.ship.gun, 3, '出击武器选择界面可直接挂载所选主武器升空');

  const s = newFlight({ area: 1 });
  // 站在正中 x=128 自动射击：只会打落正中第 3 航道的圆月弯刀补给并稳稳接住，不会误吃到其他航道武器
  let pickedThree = false;
  for (let f = 0; f < 1600; f++) {
    tick(s, { x: 0, y: 0, fire: true });
    if (isSelectingOpeningWeapon(s)) {
      assert.equal(
        s.enemies.some((e) => e.path !== 'opening'),
        false,
        '开局选武器未结束前不刷普通敌机',
      );
      for (const item of s.items) {
        if (item.isOpening && item.age >= 0) assert.equal(item.x, item.ox, '开局武器牌垂直缓落不左右乱晃');
      }
    }
    if (s.ship.gun === 3) pickedThree = true;
    if (pickedThree && !isSelectingOpeningWeapon(s)) break;
  }
  assert.equal(pickedThree, true);
  assert.equal(s.ship.gun, 3, '后续航道的 4、5 号武器从侧旁滑走，不会覆盖已选中的 3 号圆月弯刀');
});

test('圆月弯刀可连续斩穿多只敌机并劈碎可破坏敌弹，战机与补给高频掉机翼和武器', () => {
  assert.ok(BASE_SHIP_SIZE >= 20);
  assert.ok(WINGED_SHIP_WIDTH > BASE_SHIP_SIZE + 12 && WINGED_SHIP_HEIGHT > BASE_SHIP_SIZE + 6);

  const s = newFlight({ area: 1 });
  s.wait = 9999;
  collect(s, { kind: 'gun3' });
  s.ship.x = 128;
  s.ship.y = 180;
  // 正前方纵向摆两只小怪 + 一颗可破坏敌弹，一把 Lv.1 圆月弯刀应一路劈碎敌弹并连斩两只小怪
  s.hostile.push({ x: 128, y: 155, vx: 0, vy: 0, r: 4, age: 0, life: 99, kind: 'pearl', breakable: 1 });
  const e1 = spawnFoe(s, 'scout', 128, 135, 'ground', 1, 0);
  const e2 = spawnFoe(s, 'scout', 128, 108, 'ground', 1, 0);
  e1.shotAt = e2.shotAt = 9999;
  shoot(s);
  assert.equal(s.shots.length, 1);
  for (let i = 0; i < 40; i++) {
    s.cooldown = 99;
    tick(s, { autoFire: false });
  }
  assert.equal(s.hostile.length, 0, '圆月弯刀直接劈碎可破坏敌弹');
  assert.equal(s.enemies.length, 0, '单把圆月弯刀连斩两只敌机');

  // 连续击落 60 只敌机：验证多掉机翼铠甲与武器类别，极少掉钱包
  const lootGame = newFlight({ area: 1, seed: 42 });
  lootGame.wait = 9999;
  lootGame.ship.wing = true;
  for (let i = 0; i < 60; i++) {
    const foe = spawnFoe(lootGame, 'scout', 80, 80, 'ground', 1, 0);
    foe.hp = 1;
    lootGame.shots.push({ x: 80, y: 80, vx: 0, vy: -4, gun: 3, age: 0, r: 7, damage: 5, life: 20, hit: [], pierce: 2 });
    tick(lootGame, { autoFire: false });
    lootGame.shots = [];
  }
  const combatKinds = lootGame.items.map((it) => it.kind);
  const wingCount = combatKinds.filter((k) => k === 'wing').length;
  const gunOrChipCount = combatKinds.filter((k) => k.startsWith('gun') || k === 'chip').length;
  const moneyCount = combatKinds.filter((k) => k === 'money').length;
  assert.ok(wingCount >= 4, '击落战机高频产出机翼铠甲');
  assert.ok(gunOrChipCount >= 4, '击落战机高频产出武器类别与升级芯片');
  assert.ok(moneyCount <= 1, '击落战机不再满屏掉钱包');

  // 中段补给循环：首架必掉铠甲，整轮多铠甲与武器且无钱包
  const supGame = newFlight({ area: 1, seed: 7 });
  for (let i = 0; i < 12; i++) supply(supGame, 128, 60);
  const supKinds = supGame.items.map((it) => it.kind);
  assert.equal(supKinds[0], 'wing');
  assert.ok(supKinds.filter((k) => k === 'wing').length >= 4);
  assert.ok(supKinds.filter((k) => k.startsWith('gun')).length >= 4);
  assert.equal(supKinds.filter((k) => k === 'money').length, 0);
});

test('第 0～8 区与首领战各自拥有独立的背景音乐编曲，八关旋律与配器互不重复', () => {
  assert.equal(STAGE_THEMES.length, 9);
  const ids = new Set();
  const melodies = new Set();
  const basses = new Set();
  for (let area = 0; area <= 8; area++) {
    const t = STAGE_THEMES[area];
    assert.ok(t.id && t.root > 100);
    assert.equal(t.melody.length, 64, `第 ${area} 区拥有完整 64 步主旋律`);
    assert.equal(t.bass.length, 64, `第 ${area} 区拥有完整 64 步低音线`);
    ids.add(t.id);
    melodies.add(JSON.stringify(t.melody));
    basses.add(JSON.stringify(t.bass));
  }
  assert.equal(ids.size, 9);
  assert.equal(melodies.size, 9);
  assert.equal(basses.size, 9);
  assert.equal(BOSS_THEME.melody.length, 64);
  assert.ok(!ids.has(BOSS_THEME.id));
});
