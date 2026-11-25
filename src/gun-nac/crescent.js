// 加纳战机 3 号圆月弯刀：FC 原版锋利双尖月牙 + 彩笔青金涂色。
// 实战 Three.js 纹理与说明书演练屏共用同一绘制，保证外观一致。

const SIZE = 96;

function crescentPath(g, outer = 40, inner = 23, sweep = 2.15) {
  // FC 风格宽展 C 字月牙：外弧锋利双尖，内弧空心。
  const a0 = -sweep;
  const a1 = sweep;
  g.moveTo(48 + Math.cos(a0) * outer, 48 + Math.sin(a0) * outer);
  g.arc(48, 48, outer, a0, a1, false);
  const tipOut = 0.55;
  g.quadraticCurveTo(
    48 + Math.cos(a1) * (outer * tipOut + inner * (1 - tipOut)),
    48 + Math.sin(a1) * (outer * tipOut + inner * (1 - tipOut)),
    48 + Math.cos(a1) * inner,
    48 + Math.sin(a1) * inner,
  );
  g.arc(48, 48, inner, a1, a0, true);
  g.quadraticCurveTo(
    48 + Math.cos(a0) * (outer * tipOut + inner * (1 - tipOut)),
    48 + Math.sin(a0) * (outer * tipOut + inner * (1 - tipOut)),
    48 + Math.cos(a0) * outer,
    48 + Math.sin(a0) * outer,
  );
  g.closePath();
}

/** 在 96×96 画布上画一把彩笔圆月弯刀（默认朝右）。 */
export function paintCrescentBlade(g, options = {}) {
  const isEnemy = options.enemy === true;
  const bodyA = isEnemy ? '#fff0a8' : '#c8fbff';
  const bodyB = isEnemy ? '#ffc84a' : '#4ad8ff';
  const bodyC = isEnemy ? '#ff8a28' : '#2f74ff';
  const rim = isEnemy ? '#fff6de' : '#ffffff';
  const gold = isEnemy ? '#ffdf7b' : '#ffe97a';
  const ink = isEnemy ? '#7a3a12' : '#15245e';

  g.save();
  g.lineJoin = 'round';
  g.lineCap = 'round';

  // 外刃金边（略宽，缩放后仍能认出锋口）
  g.beginPath();
  crescentPath(g, 42, 20.5, 2.12);
  const rimGrad = g.createLinearGradient(12, 18, 84, 78);
  rimGrad.addColorStop(0, rim);
  rimGrad.addColorStop(0.35, gold);
  rimGrad.addColorStop(1, bodyB);
  g.fillStyle = rimGrad;
  g.fill();

  // 主刀身：实心青蓝，少噪点，偏 FC 轮廓
  g.beginPath();
  crescentPath(g, 36, 24.5, 2.0);
  const bodyGrad = g.createLinearGradient(20, 16, 76, 80);
  bodyGrad.addColorStop(0, rim);
  bodyGrad.addColorStop(0.22, bodyA);
  bodyGrad.addColorStop(0.58, bodyB);
  bodyGrad.addColorStop(1, bodyC);
  g.fillStyle = bodyGrad;
  g.fill();

  // 一两道顺弧彩笔高光，不做满屏乱线
  g.beginPath();
  g.arc(48, 48, 30.5, -1.55, 1.45);
  g.strokeStyle = 'rgba(255,255,255,.78)';
  g.lineWidth = 3.2;
  g.stroke();
  g.beginPath();
  g.arc(48, 48, 27, -1.35, 1.15);
  g.strokeStyle = gold;
  g.lineWidth = 1.6;
  g.globalAlpha = 0.55;
  g.stroke();
  g.globalAlpha = 1;

  // 粗彩笔描边
  g.beginPath();
  crescentPath(g, 42, 20.5, 2.12);
  g.strokeStyle = ink;
  g.lineWidth = 4.8;
  g.stroke();
  g.strokeStyle = rim;
  g.lineWidth = 1.8;
  g.stroke();

  // 刃尖亮点
  for (const a of [-2.12, 2.12]) {
    g.fillStyle = rim;
    g.beginPath();
    g.arc(48 + Math.cos(a) * 39.5, 48 + Math.sin(a) * 39.5, 2.8, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = gold;
    g.beginPath();
    g.arc(48 + Math.cos(a) * 39.5, 48 + Math.sin(a) * 39.5, 1.3, 0, Math.PI * 2);
    g.fill();
  }

  g.restore();
}

/** 生成可复用的 Canvas / ImageBitmap 源（96×96）。 */
export function makeCrescentCanvas(options = {}) {
  const c = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!c) return null;
  c.width = c.height = SIZE;
  paintCrescentBlade(c.getContext('2d'), options);
  return c;
}

export function crescentSpin(age, spinDir = 1) {
  return age * 0.34 * (spinDir || 1);
}

export function crescentRadius(level = 1) {
  const lv = Math.max(1, Math.min(8, level | 0));
  return 6.5 + ((lv - 1) / 7) * 2.1;
}

export function crescentDrawSize(r) {
  return r * 4.15;
}

export { SIZE as CRESCENT_SIZE };
