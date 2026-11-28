#!/usr/bin/env node
/**
 * 生成世界地图上的「空军基地」彩笔插画贴图（public/assets/atlas-airbase.png）。
 * 画风对齐 adventure-china-atlas.webp：彩笔粗墨线、蜡笔颗粒质感、透明底，叠加在画纸上自然融入。
 */
import sharp from 'sharp';

const OUT = 'public/assets/atlas-airbase.png';
const INK = '#263a5c';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="576" viewBox="0 0 384 288">
  <defs>
    <filter id="crayon" x="-8%" y="-8%" width="116%" height="116%">
      <feTurbulence type="fractalNoise" baseFrequency="0.14" numOctaves="3" seed="11" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.4" xChannelSelector="R" yChannelSelector="G" result="wobble"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.9 0.35" numOctaves="2" seed="5" result="grain"/>
      <feColorMatrix in="grain" type="matrix"
        values="0.28 0 0 0 0.74  0.28 0 0 0 0.74  0.28 0 0 0 0.74  0 0 0 0 1" result="waxy"/>
      <feBlend in="wobble" in2="waxy" mode="multiply" result="shaded"/>
      <feComposite in="shaded" in2="wobble" operator="in"/>
    </filter>
  </defs>

  <g filter="url(#crayon)" stroke-linecap="round" stroke-linejoin="round">
    <!-- 轻轻的云朵与飞行尾迹 -->
    <path d="M242 54 C250 38, 274 36, 282 48 C294 44, 312 52, 312 64 C312 76, 298 82, 284 82 L248 82 C234 82, 226 72, 232 62 C234 57, 238 55, 242 54 Z"
      fill="#e8f5ff" stroke="#5b9bd5" stroke-width="3.6"/>
    <path d="M52 72 C58 60, 76 58, 84 68 C94 65, 106 72, 106 81 C106 90, 96 95, 84 95 L56 95 C44 95, 38 86, 44 78 C46 74, 49 72, 52 72 Z"
      fill="#e8f5ff" stroke="#5b9bd5" stroke-width="3.4"/>

    <!-- 草地小山坡底座 -->
    <path d="M30 232 Q115 190 198 198 Q286 192 356 230 Q332 260 196 266 Q66 264 30 232 Z"
      fill="#c9ec91" stroke="#4d9d44" stroke-width="4.2"/>
    <path d="M62 246 Q142 254 236 250 Q300 246 334 234" fill="none" stroke="#62b44c" stroke-width="3.4"/>

    <!-- 机场小灌木 -->
    <path d="M40 218 C36 204, 52 194, 64 202 C72 192, 90 198, 88 212 C96 218, 90 228, 76 228 L50 228 C40 228, 36 224, 40 218 Z"
      fill="#9ee067" stroke="#3c8b39" stroke-width="3.8"/>
    <path d="M294 216 C292 204, 306 196, 316 204 C324 196, 340 202, 338 214 C344 220, 338 228, 326 228 L302 228 C294 228, 290 222, 294 216 Z"
      fill="#9ee067" stroke="#3c8b39" stroke-width="3.8"/>

    <!-- 跑道（斜向透视，带白色中线） -->
    <path d="M74 238 L168 186 L316 198 L266 250 Z" fill="#9fb6d1" stroke="${INK}" stroke-width="4.5"/>
    <path d="M138 226 L160 214 M176 210 L198 204 M218 206 L242 208 M258 212 L278 216"
      fill="none" stroke="#fff9e8" stroke-width="4.2"/>

    <!-- 圆顶机库 -->
    <path d="M98 188 L98 148 C98 122, 174 122, 174 148 L174 188 Z"
      fill="#fff3d6" stroke="${INK}" stroke-width="4.5"/>
    <path d="M98 150 C118 138, 154 138, 174 150" fill="none" stroke="#e45765" stroke-width="5"/>
    <path d="M114 188 L114 162 C114 148, 158 148, 158 162 L158 188 Z"
      fill="#7ea6d6" stroke="${INK}" stroke-width="4"/>

    <!-- 控制塔台 -->
    <path d="M180 186 L186 126 L216 126 L222 186 Z" fill="#ffe4b5" stroke="${INK}" stroke-width="4.4"/>
    <path d="M174 126 L180 100 L222 100 L228 126 Z" fill="#82cdfc" stroke="${INK}" stroke-width="4.4"/>
    <path d="M192 102 L192 124 M210 102 L210 124" stroke="${INK}" stroke-width="3.2"/>
    <path d="M170 100 L201 84 L232 100 Z" fill="#e95a63" stroke="${INK}" stroke-width="4.4"/>
    <!-- 塔台雷达天线 -->
    <line x1="201" y1="84" x2="201" y2="66" stroke="${INK}" stroke-width="4"/>
    <circle cx="201" cy="63" r="6" fill="#ffd24c" stroke="${INK}" stroke-width="3.5"/>

    <!-- 红白风向袋 -->
    <line x1="80" y1="208" x2="80" y2="156" stroke="${INK}" stroke-width="3.8"/>
    <path d="M80 158 L108 163 L106 175 L80 174 Z" fill="#ff6b6b" stroke="${INK}" stroke-width="3.4"/>
    <path d="M90 160 L98 161.5 L97 174.5 L90 174.2 Z" fill="#fff9ea" stroke="none"/>

    <!-- 起飞中的彩笔小战机（短机身、三角翼、双垂尾、金色座舱，与彩笔战机造型一致） -->
    <!-- 尾气弧线 -->
    <path d="M214 140 Q232 132 246 118" fill="none" stroke="#ffad42" stroke-width="5.5"/>
    <path d="M206 146 Q220 142 232 132" fill="none" stroke="#ffe074" stroke-width="3.5"/>
    <g transform="translate(278 96) rotate(36)">
      <!-- 装翼侧舱 -->
      <path d="M-38 2 L-24 -6 L-22 12 L-36 16 Z" fill="#7ec8ff" stroke="${INK}" stroke-width="4"/>
      <path d="M38 2 L24 -6 L22 12 L36 16 Z" fill="#7ec8ff" stroke="${INK}" stroke-width="4"/>
      <!-- 主机身三角翼 -->
      <path d="M0 -34 L13 -14 L32 12 L24 20 L11 12 L7 30 L0 24 L-7 30 L-11 12 L-24 20 L-32 12 L-13 -14 Z"
        fill="#d7e9ff" stroke="${INK}" stroke-width="4.6"/>
      <!-- 双垂尾 -->
      <path d="M-13 6 L-6 10 L-5 26 L-12 22 Z" fill="#6fa6df" stroke="${INK}" stroke-width="3.6"/>
      <path d="M13 6 L6 10 L5 26 L12 22 Z" fill="#6fa6df" stroke="${INK}" stroke-width="3.6"/>
      <!-- 金色座舱盖 -->
      <ellipse cx="0" cy="-10" rx="6.5" ry="10.5" fill="#ffd24c" stroke="${INK}" stroke-width="3.8"/>
      <!-- 尾喷口 -->
      <rect x="-5" y="26" width="4" height="7" rx="1.5" fill="#ff8f24"/>
      <rect x="1" y="26" width="4" height="7" rx="1.5" fill="#ff8f24"/>
    </g>

    <!-- 星星小点缀 -->
    <path d="M332 62 L335 70 L344 71 L337 76 L339 84 L332 79 L325 84 L327 76 L320 71 L329 70 Z"
      fill="#ffd54f" stroke="#d18b19" stroke-width="2.4"/>
  </g>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(OUT);
console.log(`已生成 ${OUT}`);
