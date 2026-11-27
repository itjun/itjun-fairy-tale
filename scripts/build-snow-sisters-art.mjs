#!/usr/bin/env node
/**
 * 生成《小雪人姐妹》彩笔风格透明图集与五大主题背景、标题/结局插画及分镜总览图。
 * 网格对齐：characters(5x4)、enemies(5x4)、items(5x4) 为 5120x4096（单格 1024x1024，设计坐标 256x256 的 4 倍）；
 * bosses(4x4) 为 4096x4096；背景 2560x1920、标题与结局 2560x1920；平台 4608x1152；墙体 512x512。
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { buildBossCells, buildItemCells, snowballGraphic } from './snow-sisters-art-redraw.mjs';

const OUT = 'public/snow-sisters';
const DOC_OUT = 'docs/design/snow-sisters';
// 冒险游戏里已有的彩笔原画素材：姐姐（红裙）给 1P，妹妹（紫裙）给 2P。
const ADVENTURE_ART = 'public/assets';
mkdirSync(OUT, { recursive: true });
mkdirSync(DOC_OUT, { recursive: true });

const INK = '#152038';
const CRAYON_FILTER = `
  <filter id="crayon" x="-8%" y="-8%" width="116%" height="116%">
    <feTurbulence type="fractalNoise" baseFrequency="0.16" numOctaves="3" seed="7" result="noise"/>
    <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.2" xChannelSelector="R" yChannelSelector="G" result="wobble"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.85 0.3" numOctaves="2" seed="3" result="grain"/>
    <feColorMatrix in="grain" type="matrix" values="0.34 0 0 0 0.7  0.34 0 0 0 0.7  0.34 0 0 0 0.7  0 0 0 0 1" result="waxy"/>
    <feBlend in="wobble" in2="waxy" mode="multiply" result="shaded"/>
    <feTurbulence type="fractalNoise" baseFrequency="2.6 1.4" numOctaves="2" seed="19" result="fine"/>
    <feColorMatrix in="fine" type="matrix" values="0.22 0 0 0 0.78  0.22 0 0 0 0.78  0.22 0 0 0 0.78  0 0 0 0 1" result="fineWax"/>
    <feBlend in="shaded" in2="fineWax" mode="multiply" result="shaded2"/>
    <feComposite in="shaded2" in2="wobble" operator="in"/>
  </filter>
  <filter id="paper" x="0%" y="0%" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="4" seed="11" result="n"/>
    <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.08 0" in="n" result="grain"/>
    <feComposite in="grain" in2="SourceGraphic" operator="atop"/>
  </filter>
`;

const W = (x = 0, y = 0, body = '') =>
  `<g transform="translate(${x} ${y})" filter="url(#crayon)" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;

// 把冒险游戏的原画姐妹缩成 232 格，写进 SVG 时用 data URI，图集脚本仍然一次生成。
async function loadSisterArt(side, prefix) {
  const load = async (file, kind) => {
    const buf = await sharp(join(ADVENTURE_ART, file))
      .resize(928, 928, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    const id = `sis-${side}-${kind}`;
    SISTER_DEFS += `<image id="${id}" x="0" y="0" width="232" height="232" href="data:image/png;base64,${buf.toString('base64')}"/>`;
    return id;
  };
  return { idle: await load(`${prefix}-player.png`, 'idle'), attack: await load(`${prefix}-attack.png`, 'attack') };
}
// 原画姐妹只在 <defs> 里放一份，各格用 <use> 引用，输出时按 4 倍分辨率渲染。
let SISTER_DEFS = '';
const SISTER_ART = {
  1: await loadSisterArt(1, 'sister'),
  2: await loadSisterArt(2, 'little'),
};

// 以脚底为轴的姐妹姿态（坐标为 256 格内的格子坐标）。
// 站、走、跳、投、大雪球、融化等姿态都用原画素材加形变完成，不再画通用雪人。
function sisterArt(side, pose, { melt = 0 } = {}) {
  const art = SISTER_ART[side];
  const img = (id) => `<use href="#${id}" x="12" y="12"/>`;
  const at = (transform, inner) => `<g transform="${transform}">${inner}</g>`;
  const pivot = (scale, lift = 0) =>
    `translate(128 238) scale(${scale}) translate(-128 -238) translate(0 ${-lift})`;
  if (melt > 0) {
    const sy = melt === 1 ? 0.72 : 0.45;
    return `
      <ellipse cx="128" cy="236" rx="${melt === 1 ? 92 : 80}" ry="20" fill="#dff4ff" stroke="${INK}" stroke-width="8"/>
      ${at(`translate(128 238) scale(1.12 ${sy}) translate(-128 -238)`, img(art.idle))}`;
  }
  const ball = (size) => at(`translate(128 206) scale(${size}) translate(-128 -128)`, snowballGraphic('#eef8ff', '#a8d8f8'));
  switch (pose) {
    case 'walk1':
      return at(`rotate(-6 128 238)`, img(art.idle));
    case 'walk2':
      return at(`rotate(6 128 238)`, img(art.idle));
    case 'jump':
      return at(pivot('0.97 1.05', 10), img(art.idle));
    case 'throw':
      return img(art.attack);
    case 'giant':
      return at(pivot(1.12), img(art.idle)) + ball(0.6);
    case 'giantJump':
      return at(pivot(1.12, 10), img(art.idle)) + ball(0.6);
    case 'doll':
      return ball(1) + at(pivot(0.5), img(art.idle));
    default:
      return img(art.idle);
  }
}

function buildCharactersCells() {
  // 1P 姐姐 0–9、2P 妹妹 10–17，姿态顺序与引擎的 cell 索引一致。
  const sideCells = (side) => [
    sisterArt(side, 'idle'),
    sisterArt(side, 'walk1'),
    sisterArt(side, 'walk2'),
    sisterArt(side, 'jump'),
    sisterArt(side, 'throw'),
    sisterArt(side, 'giant'),
    sisterArt(side, 'giantJump'),
    sisterArt(side, 'melt', { melt: 1 }),
    sisterArt(side, 'melt', { melt: 2 }),
    sisterArt(side, 'doll'),
  ];
  const cells = [
    ...sideCells(1),
    ...sideCells(2).slice(0, 8),
    // 18: 雪片弹丸
    `<ellipse cx="128" cy="128" rx="54" ry="38" fill="#ffffff" stroke="${INK}" stroke-width="9"/>
     <circle cx="110" cy="118" r="14" fill="#bff0ff"/>
     <circle cx="144" cy="134" r="10" fill="#bff0ff"/>`,
    // 19: 白色雪球
    snowballGraphic('#eef8ff', '#a8d8f8', '#ffffff'),
  ];
  // 原画姐妹已是彩笔图，不再套蜡笔抖动滤镜；雪球和弹丸仍保留手绘抖动。
  return cells.map((body, i) => (i < 18 ? `<g>${body}</g>` : W(0, 0, body)));
}

function monster({ body, horns = '', eyes = 'angry', limbs = 0, extra = '' }) {
  const l = limbs === 1 ? -10 : limbs === 2 ? 10 : 0;
  return `
    ${horns}
    <ellipse cx="${102 + l}" cy="204" rx="18" ry="12" fill="#ffd166" stroke="${INK}" stroke-width="8"/>
    <ellipse cx="${154 - l}" cy="204" rx="18" ry="12" fill="#ffd166" stroke="${INK}" stroke-width="8"/>
    ${body}
    ${
      eyes === 'angry'
        ? `<circle cx="106" cy="116" r="12" fill="#fff"/><circle cx="150" cy="116" r="12" fill="#fff"/>
           <circle cx="108" cy="117" r="6" fill="${INK}"/><circle cx="148" cy="117" r="6" fill="${INK}"/>
           <path d="M90 98 L118 106 M166 98 L138 106" stroke="${INK}" stroke-width="7"/>`
        : `<circle cx="108" cy="116" r="10" fill="#fff"/><circle cx="148" cy="116" r="10" fill="#fff"/>
           <circle cx="108" cy="116" r="5" fill="${INK}"/><circle cx="148" cy="116" r="5" fill="${INK}"/>`
    }
    ${extra}
  `;
}

function buildEnemiesCells() {
  const cells = [
    // 0,1,2: 紫魔怪 Cheech
    monster({
      horns: `<path d="M84 82 L68 42 L104 66 Z M172 82 L188 42 L152 66 Z" fill="#ffd452" stroke="${INK}" stroke-width="8"/>`,
      body: `<ellipse cx="128" cy="136" rx="58" ry="56" fill="#a864ff" stroke="${INK}" stroke-width="9"/>`,
      limbs: 1,
      extra: `<path d="M106 154 Q128 168 150 154" fill="none" stroke="${INK}" stroke-width="7"/>`,
    }),
    monster({
      horns: `<path d="M84 82 L68 42 L104 66 Z M172 82 L188 42 L152 66 Z" fill="#ffd452" stroke="${INK}" stroke-width="8"/>`,
      body: `<ellipse cx="128" cy="136" rx="58" ry="56" fill="#a864ff" stroke="${INK}" stroke-width="9"/>`,
      limbs: 2,
      extra: `<path d="M106 154 Q128 168 150 154" fill="none" stroke="${INK}" stroke-width="7"/>`,
    }),
    `<g transform="rotate(35 128 136)">
       <circle cx="128" cy="136" r="64" fill="#a864ff" stroke="${INK}" stroke-width="9"/>
       <path d="M92 98 Q128 136 168 106 M88 152 Q128 128 164 166" fill="none" stroke="#ffd452" stroke-width="10"/>
     </g>`,
    // 3,4: 黄猴 Report
    monster({
      horns: `<circle cx="72" cy="110" r="18" fill="#ffcf42" stroke="${INK}" stroke-width="8"/><circle cx="184" cy="110" r="18" fill="#ffcf42" stroke="${INK}" stroke-width="8"/>`,
      body: `<ellipse cx="128" cy="136" rx="54" ry="54" fill="#ffcf42" stroke="${INK}" stroke-width="9"/><ellipse cx="128" cy="148" rx="34" ry="26" fill="#fff0b5" stroke="${INK}" stroke-width="6"/>`,
      limbs: 1,
      extra: `<path d="M110 150 Q128 164 146 150" fill="none" stroke="${INK}" stroke-width="6"/>`,
    }),
    monster({
      horns: `<circle cx="72" cy="110" r="18" fill="#ffcf42" stroke="${INK}" stroke-width="8"/><circle cx="184" cy="110" r="18" fill="#ffcf42" stroke="${INK}" stroke-width="8"/>`,
      body: `<ellipse cx="128" cy="130" rx="54" ry="54" fill="#ffcf42" stroke="${INK}" stroke-width="9"/><ellipse cx="128" cy="142" rx="34" ry="26" fill="#fff0b5" stroke="${INK}" stroke-width="6"/>`,
      limbs: 2,
      extra: `<circle cx="128" cy="146" r="9" fill="#ff6b6b" stroke="${INK}" stroke-width="5"/>`,
    }),
    // 5,6: 喷火绿怪 Bot-chan
    monster({
      horns: `<path d="M104 72 L114 48 L124 72 L134 48 L144 72" fill="#ff8e42" stroke="${INK}" stroke-width="7"/>`,
      body: `<ellipse cx="128" cy="140" rx="60" ry="52" fill="#46cc71" stroke="${INK}" stroke-width="9"/>`,
      limbs: 1,
      extra: `<ellipse cx="128" cy="162" rx="34" ry="18" fill="#bff5c8"/>`,
    }),
    monster({
      horns: `<path d="M104 72 L114 48 L124 72 L134 48 L144 72" fill="#ff8e42" stroke="${INK}" stroke-width="7"/>`,
      body: `<ellipse cx="128" cy="140" rx="60" ry="52" fill="#46cc71" stroke="${INK}" stroke-width="9"/>`,
      limbs: 2,
      extra: `<ellipse cx="128" cy="158" rx="22" ry="16" fill="#ff5436" stroke="${INK}" stroke-width="7"/>`,
    }),
    // 7,8: 蓝忍者旋风怪 Tornado Man
    monster({
      horns: `<path d="M84 82 L128 50 L172 82 Z" fill="#2a57c8" stroke="${INK}" stroke-width="8"/>`,
      body: `<ellipse cx="128" cy="140" rx="52" ry="50" fill="#4b8cff" stroke="${INK}" stroke-width="9"/>`,
      limbs: 1,
      extra: `<rect x="86" y="132" width="84" height="22" rx="8" fill="#1e2d5c" stroke="${INK}" stroke-width="6"/>`,
    }),
    `<path d="M52 72 Q128 46 204 72 L176 118 Q128 102 80 118 Z" fill="#6ecbff" stroke="${INK}" stroke-width="9"/>
     <path d="M74 128 Q128 108 182 128 L156 172 Q128 160 100 172 Z" fill="#4b8cff" stroke="${INK}" stroke-width="9"/>
     <path d="M96 180 L160 180 L128 218 Z" fill="#2664d8" stroke="${INK}" stroke-width="8"/>`,
    // 9,10: 火焰怪 Sarada / Fire Yeti
    monster({
      horns: `<path d="M86 82 Q108 40 128 66 Q148 40 170 82" fill="#ff9f33" stroke="${INK}" stroke-width="8"/>`,
      body: `<ellipse cx="128" cy="140" rx="56" ry="52" fill="#ff6642" stroke="${INK}" stroke-width="9"/>`,
      limbs: 1,
      extra: `<circle cx="128" cy="156" r="14" fill="#ffe066" stroke="${INK}" stroke-width="6"/>`,
    }),
    monster({
      horns: `<path d="M86 82 Q108 40 128 66 Q148 40 170 82" fill="#ff9f33" stroke="${INK}" stroke-width="8"/>`,
      body: `<ellipse cx="128" cy="140" rx="56" ry="52" fill="#ff6642" stroke="${INK}" stroke-width="9"/>`,
      limbs: 2,
      extra: `<circle cx="186" cy="108" r="20" fill="#ffcf3d" stroke="${INK}" stroke-width="7"/>`,
    }),
    // 11,12: 独角狂怪 Bottom (41F+)
    monster({
      horns: `<path d="M114 78 L128 32 L142 78 Z" fill="#fff088" stroke="${INK}" stroke-width="8"/>`,
      body: `<ellipse cx="128" cy="140" rx="58" ry="52" fill="#8938d6" stroke="${INK}" stroke-width="9"/>`,
      limbs: 1,
      extra: `<path d="M98 156 L112 146 L128 158 L144 146 L158 156" fill="none" stroke="#fff" stroke-width="7"/>`,
    }),
    monster({
      horns: `<path d="M132 98 L206 112 L132 134 Z" fill="#fff088" stroke="${INK}" stroke-width="8"/>`,
      body: `<ellipse cx="116" cy="142" rx="58" ry="48" fill="#8938d6" stroke="${INK}" stroke-width="9"/>`,
      limbs: 2,
      extra: `<path d="M46 132 L26 132 M46 156 L22 156" stroke="#ffdf7b" stroke-width="7"/>`,
    }),
    // 13,14: 蓝蝙蝠 Batch
    `<path d="M28 104 Q76 58 104 114 Q128 84 152 114 Q180 58 228 104 Q194 156 156 144 Q128 178 100 144 Q62 156 28 104 Z" fill="#529eff" stroke="${INK}" stroke-width="9"/>
     <circle cx="114" cy="122" r="9" fill="#fff"/><circle cx="142" cy="122" r="9" fill="#fff"/>
     <circle cx="114" cy="122" r="4.5" fill="${INK}"/><circle cx="142" cy="122" r="4.5" fill="${INK}"/>`,
    `<path d="M40 144 Q76 118 104 128 Q128 96 152 128 Q180 118 216 144 Q180 168 152 148 Q128 182 104 148 Q76 168 40 144 Z" fill="#529eff" stroke="${INK}" stroke-width="9"/>
     <circle cx="114" cy="128" r="9" fill="#fff"/><circle cx="142" cy="128" r="9" fill="#fff"/>
     <circle cx="114" cy="128" r="4.5" fill="${INK}"/><circle cx="142" cy="128" r="4.5" fill="${INK}"/>`,
    // 15: 相扑手 Tokoi
    `<ellipse cx="128" cy="146" rx="68" ry="56" fill="#ffbc8a" stroke="${INK}" stroke-width="9"/>
     <ellipse cx="128" cy="76" rx="22" ry="15" fill="#232d48" stroke="${INK}" stroke-width="7"/>
     <path d="M68 168 L188 168 L174 202 L82 202 Z" fill="#2d66dc" stroke="${INK}" stroke-width="8"/>
     <circle cx="106" cy="120" r="10" fill="#fff"/><circle cx="150" cy="120" r="10" fill="#fff"/>
     <circle cx="106" cy="120" r="5" fill="${INK}"/><circle cx="150" cy="120" r="5" fill="${INK}"/>
     <path d="M108 144 Q128 156 148 144" fill="none" stroke="${INK}" stroke-width="7"/>`,
    // 16,17: Bonus Kun 蓝笑脸字母怪
    `<circle cx="128" cy="136" r="62" fill="#46b6ff" stroke="${INK}" stroke-width="9"/>
     <circle cx="104" cy="118" r="11" fill="#fff"/><circle cx="152" cy="118" r="11" fill="#fff"/>
     <circle cx="104" cy="118" r="5" fill="${INK}"/><circle cx="152" cy="118" r="5" fill="${INK}"/>
     <path d="M98 148 Q128 174 158 148" fill="none" stroke="${INK}" stroke-width="8"/>`,
    `<circle cx="128" cy="126" r="62" fill="#63d1ff" stroke="${INK}" stroke-width="9"/>
     <circle cx="104" cy="108" r="11" fill="#fff"/><circle cx="152" cy="108" r="11" fill="#fff"/>
     <circle cx="104" cy="108" r="5" fill="${INK}"/><circle cx="152" cy="108" r="5" fill="${INK}"/>
     <ellipse cx="128" cy="144" rx="20" ry="14" fill="#ff7c98" stroke="${INK}" stroke-width="6"/>`,
    // 18: 南瓜头 Pumpkin Head
    `<path d="M120 52 L134 32 L144 54 Z" fill="#48a842" stroke="${INK}" stroke-width="7"/>
     <ellipse cx="128" cy="134" rx="74" ry="64" fill="#ff8928" stroke="${INK}" stroke-width="9"/>
     <path d="M96 74 Q84 134 96 194 M160 74 Q172 134 160 194" fill="none" stroke="#c85812" stroke-width="6"/>
     <polygon points="94,118 118,124 102,100" fill="#ffe866" stroke="${INK}" stroke-width="6"/>
     <polygon points="162,118 138,124 154,100" fill="#ffe866" stroke="${INK}" stroke-width="6"/>
     <path d="M88 152 L106 164 L120 150 L136 164 L150 150 L168 152 Q128 186 88 152 Z" fill="#ffe866" stroke="${INK}" stroke-width="6"/>`,
    // 19: 幽灵 Slime Ghost
    `<path d="M72 162 Q72 68 128 68 Q184 68 184 162 L166 196 L146 174 L128 198 L110 174 L90 196 Z" fill="#d9f4ff" stroke="${INK}" stroke-width="9" opacity="0.92"/>
     <circle cx="108" cy="120" r="11" fill="${INK}"/><circle cx="148" cy="120" r="11" fill="${INK}"/>
     <ellipse cx="128" cy="148" rx="14" ry="10" fill="#ff738a" stroke="${INK}" stroke-width="5"/>`,
  ];
  // 设计稿中的球形怪顶着雪帽；蝙蝠、相扑手、幽灵等非球形怪不加雪帽。
  const BLOB_CELLS = new Set([0, 1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 16, 17]);
  const SNOW_CAP = `<path d="M74 104 Q82 60 128 62 Q174 60 182 104 Q168 92 156 102 Q142 86 128 100 Q114 86 100 102 Q88 92 74 104 Z" fill="#ffffff" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>`;
  return cells.map((body, i) =>
    W(0, 0, `<g transform="translate(128 132) scale(1.14) translate(-128 -132)">${body}${BLOB_CELLS.has(i) ? SNOW_CAP : ''}</g>`),
  );
}

// 设计稿的平台：彩笔砖块加白色雪顶，4∶1 纹理按宽度平铺（每块 36 × 9 世界单位）。
function buildBrickBankSvg() {
  const bricks = [];
  for (let row = 0; row < 4; row++) {
    const y = 104 + row * 46;
    const off = row % 2 ? 72 : 0;
    for (let x = -144 + off; x < 1152; x += 144) {
      const fill = row % 2 ? '#d98a4e' : '#c7733c';
      bricks.push(`<rect x="${x + 4}" y="${y + 3}" width="136" height="40" rx="8" fill="${fill}" stroke="${INK}" stroke-width="5"/>`);
    }
  }
  let snow = 'M0 100 L0 52';
  for (let x = 0; x < 1152; x += 144) snow += ` Q${x + 36} 14 ${x + 72} 52 Q${x + 108} 16 ${x + 144} 52`;
  snow += ' L1152 100 L0 100 Z';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1152" height="288"><defs>${CRAYON_FILTER}</defs>
    ${W(0, 0, `${bricks.join('')}<rect x="0" y="84" width="1152" height="22" fill="#bfe3ff"/><path d="${snow}" fill="#ffffff" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>`)}
  </svg>`;
}

// 五个世界的侧墙与隔墙：彩笔砖块，128×128 无缝小块，游戏里按尺寸重复铺开。
const WALL_COLORS = ['#5f8fe0', '#4cc2ae', '#7f8cf0', '#d9654f', '#5760c4'];
function buildWallTileSvg(index) {
  const base = WALL_COLORS[index];
  const lighter = '#ffffff';
  const bricks = [];
  for (let row = 0; row < 2; row++) {
    const y = row * 64;
    const off = row ? 32 : 0;
    for (let x = -64 + off; x < 128; x += 64) {
      bricks.push(
        `<rect x="${x + 3}" y="${y + 3}" width="58" height="58" rx="10" fill="${base}" stroke="${INK}" stroke-width="6"/>
         <path d="M${x + 12} ${y + 16} L${x + 44} ${y + 16}" stroke="${lighter}" stroke-width="7" opacity="0.55"/>`,
      );
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><defs>${CRAYON_FILTER}</defs>${W(0, 0, bricks.join(''))}</svg>`;
}

const buildBossesCells = () => buildBossCells().map((body) => W(0, 0, body));
const buildItemsCells = () => buildItemCells().map((body) => W(0, 0, body));

function buildTitleSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#0f204e"/><stop offset="100%" stop-color="#224388"/>
      </linearGradient>
      ${CRAYON_FILTER}${SISTER_DEFS}
    </defs>
    <rect width="1024" height="768" fill="url(#sky)"/>
    <g filter="url(#crayon)">
      <path d="M520 768 L520 340 L600 220 L680 340 L680 280 L760 150 L840 280 L840 340 L920 220 L1000 340 L1000 768 Z" fill="#2e529a" stroke="${INK}" stroke-width="10"/>
      <polygon points="760,150 715,240 805,240" fill="#ff738a" stroke="${INK}" stroke-width="8"/>
      <ellipse cx="750" cy="700" rx="340" ry="120" fill="#e6f5ff" stroke="${INK}" stroke-width="10"/>
      <g transform="translate(560 440) scale(0.95)">${sisterArt(1, 'throw')}</g>
      <g transform="translate(740 465) scale(0.88)">${sisterArt(2, 'jump')}</g>
      <g transform="translate(650 515) scale(0.55)">${snowballGraphic('#eef8ff', '#9cd4ff', '#ffffff')}</g>
      <circle cx="880" cy="110" r="46" fill="#ffe678" stroke="${INK}" stroke-width="8"/>
    </g>
    ${Array.from({ length: 24 }, (_, i) => `<circle cx="${(i * 113) % 980}" cy="${(i * 67) % 420}" r="${3 + (i % 3)}" fill="#fff8d6" opacity="0.8"/>`).join('')}
  </svg>`;
}

function buildEndingSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768">
    <defs>
      <linearGradient id="dawn" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffd088"/><stop offset="55%" stop-color="#fff0c8"/><stop offset="100%" stop-color="#a8e69a"/>
      </linearGradient>
      ${CRAYON_FILTER}${SISTER_DEFS}
    </defs>
    <rect width="1024" height="768" fill="url(#dawn)"/>
    <g filter="url(#crayon)">
      <circle cx="512" cy="360" r="140" fill="#ffdf52" stroke="#ff9638" stroke-width="12"/>
      <path d="M0 540 Q512 460 1024 540 L1024 768 L0 768 Z" fill="#63cf74" stroke="${INK}" stroke-width="10"/>
      <g transform="translate(150 400) scale(0.85)">${sisterArt(1, 'jump')}</g>
      <g transform="translate(300 415) scale(0.82)">${sisterArt(2, 'idle')}</g>
      <g transform="translate(520 410) scale(1.0)">
        <path d="M86 196 L128 106 L170 196 Z" fill="#ff84c8" stroke="${INK}" stroke-width="9"/>
        <circle cx="128" cy="84" r="34" fill="#ffe6d2" stroke="${INK}" stroke-width="9"/>
        <path d="M96 72 L114 48 L128 66 L142 48 L160 72 Z" fill="#ffd952" stroke="${INK}" stroke-width="7"/>
        <circle cx="116" cy="84" r="5" fill="${INK}"/><circle cx="140" cy="84" r="5" fill="${INK}"/>
      </g>
      <g transform="translate(690 410) scale(1.0)">
        <path d="M86 196 L128 106 L170 196 Z" fill="#82e0ff" stroke="${INK}" stroke-width="9"/>
        <circle cx="128" cy="84" r="34" fill="#ffe6d2" stroke="${INK}" stroke-width="9"/>
        <path d="M96 72 L114 48 L128 66 L142 48 L160 72 Z" fill="#ffd952" stroke="${INK}" stroke-width="7"/>
        <circle cx="116" cy="84" r="5" fill="${INK}"/><circle cx="140" cy="84" r="5" fill="${INK}"/>
      </g>
    </g>
  </svg>`;
}

// 五大世界背景取冒险游戏里的彩笔场景，按 4∶3 居中裁切，保留原画的粗彩笔笔触。
// 原画的雪山图下半部是空白纸面，这里补一层彩笔雪地，让平台有地面可站。
const SNOW_GROUND = `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="576">
  <path d="M0 330 Q96 306 192 326 T384 322 T576 326 T768 320 L768 576 L0 576 Z" fill="#eef8ff" stroke="#6f93d0" stroke-width="4" stroke-linejoin="round"/>
  <path d="M40 400 Q120 384 200 404 M430 448 Q520 432 610 452 M250 500 Q330 486 410 506" fill="none" stroke="#bcd9f5" stroke-width="5" stroke-linecap="round"/>
</svg>`;
const FIELD_ART = [
  { file: 'level-snow.png', overlay: SNOW_GROUND },
  { file: 'level-sweet.png' },
  { file: 'level-cartoon.png' },
  { file: 'level-rainbow.png' },
  { file: 'level-forest.png' },
];
// 高清输出：把 SVG 的像素尺寸放大 k 倍，坐标系不变，由矢量重新栅格化（不是位图拉伸）。
const upscale = (svg, k) =>
  svg.replace(/<svg ([^>]*?)width="(\d+)" height="(\d+)">/, (_, pre, w, h) => `<svg ${pre}width="${w * k}" height="${h * k}" viewBox="0 0 ${w} ${h}">`);

async function renderWebp(svg, outPath, lossyQuality = 92, k = 4) {
  await sharp(Buffer.from(upscale(svg, k)), { limitInputPixels: false }).webp({ quality: lossyQuality, alphaQuality: 100, effort: 5 }).toFile(outPath);
}

// 图集按格并行渲染（每格 256 → 1024 像素）再拼接，蜡笔滤镜的计算量分摊到多个线程。
const CELL = 256;
const CELL_PX = 1024;
async function renderAtlas(cells, cols, rows, defs, outPath) {
  const tiles = await Promise.all(
    cells.map(async (body) => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CELL}" height="${CELL}"><defs>${CRAYON_FILTER}${defs}</defs>${body}</svg>`;
      return sharp(Buffer.from(upscale(svg, CELL_PX / CELL)), { limitInputPixels: false }).png().toBuffer();
    }),
  );
  await sharp({ create: { width: cols * CELL_PX, height: rows * CELL_PX, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(tiles.map((input, i) => ({ input, left: (i % cols) * CELL_PX, top: Math.floor(i / cols) * CELL_PX })))
    .webp({ quality: 92, alphaQuality: 100, effort: 5 })
    .toFile(outPath);
}

const FIELD_W = 2560;
const FIELD_H = 1920;
async function renderFieldArt({ file, overlay }, outPath) {
  // 原画只有 1536×1024：先用 Lanczos 放大到 4:3 的 2560×1920，再轻锐化，叠加矢量雪地。
  const base = await sharp(join(ADVENTURE_ART, file))
    .resize(FIELD_W, FIELD_H, { fit: 'cover', position: 'centre', kernel: 'lanczos3' })
    .sharpen({ sigma: 1.1, m1: 0.8, m2: 1.6 })
    .toBuffer();
  const layers = overlay ? [{ input: await sharp(Buffer.from(upscale(overlay, FIELD_W / 768)), { limitInputPixels: false }).png().toBuffer(), top: 0, left: 0 }] : [];
  await sharp(base).composite(layers).webp({ quality: 92, effort: 5 }).toFile(outPath);
}

// 高清渲染很慢（整套约 15 分钟）；调试单张图时可用 SNOW_ART_ONLY=items,bosses 只重画指定的几张。
const ONLY = process.env.SNOW_ART_ONLY ? new Set(process.env.SNOW_ART_ONLY.split(',')) : null;
const want = (name) => !ONLY || ONLY.has(name);
await Promise.all([
  want('characters') && renderAtlas(buildCharactersCells(), 5, 4, SISTER_DEFS, join(OUT, 'characters.webp')),
  want('enemies') && renderAtlas(buildEnemiesCells(), 5, 4, '', join(OUT, 'enemies.webp')),
  want('bosses') && renderAtlas(buildBossesCells(), 4, 4, '', join(OUT, 'bosses.webp')),
  want('items') && renderAtlas(buildItemsCells(), 5, 4, '', join(OUT, 'items.webp')),
  want('title') && renderWebp(buildTitleSvg(), join(OUT, 'title.webp'), 92, 2.5),
  want('ending') && renderWebp(buildEndingSvg(), join(OUT, 'ending.webp'), 92, 2.5),
  ...FIELD_ART.map((art, i) => want('fields') && renderFieldArt(art, join(OUT, `field-${i + 1}.webp`))),
  // 平台：砖块加雪顶，所有世界共用，按宽度平铺。
  want('platform') && renderWebp(buildBrickBankSvg(), join(OUT, 'platform-bank.webp')),
  ...WALL_COLORS.map((_, i) => want('walls') && renderWebp(buildWallTileSvg(i), join(OUT, `wall-${i + 1}.webp`))),
]);

// 合成设计分镜总览图到 docs/design/snow-sisters/storyboard.webp
const tiles = await Promise.all([
  sharp(join(OUT, 'title.webp')).resize(480, 360, { fit: 'contain', background: '#111a36' }).toBuffer(),
  sharp(join(OUT, 'characters.webp')).flatten({ background: '#111a36' }).resize(480, 360, { fit: 'contain', background: '#111a36' }).toBuffer(),
  sharp(join(OUT, 'enemies.webp')).flatten({ background: '#111a36' }).resize(480, 360, { fit: 'contain', background: '#111a36' }).toBuffer(),
  sharp(join(OUT, 'bosses.webp')).flatten({ background: '#111a36' }).resize(480, 360, { fit: 'contain', background: '#111a36' }).toBuffer(),
  sharp(join(OUT, 'items.webp')).flatten({ background: '#111a36' }).resize(480, 360, { fit: 'contain', background: '#111a36' }).toBuffer(),
  sharp(join(OUT, 'ending.webp')).resize(480, 360, { fit: 'contain', background: '#111a36' }).toBuffer(),
]);

await sharp({
  create: { width: 1480, height: 760, channels: 4, background: '#0b1430' },
})
  .composite(tiles.map((input, i) => ({ input, left: 16 + (i % 3) * 488, top: 16 + Math.floor(i / 3) * 372 })))
  .webp({ quality: 88 })
  .toFile(join(DOC_OUT, 'storyboard.webp'));

console.log('Generated Snow Sisters crayon assets in', OUT, 'and', DOC_OUT);
