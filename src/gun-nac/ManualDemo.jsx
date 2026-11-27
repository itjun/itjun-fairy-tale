import { useEffect, useRef } from 'react';
import { paintCrescentBlade, crescentSpin, crescentDrawSize, crescentRadius } from './crescent.js';
import { makeShipCanvas } from './ship-art.js';

const BLUE = '#70dcff';
const PURPLE = '#dc8cff';
const FLAME = '#ffad22';
const BEAM = '#66ffd9';
const GOLD = '#ffd442';
const ICE = '#92e3ff';
const W = 256;
const H = 240;

function paintShape(g, shape, color, x, y, w, h = w, rot = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(w / 96, h / 96);
  g.translate(-48, -48);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.strokeStyle = '#fff6de';
  g.lineWidth = 9;
  g.fillStyle = color;
  g.beginPath();
  if (shape === 'blade') {
    paintCrescentBlade(g, { enemy: false });
    g.restore();
    return;
  }
  if (shape === 'beam') {
    g.roundRect(27, 5, 42, 86, 17);
  } else if (shape === 'flame') {
    g.moveTo(47, 6);
    g.quadraticCurveTo(82, 40, 71, 69);
    g.quadraticCurveTo(52, 99, 28, 72);
    g.quadraticCurveTo(17, 52, 47, 6);
  } else if (shape === 'ring') {
    g.arc(48, 48, 38, 0, Math.PI * 2);
    g.strokeStyle = color;
    g.lineWidth = 10;
    g.stroke();
    g.restore();
    return;
  } else {
    g.ellipse(48, 48, 32, 35, 0.15, 0, Math.PI * 2);
  }
  g.fill();
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,.75)';
  g.fillRect(36, 27, 10, 6);
  g.restore();
}

let cachedBaseShip;
let cachedWingedShip;
function drawCraft(g, _img, x, y, isWinged, t = 0) {
  if (!cachedBaseShip) cachedBaseShip = makeShipCanvas(false);
  if (!cachedWingedShip) cachedWingedShip = makeShipCanvas(true);
  const pulse = 0.86 + Math.sin(t * 0.42) * 0.18;
  if (isWinged) {
    paintShape(g, 'flame', FLAME, x, y + 10, 3, 5 * pulse, Math.PI);
    g.drawImage(cachedWingedShip, x - 13, y - 8, 26, 16);
  } else {
    paintShape(g, 'flame', FLAME, x, y + 10, 3, 5 * pulse, Math.PI);
    g.drawImage(cachedBaseShip, x - 8, y - 8, 16, 16);
  }
}

function drawEnemy(g, img, x, y, flash, size = 22) {
  if (flash > 0) {
    g.fillStyle = GOLD;
    g.beginPath();
    g.ellipse(x, y, size * 0.42, size * 0.36, 0, 0, Math.PI * 2);
    g.fill();
  }
  if (!img?.complete || !img.naturalWidth) {
    g.fillStyle = flash > 0 ? GOLD : '#ff643c';
    g.beginPath();
    g.ellipse(x, y, 12, 10, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#fff6de';
    g.lineWidth = 2;
    g.stroke();
    return;
  }
  const cols = 5,
    rows = 4,
    tw = img.naturalWidth / cols,
    th = img.naturalHeight / rows,
    idx = 2;
  g.drawImage(img, (idx % cols) * tw, Math.floor(idx / cols) * th, tw, th, x - size / 2, y - size / 2, size, size);
}

function drawItemSprite(g, img, kind, x, y, size = 28) {
  if (!img?.complete || !img.naturalWidth) {
    g.fillStyle = GOLD;
    g.beginPath();
    g.arc(x, y, size / 2, 0, Math.PI * 2);
    g.fill();
    return;
  }
  const map = { wing: 18, money: 17, life: 19, courier: 4 };
  const idx = map[kind] ?? 18;
  const cols = 5,
    rows = 4,
    tw = img.naturalWidth / cols,
    th = img.naturalHeight / rows;
  g.drawImage(img, (idx % cols) * tw, Math.floor(idx / cols) * th, tw, th, x - size / 2, y - size / 2, size, size);
}

function makeGunDemo(gun, level = 4) {
  const shots = [];
  const foes = [
    { x: W * 0.32, y: 52, alive: true, flash: 0, respawn: 0, phase: 0 },
    { x: W * 0.68, y: 64, alive: true, flash: 0, respawn: 0, phase: 1.7 },
    { x: W * 0.5, y: 38, alive: true, flash: 0, respawn: 0, phase: 3.2 },
  ];
  let cool = 0;
  let fireRun = 0;
  let sway = 0;
  let flip = 1;
  const nearest = (x, y) => {
    let best = null,
      dist = Infinity;
    for (const f of foes) {
      if (!f.alive) continue;
      const d = (f.x - x) ** 2 + (f.y - y) ** 2;
      if (d < dist) {
        best = f;
        dist = d;
      }
    }
    return best;
  };
  return {
    step(t) {
      sway = Math.sin(t * 0.035) * 22;
      const shipX = W * 0.5 + sway * 0.4;
      const shipY = H - 48;
      for (const f of foes) {
        if (!f.alive) {
          if (--f.respawn <= 0) {
            f.alive = true;
            f.flash = 0;
          }
          continue;
        }
        f.x = W * (0.28 + (f.phase % 3) * 0.22) + Math.sin(t * 0.03 + f.phase) * 18;
        f.y = 44 + Math.cos(t * 0.025 + f.phase) * 12 + (f.phase % 2) * 16;
        if (f.flash > 0) f.flash -= 1;
      }
      cool -= 1;
      if (gun === 4) fireRun += 1;
      else fireRun = 0;
      if (cool <= 0) {
        const up = -Math.PI / 2;
        const fire = (angle, speed, r, life, extra = {}) => {
          shots.push({
            x: shipX,
            y: shipY - 8,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            r,
            life,
            age: 0,
            trail: [],
            ...extra,
          });
        };
        if (gun === 1) {
          const angles = level === 1 ? [0] : level === 2 ? [-0.22, 0, 0.22] : [-0.42, -0.18, 0, 0.18, 0.42];
          if (level >= 4) angles.push(2.45, -2.45);
          angles.forEach((a) => fire(up + a, 5.4, 1.6, 48));
          cool = 8;
        } else if (gun === 2) {
          fire(up, 2.4, 4.2 + (level - 1) * 0.85, 70, { blast: 0 });
          cool = 18;
        } else if (gun === 3) {
          const count = Math.min(level, 8);
          const r = crescentRadius(level);
          flip = -flip;
          for (let i = 0; i < count; i++) {
            const side = i - (count - 1) / 2;
            fire(up + side * 0.42, 2.6, r, 120, {
              home: true,
              spinDir: side === 0 ? flip : Math.sign(side) || flip,
            });
          }
          cool = 14;
        } else if (gun === 4) {
          const count = Math.min(level, 6);
          for (let i = 0; i < count; i++)
            fire(up + (i - (count - 1) / 2) * 0.16, 3.2, 2.4, 64, { bend: sway * 0.012 });
          cool = 8;
        } else {
          const count = Math.min(8, level + 1);
          const gap = 4 + level * 0.7;
          for (let i = 0; i < count; i++)
            fire(up, 4.4, 1.6, 70, { x: shipX + (i - (count - 1) / 2) * gap });
          cool = 11;
        }
      }
      for (const s of shots) {
        s.age += 1;
        if (s.home) {
          if (!s.lock) {
            const goal = nearest(s.x, s.y);
            if (goal) s.lock = goal;
          }
          if (s.lock?.alive) {
            const ang = Math.atan2(s.lock.y - s.y, s.lock.x - s.x);
            const cur = Math.atan2(s.vy, s.vx);
            let d = ang - cur;
            while (d > Math.PI) d -= Math.PI * 2;
            while (d < -Math.PI) d += Math.PI * 2;
            const next = cur + Math.max(-0.26, Math.min(0.26, d));
            const spd = Math.min(3.6, Math.hypot(s.vx, s.vy) + 0.02);
            s.vx = Math.cos(next) * spd;
            s.vy = Math.sin(next) * spd;
          }
        }
        if (s.bend) s.vx += s.bend;
        s.x += s.vx;
        s.y += s.vy;
        s.life -= 1;
        if (gun === 2 && s.blast === 0 && (s.y < 70 || s.life < 8)) {
          s.blast = 1;
          s.life = 14;
          s.vx = 0;
          s.vy = 0;
          s.r = 22;
        }
        if (s.blast > 0) {
          s.blast += 1;
          s.r = 12 + s.blast * 1.6;
        }
        if (s.home) {
          s.trail.push({ x: s.x, y: s.y, spin: crescentSpin(s.age, s.spinDir || 1) });
          if (s.trail.length > 3) s.trail.shift();
        }
        for (const f of foes) {
          if (!f.alive) continue;
          if (Math.hypot(s.x - f.x, s.y - f.y) < s.r + 10) {
            if (s.hits?.has(f)) continue;
            s.hits?.add(f);
            f.flash = 8;
            if (gun !== 4 && gun !== 5) {
              f.alive = false;
              f.respawn = 44;
              if (!s.pierce || s.hits.size >= s.pierce) s.life = 0;
            }
          }
        }
      }
      for (let i = shots.length - 1; i >= 0; i--) if (shots[i].life <= 0) shots.splice(i, 1);
      return { shipX, shipY, shots, foes, winged: level >= 8 };
    },
  };
}

function makeBombDemo(kind) {
  let bomb = null;
  let wait = 0;
  const bullets = [];
  return {
    step(t) {
      const shipX = W * 0.5 + Math.sin(t * 0.04) * 22;
      const shipY = H - 42;
      if (t % 18 === 0) {
        bullets.push({
          x: 20 + Math.random() * (W - 40),
          y: 20 + Math.random() * 80,
          vx: (Math.random() - 0.5) * 1.2,
          vy: 1.1 + Math.random(),
          life: 90,
        });
      }
      for (const b of bullets) {
        b.x += b.vx;
        b.y += b.vy;
        b.life -= 1;
      }
      for (let i = bullets.length - 1; i >= 0; i--) if (bullets[i].life <= 0) bullets.splice(i, 1);
      wait -= 1;
      if (!bomb && wait <= 0) {
        bomb = { kind, age: 0, x: shipX, y: shipY - 8, power: 3, life: { F: 110, B: 100, T: 90, W: 130 }[kind] };
        wait = 40;
      }
      if (bomb) {
        bomb.age += 1;
        bomb.life -= 1;
        if (bomb.kind === 'F') {
          const ring = Math.min(bomb.age * 3, 48 + bomb.power * 10);
          for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            if (Math.abs(Math.hypot(b.x - bomb.x, b.y - bomb.y) - ring) < ring * 0.22) bullets.splice(i, 1);
          }
        } else if (bomb.kind === 'B') {
          const x = W * 0.5 - W * 0.55 * Math.cos(bomb.age * 0.05);
          for (let i = bullets.length - 1; i >= 0; i--) if (Math.abs(bullets[i].x - x) < 10) bullets.splice(i, 1);
        } else {
          for (let i = bullets.length - 1; i >= 0; i--) if (Math.random() < 0.08) bullets.splice(i, 1);
        }
        if (bomb.life <= 0) bomb = null;
      }
      return { shipX, shipY, bomb, bullets };
    },
  };
}

function makeItemDemo(kind) {
  let phase = 0;
  let winged = kind === 'wing' || kind === 'life';
  let flash = 0;
  const bullets = [];
  return {
    step(t) {
      phase += 1;
      const shipX = W * 0.5 + Math.sin(t * 0.03) * 10;
      const shipY = H - 48;
      const bob = Math.sin(t * 0.08) * 6;
      if (kind === 'wing') {
        const floating = phase < 90;
        if (phase === 90) winged = true;
        if (phase > 120 && phase % 40 === 0) bullets.push({ x: shipX + 40, y: 40, vx: -1.4, vy: 1.6, life: 70 });
        for (const b of bullets) {
          b.x += b.vx;
          b.y += b.vy;
          b.life -= 1;
          if (winged && Math.hypot(b.x - shipX, b.y - shipY) < 16) {
            b.life = 0;
            winged = false;
            flash = 12;
            phase = 0;
          }
        }
        for (let i = bullets.length - 1; i >= 0; i--) if (bullets[i].life <= 0) bullets.splice(i, 1);
        if (flash > 0) flash -= 1;
        return {
          shipX,
          shipY,
          winged,
          flash,
          bullets,
          float: floating ? { kind: 'wing', x: W * 0.5, y: 88 + bob } : null,
        };
      }
      if (kind === 'P' || kind === '★') {
        if (kind === '★' && phase % 100 === 40) {
          for (let i = 0; i < 6; i++)
            bullets.push({
              x: 30 + i * 36,
              y: 30 + (i % 2) * 24,
              vx: 0,
              vy: 0.8,
              life: 50,
              foe: true,
            });
        }
        if (kind === '★' && phase % 100 === 70) bullets.length = 0;
        for (const b of bullets) {
          b.y += b.vy;
          b.life -= 1;
        }
        for (let i = bullets.length - 1; i >= 0; i--) if (bullets[i].life <= 0) bullets.splice(i, 1);
        return {
          shipX,
          shipY,
          winged: false,
          float: { kind: 'badge', tag: kind, x: W * 0.5, y: 88 + bob, tone: BLUE },
          bullets,
          clearBurst: kind === '★' && phase % 100 > 70 && phase % 100 < 90,
        };
      }
      return {
        shipX,
        shipY,
        winged: kind === 'life',
        float: { kind, x: W * 0.5, y: 88 + bob },
        bullets,
      };
    },
  };
}

function makeDropDemo(kind) {
  return {
    step(t) {
      const shipX = W * 0.5 + Math.sin(t * 0.025) * 16;
      const shipY = H - 52;
      if (kind === 'wing') {
        const bargeY = 70 + Math.sin(t * 0.02) * 6;
        return {
          shipX,
          shipY,
          winged: false,
          float: { kind: 'wing', x: W * 0.5, y: bargeY + 28 },
          barge: { x: W * 0.5, y: bargeY },
        };
      }
      if (kind === 'courier') {
        const y = 36 + (t % 180) * 0.7;
        return {
          shipX,
          shipY,
          winged: false,
          couriers: y < H - 70 ? [{ x: W * 0.5, y, gun: 1 }] : [],
          float: { kind: 'money', x: W * 0.5, y: Math.min(H - 80, y + 24) },
        };
      }
      if (kind === 'money') {
        return {
          shipX,
          shipY,
          winged: true,
          float: { kind: 'money', x: W * 0.5, y: 96 + Math.sin(t * 0.08) * 6 },
          shop: true,
        };
      }
      return {
        shipX,
        shipY,
        winged: false,
        float: { kind: 'badge', tag: '05', x: W * 0.5, y: 90 + Math.sin(t * 0.06) * 5, tone: GOLD },
        hidden: true,
      };
    },
  };
}

function drawBombFx(g, bomb, shipX) {
  if (!bomb) return;
  const t = bomb.age,
    p = bomb.power;
  if (bomb.kind === 'F') {
    const ring = Math.min(t * 3, 48 + p * 10);
    g.strokeStyle = FLAME;
    g.lineWidth = Math.max(14, ring * 0.28);
    g.beginPath();
    g.arc(bomb.x, bomb.y, ring, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = '#fff6de';
    g.lineWidth = Math.max(3, ring * 0.06);
    g.stroke();
  } else if (bomb.kind === 'B') {
    const x = W * 0.5 - W * 0.55 * Math.cos(t * 0.05);
    g.strokeStyle = ICE;
    g.lineWidth = 8 + p;
    g.beginPath();
    g.moveTo(x, 8);
    g.lineTo(x, H - 8);
    g.stroke();
    g.strokeStyle = '#fff6de';
    g.lineWidth = 2;
    g.stroke();
  } else if (bomb.kind === 'T') {
    const x = shipX + Math.sin(t * 0.12) * 40;
    const rx = (k) => W * 0.5 + (x - W * 0.5) * k;
    const pts = [
      [x, 4],
      [rx(-0.65), 50],
      [rx(0.8), 105],
      [rx(-0.8), 155],
      [x, H - 8],
    ];
    g.strokeStyle = GOLD;
    g.lineWidth = 3 + p;
    g.lineJoin = 'round';
    g.beginPath();
    pts.forEach((pt, i) => (i ? g.lineTo(...pt) : g.moveTo(...pt)));
    g.stroke();
  } else if (bomb.kind === 'W') {
    if (t < 24) {
      for (let j = 0; j < 4; j++) paintShape(g, 'dot', BLUE, bomb.x + (j - 1.5) * t * 0.7, bomb.y - t * 5.2, 10 + p);
    } else {
      for (let i = 0; i < 5; i++) {
        const dx = (29 + i * 36 + Math.floor(t / 40) * 14) % W;
        const dy = (((t - 24) * 3.2 + i * 34) % (H + 40)) - 20;
        paintShape(g, 'flame', BLUE, dx, dy, 14, 20);
      }
    }
  }
}

let sharedCraft;
function craftImage() {
  if (!sharedCraft) {
    sharedCraft = new Image();
    sharedCraft.src = './gun-nac/craft.webp';
  }
  return sharedCraft;
}

export function ManualDemo({ tab, item, level = 4 }) {
  const hostRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !item || !host) return;
    const g = canvas.getContext('2d');
    let raf = 0;
    let t = 0;
    let isAlive = true;
    let isVisible = true;
    let demo;
    if (tab === 'guns') demo = makeGunDemo(Number(item.tag), level);
    else if (tab === 'bombs') demo = makeBombDemo(item.tag);
    else if (tab === 'drops') demo = makeDropDemo(item.demo || item.sprite || item.tag);
    else demo = makeItemDemo(item.sprite || item.tag);
    const craft = craftImage();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 高清图集缩到说明书小格时保持平滑，不出锯齿。
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';

    const loop = () => {
      if (!isAlive) return;
      raf = requestAnimationFrame(loop);
      if (!isVisible) return;
      t += 1;
      const state = demo.step(t);
      g.clearRect(0, 0, W, H);
      g.fillStyle = '#142044';
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < 18; i++) {
        const sx = (i * 37 + t * 0.4) % W;
        const sy = (i * 53 + t * 0.9) % H;
        g.fillStyle = 'rgba(255,246,222,.18)';
        g.fillRect(sx, sy, 2, 2);
      }

      if (tab === 'guns') {
        const { shipX, shipY, shots, foes, winged } = state;
        for (const f of foes) {
          if (!f.alive) continue;
          drawEnemy(g, craft, f.x, f.y, f.flash);
        }
        for (const s of shots) {
          const gun = Number(item.tag);
          if (gun === 3) {
            const size = crescentDrawSize(s.r);
            paintShape(g, 'blade', BLUE, s.x, s.y, size, size, crescentSpin(s.age, s.spinDir || 1));
            continue;
          }
          const a = Math.atan2(s.vy, s.vx) + Math.PI / 2;
          const shape = ['', 'beam', 'dot', 'blade', 'flame', 'beam'][gun];
          const color = ['', BLUE, PURPLE, BLUE, FLAME, BEAM][gun];
          const fade = gun === 4 ? Math.max(0.35, 1 - s.age / Math.max(8, s.life + s.age)) : 1;
          const rw = s.blast > 0 ? Math.min(28, 8 + s.blast) : gun === 5 ? 2.4 : gun === 1 ? 2 : s.r * 2;
          const rh = s.blast > 0 ? Math.min(28, 8 + s.blast) : gun === 5 ? 10 : gun === 4 ? 8 + fade * 14 : gun === 1 ? 7 : s.r * 2;
          paintShape(g, shape, color, s.x, s.y, rw, rh, a);
        }
        drawCraft(g, craft, shipX, shipY, winged, t);
      } else if (tab === 'bombs') {
        const { shipX, shipY, bomb, bullets } = state;
        for (const b of bullets || []) {
          g.fillStyle = '#ff643c';
          g.beginPath();
          g.arc(b.x, b.y, 3, 0, Math.PI * 2);
          g.fill();
        }
        drawBombFx(g, bomb, shipX);
        drawCraft(g, craft, shipX, shipY, true, t);
      } else if (tab === 'drops') {
        const { shipX, shipY, winged, float, couriers, barge, shop, hidden } = state;
        if (barge) {
          g.fillStyle = '#3a8f5a';
          g.strokeStyle = '#fff6de';
          g.lineWidth = 2;
          g.beginPath();
          g.roundRect(barge.x - 36, barge.y - 10, 72, 22, 8);
          g.fill();
          g.stroke();
        }
        if (couriers) {
          for (const c of couriers) {
            drawItemSprite(g, craft, 'courier', c.x, c.y, 16);
            g.fillStyle = '#aceaf1';
            g.strokeStyle = '#fff6de';
            g.lineWidth = 2;
            g.beginPath();
            g.roundRect(c.x - 8, c.y + 11, 16, 14, 4);
            g.fill();
            g.stroke();
            g.fillStyle = '#192047';
            g.font = 'bold 11px sans-serif';
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.fillText(String(c.gun), c.x, c.y + 18);
          }
        }
        if (shop) {
          g.fillStyle = 'rgba(255,223,123,.15)';
          g.strokeStyle = '#ffdf7b';
          g.lineWidth = 2;
          g.beginPath();
          g.roundRect(28, 28, W - 56, 70, 10);
          g.fill();
          g.stroke();
          g.fillStyle = '#ffdf7b';
          g.font = 'bold 16px sans-serif';
          g.textAlign = 'center';
          g.fillText('星际补给站', W * 0.5, 56);
          g.fillStyle = '#fff4da';
          g.font = '13px sans-serif';
          g.fillText('枪 / 机翼 ¥10　连射 ¥6', W * 0.5, 78);
        }
        if (hidden) {
          g.fillStyle = '#9be8fa';
          g.font = 'bold 14px sans-serif';
          g.textAlign = 'center';
          g.fillText('声音测试 → 05', W * 0.5, 48);
          g.fillStyle = '#fff4da';
          g.font = '13px sans-serif';
          g.fillText('出发地区 → 0 隐藏星域', W * 0.5, 70);
        }
        if (float?.kind === 'badge') {
          g.fillStyle = float.tone;
          g.strokeStyle = '#fff6de';
          g.lineWidth = 3;
          g.beginPath();
          g.roundRect(float.x - 16, float.y - 16, 32, 32, 8);
          g.fill();
          g.stroke();
          g.fillStyle = '#192047';
          g.font = 'bold 16px sans-serif';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(float.tag, float.x, float.y + 1);
        } else if (float) {
          drawItemSprite(g, craft, float.kind, float.x, float.y, 32);
        }
        drawCraft(g, craft, shipX, shipY, winged, t);
      } else {
        const { shipX, shipY, winged, float, bullets, clearBurst, flash } = state;
        if (clearBurst) {
          g.strokeStyle = GOLD;
          g.lineWidth = 3;
          g.beginPath();
          g.arc(shipX, shipY, 20 + (t % 20) * 4, 0, Math.PI * 2);
          g.stroke();
        }
        for (const b of bullets || []) {
          if (b.foe) drawEnemy(g, craft, b.x, b.y, 0, 18);
          else {
            g.fillStyle = '#ff643c';
            g.beginPath();
            g.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
            g.fill();
          }
        }
        if (float?.kind === 'badge') {
          g.fillStyle = float.tone;
          g.strokeStyle = '#fff6de';
          g.lineWidth = 3;
          g.beginPath();
          g.roundRect(float.x - 16, float.y - 16, 32, 32, 8);
          g.fill();
          g.stroke();
          g.fillStyle = '#192047';
          g.font = 'bold 18px sans-serif';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(float.tag, float.x, float.y + 1);
        } else if (float) {
          drawItemSprite(g, craft, float.kind, float.x, float.y, 32);
        }
        if (flash > 0) {
          g.strokeStyle = GOLD;
          g.lineWidth = 3;
          g.beginPath();
          g.arc(shipX, shipY, 18, 0, Math.PI * 2);
          g.stroke();
        }
        drawCraft(g, craft, shipX, shipY, winged, t);
      }
    };
    raf = requestAnimationFrame(loop);
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
      },
      { threshold: 0.05 },
    );
    observer.observe(host);
    return () => {
      isAlive = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [tab, item, level]);

  return (
    <div ref={hostRef} className="gn-manual-demo" aria-hidden="true">
      <canvas ref={canvasRef} width={W} height={H} />
    </div>
  );
}
