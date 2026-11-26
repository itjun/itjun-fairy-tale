// 彩笔小战斗机：短机身、小三角翼、双垂尾、粗墨线。
// 画布只做清晰源图，画进 256×240 战场时缩到裸机 16×16、装翼 26×16。

export const SHIP_CANVAS_SIZE = 96;
export const BASE_SHIP_WIDTH = 16;
export const BASE_SHIP_HEIGHT = 16;
export const BASE_SHIP_SIZE = BASE_SHIP_WIDTH;
export const WINGED_SHIP_WIDTH = 26;
export const WINGED_SHIP_HEIGHT = 16;

const CX = 48;
const INK = '#152038';

function paintHull(g) {
  g.fillStyle = '#d7e6f8';
  g.strokeStyle = INK;
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(CX, 10);
  g.lineTo(CX + 14, 30);
  g.lineTo(CX + 34, 58);
  g.lineTo(CX + 26, 66);
  g.lineTo(CX + 12, 58);
  g.lineTo(CX + 8, 78);
  g.lineTo(CX, 72);
  g.lineTo(CX - 8, 78);
  g.lineTo(CX - 12, 58);
  g.lineTo(CX - 26, 66);
  g.lineTo(CX - 34, 58);
  g.lineTo(CX - 14, 30);
  g.closePath();
  g.fill();
  g.stroke();

  g.fillStyle = '#8eb6de';
  for (const sign of [-1, 1]) {
    g.beginPath();
    g.moveTo(CX + sign * 6, 50);
    g.lineTo(CX + sign * 14, 44);
    g.lineTo(CX + sign * 12, 74);
    g.lineTo(CX + sign * 4, 68);
    g.closePath();
    g.fill();
    g.stroke();
  }

  g.fillStyle = '#ffd24c';
  g.beginPath();
  g.ellipse(CX, 36, 7, 11, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  g.fillStyle = '#ff9c24';
  g.fillRect(CX - 5, 74, 4, 8);
  g.fillRect(CX + 1, 74, 4, 8);
}

function paintPods(g) {
  g.fillStyle = '#7ec8ff';
  g.strokeStyle = INK;
  g.lineWidth = 5;
  for (const sign of [-1, 1]) {
    g.beginPath();
    g.moveTo(CX + sign * 28, 40);
    g.lineTo(CX + sign * 44, 48);
    g.lineTo(CX + sign * 42, 64);
    g.lineTo(CX + sign * 26, 58);
    g.closePath();
    g.fill();
    g.stroke();
  }
}

/** 裸机。画布几乎被机体铺满，缩到 16×16 后仍能认出一架小飞机。 */
export function paintBaseShip(g) {
  g.save();
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.translate(CX, CX);
  g.scale(1.28, 1.28);
  g.translate(-CX, -CX);
  paintHull(g);
  g.restore();
}

/** 装翼后只在两侧加一对小侧舱，机体本身不再铺开。 */
export function paintWingedShip(g) {
  g.save();
  g.lineJoin = 'round';
  g.lineCap = 'round';
  paintPods(g);
  paintHull(g);
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
