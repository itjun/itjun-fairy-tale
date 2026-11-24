import { pushInWind } from '../../shared/trails/wind.js';
import { fieldHint, stepField, syncField } from '../../shared/trails/field-progress.js';
import { fieldImages } from './field-views.js';
import { trailMaterial } from './trail-art.js';
import { advanceStory, syncStory, storyHint } from '../../shared/story-mechanisms.js';
import { storyImages } from './story-views.js';
import { VALLEY_IMAGES, WATER_NOTICES, valleyHint } from './flower-valley-view.js';
import { syncWaterRoutes, waterUnderfoot } from '../../shared/flower-valley.js';
import { forestHint, stepForestRescue } from './forest-rescue.js';
import { FOLLOWING, HOME, syncForestRoutes } from '../../shared/forest-rescue.js';
import { saveProjectiles, restoreProjectiles } from './projectile-state.js';
import { applyCycleHealth, cycleModifiers } from '../../shared/adventure-cycle.js';
import { stepMagic, consumeMagicShield, shieldCounter, newMagic } from './magic.js';
import { CHARACTERS, newSurvival, migrateSurvival, reviveSurvival, applyWeaponTalent, bloomAtHit } from './characters.js';
import { resourcesFor, damageWithBuild, recordDefeat, completeEncounter, tickResources, useRecovery, heal } from './expedition.js';
import { newRoomState, currentRoom, stepRoom, recordCombo, recordHurt, doorAt, enterDoor, stallAt, isStallSold, isRoomCleared, roomProgress, starTotal, encounterBarrier } from './rooms.js';
import { roomEnemyGuide } from './room-guide.js';
import { openRoomReward, rerollReward, buyStall, SHOP_ITEMS } from './room-rewards.js';
import { DOOR_REWARDS, ROOM_KINDS, PUZZLES, createRoomWorld } from '../../shared/room-world.js';
import { LAYER } from '../../shared/room-terrain.js';
import { SPELLS } from '../../shared/combat-catalog.js';
import { setCounts, setLevel } from './sets.js';
import { DIFFICULTIES, DEFAULT_DIFFICULTY, difficultyOf, getPlaySettings } from './difficulty.js';
import { RoomViews, ROOM_IMAGES } from './room-view.js';
import * as THREE from 'three';
import { currentBoss, stepBosses, constrainBossArena, areBossesDefeated, bossStatus } from './bosses.js';
import { collectGrowth, grow, weaponDamage } from './growth.js';
import { starterAdventure } from './starter-build.js';
import { newCombatLoot, rollCombatLoot, lootPosition, nearbyLoot, chooseLifeLoot, LIFE_CHOICES } from './combat-loot.js';
import { MONSTERS, WEAPONS } from '../../shared/adventure-catalog.js';
import { newAdventure, newJourney, upgradePower, activeWeapons, weaponRank, weaponShotCount, migrateAdventure, tickEffects, chooseReward, recycleReward } from './adventure.js';
import { canStartAttack, fireLoadout, stepAdventureWave, areaAttack, attackSource } from './adventure-combat.js';
import { ATTACK_KEYS, attackBindings, attackInput, bindAttack } from './attack-bindings.js';
import { stepAdventureEnemies, releaseCandyChildren } from './adventure-enemies.js';
import { createPlayer, landingDamage, rescue, revivalPoint } from './physics.js';
import { balloonCeiling, beginCrawl, caveForPlayer, caveMouthAt, climbEntryAt, stepTraversal } from './traversal.js';
import { DESERT_IMAGES, TRAVERSAL_IMAGES, TraversalViews } from './traversal-view.js';
import { addSunlightDeck } from './oasis-light.js';
import { campaignScore } from '../../shared/campaign.js';
import { moveCampaignPlatforms } from './combat.js';
import { SkillEffects } from './skill-effects.js';
import { touchEnemy, touchSpring, saveEnemy, restoreEnemy } from './enemies.js';
import { ICICLE_SIZE, hazardState, icicleTargets, stepMechanisms, touchingHazard, takeRoomSupply, mechanismSave, restoreMechanisms } from './hazards.js';
import { LEVELS, themeFor } from '../../shared/levels.js';
import { COLLECTIBLES, LEVEL_COLLECTIBLES } from './collectibles.js';

const STEP = 1 / 120;
// 平台素材只取画着台面的那一截。前一张表是上下两条边占图高的比例，后一张是像素框：左、上、右、下。
// 叠在别的落脚面上方的平台，贴图最厚画到这么多。一层高 2.4，下面还剩 1.5，普通小怪站得进去。
export const THIN_ART = 0.9;
export const PLATFORM_CROPS = { ice: [205/724, 550/724], gear: [145/724, 668/724], raft: [30/128, 94/128] };
export const TERRAIN_CROPS = { bank: [11, 71, 2159, 654], cookie: [12, 173, 2160, 572], rock: [11, 112, 2161, 667], blocks: [36, 207, 2135, 577], cloud: [19, 174, 2148, 580] };

// 两端各保留一次原画的圆边，中间往返取同一段纹理，交界处两侧用的是同一列像素。
function continuousTerrainGeometry(tileCount) {
  const segments = tileCount * 2 + 1;
  const geometry = new THREE.PlaneGeometry(1, 1, segments);
  const { position, uv } = geometry.attributes;
  for (let column = 1; column < segments; column++) {
    const x = (column - .5) / (segments - 1) - .5;
    const u = column % 2 === 1 ? .25 : .75;
    for (const vertex of [column, column + segments + 1]) {
      position.setX(vertex, x);
      uv.setX(vertex, u);
    }
  }
  return geometry;
}

export class GardenEngine {
  constructor(host, { seed, count, level = LEVELS[0], onComplete, onUpdate, onPause, onReady, onError, onSound, onReward, onLifeLoot, onLifeChange, onAlbum, character = 'sister', survival, adventure, difficulty, locked }) {
    this.host = host;
    this.callbacks = { onUpdate, onPause, onReady, onError, onSound, onComplete, onReward, onLifeLoot, onLifeChange, onAlbum };
    this.survival = migrateSurvival(survival || newSurvival(character));
    this.stage = level; this.level = themeFor(level);
    this.adventure = migrateAdventure(structuredClone(adventure || newAdventure(seed, 1)));
    this.world = createRoomWorld(seed, level, this.adventure.cycle);
    // 选门闯房间：房间进度单独记，难度和画册里还没解锁的东西跟着这次冒险走。
    this.roomState = newRoomState(this.world);
    this.spellHits = 0; this.isInteracting = false; this.attackInput = { down: [] }; this.rewardAt = 0;
    this.applyRoomRules(difficulty, locked);
    this.journey = newJourney(); this.levelKey = `${level.id}:${seed}`; this.attackGate = { next: 0 }; this.enemyShots = []; this.enemyShotViews = new Map();
    this.claimedSupplies = []; this.hazardViews = new Map(); this.supplyViews = new Map();
    this.combatLoot = newCombatLoot(); this.lootViews = new Map();
    this.damageNumbers = []; this.damageSequence = 0;
    this.seed = seed; this.defeatedIds = []; this.visited = new Set(); this.waves = []; this.switchViews = new Map();
    this.platforms = this.world.platforms;
    this.collectibleKinds = this.world.treasures.map(t => t.kind);
    this.collectedIds = []; this.pickups = [];
    this.isCompleted = false; this.furthestPlatform = 0; this.isDisposed = false;
    this.isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.isPaused = true; this.keys = new Set(); this.touch = new Set(); this.gamepad = new Set(); this.gamepadDirection = 0; this.jumps = [false, false];
    this.collected = 0; this.distance = 0; this.checkpoint = 0; this.elapsed = 0;
    // 房间的起点正中可能放着弹簧，出生和进门都站在左边一点。
    this.players = [createPlayer(this.world.start, -2)];
    this.players[0].character = this.survival.character;
    if(adventure)for(const effect of this.adventure.magic.active){effect.x=this.players[0].x;effect.y=this.players[0].y+1;effect.hitIds=[];}
    this.checkpointId = this.world.start.id;
    this.platformViews = new Map(); this.treasureViews = new Map(); this.enemyViews = new Map(); this.enemyMarkers = new Map();
    this.textures = []; this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#faf4e6');
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
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
    this.heldKeys = new Set();
    window.addEventListener('keyup', event => {this.keys.delete(event.code);this.heldKeys.delete(event.code);}, options);
    const releasePointer = () => { for (const key of this.heldKeys) if (key.startsWith('touch:')) this.heldKeys.delete(key); };
    window.addEventListener('pointerup', releasePointer, options);
    window.addEventListener('pointercancel', releasePointer, options);
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
      const surfaceImage = this.level.surface || 'grass-texture';
      const storyBackdrop = this.world.expedition && {family:'clock-town-sky',snow:'snow-expedition-ridge'}[this.level.id];
      const landscape = this.world.field === 'beach' ? 'paper-texture' : storyBackdrop || (this.world.valley ? 'water-valley' : ['rainbow','family','meadow'].includes(this.level.id) ? 'landscape-new-drawing' : { forest: 'landscape-forest', sweet: 'landscape-sweet', desert: 'landscape-desert' }[this.level.id] || this.level.image);
      const isDesert = this.level.id === 'desert';
      const poseNames = Object.keys(CHARACTERS).flatMap(character => ['climb', 'crawl'].map(pose => `${character}-${pose}`));
      this.isNewLandscape = landscape === 'landscape-new-drawing' || !!this.world.valley || !!storyBackdrop;
      const names = [...new Set([landscape, ...fieldImages(this.world), ...storyImages(this.world), ...(this.world.valley ? VALLEY_IMAGES : []), ...Object.values(CHARACTERS).flatMap(c => [c.image, c.attack]), ...poseNames, ...TRAVERSAL_IMAGES, ...(isDesert ? DESERT_IMAGES : []), 'flower', 'collectible-rainbow', 'light-wave', 'enemy-burst', 'treehouse-tall', ...(this.world.forest ? ['forest-hollow', 'forest-root-hall', 'forest-nest', 'forest-owlet', 'forest-vine'] : []), 'platform-raft', 'platform-ice', 'platform-gear', 'platform-conveyor', 'island-lighthouse', 'castle-cutaway', 'street-house', 'windmill-tall', 'platform-awning', surfaceImage,
        'lift-leaf', 'spring-flower', 'bridge-rope', 'checkpoint-flag', 'collectible-star', 'magic-bubble', 'hot-air-balloon',
        ...LEVEL_COLLECTIBLES[this.level.id].map(id => COLLECTIBLES[id].image), 'new-drawing-tower', 'new-drawing-flowers', 'trap-pendulum', 'trap-thorns', 'trap-steam', 'terrain-blocks', 'platform-cloud', 'life-potion', 'supply-medkit', 'flame-stream', 'collectible-snowflake', 'upgrade-frost', 'upgrade-chain', 'boss-gate', 'boss-chest', 'terrain-bank', 'terrain-cookie', 'terrain-rock', ...ROOM_IMAGES, ...Object.values(MONSTERS).map(m => m.image), ...Object.values(WEAPONS).map(w => w.image), ...this.world.enemies.filter(e=>e.isBoss && e.image).map(e=>e.image), ...this.world.enemies.flatMap(e=>(e.skills || []).map(skill=>skill.image))])];
      const textures = await Promise.all(names.map(async name => {
        const texture = await loader.loadAsync(`./assets/${name}.png`);
        if (this.isDisposed) { texture.dispose(); return texture; }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
        this.textures.push(texture); return texture;
      }));
      if (this.isDisposed) return;
      const textureFor = name => textures[names.indexOf(name)];
      // 彩笔素材都是平面，翻面也只画一次；双面透明材质的默认两遍绘制只会增加开销。
      const spriteMaterial = name => this.material(new THREE.MeshBasicMaterial({ map: textureFor(name), transparent: true, alphaTest: 0.08, side: THREE.DoubleSide, forceSinglePass: true }));
      this.textureFor = textureFor; this.spriteMaterial = spriteMaterial;
      const grass = textureFor(surfaceImage);
      grass.wrapS = grass.wrapT = THREE.RepeatWrapping; grass.repeat.set(2, 1);
      if (this.world.valley) this.waterMaterials = { bank: spriteMaterial('water-bank'), 'water-leaf': spriteMaterial('water-leaf'), 'water-lily': spriteMaterial('water-lily'), 'water-treadle': spriteMaterial('platform-raft') };
      this.grassMaterial = this.material(new THREE.MeshStandardMaterial({ map: grass, color: this.level.topColor || '#ffffff', roughness: 1 }));
      this.collectibleMaterials = Object.fromEntries(LEVEL_COLLECTIBLES[this.level.id].map(id => [id, spriteMaterial(COLLECTIBLES[id].image)]));
      this.waveMaterial = spriteMaterial('light-wave'); this.burstMaterial = spriteMaterial('enemy-burst');
      this.starMaterial = spriteMaterial('collectible-star'); this.treeMaterial = spriteMaterial('treehouse-tall');
      this.skillEffects = new SkillEffects(this.scene, this.planeGeometry,
        { lightblade:spriteMaterial('weapon-lightblade'), blade: this.waveMaterial, bubble: spriteMaterial('magic-bubble'), stars: this.starMaterial, flame: spriteMaterial('flame-stream'), dragon:spriteMaterial('weapon-flame'), snow:spriteMaterial('collectible-snowflake'), thunder:this.waveMaterial, fire:spriteMaterial('flame-stream'), rain:spriteMaterial('magic-bubble'), cloud:spriteMaterial('platform-cloud'), moonblade: spriteMaterial('weapon-moonblade'), boomerang: spriteMaterial('weapon-boomerang'), seed: spriteMaterial('weapon-seed'), firefly: spriteMaterial('weapon-firefly'), pulse: this.starMaterial }, this.isReducedMotion);
      this.houseMaterial=spriteMaterial('street-house');this.houseMaterial.opacity=0.6;
      this.windmillMaterial=spriteMaterial('windmill-tall');this.windmillMaterial.opacity=0.65;
      this.awningMaterial=spriteMaterial('platform-awning');
      this.islandMaterial=spriteMaterial('island-lighthouse'); this.castleMaterial=spriteMaterial('castle-cutaway');
      this.castleMaterial.opacity=0.48; this.treeMaterial.opacity=0.75;
      this.platformMaterials=Object.fromEntries(['raft','ice','gear','conveyor'].map(kind=>[kind,spriteMaterial(`platform-${kind}`)]));
      for (const [kind,bounds] of Object.entries(PLATFORM_CROPS)) {const texture=this.platformMaterials[kind].map;texture.offset.y=1-bounds[1];texture.repeat.y=bounds[1]-bounds[0];}
      this.characterMaterials = Object.fromEntries(Object.entries(CHARACTERS).map(([id,c]) => [id, { standing: spriteMaterial(c.image), attack: spriteMaterial(c.attack) }]));
      this.traversalMaterials = Object.fromEntries(poseNames.map(name => [name, spriteMaterial(name)]));
      this.flowerMaterial = spriteMaterial('flower'); this.rainbowMaterial = spriteMaterial('collectible-rainbow');
      this.liftMaterial = spriteMaterial('lift-leaf'); this.springMaterial = spriteMaterial('spring-flower');
      this.bridgeMaterial = spriteMaterial('bridge-rope'); this.flagMaterial = spriteMaterial('checkpoint-flag');
      this.enemyMaterials = Object.fromEntries(Object.entries(MONSTERS).map(([kind, monster]) => [kind, spriteMaterial(monster.image)]));
      this.bossMaterials = Object.fromEntries(this.world.enemies.filter(e=>e.isBoss && e.image).map(e=>[e.image,spriteMaterial(e.image)]));
      this.enemyShotMaterials=Object.fromEntries([...new Set(this.world.enemies.flatMap(e=>(e.skills || []).map(skill=>skill.image)))].map(name=>[name,spriteMaterial(name)]));
      this.lifeMaterial = spriteMaterial('life-potion');this.medkitMaterial=spriteMaterial('supply-medkit');
      this.balloonMaterial = spriteMaterial('hot-air-balloon');
      this.bossGateMaterial=spriteMaterial('boss-gate');this.bossChestMaterial=spriteMaterial('boss-chest');
      this.trapMaterials = {pendulum:spriteMaterial('trap-pendulum'),thorns:spriteMaterial('trap-thorns'),steam:spriteMaterial('trap-steam'),icicle:spriteMaterial('monster-icicle')};
      if (this.world.hazards.some(h=>h.kind==='geyser')) this.trapMaterials.geyser=trailMaterial(this,'water-geyser');
      this.terrainMaterials = Object.fromEntries(['bank','cookie','rock','blocks'].map(kind=>[kind,spriteMaterial(`terrain-${kind}`)]));
      this.terrainMaterials.cloud = spriteMaterial('platform-cloud');
      if (isDesert) this.terrainMaterials.sand = spriteMaterial('terrain-sand');
      if (isDesert) this.terrainMaterials['cave-stone'] = spriteMaterial('desert-cave-ledge');
      for (const [kind,bounds] of Object.entries(TERRAIN_CROPS)) {
        const texture=this.terrainMaterials[kind].map,w=texture.image.width,h=texture.image.height;
        texture.offset.set(bounds[0]/w,1-bounds[3]/h);texture.repeat.set((bounds[2]-bounds[0])/w,(bounds[3]-bounds[1])/h);
      }
      // 不动的障碍：刺丛用整张刺的画，积木堆从积木地面上裁一截。
      const pile=textureFor('terrain-blocks').clone();
      pile.repeat.x=540/pile.image.width;this.textures.push(pile);
      this.blockMaterials={thorns:this.trapMaterials.thorns,blocks:this.material(new THREE.MeshBasicMaterial({map:pile,transparent:true,alphaTest:.08}))};
      this.newTowerMaterial = spriteMaterial('new-drawing-tower'); this.newFlowersMaterial = spriteMaterial('new-drawing-flowers');
      const background = textureFor(landscape);
      const gardenMaterial = this.material(new THREE.MeshBasicMaterial({ map: background, side: THREE.DoubleSide, forceSinglePass: true, transparent: true, opacity: landscape === this.level.image ? 0.55 : 1 }));
      if (this.world.field==='beach') { gardenMaterial.color.set('#fff1d2'); gardenMaterial.opacity=.38; }
      this.backdrops = [0].map(() => {
        const mesh = new THREE.Mesh(this.planeGeometry, gardenMaterial);
        mesh.scale.set(44, 44 * background.image.height / background.image.width, 1); mesh.position.set(0, 6, this.world.valley ? -5 : -18);
        this.scene.add(mesh); return mesh;
      });
      this.playerViews = this.players.map(() => {
        const mesh = new THREE.Mesh(this.planeGeometry, this.characterMaterials[this.survival.character].standing);
        const size = CHARACTERS[this.survival.character].height; mesh.scale.set(size, size, 1);
        this.scene.add(mesh); return mesh;
      });
      this.talentView = this.sprite(this.flowerMaterial, 0, 0, 3, 3, 1); this.talentView.visible = false;
      this.buildWorld();
      this.traversalViews = new TraversalViews(this);
      // 门牌用本地手写字体画，先等字体就绪；等不到就用系统楷体。
      try { await document.fonts.load('40px GardenHand'); } catch { /* 字体没装好不影响游玩。 */ }
      if (this.isDisposed) return;
      this.roomViews = new RoomViews(this);
      this.isReady = true; this.callbacks.onReady();
      const room = currentRoom(this.world, this.roomState);
      const cave = caveForPlayer(room, this.players[0]);
      this.publish(this.world.field && room.stops.length ? fieldHint(this.world,this.roomState,this.players[0],this.elapsed) : this.world.expedition && room.goals?.length ? storyHint(room,this.roomState.story) : this.world.valley ? valleyHint(this.world, this.roomState, this.players[0]) : this.world.forest ? forestHint(this.world, this.roomState.forest, this.players[0]) : cave?.name ? `继续探索${cave.name}` : cave ? '走到神灯下，向上出洞' : room.traversal?.name ? room.traversal.hint : '清完一间房，跳到发光的门上。');
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
    const continuousDecks = new Map();
    // 下层落脚面稍靠前；每块贴图有固定深度，镜头移动时不再争抢像素。
    const surfaceDepths=new Map([...this.platforms].sort((a,b)=>b.y-a.y||a.id-b.id).map((p,index)=>[p.id,.15+.15*index/(this.platforms.length+1)]));
    // 正下方两层以内还有落脚面的平台，贴图画薄一点，给下面站着的人和怪留出空。
    const hasFloorBelow=platform=>this.platforms.some(other=>other.id!==platform.id&&other.skin!=='sunlight'&&!other.isMoving&&other.y<platform.y-.01&&platform.y-other.y<LAYER*2-.2&&Math.min(platform.x+platform.width/2,other.x+other.width/2)-Math.max(platform.x-platform.width/2,other.x-other.width/2)>0);
    for (const platform of this.platforms) {
      const group = new THREE.Group(); group.position.set(platform.x, platform.y, 0);
      if (platform.skin === 'sunlight') {
        addSunlightDeck(this, group, platform);
      } else if (platform.handLength || platform.skin==='safety-net' || (this.world.expedition && this.level.id==='snow' && platform.isIce)) {
        const hand=!!platform.handLength, net=platform.skin==='safety-net';
        const art=hand?'clock-orange-hand':net?'clock-safety-net':'snow-crayon-bank';
        this.storyDecks ||= {};
        const mat=this.storyDecks[art] ||= this.spriteMaterial(art);
        const mesh=new THREE.Mesh(this.planeGeometry,mat);
        const width=hand?platform.handLength*1.11:platform.snowDepth?Math.hypot(platform.width,platform.width*platform.slope)+.32:platform.width;
        const height=hand?width*.15:net?width*.25:platform.snowDepth || Math.min(2.2,width*.23);
        mesh.scale.set(width,height,1);
        mesh.position.set(hand?-platform.handLength*.045:0,net?height*.03:hand?-height*.26:-height*.44,.3);
        group.add(mesh);
      } else if (this.waterMaterials?.[platform.skin]) {
        const deck = new THREE.Mesh(this.planeGeometry, this.waterMaterials[platform.skin]);
        const height = platform.skin === 'bank' ? Math.min(7, platform.width * .42) : platform.skin === 'water-treadle' ? .36 : platform.skin === 'water-lily' ? 1.15 : 1.35;
        deck.scale.set(platform.width, height, 1);
        deck.position.set(0, (platform.skin === 'bank' ? -.47 : -.37) * height, .3);
        group.add(deck);
      } else if (platform.isMoving) {
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
        const material = platform.skin === 'leaf' ? this.liftMaterial : platform.skin === 'roof' ? this.awningMaterial : platform.skin === 'plank' ? this.platformMaterials.raft : platform.skin === 'ice' ? this.platformMaterials.ice : this.terrainMaterials[platform.skin] || this.terrainMaterials[platform.skin === 'root' ? 'bank' : platform.skin === 'blocks' ? 'rock' : 'bank'];
        const ratio=material.map.image.height*material.map.repeat.y/(material.map.image.width*material.map.repeat.x);
        // 宽地面横向拼接，不把一整张贴图撑高后盖住地下路。
        const maxHeight=hasFloorBelow(platform)?THIN_ART:platform.skin==='roof'?1.4:platform.skin==='leaf'?1.15:1.8;
        const count=Math.max(1,Math.ceil(platform.width*ratio/maxHeight)),width=platform.width/count,height=width*ratio;
        if ((this.world.forest || this.world.valley || this.world.field) && count > 1) {
          const leaf = platform.skin === 'leaf';
          if (!leaf && !continuousDecks.has(count)) {
            const geometry = continuousTerrainGeometry(count);
            continuousDecks.set(count, geometry);
            this.resources.push(geometry);
          }
          const deck = new THREE.Mesh(leaf ? this.planeGeometry : continuousDecks.get(count), material);
          const deckHeight = leaf ? maxHeight : height;
          deck.scale.set(platform.width, deckHeight, 1);
          deck.position.set(0, -deckHeight / 2, .3);
          group.add(deck);
        } else {
          for (let index = 0; index < count; index++) {
            const tile = new THREE.Mesh(this.planeGeometry, material);
            tile.scale.set(width, height, 1);
            tile.position.set(-platform.width / 2 + (index + .5) * width, -height / 2, .3);
            group.add(tile);
          }
        }
      }
      group.visible = platform.isEnabled !== false;
      for(const mesh of group.children)if(mesh.position.z>=0)mesh.position.z=surfaceDepths.get(platform.id);
      this.scene.add(group); this.platformViews.set(platform.id, group);
      if (platform.isCheckpoint && !platform.isFinish) this.sprite(this.flagMaterial,platform.x-platform.width/2+1,platform.y+1.1,1.4,2.2,-0.4);
    }
    for (const h of this.world.hazards || []) {
      const group=new THREE.Group();group.position.set(h.x,h.y+(h.kind==='pendulum'?h.length+1:0),0.5);
      const height=h.kind==='pendulum'?h.length+1:h.kind==='block'?1.3:h.kind==='thorns'?1.35:h.kind==='icicle'?ICICLE_SIZE.height:2.8;
      const width=h.kind==='pendulum'?height/2:h.kind==='block'?1.9:h.kind==='icicle'?ICICLE_SIZE.width:2.4;
      const mesh=new THREE.Mesh(this.planeGeometry,this.material((h.kind==='block'?this.blockMaterials[h.skin]:this.trapMaterials[h.kind]).clone()));
      mesh.scale.set(width,height,1);mesh.position.y=h.kind==='pendulum'?-height*.45:height/2;
      group.add(mesh);this.scene.add(group);this.hazardViews.set(h.id,{group,mesh});
    }
    for (const supply of this.world.supplies || []) {
      const isBalloon = supply.kind === 'hotAirBalloon';
      const material = isBalloon ? this.balloonMaterial : supply.kind === 'medkit' ? this.medkitMaterial : this.lifeMaterial;
      this.supplyViews.set(supply.id, this.sprite(material, supply.x, supply.y, isBalloon ? 1.8 : .9, isBalloon ? 2.7 : 1.25));
    }
    for (const treasure of this.world.treasures) {
      const kind = this.collectibleKinds[treasure.id - 1], item = COLLECTIBLES[kind];
      const mesh = this.sprite(this.collectibleMaterials[kind], treasure.x, treasure.y, item.size * 0.78, item.size * 0.78);
      const platform = this.platforms[treasure.platformId];
      this.treasureViews.set(treasure.id, { mesh, kind, isCollected: false, growingPlatform: platform?.channel || platform?.needsMark || platform?.fieldGate ? platform : null });
    }
    for (const enemy of this.world.enemies) {
      this.enemyViews.set(enemy.id, this.sprite(this.material((this.bossMaterials[enemy.image] || this.enemyMaterials[enemy.kind]).clone()), enemy.x, enemy.y + enemy.height / 2, 1.4, enemy.height, 0.5));
      this.enemyMarkers.set(enemy.id, [this.sprite(this.starMaterial,enemy.x-0.25,enemy.y+2,0.35,0.35),this.sprite(this.starMaterial,enemy.x+0.25,enemy.y+2,0.35,0.35)]);
    }
    this.springViews = new Map();
    for (const spring of this.world.springs) {
      const material = this.world.forest ? this.collectibleMaterials.mushroom : this.springMaterial;
      this.springViews.set(spring,this.sprite(material, spring.x, spring.y + .42, 2.1, 1.45, .35));
    }
    for (const sw of this.world.switches) this.switchViews.set(sw.id,this.sprite(this.material(this.starMaterial.clone()),sw.x,sw.y+0.18,1.1,0.55,0.8));
    for (const d of this.world.decorations) {
      if(this.level.id==='family') this.sprite(this.houseMaterial,d.x,d.y+7,14*654/1024,14,-3);
      if(this.level.id==='meadow') this.sprite(this.windmillMaterial,d.x,d.y+10,15,20,-3);
      if(this.level.id==='forest') {const height=Math.max(30,d.height);this.sprite(this.treeMaterial,d.x,d.y+height/2,height*2/3,height,-3);}
      if(this.level.id==='sweet') {const size=Math.max(24,d.height);this.sprite(this.castleMaterial,d.x,d.y+size/2,size,size,-3);}
      if(this.level.id==='beach') {const height=Math.max(16,d.height);this.sprite(this.islandMaterial,d.x,d.y+2,height*4/3,height,-3);}
    }
    for (const zone of this.world.zones) {
      const p = this.platforms[zone.startId];
      this.sprite(this.newFlowersMaterial, p.x + 3, p.y + 0.6, 2.4, 1.8, -0.4);
    }
    if (!this.world.forest && !this.world.valley && !this.world.expedition) this.sprite(this.newTowerMaterial, 5, this.world.start.y + 2.2, 2.2, 4.4, -2);
    const tower = this.world.finish;
    if (!this.world.forest && !this.world.expedition) this.sprite(this.newTowerMaterial, tower.x + 4, tower.y + 5, 4, 10, -1.5);
    for(const arena of this.world.bossArenas || []) { const exit=this.platforms[arena.exitId];this.sprite(this.bossGateMaterial,exit.x+1,exit.y+2,4,4,-.3);this.sprite(this.bossChestMaterial,exit.x-2,exit.y+.8,2.4,1.8,.6); }
  }
  copyPauseFrame(canvas) {
    const source = this.renderer.domElement;
    const player = this.playerViews[0].position.clone().project(this.camera);
    const width = Math.min(source.width, source.height * 4 / 3) * .86;
    const height = width * 3 / 4;
    const x = THREE.MathUtils.clamp((player.x + 1) * source.width / 2 - width * .45, 0, source.width - width);
    const y = THREE.MathUtils.clamp((1 - player.y) * source.height / 2 - height * .68, 0, source.height - height);
    canvas.width = Math.min(1400, Math.round(width));
    canvas.height = Math.round(canvas.width * 3 / 4);
    // WebGL 的默认帧缓冲在呈现后会清空，绘制与拷贝要在同一帧内完成。
    this.renderer.render(this.scene, this.camera);
    canvas.getContext('2d').drawImage(source, x, y, width, height, 0, 0, canvas.width, canvas.height);
  }
  resize() {
    const width = this.host.clientWidth, height = this.host.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height);
    const aspect = width / height;
    const halfHeight = this.world.expedition ? ({family:14.8,snow:12.5}[this.level.id] || 9) : 9;
    const halfWidth = Math.max(12,halfHeight * aspect);
    if (!this.isReady) this.cameraX = Math.min(16, halfWidth - 4);
    this.camera.left = -halfWidth; this.camera.right = halfWidth;
    this.camera.top = halfWidth / aspect; this.camera.bottom = -halfWidth / aspect; this.camera.updateProjectionMatrix();
  }
  keyDown(event) {
    this.heldKeys.add(event.code);
    if (this.isPaused || event.repeat && !this.keys.has(event.code)) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyJ', 'KeyK', 'KeyL', 'Escape', 'KeyP'].includes(event.code)) event.preventDefault();
    if (event.code === 'Escape' || event.code === 'KeyP') { if (!event.repeat) this.requestPause(); return; }
    if (!this.keys.has(event.code)) {
      // 站在摊位前，“上”用来买东西，不跳。门是跳上去就进。
      const player = this.players[0];
      const isFlying = !!this.adventure.effects?.hotAirBalloon;
      if ((isFlying ? event.code === 'Space' : ['KeyW', 'ArrowUp'].includes(event.code)) && this.canInteract()) this.isInteracting = true;
      else if (event.code === 'Space' || !player.grip && !player.launch?.isDrop && (event.code === 'KeyW' || this.players.length === 1 && event.code === 'ArrowUp')) this.jumps[0] = true;
    }
    this.keys.add(event.code);
  }
  setTouch(action, isPressed) {
    if(!isPressed)this.heldKeys?.delete(`touch:${action}`);
    if (this.isPaused) return;
    if(isPressed)this.heldKeys?.add(`touch:${action}`);
    if (isPressed && action === 'enter') { this.isInteracting = true; return; }
    if (isPressed) {
      const player = this.players[0];
      if (!this.touch.has(action) && (action === 'jump' || action === 'drop' && player.ground?.skin !== 'sunlight' && !player.grip && !climbEntryAt(currentRoom(this.world, this.roomState).traversal, player))) this.jumps[0] = true;
      this.touch.add(action);
    }
    else this.touch.delete(action);
  }
  setGamepadInput(input) {
    if (this.isPaused) return;
    const actions = input?.actions || new Set();
    if (actions.has('confirm') && !this.gamepad.has('jump')) this.jumps[0] = true;
    const isFlying = !!this.adventure?.effects?.hotAirBalloon;
    if (actions.has(isFlying ? 'confirm' : 'up') && !this.gamepad.has(isFlying ? 'jump' : 'up') && this.canInteract()) this.isInteracting = true;
    this.gamepad = new Set([...actions].map(action => action === 'confirm' ? 'jump' : action === 'down' ? 'drop' : action));
    this.gamepadDirection = input?.direction || 0;
    this.gamepadVertical = input?.vertical ?? Number(actions.has('up')) - Number(actions.has('down'));
  }
  releaseGamepad() { this.gamepad?.clear(); this.gamepadDirection = 0; this.gamepadVertical = 0; }
  hasControl(action) { return this.touch.has(action) || this.gamepad?.has(action); }
  clearInput() { this.releaseGamepad(); this.keys.clear(); this.touch.clear(); this.jumps = [false, false]; this.isInteracting = false; this.attackInput = { down: [] }; }
  pause(isPaused) { if (!isPaused && (this.survival.phase !== 'alive'||this.combatLoot?.pendingId!=null)) return; this.isPaused = isPaused; if(isPaused)this.callbacks.onSound('pause'); this.clearInput(); this.accumulator = 0; }
  requestPause() { if (!this.isPaused) { this.pause(true); this.callbacks.onPause(); } }
  returnToSafety() {
    if (this.isPaused || this.survival.phase !== 'alive') return;
    this.hurt(true);
  }
  selectCharacter(id) {
    if (!CHARACTERS[id] || !this.isPaused || this.elapsed > 0) return false;
    this.survival = newSurvival(id); this.publish(); return true;
  }
  configureStarter(build, difficulty, locked) {
    if(!this.isPaused||this.elapsed>0||this.isCompleted)return false;
    const adventure=starterAdventure(this.seed,build);
    if(!adventure)return false;
    this.adventure=adventure;this.applyRoomRules(difficulty,locked);this.players.forEach(p=>{p.weaponShots={};});this.publish();return true;
  }
  equipAttack(slot, id) {
    if (!this.isPaused || this.survival.phase !== 'alive' || this.isCompleted
        || this.journey.pending || this.combatLoot.pendingId !== null) return false;
    if (!bindAttack(this.adventure, slot, id)) return false;
    this.publish();
    return true;
  }
  openLifeLoot(enemyId) {
    if(this.isPaused||this.isCompleted||this.survival.phase!=='alive'||this.journey.pending||nearbyLoot(this.combatLoot,this.world,this.players[0])?.enemyId!==enemyId)return false;
    this.combatLoot.pendingId=enemyId;this.pause(true);this.publish();this.callbacks.onLifeLoot?.();return true;
  }
  updateLifeLoot() {
    if(this.isPaused||this.isCompleted||this.survival.phase!=='alive'||this.journey?.pending)return false;
    const player=this.players[0];
    for(const drop of this.combatLoot?.drops || [])if(drop.isDeferred) {
      const point=lootPosition(this.world,drop);
      if(Math.hypot(point.x-player.x,point.y-player.y-1)>=3.5)delete drop.isDeferred;
    }
    const drop=nearbyLoot(this.combatLoot,this.world,player);
    return drop?this.openLifeLoot(drop.enemyId):false;
  }
  chooseLifeLoot(enemyId,id) {
    if(!this.isPaused||!chooseLifeLoot(this.combatLoot,this.adventure,this.survival,enemyId,id))return false;
    this.skillEffects.burst(this.players[0].x,this.players[0].y+1,this.elapsed,true);
    this.callbacks.onSound('skill');this.publish(`已领取${LIFE_CHOICES[id].name}！`);return true;
  }
  leaveLifeLoot(enemyId) {
    if(!this.isPaused||this.combatLoot.pendingId!==enemyId)return false;
    this.combatLoot.drops.find(drop=>drop.enemyId===enemyId).isDeferred=true;
    this.combatLoot.pendingId=null;this.publish();return true;
  }
  applyRoomRules(difficulty, locked) {
    this.adventure.ruleset = 9;
    this.adventure.difficulty ||= DIFFICULTIES[difficulty] ? difficulty : DEFAULT_DIFFICULTY;
    if (locked) this.adventure.locked = [...locked];
    this.difficulty = difficultyOf(this.adventure.difficulty);
    applyCycleHealth(this.world, this.adventure.cycle);
    this.world.warningBonus = this.difficulty.warning;
    // 轻松档小怪的节拍放慢一成半，出手前的预告跟着变长。
    for (const enemy of this.world.enemies) if (!enemy.isBoss) { enemy.basePeriod ??= enemy.period; enemy.period = enemy.basePeriod * (this.difficulty.warning ? 1.15 : 1); }
  }
  roomBounds() {
    const room = currentRoom(this.world, this.roomState);
    const player = this.players[0];
    const activeCave = caveForPlayer(room, player);
    if (activeCave) return { minX: activeCave.left, maxX: activeCave.right, minY: activeCave.floorY - 4 };
    const cave = room.traversal?.cave;
    const barrier = encounterBarrier(this.world, this.roomState, this.difficulty.isExtraWave);
    // 每间房有自己的掉落线：最低的平台再往下 6。
    const bounds = { minX: room.left + 0.3, maxX: barrier ? barrier.x - 1 : room.right - 0.3, minY: room.fallY };
    if (cave?.ridgeX !== undefined) {
      if (player.x < cave.ridgeX) bounds.maxX = Math.min(bounds.maxX, cave.ridgeX - 1.35);
      else bounds.minX = cave.ridgeX + 1.35;
    }
    for (const ridge of room.traversal?.ridges || []) {
      if (player.x <= ridge.x + .1 && player.y < ridge.y) bounds.maxX = Math.min(bounds.maxX, ridge.x);
    }
    return bounds;
  }
  canInteract() {
    const player = this.players[0];
    return !!(stallAt(this.world, this.roomState, player) || caveMouthAt(currentRoom(this.world, this.roomState), player));
  }
  cameraTarget() {
    const averageX = this.players.reduce((sum, player) => sum + player.x, 0) / this.players.length;
    const averageY = this.players.reduce((sum, player) => sum + player.y, 0) / this.players.length;
    const boss=currentBoss(this.world);
    if (boss) { const arena=this.world.bossArenas[boss.arenaId]; return { x: (arena.left+arena.right)/2, y: arena.y+4.5 }; }
    // 镜头锁在当前房间里。房间比画面窄就居中，不让别的房间露出来。
    const room = currentRoom(this.world, this.roomState), min = room.left + this.camera.right - 3, max = room.right - this.camera.right + 3;
    const cave = caveForPlayer(room, this.players[0]);
    if (cave) {
      const { left, right, floorY } = cave;
      const reach = this.camera.right * .72;
      return { x: right - left < reach * 2 ? (left + right) / 2 : Math.max(left + reach, Math.min(right - reach, averageX)), y: Math.max(floorY, averageY) + 2.3 };
    }
    if (this.world.valley && room.id === 0) {
      // 水槽、根和池面需要同时可见，入口上方的回渠随人物升高再进入视野。
      const lookAhead = Math.min(7, this.camera.right * .38);
      const facing = this.world.valley.layout === 'aqueduct' && averageY > 10 ? -1 : 1;
      return { x: Math.max(min, Math.min(max, averageX + facing * lookAhead)), y: averageY + 1 };
    }
    const frame = room.frames?.find(f => Math.abs(f.x-averageX)<f.width*.48 && Math.abs(f.y-averageY)<12);
    if (frame) return {x:frame.x+(averageX-frame.x)*.25,y:frame.y+.35+(averageY-frame.y)*.15};
    if (this.world.expedition && this.level.id==='snow' && room.runs?.length) {
      return {x:Math.max(min,Math.min(max,averageX + Math.min(10,this.camera.right*.43))),y:averageY+2.4};
    }
    const x = min > max ? (room.left + room.right) / 2 : Math.max(min, Math.min(max, averageX + Math.min(5, this.camera.right * 0.25)));
    // 往上爬的房间多看一点头顶，往下跳的房间多看一点脚下。
    const isAscending = room.traversal?.ridges && averageX < room.traversal.practiceUntilX;
    const lift = isAscending ? 5.6 : room.look === 'up' ? 5 : room.look === 'down' ? 0.5 : 4;
    return { x, y: averageY + (this.journey.pending ? -4 : lift) };
  }
  snapCamera() { const target = this.cameraTarget(); this.cameraX = target.x; this.cameraY = target.y; }
  stepRooms(player, powers) {
    const state = this.roomState, world = this.world, room = currentRoom(world, state);
    if (world.field) {
      const stop = stepField(world,state,player,this.elapsed);
      if (stop) {
        this.callbacks.onSound(stop.sound || 'checkpoint');
        this.publish(stop.received || stop.label + ' ✓');
        this.callbacks.onLifeChange?.(this.snapshot());
      }
    }
    if (world.expedition) {
      const message=advanceStory(world,state,player,this.elapsed);
      if (message) {
        syncStory(world,state,this.elapsed);
        const marked = state.story.marks;
        const rang = room.stations?.some(s => s.icon === 'clock-golden-bell' && marked[s.key] === this.elapsed);
        const broke = room.runs?.some(b => marked[b.wall] === this.elapsed || b.secret && marked[b.secret] === this.elapsed);
        this.callbacks.onSound(rang ? 'tower-chime' : broke ? 'snow-crack' : 'checkpoint');
        this.publish(message);
        this.callbacks.onLifeChange?.(this.snapshot());
      }
    }
    if (world.valley && room.id === 0) {
      const channel = waterUnderfoot(world, state.water, player, this.elapsed);
      syncWaterRoutes(world, state.water, this.elapsed);
      if (channel) {
        this.callbacks.onSound('flower');
        this.publish(WATER_NOTICES[channel]);
        this.callbacks.onLifeChange?.(this.snapshot());
      }
    }
    if (world.forest) {
      const event = stepForestRescue(world, state.forest, player);
      if (event) {
        this.callbacks.onSound(event.sound);
        this.publish(event.message);
        this.callbacks.onLifeChange?.(this.snapshot());
      }
      const rewardId = 'nest:' + this.levelKey;
      if ((state.forest.crown === HOME || state.forest.roots === HOME) && !this.journey.claimed.includes(rewardId) && !this.journey.pending) {
        openRoomReward(this.adventure, this.journey, this.survival, rewardId, 'door-upgrade', 'nature', this.difficulty.rarityBonus);
        this.pause(true); this.publish(); this.callbacks.onReward?.();
        return;
      }
      const branch = player.safe?.isCave ? 'roots' : 'crown';
      const perch = world.platforms[world.forest.trails[branch].at(-1).platformId];
      const nearNest = !player.safe?.isCave && Math.hypot(player.x, player.y) < 10;
      if (state.forest[branch] < FOLLOWING && (nearNest || Math.hypot(player.x - perch.x, player.y - perch.y) < 18) && this.elapsed >= (this.nextOwlCall || 0)) {
        this.callbacks.onSound('owl-call'); this.nextOwlCall = this.elapsed + 8;
      }
    }
    for (const id of room.enemyIds) {
      const enemy = world.enemies[id - 1];
      if (enemy.trait !== 'shield' || enemy.isDefeated || enemy.isDormant) continue;
      // 带盾的精英：盾被打掉 6 秒后再长出来。
      if (enemy.hasShell) enemy.shellAt = undefined;
      else if ((enemy.shellAt ??= this.elapsed + 6) <= this.elapsed) enemy.hasShell = true;
    }
    for (const event of stepRoom(world, state, player, STEP, this.difficulty.isExtraWave)) {
      if (event.type === 'wave') {
        for (const enemy of world.enemies) if (enemy.roomId === room.id && enemy.wave === event.wave) this.skillEffects.burst(enemy.x, enemy.y + 1, this.elapsed, true);
        this.callbacks.onSound('boss-warning'); this.publish(`第 ${event.wave + 1} 波来了，一共 ${event.total} 波！`);
      }
      if (event.type === 'puzzle') {
        this.callbacks.onSound(event.isRight ? 'flower' : 'block');
        if (!event.isRight) this.publish(room.puzzle.kind === 'tiles' ? '顺序不对，从第一块重新踩。' : '这两张不一样，再找找。');
      }
      if (event.type === 'drop') this.takeDrop(event.kind, player);
      if (event.type === 'clear') this.clearRoom(room, event.stars, powers);
    }
    // 选卡的奖励晚一点点弹出来，让最后一只怪的效果放完；存档恢复后没领的也在这里补上。
    const rewardId = `room:${this.levelKey}:${room.id}`;
    const isChoiceWaiting = isRoomCleared(state) && !!DOOR_REWARDS[room.reward]?.isChoice && !this.journey.claimed.includes(rewardId);
    if (isChoiceWaiting && !this.journey.pending && this.elapsed >= this.rewardAt) {
      openRoomReward(this.adventure, this.journey, this.survival, rewardId, room.kind === 'elite' ? 'elite' : `door-${room.reward}`, 'power', this.difficulty.rarityBonus);
      this.pause(true); this.publish(); this.callbacks.onReward?.();
    }
    // 奖励还没领就不能进门。领完之后，跳到发光的门上就进去，不用再按上。
    const wasInteracting = this.isInteracting;
    this.isInteracting = false;
    if (!isChoiceWaiting && !this.journey.pending) {
      const door = doorAt(this.world, state, player);
      if (door) this.enterRoom(player, door);
    }
    if (wasInteracting && !isChoiceWaiting) this.interact(player);
  }
  clearRoom(room, stars, powers) {
    this.rewardAt = this.elapsed + 0.7;
    const nature = setLevel(this.adventure, 'nature');
    if (nature) heal(this.survival, nature * 8);
    if (powers.wreath) resourcesFor(this.adventure).wreathShield = 1;
    this.callbacks.onAlbum?.({ type: 'stars', count: stars });
    if (room.kind === 'puzzle') this.callbacks.onAlbum?.({ type: 'chest' });
    if (room.kind === 'elite') this.callbacks.onAlbum?.({ type: 'elite', themeId: this.world.themeId });
    if (room.kind === 'boss') return;
    this.callbacks.onSound('checkpoint');
    this.skillEffects.burst(this.players[0].x, this.players[0].y + 1, this.elapsed, true);
    this.publish(room.kind === 'shop' ? '小店到了，站到摊位前按上买东西。' : `这一间过关，拿到 ${stars} 颗星！门亮了，跳过去吧。`);
    this.callbacks.onLifeChange?.(this.snapshot());
  }
  takeDrop(kind, player) {
    if (kind === 'heart') this.publish(heal(this.survival, 50) ? '爱心回血 +50！' : '血是满的，爱心先收下啦。');
    if (kind === 'fragments') { resourcesFor(this.adventure).balance += 6; this.publish('捡到 6 片彩笔碎片！'); }
    if (kind === 'sticker') { this.callbacks.onAlbum?.({ type: 'gift' }); this.publish('拿到一张画册贴纸！'); }
    this.adventure.revision++;
    this.skillEffects.burst(player.x, player.y + 1, this.elapsed, true); this.callbacks.onSound('skill');
    this.callbacks.onLifeChange?.(this.snapshot());
  }
  enterRoom(player, door) {
    const room = enterDoor(this.world, this.roomState, door), start = this.platforms[room.startId];
    rescue(player, start, start.x - 2); player.recoveries--; player.protection = 1;
    this.waves = []; this.enemyShots = []; this.lure = undefined; this.checkpointId = start.id;
    this.snapCamera(); this.callbacks.onSound('checkpoint');
    this.publish(this.world.field && room.stops.length ? fieldHint(this.world,this.roomState,this.players[0],this.elapsed) : this.world.expedition && room.goals?.length ? storyHint(room,this.roomState.story) : this.world.valley ? valleyHint(this.world, this.roomState, player) : room.traversal?.name ? `${room.traversal.name}，${room.traversal.hint}` : `${ROOM_KINDS[room.kind].name}：${room.puzzle ? PUZZLES[room.puzzle.kind].hint : ROOM_KINDS[room.kind].hint}`);
    this.callbacks.onLifeChange?.(this.snapshot());
  }
  interact(player) {
    const state = this.roomState, door = doorAt(this.world, state, player), stall = stallAt(this.world, state, player);
    if (door) this.enterRoom(player, door);
    else if (stall) {
      const item = SHOP_ITEMS[stall.id];
      if (isStallSold(state, stall)) { this.publish('这个摊位卖完了。'); return; }
      const message = buyStall(this.adventure, this.survival, state, stall.id);
      if (!message) { this.callbacks.onSound('block'); this.publish(resourcesFor(this.adventure).balance < item.price ? `碎片不够，${item.name}要 ${item.price} 片。` : '现在用不上这个。'); return; }
      this.skillEffects.burst(player.x, player.y + 1, this.elapsed, true); this.callbacks.onSound('skill');
      this.publish(message); this.callbacks.onLifeChange?.(this.snapshot());
    } else {
      const mouth = caveMouthAt(currentRoom(this.world, state), player);
      if (mouth) beginCrawl(player, mouth);
    }
  }
  rerollPending(expectedId) {
    if (!this.isPaused || this.journey.pending?.id !== expectedId || !rerollReward(this.adventure, this.journey, this.survival)) return false;
    this.callbacks.onSound('skill'); this.publish(); return true;
  }
  roomSnapshot() {
    const world = this.world, state = this.roomState, room = currentRoom(world, state), player = this.players[0];
    const stall = stallAt(world, state, player), resources = resourcesFor(this.adventure);
    const caveMouth = caveMouthAt(room, player);
    const traversal = room.traversal;
    const isClimbing = !!player.grip;
    const canDescend = !!climbEntryAt(traversal, player);
    const isDroppingFromGrip = !!player.launch?.isDrop;
    const cave = caveForPlayer(room, player);
    const traversalHint = cave ? (cave.id ? '跳过石台，走到神灯下，向上出洞' : '走到神灯下，向上出洞')
      : isClimbing ? player.grip.point.isLedge ? '再跳一次，或向下加跳松手' : '上下攀爬，向下加跳松手'
      : isDroppingFromGrip ? '朝岩壁移动，或向上抓住' : canDescend ? '向下抓住岩壁' : traversal?.name ? traversal.hint : '';
    return {
      roomId: room.id, depth: room.depth, kind: room.kind, name: cave?.name || traversal?.name || room.name || ROOM_KINDS[room.kind].name, isCleared: isRoomCleared(state), trait: room.trait || null,
      fieldHint:world.field ? fieldHint(world,state,player,this.elapsed) : null,
      areaId: cave?.id, isOnLightBridge:player.ground?.skin === 'sunlight', isClimbing, canDescend, isDroppingFromGrip, traversalHint,
      ...(world.expedition && room.goals?.length ? { valleyHint:storyHint(room,state.story) } : world.valley ? { valleyHint:valleyHint(world,state,player) } : {}),
      ...(world.forest ? { forest: { ...state.forest, hint: forestHint(world, state.forest, player) } } : {}),
      ...roomProgress(world, state, this.difficulty.isExtraWave),
      layers: world.zones.map((zone, depth) => ({ kind: depth < state.path.length ? world.rooms[state.path[depth]].kind : depth === world.zones.length - 1 ? 'boss' : null, stars: state.stars[state.path[depth]] || 0 })),
      stars: starTotal(state), combo: state.combo, difficulty: this.adventure.difficulty,
      puzzle: room.puzzle ? { kind: room.puzzle.kind, ...PUZZLES[room.puzzle.kind] } : null,
      doors: world.doors.filter(item => item.roomId === room.id).map(item => ({ id: item.id })),
      prompt: stall ? (isStallSold(state, stall) ? '卖完了' : `买${SHOP_ITEMS[stall.id].name}`) : caveMouth ? caveMouth.label || (cave ? '出洞' : traversal?.cave?.name ? `进入${traversal.cave.name}` : '进洞') : '',
      sets: setCounts(this.adventure), rerolls: resources.rerolls || 0, tierUp: resources.tierUp || 0,
    };
  }
  hurt(isFall = false, amount = 10, source) {
    const powers = upgradePower(this.adventure);
    const player = this.players[0];
    const beforeLife = this.survival.hp;
    if (isFall && this.difficulty.isFallFree) {
      // 轻松档掉坑不扣血，只送回刚才站稳的地方；这间房的“没掉坑”那颗星照样没有。
      const point=revivalPoint(player,this.platforms,true);
      rescue(player,this.platforms[point.platformId],this.platforms[point.platformId].x+point.offsetX);player.protection=1;
      recordHurt(this.roomState,true,false);this.callbacks.onSound('player-hurt');this.publish('掉下去了，回到刚才站的地方。');
      return;
    }
    const isLanding = source === 'landing';
    const isFallDamage = isFall || isLanding;
    amount = isFall ? 25 : Math.max(1, Math.round(amount * this.difficulty.damage * (1 - 0.15 * setLevel(this.adventure, 'bubble'))));
    const shieldHits = isFallDamage ? null : consumeMagicShield(this.adventure, player, this.world.enemies, this.elapsed);
    for(const hit of shieldHits || [])this.recordHit(hit);
    const result = shieldHits ? 'armor' : damageWithBuild(this.adventure, this.survival, powers, this.levelKey, player.safe?.zone ?? 0, isFallDamage, amount);
    if (!result) return;
    if (['hurt','death'].includes(result)) recordHurt(this.roomState, isFall, result === 'death');
    if(['shield','armor','courage'].includes(result))for(const hit of shieldCounter(this.adventure,player,this.world.enemies,this.elapsed))this.recordHit(hit);
    const lostHp = Math.max(0, beforeLife - this.survival.hp);
    this.damageNumbers.push({id:++this.damageSequence,x:player.x,y:player.y+2.5,at:this.elapsed,damage:lostHp,isPlayer:true,blocked:['armor','shield','courage'].includes(result)?amount:0});
    if (powers.cotton) player.knockVx *= 0.25;
    if (result === 'courage') player.protection = Math.max(player.protection, 4);
    if (result === 'hurt' && powers.breeze) {
      for (const enemy of this.world.enemies) if (!enemy.isDefeated && !enemy.isDormant && Math.hypot(enemy.x-player.x, enemy.y-player.y) < 4) {
        enemy.x = Math.max(enemy.minX, Math.min(enemy.maxX, enemy.x + Math.sign(enemy.x-player.x)*2)); enemy.boundUntil = this.elapsed+0.8;
      }
    }
    if (result === 'armor' || result === 'courage') { this.talentEffect = { x:player.x, y:player.y+1, at:this.elapsed, isShield:true }; this.publish(result === 'armor' ? '小本领挡住了伤害！' : '小小勇气保护你！'); }
    if (result === 'shield') { this.talentEffect = { x:this.players[0].x, y:this.players[0].y + 1, at:this.elapsed, isShield:true }; this.publish('彩虹护盾挡住啦！'); }
    if (result === 'hurt') {
      const message = isLanding ? `高处落地，扣了 ${lostHp} 点血。` : `血量 ${this.survival.hp}/${this.survival.maxHp}，小心前方！`;
      this.publish(isLanding && !lostHp ? '落地受伤，补给帮你回了血。' : message);
    }
    if (result === 'death') { this.revival = revivalPoint(player, this.platforms, isFall); this.pause(true); this.publish(this.survival.lives ? `扣掉一条命，还剩 ${this.survival.lives} 条。` : '生命用完了，这次冒险结束。'); }
    if(isFall && result !== 'death'){const point=revivalPoint(player,this.platforms,true);rescue(player,this.platforms[point.platformId],this.platforms[point.platformId].x+point.offsetX);player.protection=1;}
    this.callbacks.onSound(result==='death'?'life-lost':['shield','armor','courage'].includes(result)?'block':'player-hurt');
    this.callbacks.onLifeChange?.(this.snapshot());
  }
  revive() {
    if (!reviveSurvival(this.survival)) return false;
    const point = this.revival || revivalPoint(this.players[0], this.platforms, true), platform = this.platforms[point.platformId];
    rescue(this.players[0], platform, platform.x + point.offsetX); this.revival = undefined; this.players[0].protection=3;
    if(this.adventure.revivalWaves){this.adventure.revivalWaves--;this.enemyShots=this.enemyShots.filter(shot=>shot.bossId||Math.hypot(shot.x-this.players[0].x,shot.y-this.players[0].y)>18);this.skillEffects.burst(this.players[0].x,this.players[0].y+1,this.elapsed,true);}
    this.clearInput(); this.publish('就在这里接着走，继续加油！');
    // 帮一把：同一间房倒下两次，起来时送一层护盾。
    if (this.roomState.downs >= 2 && getPlaySettings().isHelpOn) { (this.adventure.magic ||= newMagic()).shield = 1; this.publish('送你一层护盾，再试一次！'); }
    this.callbacks.onLifeChange?.(this.snapshot()); return true;
  }
  tick() {
    if (this.isPaused) return;
    if (this.survival.phase !== 'alive') return;
    if (this.updateLifeLoot()) return;
    this.survival.shieldRemaining = Math.max(0, this.survival.shieldRemaining - STEP);
    moveCampaignPlatforms(this.world.lifts, this.elapsed);
    stepMechanisms(this.world, this.players[0], this.elapsed, STEP);
    if (this.world.field) syncField(this.world,this.roomState,this.elapsed);
    if (this.world.expedition) syncStory(this.world,this.roomState,this.elapsed,this.players[0]);
    const nearby = item => this.players.some(p => Math.abs(item.x-p.x)<45 && Math.abs(item.y-p.y)<24);
    const activeRoom = currentRoom(this.world, this.roomState);
    const isInCave = !!this.players[0].safe?.isCave;
    const caveId = this.players[0].safe?.caveId;
    const platforms = this.platforms.filter(p => !!p.isCave === isInCave && p.caveId === caveId && nearby(p)), enemies = this.world.enemies.filter(nearby);
    const wasFlying = !!this.adventure.effects?.hotAirBalloon;
    tickResources(this.adventure, STEP); tickEffects(this.adventure, STEP);
    if (wasFlying && !this.adventure.effects.hotAirBalloon) {
      this.players[0].vy = 0;
      this.publish('热气球时间到，往平台上落吧！');
    }
    if (useRecovery(this.adventure, this.survival, upgradePower(this.adventure))) this.publish('回血 +10！');
    // 同屏主动出手的怪最多 3 只。
    const practiceEnd = activeRoom.traversal?.practiceUntilX;
    const attackRight = this.players[0].x < practiceEnd ? Math.min(practiceEnd, this.cameraX + this.camera.right) : this.cameraX + this.camera.right;
    stepAdventureEnemies(enemies, this.players, STEP, this.elapsed, this.enemyShots, {
      bounds: { left: this.cameraX-this.camera.right, right: attackRight }, maxAttackers: 3,
      allEnemies: this.world.enemies, lure: this.lure, attackGate: this.attackGate, warningBonus: this.world.warningBonus,
    });
    const previousBoss=currentBoss(this.world),previousStage=previousBoss?.attackStage;
    stepBosses(this.world,this.players[0],STEP,this.elapsed,this.enemyShots,this.adventure);
    const nextBoss=currentBoss(this.world);if(nextBoss?.attackStage==='warning'&&previousStage!=='warning')this.callbacks.onSound('boss-warning');
    const spawned = [];
    const icicles = this.waves.length ? icicleTargets(this.world, this.roomState.roomId, this.elapsed) : [];
    for (const wave of this.waves) {
      // 宽屏光刃可能越过玩家周围的物理更新范围，命中不能只检查 nearby。
      const result = stepAdventureWave(wave, this.world.enemies, platforms, STEP, this.elapsed, this.players[wave.ownerIndex ?? 0], this.enemyShots, icicles);
      if (wave.clash) {
        this.skillEffects.burst(wave.clash.x,wave.clash.y,this.elapsed,false,true);
        this.callbacks.onSound(wave.clash.isIcicle ? `${attackSource(wave)}:hit` : 'lightblade:clash');
      }
      const hits = result.hits;
      if (wave.bonusEffect && hits.some(hit => hit.damage)) {
        const target = hits.find(hit => hit.damage).enemy;
        this.skillEffects.burst(target.x, target.y + target.height / 2, this.elapsed, false, true, wave.bonusEffect);
        delete wave.bonusEffect;
      }
      const bloom = bloomAtHit(wave, hits, this.world.enemies, this.elapsed); if (bloom) this.talentEffect = bloom;
      spawned.push(...result.spawned);
      for (const hit of hits) this.recordHit({...hit,source:attackSource(wave)});
      if (wave.burst) this.skillEffects.burst(wave.burst.x, wave.burst.y, this.elapsed, false, !!currentBoss(this.world));
    }
    this.waves = [...this.waves.filter(w => w.isActive), ...spawned];
    this.players.forEach((player, index) => {
      const isSingle = this.players.length === 1;
      const left = index === 0 ? this.keys.has('KeyA') || this.hasControl('left') || isSingle && this.keys.has('ArrowLeft') : this.keys.has('ArrowLeft');
      const right = index === 0 ? this.keys.has('KeyD') || this.hasControl('right') || isSingle && this.keys.has('ArrowRight') : this.keys.has('ArrowRight');
      const manualDown = this.keys.has('KeyS') || this.keys.has('ArrowDown') || this.touch.has('drop');
      const manualUp = this.keys.has('KeyW') || this.keys.has('ArrowUp') || this.touch.has('up');
      const down = manualDown || this.hasControl('drop');
      const up = manualUp || this.hasControl('up');
      const previousY = player.y, wasGrounded = player.isGrounded;
      const wasClimbing = !!player.grip;
      const powers = upgradePower(this.adventure, index);
      const speedMultiplier = (player.inkUntil > this.elapsed ? 0.65 : 1) * (1 + (!player.isGrounded ? (powers.air || 0) * 0.05 : 0) + (player.hasteUntil > this.elapsed ? 0.12 : 0));
      const isBraking = powers.feather && !wasGrounded && !down && player.vy < -3 && (this.keys.has('Space') || this.keys.has('KeyW') || this.keys.has('ArrowUp') || this.hasControl('jump'));
      if (isBraking) player.vy = -3;
      player.fallPeak = wasGrounded || wasClimbing || isBraking || player.vy > 0 ? player.y : Math.max(player.fallPeak ?? player.y, player.y);
      const isManualHorizontal = ['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight'].some(key => this.keys.has(key)) || this.touch.has('left') || this.touch.has('right');
      const isFlying = !!powers.balloonFlight;
      let vertical = Number(up) - Number(down);
      if (isFlying) vertical = manualUp || manualDown ? Number(manualUp) - Number(manualDown) : this.gamepadVertical || 0;
      if (activeRoom.wind && !isFlying) pushInWind(activeRoom,this.roomState.field,player,STEP);
      const bounds = this.roomBounds();
      if (isFlying) bounds.maxY = nextBoss ? this.world.bossArenas[nextBoss.arenaId].y + 7 : balloonCeiling(activeRoom, player);
      const result = stepTraversal(player, { direction: isManualHorizontal ? Number(right) - Number(left) : (this.gamepadDirection || 0), vertical, speedMultiplier, isFlying, jump: this.jumps[index] && !down, drop: this.jumps[index] && down }, platforms, this.platforms, STEP, { isFiniteLife: true, ...bounds }, activeRoom.traversal);
      this.jumps[index] = false;
      if (isFlying || result.isJumped || result.isDropped || player.grip) player.fallPeak = player.y;
      if (result.isTraversed) {
        player.fallPeak = player.y;
        this.snapCamera();
        this.waves = [];
        this.enemyShots = [];
        this.callbacks.onSound('checkpoint');
        const cave = caveForPlayer(activeRoom, player);
        this.publish(this.world.forest ? forestHint(this.world, this.roomState.forest, player) : cave?.name ? `进入${cave.name}` : cave ? '进洞啦，往里找宝物。' : '出来啦，继续往前走。');
        this.callbacks.onLifeChange?.(this.snapshot());
      }
      constrainBossArena(this.world,player);
      if (result.isRescued) { this.hurt(true); return; }
      if (player.isGrounded) {
        const dropHeight = player.fallPeak - player.y;
        player.fallPeak = player.y;
        if (!wasGrounded && !wasClimbing && !result.isTraversed) {
          if (powers.safeLanding && dropHeight > 4.2) player.protection = Math.max(player.protection, 1.2);
          const damage = player.ground?.skin === 'safety-net' ? 0 : landingDamage(dropHeight);
          if (damage) {
            player.protection = Math.max(player.protection, 1);
            this.hurt(false, powers.safeLanding ? damage / 2 : damage, 'landing');
            if (this.survival.phase !== 'alive') return;
          }
        }
      }
      if (player.isGrounded && player.ground?.isCheckpoint && !player.ground.isMoving) this.checkpointId = player.ground.id;
      if (result.isJumped) this.callbacks.onSound('jump');
      if (player.safe.isCheckpoint && player.safe.progress > this.checkpoint) {
        this.checkpoint = player.safe.progress; this.callbacks.onSound('checkpoint');
      }
      if (player.ground) {
        const completed = player.ground.milestone || player.ground.zone;
        for (let n = 1; n <= completed; n++) this.visited.add(n);
      }
      if (!wasGrounded && player.isGrounded && powers.landing && this.elapsed > (player.nextLanding || 0)) {
        player.nextLanding = this.elapsed + 1.6;
        for (const hit of areaAttack(player.x, player.y + 0.8, 2.5 + powers.landing, enemies, this.elapsed, powers)) this.recordHit(hit);
        this.skillEffects.burst(player.x, player.y + 0.5, this.elapsed);
      }
      while (this.visited.has(this.furthestPlatform+1)) this.furthestPlatform++;
      this.stepPlayerAttack(player, index, powers);
      for (const hazard of this.world.hazards) if (touchingHazard(player,hazard,this.elapsed)) { player.protection=1; this.hurt(false,15); if(this.survival.phase!=='alive')return; }
      const supply = takeRoomSupply(this.world,this.claimedSupplies,player,this.survival,this.adventure,powers);
      if (supply) {
        this.supplyViews.get(supply.id).visible = false;
        this.skillEffects.burst(supply.x,supply.y,this.elapsed,true);
        if (supply.kind === 'hotAirBalloon') this.callbacks.onSound('skill');
        this.publish({ hotAirBalloon: '坐上热气球啦！上下左右飞，松开就停。', medkit: '回血 +25！', life: '血瓶 +1 条命！' }[supply.kind]);
        this.callbacks.onLifeChange?.(this.snapshot());
      }
      for (const sw of this.world.switches) if (!sw.isOpen && player.ground?.id === sw.platformId && Math.abs(player.x-sw.x)<1) {
        sw.isOpen=true; this.platforms[sw.bridgeId].isEnabled=true; this.publish('星星亮了，小桥打开啦！');
      }
      for (const spring of this.world.springs) if (!isFlying && touchSpring(player, spring)) {
        this.springViews.get(spring).userData.pressedAt=this.elapsed;
        this.callbacks.onSound('jump'); this.publish('弹簧花送你跳高高！');
      }
      for (const enemy of enemies.filter(e => !e.isDormant)) {
        const contact = touchEnemy(player, enemy, previousY, this.elapsed);
        if (contact === 'stomp' || contact === 'hit') { this.recordHit({enemy,isDefeated:contact==='stomp',damage:enemy.lastDamage,blocked:enemy.lastBlocked});this.callbacks.onSound('hit'); }
        if (contact === 'bump') { player.protection += (powers.shield || 0); this.hurt(false, (enemy.isBoss?20:enemy.touchDamage || (enemy.behavior==='charge'?15:10)) * cycleModifiers(this.adventure.cycle).damage); if (this.survival.phase !== 'alive') return; }
      }
      if (powers.cleanse && !resourcesFor(this.adventure).cleanseCooldown) {
        const nearbyShots = this.enemyShots.filter(shot => shot.isActive && Math.hypot(shot.x-player.x, shot.y-player.y-0.8) < 4).slice(0,3);
        if (nearbyShots.length) { nearbyShots.forEach(shot => { shot.isActive = false; }); this.adventure.resources.cleanseCooldown = 8; this.talentEffect = { x:player.x, y:player.y+1, at:this.elapsed, isShield:true }; }
      }
      for (const shot of this.enemyShots) if (shot.isActive && Math.abs(shot.x-player.x) < 0.9 && (['ink','vine','shock'].includes(shot.kind) ? player.y <= shot.y+0.45 && player.y+1.65 >= shot.y : Math.abs(shot.y-player.y-0.8) < 1)) {
        if (shot.kind === 'ink') { player.inkUntil = this.elapsed+0.6; continue; }
        if (player.protection > 0) continue;
        shot.isActive = false; player.protection = 1 + (powers.shield || 0); player.knockTime = 0.2; player.knockVx = Math.sign(shot.vx) * 3;
        this.hurt(false, (shot.damage || 10) * cycleModifiers(this.adventure.cycle).damage); if (this.survival.phase !== 'alive') return;
      }
      for (const treasure of this.world.treasures.filter(nearby)) {
        const view = this.treasureViews.get(treasure.id);
        if (!view.isCollected && view.growingPlatform?.isEnabled !== false && Math.abs(player.x - treasure.x) < 0.9 + (powers.magnet || 0) * 1.4 && Math.abs(player.y + 0.9 - treasure.y) < 1.25 + (powers.magnet || 0) * 0.9) {
          view.isCollected = true; view.mesh.visible = false; this.collected++;
          this.collectedIds.push(treasure.id);
          const isGrown=collectGrowth(this.adventure,this.survival);
          const item = COLLECTIBLES[view.kind];
          this.pickups.push({ id: treasure.id, kind: view.kind, points: item.points, x: treasure.x, y: treasure.y + 1, at: this.elapsed });
          this.callbacks.onSound('flower'); this.publish(isGrown ? `成长啦！血量上限 +20，攻击 +10%！` : `找到${item.phrase}，+${item.points} 分！`);
        }
      }
      this.stepRooms(player, powers);
    });
    this.enemyShots = this.enemyShots.filter(s => s.isActive).slice(-40);
    if (this.survival.phase !== 'alive') return;
    this.distance = Math.max(this.distance, ...this.players.map(player => Math.floor(player.x)));
    const isAtFinish = this.players.some(player => player.isGrounded && player.ground?.isFinish);
    if (isAtFinish && !this.isCompleted && areBossesDefeated(this.world)) {
      this.visited = new Set(this.world.zones.map(z => z.id + 1)); this.furthestPlatform = this.world.zones.length;
      this.isCompleted = true; this.pause(true); this.callbacks.onSound('checkpoint');
      // 首领保底一张传奇。过完一章血量上限和攻击各长一点，再给 6 片碎片。
      grow(this.adventure,this.survival,'heart');grow(this.adventure,this.survival,'power');
      openRoomReward(this.adventure,this.journey,this.survival,`finish:${this.levelKey}`,'boss','power',this.difficulty.rarityBonus);
      resourcesFor(this.adventure).balance += 6 + (upgradePower(this.adventure).pocket ? 2 : 0);
      this.publish('关卡完成啦！宝物和勇气，都是你的收获。'); this.callbacks.onComplete?.(this.snapshot());
    }
  }
  stepPlayerAttack(player, index, powers) {
    const adventure = this.adventure, bindings = attackBindings(adventure), magic = adventure.magic;
    const down = [];
    ATTACK_KEYS.forEach(({ code, action }, slot) => {
      if (this.keys.has(code) || this.hasControl(action)) down.push(slot);
    });
    const canStart = !player.grip && !player.crawl && canStartAttack(player, this.elapsed, adventure, this.waves, index);
    const input = attackInput(this.attackInput, down, slot => {
      const id = bindings[slot];
      return canStart && id && (WEAPONS[id] ? this.elapsed >= (player.weaponShots?.[id] || 0) : magic.ready.includes(id) && magic.gap <= STEP);
    });
    const id = canStart && input ? bindings[input.slot] : null;
    const bounds = { left: this.cameraX - this.camera.right, right: this.cameraX + this.camera.right,
      bottom: this.cameraY - (this.camera.top || 18), top: this.cameraY + (this.camera.top || 18) };
    const result = stepMagic(adventure, this.survival, player, this.world.enemies, this.enemyShots, STEP, this.elapsed,
      bounds, { hits: this.spellHits, castId: input?.isPressed && SPELLS[id] ? id : null });
    this.spellHits = 0;
    for (const hit of result.hits) this.recordHit(hit);
    for (const effect of magic.active) this.callbacks.onSound(`${effect.id}:loop`);
    for (const event of result.events) {
      if (event.type === 'cast') player.nextAttackAt = this.elapsed + magic.gap;
      this.callbacks.onSound(`${event.id}:${event.type}`);
    }
    this.callbacks.onSound(this.waves.some(wave => wave.firingWeapon === 'flame') ? 'flame:loop' : 'flame:stop');
    if (!WEAPONS[id]) return;
    const shots = fireLoadout(player, this.elapsed, bounds, adventure, index, this.waves, id);
    if (!shots.length) return;
    const resources = resourcesFor(adventure);
    if (powers.bind && !resources.bindCooldown) {
      resources.bindCooldown = 5;
      const charge = { isUsed: false };
      for (const shot of shots) shot.bindingCharge = charge;
    }
    if (powers.lure && !resources.lureCooldown) {
      resources.lureCooldown = 8;
      this.lure = { x: player.x - player.facing * 2, y: player.y, until: this.elapsed + 3 };
      this.talentEffect = { ...this.lure, at: this.elapsed };
    }
    applyWeaponTalent(this.survival, shots);
    if (powers.companion && this.elapsed >= (player.nextCompanion || 0)) {
      player.nextCompanion = this.elapsed + 3 / powers.companion;
      shots[0].damage += 10 + 4 * powers.companion;
      shots[0].bonusEffect = 'firefly';
    }
    this.waves.push(...shots);
    this.callbacks.onSound(`${id}:fire`);
  }
  recordHit(hit) {
    if (hit.damage) {
      // 武器打中才给大招攒能量；大招自己和护盾反击不算。
      if (WEAPONS[hit.source]) this.spellHits++;
      const frost = setLevel(this.adventure, 'frost');
      if (frost && !hit.enemy.isBoss) hit.enemy.slowUntil = Math.max(hit.enemy.slowUntil || 0, this.elapsed + frost);
    }
    if(hit.damage || WEAPONS[hit.source])this.callbacks.onSound(`${hit.source || 'blade'}:${hit.isDefeated?'defeat':'hit'}`);
    if(hit.blocked)this.callbacks.onSound('block');
    if(hit.damage || hit.blocked) {
      const recent=this.damageNumbers.find(item=>item.enemyId===hit.enemy.id&&item.damage===hit.damage&&item.blocked===hit.blocked&&this.elapsed-item.at<.2);
      if(recent)recent.count++;
      else {
        const sequence=++this.damageSequence,lane=sequence%3;
        this.damageNumbers=this.damageNumbers.filter(item=>item.enemyId!==hit.enemy.id||item.lane!==lane);
        this.damageNumbers.push({id:sequence,enemyId:hit.enemy.id,lane,count:1,x:hit.enemy.x+(lane-1)*1.8,y:hit.enemy.y+hit.enemy.height+.25+(lane%2)*.7,at:this.elapsed,damage:hit.damage || 0,blocked:hit.blocked || 0,isBoss:!!hit.enemy.isBoss});
      }
    }
    if(hit.isDefeated)this.rewardEnemy(hit.enemy);
  }
  rewardEnemy(enemy) {
    if (this.defeatedIds.includes(enemy.id)) return;
    this.defeatedIds.push(enemy.id); enemy.defeatedAt=this.elapsed;
    // 普通小怪低频掉一份补给，靠近后才弹出选择；首领、分裂出来的和召唤出来的不掉。
    rollCombatLoot(this.combatLoot ||= newCombatLoot(), this.world, enemy, this.players[0]);
    if(enemy.isBoss)for(const shot of this.enemyShots)if(shot.bossId===enemy.id)shot.isActive=false;
    if (enemy.kind === 'candy' || enemy.trait === 'split') releaseCandyChildren(enemy, this.world.enemies);
    if (recordCombo(this.roomState)) { resourcesFor(this.adventure).balance++; this.comboNotice = `连击 ${this.roomState.combo}，得到 1 片碎片！`; }
    if (enemy.isBoss) this.callbacks.onAlbum?.({ type: 'boss', themeId: this.world.themeId });
    else if (!enemy.parentId) this.callbacks.onAlbum?.({ type: 'kill', kind: enemy.kind });
    const powers = upgradePower(this.adventure);
    const reward = recordDefeat(this.adventure, this.survival, powers, enemy, this.levelKey);
    if (reward?.message) this.recoveryNotice = reward.message;
    completeEncounter(this.adventure, powers, this.world, enemy.zone, this.levelKey);
    this.players.forEach((p, index) => { if (upgradePower(this.adventure, index).haste) p.hasteUntil = this.elapsed + 2 + upgradePower(this.adventure,index).haste; });
    const points=enemy.points+(enemy.drop?COLLECTIBLES[enemy.drop].points:0);
    this.pickups.push({id:`enemy-${enemy.id}`,kind:enemy.drop,points,x:enemy.x,y:enemy.y+2,at:this.elapsed});
    if(enemy.isBoss)this.callbacks.onSound('boss-defeat');
    this.publish(enemy.isBoss ? `${enemy.name}挑战成功！去出口领奖励。` : `打败小怪，+${points} 分！${this.comboNotice || this.recoveryNotice || ''}`); this.recoveryNotice = ''; this.comboNotice = '';
  }
  selectReward(index, expectedId, expectedPlayer) {
    if (this.survival?.phase && this.survival.phase !== 'alive' || !this.isPaused || this.journey.pending?.id !== expectedId || this.journey.pending?.player !== expectedPlayer) return false;
    if (!chooseReward(this.adventure, this.journey, index, this.survival)) return false;
    this.players.forEach(p => this.skillEffects.burst(p.x, p.y + 1, this.elapsed, true));
    this.callbacks.onSound('skill'); this.publish(); return true;
  }
  recyclePending(expectedId, expectedPlayer) {
    if (!this.isPaused || this.survival.phase !== 'alive' || this.journey.pending?.id !== expectedId || this.journey.pending?.player !== expectedPlayer) return false;
    if (!recycleReward(this.adventure, this.journey)) return false;
    this.publish('奖励换成彩笔碎片了！'); return true;
  }
  exportAdventure() { return structuredClone(this.adventure); }
  exportState() {
    return {projectiles:saveProjectiles(this.waves,this.enemyShots),combatLoot:structuredClone(this.combatLoot || newCombatLoot()),supplies:[...(this.claimedSupplies || [])],mechanisms:mechanismSave(this.world),survival:structuredClone(this.survival),checkpointId:this.checkpointId,revival:this.revival ? {...this.revival} : undefined,isCompleted:this.isCompleted,version:this.world.version,lure:this.lure,seed:this.seed,levelId:(this.stage || this.level).id,elapsed:this.elapsed,collectedIds:this.collectedIds,defeatedIds:this.defeatedIds,
      adventure: structuredClone(this.adventure), journey: structuredClone(this.journey), rooms: structuredClone(this.roomState),
      visited:[...this.visited],switches:this.world.switches.filter(s=>s.isOpen).map(s=>s.id),
      brokenIcicles: this.world.hazards.filter(hazard => hazard.isBroken).map(hazard => hazard.id),
      enemies:this.world.enemies.map(saveEnemy),
      players:this.players.map(p=>({safeId:p.safe.id,safeX:p.safeX,recoveries:p.recoveries,facing:p.facing,protection:p.protection,shotRemaining:Math.max(0,(p.nextShot || 0)-this.elapsed),inkRemaining:Math.max(0,(p.inkUntil || 0)-this.elapsed),
        ...(this.adventure.effects?.hotAirBalloon && !p.isGrounded && !p.crawl && this.survival.phase === 'alive' ? { balloonPosition: { x: p.x, y: p.y } } : {}),
        ...(this.world.field && p.isGrounded && p.ground?.isMoving ? {ride:{id:p.ground.id,offset:p.x-p.ground.x}} : {}),
        attackRemaining: Math.max(0, (p.nextAttackAt || 0) - this.elapsed),
        companionRemaining: Math.max(0, (p.nextCompanion || 0) - this.elapsed),
        weaponCycles:{...p.weaponCycles},weaponShots:Object.fromEntries(Object.entries(p.weaponShots || {}).map(([id,value])=>[id,Math.max(0,value-this.elapsed)]))}))};
  }
  restoreState(state) {
    if (state.version!==this.world.version || state.seed!==this.seed || state.levelId!==(this.stage || this.level).id) throw new Error('存档地图不一致');
    this.adventure = migrateAdventure(structuredClone(state.adventure)); this.journey = structuredClone(state.journey); resourcesFor(this.adventure); this.lure = state.lure;
    this.roomState = structuredClone(state.rooms);
    if (this.world.field) syncField(this.world,this.roomState,state.elapsed);
    if (this.world.valley) syncWaterRoutes(this.world, this.roomState.water, state.elapsed);
    if (this.world.expedition) syncStory(this.world,this.roomState,state.elapsed);
    if (this.world.forest) syncForestRoutes(this.world, this.roomState.forest);
    this.applyRoomRules();
    this.survival = migrateSurvival(state.survival || newSurvival()); this.checkpointId = state.checkpointId ?? state.players[0].safeId;
    this.revival = state.revival ? {...state.revival} : undefined;
    this.isCompleted=!!state.isCompleted;
    this.combatLoot=structuredClone(state.combatLoot || newCombatLoot());
    this.claimedSupplies=[...(state.supplies || [])];restoreMechanisms(this.world,state.mechanisms,state.elapsed);
    const brokenIcicles = new Set(state.brokenIcicles);
    for (const hazard of this.world.hazards) {
      if (hazard.kind === 'icicle') hazard.isBroken = brokenIcicles.has(hazard.id);
    }
    for(const id of this.claimedSupplies)if(this.supplyViews?.has(id))this.supplyViews.get(id).visible=false;
    Object.assign(this,restoreProjectiles(state.projectiles));
    this.enemyShots=this.shots;delete this.shots;
    this.elapsed=state.elapsed; this.collectedIds=[...state.collectedIds];this.collected=this.collectedIds.length;this.defeatedIds=[...state.defeatedIds];this.visited=new Set(state.visited);
    this.attackInput = { down: [] };
    this.furthestPlatform=0;while(this.visited.has(this.furthestPlatform+1))this.furthestPlatform++;
    for(const id of this.collectedIds){const v=this.treasureViews.get(id);if(v){v.isCollected=true;v.mesh.visible=false;}}
    for(const saved of state.enemies) restoreEnemy(this.world.enemies[saved.id-1],saved);
    for(const id of state.switches){const sw=this.world.switches[id];sw.isOpen=true;this.platforms[sw.bridgeId].isEnabled=true;}
    moveCampaignPlatforms(this.world.lifts,this.elapsed);
    this.players.forEach((p,i)=>{
      const saved=state.players[i];
      rescue(p,this.platforms[saved.safeId],saved.safeX);p.recoveries=saved.recoveries;p.facing=saved.facing;
      if (saved.ride && this.world.field) {
        const deck=this.platforms[saved.ride.id];
        Object.assign(p,{ground:deck,x:deck.x+saved.ride.offset,y:deck.y});
      }
      if (saved.balloonPosition) {
        const { x, y } = saved.balloonPosition;
        Object.assign(p, { x, y, ground: null, isGrounded: false, coyote: 0, fallPeak: y });
      }
      if(saved.protection!==undefined)p.protection=saved.protection;
      p.nextShot=this.elapsed+(saved.shotRemaining || 0);p.inkUntil=this.elapsed+(saved.inkRemaining || 0);
      const attackRemaining = saved.attackRemaining ?? Math.max(0, ...Object.values(saved.weaponShots || {}));
      p.nextAttackAt = attackRemaining ? this.elapsed + attackRemaining : 0;
      p.nextCompanion = saved.companionRemaining ? this.elapsed + saved.companionRemaining : 0;
      p.weaponCycles={...saved.weaponCycles};p.weaponShots=Object.fromEntries(Object.entries(saved.weaponShots || {}).map(([id,value])=>[id,this.elapsed+value]));
    });
    this.cameraX = this.players.reduce((sum, p) => sum + p.x, 0) / this.players.length + Math.min(5, this.camera.right * 0.25);
    this.cameraY = this.players.reduce((sum, p) => sum + p.y, 0) / this.players.length + (this.journey.pending ? -4 : 4);
    this.snapCamera();
    this.publish('接着上次的冒险出发吧！');
  }
  snapshot() {
    this.pickups = this.pickups.filter(pickup => this.elapsed - pickup.at < 2.2);
    const pickups = this.pickups.map(pickup => {
      const position = new THREE.Vector3(pickup.x, pickup.y, 0.5).project(this.camera);
      return { id: pickup.id, kind: pickup.kind, points: pickup.points, x: (position.x + 1) * 50, y: (1 - position.y) * 50 };
    });
    const score=campaignScore(this.world,this.collectedIds,this.defeatedIds,this.isCompleted,(this.stage || this.level).bonus);
    const project = (x, y) => { const p = new THREE.Vector3(x, y, 0.5).project(this.camera); return { x: (p.x + 1) * 50, y: (1 - p.y) * 50 }; };
    const powers = upgradePower(this.adventure);
    const treasure = powers.guide ? this.world.treasures.filter(t => !this.collectedIds.includes(t.id) && Math.abs(t.x-this.players[0].x) < 35).sort((a,b) => Math.abs(a.x-this.players[0].x)-Math.abs(b.x-this.players[0].x))[0] : null;
    this.damageNumbers=this.damageNumbers.filter(hit=>this.elapsed-hit.at<1.1).slice(-24);
    const boss=bossStatus(this.world,this.elapsed);
    return { ...score, boss, bossTarget:boss?.warning?project(boss.warningX,boss.warningY):null, damageNumbers:this.damageNumbers.map(hit=>({...hit,...project(hit.x,hit.y+(this.elapsed-hit.at)*1.4)})), weaponStats:Object.fromEntries(activeWeapons(this.adventure).map(id=>[id,weaponDamage(id,this.adventure.growth?.power || 0,weaponRank(this.adventure,id))])), weaponCounts:Object.fromEntries(activeWeapons(this.adventure).map(id=>[id,weaponShotCount(id,upgradePower(this.adventure,0,id))])), activeWeapons:activeWeapons(this.adventure), timedEffects:{...this.adventure.effects}, hazards:(this.world.hazards || []).filter(h=>Math.abs(h.x-this.players[0].x)<12).map(h=>({...h,...hazardState(h,this.elapsed),...project(h.x,h.y+3)})), survival: structuredClone(this.survival), skill:this.adventure.loadouts[0].weapon, skillRevision:this.adventure.revision,
      adventure: structuredClone(this.adventure), pendingReward: this.journey.pending ? structuredClone(this.journey.pending) : null,
      busyAttack: this.adventure.magic.active[0]?.id || this.waves[0]?.firingWeapon,
      pendingLifeLoot:this.combatLoot?.pendingId??null,
      rooms: this.roomSnapshot(),
      enemyGuide: this.players[0].safe?.isCave ? null : roomEnemyGuide(this.world, this.roomState, this.players[0], project, this.difficulty.isExtraWave, { width: this.host.clientWidth, height: this.host.clientHeight }),
      guide: treasure ? { ...project(treasure.x, treasure.y), direction: treasure.x < this.players[0].x ? '左边有宝物' : '右边有宝物' } : null,
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
      const { x: targetX, y: targetY } = this.cameraTarget();
      const smoothing = Math.min(1, delta * 4);
      this.cameraX += (targetX - this.cameraX) * smoothing; this.cameraY += (targetY - this.cameraY) * smoothing;
      this.camera.position.set(this.cameraX + 0.6, this.cameraY + 3.3, 30); this.camera.lookAt(this.cameraX, this.cameraY, 0);
      for(const drop of this.combatLoot.drops) {
        let view=this.lootViews.get(drop.enemyId);
        const point=lootPosition(this.world,drop);
        if(!view){view=this.sprite(this.lifeMaterial,point.x,point.y,1.2,1.65);this.lootViews.set(drop.enemyId,view);}
        view.visible=drop.choice===null;view.position.set(point.x,point.y+(this.isReducedMotion?0:Math.sin(this.elapsed*2.5)*.15),1);
      }
      this.backdrops.forEach(mesh => { mesh.position.x = this.cameraX; mesh.position.y=this.cameraY-(this.world.valley ? .55 : this.isNewLandscape ? 2 : 1); const aspect=mesh.material.map.image.width/mesh.material.map.image.height;const width=this.isNewLandscape ? Math.max(this.camera.right*2+1,(this.camera.top*2+1)*aspect) : Math.max(44,this.camera.right*2+8,(this.camera.top*2+8)*aspect);mesh.scale.set(width,width/aspect,1); });
      const isInCave = !!this.players[0].safe?.isCave;
      const caveId = this.players[0].safe?.caveId;
      for (const item of this.world.supplies) {
        if (item.kind !== 'hotAirBalloon') continue;
        const view = this.supplyViews.get(item.id);
        view.visible = !isInCave && this.platforms[item.platformId].roomId === this.roomState.roomId && !this.claimedSupplies.includes(item.id);
        if (view.visible && !this.isReducedMotion) view.position.y = item.y + Math.sin(this.elapsed * 2.4) * .12;
      }
      for (const mesh of this.backdrops) mesh.visible = !isInCave;
      for (const p of this.platforms) {const view=this.platformViews.get(p.id);view.position.set(p.x,p.y,0);view.rotation.z=Math.atan(p.slope || 0);if(p.collapseAt!==undefined&&this.elapsed<p.collapseAt)view.position.y+=Math.sin(this.elapsed*40)*.04;view.visible=!!p.isCave===isInCave && p.caveId===caveId && p.isEnabled!==false && Math.abs(p.x-this.cameraX)<this.camera.right+p.width/2+12 && Math.abs(p.y-this.cameraY)<this.camera.top+12;}
      this.traversalViews?.update(this.roomState.roomId, this.players[0], this.cameraX, this.cameraY, this.camera);
      for (const hazard of this.world.hazards) {
        const { group, mesh } = this.hazardViews.get(hazard.id);
        group.visible = !hazard.isBroken && Math.abs(hazard.x - this.cameraX) < this.camera.right + 6;
        if (!group.visible || hazard.kind === 'block') continue;
        const state = hazardState(hazard, this.elapsed);
        if (hazard.kind === 'pendulum') group.rotation.z = state.angle;
        else if (hazard.kind === 'icicle') {
          group.visible = state.isWarning || state.isActive;
          group.position.y = state.y;
        } else {
          mesh.scale.y = (hazard.kind === 'thorns' ? 1.35 : 2.8) * (state.isActive ? 1 : state.isWarning ? .45 : .12);
          mesh.position.y = mesh.scale.y / 2;
          mesh.material.opacity = state.isActive ? 1 : .5;
        }
        mesh.material.color.set(state.isWarning ? '#ffd367' : '#ffffff');
      }
      for (const [spring,mesh] of this.springViews) {
        if (mesh.userData.pressedAt===undefined) continue;
        const age=this.elapsed-mesh.userData.pressedAt;
        const rebound=this.isReducedMotion ? (age<.18?-.5:0) : age<.5 ? -Math.cos(age*16)*Math.exp(-age*6)*.75 : 0;
        mesh.scale.y=1.45+rebound;mesh.position.y=spring.y+.42+rebound/2;
        if(age>=.5) delete mesh.userData.pressedAt;
      }
      for (const sw of this.world.switches) {
        const pad=this.switchViews.get(sw.id);
        pad.material.color.set(sw.isOpen ? '#b6f4a2' : '#ffffff');
        pad.scale.y=sw.isOpen?.27:.55;pad.position.y=sw.y+(sw.isOpen?.04:.18);
      }
      this.skillEffects.update(this.waves,this.players,this.elapsed,this.cameraX,this.camera.right,
        [this.waves[0]?.firingWeapon || attackBindings(this.adventure).find(id => WEAPONS[id]) || 'blade']);
      this.skillEffects.updateMagic(this.adventure.magic?.active || []);
      for(const supply of this.world.supplies || [])if(supply.bossId)this.supplyViews.get(supply.id).visible=!this.claimedSupplies.includes(supply.id)&&this.world.enemies[supply.bossId-1].isDefeated;
      for (const [shot, view] of this.enemyShotViews) if (!this.enemyShots.includes(shot)) { this.scene.remove(view); this.enemyShotViews.delete(shot); }
      for (const shot of this.enemyShots) {
        if (!this.enemyShotViews.has(shot)) this.enemyShotViews.set(shot, this.sprite(this.enemyShotMaterials[shot.image] || (shot.kind === 'bubble' ? this.skillEffects.materials.bubble : this.starMaterial), shot.x, shot.y, shot.size || .7, shot.size || .7, 1.5));
        const view=this.enemyShotViews.get(shot);view.position.set(shot.x,shot.y,1.5);
        if(shot.bossId&&!this.isReducedMotion)view.rotation.z=shot.kind==='vine'?Math.sin(shot.age*12)*.1:shot.age*3;
      }
      this.players.forEach((player, index) => {
        const mesh = this.playerViews[index], size = CHARACTERS[this.survival.character].height;
        if (this.adventure.effects?.hotAirBalloon && !player.crawl) {
          const height = size * 2.6;
          this.ridingBalloon ??= this.sprite(this.balloonMaterial, player.x, player.y, 1, 1, .82);
          this.ridingBalloon.visible = true;
          this.ridingBalloon.scale.set(height * 2 / 3, height, 1);
          this.ridingBalloon.position.set(player.x, player.y + height / 2 - .15, .82);
          this.ridingBalloon.rotation.z = this.isReducedMotion ? 0 : Math.sin(this.elapsed * 2) * .012 - player.vx * .006;
        } else if (this.ridingBalloon) this.ridingBalloon.visible = false;
        const poseName = player.crawl ? 'crawl' : player.grip ? 'climb' : null;
        const pose = poseName && this.traversalMaterials[`${this.survival.character}-${poseName}`];
        const height = size * (player.crawl ? .6 : player.grip ? .93 : 1);
        const width = pose ? height * pose.map.image.width / pose.map.image.height : size;
        const gripOffset = player.grip && !player.grip.point.side ? width * .37 * player.facing : 0;
        mesh.position.set(player.x - gripOffset, player.y + height * (pose ? .49 : .43), 0.6 + index * 0.2);
        mesh.rotation.z = !this.isReducedMotion && !this.isPaused && player.grip && (player.grip.isMoving || player.grip.move) ? Math.sin(this.elapsed * 14) * .045 * player.facing : !this.isReducedMotion && !this.isPaused && player.isGrounded ? Math.sin(this.elapsed * 16) * Math.abs(player.vx) * 0.006 : 0;
        const isAttacking = this.elapsed < (player.attackUntil || 0);
        mesh.material=pose ?? this.characterMaterials[this.survival.character][isAttacking ? 'attack' : 'standing'];
        mesh.scale.set(width * player.facing, height, 1);
        mesh.material.opacity = player.protection > 0 ? (this.isReducedMotion ? 0.65 : 0.55 + Math.sin(this.elapsed * 16) * 0.25) : 1;
      });
      const effect = this.talentEffect;
      this.talentView.visible = !!effect && this.elapsed - effect.at < 1.4;
      if (this.talentView.visible) { this.talentView.material = effect.isShield ? this.rainbowMaterial : this.flowerMaterial; this.talentView.position.set(effect.x, effect.y, 1); this.talentView.rotation.z = Math.sin(this.elapsed * 8) * 0.2; }
      for (const enemy of this.world.enemies) {
        const mesh = this.enemyViews.get(enemy.id);
        mesh.visible = !enemy.isDormant && !enemy.isHidden && Math.abs(enemy.x-this.cameraX)<this.camera.right+3 && (!enemy.isDefeated || this.elapsed-enemy.defeatedAt<0.4);
        if(enemy.isDefeated) mesh.material=this.burstMaterial;
        mesh.material.opacity=enemy.hitUntil>this.elapsed?(enemy.isBoss?.9:.5):1;
        if (!enemy.isDefeated) mesh.material.color.set(enemy.boundUntil > this.elapsed ? '#e3b7ff' : enemy.slowUntil > this.elapsed ? '#80d6ff' : enemy.isWarning ? '#ffe47a' : '#ffffff');
        const showBar = enemy.showBar ?? (enemy.hp > 1);
        this.enemyMarkers.get(enemy.id).forEach((marker,i)=>{marker.visible=mesh.visible&&!enemy.isDefeated&&!enemy.isBoss&&(showBar || enemy.isWarning);marker.position.set(enemy.x+(i?0.25:-0.25),enemy.y+enemy.height+0.4,0.6);});
        const aspect = mesh.material.map.image.width / mesh.material.map.image.height;
        mesh.scale.set(enemy.height * aspect * enemy.direction, enemy.isDefeated ? 2 : enemy.height * (!enemy.isBoss && showBar ? 1.15 : 1), 1);
        if(enemy.isBoss&&!enemy.isDefeated&&!this.isReducedMotion) {
          const cast=enemy.attackStage==='attack',warning=enemy.attackStage==='warning';
          mesh.rotation.z=warning?Math.sin(enemy.attackTime*16)*.035:cast?-enemy.direction*.1:Math.sin(enemy.elapsed*6)*.025;
          mesh.scale.y*=cast?1+Math.sin(Math.min(1,enemy.attackTime/.45)*Math.PI)*.08:1;
        }
        mesh.position.set(enemy.x, enemy.y + (enemy.isDefeated ? 0.12 : enemy.height / 2), enemy.isBoss?1:0.5);
      }
      this.roomViews?.update();
      for (const view of this.treasureViews.values()) { view.mesh.visible=!view.isCollected && view.growingPlatform?.isEnabled !== false && Math.abs(view.mesh.position.x-this.cameraX)<this.camera.right+3; if (!this.isReducedMotion && view.mesh.visible) view.mesh.rotation.z = Math.sin(this.elapsed * 2 + view.mesh.position.x) * 0.08; }
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
