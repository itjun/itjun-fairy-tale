import * as THREE from 'three';
import { openingPoint } from './stages.js';
import { bombGeometry } from './arsenal.js';
import { branchTip, rabbitEye } from './bosses.js';
import { visibleTerrain, ENTRY_FRAME, solarSide } from './terrain.js';
import { flareWidth } from './flight.js';

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
function textureFrom(paint) {
  const c = document.createElement('canvas');
  c.width = c.height = 96;
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
    g.strokeStyle = '#fff6de';
    g.lineWidth = 9;
    g.fillStyle = color;
    g.beginPath();
    switch (shape) {
      case 'crescent':
        g.moveTo(72, 12);
        g.quadraticCurveTo(12, 38, 45, 84);
        g.quadraticCurveTo(6, 71, 14, 42);
        g.quadraticCurveTo(28, 6, 72, 12);
        break;
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

export async function createFlightView(host) {
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
    const [craft, boss, terrain, ...maps] = await Promise.all(
      ['craft', 'bosses', 'landmarks', ...Array.from({ length: 9 }, (_, i) => 'field-' + i)].map((n) =>
        loader.loadAsync(BASE + n + '.webp').then(own),
      ),
    );
    tileAtlas('c', craft, 5, 4);
    tileAtlas('b', boss, 4, 4);
    tileAtlas('t', terrain, 4, 4);
    maps.forEach((tex, i) => {
      tex.wrapT = THREE.RepeatWrapping;
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
    if (width && height) renderer.setSize(width, height, false);
  };
  observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  const dot = symbol('dot', HOT),
    ring = symbol('ring', BLUE),
    laser = symbol('beam', '#ff4e6b');
  function frame(s) {
    used = 0;
    const entry = ENTRY_FRAME[s.area];
    const edge = Math.min(240, Math.max(0, (s.areaTick - entry) * 8));
    const arriving = entry > 0 && edge < 240;
    const field = arriving ? 0 : s.area;
    fields[field].offset.y = s.scroll / 240;
    if (field === 7) {
      const row = Math.floor(s.scroll / 240);
      fields[7].offset.y = 0;
      for (let i = row; i <= row + 1; i++)
        draw(solarSide(i) === 1 ? 'field7' : 'solarRight', 128, s.scroll - i * 240 + 120, 256, 240);
    } else draw('field' + field, 128, 120, 256, 240);
    if (arriving && edge > 0) {
      fields[s.area].offset.y = (s.scroll - edge) / 240;
      draw('field' + s.area, 128, edge - 120, 256, 240);
    }
    for (const m of visibleTerrain(s.area, s.scroll, s.areaTick))
      draw('t' + m.tile, m.x, m.y, m.width, m.width, m.turn);
    for (const h of s.hazards) {
      if (h.kind === 'flare') {
        if (h.age < 42) draw(symbol('ring', GOLD), h.x + h.sign * 4, h.y, 8 + Math.sin(h.age * 0.3) * 2);
        else line(symbol('flame', '#ff982d'), h.x, h.y, h.x + h.sign * flareWidth(h), h.y, 12);
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
        for (let delay = 60; delay >= 10; delay -= 10) {
          if (e.age < delay) continue;
          const echo = openingPoint(e, e.age - delay);
          draw('c' + CRAFT.courier, echo.x, echo.y, 9 + (60 - delay) * 0.07);
        }
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
      if (id != null) draw('c' + id, i.x, i.y, 15);
      else {
        const tag = i.kind.startsWith('gun')
          ? i.kind.slice(3)
          : i.kind.startsWith('bomb')
            ? i.kind.slice(4)
            : i.kind === 'chip'
              ? 'P'
              : '★';
        draw(symbol('badge', i.kind.startsWith('bomb') ? '#fac081' : '#aceaf1', tag), i.x, i.y, 13);
      }
    }
    for (const shot of s.shots) {
      const a = Math.atan2(shot.vy, shot.vx) + Math.PI / 2;
      const shape = ['', 'beam', 'dot', 'crescent', 'flame', 'beam'][shot.gun],
        color = ['', BLUE, '#dc8cff', '#8078ff', '#ffad22', '#66ffd9'][shot.gun];
      draw(
        symbol(shape, color),
        shot.x,
        shot.y,
        shot.r * (shot.gun === 3 ? 3.8 : 2.5),
        shot.gun === 5 ? 14 : shot.gun === 4 ? 24 : shot.gun === 1 ? 7 : shot.r * 3.5,
        a,
      );
    }
    const p = s.ship;
    if (p.inv <= 0 || Math.floor(p.inv / 6) % 2 === 0)
      draw('c' + (p.wing ? 1 : 0), p.x, p.y, p.wing ? 21 : 15, p.wing ? 21 : 15, p.dx * 0.04);
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
      const g = bombGeometry(b, p);
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
  return { frame, dispose };
}
