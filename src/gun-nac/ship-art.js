// 中国歼-20（J-20“威龙”）第五代重型隐身战斗机彩笔绘制：
// 基础态还原歼-20 经典「银杏叶金属银灰割裂隐身迷彩 + 亮银白吸波材料浅色包边（RAM）+ 琥珀金导电镀膜水滴座舱盖 + 菱形机头 + 全动切尖鸭翼 + 切尖大三角主翼 + 八一机徽 + 外倾双垂尾 + 双发锯齿尾喷管」；
// 装上外置机翼护铠后合体展开隐身折角超音速重装外翼、前伸式双联电磁轨道脉冲炮与脱体涡流电光刃翼。

export const SHIP_CANVAS_SIZE = 200;
export const BASE_SHIP_WIDTH = 46;
export const BASE_SHIP_HEIGHT = 48;
export const BASE_SHIP_SIZE = BASE_SHIP_WIDTH;
export const WINGED_SHIP_WIDTH = 66;
export const WINGED_SHIP_HEIGHT = 56;

const CX = 100;
const INK = '#0b132b';
const RAM_LIGHT = '#f2f7ff';
const CHINA_RED = '#e62429';
const STAR_GOLD = '#ffdf38';

function mirrorPoly(g, points, doStroke = true) {
  for (const sign of [-1, 1]) {
    g.beginPath();
    points.forEach(([dx, y], idx) => {
      const x = CX + sign * dx;
      if (idx === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    });
    g.closePath();
    g.fill();
    if (doStroke) g.stroke();
  }
}

function drawStar(g, cx, cy, outerR, innerR) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.fill();
}

/** 绘制中国空军红金五角星「八一」机徽。 */
function drawAirForceStar(g, cx, cy, r) {
  g.fillStyle = CHINA_RED;
  g.strokeStyle = STAR_GOLD;
  g.lineWidth = 1.5;
  g.beginPath();
  g.rect(cx - r * 1.95, cy - r * 0.36, r * 3.9, r * 0.72);
  g.fill();
  g.stroke();

  g.fillStyle = STAR_GOLD;
  drawStar(g, cx, cy, r * 1.18, r * 0.5);
  g.fillStyle = CHINA_RED;
  drawStar(g, cx, cy, r * 0.9, r * 0.38);
}

/** 绘制歼-20（J-20“威龙”）高辨识度俯视核心机体。 */
function paintJ20Core(g, isArmored = false) {
  // 1. 双发锯齿收敛隐身尾喷管（并列双发金属喷口）
  for (const sign of [-1, 1]) {
    const nx = CX + sign * 13;
    const nGrad = g.createLinearGradient(nx - 8.5, 160, nx + 8.5, 184);
    nGrad.addColorStop(0, '#5a73a3');
    nGrad.addColorStop(0.55, '#2b3c63');
    nGrad.addColorStop(1, '#151e36');
    g.fillStyle = nGrad;
    g.strokeStyle = INK;
    g.lineWidth = 3.8;
    g.beginPath();
    g.moveTo(nx - 8.5, 160);
    g.lineTo(nx + 8.5, 160);
    g.lineTo(nx + 7, 181);
    g.lineTo(nx + 3.2, 176);
    g.lineTo(nx, 182);
    g.lineTo(nx - 3.2, 176);
    g.lineTo(nx - 7, 181);
    g.closePath();
    g.fill();
    g.stroke();
  }

  // 2. 歼-20 主机体气动轮廓（菱形修长前机身 + DSI 进气道 + 切尖大三角主翼 + 锯齿尾撑）
  const wingSpan = isArmored ? 70 : 78;
  const hullGrad = g.createLinearGradient(CX - wingSpan, 10, CX + wingSpan, 174);
  hullGrad.addColorStop(0, '#c7d8ee');
  hullGrad.addColorStop(0.45, '#9ab2d1');
  hullGrad.addColorStop(1, '#7c96ba');

  const mainWingPath = () => {
    g.beginPath();
    // 尖锐菱形隐身机头
    g.moveTo(CX, 10);
    g.lineTo(CX + 10, 35);
    // DSI 鼓包进气道斜切唇口
    g.lineTo(CX + 18.5, 57);
    g.lineTo(CX + 22, 63);
    g.lineTo(CX + 20.5, 92);
    // 切尖大三角主翼前缘
    g.lineTo(CX + wingSpan, 138);
    // 平切翼尖
    g.lineTo(CX + wingSpan, 155);
    // 隐身前向折角后缘 + 外侧尾撑
    g.lineTo(CX + 31, 163);
    g.lineTo(CX + 26, 174);
    g.lineTo(CX + 20, 168);
    // 双发间中央短尾椎
    g.lineTo(CX + 5, 168);
    g.lineTo(CX, 174);
    g.lineTo(CX - 5, 168);
    g.lineTo(CX - 20, 168);
    g.lineTo(CX - 26, 174);
    g.lineTo(CX - 31, 163);
    g.lineTo(CX - wingSpan, 155);
    g.lineTo(CX - wingSpan, 138);
    g.lineTo(CX - 20.5, 92);
    g.lineTo(CX - 22, 63);
    g.lineTo(CX - 18.5, 57);
    g.lineTo(CX - 10, 35);
    g.closePath();
  };

  g.fillStyle = hullGrad;
  mainWingPath();
  g.fill();

  // 3. 歼-20 标志性的「银杏叶割裂几何隐身迷彩」+ 亮银白吸波涂层滚边（RAM Edge）
  g.save();
  mainWingPath();
  g.clip();

  // 深银灰折角隐身迷彩色块
  g.fillStyle = '#627b9e';
  mirrorPoly(
    g,
    [
      [0, 84],
      [25, 96],
      [48, 124],
      [35, 147],
      [14, 137],
      [0, 150],
    ],
    false,
  );
  g.fillStyle = '#536c8f';
  mirrorPoly(
    g,
    [
      [38, 124],
      [68, 140],
      [66, 156],
      [42, 160],
    ],
    false,
  );

  // 机鼻深灰隐身雷达罩（带锯齿防雷分界折线）
  g.fillStyle = '#5d7394';
  g.beginPath();
  g.moveTo(CX, 10);
  g.lineTo(CX + 11, 37);
  g.lineTo(CX + 4.5, 34);
  g.lineTo(CX, 39);
  g.lineTo(CX - 4.5, 34);
  g.lineTo(CX - 11, 37);
  g.closePath();
  g.fill();

  // 全机边缘亮银白隐身吸波涂层包边（歼-20 真机最具辨识度的浅色亮边，同时在深蓝星空背景上轮廓锋利夺目！）
  g.strokeStyle = RAM_LIGHT;
  g.lineWidth = 6.5;
  mainWingPath();
  g.stroke();

  // 双发机背隆起脊线与锯齿舱盖线
  g.strokeStyle = '#dce8f7';
  g.lineWidth = 2.2;
  for (const sign of [-1, 1]) {
    g.beginPath();
    g.moveTo(CX + sign * 11.5, 86);
    g.lineTo(CX + sign * 13.5, 164);
    g.stroke();
  }

  // 主翼面醒目的中国空军红金五角星机徽
  const starX = isArmored ? 44 : 48;
  drawAirForceStar(g, CX - starX, 143, 6.4);
  drawAirForceStar(g, CX + starX, 143, 6.4);

  g.restore();

  // 重描机体深蓝黑彩笔外轮廓
  g.strokeStyle = INK;
  g.lineWidth = 4.4;
  mainWingPath();
  g.stroke();

  // 4. 灵魂特征：近距耦合「全动切尖鸭翼」（Canards，银灰芯 + 亮银白隐身包边）
  const canardPath = (sign) => {
    g.beginPath();
    g.moveTo(CX + sign * 17.5, 65);
    g.lineTo(CX + sign * 50, 86);
    g.lineTo(CX + sign * 48, 96);
    g.lineTo(CX + sign * 18.5, 91);
    g.closePath();
  };
  for (const sign of [-1, 1]) {
    g.fillStyle = '#8fa8c9';
    canardPath(sign);
    g.fill();
    g.save();
    canardPath(sign);
    g.clip();
    g.strokeStyle = RAM_LIGHT;
    g.lineWidth = 5;
    canardPath(sign);
    g.stroke();
    g.restore();
    g.strokeStyle = INK;
    g.lineWidth = 4.2;
    canardPath(sign);
    g.stroke();
  }

  // 5. 全动外倾切尖双垂尾（Twin Canting Vertical Stabilizers）
  for (const sign of [-1, 1]) {
    const tailPath = () => {
      g.beginPath();
      g.moveTo(CX + sign * 22, 141);
      g.lineTo(CX + sign * 37, 156);
      g.lineTo(CX + sign * 35, 176);
      g.lineTo(CX + sign * 23, 169);
      g.closePath();
    };
    g.fillStyle = '#7e97ba';
    tailPath();
    g.fill();
    g.save();
    tailPath();
    g.clip();
    g.strokeStyle = RAM_LIGHT;
    g.lineWidth = 4.4;
    tailPath();
    g.stroke();
    g.fillStyle = CHINA_RED;
    g.fillRect(CX + sign * 29 - 5, 152, 10, 6);
    g.restore();
    g.strokeStyle = INK;
    g.lineWidth = 4;
    tailPath();
    g.stroke();
  }

  // 6. 歼-20 标志性的「琥珀金导电镀膜整体水滴座舱盖」
  const canopyGrad = g.createLinearGradient(CX - 9, 38, CX + 9, 84);
  canopyGrad.addColorStop(0, '#fff7bd');
  canopyGrad.addColorStop(0.35, '#ffd24c');
  canopyGrad.addColorStop(0.75, '#df8516');
  canopyGrad.addColorStop(1, '#7a4508');
  g.fillStyle = canopyGrad;
  g.strokeStyle = INK;
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(CX, 37);
  g.quadraticCurveTo(CX + 9.8, 49, CX + 8.2, 68);
  g.quadraticCurveTo(CX + 5.2, 82, CX, 84);
  g.quadraticCurveTo(CX - 5.2, 82, CX - 8.2, 68);
  g.quadraticCurveTo(CX - 9.8, 49, CX, 37);
  g.closePath();
  g.fill();
  g.stroke();

  // 座舱盖金色反光弧线
  g.strokeStyle = '#ffffff';
  g.lineWidth = 2.8;
  g.beginPath();
  g.moveTo(CX - 3.2, 45);
  g.quadraticCurveTo(CX - 5.4, 57, CX - 3.5, 70);
  g.stroke();

  // 机头银白空速管尖针
  g.strokeStyle = RAM_LIGHT;
  g.lineWidth = 2.8;
  g.beginPath();
  g.moveTo(CX, 4);
  g.lineTo(CX, 11);
  g.stroke();
}

/** 在 200×200 画布绘制中国歼-20（J-20“威龙”）隐身战斗机（基础形态）。 */
export function paintBaseShip(g) {
  g.save();
  g.lineJoin = 'round';
  g.lineCap = 'round';
  paintJ20Core(g, false);
  g.restore();
}

/** 在 200×200 画布绘制歼-20「威龙·重装隐身外翼 + 前伸双联电磁轨道炮 + 超音速涡流光翼」合体形态。 */
export function paintWingedShip(g) {
  g.save();
  g.lineJoin = 'round';
  g.lineCap = 'round';

  // 1. 鸭翼与主翼大迎角拉出的超音速脱体涡流「电光青彩笔能量光翼」
  const vortexGrad = g.createLinearGradient(4, 72, 196, 178);
  vortexGrad.addColorStop(0, '#ffffff');
  vortexGrad.addColorStop(0.35, '#6cf6ff');
  vortexGrad.addColorStop(0.8, '#28b4ff');
  vortexGrad.addColorStop(1, '#98fcff');
  g.fillStyle = vortexGrad;
  g.strokeStyle = '#e8fdff';
  g.lineWidth = 2.6;
  mirrorPoly(g, [
    [48, 86],
    [84, 74],
    [78, 94],
    [50, 98],
  ]);
  mirrorPoly(g, [
    [66, 126],
    [99, 122],
    [95, 145],
    [68, 142],
  ]);
  mirrorPoly(g, [
    [56, 150],
    [92, 160],
    [82, 178],
    [48, 162],
  ]);

  // 2. 与歼-20 隐身折线一脉相承的「飞翼式重装隐身外翼模块」（攻击-11 飞翼僚机风格隐身掠翼 + 亮金激波刃）
  const extGrad = g.createLinearGradient(4, 100, 98, 168);
  extGrad.addColorStop(0, '#eef5ff');
  extGrad.addColorStop(0.5, '#9ab4d6');
  extGrad.addColorStop(1, '#5e79a1');
  g.fillStyle = extGrad;
  g.strokeStyle = INK;
  g.lineWidth = 4.4;
  mirrorPoly(g, [
    [44, 105],
    [97, 136],
    [96, 160],
    [70, 154],
    [56, 168],
    [42, 156],
  ]);

  // 外翼前缘亮金高超音速激波护条
  const goldGrad = g.createLinearGradient(42, 104, 97, 144);
  goldGrad.addColorStop(0, '#fff7ad');
  goldGrad.addColorStop(0.55, '#ffd43b');
  goldGrad.addColorStop(1, '#ff922b');
  g.fillStyle = goldGrad;
  g.lineWidth = 3.8;
  mirrorPoly(g, [
    [44, 105],
    [97, 136],
    [89, 144],
    [44, 116],
  ]);

  // 翼尖赤红隐身折刀翼
  g.fillStyle = CHINA_RED;
  g.lineWidth = 3.8;
  mirrorPoly(g, [
    [88, 130],
    [99, 116],
    [97, 162],
    [87, 153],
  ]);

  // 3. 翼下流线型菱形隐身「双联电磁轨道脉冲炮」（锋利尖削棱柱造型，不再方正笨重）
  for (const sign of [-1, 1]) {
    const cx = CX + sign * 58;
    // 金电弧分叉导轨炮尖
    g.fillStyle = STAR_GOLD;
    g.strokeStyle = INK;
    g.lineWidth = 3.4;
    g.beginPath();
    g.moveTo(cx, 72);
    g.lineTo(cx + 5, 92);
    g.lineTo(cx + 2, 92);
    g.lineTo(cx, 84);
    g.lineTo(cx - 2, 92);
    g.lineTo(cx - 5, 92);
    g.closePath();
    g.fill();
    g.stroke();

    // 银白隐身多面体流线炮舱
    g.fillStyle = '#e6f0fc';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(cx, 86);
    g.lineTo(cx + 7, 102);
    g.lineTo(cx + 6, 160);
    g.lineTo(cx, 168);
    g.lineTo(cx - 6, 160);
    g.lineTo(cx - 7, 102);
    g.closePath();
    g.fill();
    g.stroke();

    g.fillStyle = CHINA_RED;
    g.fillRect(cx - 4.5, 108, 9, 7);
  }

  // 4. 中央歼-20“威龙”重型隐身战机本体
  paintJ20Core(g, true);
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
