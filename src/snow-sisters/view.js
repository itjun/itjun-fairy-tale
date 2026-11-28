// Three.js 4:3 正交彩笔舞台渲染器：绘制 50 层地形、斜坡、角色/怪物/雪球动画、Boss 战、尖刺天花板、道具与飘字。

import * as THREE from 'three';
import { WALL_LEFT, WALL_RIGHT, WORLD_THEMES, getFloor } from './floors.js';

const BASE = './snow-sisters/';

// 画质：默认「最高」（像素比最高 3、全部特效）；「标准」只在个别机器掉帧时手动降档，从不自动降。
export const QUALITY_KEY = 'garden-snow-sisters-quality';
export function readQuality() {
  try {
    return localStorage.getItem(QUALITY_KEY) === 'standard' ? 'standard' : 'high';
  } catch {
    return 'high';
  }
}
export function writeQuality(q) {
  try {
    localStorage.setItem(QUALITY_KEY, q === 'standard' ? 'standard' : 'high');
  } catch {
    /* 存储不可用时只在本次生效 */
  }
}

// 画布贴图按 4 倍像素绘制（逻辑尺寸不变），放大到大屏仍然清晰。
const CANVAS_SCALE = 4;
function makeCanvasTex(width, height, paint) {
  const c = document.createElement('canvas');
  c.width = width * CANVAS_SCALE;
  c.height = height * CANVAS_SCALE;
  const ctx = c.getContext('2d');
  ctx.scale(CANVAS_SCALE, CANVAS_SCALE);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  paint(ctx, width, height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export async function createSnowView(host, onResize) {
  let quality = readQuality();
  const reduceMotionQuery = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
  });
  const pixelRatio = () => Math.min(window.devicePixelRatio || 1, quality === 'high' ? 3 : 1.5);
  renderer.setPixelRatio(pixelRatio());
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-label', '小雪人姐妹彩笔冒险战场');
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, 256, 240, 0, 0.1, 20);
  camera.position.z = 5;

  const plane = new THREE.PlaneGeometry(1, 1);
  const loader = new THREE.TextureLoader();
  const textures = new Set();
  const materials = new Map();
  const popupKeys = [];
  const meshes = [];

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  function own(tex) {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    textures.add(tex);
    return tex;
  }
  // 带透明边的彩笔图：上传时预乘 alpha，避免缩小或各向异性过滤时边缘发黑。
  const withAlpha = (tex) => {
    tex.premultiplyAlpha = true;
    return tex;
  };

  function material(key, tex, transparent = true, extra = {}) {
    const m = new THREE.MeshBasicMaterial({
      map: tex,
      transparent,
      depthWrite: false,
      depthTest: false,
      premultipliedAlpha: Boolean(tex.premultiplyAlpha),
      ...extra,
    });
    materials.set(key, m);
    return m;
  }

  // 图集按格取样；每格四周收进 0.3%，高倍缩小时 mipmap 不会串到相邻格子的颜色。
  const CELL_INSET = 0.003;
  function tileAtlas(prefix, tex, cols, rows) {
    for (let i = 0; i < cols * rows; i++) {
      const tile = own(tex.clone());
      const u = 1 / cols;
      const v = 1 / rows;
      tile.repeat.set(u * (1 - 2 * CELL_INSET), v * (1 - 2 * CELL_INSET));
      tile.offset.set((i % cols) * u + u * CELL_INSET, (rows - 1 - Math.floor(i / cols)) * v + v * CELL_INSET);
      tile.needsUpdate = true;
      material(prefix + i, tile, true);
    }
  }

  // 同一贴图的半透明版本，供粒子淡出使用（按 6 档量化，避免材质无限增长）。
  function fadedKey(key, alpha) {
    const level = Math.max(1, Math.min(6, Math.round(alpha * 6)));
    if (level >= 6) return key;
    const fk = `${key}@${level}`;
    if (!materials.has(fk)) {
      const base = materials.get(key);
      if (!base) return key;
      materials.set(
        fk,
        new THREE.MeshBasicMaterial({
          map: base.map,
          transparent: true,
          depthWrite: false,
          depthTest: false,
          premultipliedAlpha: base.premultipliedAlpha,
          blending: base.blending,
          opacity: level / 6,
        }),
      );
    }
    return fk;
  }

  let used = 0;
  function draw(key, x, y, width, height = width, rotation = 0) {
    const mat = materials.get(key);
    if (!mat) return null;
    let mesh = meshes[used];
    if (!mesh) {
      mesh = new THREE.Mesh(plane, mat);
      scene.add(mesh);
      meshes.push(mesh);
    }
    mesh.material = mat;
    mesh.position.set(x, 240 - y, 0);
    mesh.scale.set(width, height, 1);
    mesh.rotation.z = -rotation;
    mesh.renderOrder = used++;
    mesh.visible = true;
    return mesh;
  }

  function drawLine(key, x1, y1, x2, y2, thickness) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    draw(
      key,
      (x1 + x2) / 2,
      (y1 + y2) / 2,
      Math.hypot(dx, dy) + thickness * 0.4,
      thickness,
      Math.atan2(dy, dx),
    );
  }

  function popupMaterial(text, color) {
    const key = `pop:${text}:${color}`;
    if (!materials.has(key)) {
      if (popupKeys.length > 40) {
        const old = popupKeys.shift();
        const om = materials.get(old);
        if (om) {
          om.map?.dispose();
          om.dispose();
          materials.delete(old);
        }
      }
      const tex = makeCanvasTex(192, 48, (g) => {
        g.font = 'bold 28px "LXGW WenKai", "PingFang SC", sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.lineWidth = 7;
        g.strokeStyle = '#152038';
        g.strokeText(text, 96, 24);
        g.fillStyle = color;
        g.fillText(text, 96, 24);
      });
      textures.add(tex);
      material(key, tex, true);
      popupKeys.push(key);
    }
    return key;
  }

  // 平台：彩笔雪顶冰台按宽度平铺，同一宽度档共用一份材质。
  let bankBase = null;
  const BANK_TILE_WIDTH = 36; // 9 格高时贴图的原始宽度（4∶1）
  function bankKeyOf(width) {
    const repeat = Math.max(1, Math.round((width / BANK_TILE_WIDTH) * 4) / 4);
    const key = 'bank' + repeat;
    if (!materials.has(key)) {
      const tex = bankBase.clone();
      tex.wrapS = THREE.RepeatWrapping;
      tex.repeat.set(repeat, 1);
      tex.needsUpdate = true;
      material(key, own(tex), true);
    }
    return key;
  }

  // 墙：16 × 16 世界单位一块，宽高按半块取整，同一尺寸共用一份材质。
  let wallBase = [];
  function wallKeyOf(themeId, width, height) {
    const rx = Math.max(0.5, Math.round((width / 16) * 2) / 2);
    const ry = Math.max(0.5, Math.round((height / 16) * 2) / 2);
    const key = `wall${themeId}:${rx}x${ry}`;
    if (!materials.has(key)) {
      const tex = wallBase[themeId - 1].clone();
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(rx, ry);
      tex.needsUpdate = true;
      material(key, own(tex), true);
    }
    return key;
  }

  let observer;
  function dispose() {
    observer?.disconnect();
    for (const m of materials.values()) m.dispose();
    for (const t of textures) t.dispose();
    plane.dispose();
    renderer.domElement.remove();
    renderer.dispose();
    renderer.forceContextLoss();
  }

  try {
    const [chars, enemies, bosses, items, titleImg, endingImg, bankImg, ...fields] = await Promise.all([
      loader.loadAsync(BASE + 'characters.webp').then(withAlpha).then(own),
      loader.loadAsync(BASE + 'enemies.webp').then(withAlpha).then(own),
      loader.loadAsync(BASE + 'bosses.webp').then(withAlpha).then(own),
      loader.loadAsync(BASE + 'items.webp').then(withAlpha).then(own),
      loader.loadAsync(BASE + 'title.webp').then(own),
      loader.loadAsync(BASE + 'ending.webp').then(own),
      loader.loadAsync(BASE + 'platform-bank.webp').then(withAlpha).then(own),
      ...Array.from({ length: 5 }, (_, i) => loader.loadAsync(BASE + 'field-' + (i + 1) + '.webp').then(own)),
    ]);

    tileAtlas('p', chars, 5, 4);
    tileAtlas('e', enemies, 5, 4);
    tileAtlas('b', bosses, 4, 4);
    tileAtlas('i', items, 5, 4);

    material('titleBg', titleImg, false);
    material('endingBg', endingImg, false);
    fields.forEach((tex, i) => material('field' + (i + 1), tex, false));
    bankBase = bankImg;

    // 五个世界的彩笔砖墙：小块纹理，按墙的尺寸重复铺开。
    wallBase = await Promise.all(
      WORLD_THEMES.map((wt) => loader.loadAsync(BASE + 'wall-' + wt.id + '.webp').then(own)),
    );

    // 雪球包裹渐冻半透明雪堆与特效贴图
    material(
      'frost',
      own(
        makeCanvasTex(64, 64, (g) => {
          g.fillStyle = 'rgba(232, 248, 255, 0.78)';
          g.strokeStyle = '#152038';
          g.lineWidth = 5;
          g.beginPath();
          g.arc(32, 32, 26, 0, Math.PI * 2);
          g.fill();
          g.stroke();
        }),
      ),
      true,
    );
    material(
      'hurtRing',
      own(
        makeCanvasTex(64, 64, (g) => {
          g.strokeStyle = '#ffe566';
          g.lineWidth = 6;
          g.beginPath();
          g.arc(32, 32, 26, 0, Math.PI * 2);
          g.stroke();
        }),
      ),
      true,
    );
    material(
      'shuriken',
      own(
        makeCanvasTex(48, 48, (g) => {
          g.fillStyle = '#212b45';
          g.strokeStyle = '#d4e8ff';
          g.lineWidth = 3;
          g.beginPath();
          g.moveTo(24, 4);
          g.lineTo(30, 18);
          g.lineTo(44, 24);
          g.lineTo(30, 30);
          g.lineTo(24, 44);
          g.lineTo(18, 30);
          g.lineTo(4, 24);
          g.lineTo(18, 18);
          g.closePath();
          g.fill();
          g.stroke();
        }),
      ),
      true,
    );
    material(
      'orb',
      own(
        makeCanvasTex(48, 48, (g) => {
          g.fillStyle = '#ff6d38';
          g.strokeStyle = '#fff2a6';
          g.lineWidth = 4;
          g.beginPath();
          g.arc(24, 24, 15, 0, Math.PI * 2);
          g.fill();
          g.stroke();
        }),
      ),
      true,
    );
    material(
      'warpGlow',
      own(
        makeCanvasTex(64, 64, (g) => {
          g.strokeStyle = '#ff98eb';
          g.lineWidth = 6;
          g.beginPath();
          g.arc(32, 32, 26, 0, Math.PI * 2);
          g.stroke();
        }),
      ),
      true,
    );

    // 特效贴图：脚下软阴影、雪团、彩笔雪花、金色星星与加色光晕。
    const radial = (w, h, stops) =>
      makeCanvasTex(w, h, (g) => {
        g.translate(w / 2, h / 2);
        g.scale(1, h / w);
        const grad = g.createRadialGradient(0, 0, 0, 0, 0, w / 2);
        for (const [at, color] of stops) grad.addColorStop(at, color);
        g.fillStyle = grad;
        g.fillRect(-w / 2, -w / 2, w, w);
      });
    material('shadow', own(radial(64, 32, [[0, 'rgba(18,28,58,0.55)'], [0.6, 'rgba(18,28,58,0.28)'], [1, 'rgba(18,28,58,0)']])), true);
    material('puff', own(radial(48, 48, [[0, 'rgba(255,255,255,0.95)'], [0.55, 'rgba(236,247,255,0.7)'], [1, 'rgba(236,247,255,0)']])), true);
    for (const [name, rgb] of [
      ['glowGold', '255,210,70'],
      ['glowRed', '255,80,70'],
      ['glowCyan', '90,210,255'],
      ['glowPink', '255,130,200'],
      ['glowWhite', '255,255,255'],
    ]) {
      material(name, own(radial(64, 64, [[0, `rgba(${rgb},0.85)`], [0.45, `rgba(${rgb},0.35)`], [1, `rgba(${rgb},0)`]])), true, { blending: THREE.AdditiveBlending });
    }
    material(
      'flake',
      own(
        makeCanvasTex(32, 32, (g) => {
          g.translate(16, 16);
          for (const [color, width] of [['#3b5a9a', 4.6], ['#ffffff', 2.4]]) {
            g.strokeStyle = color;
            g.lineWidth = width;
            for (let i = 0; i < 3; i++) {
              g.rotate(Math.PI / 3);
              g.beginPath();
              g.moveTo(-11, 0);
              g.lineTo(11, 0);
              g.moveTo(-6, -4);
              g.lineTo(-9.5, 0);
              g.lineTo(-6, 4);
              g.moveTo(6, -4);
              g.lineTo(9.5, 0);
              g.lineTo(6, 4);
              g.stroke();
            }
          }
        }),
      ),
      true,
    );
    material(
      'spark',
      own(
        makeCanvasTex(32, 32, (g) => {
          g.translate(16, 16);
          g.beginPath();
          for (let i = 0; i < 8; i++) {
            const r = i % 2 === 0 ? 14 : 4.6;
            const a = (Math.PI / 4) * i - Math.PI / 2;
            g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          }
          g.closePath();
          g.fillStyle = '#ffe36b';
          g.strokeStyle = '#152038';
          g.lineWidth = 3;
          g.fill();
          g.stroke();
        }),
      ),
      true,
    );
  } catch (err) {
    dispose();
    throw err;
  }

  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    if (width && height) {
      renderer.setPixelRatio(pixelRatio());
      renderer.setSize(width, height, false);
      camera.left = 0;
      camera.right = 256;
      camera.top = 240;
      camera.bottom = 0;
      camera.updateProjectionMatrix();
      onResize?.(256);
    }
  };
  observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  function enemySpriteIndex(e, frame) {
    const tick = Math.floor(frame / 8) % 2;
    switch (e.kind) {
      case 'goblin':
        return e.rollTimer > 0 ? 2 : tick;
      case 'yellowMonkey':
        return 3 + tick;
      case 'fireSpitter':
        return 5 + (e.aiTimer % 115 > 95 ? 1 : 0);
      case 'tornado':
        return e.spinTimer > 0 ? 8 : 7;
      case 'fireYeti':
        return 9 + (e.aiTimer % 130 > 110 ? 1 : 0);
      case 'ogre':
        return e.chargeTimer > 0 ? 12 : 11;
      case 'blueBat':
        return 13 + tick;
      case 'sumo':
        return 15;
      case 'bonusKun':
        return 16 + tick;
      case 'pumpkin':
        return 18;
      case 'ghost':
        return 19;
      case 'togera':
        return 'b2';
      case 'bombJoe':
        return 'b5';
      case 'beep':
        return 'b9';
      case 'pangPang':
        return 'b12';
      default:
        return 0;
    }
  }

  // ───────────────────────── 高清特效（只做视觉，不改任何游戏状态） ─────────────────────────
  const particles = [];
  const MAX_PARTICLES = 900;
  const seen = { frame: -1, floor: -1, enemies: new Map(), balls: new Map(), items: new Map(), players: new Map(), bosses: new Map() };
  let shiftX = 0;
  let shiftY = 0;
  const motionOn = () => !reduceMotionQuery?.matches;
  const density = () => (quality === 'high' ? 1 : 0.5);

  function emit(p) {
    if (particles.length >= MAX_PARTICLES) particles.shift();
    particles.push({ rot: 0, vr: 0, g: 0, grow: 0, vx: 0, vy: 0, ...p, max: p.life });
  }

  function burst(x, y, { count = 10, keys = ['puff'], speed = 1.4, up = 0.6, life = 26, size = 7, g = 0.06, grow = 0 }) {
    const n = Math.max(1, Math.round(count * density()));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random() * 0.8);
      emit({
        key: keys[i % keys.length],
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - up,
        g,
        life: life * (0.7 + Math.random() * 0.6),
        size: size * (0.7 + Math.random() * 0.6),
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.3,
        grow,
      });
    }
  }

  const snowBurst = (x, y, count = 12) => burst(x, y, { count, keys: ['puff', 'flake', 'puff'], speed: 1.5, size: 7, grow: 0.5 });
  const sparkBurst = (x, y, count = 8) => burst(x, y, { count, keys: ['spark', 'glowGold'], speed: 1.9, up: 0.9, life: 30, size: 6, g: 0.07 });

  /** 比较上一拍与这一拍的状态，把「被打倒、落地、起跳、拾取、受击」变成粒子。 */
  function stepEffects(s) {
    if (s.frame < seen.frame || s.floor !== seen.floor) {
      particles.length = 0;
      for (const m of [seen.enemies, seen.balls, seen.items, seen.players, seen.bosses]) m.clear();
      seen.frame = s.frame;
      seen.floor = s.floor;
    }
    const steps = Math.min(4, s.frame - seen.frame);
    if (steps <= 0) return;
    seen.frame = s.frame;
    if (!motionOn()) {
      particles.length = 0;
      return;
    }

    for (let t = 0; t < steps; t++) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.g;
        p.vx *= 0.985;
        p.rot += p.vr;
        if (--p.life <= 0) particles.splice(i, 1);
      }
    }

    const enemies = new Map();
    for (const e of s.enemies) enemies.set(e.id, { x: e.x, y: e.y, kind: e.kind });
    for (const [id, e] of seen.enemies) {
      if (!enemies.has(id)) {
        snowBurst(e.x, e.y - 9, 14);
        sparkBurst(e.x, e.y - 9, 6);
      }
    }
    seen.enemies = enemies;

    const balls = new Map();
    for (const b of s.snowballs) {
      balls.set(b.id, { x: b.x, y: b.y });
      if (b.state === 'rolling' && s.frame % 3 === 0) {
        emit({ key: 'puff', x: b.x - Math.sign(b.vx || 1) * 7, y: b.y - 1, vx: -Math.sign(b.vx || 1) * 0.25, vy: -0.15, g: -0.004, life: 18, size: 6, grow: 0.8 });
      }
    }
    for (const [id, b] of seen.balls) if (!balls.has(id)) snowBurst(b.x, b.y - 9, 18);
    seen.balls = balls;

    const items = new Map();
    for (const it of s.items) items.set(it.id, { x: it.x, y: it.y, life: it.life });
    for (const [id, it] of seen.items) if (!items.has(id) && it.life > 3) sparkBurst(it.x, it.y - 8, 9);
    seen.items = items;

    const players = new Map();
    for (const p of s.players) {
      if (!p.active) continue;
      const before = seen.players.get(p.id);
      players.set(p.id, { onGround: p.onGround, state: p.state });
      if (!before) continue;
      if (before.onGround && !p.onGround && p.state === 'alive') burst(p.x, p.y, { count: 4, keys: ['puff'], speed: 0.7, up: 0.1, life: 16, size: 6, grow: 0.7 });
      if (!before.onGround && p.onGround && p.state === 'alive') burst(p.x, p.y - 1, { count: 7, keys: ['puff', 'flake'], speed: 1.1, up: 0.5, life: 20, size: 6, grow: 0.7 });
      if (before.state === 'alive' && p.state !== 'alive') snowBurst(p.x, p.y - 8, 18);
    }
    seen.players = players;

    for (const shot of s.shots) {
      if (s.frame % 2 === 0) emit({ key: 'glowCyan', x: shot.x, y: shot.y, life: 10, size: shot.r > 5 ? 14 : 10, grow: -0.6 });
    }

    if (s.boss) {
      s.boss.units.forEach((u, idx) => {
        const before = seen.bosses.get(idx);
        const alive = u.hp > 0;
        if (before) {
          if (u.hurtTimer > before.hurt) sparkBurst(u.x, u.y - 22, 7);
          if (before.alive && !alive) {
            snowBurst(u.x, u.y - 22, 30);
            sparkBurst(u.x, u.y - 22, 22);
            emit({ key: 'glowGold', x: u.x, y: u.y - 22, life: 28, size: 70, grow: 1.4 });
          }
        }
        seen.bosses.set(idx, { hurt: u.hurtTimer, alive });
      });
    } else {
      seen.bosses.clear();
    }
  }

  /** BOSS 出招前的预告强度 0～1：对应引擎里各 BOSS 的出招周期，只读不改。 */
  function bossWarn(kind, u) {
    const ramp = (m, from, len) => (m >= from ? Math.min(1, (m - from) / len) : 0);
    if (kind === 'lizard') return u.onGround ? ramp(u.timer % 120, 94, 26) : 0;
    if (kind === 'frog') return ramp(u.timer % 175, 143, 32);
    if (kind === 'birds') {
      if (u.diveTimer > 0) return 0;
      const every = Math.max(150, 260 - (u.phase || 0) * 40);
      return ramp(u.timer % every, every - 30, 30);
    }
    if (kind === 'bigNose') return u.onGround ? ramp(u.timer % 110, 84, 26) : 0;
    if (kind === 'bubbleStatues') return ramp(u.timer % 120, 88, 32);
    return 0;
  }

  // 背景远近两层缓慢飘落的彩笔雪花；位置只由游戏帧数决定，暂停时静止。
  const FLAKES = Array.from({ length: 34 }, (_, i) => ({
    x: (i * 97.3) % 256,
    y: (i * 53.7) % 240,
    z: i % 3,
    sway: 4 + (i % 5) * 1.6,
    phase: i * 1.7,
  }));
  function drawFlakes(frame, near) {
    const count = quality === 'high' ? FLAKES.length : 12;
    for (let i = 0; i < count; i++) {
      const f = FLAKES[i];
      if ((f.z === 2) !== near) continue;
      const speed = [0.2, 0.32, 0.5][f.z];
      const y = (f.y + frame * speed) % 250;
      const x = (f.x + Math.sin(frame * 0.018 + f.phase) * f.sway + 256) % 256;
      const size = [3.4, 4.6, 6.4][f.z];
      draw(near ? fadedKey('flake', 0.7) : fadedKey('flake', 0.5), x, y - 5, size, size, frame * 0.01 * (f.z + 1) + f.phase);
    }
  }

  function frame(s) {
    used = 0;

    if (!s) {
      draw('titleBg', 128, 120, 256, 240);
      for (let i = used; i < meshes.length; i++) meshes[i].visible = false;
      renderer.render(scene, camera);
      return;
    }

    if (s.phase === 'ending') {
      draw('endingBg', 128, 120, 256, 240);
      draw('i19', 128, 134, 48, 48);
      draw('p0', 76, 152, 24, 24);
      draw('p10', 180, 154, -22, 22);
      for (let i = used; i < meshes.length; i++) meshes[i].visible = false;
      renderer.render(scene, camera);
      return;
    }

    const fDef = getFloor(s.floor);
    const tId = fDef.theme;

    stepEffects(s);

    // 背景：略放大，随角色左右上下缓慢错位，远景雪花慢慢飘。
    const live = s.players.filter((p) => p.active && p.state === 'alive');
    const moving = motionOn() && live.length > 0;
    const avgX = moving ? live.reduce((a, p) => a + p.x, 0) / live.length : 128;
    const avgY = moving ? live.reduce((a, p) => a + p.y, 0) / live.length : 120;
    shiftX += ((-(avgX - 128) / 128) * 4.2 - shiftX) * 0.06;
    shiftY += (((avgY - 120) / 120) * 3 - shiftY) * 0.06;
    const zoom = motionOn() ? 1.07 : 1;
    draw('field' + tId, 128 + shiftX, 120 + shiftY, 256 * zoom, 240 * zoom);
    if (motionOn()) drawFlakes(s.frame, false);

    // 两侧塔墙
    draw(wallKeyOf(tId, WALL_LEFT, 232), WALL_LEFT / 2, 124, WALL_LEFT, 232);
    draw(wallKeyOf(tId, 256 - WALL_RIGHT, 232), WALL_RIGHT + (256 - WALL_RIGHT) / 2, 124, 256 - WALL_RIGHT, 232);

    // 内墙阻挡
    for (const w of fDef.walls) {
      draw(wallKeyOf(tId, w.x2 - w.x1, w.y2 - w.y1), (w.x1 + w.x2) / 2, (w.y1 + w.y2) / 2, w.x2 - w.x1, w.y2 - w.y1);
    }

    // 平台砖块
    for (const pl of fDef.platforms) {
      // 只画厚一点（雪顶略高出落脚线），碰撞仍以 pl.y 为准。
      draw(bankKeyOf(pl.x2 - pl.x1), (pl.x1 + pl.x2) / 2, pl.y + 3.5, pl.x2 - pl.x1, 11);
    }

    // 斜坡：厚冰坡贴在落脚线下方，雪沿留在可踩的那一侧。
    for (const sl of fDef.slopes) {
      const dx = sl.x2 - sl.x1;
      const dy = sl.y2 - sl.y1;
      const len = Math.hypot(dx, dy) || 1;
      let px = -dy;
      let py = dx;
      if (py < 0) {
        px = -px;
        py = -py;
      }
      const n = Math.hypot(px, py) || 1;
      const ox = (px / n) * 5;
      const oy = (py / n) * 5;
      drawLine(bankKeyOf(len), sl.x1 + ox, sl.y1 + oy, sl.x2 + ox, sl.y2 + oy, 13);
    }

    // 开场过场：阿奇奇大魔王掠走双胞胎公主
    if (s.phase === 'intro') {
      const lift = Math.max(0, 150 - s.introTimer) * 0.45;
      draw('b15', 128, 92 - lift, 44, 44);
      draw('i19', 128, 134 - lift, 34, 34);
      draw('p4', 86, 206, 22, 22);
      draw('p14', 170, 206, -22, 22);
      const pop = popupMaterial('救出双胞胎公主！', '#ffe67b');
      draw(pop, 128, 174, 150, 24);
      for (let i = used; i < meshes.length; i++) meshes[i].visible = false;
      renderer.render(scene, camera);
      return;
    }

    // 50 层下降尖刺天花板
    if (s.boss?.kind === 'bubbleStatues') {
      for (let x = 24; x <= 232; x += 36) {
        draw('i18', x, s.boss.spikeY - 6, 36, 20);
      }
    }

    // 道具与战利品
    for (const it of s.items) {
      if (it.life < 60 && Math.floor(it.life / 5) % 2 === 1) continue;
      let key = 'i5';
      if (it.kind === 'red') key = 'i0';
      else if (it.kind === 'blue') key = 'i1';
      else if (it.kind === 'yellow') key = 'i2';
      else if (it.kind === 'green') key = 'i3';
      else if (it.kind === 'snowHead') key = 'i4';
      else if (it.kind === 'sushi') key = it.tier < 3 ? 'i5' : it.tier < 7 ? 'i6' : 'i7';
      else if (it.kind === 'money10k') key = 'i8';
      else if (it.kind === 'money20k') key = 'i9';
      else if (it.kind === 'warp') key = 'i9';
      else if (it.kind === 'sundae') key = 'i11';
      else if (['pie', 'milk', 'burger'].includes(it.kind)) key = 'i10';

      const glow = it.kind === 'red' ? 'glowRed' : it.kind === 'blue' ? 'glowCyan' : it.kind === 'green' ? 'glowWhite' : 'glowGold';
      draw(fadedKey(glow, 0.5 + 0.2 * Math.sin(s.frame * 0.12 + it.id)), it.x, it.y - 8, 26, 26);
      if (it.kind === 'warp') {
        draw('warpGlow', it.x, it.y - 8, 22 + Math.sin(s.frame * 0.2) * 3);
      }
      draw('shadow', it.x, it.y + 0.5, 12, 4);
      draw(key, it.x, it.y - 8, 17, 17);
    }

    // 敌人弹幕与地面残火
    for (const h of s.hazards) {
      if (h.kind === 'shuriken') draw('shuriken', h.x, h.y - 4, 11, 11, s.frame * 0.35);
      else if (h.kind === 'firePatch') {
        draw(fadedKey('glowRed', 0.5 + 0.2 * Math.sin(s.frame * 0.3 + h.id)), h.x, h.y - 9, 30, 30);
        draw('i14', h.x, h.y - 8, 16, 16);
      }
      else if (h.kind === 'trapBubble') draw('i15', h.x, h.y - 6, 18, 18);
      else if (h.kind === 'blast') draw('hurtRing', h.x, h.y - 6, 28, 28);
      else draw('orb', h.x, h.y - 5, 11, 11);
    }

    // Boss 本体：出招前身体蓄力抖动、脚下红光预告、头顶出现感叹号。
    if (s.boss) {
      for (const u of s.boss.units) {
        if (u.hp <= 0) continue;
        let bIdx = 0;
        let size = 56;
        if (s.boss.kind === 'lizard') bIdx = u.onGround ? 0 : 1;
        else if (s.boss.kind === 'frog') bIdx = u.timer % 175 > 140 ? 4 : 3;
        else if (s.boss.kind === 'birds') {
          bIdx = 6 + (u.phase || 0);
          size = 52;
        } else if (s.boss.kind === 'bigNose') {
          bIdx = s.timeMode ? 11 : 10;
          size = 54;
        } else if (s.boss.kind === 'bubbleStatues') {
          bIdx = u.side === 'left' ? 13 : 14;
          size = 54;
        }
        const warn = bossWarn(s.boss.kind, u);
        const wobble = warn > 0 && motionOn() ? Math.sin(s.frame * 0.9) * 0.9 * warn : 0;
        const cy = u.y - size * 0.44;
        if (s.boss.kind !== 'birds' && u.onGround !== false) draw('shadow', u.x, u.y + 1, size * 0.9, size * 0.28);
        if (warn > 0) {
          draw(fadedKey('glowRed', 0.4 + 0.5 * warn), u.x, cy, size * (1.15 + 0.5 * warn), size * (1.15 + 0.5 * warn));
          draw(popupMaterial('!', '#ff5a4e'), u.x, u.y - size * 0.98, 20, 20);
        }
        draw('b' + bIdx, u.x + wobble, cy, u.dir < 0 ? size : -size, size * (1 - 0.05 * warn));
        if (u.hurtTimer > 0) draw('hurtRing', u.x, cy, size * 0.95, size * 0.95);
      }
    }

    // 敌怪（含半结冰雪堆罩与 Bonus Kun 字母标识）
    for (const e of s.enemies) {
      const raw = enemySpriteIndex(e, s.frame);
      const key = typeof raw === 'string' ? raw : 'e' + raw;
      const sx = e.dir >= 0 ? 18 : -18;
      if (e.kind !== 'blueBat' && e.kind !== 'ghost' && e.onGround !== false) draw('shadow', e.x, e.y + 0.5, 15, 4.5);
      draw(key, e.x, e.y - 9, sx, 18);
      if (e.snow > 0) {
        const sc = 8 + (e.snow / 9) * 11;
        draw('frost', e.x, e.y - 9, sc, sc);
      }
      if (e.kind === 'bonusKun' && e.letter) {
        draw(popupMaterial(e.letter, '#ffffff'), e.x, e.y - 22, 34, 14);
      }
    }

    // 雪球（白 / 1P 蓝连锁 / 2P 红连锁）
    for (const ball of s.snowballs) {
      if (ball.state === 'still' && ball.thaw < 90 && Math.floor(ball.thaw / 5) % 2 === 1) continue;
      const key = ball.color === 'p1' ? 'i12' : ball.color === 'p2' ? 'i13' : 'p19';
      const rot = ball.state === 'rolling' ? (s.frame * (ball.vx >= 0 ? 0.25 : -0.25)) : 0;
      draw('shadow', ball.x, ball.y + 0.5, 17, 5);
      draw(key, ball.x, ball.y - 9, 19, 19, rot);
    }

    // 雪片弹丸
    for (const shot of s.shots) {
      const sz = shot.r > 5 ? 13 : 9.5;
      draw(fadedKey('glowCyan', 0.7), shot.x, shot.y, sz * 2.2, sz * 2.2);
      draw('p18', shot.x, shot.y, sz, sz, s.frame * 0.2);
    }

    // 近景雪花先画。盖在脸上会让姐妹看起来一闪一闪。
    if (motionOn()) drawFlakes(s.frame, true);

    // 玩家 1P 姐姐（红裙）& 2P 妹妹（紫裙）
    for (const p of s.players) {
      if (!p.active || p.state === 'dead') continue;
      if (p.invuln > 0 && Math.floor(p.invuln / 4) % 2 === 1 && p.state === 'alive') continue;
      const base = p.id === 1 ? 0 : 10;
      let cell = 0;
      if (p.state === 'dying') {
        cell = p.id === 1 ? (p.deathTimer > 28 ? 7 : 8) : 7;
      } else if (p.giantTimer > 0) {
        cell = Math.floor(s.frame / 8) % 2 === 0 ? 5 : 6;
      } else if (p.throwPose > 0) {
        cell = 4;
      } else if (!p.onGround) {
        cell = 3;
      } else if (Math.abs(p.vx) > 0.2) {
        cell = Math.floor(s.frame / 6) % 2 === 0 ? 1 : 2;
      }
      const size = p.giantTimer > 0 ? 38 : 26;
      const w = (p.dir >= 0 ? 1 : -1) * size;
      if (p.onGround) draw('shadow', p.x, p.y + 0.5, size * 0.8, size * 0.24);
      draw('p' + (base + cell), p.x, p.y - size * 0.45, w, size);
      if (p.ridingBallId != null) {
        draw('hurtRing', p.x, p.y - 9, 22, 22);
      }
    }

    // 特效粒子留在角色前面，落地和击倒的雪团仍能看见。
    if (motionOn()) {
      for (const pt of particles) {
        const t = pt.life / pt.max;
        const size = Math.max(0.5, pt.size * (1 + pt.grow * (1 - t)));
        draw(fadedKey(pt.key, Math.min(1, t * 2)), pt.x, pt.y, size, size, pt.rot);
      }
    }

    // 加分/奖命/提示飘字
    for (const pop of s.popups) {
      draw(popupMaterial(pop.text, pop.color), pop.x, pop.y, 76, 18);
    }

    for (let i = used; i < meshes.length; i++) meshes[i].visible = false;
    renderer.render(scene, camera);
  }

  function setQuality(next) {
    quality = next === 'standard' ? 'standard' : 'high';
    writeQuality(quality);
    resize();
  }

  return { frame, dispose, setQuality, getQuality: () => quality };
}
