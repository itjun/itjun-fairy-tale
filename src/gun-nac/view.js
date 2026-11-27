import * as THREE from 'three';
import { playBounds } from './stages.js';
import { bombGeometry } from './arsenal.js';
import { branchTip, rabbitEye } from './bosses.js';
import { visibleTerrain, ENTRY_FRAME, solarSide } from './terrain.js';
import { flareWidth } from './flight.js';
import { paintCrescentBlade, crescentSpin, crescentDrawSize } from './crescent.js';
import {
  SHIP_CANVAS_SIZE,
  BASE_SHIP_WIDTH,
  BASE_SHIP_HEIGHT,
  WINGED_SHIP_WIDTH,
  WINGED_SHIP_HEIGHT,
  paintBaseShip,
  paintWingedShip,
} from './ship-art.js';

const BASE = './gun-nac/';
const CRAFT = {
  scout: 2,
  rabbitDrone: 3,
  courier: 4,
  missile: 5,
  ember: 6,
  fish: 7,
  barge: 8,
  nut: 9,
  stump: 10,
  coin: 11,
  shell: 12,
  arrow: 13,
  turret: 14,
  fighter: 15,
  tentacle: 16,
};
const BOSSES = {
  orb: 0,
  battery: 1,
  siren: 2,
  acorn: 3,
  cat: 4,
  clay: 5,
  burrow: 6,
  alien: 7,
  rabbit: 8,
  lava: 9,
  octopus: 10,
  tree: 11,
  gold: 12,
  tower: 13,
  moon: 14,
};
const BLUE = '#70dcff',
  HOT = '#ff643c',
  GOLD = '#ffd442',
  INK = '#192047';

// 画质：默认「最高」（像素比最高 3、全部特效）；「标准」只在个别机器掉帧时手动降档，从不自动降。
// 标准档只降像素比与火花粒子数，画面结构与玩法不变。
export const QUALITY_KEY = 'garden-gun-nac-quality';
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

// 贴图按设计坐标绘制，画布尺寸决定清晰度；paint 内部自行按画布尺寸放大。
function textureFrom(paint, size = 256, height = size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = height;
  const ctx = c.getContext('2d');
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  paint(ctx);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function radialTexture(stops, size = 128) {
  return textureFrom((g) => {
    const half = size / 2;
    const grad = g.createRadialGradient(half, half, 0, half, half, half);
    for (const [offset, color] of stops) grad.addColorStop(offset, color);
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  }, size);
}
// 星点贴图：128×240，与战场一个区块同比例，首尾相接；种子固定，画面可重现。
function starTexture() {
  const W = 128,
    H = 240;
  return textureFrom(
    (g) => {
      let seed = 7;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 46; i++) {
        const x = rnd() * W,
          y = rnd() * H,
          r = 0.5 + rnd() * 1.1,
          a = 0.25 + rnd() * 0.55;
        for (const dx of [-W, 0, W])
          for (const dy of [-H, 0, H]) {
            const px = x + dx,
              py = y + dy;
            if (px < -3 || px > W + 3 || py < -3 || py > H + 3) continue;
            g.fillStyle = `rgba(232, 246, 255, ${a})`;
            g.beginPath();
            g.arc(px, py, r, 0, Math.PI * 2);
            g.fill();
          }
      }
    },
    W,
    H,
  );
}
function inkTexture(shape, color, text = '', size = 256) {
  return textureFrom((g) => {
    if (shape === 'blade') {
      paintCrescentBlade(g, { enemy: false, scale: size / 96 });
      return;
    }
    if (shape === 'crescent') {
      paintCrescentBlade(g, { enemy: true, scale: size / 96 });
      return;
    }
    // 设计坐标仍按 96 画，贴图按 size 放大，线宽和字号同比例。
    g.scale(size / 96, size / 96);
    g.strokeStyle = '#fff6de';
    g.lineWidth = 9;
    g.fillStyle = color;
    g.beginPath();
    switch (shape) {
      case 'beam':
        g.roundRect(27, 5, 42, 86, 17);
        break;
      case 'flame':
        g.moveTo(47, 6);
        g.quadraticCurveTo(82, 40, 71, 69);
        g.quadraticCurveTo(52, 99, 28, 72);
        g.quadraticCurveTo(17, 52, 47, 6);
        break;
      case 'shard':
        g.moveTo(44, 6);
        g.lineTo(82, 48);
        g.lineTo(49, 89);
        g.lineTo(14, 51);
        g.closePath();
        break;
      case 'badge':
        g.roundRect(7, 8, 82, 80, 24);
        break;
      case 'ring':
        g.arc(48, 48, 38, 0, Math.PI * 2);
        g.strokeStyle = color;
        g.lineWidth = 6;
        g.stroke();
        return;
      case 'firering':
        g.arc(48, 48, 32, 0, Math.PI * 2);
        g.strokeStyle = color;
        g.lineWidth = 18;
        g.stroke();
        g.strokeStyle = '#fff6de';
        g.lineWidth = 4;
        g.stroke();
        return;
      default:
        g.ellipse(48, 48, 32, 35, 0.15, 0, Math.PI * 2);
    }
    g.fill();
    g.stroke();
    if (text) {
      g.fillStyle = INK;
      g.font = 'bold 62px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, 48, 52);
    } else {
      g.fillStyle = 'rgba(255,255,255,.75)';
      g.fillRect(36, 27, 10, 6);
    }
  }, size);
}

export async function createFlightView(host, onResize, options = {}) {
  let quality = options.quality ?? readQuality();
  const reduceMotionQuery = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const motionOn = () => !reduceMotionQuery?.matches;
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
  });
  const pixelRatio = (q) => Math.min(window.devicePixelRatio || 1, q === 'high' ? 3 : 1.5);
  renderer.setPixelRatio(pixelRatio(quality));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-label', '加纳战机飞行战场');
  host.append(renderer.domElement);
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy?.() ?? 1;
  let viewWidth = 256;
  const scene = new THREE.Scene(),
    camera = new THREE.OrthographicCamera(0, 256, 240, 0, 0.1, 20);
  camera.position.z = 5;
  const plane = new THREE.PlaneGeometry(1, 1),
    loader = new THREE.TextureLoader(),
    textures = new Set(),
    materials = new Map(),
    meshes = [];
  function own(tex) {
    tex.colorSpace = THREE.SRGBColorSpace;
    // 大屏放大时保持贴图清晰：mipmap 与各向异性过滤，不用最近邻。
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = maxAnisotropy;
    textures.add(tex);
    return tex;
  }
  function material(key, tex, transparent = true) {
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent, depthWrite: false, depthTest: false });
    materials.set(key, m);
    return m;
  }
  function tileAtlas(key, tex, cols, rows) {
    for (let i = 0; i < cols * rows; i++) {
      const tile = own(tex.clone());
      tile.repeat.set(1 / cols, 1 / rows);
      tile.offset.set((i % cols) / cols, (rows - 1 - Math.floor(i / cols)) / rows);
      tile.needsUpdate = true;
      material(key + i, tile);
    }
  }
  let used = 0;
  function draw(key, x, y, width, height = width, rotation = 0) {
    let mesh = meshes[used];
    if (!mesh) {
      mesh = new THREE.Mesh(plane, materials.get(key));
      scene.add(mesh);
      meshes.push(mesh);
    }
    mesh.material = materials.get(key);
    mesh.position.set(x, 240 - y, 0);
    mesh.scale.set(width, height, 1);
    mesh.rotation.z = -rotation;
    mesh.renderOrder = used++;
    mesh.visible = true;
    return mesh;
  }
  function line(key, x1, y1, x2, y2, width) {
    const dx = x2 - x1,
      dy = y2 - y1;
    draw(
      key,
      (x1 + x2) / 2,
      (y1 + y2) / 2,
      width,
      Math.hypot(dx, dy) + width / 2,
      Math.atan2(dy, dx) - Math.PI / 2,
    );
  }
  function symbol(shape, color, text = '') {
    const key = shape + color + text;
    if (!materials.has(key)) material(key, own(inkTexture(shape, color, text)));
    return key;
  }
  // 加色光晕：白色径向贴图乘以颜色，叠加在画面上，像彩笔高光与火光。
  const glowTex = own(
    radialTexture([
      [0, 'rgba(255,255,255,1)'],
      [0.35, 'rgba(255,255,255,0.55)'],
      [1, 'rgba(255,255,255,0)'],
    ]),
  );
  function glow(color) {
    const key = 'glow' + color;
    if (!materials.has(key)) {
      const m = new THREE.MeshBasicMaterial({
        map: glowTex,
        color,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      });
      materials.set(key, m);
    }
    return key;
  }
  // 地面软阴影：深紫半透明径向渐变，画在角色与敌人下方一点点。
  material(
    'shadow',
    own(
      radialTexture([
        [0, 'rgba(14, 10, 40, 0.46)'],
        [0.6, 'rgba(14, 10, 40, 0.24)'],
        [1, 'rgba(14, 10, 40, 0)'],
      ]),
    ),
    true,
  );
  const fields = [];
  const starTex = own(starTexture());
  materials.set(
    'stars',
    new THREE.MeshBasicMaterial({
      map: starTex,
      color: '#ffffff',
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    }),
  );
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
    const [craft, boss, terrain, ...maps] = await Promise.all([
      ...['craft', 'bosses', 'landmarks'].map((n) => loader.loadAsync(BASE + n + '.webp').then(own)),
      ...Array.from({ length: 9 }, (_, i) => loader.loadAsync(BASE + 'field-' + i + '.webp').then(own)),
    ]);
    tileAtlas('c', craft, 5, 4);
    tileAtlas('b', boss, 4, 4);
    tileAtlas('t', terrain, 4, 4);
    material('shipBase', own(textureFrom(paintBaseShip, SHIP_CANVAS_SIZE)), true);
    material('shipWinged', own(textureFrom(paintWingedShip, SHIP_CANVAS_SIZE)), true);
    const haloTex = own(
      textureFrom((g) => {
        const c = SHIP_CANVAS_SIZE / 2;
        const grad = g.createRadialGradient(c, c + 4, 32, c, c + 4, c - 4);
        grad.addColorStop(0, 'rgba(112, 240, 255, 0.0)');
        grad.addColorStop(0.68, 'rgba(112, 240, 255, 0.18)');
        grad.addColorStop(0.88, 'rgba(255, 224, 102, 0.36)');
        grad.addColorStop(1, 'rgba(112, 240, 255, 0.0)');
        g.fillStyle = grad;
        g.beginPath();
        g.arc(c, c + 4, c - 4, 0, Math.PI * 2);
        g.fill();
      }, SHIP_CANVAS_SIZE),
    );
    material('wingHalo', haloTex, true);
    maps.forEach((tex, i) => {
      tex.wrapT = THREE.RepeatWrapping;
      if (i !== 7) tex.wrapS = THREE.MirroredRepeatWrapping;
      fields.push(tex);
      material('field' + i, tex, false);
    });
    const solar = own(maps[7].clone());
    solar.repeat.x = -1;
    solar.offset.x = 1;
    solar.needsUpdate = true;
    material('solarRight', solar, false);
  } catch (error) {
    dispose();
    throw error;
  }
  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    if (width && height) {
      renderer.setSize(width, height, false);
      // 战场固定经典 4∶3（256×240），不再随窗口拉宽。
      viewWidth = 256;
      camera.left = 0;
      camera.right = 256;
      camera.top = 240;
      camera.bottom = 0;
      camera.updateProjectionMatrix();
      onResize?.(viewWidth);
    }
  };
  observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  const dot = symbol('dot', HOT),
    ring = symbol('ring', BLUE),
    laser = symbol('beam', '#ff4e6b');
  // 火花数量：高画质满额，标准档减半；减少动态效果时不放火花。
  const sparkCount = (n) => (quality === 'high' ? n : Math.max(1, Math.round(n / 2)));
  function frame(s) {
    used = 0;
    const w = playBounds(s).width || viewWidth;
    if (camera.right - camera.left !== w) {
      camera.left = 128 - w / 2;
      camera.right = 128 + w / 2;
      camera.updateProjectionMatrix();
    }
    const tileField = (idx, offsetY) => {
      const tex = fields[idx];
      tex.offset.y = offsetY;
      if (idx !== 7) {
        const rep = w / 256;
        tex.repeat.x = rep;
        tex.offset.x = (1 - rep) / 2;
      }
    };
    const entry = ENTRY_FRAME[s.area];
    const edge = Math.min(240, Math.max(0, (s.areaTick - entry) * 8));
    const arriving = entry > 0 && edge < 240;
    const field = arriving ? 0 : s.area;
    tileField(field, s.scroll / 240);
    if (field === 7) {
      const row = Math.floor(s.scroll / 240);
      fields[7].offset.y = 0;
      for (let i = row; i <= row + 1; i++)
        draw(solarSide(i) === 1 ? 'field7' : 'solarRight', 128, s.scroll - i * 240 + 120, w, 240);
    } else draw('field' + field, 128, 120, w, 240);
    if (arriving && edge > 0) {
      tileField(s.area, (s.scroll - edge) / 240);
      draw('field' + s.area, 128, edge - 120, w, 240);
    }
    // 远景星点：比地面慢一档滚动，形成视差；减少动态效果时固定不动。
    if (field !== 7 && !arriving) {
      starTex.repeat.set(w / 128, 1);
      starTex.offset.set(0, motionOn() ? (s.scroll * 0.55) / 240 : 0);
      draw('stars', 128, 120, w, 240);
    }
    for (const m of visibleTerrain(s.area, s.scroll, s.areaTick, w))
      draw('t' + m.tile, m.x, m.y, m.width, m.width, m.turn);
    for (const h of s.hazards) {
      if (h.kind === 'flare') {
        if (h.age < 42) draw(symbol('ring', GOLD), h.x + h.sign * 4, h.y, 8 + Math.sin(h.age * 0.3) * 2);
        else line(symbol('flame', '#ff982d'), h.x, h.y, h.x + h.sign * flareWidth(h, w), h.y, 12);
      } else if (h.kind === 'pillar') {
        line(laser, h.x, 0, h.x, 240, 4);
      } else draw(symbol('shard', '#d78e53'), h.x, h.y, 10 + h.age * 0.22);
    }
    // 影子先画，角色压在上面：从左上方打光，影子落在右下一点。
    for (const e of s.enemies) {
      if (e.age < 0 || (e.path === 'surface' && e.age < 34)) continue;
      const size = e.r * (e.kind === 'barge' ? 3.4 : 3);
      draw('shadow', e.x + 3, e.y - 4, size * 0.86, size * 0.3);
    }
    if (s.boss && (s.boss.open || !['octopus', 'burrow', 'tower'].includes(s.boss.kind))) {
      const size = s.boss.kind === 'rabbit' ? 94 : s.boss.r * 3.65;
      draw('shadow', s.boss.x + 6, s.boss.y - 8, size * 0.9, size * 0.3);
    }
    for (const e of s.enemies) {
      if (e.age < 0) continue;
      if (e.path === 'surface' && e.age < 34) {
        draw(ring, e.x, e.y, 9 + e.age * 0.28, 4 + e.age * 0.13);
        continue;
      }
      const size = e.r * (e.kind === 'barge' ? 3.4 : 3);
      draw('c' + CRAFT[e.kind], e.x, e.y, size, size, Math.sin(e.age * 0.065) * 0.085);
      if (e.kind === 'shell' && e.age % 135 < 53) draw(symbol('ring', GOLD), e.x, e.y, size * 0.84);
    }
    const b = s.boss;
    if (b) {
      if (!b.open && ['octopus', 'burrow', 'tower'].includes(b.kind)) {
        if (b.kind === 'burrow' && b.age < 202) {
          for (const t of b.tiles || [])
            if (t.hp > 0) draw(symbol('shard', t.hp < 3 ? '#ebaf69' : '#8c938a'), t.x, t.y, 17);
        } else draw(ring, b.x, b.y, 26 + Math.sin(b.age * 0.08) * 7, 9);
      } else {
        const size = b.kind === 'rabbit' ? 94 : b.r * 3.65;
        if (b.flash > 0 && motionOn()) draw(glow(GOLD), b.x, b.y, size * 0.9);
        draw('b' + BOSSES[b.kind], b.x, b.y, size, size);
        if (b.kind === 'rabbit')
          [-1, 1].forEach((side, i) => {
            const eye = rabbitEye(b, side);
            if (!b.open || b.eyes[i] <= 0) {
              draw(symbol('dot', b.eyes[i] <= 0 ? INK : '#7d86a1'), eye.x, eye.y, 11);
              line(symbol('beam', INK), eye.x - 3, eye.y, eye.x + 3, eye.y, 2);
            } else draw(symbol('ring', b.flash ? '#ffffff' : GOLD), eye.x, eye.y, 10);
          });
        if (b.kind === 'tree' && b.age > 72 && (b.age - 72) % 225 < 163) {
          const tip = branchTip(b);
          line(symbol('beam', '#875630'), b.x - 7, b.y + 3, tip.x, tip.y, 4);
        }
        if (b.kind === 'clay' && b.open && (b.age - 72) % 180 < 96)
          draw(symbol('ring', GOLD), b.x, b.y, 12 + (b.age % 8));
        if (b.flash > 0) draw(symbol('ring', GOLD), b.x, b.y, size * 0.46);
      }
    }
    for (const i of s.items) {
      if (i.age < 0) continue;
      const id = { life: 19, money: 17, wing: 18 }[i.kind];
      // 拾取物底下加一圈暖光，远远就能认出来。
      const halo = { life: '#ff8fb5', money: '#ffe27a', wing: '#8ff0ff' }[i.kind] || '#cdf6ff';
      if (motionOn()) draw(glow(halo), i.x, i.y, 22);
      if (id != null) draw('c' + id, i.x, i.y, i.kind === 'wing' ? 18 : 15);
      else {
        const tag = i.kind.startsWith('gun')
          ? i.kind.slice(3)
          : i.kind.startsWith('bomb')
            ? i.kind.slice(4)
            : i.kind === 'chip'
              ? 'P'
              : '★';
        const badgeSize = 12;
        draw(
          symbol('badge', i.kind.startsWith('bomb') ? '#fac081' : '#aceaf1', tag),
          i.x,
          i.y,
          badgeSize,
        );
      }
    }
    for (const shot of s.shots) {
      if (shot.gun === 3) {
        const spin = crescentSpin(shot.age, shot.spinDir || 1);
        const size = crescentDrawSize(shot.r);
        if (motionOn()) draw(glow('#7ad8ff'), shot.x, shot.y, size * 1.5);
        draw(symbol('blade', '#7ad8ff'), shot.x, shot.y, size, size, spin);
        continue;
      }
      const a = Math.atan2(shot.vy, shot.vx) + Math.PI / 2;
      const shape = ['', 'beam', 'dot', 'blade', 'flame', 'beam'][shot.gun],
        color = ['', BLUE, '#dc8cff', '#38c6ff', '#ffad22', '#66ffd9'][shot.gun];
      const height = shot.gun === 4 ? shot.span || 12 : shot.gun === 5 ? 9 : shot.gun === 1 ? 6 : shot.r * 2.4;
      if (motionOn()) draw(glow(color), shot.x, shot.y, shot.r * 4.4, height * 1.7, a);
      draw(symbol(shape, color), shot.x, shot.y, shot.gun === 5 ? 2.2 : shot.r * 2, height, a);
    }
    const p = s.ship;
    if (p.inv <= 0 || Math.floor(p.inv / 6) % 2 === 0) {
      const tilt = p.dx * 0.045;
      const pulse = 0.86 + Math.sin(s.frame * 0.48) * 0.2;
      // 机身下方的软阴影，离地面越远越淡。
      draw('shadow', p.x + 3, p.y - 6, p.wing ? WINGED_SHIP_WIDTH * 1.05 : BASE_SHIP_WIDTH * 1.05, 6);
      if (motionOn()) draw(glow('#ff9c24'), p.x, p.y + 9, 9, 12 * pulse);
      draw(symbol('flame', '#ff9c24'), p.x, p.y + 8, 2.2, 4.2 * pulse, Math.PI + tilt);
      if (p.wing) draw('shipWinged', p.x, p.y, WINGED_SHIP_WIDTH, WINGED_SHIP_HEIGHT, tilt);
      else draw('shipBase', p.x, p.y, BASE_SHIP_WIDTH, BASE_SHIP_HEIGHT, tilt);
    }
    for (const h of s.hostile) {
      const a = Math.atan2(h.vy, h.vx) + Math.PI / 2;
      if (h.kind === 'elbow' || h.kind === 'laser') draw(laser, h.x, h.y, 3.6, 12, a);
      else if (h.kind === 'carrot') draw(symbol('flame', '#ff8b24'), h.x, h.y, 6, 11, a);
      else if (h.kind === 'moon') draw(symbol('crescent', GOLD), h.x, h.y, 9, 10, a);
      else if (h.kind === 'returnCoin') draw(symbol('ring', GOLD), h.x, h.y, 9);
      else if (h.kind === 'bubble' || h.kind === 'pearl') draw(symbol('dot', '#a47af8'), h.x, h.y, h.r * 2.8);
      else draw(h.kind === 'shard' ? symbol('shard', HOT) : dot, h.x, h.y, h.r * 2.6);
    }
    for (const b of s.bombs) {
      const g = bombGeometry(b, p, w);
      if (b.kind === 'F') draw(symbol('firering', '#ff9732'), g.x, g.y, g.ring * 2.34);
      if (b.kind === 'B') line(symbol('beam', '#92e3ff'), g.x, 0, g.x, 240, g.width * 2);
      if (b.kind === 'T')
        g.points.slice(1).forEach((v, i) => line(symbol('beam', GOLD), ...g.points[i], ...v, g.width));
      if (b.kind === 'W' && b.age < 24)
        for (let j = 0; j < 4; j++)
          draw(symbol('dot', BLUE), b.x + (j - 1.5) * b.age * 0.74, b.y - b.age * 6, 6 + b.power);
      if (b.kind === 'W') g.drops.forEach((d) => draw(symbol('flame', BLUE), d.x, d.y, 13, 19));
    }
    for (const f of s.effects) {
      const large = ['clear', 'boss', 'hurt', 'blast'].includes(f.kind);
      draw(
        symbol('ring', large ? GOLD : '#e6faff'),
        f.x,
        f.y,
        (large ? 8 : 3) + f.age * (f.kind === 'clear' ? 14 : large ? 1.35 : 0.52),
      );
      // 火花从中心向外散开，只由 age 决定位置，暂停时自然冻结。
      if (motionOn()) {
        const n = sparkCount(large ? 8 : 4);
        const spread = f.age * (large ? 1.7 : 0.9) + 3;
        const size = Math.max(0.5, (large ? 3.6 : 2.2) * (1 - f.age / 28));
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + 0.4;
          draw(glow(large ? GOLD : '#e6faff'), f.x + Math.cos(a) * spread, f.y + Math.sin(a) * spread, size * 2);
        }
      }
    }
    for (let i = used; i < meshes.length; i++) meshes[i].visible = false;
    renderer.render(scene, camera);
  }
  function setQuality(next) {
    quality = next === 'standard' ? 'standard' : 'high';
    writeQuality(quality);
    renderer.setPixelRatio(pixelRatio(quality));
    resize();
  }
  return { frame, dispose, getWidth: () => viewWidth, setQuality, getQuality: () => quality };
}
