// 加纳战机高清图集：以已确认的彩笔原图为唯一源，生成 1024 格精灵与 2560×1920 背景。
// 源图在 docs/design/gun-nac-hd/source/，输出写入 public/gun-nac/，同名替换，代码路径不变。
//
// 精灵用「标签平滑放大」：每格取一个小调色板（保留原画颜色），每种颜色的遮罩放大后模糊，
// 再逐像素取最强的颜色。边界变成干净的彩笔轮廓，颗粒小斑点被周围颜色吞掉，不会描成碎片。
// 背景是纯色纸纹与风景，用 Lanczos 整体放大并轻度锐化，不做分割。
//
// 用法：node scripts/build-gun-nac-art.mjs
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const SOURCE = join('docs', 'design', 'gun-nac-hd', 'source');
const OUT = join('public', 'gun-nac');
const CELL = 256; // 源图每格边长
const CELL_HD = 1024; // 输出每格边长（四倍）
const PALETTE = 22; // 每格聚类数（合并前）
const MERGE_DISTANCE = 40; // 颜色距离小于此值的聚类合并
const INK_LUMA = 80; // 亮度低于此值视为描边墨色，合并为一种
const SOFT = 4; // 遮罩模糊半径（1024 像素坐标），越大边界越圆、颗粒越容易被吞掉
const MAJORITY_RADIUS = 1; // 标签众数滤波半径（源格像素），先去掉散点再放大
const BG = { width: 2560, height: 1920 };

const SHEETS = [
  { name: 'craft', cols: 5, rows: 4 },
  { name: 'bosses', cols: 4, rows: 4 },
  { name: 'landmarks', cols: 4, rows: 4 },
];
const FIELDS = Array.from({ length: 9 }, (_, i) => `field-${i}`);

// 单通道遮罩经过 sharp 后会被扩成三通道，必须 extractChannel(0) 才能按字节索引。
function mask1(buf, size) {
  return sharp(buf, { raw: { width: size, height: size, channels: 1 } });
}
async function softMask(values, sizeIn, sizeOut, blur) {
  return mask1(values, sizeIn)
    .resize(sizeOut, sizeOut, { kernel: 'cubic' })
    .blur(blur)
    .extractChannel(0)
    .raw()
    .toBuffer();
}

// 确定性 k-means：按亮度均匀取初始中心，固定迭代次数，同一张图每次结果一致。
function palette(rgba, opaqueIdx, k) {
  const lum = (i) => rgba[i * 4] * 0.3 + rgba[i * 4 + 1] * 0.59 + rgba[i * 4 + 2] * 0.11;
  const sorted = [...opaqueIdx].sort((a, b) => lum(a) - lum(b));
  const centers = Array.from({ length: k }, (_, n) => {
    const i = sorted[Math.floor(((n + 0.5) / k) * sorted.length)];
    return [rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]];
  });
  const step = Math.max(1, Math.floor(sorted.length / 6000));
  const sample = sorted.filter((_, j) => j % step === 0);
  const nearest = (i) => {
    let best = 0,
      bestD = Infinity;
    for (let n = 0; n < k; n++) {
      const c = centers[n];
      const d = (rgba[i * 4] - c[0]) ** 2 + (rgba[i * 4 + 1] - c[1]) ** 2 + (rgba[i * 4 + 2] - c[2]) ** 2;
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    return best;
  };
  for (let it = 0; it < 12; it++) {
    const acc = centers.map(() => [0, 0, 0, 0]);
    for (const i of sample) {
      const n = nearest(i);
      acc[n][0] += rgba[i * 4];
      acc[n][1] += rgba[i * 4 + 1];
      acc[n][2] += rgba[i * 4 + 2];
      acc[n][3]++;
    }
    acc.forEach((a, n) => {
      if (a[3]) centers[n] = [a[0] / a[3], a[1] / a[3], a[2] / a[3]];
    });
  }
  // 颜色接近的聚类合并成一种墨色，避免黑色描边被切成多块深浅不一的斑点。
  // 深色（描边墨色）全部归为一种；其余按颜色距离合并。
  const lumOf = (c) => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
  const groups = [];
  const toGroup = centers.map((c) => {
    const found = groups.findIndex((g) => {
      if (lumOf(c) < INK_LUMA && lumOf(g) < INK_LUMA) return true;
      const d = (c[0] - g[0]) ** 2 + (c[1] - g[1]) ** 2 + (c[2] - g[2]) ** 2;
      return d < MERGE_DISTANCE * MERGE_DISTANCE;
    });
    if (found >= 0) return found;
    groups.push(c);
    return groups.length - 1;
  });
  return {
    centers: groups,
    nearest: (i) => toGroup[nearest(i)],
  };
}

// 标签众数滤波：把散落的小斑点并入周围颜色，轮廓更顺，不改变大块颜色。
function majority(label, N, r, k) {
  const out = new Int16Array(N * N).fill(-1);
  const counts = new Int32Array(k);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const self = label[y * N + x];
      if (self < 0) continue;
      counts.fill(0);
      for (let dy = -r; dy <= r; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= N) continue;
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= N) continue;
          const v = label[yy * N + xx];
          if (v >= 0) counts[v]++;
        }
      }
      let best = self;
      for (let n = 0; n < k; n++) if (counts[n] > counts[best]) best = n;
      out[y * N + x] = best;
    }
  }
  return out;
}

// 一格 256 源图 → 一格 1024 RGBA。
async function upscaleCell(rgba) {
  const N = CELL;
  const S = CELL_HD;
  const opaqueIdx = [];
  for (let i = 0; i < N * N; i++) if (rgba[i * 4 + 3] >= 128) opaqueIdx.push(i);
  if (!opaqueIdx.length) return Buffer.alloc(S * S * 4);
  const { centers, nearest } = palette(rgba, opaqueIdx, PALETTE);
  const K = centers.length;
  const raw = new Int16Array(N * N).fill(-1);
  for (const i of opaqueIdx) raw[i] = nearest(i);
  const label = majority(raw, N, MAJORITY_RADIUS, K);

  const scores = [];
  for (let n = 0; n < K; n++) {
    const m = new Uint8Array(N * N);
    for (let i = 0; i < N * N; i++) m[i] = label[i] === n ? 255 : 0;
    scores.push(await softMask(m, N, S, SOFT));
  }
  const alphaSrc = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) alphaSrc[i] = rgba[i * 4 + 3] >= 128 ? 255 : 0;
  const alpha = await softMask(alphaSrc, N, S, SOFT);

  const out = Buffer.alloc(S * S * 4);
  for (let p = 0; p < S * S; p++) {
    let best = 0,
      bestV = -1;
    for (let n = 0; n < K; n++) {
      const v = scores[n][p];
      if (v > bestV) {
        bestV = v;
        best = n;
      }
    }
    const c = centers[best];
    out[p * 4] = c[0];
    out[p * 4 + 1] = c[1];
    out[p * 4 + 2] = c[2];
    out[p * 4 + 3] = Math.max(0, Math.min(255, (alpha[p] - 100) * 3));
  }
  return out;
}

async function sheet({ name, cols, rows }) {
  const width = cols * CELL_HD;
  const height = rows * CELL_HD;
  const { data, info } = await sharp(join(SOURCE, `${name}.webp`), { limitInputPixels: false })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const parts = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cell = new Uint8Array(CELL * CELL * 4);
      for (let y = 0; y < CELL; y++) {
        const from = ((row * CELL + y) * info.width + col * CELL) * 4;
        cell.set(data.subarray(from, from + CELL * 4), y * CELL * 4);
      }
      const hd = await upscaleCell(cell);
      parts.push({ input: hd, raw: { width: CELL_HD, height: CELL_HD, channels: 4 }, left: col * CELL_HD, top: row * CELL_HD });
    }
  }
  await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(parts)
    .webp({ quality: 96, alphaQuality: 100, effort: 5 })
    .toFile(join(OUT, `${name}.webp`));
  return `${name}.webp ${width}×${height}（${cols}×${rows} 格，每格 ${CELL_HD}，源格 ${CELL}）`;
}

async function background(name) {
  await sharp(join(SOURCE, `${name}.webp`), { limitInputPixels: false })
    .resize(BG.width, BG.height, { kernel: 'lanczos3', fit: 'fill' })
    .sharpen({ sigma: 0.6, m1: 0.4, m2: 0.2 })
    .webp({ quality: 92, effort: 5 })
    .toFile(join(OUT, `${name}.webp`));
  return `${name}.webp ${BG.width}×${BG.height}`;
}

await mkdir(OUT, { recursive: true });
const done = [];
for (const s of SHEETS) done.push(await sheet(s));
done.push(await background('hangar'));
for (const f of FIELDS) done.push(await background(f));
console.log(done.join('\n'));
