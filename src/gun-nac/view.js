import * as THREE from 'three';
import { openingPoint, playBounds } from './stages.js';
import { bombGeometry } from './arsenal.js';
import { branchTip, rabbitEye } from './bosses.js';
import { visibleTerrain, ENTRY_FRAME, solarSide } from './terrain.js';
import { flareWidth } from './flight.js';
import { paintCrescentBlade, crescentSpin, crescentDrawSize } from './crescent.js';
import {
  SHIP_CANVAS_SIZE,
  BASE_SHIP_SIZE,
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
function textureFrom(paint, size = 96) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  paint(ctx);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function inkTexture(shape, color, text = '') {
  return textureFrom((g) => {
    if (shape === 'blade') {
      paintCrescentBlade(g, { enemy: false });
      return;
    }
    if (shape === 'crescent') {
      paintCrescentBlade(g, { enemy: true });
      return;
    }
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
  });
}

export async function createFlightView(host, onResize) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'low-power',
    preserveDrawingBuffer: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-label', '加纳战机飞行战场');
  host.append(renderer.domElement);
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
  const fields = [];
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
    const [craft, boss, terrain, moonblade, ...maps] = await Promise.all([
      ...['craft', 'bosses', 'landmarks'].map((n) => loader.loadAsync(BASE + n + '.webp').then(own)),
      loader.loadAsync('./assets/weapon-moonblade.png').then(own),
      ...Array.from({ length: 9 }, (_, i) => loader.loadAsync(BASE + 'field-' + i + '.webp').then(own)),
    ]);
    tileAtlas('c', craft, 5, 4);
    tileAtlas('b', boss, 4, 4);
    tileAtlas('t', terrain, 4, 4);
    const bladeMat = material('moonblade', moonblade, true);
    bladeMat.alphaTest = 0.06;
    const ghostMat = new THREE.MeshBasicMaterial({
      map: moonblade,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      depthTest: false,
    });
    materials.set('moonbladeGhost', ghostMat);
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
  const crescentTrail = new Map();
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
    for (const e of s.enemies) {
      if (e.age < 0) continue;
      if (e.path === 'surface' && e.age < 34) {
        draw(ring, e.x, e.y, 9 + e.age * 0.28, 4 + e.age * 0.13);
        continue;
      }
      if (e.path === 'opening') {
        draw('c' + CRAFT.courier, e.x, e.y, 16, 16, Math.sin(e.age * 0.05) * 0.06);
        const tag = String(e.dropGun || 1);
        if (e.dropGun === 3) draw('moonblade', e.x, e.y + 13, 14, 14, e.age * 0.08);
        draw(symbol('badge', e.dropGun === 3 ? GOLD : '#aceaf1', tag), e.x, e.y + 13, e.dropGun === 3 ? 11 : 12);
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
      if (id != null) draw('c' + id, i.x, i.y, i.kind === 'wing' ? 18 : 15);
      else {
        const tag = i.kind.startsWith('gun')
          ? i.kind.slice(3)
          : i.kind.startsWith('bomb')
            ? i.kind.slice(4)
            : i.kind === 'chip'
              ? 'P'
              : '★';
        const badgeSize = i.isOpening ? 15 : 13.5;
        if (i.kind === 'gun3') {
          draw('moonblade', i.x, i.y, badgeSize + 8, badgeSize + 8, i.age * 0.09);
        }
        draw(
          symbol('badge', i.kind.startsWith('bomb') ? '#fac081' : i.kind === 'gun3' ? GOLD : '#aceaf1', tag),
          i.x,
          i.y,
          i.kind === 'gun3' ? badgeSize - 1.5 : badgeSize,
        );
      }
    }
    // 圆月弯刀直接复用跳台原画 weapon-moonblade.png 素材，残影留在渲染层。
    const live = new Set();
    for (const shot of s.shots) {
      if (shot.gun === 3) {
        live.add(shot);
        const spin = crescentSpin(shot.age, shot.spinDir || 1);
        const size = crescentDrawSize(shot.r);
        let trail = crescentTrail.get(shot);
        if (!trail) {
          trail = [];
          crescentTrail.set(shot, trail);
        }
        trail.push({ x: shot.x, y: shot.y, spin });
        if (trail.length > 3) trail.shift();
        for (let i = 0; i < trail.length - 1; i++) {
          const ghost = trail[i];
          const fade = (i + 1) / trail.length;
          const gSize = size * (0.62 + fade * 0.22);
          draw('moonbladeGhost', ghost.x, ghost.y, gSize, gSize, ghost.spin);
        }
        draw('moonblade', shot.x, shot.y, size, size, spin);
        continue;
      }
      const a = Math.atan2(shot.vy, shot.vx) + Math.PI / 2;
      const shape = ['', 'beam', 'dot', 'blade', 'flame', 'beam'][shot.gun],
        color = ['', BLUE, '#dc8cff', '#38c6ff', '#ffad22', '#66ffd9'][shot.gun];
      draw(
        symbol(shape, color),
        shot.x,
        shot.y,
        shot.r * 2.5,
        shot.gun === 5 ? 16 : shot.gun === 4 ? 26 : shot.gun === 1 ? 8.5 : shot.r * 3.5,
        a,
      );
    }
    for (const key of crescentTrail.keys()) if (!live.has(key)) crescentTrail.delete(key);
    const p = s.ship;
    if (p.inv <= 0 || Math.floor(p.inv / 6) % 2 === 0) {
      const tilt = p.dx * 0.045;
      const pulse = 0.86 + Math.sin(s.frame * 0.48) * 0.2;
      if (p.wing) {
        const haloSize = 54 + Math.sin(s.frame * 0.12) * 3;
        draw('wingHalo', p.x, p.y + 1, haloSize, haloSize * 0.84, 0);
        draw(symbol('flame', '#ff9c24'), p.x, p.y + 19, 7.6, 14 * pulse, Math.PI + tilt);
        draw(symbol('flame', '#5ceeff'), p.x - 12.2, p.y + 18, 5.4, 11 * pulse, Math.PI + tilt);
        draw(symbol('flame', '#5ceeff'), p.x + 12.2, p.y + 18, 5.4, 11 * pulse, Math.PI + tilt);
        draw('shipWinged', p.x, p.y, WINGED_SHIP_WIDTH, WINGED_SHIP_HEIGHT, tilt);
      } else {
        draw(symbol('flame', '#ff9c24'), p.x, p.y + 14.5, 6.2, 10.5 * pulse, Math.PI + tilt);
        draw('shipBase', p.x, p.y, BASE_SHIP_SIZE, BASE_SHIP_SIZE, tilt);
      }
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
      if (b.kind === 'F') draw(symbol('ring', '#ff9732'), g.x, g.y, g.ring * 2.2);
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
    }
    for (let i = used; i < meshes.length; i++) meshes[i].visible = false;
    renderer.render(scene, camera);
  }
  return { frame, dispose, getWidth: () => viewWidth };
}
