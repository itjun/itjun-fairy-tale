import * as THREE from 'three';
import { createPlayer, firstPlatform, nextPlatform, randomGenerator, stepPlayer, regroup, rescue } from './physics.js';

import { LEVELS, calculateScore, hasCompleted } from '../../shared/levels.js';
import { COLLECTIBLES, LEVEL_COLLECTIBLES, collectibleSequence } from './collectibles.js';

const STEP = 1 / 120;
export class GardenEngine {
  constructor(host, { seed, count, level = LEVELS[0], onComplete, onUpdate, onPause, onReady, onError, onSound }) {
    this.host = host;
    this.callbacks = { onUpdate, onPause, onReady, onError, onSound, onComplete };
    this.level = level;
    this.collectibleKinds = collectibleSequence(level.id, seed, level.platforms);
    this.collection = {};
    this.isCompleted = false;
    this.furthestPlatform = 0;
    this.isDisposed = false;
    this.isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.isPaused = true;
    this.keys = new Set();
    this.touch = new Set();
    this.jumps = [false, false];
    this.collected = 0;
    this.distance = 0;
    this.checkpoint = 0;
    this.elapsed = 0;
    this.random = randomGenerator(seed);
    this.platforms = [firstPlatform()];
    this.players = Array.from({ length: count }, (_, i) => createPlayer(this.platforms[0], i ? -1.3 : 0));
    this.platformViews = new Map();
    this.textures = [];
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#faf4e6');
    this.scene.fog = new THREE.Fog('#faf4e6', 45, 90);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor('#faf4e6');
    this.renderer.domElement.setAttribute('aria-label', '花园王国三维跳台场景');
    host.appendChild(this.renderer.domElement);
    this.camera = new THREE.OrthographicCamera(-15, 15, 9, -9, 0.1, 150);
    this.cameraX = 3;
    this.scene.add(new THREE.HemisphereLight('#fffaf0', '#a79b86', 2.4));
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
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.frame = requestAnimationFrame(time => this.animate(time));
    this.load();
  }
  async load() {
    try {
      const loader = new THREE.TextureLoader();
      const finishImage = this.level.finish || (this.level.id === 'sweet' ? 'icecream' : this.level.id === 'family' ? 'family' : 'flower');
      const surfaceImage = this.level.surface || 'grass-texture';
      const names = [...new Set([this.level.image, 'girl-player', 'dad-player', surfaceImage, finishImage,
        ...LEVEL_COLLECTIBLES[this.level.id].map(id => COLLECTIBLES[id].image)])];
      const textures = await Promise.all(names.map(async name => {
        const texture = await loader.loadAsync(`./assets/${name}.png`);
        if (this.isDisposed) { texture.dispose(); return texture; }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
        this.textures.push(texture);
        return texture;
      }));
      if (this.isDisposed) return;
      const textureFor = name => textures[names.indexOf(name)];
      const garden = textureFor(this.level.image), girl = textureFor('girl-player'), dad = textureFor('dad-player'), grass = textureFor(surfaceImage);

      grass.wrapS = grass.wrapT = THREE.RepeatWrapping;
      grass.repeat.set(2, 1);
      this.grassMaterial = this.material(new THREE.MeshStandardMaterial({ map: grass, color: this.level.topColor || '#ffffff', roughness: 1 }));
      this.sideMaterials = [this.level.side].map(color => this.material(new THREE.MeshStandardMaterial({ color, roughness: 1 })));
      this.collectibleMaterials = Object.fromEntries(LEVEL_COLLECTIBLES[this.level.id].map(id => [id,
        this.material(new THREE.MeshBasicMaterial({ map: textureFor(COLLECTIBLES[id].image), transparent: true, alphaTest: 0.08, side: THREE.DoubleSide }))]));
      this.finishMaterial = this.material(new THREE.MeshBasicMaterial({ map: textureFor(finishImage), transparent: true, alphaTest: 0.08, side: THREE.DoubleSide }));
      this.gardenMaterial = this.material(new THREE.MeshBasicMaterial({ map: garden, side: THREE.DoubleSide }));
      this.backdrops = [-1, 0, 1, 2].map(() => {
        const mesh = new THREE.Mesh(this.planeGeometry, this.gardenMaterial);
        const width = this.level.backdropWidth || 36;
        mesh.scale.set(width, width / 1.5, 1); mesh.position.set(0, this.level.backdropY ?? 5, -18); this.scene.add(mesh); return mesh;
      });
      this.playerViews = [girl, dad].slice(0, this.players.length).map((texture, i) => {
        const material = this.material(new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.08, side: THREE.DoubleSide }));
        const mesh = new THREE.Mesh(this.planeGeometry, material);
        mesh.scale.set(i ? 2.8 : 2.55, i ? 2.8 : 2.55, 1);
        this.scene.add(mesh); return mesh;
      });
      this.ensureWorld();
      this.isReady = true;
      this.callbacks.onReady();
      this.publish(`收集 ${this.level.requiredFlowers} 件宝物，再走到最后的终点台。`);
    } catch (error) {
      if (!this.isDisposed) this.callbacks.onError('彩笔素材还没准备好。请检查文件是否完整，再试一次。');
      console.error('花园素材加载失败', error);
    }
  }
  material(material) { this.resources.push(material); return material; }
  resize() {
    const width = this.host.clientWidth, height = this.host.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height);
    const aspect = width / height;
    const halfWidth = Math.max(11, 8 * aspect);
    this.camera.left = -halfWidth; this.camera.right = halfWidth;
    this.camera.top = halfWidth / aspect; this.camera.bottom = -halfWidth / aspect;
    this.camera.updateProjectionMatrix();
  }
  keyDown(event) {
    if (this.isPaused) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'KeyD', 'KeyW', 'Escape', 'KeyP'].includes(event.code)) event.preventDefault();
    if (event.code === 'Escape' || event.code === 'KeyP') { if (!event.repeat) this.requestPause(); return; }
    if (this.isPaused) return;
    if (!this.keys.has(event.code)) {
      if (['Space', 'KeyW'].includes(event.code) || this.players.length === 1 && event.code === 'ArrowUp') this.jumps[0] = true;
      if (this.players.length === 2 && event.code === 'ArrowUp') this.jumps[1] = true;
    }
    this.keys.add(event.code);
  }
  setTouch(action, isPressed) {
    if (this.isPaused) return;
    if (isPressed) { if (action === 'jump' && !this.touch.has(action)) this.jumps[0] = true; this.touch.add(action); }
    else this.touch.delete(action);
  }
  clearInput() { this.keys.clear(); this.touch.clear(); this.jumps = [false, false]; }
  pause(isPaused) { this.isPaused = isPaused; this.clearInput(); this.accumulator = 0; }
  requestPause() { if (!this.isPaused) { this.pause(true); this.callbacks.onPause(); } }
  returnToSafety() {
    this.players.forEach(player => rescue(player)); this.clearInput();
    this.publish('回到安全的跳台啦，再试一次吧！');
  }
  ensureWorld() {
    while (this.platforms.at(-1).id < this.level.platforms) this.platforms.push(nextPlatform(this.platforms.at(-1), this.random, this.level));
    const live = new Set(this.platforms.map(platform => platform.id));
    for (const [id, view] of this.platformViews) {
      if (!live.has(id)) { this.scene.remove(view.group); this.platformViews.delete(id); }
    }
    for (const platform of this.platforms) {
      if (this.platformViews.has(platform.id)) continue;
      const group = new THREE.Group();
      const side = this.sideMaterials[0];
      const block = new THREE.Mesh(this.boxGeometry, [side, side, this.grassMaterial, side, side, side]);
      block.position.set(platform.x, platform.y - 0.65, 0);
      block.scale.set(platform.width, 1.3, 2.8); group.add(block);
      const lip = new THREE.Mesh(this.boxGeometry, this.grassMaterial);
      lip.position.set(platform.x, platform.y - 0.1, 0); lip.scale.set(platform.width + 0.1, 0.2, 2.9); group.add(lip);
      const kind = this.collectibleKinds[Math.max(0, platform.id - 1)];
      const item = COLLECTIBLES[kind];
      const collectible = new THREE.Mesh(this.planeGeometry, this.collectibleMaterials[kind]);
      collectible.scale.set(item.size, item.size, 1); collectible.position.set(platform.x, platform.y + 1.05, 0.25);
      if (platform.id > 0) group.add(collectible);
      if (platform.id === this.level.platforms) {
        const finish = new THREE.Mesh(this.planeGeometry, this.finishMaterial);
        finish.scale.set(5, 5, 1); finish.position.set(platform.x, platform.y + 2.4, -1.8); group.add(finish);
      }
      this.scene.add(group); this.platformViews.set(platform.id, { group, collectible, kind, isCollected: platform.id === 0 });
    }
  }
  tick() {
    this.players.forEach((player, index) => {
      const isSingle = this.players.length === 1;
      const left = index === 0 ? this.keys.has('KeyA') || this.touch.has('left') || isSingle && this.keys.has('ArrowLeft') : this.keys.has('ArrowLeft');
      const right = index === 0 ? this.keys.has('KeyD') || this.touch.has('right') || isSingle && this.keys.has('ArrowRight') : this.keys.has('ArrowRight');
      const result = stepPlayer(player, { direction: Number(right) - Number(left), jump: this.jumps[index] }, this.platforms, STEP);
      this.jumps[index] = false;
      if (result.isRescued) this.publish('云朵接住你啦！回到刚才的跳台，继续出发。');
      if (result.isJumped) this.callbacks.onSound('jump');
      if (player.safe.isCheckpoint && player.safe.id > this.checkpoint) {
        this.checkpoint = player.safe.id;
        this.publish('走过一半啦，前面就是终点！');
        this.callbacks.onSound('checkpoint');
      }
      this.furthestPlatform = Math.max(this.furthestPlatform, player.safe.id);
      for (const platform of this.platforms) {
        const view = this.platformViews.get(platform.id);
        if (!view.isCollected && Math.abs(player.x - platform.x) < 0.8 && Math.abs(player.y + 0.9 - (platform.y + 1.05)) < 1.3) {
          view.isCollected = true; view.collectible.visible = false; this.collected++;
          this.collection[view.kind] = (this.collection[view.kind] || 0) + 1;
          this.callbacks.onSound('flower'); this.publish(`找到${COLLECTIBLES[view.kind].phrase}，增加 10 分！`);
        }
      }
    });
    if (regroup(this.players)) this.publish('等一等，我们又走到一起啦！');
    this.distance = Math.max(this.distance, ...this.players.map(player => Math.floor(player.x)));
    this.players.forEach(player => { player.x = Math.min(player.x, this.platforms.at(-1).x + this.platforms.at(-1).width / 2 - 0.4); });
    const isAtFinish = this.players.some(player => player.isGrounded && player.safe.id === this.level.platforms);
    if (isAtFinish && !this.isCompleted) {
      if (hasCompleted(this.level, this.collected, this.furthestPlatform)) {
        this.isCompleted = true; this.pause(true); this.callbacks.onSound('checkpoint');
        this.publish('关卡完成啦！宝物和勇气，都是你的收获。');
        this.callbacks.onComplete?.(this.snapshot());
      } else this.publish(`到终点啦！还差 ${this.level.requiredFlowers - this.collected} 件宝物，可以向左找找。`);
    }
  }
  snapshot() {
    return { flowers: this.collected, collection: { ...this.collection }, distance: this.distance, gardens: Math.floor(this.checkpoint / 6), platform: this.furthestPlatform,
      seconds: Math.floor(this.elapsed), score: calculateScore(this.collected, this.isCompleted, this.level), isCompleted: this.isCompleted,
      message: this.message, positions: this.players.map(p => ({ x: +p.x.toFixed(2), y: +p.y.toFixed(2), recoveries: p.recoveries })), platforms: this.platforms.length };
  }
  publish(message) {
    if (message) this.message = message;
    this.callbacks.onUpdate(this.snapshot());
  }
  animate(time) {
    if (this.isDisposed) return;
    const delta = Math.min((time - this.lastTime) / 1000, 0.06); this.lastTime = time;
    if (this.isReady) {
      if (!this.isPaused) {
        this.elapsed += delta; this.accumulator += delta;
        while (this.accumulator >= STEP) { this.tick(); this.accumulator -= STEP; }
      }
      const targetX = this.players.reduce((sum, player) => sum + player.x, 0) / this.players.length + 4;
      this.cameraX += (targetX - this.cameraX) * Math.min(1, delta * 4);
      this.camera.position.set(this.cameraX + 1.5, 7.8, 25);
      this.camera.lookAt(this.cameraX, 2, 0);
      const backdropWidth = this.level.backdropWidth || 36;
      const base = Math.floor(this.cameraX / backdropWidth);
      this.backdrops.forEach((mesh, i) => { mesh.position.x = (base + i - 1) * backdropWidth + (this.level.backdropOffset || 0); });
      this.players.forEach((player, index) => {
        const mesh = this.playerViews[index];
        const size = index ? 2.8 : 2.55;
        mesh.position.set(player.x, player.y + size * 0.43, 0.55 + index * 0.2);
        mesh.rotation.z = !this.isReducedMotion && !this.isPaused && player.isGrounded ? Math.sin(this.elapsed * 16) * Math.abs(player.vx) * 0.006 : 0;
        mesh.scale.x = size * player.facing;
      });
      for (const view of this.platformViews.values()) if (!this.isReducedMotion && !view.isCollected) view.collectible.rotation.z = Math.sin(this.elapsed * 2 + view.collectible.position.x) * 0.08;
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
