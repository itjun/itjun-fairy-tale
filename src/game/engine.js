import { CHARACTERS, newSurvival, takeDamage, reviveSurvival, recordAttack, bloomAtHit } from './characters.js';
import * as THREE from 'three';
import { ADVENTURE_GENERATION_VERSION, MONSTERS, WEAPONS, FAMILY_LABELS } from '../../shared/adventure-catalog.js';
import { newAdventure, newJourney, upgradePower, queueReward, openReward, chooseReward, equipWeapon, toggleUpgrade } from './adventure.js';
import { fireAdventureWeapon, stepAdventureWave, areaAttack } from './adventure-combat.js';
import { stepAdventureEnemies, releaseCandyChildren } from './adventure-enemies.js';
import { createPlayer, stepPlayer, rescue } from './physics.js';
import { CAMPAIGNS, createCampaignWorld, campaignScore } from '../../shared/campaign.js';
import { fireSkill, stepWave, moveCampaignPlatforms } from './combat.js';
import { SKILLS, createSkillRewards, currentSkill, skillSeconds, takeSkillReward } from './skills.js';
import { SkillEffects } from './skill-effects.js';
import { stepEnemies, touchEnemy, touchSpring } from './enemies.js';
import { LEVELS } from '../../shared/levels.js';
import { COLLECTIBLES, LEVEL_COLLECTIBLES } from './collectibles.js';

const STEP = 1 / 120;
export class GardenEngine {
  constructor(host, { seed, count, level = LEVELS[0], onComplete, onUpdate, onPause, onReady, onError, onSound, onReward, onLifeChange, character = 'sister', survival, generationVersion = ADVENTURE_GENERATION_VERSION, adventure }) {
    this.host = host;
    this.callbacks = { onUpdate, onPause, onReady, onError, onSound, onComplete, onReward, onLifeChange };
    this.survival = structuredClone(survival || newSurvival(character));
    this.level = level;
    this.world = createCampaignWorld(seed, level, generationVersion);
    this.adventure = generationVersion === 2 ? structuredClone(adventure || newAdventure(seed, 1)) : null;
    this.journey = newJourney(); this.enemyShots = []; this.enemyShotViews = new Map();
    if (this.adventure && !adventure) queueReward(this.journey, 'start', 'flight', '出发前，挑一个新本领');
    this.seed = seed; this.defeatedIds = []; this.visited = new Set(); this.waves = []; this.switchViews = new Map();
    this.skillRewards = this.adventure ? [] : createSkillRewards(this.world);
    this.skillState = { kind: 'blade', until: 0, collectedIds: [] };
    this.platforms = this.world.platforms;
    this.collectibleKinds = this.world.treasures.map(t => t.kind);
    this.collectedIds = []; this.pickups = [];
    this.isCompleted = false; this.furthestPlatform = 0; this.isDisposed = false;
    this.isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.isPaused = true; this.keys = new Set(); this.touch = new Set(); this.jumps = [false, false];
    this.collected = 0; this.distance = 0; this.checkpoint = 0; this.elapsed = 0;
    this.players = [createPlayer(this.world.start)]; this.checkpointId = this.world.start.id;
    this.platformViews = new Map(); this.treasureViews = new Map(); this.enemyViews = new Map(); this.enemyMarkers = new Map();
    this.textures = []; this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#faf4e6');
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.setAttribute('aria-label', '花园王国三维跳台场景');
    host.appendChild(this.renderer.domElement);
    this.camera = new THREE.OrthographicCamera(-18, 18, 10, -10, 0.1, 150);
    this.cameraX = 16; this.cameraY = 6;
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
      const names = [...new Set([landscape, ...Object.values(CHARACTERS).flatMap(c => [c.image, c.attack]), 'flower', 'collectible-rainbow', 'girl-player', 'dad-player', 'girl-attack', 'dad-attack', 'light-wave', 'enemy-burst', 'treehouse-tall', 'platform-raft', 'platform-ice', 'platform-gear', 'platform-conveyor', 'island-lighthouse', 'castle-cutaway', 'street-house', 'windmill-tall', 'platform-awning', surfaceImage, finishImage, 'paper-texture',
        'enemy-jelly', 'enemy-leaf', 'enemy-puff', 'lift-leaf', 'spring-flower', 'bridge-rope', 'checkpoint-flag', 'cave-paper', 'collectible-star', 'magic-bubble',
        ...LEVEL_COLLECTIBLES[this.level.id].map(id => COLLECTIBLES[id].image), ...(this.adventure ? ['adventure-workbench', 'platform-crayon', 'adventure-root-cave', ...Object.values(MONSTERS).map(m => m.image), ...Object.values(WEAPONS).map(w => w.image)] : [])])];
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
      this.sideMaterial = this.material(new THREE.MeshStandardMaterial({ map: textureFor('paper-texture'), color: this.level.id === 'forest' ? '#c18b61' : this.level.side, roughness: 1 }));
      this.caveSideMaterial = this.material(new THREE.MeshStandardMaterial({ map: textureFor('paper-texture'), color: '#cfa27b', roughness: 1 }));
      this.collectibleMaterials = Object.fromEntries(LEVEL_COLLECTIBLES[this.level.id].map(id => [id, spriteMaterial(COLLECTIBLES[id].image)]));
      this.finishMaterial = spriteMaterial(finishImage);
      this.waveMaterial = spriteMaterial('light-wave'); this.burstMaterial = spriteMaterial('enemy-burst');
      this.starMaterial = spriteMaterial('collectible-star'); this.treeMaterial = spriteMaterial('treehouse-tall');
      this.skillEffects = new SkillEffects(this.scene, this.planeGeometry,
        { blade: this.waveMaterial, bubble: spriteMaterial('magic-bubble'), stars: this.starMaterial, ...(this.adventure ? { boomerang: spriteMaterial('weapon-boomerang'), seed: spriteMaterial('weapon-seed'), firefly: spriteMaterial('weapon-firefly'), pulse: this.starMaterial } : {}) }, this.skillRewards, this.isReducedMotion);
      this.caveMaterial = spriteMaterial('cave-paper');
      this.houseMaterial=spriteMaterial('street-house');this.houseMaterial.opacity=0.6;
      this.windmillMaterial=spriteMaterial('windmill-tall');this.windmillMaterial.opacity=0.65;
      this.awningMaterial=spriteMaterial('platform-awning');
      this.islandMaterial=spriteMaterial('island-lighthouse'); this.castleMaterial=spriteMaterial('castle-cutaway');
      this.castleMaterial.opacity=0.48; this.treeMaterial.opacity=0.75;
      this.platformMaterials=Object.fromEntries(['raft','ice','gear','conveyor'].map(kind=>[kind,spriteMaterial(`platform-${kind}`)]));
      for (const [kind,bounds] of Object.entries({ice:[205/724,550/724],gear:[145/724,668/724],raft:[30/128,94/128]})) {const texture=this.platformMaterials[kind].map;texture.offset.y=1-bounds[1];texture.repeat.y=bounds[1]-bounds[0];}
      this.characterMaterials = Object.fromEntries(Object.entries(CHARACTERS).map(([id,c]) => [id, { standing: spriteMaterial(c.image), attack: spriteMaterial(c.attack) }]));
      this.flowerMaterial = spriteMaterial('flower'); this.rainbowMaterial = spriteMaterial('collectible-rainbow');
      this.liftMaterial = spriteMaterial('lift-leaf'); this.springMaterial = spriteMaterial('spring-flower');
      this.bridgeMaterial = spriteMaterial('bridge-rope'); this.flagMaterial = spriteMaterial('checkpoint-flag');
      this.enemyMaterials = Object.fromEntries((this.adventure ? Object.keys(MONSTERS) : ['jelly', 'leaf', 'puff']).map(kind => [kind, spriteMaterial(`enemy-${kind}`)]));
      if (this.adventure) {
        this.workbenchMaterial = spriteMaterial('adventure-workbench');
        this.crayonPlatformMaterial = spriteMaterial('platform-crayon');
        this.crayonPlatformMaterial.map.offset.set(22 / 2172, 1 - 511 / 724);
        this.crayonPlatformMaterial.map.repeat.set(2128 / 2172, 253 / 724);
        this.caveMaterial = spriteMaterial('adventure-root-cave');
      }
      const background = textureFor(landscape);
      const gardenMaterial = this.material(new THREE.MeshBasicMaterial({ map: background, side: THREE.DoubleSide, transparent: true, opacity: landscape === this.level.image ? 0.55 : 1 }));
      this.backdrops = [0].map(() => {
        const mesh = new THREE.Mesh(this.planeGeometry, gardenMaterial);
        mesh.scale.set(44, 44 * background.image.height / background.image.width, 1); mesh.position.set(0, 6, -18);
        this.scene.add(mesh); return mesh;
      });
      this.playerViews = this.players.map(() => {
        const mesh = new THREE.Mesh(this.planeGeometry, this.characterMaterials[this.survival.character].standing);
        const size = CHARACTERS[this.survival.character].height; mesh.scale.set(size, size, 1);
        this.scene.add(mesh); return mesh;
      });
      this.talentView = this.sprite(this.flowerMaterial, 0, 0, 3, 3, 1); this.talentView.visible = false;
      this.buildWorld(); this.isReady = true; this.callbacks.onReady();
      this.publish(`${CAMPAIGNS[this.level.id].hint} 收集 ${this.world.requiredFlowers} 件宝物。`);
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
        const material=this.platformMaterials[platform.skin] || (['windmill','balloon'].includes(platform.skin)?this.platformMaterials.gear:this.liftMaterial);
        const leaf = new THREE.Mesh(this.planeGeometry, material);
        leaf.scale.set(platform.width + 0.25, 1.15, 1); leaf.position.set(0, -0.48, 0.2); group.add(leaf);
        if(platform.skin==='balloon') for(const x of [-1.4,1.4]) {const balloon=new THREE.Mesh(this.planeGeometry,this.collectibleMaterials.balloon);balloon.scale.set(1.5,2.7,1);balloon.position.set(x,1.3,-0.3);group.add(balloon);}
        const rail = new THREE.Mesh(this.boxGeometry, this.grassMaterial);
        rail.scale.set(platform.axis === 'x' ? platform.travel : 0.07, platform.axis === 'y' ? platform.travel : 0.07, 0.07); rail.position.set(platform.x + (platform.axis === 'x' ? platform.travel / 2 : 0), platform.y + (platform.axis === 'y' ? platform.travel / 2 : 0), -0.5); this.scene.add(rail);
      } else if (platform.skin==='awning') {
        const deck=new THREE.Mesh(this.planeGeometry,this.awningMaterial);deck.scale.set(platform.width,1.4,1);deck.position.set(0,-0.6,0.3);group.add(deck);
      } else if (platform.isIce || platform.conveyor) {
        const deck = new THREE.Mesh(this.planeGeometry,this.platformMaterials[platform.isIce?'ice':'conveyor']);
        deck.scale.set(platform.width,1.2,1);deck.position.set(0,-0.5,0.3);group.add(deck);
      } else if (platform.isBridge) {
        const bridge = new THREE.Mesh(this.planeGeometry, this.bridgeMaterial);
        const height = platform.width * this.bridgeMaterial.map.image.height / this.bridgeMaterial.map.image.width;
        bridge.scale.set(platform.width, height, 1); bridge.position.set(0, height * 0.38, 0.3); group.add(bridge);
      } else {
        const isCandyCave = this.level.id === 'sweet' && platform.y < 0;
        const side = isCandyCave ? this.caveSideMaterial : this.sideMaterial;
        const top = this.grassMaterial;
        const block = new THREE.Mesh(this.boxGeometry, [side, side, top, side, side, side]);
        const depth = platform.isOneWay ? (['sand','blocks','roof','awning'].includes(platform.skin)?2.3:0.55) : 1.1;
        block.position.set(0, -depth / 2, 0); block.scale.set(platform.width, depth, 1.9); group.add(block);
        const lip = new THREE.Mesh(this.boxGeometry, top);
        lip.position.set(0, -0.06, 0); lip.scale.set(platform.width + 0.07, 0.12, 2); group.add(lip);
      }
      if (this.adventure && !platform.isMoving && !platform.isIce && !platform.conveyor && !platform.isBridge && platform.skin !== 'awning') {
        const edge = new THREE.Mesh(this.planeGeometry, this.crayonPlatformMaterial);
        edge.scale.set(platform.width + 0.1, 0.8, 1); edge.position.set(0, -0.34, 1.05); group.add(edge);
      }
      group.visible = platform.isEnabled !== false;
      this.scene.add(group); this.platformViews.set(platform.id, group);
      if (platform.isCheckpoint && !platform.isFinish) this.sprite(this.flagMaterial,platform.x-platform.width/2+1,platform.y+1.1,1.4,2.2,-0.4);
      if (platform.isTunnel && (!this.adventure || platform.id % 3 === 0)) this.sprite(this.caveMaterial,platform.x,platform.y+1.8,platform.width+2,4.8,-2);
    }
    for (const treasure of this.world.treasures) {
      const kind = this.collectibleKinds[treasure.id - 1], item = COLLECTIBLES[kind];
      const mesh = this.sprite(this.collectibleMaterials[kind], treasure.x, treasure.y, item.size * 0.78, item.size * 0.78);
      this.treasureViews.set(treasure.id, { mesh, kind, isCollected: false });
    }
    for (const enemy of this.world.enemies) {
      this.enemyViews.set(enemy.id, this.sprite(this.material(this.enemyMaterials[enemy.kind].clone()), enemy.x, enemy.y + enemy.height / 2, 1.4, enemy.height, 0.5));
      this.enemyMarkers.set(enemy.id, [this.sprite(this.starMaterial,enemy.x-0.25,enemy.y+2,0.35,0.35),this.sprite(this.starMaterial,enemy.x+0.25,enemy.y+2,0.35,0.35)]);
    }
    for (const spring of this.world.springs) this.sprite(this.springMaterial, spring.x, spring.y + 0.25, 2.1, 1.45, 0.15);
    for (const sw of this.world.switches) this.switchViews.set(sw.id,this.sprite(this.material(this.starMaterial.clone()),sw.x,sw.y+0.18,1.1,0.55,0.8));
    for (const d of this.world.decorations) {
      if(this.level.id==='family') this.sprite(this.houseMaterial,d.x,d.y+7,14*654/1024,14,-3);
      if(this.level.id==='meadow') this.sprite(this.windmillMaterial,d.x,d.y+10,15,20,-3);
      if(this.level.id==='forest') {const height=Math.max(30,d.height);this.sprite(this.treeMaterial,d.x,d.y+height/2,height*2/3,height,-3);}
      if(this.level.id==='sweet') {const size=Math.max(24,d.height);this.sprite(this.castleMaterial,d.x,d.y+size/2,size,size,-3);}
      if(this.level.id==='beach') {const height=Math.max(16,d.height);this.sprite(this.islandMaterial,d.x,d.y+2,height*4/3,height,-3);}
    }
    for (const camp of this.world.camps || []) this.sprite(this.workbenchMaterial, camp.x, camp.y + 2, 4.8, 4, -0.8);
    const finish = this.world.finish;
    this.sprite(this.finishMaterial, finish.x + 2.5, finish.y + 1.8, 3.7, 3.7, -1.2);
    const flagAspect = this.flagMaterial.map.image.width / this.flagMaterial.map.image.height;
    this.sprite(this.flagMaterial, finish.x, finish.y + 1.5, 3 * flagAspect, 3, 0.2);
  }
  resize() {
    const width = this.host.clientWidth, height = this.host.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height);
    const aspect = width / height, halfWidth = Math.max(12, (this.adventure ? 9 : 11.5) * aspect);
    if (!this.isReady) this.cameraX = Math.min(16, halfWidth - 4);
    this.camera.left = -halfWidth; this.camera.right = halfWidth;
    this.camera.top = halfWidth / aspect; this.camera.bottom = -halfWidth / aspect; this.camera.updateProjectionMatrix();
  }
  keyDown(event) {
    if (this.isPaused) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyJ', 'Enter', 'Escape', 'KeyP'].includes(event.code)) event.preventDefault();
    if (event.code === 'Escape' || event.code === 'KeyP') { if (!event.repeat) this.requestPause(); return; }
    if (!this.keys.has(event.code)) {
      if (['Space', 'KeyW'].includes(event.code) || this.players.length === 1 && event.code === 'ArrowUp') this.jumps[0] = true;
    }
    this.keys.add(event.code);
  }
  setTouch(action, isPressed) {
    if (this.isPaused) return;
    if (isPressed) { if (['jump', 'drop'].includes(action) && !this.touch.has(action)) this.jumps[0] = true; this.touch.add(action); }
    else this.touch.delete(action);
  }
  clearInput() { this.keys.clear(); this.touch.clear(); this.jumps = [false, false]; this.waves = []; this.enemyShots = []; }
  pause(isPaused) { if (!isPaused && this.survival.phase !== 'alive') return; this.isPaused = isPaused; this.clearInput(); this.accumulator = 0; }
  requestPause() { if (!this.isPaused) { this.pause(true); this.callbacks.onPause(); } }
  returnToSafety() {
    if (this.isPaused || this.survival.phase !== 'alive') return;
    this.hurt(true);
  }
  selectCharacter(id) {
    if (!CHARACTERS[id] || !this.isPaused || this.elapsed > 0) return false;
    this.survival = newSurvival(id); this.publish(); return true;
  }
  hurt(isFall = false) {
    const result = takeDamage(this.survival, isFall);
    if (!result) return;
    if (result === 'shield') { this.talentEffect = { x:this.players[0].x, y:this.players[0].y + 1, at:this.elapsed, isShield:true }; this.publish('彩虹护盾挡住啦！'); }
    if (result === 'hurt') this.publish(`体力还剩 ${this.survival.hp} 格，小心前方！`);
    if (result === 'death') { this.pause(true); this.publish(this.survival.lives ? `扣掉一条命，还剩 ${this.survival.lives} 条。` : '生命用完了，这次冒险结束。'); }
    this.callbacks.onLifeChange?.(this.snapshot());
  }
  revive() {
    if (!reviveSurvival(this.survival)) return false;
    rescue(this.players[0], this.platforms[this.checkpointId]); this.clearInput(); this.publish('回到检查点，继续加油！');
    this.callbacks.onLifeChange?.(this.snapshot()); return true;
  }
  tick() {
    if (this.survival.phase !== 'alive') return;
    this.survival.shieldRemaining = Math.max(0, this.survival.shieldRemaining - STEP);
    moveCampaignPlatforms(this.world.lifts, this.elapsed);
    const nearby = item => this.players.some(p => Math.abs(item.x-p.x)<45 && Math.abs(item.y-p.y)<24);
    const platforms = this.platforms.filter(nearby), enemies = this.world.enemies.filter(nearby);
    if (this.adventure) stepAdventureEnemies(enemies, this.players, STEP, this.elapsed, this.enemyShots);
    else stepEnemies(enemies, STEP);
    const spawned = [];
    for (const wave of this.waves) {
      // 宽屏光刃可能越过玩家周围的物理更新范围，命中不能只检查 nearby。
      const result = this.adventure ? stepAdventureWave(wave, this.world.enemies, platforms, STEP, this.elapsed) : { hits: stepWave(wave, this.world.enemies, platforms, STEP, this.elapsed), spawned: [] };
      const hits = result.hits;
      const bloom = bloomAtHit(wave, hits, this.world.enemies, this.elapsed); if (bloom) this.talentEffect = bloom;
      spawned.push(...result.spawned);
      if (hits.length) this.callbacks.onSound('hit');
      for (const hit of hits) if (hit.isDefeated) this.rewardEnemy(hit.enemy);
      if (wave.burst) this.skillEffects.burst(wave.burst.x, wave.burst.y, this.elapsed);
    }
    this.waves = [...this.waves.filter(w => w.isActive), ...spawned].slice(-160);
    this.players.forEach((player, index) => {
      const isSingle = this.players.length === 1;
      const left = index === 0 ? this.keys.has('KeyA') || this.touch.has('left') || isSingle && this.keys.has('ArrowLeft') : this.keys.has('ArrowLeft');
      const right = index === 0 ? this.keys.has('KeyD') || this.touch.has('right') || isSingle && this.keys.has('ArrowRight') : this.keys.has('ArrowRight');
      const down = index === 0 ? this.keys.has('KeyS') || this.touch.has('drop') || isSingle && this.keys.has('ArrowDown') : this.keys.has('ArrowDown');
      const previousY = player.y, wasGrounded = player.isGrounded;
      const powers = this.adventure ? upgradePower(this.adventure, index) : {};
      const speedMultiplier = 1 + (!player.isGrounded ? (powers.air || 0) * 0.05 : 0) + (player.hasteUntil > this.elapsed ? 0.12 : 0);
      const result = stepPlayer(player, { direction: Number(right) - Number(left), speedMultiplier, isDoubleJump: this.survival.character === 'little', jump: this.jumps[index] && !down, drop: this.jumps[index] && down }, platforms, STEP, { ...this.world, isFiniteLife: true, minY: Math.max(this.world.minY,player.safe.y-14) });
      this.jumps[index] = false;
      if (result.isRescued) { this.hurt(true); return; }
      if (player.isGrounded && player.ground?.isCheckpoint && !player.ground.isMoving) this.checkpointId = player.ground.id;
      if (result.isJumped) this.callbacks.onSound('jump');
      if (player.safe.isCheckpoint && player.safe.progress > this.checkpoint) {
        this.checkpoint = player.safe.progress; this.callbacks.onSound('checkpoint');
      }
      if (player.ground?.milestone) {
        this.visited.add(player.ground.milestone);
        if (this.adventure) {
          const zone = player.ground.milestone - 1;
          const fork = this.world.forks.find(f => f.zone === zone), route = fork?.routes.find(r => r.id === this.journey.routes[fork.id]);
          if ([0, Math.floor((this.world.zones.length - 1) / 2), this.world.zones.length - 1].includes(zone)) queueReward(this.journey, `zone:${zone}`, route?.family || 'nature', '路线挑战完成');
        }
      }
      if (this.adventure && player.ground?.forkRoute) {
        const route = player.ground.forkRoute;
        if (!this.journey.routes[route.forkId]) this.journey.routes[route.forkId] = route.routeId;
      }
      if (this.adventure && !wasGrounded && player.isGrounded && powers.landing && this.elapsed > (player.nextLanding || 0)) {
        player.nextLanding = this.elapsed + 1.6;
        for (const hit of areaAttack(player.x, player.y + 0.8, 2.5 + powers.landing, enemies, this.elapsed)) if (hit.isDefeated) this.rewardEnemy(hit.enemy);
        this.skillEffects.burst(player.x, player.y + 0.5, this.elapsed);
      }
      if (this.adventure && powers.companion && this.elapsed > (player.nextCompanion || 0)) {
        player.nextCompanion = this.elapsed + 3 / powers.companion;
        this.waves.push(...fireAdventureWeapon({ ...player, nextShot: 0 }, this.elapsed, { left: this.cameraX - this.camera.right, right: this.cameraX + this.camera.right }, 'firefly'));
      }
      while (this.visited.has(this.furthestPlatform+1)) this.furthestPlatform++;
      const isFiring = index === 0 ? this.keys.has('KeyJ') || this.touch.has('attack') : this.keys.has('Enter');
      if (isFiring) {
        const kind = this.adventure ? this.adventure.loadouts[index].weapon : currentSkill(this.skillState, this.elapsed);
        const bounds = { left: this.cameraX - this.camera.right, right: this.cameraX + this.camera.right };
        const shots = this.adventure ? fireAdventureWeapon(player, this.elapsed, bounds, kind, powers) : fireSkill(player, this.elapsed, bounds, kind);
        if (shots.length) {
          if (recordAttack(this.survival)) {
            if (this.survival.character === 'mom') { const floralCharge = { isUsed:false }; shots.forEach(shot => { shot.floralCharge = floralCharge; }); }
            if (this.survival.character === 'sister') shots.push(...fireAdventureWeapon({ ...player, nextShot: 0 }, this.elapsed, bounds, 'stars'));
          }
          this.waves.push(...shots); this.callbacks.onSound(kind === 'blade' ? 'fire' : kind);
          this.callbacks.onLifeChange?.(this.snapshot());
        }
      }
      for (const reward of this.skillRewards) {
        if (Math.abs(player.x - reward.x) < 1.2 && Math.abs(player.y + 0.9 - reward.y) < 1.5
          && takeSkillReward(this.skillState, reward, this.elapsed)) {
          this.skillNotice = { kind: reward.kind, at: this.elapsed, id: reward.id };
          this.players.forEach(p => { p.nextShot = 0; this.skillEffects.burst(p.x, p.y + 1.1, this.elapsed, true); });
          this.callbacks.onSound('skill');
          this.publish(`获得${SKILLS[reward.kind].name}！继续按攻击键。`);
        }
      }
      for (const sw of this.world.switches) if (!sw.isOpen && player.ground?.id === sw.platformId && Math.abs(player.x-sw.x)<1) {
        sw.isOpen=true; this.platforms[sw.bridgeId].isEnabled=true; this.publish('星星亮了，小桥打开啦！');
      }
      for (const spring of this.world.springs) if (touchSpring(player, spring)) { this.callbacks.onSound('jump'); this.publish('弹簧花送你跳高高！'); }
      for (const enemy of enemies.filter(e => !e.isDormant)) {
        const contact = touchEnemy(player, enemy, previousY, this.elapsed);
        if (contact === 'stomp') this.rewardEnemy(enemy);
        if (contact === 'hit') this.callbacks.onSound('hit');
        if (contact === 'bump') { player.protection += (powers.shield || 0); this.hurt(); if (this.survival.phase !== 'alive') return; }
      }
      for (const shot of this.enemyShots) if (shot.isActive && player.protection <= 0 && Math.hypot(shot.x - player.x, shot.y - player.y - 0.8) < 1) {
        shot.isActive = false; player.protection = 2 + (powers.shield || 0); player.knockTime = 0.2; player.knockVx = Math.sign(shot.vx) * 3;
        this.hurt(); if (this.survival.phase !== 'alive') return;
      }
      for (const treasure of this.world.treasures.filter(nearby)) {
        const view = this.treasureViews.get(treasure.id);
        if (!view.isCollected && Math.abs(player.x - treasure.x) < 0.9 + (powers.magnet || 0) * 1.4 && Math.abs(player.y + 0.9 - treasure.y) < 1.25 + (powers.magnet || 0) * 0.9) {
          view.isCollected = true; view.mesh.visible = false; this.collected++;
          this.collectedIds.push(treasure.id);
          const item = COLLECTIBLES[view.kind];
          this.pickups.push({ id: treasure.id, kind: view.kind, points: item.points, x: treasure.x, y: treasure.y + 1, at: this.elapsed });
          this.callbacks.onSound('flower'); this.publish(`找到${item.phrase}，+${item.points} 分！`);
        }
      }
    });
    this.enemyShots = this.enemyShots.filter(s => s.isActive).slice(-40);
    if (this.survival.phase !== 'alive') return;
    this.distance = Math.max(this.distance, ...this.players.map(player => Math.floor(player.x)));
    if (this.adventure && this.journey.queued.length && this.players.every(p => p.isGrounded) && !enemies.some(e => !e.isDefeated && !e.isDormant && this.players.some(p => Math.abs(p.x - e.x) < 4 && Math.abs(p.y - e.y) < 3))) {
      if (openReward(this.adventure, this.journey)) { this.pause(true); this.publish(); this.callbacks.onReward?.(); return; }
    }
    const isAtFinish = this.players.some(player => player.isGrounded && player.ground?.isFinish);
    if (isAtFinish && !this.isCompleted) {
      if (this.collected >= this.world.requiredFlowers && this.furthestPlatform === this.world.zones.length) {
        this.isCompleted = true; this.pause(true); this.callbacks.onSound('checkpoint');
        this.publish('关卡完成啦！宝物和勇气，都是你的收获。'); this.callbacks.onComplete?.(this.snapshot());
      } else if (this.elapsed - (this.lastFinishHint || 0) > 3) {
        this.lastFinishHint = this.elapsed; this.publish(this.collected < this.world.requiredFlowers ? `还差 ${this.world.requiredFlowers - this.collected} 件宝物，沿途再找找吧。` : '还有途中旗子没经过，回去看看吧。');
      }
    }
  }
  rewardEnemy(enemy) {
    if (this.defeatedIds.includes(enemy.id)) return;
    this.defeatedIds.push(enemy.id); enemy.defeatedAt=this.elapsed;
    if (this.adventure) {
      releaseCandyChildren(enemy, this.world.enemies); this.journey.fragments++;
      this.players.forEach((p, index) => { if (upgradePower(this.adventure, index).haste) p.hasteUntil = this.elapsed + 2 + upgradePower(this.adventure,index).haste; });
      if (enemy.isElite) queueReward(this.journey, 'elite', enemy.family, `${MONSTERS[enemy.kind].name}挑战完成`);
      if (this.journey.fragments === 6) queueReward(this.journey, `fragments:${this.journey.fragments}`, enemy.family, '收集到一份魔法奖励');
    }
    const points=enemy.points+(enemy.drop?COLLECTIBLES[enemy.drop].points:0);
    this.pickups.push({id:`enemy-${enemy.id}`,kind:enemy.drop,points,x:enemy.x,y:enemy.y+2,at:this.elapsed});
    this.callbacks.onSound('flower'); this.publish(`打败小怪，+${points} 分！`);
  }
  selectReward(index, expectedId, expectedPlayer) {
    if (this.survival?.phase && this.survival.phase !== 'alive' || !this.adventure || !this.isPaused || this.journey.pending?.id !== expectedId || this.journey.pending?.player !== expectedPlayer) return false;
    if (!chooseReward(this.adventure, this.journey, index)) return false;
    this.players.forEach(p => this.skillEffects.burst(p.x, p.y + 1, this.elapsed, true));
    this.callbacks.onSound('skill'); this.publish(); return true;
  }
  configureWeapon(player, id) { const changed = this.isPaused && this.adventure && equipWeapon(this.adventure, player, id); if (changed) this.publish(); return !!changed; }
  configureUpgrade(player, id) { const changed = this.isPaused && this.adventure && toggleUpgrade(this.adventure, player, id); if (changed) this.publish(); return !!changed; }
  canRest() { return this.survival.phase === 'alive' && !!this.snapshot().camp && !this.journey.pending; }
  exportAdventure() { return this.adventure ? structuredClone(this.adventure) : null; }
  exportState() {
    return {survival:structuredClone(this.survival),checkpointId:this.checkpointId,isCompleted:this.isCompleted,version:this.world.version,seed:this.seed,levelId:this.level.id,elapsed:this.elapsed,collectedIds:this.collectedIds,defeatedIds:this.defeatedIds,
      skillState:{...this.skillState,collectedIds:[...this.skillState.collectedIds]},
      ...(this.adventure ? { adventure: structuredClone(this.adventure), journey: structuredClone(this.journey) } : {}),
      visited:[...this.visited],switches:this.world.switches.filter(s=>s.isOpen).map(s=>s.id),
      enemies:this.world.enemies.map(e=>({id:e.id,x:e.x,y:e.y,hp:e.hp,direction:e.direction,elapsed:e.elapsed,isDefeated:e.isDefeated,defeatedAt:e.defeatedAt,isDormant:e.isDormant,slowUntil:e.slowUntil,lastShotBeat:e.lastShotBeat})),
      players:this.players.map(p=>({safeId:p.safe.id,recoveries:p.recoveries,facing:p.facing}))};
  }
  restoreState(state) {
    if (state.version!==this.world.version || state.seed!==this.seed || state.levelId!==this.level.id) throw new Error('存档地图不一致');
    if (this.adventure) { this.adventure = structuredClone(state.adventure); this.journey = structuredClone(state.journey); }
    this.survival = structuredClone(state.survival || newSurvival()); this.checkpointId = state.checkpointId ?? state.players[0].safeId;
    this.isCompleted=!!state.isCompleted;
    this.elapsed=state.elapsed; this.collectedIds=[...state.collectedIds];this.collected=this.collectedIds.length;this.defeatedIds=[...state.defeatedIds];this.visited=new Set(state.visited);
    if (state.skillState) this.skillState = {...state.skillState, collectedIds:[...state.skillState.collectedIds]};
    this.furthestPlatform=0;while(this.visited.has(this.furthestPlatform+1))this.furthestPlatform++;
    for(const id of this.collectedIds){const v=this.treasureViews.get(id);if(v){v.isCollected=true;v.mesh.visible=false;}}
    for(const saved of state.enemies) Object.assign(this.world.enemies[saved.id-1],saved);
    for(const id of state.switches){const sw=this.world.switches[id];sw.isOpen=true;this.platforms[sw.bridgeId].isEnabled=true;}
    moveCampaignPlatforms(this.world.lifts,this.elapsed);
    this.players.forEach((p,i)=>{const saved=state.players[i];rescue(p,this.platforms[saved.safeId]);p.recoveries=saved.recoveries;p.facing=saved.facing;});
    this.cameraX = this.players.reduce((sum, p) => sum + p.x, 0) / this.players.length + Math.min(5, this.camera.right * 0.25);
    this.cameraY = this.players.reduce((sum, p) => sum + p.y, 0) / this.players.length + (this.journey.pending ? -2.5 : 4);
    this.publish('接着上次的冒险出发吧！');
  }
  snapshot() {
    this.pickups = this.pickups.filter(pickup => this.elapsed - pickup.at < 2.2);
    const pickups = this.pickups.map(pickup => {
      const position = new THREE.Vector3(pickup.x, pickup.y, 0.5).project(this.camera);
      return { id: pickup.id, kind: pickup.kind, points: pickup.points, x: (position.x + 1) * 50, y: (1 - position.y) * 50 };
    });
    const score=campaignScore(this.world,this.collectedIds,this.defeatedIds,this.isCompleted,this.level.bonus);
    const project = (x, y) => { const p = new THREE.Vector3(x, y, 0.5).project(this.camera); return { x: (p.x + 1) * 50, y: (1 - p.y) * 50 }; };
    const nearCamp = this.world.camps?.find(c => this.players.some(p => p.isGrounded && Math.abs(p.x - c.x) < 6 && Math.abs(p.y - c.y) < 0.5));
    return { ...score, survival: structuredClone(this.survival), skill:this.adventure?.loadouts[0].weapon || currentSkill(this.skillState,this.elapsed), skillSeconds:this.adventure ? 0 : skillSeconds(this.skillState,this.elapsed), skillRevision:this.adventure?.revision ?? this.skillState.collectedIds.length,
      adventure: this.adventure ? structuredClone(this.adventure) : null, pendingReward: this.journey.pending ? structuredClone(this.journey.pending) : null,
      camp: nearCamp ? { ...nearCamp, screen: project(nearCamp.x, nearCamp.y + 4.5) } : null,
      routeSigns: (this.world.forks || []).filter(f => Math.abs(f.x - this.cameraX) < this.camera.right).map(f => ({ id: f.id, ...project(f.x + 4, f.y + 6.8), routes: f.routes.map(r => ({ ...r, label: FAMILY_LABELS[r.family] })), chosen: this.journey.routes[f.id] })),
      skillNotice:this.skillNotice && this.elapsed-this.skillNotice.at<2.2 ? this.skillNotice : null,
      requiredFlowers:this.world.requiredFlowers,totalProgress:this.world.zones.length,defeatedIds:[...this.defeatedIds], flowers: this.collected, collectedIds: [...this.collectedIds], pickups, collection: score.collection, distance: this.distance,
      gardens: this.furthestPlatform, platform: this.furthestPlatform, seconds: Math.floor(this.elapsed),
      isCompleted: this.isCompleted, message: this.message,
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
      const targetX = Math.max(this.adventure ? this.camera.right * 0.5 : Math.min(16, this.camera.right - 4), Math.min(this.world.finish.x - 7, averageX + Math.min(5, this.camera.right * 0.25)));
      const targetY = averageY + (this.journey.pending ? -2.5 : 4);
      const smoothing = Math.min(1, delta * 4);
      this.cameraX += (targetX - this.cameraX) * smoothing; this.cameraY += (targetY - this.cameraY) * smoothing;
      this.camera.position.set(this.cameraX + 0.6, this.cameraY + 3.3, 30); this.camera.lookAt(this.cameraX, this.cameraY, 0);
      this.backdrops.forEach(mesh => { mesh.position.x = this.cameraX; mesh.position.y=this.cameraY-1; const aspect=mesh.material.map.image.width/mesh.material.map.image.height;const width=Math.max(44,this.camera.right*2+8,(this.camera.top*2+8)*aspect);mesh.scale.set(width,width/aspect,1); });
      for (const p of this.platforms) {const view=this.platformViews.get(p.id);view.position.set(p.x,p.y,0);view.visible=p.isEnabled!==false && Math.abs(p.x-this.cameraX)<this.camera.right+12 && Math.abs(p.y-this.cameraY)<this.camera.top+12;}
      for (const sw of this.world.switches) this.switchViews.get(sw.id).material.color.set(sw.isOpen ? '#b6f4a2' : '#ffffff');
      this.skillEffects.update(this.waves,this.adventure ? {kind:this.adventure.loadouts[0].weapon,until:Infinity,collectedIds:[]} : this.skillState,this.players,this.elapsed,this.cameraX,this.camera.right,this.adventure?.loadouts.map(l => l.weapon));
      for (const [shot, view] of this.enemyShotViews) if (!this.enemyShots.includes(shot)) { this.scene.remove(view); this.enemyShotViews.delete(shot); }
      for (const shot of this.enemyShots) {
        if (!this.enemyShotViews.has(shot)) this.enemyShotViews.set(shot, this.sprite(shot.kind === 'bubble' ? this.skillEffects.materials.bubble : this.starMaterial, shot.x, shot.y, 0.7, 0.7));
        this.enemyShotViews.get(shot).position.set(shot.x, shot.y, 0.7);
      }
      this.players.forEach((player, index) => {
        const mesh = this.playerViews[index], size = CHARACTERS[this.survival.character].height;
        mesh.position.set(player.x, player.y + size * 0.43, 0.6 + index * 0.2);
        mesh.rotation.z = !this.isReducedMotion && !this.isPaused && player.isGrounded ? Math.sin(this.elapsed * 16) * Math.abs(player.vx) * 0.006 : 0;
        const isAttacking = this.elapsed < (player.attackUntil || 0);
        mesh.material=this.characterMaterials[this.survival.character][isAttacking ? 'attack' : 'standing'];
        mesh.scale.set(size * player.facing, size, 1);
        mesh.material.opacity = player.protection > 0 ? (this.isReducedMotion ? 0.65 : 0.55 + Math.sin(this.elapsed * 16) * 0.25) : 1;
      });
      const effect = this.talentEffect;
      this.talentView.visible = !!effect && this.elapsed - effect.at < 1.4;
      if (this.talentView.visible) { this.talentView.material = effect.isShield ? this.rainbowMaterial : this.flowerMaterial; this.talentView.position.set(effect.x, effect.y, 1); this.talentView.rotation.z = Math.sin(this.elapsed * 8) * 0.2; }
      for (const enemy of this.world.enemies) {
        const mesh = this.enemyViews.get(enemy.id);
        mesh.visible = !enemy.isDormant && Math.abs(enemy.x-this.cameraX)<this.camera.right+3 && (!enemy.isDefeated || this.elapsed-enemy.defeatedAt<0.4);
        if(enemy.isDefeated) mesh.material=this.burstMaterial;
        mesh.material.opacity=enemy.hitUntil>this.elapsed?0.5:1;
        if (!enemy.isDefeated) mesh.material.color.set(enemy.slowUntil > this.elapsed ? '#80d6ff' : enemy.isWarning ? '#ffe47a' : '#ffffff');
        this.enemyMarkers.get(enemy.id).forEach((marker,i)=>{marker.visible=mesh.visible&&!enemy.isDefeated&&(enemy.hp>1 || enemy.isWarning);marker.position.set(enemy.x+(i?0.25:-0.25),enemy.y+enemy.height+0.4,0.6);});
        const aspect = mesh.material.map.image.width / mesh.material.map.image.height;
        mesh.scale.set(enemy.height * aspect * enemy.direction, enemy.isDefeated ? 2 : enemy.height * (enemy.hp>1?1.15:1), 1);
        mesh.position.set(enemy.x, enemy.y + (enemy.isDefeated ? 0.12 : enemy.height / 2), 0.5);
      }
      for (const view of this.treasureViews.values()) { view.mesh.visible=!view.isCollected && Math.abs(view.mesh.position.x-this.cameraX)<this.camera.right+3; if (!this.isReducedMotion && view.mesh.visible) view.mesh.rotation.z = Math.sin(this.elapsed * 2 + view.mesh.position.x) * 0.08; }
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
