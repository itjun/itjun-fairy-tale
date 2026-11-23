import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { WORLD_ACTS } from '../shared/levels.js';
import { createRoomWorld } from '../shared/room-world.js';
import { GardenEngine, PLATFORM_CROPS, TERRAIN_CROPS, THIN_ART } from '../src/game/engine.js';
import { LAYER } from '../shared/room-terrain.js';
import { addForestViews } from '../src/game/forest-view.js';

async function material(name) {
  const { width, height } = await sharp(fileURLToPath(new URL(`../public/assets/${name}.png`, import.meta.url))).metadata();
  return new THREE.MeshBasicMaterial({ map: new THREE.Texture({ width, height }), transparent: true, alphaTest: .08 });
}
// 素材只读尺寸，裁剪方式和引擎里一样，这样量出来的贴图高度就是游戏里的高度。
async function loadMaterials() {
  const platformMaterials = Object.fromEntries(await Promise.all(['raft', 'ice', 'gear', 'conveyor'].map(async kind => [kind, await material(`platform-${kind}`)])));
  for (const [kind, bounds] of Object.entries(PLATFORM_CROPS)) { const texture = platformMaterials[kind].map; texture.offset.y = 1 - bounds[1]; texture.repeat.y = bounds[1] - bounds[0]; }
  const terrainMaterials = Object.fromEntries(await Promise.all(['bank', 'cookie', 'rock', 'blocks'].map(async kind => [kind, await material(`terrain-${kind}`)])));
  terrainMaterials.cloud = await material('platform-cloud');
  for (const [kind, bounds] of Object.entries(TERRAIN_CROPS)) {
    const texture = terrainMaterials[kind].map, w = texture.image.width, h = texture.image.height;
    texture.offset.set(bounds[0] / w, 1 - bounds[3] / h); texture.repeat.set((bounds[2] - bounds[0]) / w, (bounds[3] - bounds[1]) / h);
  }
  const flag = await material('checkpoint-flag');
  return { platformMaterials, terrainMaterials, awningMaterial: await material('platform-awning'), liftMaterial: await material('lift-leaf'), bridgeMaterial: await material('bridge-rope'),
    flagMaterial: flag, newTowerMaterial: flag, grassMaterial: new THREE.MeshBasicMaterial(), collectibleMaterials: { balloon: await material('collectible-balloon') } };
}
const materials = await loadMaterials();
// 只搭平台，别的东西都留空。
function render(world) {
  const game = Object.assign(Object.create(GardenEngine.prototype), { ...materials,
    world: { ...world, hazards: [], supplies: [], treasures: [], enemies: [], springs: [], switches: [], decorations: [], zones: [], bossArenas: [] },
    level: { id: world.themeId }, platforms: world.platforms, scene: new THREE.Scene(), platformViews: new Map(), resources: [],
    planeGeometry: new THREE.PlaneGeometry(1, 1), boxGeometry: new THREE.BoxGeometry(1, 1, 1) });
  game.buildWorld(); game.scene.updateMatrixWorld(true);
  return game;
}
const overlapX = (a, b) => Math.min(a.x + a.width / 2, b.x + b.width / 2) - Math.max(a.x - a.width / 2, b.x - b.width / 2);

test('树根贴住巢边地面，树洞入口只有一张图并随洞口状态显示', () => {
  const world = createRoomWorld(42, 'forest-rescue'), game = render(world);
  const player = { safe: world.start };
  Object.assign(game, { players: [player], spriteMaterial(name) { return new THREE.MeshBasicMaterial({ name }); } });
  const views = { engine: game, items: [], glow: () => new THREE.Object3D(), paper: () => ({ mesh: new THREE.Object3D(), draw() {} }) };
  addForestViews(views);
  const state = { forest: { crown: 0, roots: 0, lights: 0 } };
  const update = () => views.items.forEach(item => item.update(state));
  update();
  const room = world.rooms[0], mouth = room.traversal.cave.mouths[0];
  const tree = game.scene.children.find(mesh => mesh.material?.name === 'forest-hollow');
  assert.ok(tree?.visible && Math.abs(tree.position.y - tree.scale.y / 2 - world.start.y) < .15);
  const entrances = game.scene.children.filter(mesh => mesh.position.x === mouth.x && ['adventure-root-cave', 'desert-cave-mouth'].includes(mesh.material?.name));
  assert.equal(entrances.length, 1);
  assert.ok(entrances[0].visible);
  assert.ok(!room.traversal.art.some(item => item.image === 'adventure-root-cave' && item.x === mouth.x && item.y > room.fallY));
  mouth.isClosed = true;
  update();
  assert.equal(entrances[0].visible, false);
  player.safe = world.platforms[world.forest.rootEntryId];
  update();
  assert.equal(tree.visible, false);
});

test('树冠救援的地面和静止叶台在落脚面内侧没有贴图缺口', async () => {
  const world = createRoomWorld(42, 'forest-rescue'), game = render(world);
  const leaf = world.platforms.find(p => p.skin === 'leaf' && !p.isMoving);
  for (const [platform, image] of [[world.start, 'terrain-bank'], [leaf, 'lift-leaf']]) {
    const { data, info } = await sharp(fileURLToPath(new URL(`../public/assets/${image}.png`, import.meta.url)))
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const view = game.platformViews.get(platform.id);
    // 在台面下沿水平方向采样实际 PNG 的透明度，端点内侧应当连成一整块。
    for (let percent = 10; percent <= 90; percent++) {
      const x = platform.x + platform.width * (percent / 100 - .5);
      const ray = new THREE.Raycaster(new THREE.Vector3(x, platform.y - .18, 2), new THREE.Vector3(0, 0, -1));
      const opaque = ray.intersectObject(view).some(({ uv, object }) => {
        const map = object.material.map;
        map.updateMatrix();
        map.transformUv(uv);
        const i = Math.min(info.width - 1, Math.floor(uv.x * info.width));
        const j = Math.min(info.height - 1, Math.floor(uv.y * info.height));
        return data[(j * info.width + i) * 4 + 3] > 127;
      });
      assert.ok(opaque, `${image} 在台面 ${percent}% 处断开`);
    }
  }
});

test('上下两层的平台贴图不盖住对方的落脚面：上层的图离下层台面留得出小怪的高度，下层的图顶不到上层台面', () => {
  // 拼出来的贴图最厚 THIN_ART；冰面和传送带是固定厚度的一整条，厚 1.1。
  const room = LAYER - THIN_ART, fixedRoom = LAYER - 1.15;
  assert.ok(room >= 1.5);
  let pairs = 0;
  for (const act of WORLD_ACTS) for (const seed of [1, 42, 137, 999]) {
    const world = createRoomWorld(seed, act), game = render(world);
    const boxes = new Map(world.platforms.map(platform => [platform.id, new THREE.Box3().setFromObject(game.platformViews.get(platform.id))]));
    for (const a of world.platforms) for (const b of world.platforms) {
      // 会动的平台位置一直在变，这里只量不动的。
      if (a.id === b.id || a.roomId !== b.roomId || a.isMoving || b.isMoving || Math.abs(a.y - b.y) < 0.01 || overlapX(a, b) < 0.5) continue;
      pairs++;
      const box = boxes.get(a.id), where = `${act.id} ${seed} 平台 ${a.id}（高 ${a.y}）和 ${b.id}（高 ${b.y}）`;
      if (a.y > b.y) assert.ok(box.min.y >= b.y + (a.isIce || a.conveyor ? fixedRoom : room) - 1e-6, `${where}：上层的图垂到 ${box.min.y.toFixed(2)}`);
      else assert.ok(box.max.y <= b.y, `${where}：下层的图顶到 ${box.max.y.toFixed(2)}`);
    }
  }
  assert.ok(pairs > 500, `只量到 ${pairs} 对上下叠着的平台`);
});

test('贴图叠在一起的平台各有各的深度，镜头移动时不争抢同一像素', () => {
  const isOverlapping = (a, b) => a.min.x < b.max.x && a.max.x > b.min.x && a.min.y < b.max.y && a.max.y > b.min.y;
  const boxOf = (game, platform) => new THREE.Box3().setFromObject(game.platformViews.get(platform.id));
  // 地图里碰上贴图相叠的，深度都不一样。
  for (const act of WORLD_ACTS) {
    const world = createRoomWorld(42, act), game = render(world);
    const views = world.platforms.map(platform => ({ platform, box: boxOf(game, platform) }));
    for (const a of views) for (const b of views) {
      if (a.platform.id >= b.platform.id || a.platform.roomId !== b.platform.roomId || !isOverlapping(a.box, b.box)) continue;
      assert.ok(Math.abs(a.box.max.z - b.box.max.z) > .0001, `${act.id} 平台 ${a.platform.id} 和 ${b.platform.id} 深度相同：${a.box.max.z}`);
    }
  }
  // 地图里不一定有相叠的，再摆两块一定叠上的来量。
  const world = createRoomWorld(42, WORLD_ACTS[1]);
  const upper = { id: 0, roomId: 0, x: 0, y: 0.5, width: 8, skin: 'roof' }, lower = { id: 1, roomId: 0, x: 3, y: 0, width: 12, skin: 'rock' };
  const game = render({ ...world, platforms: [upper, lower], start: upper, finish: lower });
  const [top, bottom] = [upper, lower].map(platform => boxOf(game, platform));
  assert.ok(isOverlapping(top, bottom), '这两块的贴图要真的叠在一起');
  assert.ok(Math.abs(top.max.z - bottom.max.z) > .0001, `叠着的贴图深度相同：${top.max.z} / ${bottom.max.z}`);
  assert.ok(bottom.max.z > top.max.z, '下层的落脚面在前面，不会被上层的图挡住');
});

test('宽平台只露出一部分时仍绘制，不因中心离开镜头就突然消失', t => {
  const world = createRoomWorld(42, WORLD_ACTS[1]), floor = world.platforms[world.bossArenas[0].floorId], game = render(world);
  const cameraX = floor.x - 25, character = new THREE.Mesh(game.planeGeometry, game.awningMaterial);
  Object.assign(game, { isReady: true, isPaused: true, lastTime: 0, lastPublish: 0, elapsed: 0, cameraX, cameraY: floor.y + 4,
    cameraTarget: () => ({ x: cameraX, y: floor.y + 4 }), camera: new THREE.OrthographicCamera(-12, 12, 9, -9, .1, 150),
    players: [{ x: cameraX - 3, y: floor.y, facing: 1 }], survival: { character: 'dad' }, adventure: { loadouts: [{ weapon: 'moonblade' }] },
    journey: {}, combatLoot: { drops: [] }, backdrops: [], hazardViews: new Map(), switchViews: new Map(), enemyViews: new Map(), enemyMarkers: new Map(),
    skillEffects: { updateMagic() {}, update() {} }, roomViews: { update() {} }, waves: [], enemyShots: [], enemyShotViews: new Map(), claimedSupplies: [],
    playerViews: [character], characterMaterials: { dad: { standing: game.awningMaterial } }, talentView: character, treasureViews: new Map(), renderer: { render() {} },
    callbacks: { onUpdate() {} }, snapshot() { return {}; } });
  const original = globalThis.requestAnimationFrame; globalThis.requestAnimationFrame = () => 0;
  t.after(() => { if (original === undefined) delete globalThis.requestAnimationFrame; else globalThis.requestAnimationFrame = original; });
  game.animate(16);
  assert.ok(Math.abs(floor.x - game.cameraX) > game.camera.right, '平台中心在画面外');
  assert.ok(floor.x - floor.width / 2 < game.cameraX + game.camera.right, '平台边缘在画面内');
  assert.ok(game.platformViews.get(floor.id).visible, '平台还有一截在画面里，不能突然隐藏');
});
