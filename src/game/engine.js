import * as THREE from 'three';
import { createPlayer, stepPlayer, regroup, rescue } from './physics.js';
import { CAMPAIGNS, createCampaignWorld, campaignScore } from '../../shared/campaign.js';
import { fireSkill, stepWave, moveCampaignPlatforms } from './combat.js';
import { SKILLS, createSkillRewards, currentSkill, skillSeconds, takeSkillReward } from './skills.js';
import { SkillEffects } from './skill-effects.js';
import { stepEnemies, touchEnemy, touchSpring } from './enemies.js';
import { LEVELS } from '../../shared/levels.js';
import { COLLECTIBLES, LEVEL_COLLECTIBLES } from './collectibles.js';

const STEP = 1 / 120;
export class GardenEngine {
  constructor(host, { seed, count, level = LEVELS[0], onComplete, onUpdate, onPause, onReady, onError, onSound }) {
    this.host = host;
    this.callbacks = { onUpdate, onPause, onReady, onError, onSound, onComplete };
    this.level = level;
    this.world = createCampaignWorld(seed, level);
    this.seed = seed; this.defeatedIds = []; this.visited = new Set(); this.waves = []; this.switchViews = new Map();
    this.skillRewards = createSkillRewards(this.world);
    this.skillState = { kind: 'blade', until: 0, collectedIds: [] };
    this.platforms = this.world.platforms;
    this.collectibleKinds = this.world.treasures.map(t => t.kind);
    this.collectedIds = []; this.pickups = [];
    this.isCompleted = false; this.furthestPlatform = 0; this.isDisposed = false;
    this.isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.isPaused = true; this.keys = new Set(); this.touch = new Set(); this.jumps = [false, false];
    this.collected = 0; this.distance = 0; this.checkpoint = 0; this.elapsed = 0;
    this.players = Array.from({ length: count }, (_, i) => createPlayer(this.world.start, i ? -1.3 : 0));
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
      const names = [...new Set([landscape, 'girl-player', 'dad-player', 'girl-attack', 'dad-attack', 'light-wave', 'enemy-burst', 'treehouse-tall', 'platform-raft', 'platform-ice', 'platform-gear', 'platform-conveyor', 'island-lighthouse', 'castle-cutaway', 'street-house', 'windmill-tall', 'platform-awning', surfaceImage, finishImage, 'paper-texture',
        'enemy-jelly', 'enemy-leaf', 'enemy-puff', 'lift-leaf', 'spring-flower', 'bridge-rope', 'checkpoint-flag', 'cave-paper', 'collectible-star', 'magic-bubble',
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
      this.sideMaterial = this.material(new THREE.MeshStandardMaterial({ map: textureFor('paper-texture'), color: this.level.id === 'forest' ? '#c18b61' : this.level.side, roughness: 1 }));
      this.caveSideMaterial = this.material(new THREE.MeshStandardMaterial({ map: textureFor('paper-texture'), color: '#cfa27b', roughness: 1 }));
      this.collectibleMaterials = Object.fromEntries(LEVEL_COLLECTIBLES[this.level.id].map(id => [id, spriteMaterial(COLLECTIBLES[id].image)]));
      this.finishMaterial = spriteMaterial(finishImage);
      this.waveMaterial = spriteMaterial('light-wave'); this.burstMaterial = spriteMaterial('enemy-burst');
      this.starMaterial = spriteMaterial('collectible-star'); this.treeMaterial = spriteMaterial('treehouse-tall');
      this.skillEffects = new SkillEffects(this.scene, this.planeGeometry,
        { blade: this.waveMaterial, bubble: spriteMaterial('magic-bubble'), stars: this.starMaterial }, this.skillRewards, this.isReducedMotion);
      this.caveMaterial = spriteMaterial('cave-paper');
      this.houseMaterial=spriteMaterial('street-house');this.houseMaterial.opacity=0.6;
      this.windmillMaterial=spriteMaterial('windmill-tall');this.windmillMaterial.opacity=0.65;
      this.awningMaterial=spriteMaterial('platform-awning');
      this.islandMaterial=spriteMaterial('island-lighthouse'); this.castleMaterial=spriteMaterial('castle-cutaway');
      this.castleMaterial.opacity=0.48; this.treeMaterial.opacity=0.75;
      this.platformMaterials=Object.fromEntries(['raft','ice','gear','conveyor'].map(kind=>[kind,spriteMaterial(`platform-${kind}`)]));
      for (const [kind,bounds] of Object.entries({ice:[205/724,550/724],gear:[145/724,668/724],raft:[30/128,94/128]})) {const texture=this.platformMaterials[kind].map;texture.offset.y=1-bounds[1];texture.repeat.y=bounds[1]-bounds[0];}
      this.attackMaterials = ['girl-attack','dad-attack'].map(spriteMaterial);
      this.standingMaterials = ['girl-player','dad-player'].map(spriteMaterial);
      this.liftMaterial = spriteMaterial('lift-leaf'); this.springMaterial = spriteMaterial('spring-flower');
      this.bridgeMaterial = spriteMaterial('bridge-rope'); this.flagMaterial = spriteMaterial('checkpoint-flag');
      this.enemyMaterials = Object.fromEntries(['jelly', 'leaf', 'puff'].map(kind => [kind, spriteMaterial(`enemy-${kind}`)]));
      const background = textureFor(landscape);
      const gardenMaterial = this.material(new THREE.MeshBasicMaterial({ map: background, side: THREE.DoubleSide, transparent: true, opacity: landscape === this.level.image ? 0.55 : 1 }));
      this.backdrops = [0].map(() => {
        const mesh = new THREE.Mesh(this.planeGeometry, gardenMaterial);
        mesh.scale.set(44, 44 * background.image.height / background.image.width, 1); mesh.position.set(0, 6, -18);
        this.scene.add(mesh); return mesh;
      });
      this.playerViews = ['girl-player', 'dad-player'].slice(0, this.players.length).map((name, i) => {
        const mesh = new THREE.Mesh(this.planeGeometry, this.standingMaterials[i]);
        const size = i ? 2.45 : 2.25; mesh.scale.set(size, size, 1);
        this.scene.add(mesh); return mesh;
      });
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
      group.visible = platform.isEnabled !== false;
      this.scene.add(group); this.platformViews.set(platform.id, group);
      if (platform.isCheckpoint && !platform.isFinish) this.sprite(this.flagMaterial,platform.x-platform.width/2+1,platform.y+1.1,1.4,2.2,-0.4);
      if (platform.isTunnel) this.sprite(this.caveMaterial,platform.x,platform.y+1.4,platform.width+1,4.8,-2);
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
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyJ', 'Enter', 'Escape', 'KeyP'].includes(event.code)) event.preventDefault();
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
  clearInput() { this.keys.clear(); this.touch.clear(); this.jumps = [false, false]; this.waves = []; }
  pause(isPaused) { this.isPaused = isPaused; this.clearInput(); this.accumulator = 0; }
  requestPause() { if (!this.isPaused) { this.pause(true); this.callbacks.onPause(); } }
  returnToSafety() {
    this.players.forEach(player => rescue(player)); this.clearInput(); this.publish('回到安全的跳台啦，再试一次吧！');
  }
  tick() {
    moveCampaignPlatforms(this.world.lifts, this.elapsed);
    const nearby = item => this.players.some(p => Math.abs(item.x-p.x)<45 && Math.abs(item.y-p.y)<24);
    const platforms = this.platforms.filter(nearby), enemies = this.world.enemies.filter(nearby);
    stepEnemies(enemies, STEP);
    for (const wave of this.waves) {
      // 宽屏光刃可能越过玩家周围的物理更新范围，命中不能只检查 nearby。
      const hits = stepWave(wave,this.world.enemies,platforms,STEP,this.elapsed);
      if (hits.length) this.callbacks.onSound('hit');
      for (const hit of hits) if (hit.isDefeated) this.rewardEnemy(hit.enemy);
      if (wave.burst) this.skillEffects.burst(wave.burst.x, wave.burst.y, this.elapsed);
    }
    this.waves = this.waves.filter(w => w.isActive);
    this.players.forEach((player, index) => {
      const isSingle = this.players.length === 1;
      const left = index === 0 ? this.keys.has('KeyA') || this.touch.has('left') || isSingle && this.keys.has('ArrowLeft') : this.keys.has('ArrowLeft');
      const right = index === 0 ? this.keys.has('KeyD') || this.touch.has('right') || isSingle && this.keys.has('ArrowRight') : this.keys.has('ArrowRight');
      const down = index === 0 ? this.keys.has('KeyS') || this.touch.has('drop') || isSingle && this.keys.has('ArrowDown') : this.keys.has('ArrowDown');
      const previousY = player.y;
      const result = stepPlayer(player, { direction: Number(right) - Number(left), jump: this.jumps[index] && !down, drop: this.jumps[index] && down }, platforms, STEP, { ...this.world, minY: Math.max(this.world.minY,player.safe.y-14) });
      this.jumps[index] = false;
      if (result.isRescued) this.publish('云朵接住你啦！宝物还在，继续出发。');
      if (result.isJumped) this.callbacks.onSound('jump');
      if (player.safe.isCheckpoint && player.safe.progress > this.checkpoint) {
        this.checkpoint = player.safe.progress; this.callbacks.onSound('checkpoint');
      }
      if (player.ground?.milestone) this.visited.add(player.ground.milestone);
      while (this.visited.has(this.furthestPlatform+1)) this.furthestPlatform++;
      const isFiring = index === 0 ? this.keys.has('KeyJ') || this.touch.has('attack') : this.keys.has('Enter');
      if (isFiring) {
        const kind = currentSkill(this.skillState, this.elapsed);
        const shots = fireSkill(player, this.elapsed, { left: this.cameraX - this.camera.right, right: this.cameraX + this.camera.right }, kind);
        if (shots.length) { this.waves.push(...shots); this.callbacks.onSound(kind === 'blade' ? 'fire' : kind); }
      }
      for (const reward of this.skillRewards) {
        if (Math.abs(player.x - reward.x) < 1.2 && Math.abs(player.y + 0.9 - reward.y) < 1.5
          && takeSkillReward(this.skillState, reward, this.elapsed)) {
          this.skillNotice = { kind: reward.kind, at: this.elapsed, id: reward.id };
          this.players.forEach(p => { p.nextShot = 0; this.skillEffects.burst(p.x, p.y + 1.1, this.elapsed, true); });
          this.callbacks.onSound('skill');
          this.publish(`获得${SKILLS[reward.kind].name}！${this.players.length === 2 ? '两个人都能用，' : ''}继续按攻击键。`);
        }
      }
      for (const sw of this.world.switches) if (!sw.isOpen && player.ground?.id === sw.platformId && Math.abs(player.x-sw.x)<1) {
        sw.isOpen=true; this.platforms[sw.bridgeId].isEnabled=true; this.publish('星星亮了，小桥打开啦！');
      }
      for (const spring of this.world.springs) if (touchSpring(player, spring)) { this.callbacks.onSound('jump'); this.publish('弹簧花送你跳高高！'); }
      for (const enemy of enemies) {
        const contact = touchEnemy(player, enemy, previousY, this.elapsed);
        if (contact === 'stomp') this.rewardEnemy(enemy);
        if (contact === 'hit') this.callbacks.onSound('hit');
        if (contact === 'bump') this.publish('轻轻碰了一下，闪光时可以放心走过去。');
      }
      for (const treasure of this.world.treasures.filter(nearby)) {
        const view = this.treasureViews.get(treasure.id);
        if (!view.isCollected && Math.abs(player.x - treasure.x) < 0.9 && Math.abs(player.y + 0.9 - treasure.y) < 1.25) {
          view.isCollected = true; view.mesh.visible = false; this.collected++;
          this.collectedIds.push(treasure.id);
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
    const points=enemy.points+(enemy.drop?COLLECTIBLES[enemy.drop].points:0);
    this.pickups.push({id:`enemy-${enemy.id}`,kind:enemy.drop,points,x:enemy.x,y:enemy.y+2,at:this.elapsed});
    this.callbacks.onSound('flower'); this.publish(`打败小怪，+${points} 分！`);
  }
  exportState() {
    return {version:1,seed:this.seed,levelId:this.level.id,elapsed:this.elapsed,collectedIds:this.collectedIds,defeatedIds:this.defeatedIds,
      skillState:{...this.skillState,collectedIds:[...this.skillState.collectedIds]},
      visited:[...this.visited],switches:this.world.switches.filter(s=>s.isOpen).map(s=>s.id),
      enemies:this.world.enemies.map(e=>({id:e.id,x:e.x,y:e.y,hp:e.hp,direction:e.direction,elapsed:e.elapsed,isDefeated:e.isDefeated,defeatedAt:e.defeatedAt})),
      players:this.players.map(p=>({safeId:p.safe.id,recoveries:p.recoveries,facing:p.facing}))};
  }
  restoreState(state) {
    if (state.version!==1 || state.seed!==this.seed || state.levelId!==this.level.id) throw new Error('存档地图不一致');
    this.elapsed=state.elapsed; this.collectedIds=[...state.collectedIds];this.collected=this.collectedIds.length;this.defeatedIds=[...state.defeatedIds];this.visited=new Set(state.visited);
    if (state.skillState) this.skillState = {...state.skillState, collectedIds:[...state.skillState.collectedIds]};
    this.furthestPlatform=0;while(this.visited.has(this.furthestPlatform+1))this.furthestPlatform++;
    for(const id of this.collectedIds){const v=this.treasureViews.get(id);if(v){v.isCollected=true;v.mesh.visible=false;}}
    for(const saved of state.enemies) Object.assign(this.world.enemies[saved.id-1],saved);
    for(const id of state.switches){const sw=this.world.switches[id];sw.isOpen=true;this.platforms[sw.bridgeId].isEnabled=true;}
    moveCampaignPlatforms(this.world.lifts,this.elapsed);
    this.players.forEach((p,i)=>{const saved=state.players[i];rescue(p,this.platforms[saved.safeId]);p.recoveries=saved.recoveries;p.facing=saved.facing;});
    this.publish('接着上次的冒险出发吧！');
  }
  snapshot() {
    this.pickups = this.pickups.filter(pickup => this.elapsed - pickup.at < 2.2);
    const pickups = this.pickups.map(pickup => {
      const position = new THREE.Vector3(pickup.x, pickup.y, 0.5).project(this.camera);
      return { id: pickup.id, kind: pickup.kind, points: pickup.points, x: (position.x + 1) * 50, y: (1 - position.y) * 50 };
    });
    const score=campaignScore(this.world,this.collectedIds,this.defeatedIds,this.isCompleted,this.level.bonus);
    return { ...score, skill:currentSkill(this.skillState,this.elapsed), skillSeconds:skillSeconds(this.skillState,this.elapsed), skillRevision:this.skillState.collectedIds.length,
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
      const targetX = Math.max(Math.min(16, this.camera.right - 4), Math.min(this.world.finish.x - 7, averageX + Math.min(5, this.camera.right * 0.25)));
      const targetY = averageY + 4;
      const smoothing = Math.min(1, delta * 4);
      this.cameraX += (targetX - this.cameraX) * smoothing; this.cameraY += (targetY - this.cameraY) * smoothing;
      this.camera.position.set(this.cameraX + 0.6, this.cameraY + 3.3, 30); this.camera.lookAt(this.cameraX, this.cameraY, 0);
      this.backdrops.forEach(mesh => { mesh.position.x = this.cameraX; mesh.position.y=this.cameraY-1; const aspect=mesh.material.map.image.width/mesh.material.map.image.height;const width=Math.max(44,this.camera.right*2+8,(this.camera.top*2+8)*aspect);mesh.scale.set(width,width/aspect,1); });
      for (const p of this.platforms) {const view=this.platformViews.get(p.id);view.position.set(p.x,p.y,0);view.visible=p.isEnabled!==false && Math.abs(p.x-this.cameraX)<this.camera.right+12 && Math.abs(p.y-this.cameraY)<this.camera.top+12;}
      for (const sw of this.world.switches) this.switchViews.get(sw.id).material.color.set(sw.isOpen ? '#b6f4a2' : '#ffffff');
      this.skillEffects.update(this.waves,this.skillState,this.players,this.elapsed,this.cameraX,this.camera.right);
      this.players.forEach((player, index) => {
        const mesh = this.playerViews[index], size = index ? 2.45 : 2.25;
        mesh.position.set(player.x, player.y + size * 0.43, 0.6 + index * 0.2);
        mesh.rotation.z = !this.isReducedMotion && !this.isPaused && player.isGrounded ? Math.sin(this.elapsed * 16) * Math.abs(player.vx) * 0.006 : 0;
        const isAttacking = this.elapsed < (player.attackUntil || 0);
        mesh.material=isAttacking?this.attackMaterials[index]:this.standingMaterials[index];
        mesh.scale.x = size * player.facing * (isAttacking?0.75:1);
        mesh.material.opacity = player.protection > 0 ? (this.isReducedMotion ? 0.65 : 0.55 + Math.sin(this.elapsed * 16) * 0.25) : 1;
      });
      for (const enemy of this.world.enemies) {
        const mesh = this.enemyViews.get(enemy.id);
        mesh.visible = Math.abs(enemy.x-this.cameraX)<this.camera.right+3 && (!enemy.isDefeated || this.elapsed-enemy.defeatedAt<0.4);
        if(enemy.isDefeated) mesh.material=this.burstMaterial;
        mesh.material.opacity=enemy.hitUntil>this.elapsed?0.5:1;
        this.enemyMarkers.get(enemy.id).forEach((marker,i)=>{marker.visible=mesh.visible&&!enemy.isDefeated&&enemy.hp>1;marker.position.set(enemy.x+(i?0.25:-0.25),enemy.y+enemy.height+0.4,0.6);});
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
