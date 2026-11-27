/**
 * 《小雪人姐妹》第二轮重画：道具、五大 BOSS 与雪球，大块彩笔风。
 * 所有造型仍在每格 256×256 的坐标里绘制，由 build-snow-sisters-art.mjs 统一放大到 4 倍输出。
 * 风格：粗而抖的深墨轮廓、整块蜡笔色、斜排线、内缘压暗、白色高光笔触。
 */

export const INK = '#152038';
const FONT = `font-family="LXGW WenKai, LXGW WenKai Medium, PingFang SC, sans-serif"`;

let uid = 0;
const nextId = () => `k${uid++}`;

// 斜排线：蜡笔涂抹的方向感，铺满整格后用 clip-path 裁进造型里。
const HATCH_PATH = (() => {
  let d = '';
  for (let x = -260; x < 520; x += 16) d += `M${x} -4 L${x + 150} 262 `;
  return d;
})();
const hatchLayer = (color, opacity, width = 6) =>
  `<path d="${HATCH_PATH}" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="${width}" stroke-linecap="round"/>`;

/**
 * 画一个蜡笔色块：填色、斜排线、内缘压暗、再描一次轮廓。
 * tag/attrs 给出 SVG 图元（如 ellipse、path、rect），inside 是裁在造型内部的额外笔触。
 */
export function shape(tag, attrs, fill, { sw = 11, hatch = '#ffffff', hatchOp = 0.26, rim = '#1a1030', rimOp = 0.2, inside = '' } = {}) {
  const id = nextId();
  const el = `<${tag} ${attrs}`;
  return `<clipPath id="${id}">${el}/></clipPath>
    ${el} fill="${fill}"/>
    <g clip-path="url(#${id})">
      ${hatchLayer(hatch, hatchOp)}
      ${inside}
      ${el} fill="none" stroke="${rim}" stroke-opacity="${rimOp}" stroke-width="${sw * 2.8}"/>
    </g>
    ${el} fill="none" stroke="${INK}" stroke-width="${sw}"/>`;
}

const shine = (d, w = 9, op = 0.9) => `<path d="${d}" fill="none" stroke="#ffffff" stroke-opacity="${op}" stroke-width="${w}" stroke-linecap="round"/>`;

function eye(cx, cy, r = 14, { px = 0, py = 1, angry = 0 } = {}) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff" stroke="${INK}" stroke-width="6"/>
    <circle cx="${cx + px}" cy="${cy + py}" r="${r * 0.5}" fill="${INK}"/>
    <circle cx="${cx + px - r * 0.18}" cy="${cy + py - r * 0.2}" r="${r * 0.16}" fill="#ffffff"/>
    ${angry ? `<path d="M${cx - r - 4} ${cy - r - 4 + (angry > 0 ? 0 : 8)} L${cx + r + 4} ${cy - r + (angry > 0 ? 10 : -2)}" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>` : ''}`;
}

// ─────────────────────────── 雪球（白色与 1P、2P 专属） ───────────────────────────

/** 星星与爱心的路径，围着 (0,0) 画，半径约 1。 */
const STAR_PATH = 'M0 -1 L0.29 -0.4 L0.95 -0.31 L0.47 0.15 L0.59 0.81 L0 0.5 L-0.59 0.81 L-0.47 0.15 L-0.95 -0.31 L-0.29 -0.4 Z';
const HEART_PATH = 'M0 0.8 C-1.3 -0.1 -1.05 -1.05 -0.45 -1 C-0.15 -0.98 0 -0.7 0 -0.55 C0 -0.7 0.15 -0.98 0.45 -1 C1.05 -1.05 1.3 -0.1 0 0.8 Z';

export function snowballGraphic(fill, tint, highlight = '#ffffff', mark = null) {
  const body = shape('circle', 'cx="128" cy="128" r="90"', fill, {
    sw: 11,
    hatch: highlight,
    hatchOp: 0.3,
    rim: tint,
    rimOp: 0.4,
    inside: `<path d="M44 168 Q100 208 214 150" fill="none" stroke="${tint}" stroke-opacity="0.5" stroke-width="16" stroke-linecap="round"/>`,
  });
  const markSvg = !mark
    ? ''
    : mark === 'star'
      ? `<g transform="translate(128 134) scale(40)"><path d="${STAR_PATH}" fill="#fff6c8" stroke="${INK}" stroke-width="0.2" stroke-linejoin="round"/></g>`
      : `<g transform="translate(128 134) scale(40)"><path d="${HEART_PATH}" fill="#fff0fa" stroke="${INK}" stroke-width="0.2" stroke-linejoin="round"/></g>`;
  return `${body}
    ${shine('M70 96 Q112 54 166 80', 13)}
    <circle cx="176" cy="92" r="10" fill="#ffffff" fill-opacity="0.9"/>
    ${markSvg}`;
}

// ─────────────────────────── 道具 ───────────────────────────

function potion(color, dark, letter, scale = 1, dx = 0, dy = 0) {
  const id = nextId();
  const body = 'M104 62 L152 62 L152 88 C216 104 226 176 198 212 C176 240 80 240 58 212 C30 176 40 104 104 88 Z';
  return `<g transform="translate(${128 + dx} ${128 + dy}) scale(${scale}) translate(-128 -128)">
    <clipPath id="${id}"><path d="${body}"/></clipPath>
    <path d="${body}" fill="#e8f6ff"/>
    <g clip-path="url(#${id})">
      <path d="M10 124 Q52 100 94 124 T178 124 T262 124 L262 262 L10 262 Z" fill="${color}"/>
      ${hatchLayer('#ffffff', 0.28)}
      <path d="M10 124 Q52 100 94 124 T178 124 T262 124" fill="none" stroke="${dark}" stroke-width="8"/>
      <path d="${body}" fill="none" stroke="${dark}" stroke-opacity="0.35" stroke-width="30"/>
    </g>
    <path d="${body}" fill="none" stroke="${INK}" stroke-width="11" stroke-linejoin="round"/>
    ${shine('M70 150 Q64 124 84 108', 10)}
    ${shape('rect', 'x="100" y="24" width="56" height="42" rx="10"', '#e9a85c', { sw: 10, hatch: '#fff0c8' })}
    <text x="128" y="206" text-anchor="middle" ${FONT} font-size="96" font-weight="900" fill="#ffffff" stroke="${INK}" stroke-width="10" paint-order="stroke" stroke-linejoin="round">${letter}</text>
  </g>`;
}

const sushiLow = () => `
  ${shape('circle', 'cx="128" cy="132" r="90"', '#26313f', { sw: 11, hatch: '#9ab', hatchOp: 0.22 })}
  ${shape('circle', 'cx="128" cy="132" r="68"', '#ffffff', { sw: 7, hatch: '#bcd7f5', hatchOp: 0.5, rimOp: 0.1,
    inside: '<path d="M80 100 l8 6 M104 84 l9 4 M150 84 l8 5 M176 104 l-8 6 M72 140 l10 2 M178 150 l-10 -2 M96 176 l8 -5 M158 178 l-8 -5" stroke="#9fbbe0" stroke-width="5" stroke-linecap="round"/>' })}
  ${shape('circle', 'cx="128" cy="132" r="34"', '#ff5a52', { sw: 8, hatch: '#ffd0c8', hatchOp: 0.4 })}
  <circle cx="128" cy="132" r="14" fill="#ffd23a" stroke="${INK}" stroke-width="5"/>
  ${shine('M82 84 Q108 62 150 70', 9, 0.7)}`;

const sushiMid = () => `
  ${shape('rect', 'x="44" y="130" width="168" height="84" rx="38"', '#ffffff', { sw: 11, hatch: '#bcd7f5', hatchOp: 0.5, rimOp: 0.12 })}
  ${shape('path', 'd="M34 138 C44 90 100 74 128 84 C160 74 214 90 224 142 C190 160 150 146 128 154 C100 146 62 162 34 138 Z"', '#ff7a5a', {
    sw: 11,
    hatch: '#ffd2c0',
    hatchOp: 0.4,
    inside: `<path d="M64 118 Q92 108 108 126 M118 100 Q146 96 160 120 M168 104 Q192 112 200 130" fill="none" stroke="#ffe4d6" stroke-width="9" stroke-linecap="round"/>`,
  })}`;

const sushiHigh = () => `
  ${shape('ellipse', 'cx="128" cy="170" rx="86" ry="52"', '#ffffff', { sw: 11, hatch: '#bcd7f5', hatchOp: 0.5, rimOp: 0.12 })}
  ${shape('rect', 'x="60" y="104" width="136" height="78" rx="16"', '#26313f', { sw: 11, hatch: '#9ab', hatchOp: 0.2 })}
  ${shape('ellipse', 'cx="128" cy="104" rx="74" ry="34"', '#ffb23c', { sw: 10, hatch: '#ffe6a8', hatchOp: 0.4 })}
  ${[[96, 98], [128, 88], [160, 98], [112, 112], [146, 114]]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="13" fill="#ff4a3a" stroke="${INK}" stroke-width="5"/><circle cx="${x - 4}" cy="${y - 4}" r="4" fill="#ffffff" opacity="0.85"/>`)
    .join('')}`;

function envelope(body, seal, char, charColor, label) {
  return `
    ${shape('rect', 'x="48" y="30" width="160" height="200" rx="18"', body, { sw: 11, hatch: '#ffffff', hatchOp: 0.22 })}
    <path d="M52 82 Q128 124 204 82" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>
    ${shape('circle', 'cx="128" cy="96" r="44"', seal, { sw: 9, hatch: '#fffbe0', hatchOp: 0.3 })}
    <text x="128" y="114" text-anchor="middle" ${FONT} font-size="62" font-weight="900" fill="${charColor}" stroke="${INK}" stroke-width="3" paint-order="stroke">${char}</text>
    ${shape('rect', 'x="58" y="160" width="140" height="52" rx="12"', '#fff7df', { sw: 8, hatch: '#f4d9a0', hatchOp: 0.4 })}
    <text x="128" y="199" text-anchor="middle" ${FONT} font-size="36" font-weight="900" fill="${INK}" textLength="116" lengthAdjust="spacingAndGlyphs">${label}</text>`;
}

const cakePie = () => `
  ${shape('path', 'd="M34 196 L34 142 C34 110 80 86 128 86 C176 86 222 110 222 142 L222 196 Q128 214 34 196 Z"', '#e19a4a', {
    sw: 11,
    hatch: '#ffe7b0',
    hatchOp: 0.34,
    inside: `<path d="M30 150 Q128 176 226 150" fill="none" stroke="#a85a1f" stroke-width="12"/>`,
  })}
  ${shape('path', 'd="M40 140 C44 102 90 82 128 82 C168 82 214 102 218 140 C190 124 160 134 128 130 C96 134 66 124 40 140 Z"', '#ff9ec7', { sw: 10, hatch: '#ffffff', hatchOp: 0.3 })}
  <circle cx="128" cy="76" r="20" fill="#ff3a4e" stroke="${INK}" stroke-width="8"/><path d="M132 60 Q142 38 160 34" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
  <circle cx="122" cy="70" r="6" fill="#ffffff" opacity="0.8"/>`;

const sundae = () => `
  ${shape('path', 'd="M60 138 L196 138 L168 222 L88 222 Z"', '#8de4ff', { sw: 11, hatch: '#ffffff', hatchOp: 0.34, inside: `<path d="M84 138 L104 222 M124 138 L128 222 M164 138 L152 222" stroke="#3ab4e0" stroke-width="9" opacity="0.7"/>` })}
  ${shape('circle', 'cx="100" cy="118" r="40"', '#fff3d8', { sw: 10, hatch: '#f4d9a0', hatchOp: 0.4 })}
  ${shape('circle', 'cx="156" cy="116" r="40"', '#ff9ec7', { sw: 10, hatch: '#ffffff', hatchOp: 0.3 })}
  ${shape('circle', 'cx="128" cy="88" r="42"', '#c8a6ff', { sw: 10, hatch: '#ffffff', hatchOp: 0.3 })}
  <circle cx="128" cy="44" r="20" fill="#ff3a4e" stroke="${INK}" stroke-width="8"/><circle cx="121" cy="38" r="6" fill="#ffffff" opacity="0.8"/>
  ${shine('M104 76 Q116 62 134 64', 8)}`;

const fireTrail = () => `
  ${shape('path', 'd="M40 214 C34 150 66 118 90 152 C84 92 118 56 132 36 C144 76 178 96 176 152 C196 126 220 152 214 214 Z"', '#ff6a2c', {
    sw: 11,
    hatch: '#ffd070',
    hatchOp: 0.38,
    inside: `<path d="M84 214 C80 170 108 146 128 108 C148 150 176 170 172 214 Z" fill="#ffd23a" stroke="#ffe99a" stroke-width="6"/>`,
  })}
  ${shine('M96 176 Q92 148 112 130', 8, 0.7)}`;

const bubble = () => {
  const id = nextId();
  return `<clipPath id="${id}"><circle cx="128" cy="128" r="86"/></clipPath>
  <circle cx="128" cy="128" r="86" fill="#bff1ff" fill-opacity="0.42"/>
  <g clip-path="url(#${id})">${hatchLayer('#ffffff', 0.22)}<circle cx="128" cy="128" r="86" fill="none" stroke="#2f9fd0" stroke-opacity="0.25" stroke-width="34"/></g>
  <circle cx="128" cy="128" r="86" fill="none" stroke="#53cdf2" stroke-width="12"/>
  <circle cx="128" cy="128" r="91" fill="none" stroke="${INK}" stroke-opacity="0.5" stroke-width="4"/>
  ${shine('M70 100 Q80 66 120 56', 14)}
  <circle cx="176" cy="178" r="12" fill="#ffffff" fill-opacity="0.8"/>`;
};

const spikes = () => `
  ${shape('rect', 'x="36" y="34" width="184" height="58" rx="12"', '#6e7da0', { sw: 11, hatch: '#dbe6ff', hatchOp: 0.3 })}
  ${[56, 128, 200].map((x) => `<circle cx="${x}" cy="63" r="8" fill="#c9d4f0" stroke="${INK}" stroke-width="5"/>`).join('')}
  ${[56, 100, 144, 188]
    .map((x) => shape('path', `d="M${x - 24} 94 L${x} 214 L${x + 24} 94 Z"`, '#e6f3ff', { sw: 9, hatch: '#9ed2ff', hatchOp: 0.45, rim: '#5aa0d8', rimOp: 0.3 }))
    .join('')}`;

function princess(dx, dress, dressShade, hair) {
  return `<g transform="translate(${dx} 6) scale(0.92)">
    ${shape('path', 'd="M72 224 L128 112 L184 224 Z"', dress, { sw: 11, hatch: '#ffffff', hatchOp: 0.3, rim: dressShade, rimOp: 0.4 })}
    ${shape('path', `d="M82 74 C84 30 172 30 174 74 L176 118 L148 104 L108 104 L80 118 Z"`, hair, { sw: 10, hatch: '#ffffff', hatchOp: 0.18 })}
    ${shape('circle', 'cx="128" cy="92" r="36"', '#ffe3cc', { sw: 10, hatch: '#ffffff', hatchOp: 0.3, rimOp: 0.1 })}
    <path d="M92 66 L106 38 L128 58 L150 38 L164 66 Z" fill="#ffd23a" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/>
    <circle cx="116" cy="94" r="6" fill="${INK}"/><circle cx="140" cy="94" r="6" fill="${INK}"/>
    <circle cx="104" cy="108" r="7" fill="#ff9aa8" opacity="0.8"/><circle cx="152" cy="108" r="7" fill="#ff9aa8" opacity="0.8"/>
    <path d="M118 110 Q128 118 138 110" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
  </g>`;
}

const snowHead = () => `
  ${shape('circle', 'cx="128" cy="140" r="80"', '#ffffff', { sw: 11, hatch: '#bcd7f5', hatchOp: 0.5, rimOp: 0.12 })}
  ${shape('path', 'd="M52 112 C60 56 196 56 204 112 L186 100 L70 100 Z"', '#3d8ef0', { sw: 10, hatch: '#ffffff', hatchOp: 0.26 })}
  <circle cx="128" cy="40" r="17" fill="#ffffff" stroke="${INK}" stroke-width="8"/>
  <circle cx="102" cy="140" r="11" fill="${INK}"/><circle cx="154" cy="140" r="11" fill="${INK}"/>
  <path d="M122 154 L134 154 L128 176 Z" fill="#ff8a2a" stroke="${INK}" stroke-width="5"/>
  <circle cx="82" cy="164" r="11" fill="#ff9aa8" opacity="0.7"/><circle cx="174" cy="164" r="11" fill="#ff9aa8" opacity="0.7"/>`;

export function buildItemCells() {
  return [
    potion('#ff4b63', '#a82040', 'S'),
    potion('#3f9cff', '#1d5fb8', 'P'),
    potion('#ffd42e', '#c89200', 'R'),
    potion('#3fd96f', '#1d9a45', 'G'),
    snowHead(),
    sushiLow(),
    sushiMid(),
    sushiHigh(),
    envelope('#ee3a40', '#ffd23a', '祝', '#d8202a', '10000'),
    envelope('#ffc83a', '#ee3a40', '寿', '#ffe27a', '20000'),
    cakePie(),
    sundae(),
    // 12：1P 姐姐的金黄雪球加星星；13：2P 妹妹的薰衣草雪球加爱心。
    snowballGraphic('#ffd84a', '#e49a00', '#fff7cc', 'star'),
    snowballGraphic('#c9a8ff', '#7c4ad8', '#f6ecff', 'heart'),
    fireTrail(),
    bubble(),
    `${bubble()}${potion('#ff4b63', '#a82040', 'S', 0.62)}`,
    `${bubble()}${potion('#3f9cff', '#1d5fb8', 'P', 0.62)}`,
    spikes(),
    `${princess(-34, '#ff7cc8', '#b42a82', '#8a4a2a')}${princess(48, '#6cd4ff', '#1c78b0', '#2a2a5a')}`,
  ];
}

// ─────────────────────────── BOSS ───────────────────────────

const GREEN = '#43c25a';
const GREEN_DK = '#1d7a36';

const spikeRow = (pts, color) => pts.map(([x, y, s]) => `<path d="M${x - s} ${y} L${x} ${y - s * 1.7} L${x + s} ${y} Z" fill="${color}" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/>`).join('');

// 朝左站立的巨蜥：大头、尖牙、背刺、粗尾巴。jump 时双臂举起、张大嘴。
function lizard(jump) {
  const y = jump ? -14 : 0;
  return `<g transform="translate(0 ${y})">
    ${shape('path', 'd="M196 164 C224 176 244 152 240 118 C232 136 220 140 204 128 Z"', GREEN, { sw: 10, rim: GREEN_DK, rimOp: 0.4 })}
    ${spikeRow([[120, 82, 14], [158, 90, 14], [192, 108, 13], [212, 138, 11]], '#ff8a38')}
    ${shape('ellipse', 'cx="148" cy="150" rx="72" ry="66"', GREEN, { sw: 11, rim: GREEN_DK, rimOp: 0.4 })}
    ${shape('ellipse', 'cx="136" cy="168" rx="40" ry="44"', '#ffe784', { sw: 8, hatch: '#ffffff', hatchOp: 0.35, rimOp: 0.1 })}
    ${shape('ellipse', 'cx="112" cy="222" rx="30" ry="16"', '#ff8a38', { sw: 9 })}
    ${shape('ellipse', 'cx="184" cy="224" rx="30" ry="16"', '#ff8a38', { sw: 9 })}
    ${shape('ellipse', 'cx="92" cy="100" rx="50" ry="46"', GREEN, { sw: 11, rim: GREEN_DK, rimOp: 0.4 })}
    ${shape('path', jump ? 'd="M10 100 C14 70 60 74 90 90 L84 130 C50 150 14 136 10 100 Z"' : 'd="M14 98 C18 76 62 74 90 90 L90 122 C56 130 18 122 14 98 Z"', GREEN, { sw: 11, rim: GREEN_DK, rimOp: 0.4 })}
    ${jump ? `<path d="M16 108 C38 150 70 140 88 124 L84 100 C56 112 34 108 16 108 Z" fill="#c82e4a" stroke="${INK}" stroke-width="8"/>` : ''}
    <path d="M${jump ? 22 : 24} ${jump ? 112 : 112} l8 18 l9 -16 l9 17 l9 -14 l9 14" fill="#ffffff" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
    ${eye(98, 82, 14, { px: -3, py: 1, angry: 1 })}
    <circle cx="36" cy="92" r="5" fill="${INK}"/>
    ${shape('circle', `cx="${jump ? 66 : 62}" cy="${jump ? 172 : 180}" r="20"`, GREEN, { sw: 9 })}
  </g>`;
}

const togera = () => `
  ${shape('ellipse', 'cx="124" cy="158" rx="76" ry="62"', '#63d678', { sw: 11, rim: GREEN_DK, rimOp: 0.35 })}
  ${spikeRow([[132, 100, 14], [170, 112, 13], [200, 138, 12]], '#ff9442')}
  ${shape('ellipse', 'cx="124" cy="176" rx="40" ry="34"', '#fff0a8', { sw: 8, hatchOp: 0.35, rimOp: 0.1 })}
  ${eye(84, 134, 15, { px: -3, angry: 1 })}
  <path d="M40 164 Q66 188 100 168" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>
  ${shape('ellipse', 'cx="84" cy="222" rx="24" ry="14"', '#ff9442', { sw: 8 })}
  ${shape('ellipse', 'cx="160" cy="224" rx="24" ry="14"', '#ff9442', { sw: 8 })}`;

// 炮弹蛙：绿皮、圆红鼻、嘴前一管大炮。attack 时炮口抬高、喷火星、眼睛瞪大。
function frog(attack) {
  return `
    ${shape('ellipse', 'cx="140" cy="168" rx="92" ry="64"', GREEN, { sw: 12, rim: GREEN_DK, rimOp: 0.4 })}
    ${shape('ellipse', 'cx="150" cy="190" rx="52" ry="36"', '#d8f5a0', { sw: 8, hatchOp: 0.35, rimOp: 0.1 })}
    ${shape('circle', 'cx="164" cy="98"  r="30"', GREEN, { sw: 10, rim: GREEN_DK, rimOp: 0.3 })}
    ${shape('circle', 'cx="214" cy="106" r="30"', GREEN, { sw: 10, rim: GREEN_DK, rimOp: 0.3 })}
    ${eye(164, 98, 17, { px: -3, py: 2, angry: 1 })}${eye(214, 106, 17, { px: -3, py: 2, angry: 1 })}
    ${shape('circle', 'cx="62" cy="166" r="40"', '#ff4a50', { sw: 11, hatch: '#ffd0c8', hatchOp: 0.35 })}
    ${shape('path', attack ? 'd="M12 120 L72 70 L102 100 L40 150 Z"' : 'd="M6 150 L12 112 L82 118 L82 160 Z"', '#5a6684', { sw: 11, hatch: '#dbe6ff', hatchOp: 0.28 })}
    ${attack ? `<circle cx="38" cy="128" r="20" fill="#ffd23a" stroke="${INK}" stroke-width="7"/><path d="M20 94 L30 110 M16 152 L26 144" stroke="#ff7a2a" stroke-width="8" stroke-linecap="round"/>` : ''}
    <path d="M90 214 Q140 236 196 214" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
    ${shape('ellipse', 'cx="86" cy="232" rx="30" ry="14"', GREEN, { sw: 9 })}
    ${shape('ellipse', 'cx="196" cy="234" rx="30" ry="14"', GREEN, { sw: 9 })}`;
}

const bombJoe = () => `
  <path d="M128 70 Q146 36 178 34" fill="none" stroke="#ffd23a" stroke-width="11" stroke-linecap="round"/>
  <circle cx="182" cy="34" r="16" fill="#ff5a2a" stroke="${INK}" stroke-width="7"/><path d="M182 6 L182 16 M206 18 L198 24 M208 40 L198 38" stroke="#ffd23a" stroke-width="7" stroke-linecap="round"/>
  ${shape('circle', 'cx="128" cy="146" r="74"', '#2e3a5c', { sw: 12, hatch: '#9db4ff', hatchOp: 0.2, rim: '#000', rimOp: 0.3 })}
  ${shine('M84 110 Q96 82 128 78', 11, 0.55)}
  ${eye(104, 138, 15, { px: 2 })}${eye(154, 138, 15, { px: 2 })}
  <path d="M100 176 Q128 198 158 176" fill="none" stroke="#ffffff" stroke-width="9" stroke-linecap="round"/>
  ${shape('ellipse', 'cx="92" cy="226" rx="24" ry="13"', '#ffd23a', { sw: 8 })}
  ${shape('ellipse', 'cx="166" cy="226" rx="24" ry="13"', '#ffd23a', { sw: 8 })}`;

// 双怪鸟：正面张开的大翅膀、尖喙、冠羽，三种颜色对应三段变色。
function bird(main, light, dark) {
  const wing = (sign) => {
    const sx = sign < 0 ? 0 : 256;
    return shape(
      'path',
      `d="M${128 + sign * 28} 124 C${128 + sign * 70} 60 ${sx + sign * -24} 66 ${sx + sign * -20} 120 C${sx + sign * -26} 138 ${sx + sign * -44} 152 ${sx + sign * -58} 160 C${sx + sign * -64} 172 ${128 + sign * 78} 178 ${128 + sign * 36} 160 Z"`,
      main,
      { sw: 11, hatch: light, hatchOp: 0.5, rim: dark, rimOp: 0.4, inside: `<path d="M${sx + sign * -30} 120 Q${128 + sign * 70} 126 ${128 + sign * 48} 142 M${sx + sign * -40} 100 Q${128 + sign * 80} 108 ${128 + sign * 54} 122" fill="none" stroke="${dark}" stroke-opacity="0.55" stroke-width="8" stroke-linecap="round"/>` },
    );
  };
  return `
    ${wing(-1)}${wing(1)}
    ${shape('path', 'd="M108 36 L128 6 L148 36 L170 20 L156 58 L100 58 L86 20 Z"', dark, { sw: 9, hatch: '#ffffff', hatchOp: 0.2 })}
    ${shape('ellipse', 'cx="128" cy="144" rx="58" ry="74"', main, { sw: 12, hatch: light, hatchOp: 0.5, rim: dark, rimOp: 0.4 })}
    ${shape('ellipse', 'cx="128" cy="170" rx="34" ry="42"', light, { sw: 8, hatchOp: 0.3, rimOp: 0.1 })}
    ${eye(106, 112, 15, { px: 3, angry: 1 })}${eye(150, 112, 15, { px: -3, angry: -1 })}
    <path d="M110 134 L146 134 L128 168 Z" fill="#ff8a2a" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/>
    ${shape('path', 'd="M100 214 L128 246 L156 214 Z"', dark, { sw: 8 })}`;
}

const beep = () => `
  ${shape('path', 'd="M128 40 C204 40 214 150 196 196 C184 232 72 232 60 196 C42 150 52 40 128 40 Z"', '#ff5a74', { sw: 12, hatch: '#ffd0d8', hatchOp: 0.32, rim: '#a01838', rimOp: 0.35 })}
  <path d="M62 122 L90 100 L112 126 L132 98 L154 126 L176 100 L196 122" fill="none" stroke="#fff7dc" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
  ${eye(104, 90, 14, { px: 2, angry: 1 })}${eye(152, 90, 14, { px: -2, angry: -1 })}
  <path d="M116 160 Q128 172 140 160" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
  ${shape('ellipse', 'cx="96" cy="230" rx="22" ry="12"', '#ffb23c', { sw: 8 })}
  ${shape('ellipse', 'cx="160" cy="230" rx="22" ry="12"', '#ffb23c', { sw: 8 })}`;

// 大鼻怪：肥胖大圆身，举拳，圆红鼻，锯齿嘴；变体是紫色墨镜版。
function bigNose(main, dark, shades) {
  return `
    ${shape('circle', 'cx="38" cy="132" r="32"', main, { sw: 11, rim: dark, rimOp: 0.4 })}
    ${shape('circle', 'cx="218" cy="132" r="32"', main, { sw: 11, rim: dark, rimOp: 0.4 })}
    ${shape('ellipse', 'cx="128" cy="150" rx="90" ry="78"', main, { sw: 12, hatchOp: 0.3, rim: dark, rimOp: 0.4 })}
    ${shape('ellipse', 'cx="84" cy="232" rx="30" ry="14"', '#ffd23a', { sw: 9 })}
    ${shape('ellipse', 'cx="172" cy="232" rx="30" ry="14"', '#ffd23a', { sw: 9 })}
    ${
      shades
        ? `<path d="M52 98 L204 98" stroke="${INK}" stroke-width="10"/>
           ${shape('rect', 'x="56" y="82" width="64" height="38" rx="12"', '#1a2442', { sw: 8, hatch: '#9db4ff', hatchOp: 0.3 })}
           ${shape('rect', 'x="136" y="82" width="64" height="38" rx="12"', '#1a2442', { sw: 8, hatch: '#9db4ff', hatchOp: 0.3 })}`
        : `${eye(92, 100, 19, { px: 2, angry: 1 })}${eye(164, 100, 19, { px: -2, angry: -1 })}`
    }
    ${shape('circle', 'cx="128" cy="142" r="34"', '#ff4a52', { sw: 11, hatch: '#ffd0c8', hatchOp: 0.35 })}
    ${shine('M110 128 Q118 118 132 120', 8)}
    <path d="M70 196 L92 178 L114 198 L136 178 L158 198 L180 178 L194 196 Q128 232 70 196 Z" fill="#ffffff" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/>`;
}

const pangPang = () => `
  ${shape('path', 'd="M128 22 C186 80 198 126 190 170 C182 224 74 224 66 170 C58 126 70 80 128 22 Z"', '#ff6428', {
    sw: 12,
    hatch: '#ffd070',
    hatchOp: 0.36,
    inside: `<path d="M128 70 C158 112 164 150 150 186 Q128 204 106 186 C92 150 98 112 128 70 Z" fill="#ffe156" stroke="#fff3b0" stroke-width="6"/>`,
  })}
  ${eye(106, 150, 13, { px: 2, angry: 1 })}${eye(150, 150, 13, { px: -2, angry: -1 })}
  <path d="M112 182 Q128 194 144 182" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>`;

// 石像：灰色石砖脸，粗眉、黄眼、大黑嘴，嘴朝向对手。
function statue(mouthSide) {
  const mx = mouthSide === 'right' ? 156 : 100;
  return `
    ${shape('rect', 'x="50" y="26" width="156" height="200" rx="34"', '#8e9abb', {
      sw: 12,
      hatch: '#e6edff',
      hatchOp: 0.3,
      inside: `<path d="M70 62 L94 78 M170 40 L190 70 M62 190 L84 170 L100 200" fill="none" stroke="#5c6890" stroke-width="7" stroke-linecap="round"/>
               <path d="M60 214 Q80 190 104 214 Q128 188 156 214 Q180 190 200 214 L200 230 L60 230 Z" fill="#5fae5a" opacity="0.7"/>`,
    })}
    <path d="M72 82 L120 100 M184 82 L136 100" stroke="${INK}" stroke-width="12" stroke-linecap="round"/>
    ${shape('circle', 'cx="98" cy="116" r="18"', '#ffd84a', { sw: 8, hatch: '#ffffff', hatchOp: 0.3 })}
    ${shape('circle', 'cx="158" cy="116" r="18"', '#ffd84a', { sw: 8, hatch: '#ffffff', hatchOp: 0.3 })}
    <circle cx="${98 + (mouthSide === 'right' ? 4 : -4)}" cy="118" r="7" fill="${INK}"/><circle cx="${158 + (mouthSide === 'right' ? 4 : -4)}" cy="118" r="7" fill="${INK}"/>
    ${shape('rect', 'x="112" y="122" width="32" height="40" rx="10"', '#7b87aa', { sw: 8, hatch: '#e6edff', hatchOp: 0.25 })}
    <ellipse cx="${mx}" cy="190" rx="34" ry="26" fill="#1e2a48" stroke="${INK}" stroke-width="9"/>
    <path d="M${mx - 20} 176 L${mx - 8} 188 L${mx + 4} 176 L${mx + 18} 188" fill="none" stroke="#ffffff" stroke-width="7" stroke-linejoin="round"/>`;
}

const king = () => `
  ${shape('path', 'd="M60 96 L82 30 L128 74 L174 30 L196 96 Z"', '#ffd23a', { sw: 11, hatch: '#fff6b0', hatchOp: 0.4 })}
  <circle cx="82" cy="30" r="10" fill="#ff4a52" stroke="${INK}" stroke-width="6"/><circle cx="174" cy="30" r="10" fill="#4aa8ff" stroke="${INK}" stroke-width="6"/><circle cx="128" cy="76" r="10" fill="#3fd96f" stroke="${INK}" stroke-width="6"/>
  ${shape('ellipse', 'cx="128" cy="160" rx="82" ry="72"', '#ff4a38', { sw: 12, hatch: '#ffc0a8', hatchOp: 0.32, rim: '#8a1020', rimOp: 0.35 })}
  ${eye(96, 142, 17, { px: 2, angry: 1 })}${eye(160, 142, 17, { px: -2, angry: -1 })}
  <path d="M88 196 L108 178 L128 198 L148 178 L168 196 Q128 226 88 196 Z" fill="#ffffff" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/>`;

export function buildBossCells() {
  return [
    lizard(false),
    lizard(true),
    togera(),
    frog(false),
    frog(true),
    bombJoe(),
    bird('#ffd43b', '#fff2a0', '#c8900a'),
    bird('#ff79b0', '#ffd0e6', '#b82e6e'),
    bird('#58b4ff', '#d0ecff', '#1e5fb8'),
    beep(),
    bigNose('#46be62', '#1d7a36', false),
    bigNose('#c466f5', '#6a2aa0', true),
    pangPang(),
    statue('right'),
    statue('left'),
    king(),
  ];
}
