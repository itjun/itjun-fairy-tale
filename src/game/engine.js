import * as THREE from 'three';
import { createPlayer, stepPlayer, regroup, rescue } from './physics.js';
import { createWorld, movePlatforms, ROUTES } from './world.js';
import { stepEnemies, touchEnemy, touchSpring } from './enemies.js';
import { LEVELS, calculateScore, hasCompleted } from '../../shared/levels.js';
import { COLLECTIBLES, LEVEL_COLLECTIBLES, collectibleSequence } from './collectibles.js';

const STEP = 1 / 120;
export class GardenEngine {
  constructor(host, { seed, count, level = LEVELS[0], onComplete, onUpdate, onPause, onReady, onError, onSound }) {
    this.host = host;
    this.callbacks = { onUpdate, onPause, onReady, onError, onSound, onComplete };
    this.level = level;
    this.world = createWorld(seed, level);
    this.platforms = this.world.platforms;
    this.collectibleKinds = collectibleSequence(level.id, seed, level.platforms);
    this.collection = {}; this.collectedIds = []; this.pickups = [];
    this.isCompleted = false; this.furthestPlatform = 0; this.isDisposed = false;
    this.isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.isPaused = true; this.keys = new Set(); this.touch = new Set(); this.jumps = [false, false];
    this.collected = 0; this.distance = 0; this.checkpoint = 0; this.elapsed = 0;
    this.players = Array.from({ length: count }, (_, i) => createPlayer(this.world.start, i ? -1.3 : 0));
    this.platformViews = new Map(); this.treasureViews = new Map(); this.enemyViews = new Map();
    this.textures = []; this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#faf4e6');
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.setAttribute('aria-label', '花园王国三维跳台场景');
    host.appendChild(this.renderer.domElement);
    this.camera = new THREE.OrthographicCamera(-18, 18, 10, -10, 0.1, 150);
    this.cameraX = 16; this.cameraY = this.world.route === 'cave' ? -2 : 6;
    this.scene.add(new THREE.HemisphereLight('#fffaf0', '#b8a58c', 2.4));
    const sun = new THREE.DirectionalLight('#ffffff', 2.1);
    sun.position.set(-8, 18, 16); this.scene.add(sun);
    this.boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.planeGeometry = new THREE.PlaneGeometry(1, 1);
    this.resources = [this.boxGeometry, this.planeGeometry];
    this.abort = new AbortController();
    const options = { signal: this.abort.signal };
    window.addEventListener('keydown', event => this.keyDown(event), options);
    window.addEventListener('keyup', event => this.keys.delete(event.code), options);
    window.addEventListener('blur', () => this.requestPause(), options);
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.requestPause(); }, options);
    this.renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); this.requestPause(); onError('画面暂时休息了，请返回花园后重新进入探险。'); }, options);
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(host); this.resize();
    this.lastTime = performance.now(); this.accumulator = 0;
    this.frame = requestAnimationFrame(time => this.animate(time));
    this.load();
  }
  async load() {
    try {
      const loader = new THREE.TextureLoader();
      const finishImage = this.level.finish || (this.level.id === 'sweet' ? 'icecream' : this.level.id === 'family' ? 'family' : 'flower');
      const surfaceImage = this.level.surface || 'grass-texture';
      const landscape = { rainbow: 'landscape-rainbow', forest: 'landscape-forest', sweet: 'landscape-sweet' }[this.level.id] || this.level.image;
      const names = [...new Set([landscape, 'girl-player', 'dad-player', surfaceImage, finishImage, 'paper-texture',
        'enemy-jelly', 'enemy-leaf', 'enemy-puff', 'lift-leaf', 'spring-flower', 'bridge-rope', 'checkpoint-flag', ...(this.world.route === 'cave' ? ['cave-paper'] : []),
        ...LEVEL_COLLECTIBLES[this.level.id].map(id => COLLECTIBLES[id].image)])];
      const textures = await Promise.all(names.map(async name => {
        const texture = await loader.loadAsync(`./assets/${name}.png`);
        if (this.isDisposed) { texture.dispose(); return texture; }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
        this.textures.push(texture); return texture;
      }));
      if (this.isDisposed) return;
      const textureFor = name => textures[names.indexOf(name)];
      const spriteMaterial = name => this.material(new THREE.MeshBasicMaterial({ map: textureFor(name), transparent: true, alphaTest: 0.08, side: THREE.DoubleSide }));
      const grass = textureFor(surfaceImage);
      grass.wrapS = grass.wrapT = THREE.RepeatWrapping; grass.repeat.set(2, 1);
      this.grassMaterial = this.material(new THREE.MeshStandardMaterial({ map: grass, color: this.level.topColor || '#ffffff', roughness: 1 }));
      this.sideMaterial = this.material(new THREE.MeshStandardMaterial({ map: textureFor('paper-texture'), color: this.world.route === 'canopy' ? '#c18b61' : this.level.side, roughness: 1 }));
      this.caveTopMaterial = this.material(new THREE.MeshStandardMaterial({ map: textureFor('paper-texture'), color: '#f1a8cf', roughness: 1 }));
      this.caveSideMaterial = this.material(new THREE.MeshStandardMaterial({ map: textureFor('paper-texture'), color: '#cfa27b', roughness: 1 }));
      this.collectibleMaterials = Object.fromEntries(LEVEL_COLLECTIBLES[this.level.id].map(id => [id, spriteMaterial(COLLECTIBLES[id].image)]));
      this.finishMaterial = spriteMaterial(finishImage);
      this.liftMaterial = spriteMaterial('lift-leaf'); this.springMaterial = spriteMaterial('spring-flower');
      this.bridgeMaterial = spriteMaterial('bridge-rope'); this.flagMaterial = spriteMaterial('checkpoint-flag');
      this.enemyMaterials = Object.fromEntries(['jelly', 'leaf', 'puff'].map(kind => [kind, spriteMaterial(`enemy-${kind}`)]));
      const background = textureFor(landscape);
      const gardenMaterial = this.material(new THREE.MeshBasicMaterial({ map: background, side: THREE.DoubleSide, transparent: true, opacity: landscape === this.level.image ? 0.55 : 1 }));
      this.backdrops = [-1, 0, 1, 2].map(() => {
        const mesh = new THREE.Mesh(this.planeGeometry, gardenMaterial);
        mesh.scale.set(44, 44 * background.image.height / background.image.width, 1); mesh.position.set(0, this.world.route === 'cave' ? 5 : 6, -18);
        this.scene.add(mesh); return mesh;
      });
      if (this.world.route === 'cave') {
        const cave = new THREE.Mesh(this.planeGeometry, spriteMaterial('cave-paper'));
        cave.scale.set(60, 10.4, 1); cave.position.set(22, -5.6, -4); this.scene.add(cave);
      }
      this.playerViews = ['girl-player', 'dad-player'].slice(0, this.players.length).map((name, i) => {
        const mesh = new THREE.Mesh(this.planeGeometry, spriteMaterial(name));
        const size = i ? 2.45 : 2.25; mesh.scale.set(size, size, 1);
        this.scene.add(mesh); return mesh;
      });
      this.buildWorld(); this.isReady = true; this.callbacks.onReady();
      this.publish(`${ROUTES[this.world.route].hint} 收集 ${this.level.requiredFlowers} 件宝物。`);
    } catch (error) {
      if (!this.isDisposed) this.callbacks.onError('彩笔素材还没准备好。请检查文件是否完整，再试一次。');
      console.error('花园素材加载失败', error);
    }
  }
  material(material) { this.resources.push(material); return material; }
  sprite(material, x, y, width, height, z = 0.35) {
    const mesh = new THREE.Mesh(this.planeGeometry, material);
    mesh.scale.set(width, height, 1); mesh.position.set(x, y, z); this.scene.add(mesh); return mesh;
  }
  buildWorld() {
    for (const platform of this.platforms) {
      const group = new THREE.Group(); group.position.set(platform.x, platform.y, 0);
      if (platform.isMoving) {
        const leaf = new THREE.Mesh(this.planeGeometry, this.liftMaterial);
        leaf.scale.set(platform.width + 0.25, 1.1, 1); leaf.position.set(0, -0.42, 0.2); group.add(leaf);
        const rail = new THREE.Mesh(this.boxGeometry, this.grassMaterial);
        rail.scale.set(0.07, platform.travel, 0.07); rail.position.set(platform.x, platform.travel / 2, -0.5); this.scene.add(rail);
      } else if (platform.isBridge) {
        const bridge = new THREE.Mesh(this.planeGeometry, this.bridgeMaterial);
        const height = platform.width * this.bridgeMaterial.map.image.height / this.bridgeMaterial.map.image.width;
        bridge.scale.set(platform.width, height, 1); bridge.position.set(0, height * 0.38, 0.3); group.add(bridge);
      } else {
        const isCandyCave = this.level.id === 'sweet' && platform.y < 0;
        const side = isCandyCave ? this.caveSideMaterial : this.sideMaterial;
        const top = isCandyCave ? this.caveTopMaterial : this.grassMaterial;
        const block = new THREE.Mesh(this.boxGeometry, [side, side, top, side, side, side]);
        const depth = platform.isOneWay ? 0.55 : 1.1;
        block.position.set(0, -depth / 2, 0); block.scale.set(platform.width, depth, 1.9); group.add(block);
        const lip = new THREE.Mesh(this.boxGeometry, top);
        lip.position.set(0, -0.06, 0); lip.scale.set(platform.width + 0.07, 0.12, 2); group.add(lip);
      }
      this.scene.add(group); this.platformViews.set(platform.id, group);
    }
    for (const treasure of this.world.treasures) {
      const kind = this.collectibleKinds[treasure.id - 1], item = COLLECTIBLES[kind];
      const mesh = this.sprite(this.collectibleMaterials[kind], treasure.x, treasure.y, item.size * 0.78, item.size * 0.78);
      this.treasureViews.set(treasure.id, { mesh, kind, isCollected: false });
    }
    for (const enemy of this.world.enemies) this.enemyViews.set(enemy.id, this.sprite(this.enemyMaterials[enemy.kind], enemy.x, enemy.y + enemy.height / 2, 1.4, enemy.height, 0.5));
    for (const spring of this.world.springs) this.sprite(this.springMaterial, spring.x, spring.y + 0.25, 2.1, 1.45, 0.15);
    const finish = this.world.finish;
    this.sprite(this.finishMaterial, finish.x + 2.5, finish.y + 1.8, 3.7, 3.7, -1.2);
    const flagAspect = this.flagMaterial.map.image.width / this.flagMaterial.map.image.height;
    this.sprite(this.flagMaterial, finish.x, finish.y + 1.5, 3 * flagAspect, 3, 0.2);
  }
  resize() {
    const width = this.host.clientWidth, height = this.host.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height);
    const aspect = width / height, halfWidth = Math.max(12, 11.5 * aspect);
    if (!this.isReady) this.cameraX = Math.min(16, halfWidth - 4);
    this.camera.left = -halfWidth; this.camera.right = halfWidth;
    this.camera.top = halfWidth / aspect; this.camera.bottom = -halfWidth / aspect; this.camera.updateProjectionMatrix();
  }
  keyDown(event) {
    if (this.isPaused) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'Escape', 'KeyP'].includes(event.code)) event.preventDefault();
    if (event.code === 'Escape' || event.code === 'KeyP') { if (!event.repeat) this.requestPause(); return; }
    if (!this.keys.has(event.code)) {
      if (['Space', 'KeyW'].includes(event.code) || this.players.length === 1 && event.code === 'ArrowUp') this.jumps[0] = true;
      if (this.players.length === 2 && event.code === 'ArrowUp') this.jumps[1] = true;
    }
    this.keys.add(event.code);
  }
  setTouch(action, isPressed) {
    if (this.isPaused) return;
    if (isPressed) { if (['jump', 'drop'].includes(action) && !this.touch.has(action)) this.jumps[0] = true; this.touch.add(action); }
    else this.touch.delete(action);
  }
  clearInput() { this.keys.clear(); this.touch.clear(); this.jumps = [false, false]; }
  pause(isPaused) { this.isPaused = isPaused; this.clearInput(); this.accumulator = 0; }
  requestPause() { if (!this.isPaused) { this.pause(true); this.callbacks.onPause(); } }
  returnToSafety() {
    this.players.forEach(player => rescue(player)); this.clearInput(); this.publish('回到安全的跳台啦，再试一次吧！');
  }
  tick() {
    movePlatforms(this.world.lifts, this.elapsed);
    stepEnemies(this.world.enemies, STEP);
    this.players.forEach((player, index) => {
      const isSingle = this.players.length === 1;
      const left = index === 0 ? this.keys.has('KeyA') || this.touch.has('left') || isSingle && this.keys.has('ArrowLeft') : this.keys.has('ArrowLeft');
      const right = index === 0 ? this.keys.has('KeyD') || this.touch.has('right') || isSingle && this.keys.has('ArrowRight') : this.keys.has('ArrowRight');
      const down = index === 0 ? this.keys.has('KeyS') || this.touch.has('drop') || isSingle && this.keys.has('ArrowDown') : this.keys.has('ArrowDown');
      const previousY = player.y;
      const result = stepPlayer(player, { direction: Number(right) - Number(left), jump: this.jumps[index] && !down, drop: this.jumps[index] && down }, this.platforms, STEP, this.world);
      this.jumps[index] = false;
      if (result.isRescued) this.publish('云朵接住你啦！宝物还在，继续出发。');
      if (result.isJumped) this.callbacks.onSound('jump');
      if (player.safe.isCheckpoint && player.safe.progress > this.checkpoint) {
        this.checkpoint = player.safe.progress; this.callbacks.onSound('checkpoint');
      }
      this.furthestPlatform = Math.max(this.furthestPlatform, player.safe.progress);
      for (const spring of this.world.springs) if (touchSpring(player, spring)) { this.callbacks.onSound('jump'); this.publish('弹簧花送你跳高高！'); }
      for (const enemy of this.world.enemies) {
        const contact = touchEnemy(player, enemy, previousY);
        if (contact === 'stomp') { this.callbacks.onSound('checkpoint'); this.publish('踩到小怪，弹起来啦！'); }
        if (contact === 'bump') this.publish('轻轻碰了一下，闪光时可以放心走过去。');
      }
      for (const treasure of this.world.treasures) {
        const view = this.treasureViews.get(treasure.id);
        if (!view.isCollected && Math.abs(player.x - treasure.x) < 0.9 && Math.abs(player.y + 0.9 - treasure.y) < 1.25) {
          view.isCollected = true; view.mesh.visible = false; this.collected++;
          this.collection[view.kind] = (this.collection[view.kind] || 0) + 1; this.collectedIds.push(treasure.id);
          const item = COLLECTIBLES[view.kind];
          this.pickups.push({ id: treasure.id, kind: view.kind, points: item.points, x: treasure.x, y: treasure.y + 1, at: this.elapsed });
          this.callbacks.onSound('flower'); this.publish(`找到${item.phrase}，+${item.points} 分！`);
        }
      }
    });
    if (regroup(this.players, Math.min(17, this.camera.right * 1.2))) this.publish('等一等，我们又走到一起啦！');
    this.distance = Math.max(this.distance, ...this.players.map(player => Math.floor(player.x)));
    const isAtFinish = this.players.some(player => player.isGrounded && player.ground?.isFinish);
    if (isAtFinish && !this.isCompleted) {
      if (hasCompleted(this.level, this.collected, this.furthestPlatform)) {
        this.isCompleted = true; this.pause(true); this.callbacks.onSound('checkpoint');
        this.publish('关卡完成啦！宝物和勇气，都是你的收获。'); this.callbacks.onComplete?.(this.snapshot());
      } else if (this.elapsed - (this.lastFinishHint || 0) > 3) {
        this.lastFinishHint = this.elapsed; this.publish(`还差 ${this.level.requiredFlowers - this.collected} 件宝物，上下两条路都找找吧。`);
      }
    }
  }
  snapshot() {
    this.pickups = this.pickups.filter(pickup => this.elapsed - pickup.at < 2.2);
    const pickups = this.pickups.map(pickup => {
      const position = new THREE.Vector3(pickup.x, pickup.y, 0.5).project(this.camera);
      return { id: pickup.id, kind: pickup.kind, points: pickup.points, x: (position.x + 1) * 50, y: (1 - position.y) * 50 };
    });
    return { flowers: this.collected, collectedIds: [...this.collectedIds], pickups, collection: { ...this.collection }, distance: this.distance,
      gardens: Math.floor(this.checkpoint / 6), platform: this.furthestPlatform, seconds: Math.floor(this.elapsed),
      score: calculateScore(this.collection, this.isCompleted, this.level), isCompleted: this.isCompleted, message: this.message,
      positions: this.players.map(p => ({ x: +p.x.toFixed(2), y: +p.y.toFixed(2), recoveries: p.recoveries })), platforms: this.platforms.length,
      enemies: this.world.enemies.filter(e => !e.isDefeated).length, route: this.world.route };
  }
  publish(message) {
    if (message) { this.message = message; this.messageUntil = this.elapsed + 5; }
    else if (this.elapsed > this.messageUntil) this.message = '';
    this.callbacks.onUpdate(this.snapshot());
  }
  animate(time) {
    if (this.isDisposed) return;
    const delta = Math.min((time - this.lastTime) / 1000, 0.06); this.lastTime = time;
    if (this.isReady) {
      if (!this.isPaused) {
        this.accumulator += delta;
        while (this.accumulator >= STEP && !this.isPaused) { this.elapsed += STEP; this.tick(); this.accumulator -= STEP; }
      }
      const averageX = this.players.reduce((sum, player) => sum + player.x, 0) / this.players.length;
      const averageY = this.players.reduce((sum, player) => sum + player.y, 0) / this.players.length;
      const targetX = Math.max(Math.min(16, this.camera.right - 4), Math.min(this.world.finish.x - 7, averageX + Math.min(5, this.camera.right * 0.25)));
      const baseY = this.world.route === 'cave' ? -2 : 6;
      const targetY = this.world.route === 'cave' ? baseY + Math.max(-0.5, Math.min(0.5, (averageY + 3) * 0.15)) : baseY + Math.max(0, Math.min(1.5, (averageY - 8) * 0.3));
      const smoothing = Math.min(1, delta * 4);
      this.cameraX += (targetX - this.cameraX) * smoothing; this.cameraY += (targetY - this.cameraY) * smoothing;
      this.camera.position.set(this.cameraX + 0.6, this.cameraY + 3.3, 30); this.camera.lookAt(this.cameraX, this.cameraY, 0);
      const base = Math.floor(this.cameraX / 44);
      this.backdrops.forEach((mesh, i) => { mesh.position.x = (base + i - 1) * 44 + 16; });
      for (const lift of this.world.lifts) this.platformViews.get(lift.id).position.y = lift.y;
      this.players.forEach((player, index) => {
        const mesh = this.playerViews[index], size = index ? 2.45 : 2.25;
        mesh.position.set(player.x, player.y + size * 0.43, 0.6 + index * 0.2);
        mesh.rotation.z = !this.isReducedMotion && !this.isPaused && player.isGrounded ? Math.sin(this.elapsed * 16) * Math.abs(player.vx) * 0.006 : 0;
        mesh.scale.x = size * player.facing;
        mesh.material.opacity = player.protection > 0 ? (this.isReducedMotion ? 0.65 : 0.55 + Math.sin(this.elapsed * 16) * 0.25) : 1;
      });
      for (const enemy of this.world.enemies) {
        const mesh = this.enemyViews.get(enemy.id);
        mesh.visible = !enemy.isDefeated || enemy.elapsed - enemy.defeatedAt < 0.4;
        const aspect = mesh.material.map.image.width / mesh.material.map.image.height;
        mesh.scale.set(enemy.height * aspect * enemy.direction, enemy.isDefeated ? 0.25 : enemy.height, 1);
        mesh.position.set(enemy.x, enemy.y + (enemy.isDefeated ? 0.12 : enemy.height / 2), 0.5);
      }
      for (const view of this.treasureViews.values()) if (!this.isReducedMotion && !view.isCollected) view.mesh.rotation.z = Math.sin(this.elapsed * 2 + view.mesh.position.x) * 0.08;
      if (time - (this.lastPublish || 0) > 250) { this.publish(); this.lastPublish = time; }
    }
    this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame(next => this.animate(next));
  }
  dispose() {
    this.isDisposed = true; cancelAnimationFrame(this.frame); this.abort.abort(); this.resizeObserver.disconnect();
    this.resources.forEach(resource => resource.dispose()); this.textures.forEach(texture => texture.dispose());
    this.scene.clear(); this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
