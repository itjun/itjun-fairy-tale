// 加纳战机彩笔机体与双炮光翼重装护铠绘制：实战 Three.js、说明书演练与通关画面共用。

export const SHIP_CANVAS_SIZE = 180;
export const BASE_SHIP_SIZE = 28;
export const WINGED_SHIP_WIDTH = 52;
export const WINGED_SHIP_HEIGHT = 42;

const CX = 90;
const INK = '#121a3d';
const CREAM = '#fffdf4';

function mirrorPoly(g, points) {
  for (const sign of [-1, 1]) {
    g.beginPath();
    points.forEach(([dx, y], idx) => {
      const x = CX + sign * dx;
      if (idx === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    });
    g.closePath();
    g.fill();
    g.stroke();
  }
}

function crayonStrokes(g, lines, color, width = 3.2, alpha = 0.7) {
  g.save();
  g.strokeStyle = color;
  g.lineWidth = width;
  g.globalAlpha = alpha;
  g.lineCap = 'round';
  for (const [dx1, y1, dx2, y2] of lines) {
    for (const sign of [-1, 1]) {
      g.beginPath();
      g.moveTo(CX + sign * dx1, y1);
      g.lineTo(CX + sign * dx2, y2);
      g.stroke();
    }
  }
  g.restore();
}

function paintCoreFuselage(g, isArmored = false) {
  const noseTop = isArmored ? 14 : 16;
  const tailY = isArmored ? 144 : 150;
  const halfW = isArmored ? 23 : 26;

  if (!isArmored) {
    // 基础战机：鲜明亮红+金边大三角后掠翼，在深蓝星空背景上高对比度清晰醒目
    const wingGrad = g.createLinearGradient(20, 72, 160, 142);
    wingGrad.addColorStop(0, '#ff6b6b');
    wingGrad.addColorStop(0.5, '#ff3b4e');
    wingGrad.addColorStop(1, '#ff9f2e');
    g.fillStyle = wingGrad;
    g.strokeStyle = INK;
    g.lineWidth = 5.5;
    mirrorPoly(g, [
      [18, 70],
      [74, 114],
      [70, 138],
      [20, 130],
    ]);

    // 机翼前缘亮金彩笔边
    g.fillStyle = '#ffe156';
    g.lineWidth = 4.2;
    mirrorPoly(g, [
      [19, 71],
      [73, 113],
      [66, 121],
      [19, 86],
    ]);
    crayonStrokes(g, [[34, 108, 60, 128]], '#fff7d6', 3.2, 0.8);
  }

  // 尾部金属喷口装甲座
  g.fillStyle = '#3a528f';
  g.strokeStyle = INK;
  g.lineWidth = 5;
  g.beginPath();
  g.roundRect(CX - 16, tailY - 8, 32, 18, 6);
  g.fill();
  g.stroke();

  // 饱满流线型洁白机身
  const bodyGrad = g.createLinearGradient(CX - halfW, noseTop, CX + halfW, tailY);
  bodyGrad.addColorStop(0, '#ffffff');
  bodyGrad.addColorStop(0.6, CREAM);
  bodyGrad.addColorStop(1, '#d9efff');
  g.fillStyle = bodyGrad;
  g.strokeStyle = INK;
  g.lineWidth = 5.6;
  const fuselagePath = () => {
    g.beginPath();
    g.moveTo(CX, noseTop);
    g.quadraticCurveTo(CX + halfW, noseTop + 38, CX + halfW, tailY - 14);
    g.lineTo(CX + 16, tailY);
    g.lineTo(CX - 16, tailY);
    g.lineTo(CX - halfW, tailY - 14);
    g.quadraticCurveTo(CX - halfW, noseTop + 38, CX, noseTop);
    g.closePath();
  };
  fuselagePath();
  g.fill();

  // 机身内部红鼻锥与彩笔蓝金涂装
  g.save();
  fuselagePath();
  g.clip();

  g.fillStyle = '#ff384c';
  g.beginPath();
  g.moveTo(CX - 36, noseTop - 4);
  g.lineTo(CX + 36, noseTop - 4);
  g.lineTo(CX + 32, noseTop + 38);
  g.quadraticCurveTo(CX, noseTop + 47, CX - 32, noseTop + 38);
  g.closePath();
  g.fill();

  g.fillStyle = '#ffd83b';
  g.fillRect(CX - 30, noseTop + 36, 60, 7);

  g.fillStyle = '#2d8cff';
  g.fillRect(CX - 30, tailY - 34, 60, 18);
  crayonStrokes(g, [[13, noseTop + 52, 15, tailY - 18]], '#7cc8ff', 3.4, 0.65);
  g.restore();

  // 重描机身粗彩笔外轮廓
  g.strokeStyle = INK;
  g.lineWidth = 5.6;
  fuselagePath();
  g.stroke();

  // 湛蓝宝石座舱盖
  const canopyY = noseTop + 66;
  const canopyGrad = g.createLinearGradient(CX - 12, canopyY - 22, CX + 12, canopyY + 22);
  canopyGrad.addColorStop(0, '#c4fbff');
  canopyGrad.addColorStop(0.42, '#38c8ff');
  canopyGrad.addColorStop(1, '#1954d1');
  g.fillStyle = canopyGrad;
  g.strokeStyle = INK;
  g.lineWidth = 4.8;
  g.beginPath();
  g.ellipse(CX, canopyY, 12.5, 23, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  g.strokeStyle = '#ffffff';
  g.lineWidth = 3.6;
  g.beginPath();
  g.arc(CX, canopyY - 3, 7.8, -2.35, -0.95);
  g.stroke();
}

/** 在 180×180 画布绘制放大清晰版彩笔基础战机。 */
export function paintBaseShip(g) {
  g.save();
  g.lineJoin = 'round';
  g.lineCap = 'round';
  paintCoreFuselage(g, false);
  g.restore();
}

/** 在 180×180 画布绘制高对比双炮光翼重装合体战机。 */
export function paintWingedShip(g) {
  g.save();
  g.lineJoin = 'round';
  g.lineCap = 'round';

  // 1. 外展三翎电光青彩笔能量光羽（在深蓝背景上璀璨夺目）
  const featherGrad = g.createLinearGradient(4, 62, 176, 156);
  featherGrad.addColorStop(0, '#ffffff');
  featherGrad.addColorStop(0.3, '#6cf6ff');
  featherGrad.addColorStop(0.75, '#2bb8ff');
  featherGrad.addColorStop(1, '#84faff');
  g.fillStyle = featherGrad;
  g.strokeStyle = '#e8fdff';
  g.lineWidth = 3.2;
  mirrorPoly(g, [
    [48, 86],
    [87, 68],
    [83, 92],
    [52, 102],
  ]);
  mirrorPoly(g, [
    [44, 100],
    [88, 96],
    [80, 118],
    [46, 116],
  ]);
  mirrorPoly(g, [
    [38, 112],
    [78, 122],
    [68, 144],
    [36, 128],
  ]);

  // 2. 翼下双副引擎重型喷口
  g.fillStyle = '#364f8c';
  g.strokeStyle = INK;
  g.lineWidth = 4.6;
  for (const sign of [-1, 1]) {
    g.beginPath();
    g.roundRect(CX + sign * 42 - 10, 130, 20, 18, 5);
    g.fill();
    g.stroke();
  }

  // 3. 高对比洁白+天蓝主装甲重翼（轮廓硬朗宽阔）
  const armorGrad = g.createLinearGradient(12, 54, 168, 138);
  armorGrad.addColorStop(0, '#ffffff');
  armorGrad.addColorStop(0.5, '#eaf6ff');
  armorGrad.addColorStop(1, '#79cbff');
  g.fillStyle = armorGrad;
  g.strokeStyle = INK;
  g.lineWidth = 5.5;
  mirrorPoly(g, [
    [18, 62],
    [52, 52],
    [82, 86],
    [76, 132],
    [50, 122],
    [36, 135],
    [17, 124],
  ]);

  // 4. 醒目亮金破风前缘重甲带
  const goldGrad = g.createLinearGradient(14, 50, 84, 96);
  goldGrad.addColorStop(0, '#fff7ad');
  goldGrad.addColorStop(0.55, '#ffd43b');
  goldGrad.addColorStop(1, '#ff922b');
  g.fillStyle = goldGrad;
  g.strokeStyle = INK;
  g.lineWidth = 4.6;
  mirrorPoly(g, [
    [19, 63],
    [52, 52],
    [81, 85],
    [71, 97],
    [49, 69],
    [20, 78],
  ]);

  // 5. 翼尖绯红闪电刀翼（Winglets）
  g.fillStyle = '#ff3b4e';
  g.strokeStyle = INK;
  g.lineWidth = 4.6;
  mirrorPoly(g, [
    [66, 78],
    [85, 58],
    [82, 134],
    [67, 118],
  ]);

  crayonStrokes(
    g,
    [
      [28, 92, 62, 112],
      [32, 106, 58, 120],
    ],
    '#3da5ff',
    3.4,
    0.75,
  );

  // 6. 左右双门向前突出的加长重型肩炮 + 炮口金芒
  for (const sign of [-1, 1]) {
    const cx = CX + sign * 48;
    // 发光炮口芯
    g.fillStyle = '#ffe45e';
    g.strokeStyle = INK;
    g.lineWidth = 4;
    g.beginPath();
    g.roundRect(cx - 5.5, 18, 11, 24, 5);
    g.fill();
    g.stroke();

    // 白银重炮舱
    g.fillStyle = '#ffffff';
    g.lineWidth = 4.6;
    g.beginPath();
    g.roundRect(cx - 8.5, 36, 17, 46, 6);
    g.fill();
    g.stroke();

    // 炮身赤红能量环
    g.fillStyle = '#ff444f';
    g.fillRect(cx - 6.5, 48, 13, 10);
  }

  // 7. 翼肩菱形黄金护盾晶核
  for (const sign of [-1, 1]) {
    const gx = CX + sign * 29;
    const gy = 98;
    g.fillStyle = '#ffe042';
    g.strokeStyle = INK;
    g.lineWidth = 4.2;
    g.beginPath();
    g.moveTo(gx, gy - 12);
    g.lineTo(gx + 9.5, gy);
    g.lineTo(gx, gy + 12);
    g.lineTo(gx - 9.5, gy);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(gx - 2, gy - 3.5, 2.6, 0, Math.PI * 2);
    g.fill();
  }

  // 8. 中央强化主机身
  paintCoreFuselage(g, true);
  g.restore();
}

export function makeShipCanvas(isWinged = false) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = SHIP_CANVAS_SIZE;
  const ctx = c.getContext('2d');
  if (isWinged) paintWingedShip(ctx);
  else paintBaseShip(ctx);
  return c;
}
