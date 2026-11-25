// 本地 Web Audio 多轨芯片音乐与打击音效合成。
// 第 0～8 区与首领战各自拥有独立的调式、速度、配器、64 步旋律、贝斯线与鼓组；暂停时立即静音。

const _ = null;
const H = '=';

export const STAGE_THEMES = [
  // 第 0 区：隐藏星域 —— 梦幻深空水晶曲（A Lydian，舒缓空灵琶音）
  {
    id: 'hidden-cosmos',
    root: 220,
    steps: [13, 13],
    leadWave: 'sine',
    leadVol: 0.085,
    subWave: 'triangle',
    bassWave: 'sine',
    melody: [
      7, H, 11, H, 14, H, 18, 16, 14, H, 11, H, 9, H, _, _,
      7, H, 11, 14, 19, H, 18, 14, 16, H, H, 14, 11, H, _, _,
      4, H, 7, 11, 14, H, 16, 14, 11, H, 9, 7, 6, H, _, _,
      7, 9, 11, 14, 18, H, 19, 16, 14, H, 11, 9, 11, H, H, _,
    ],
    arp: [0, 7, 11, 16, 0, 6, 11, 14, -3, 4, 9, 12, -5, 2, 7, 11],
    bass: [
      0, _, _, _, 0, _, 7, _, -3, _, _, _, -3, _, 4, _,
      -5, _, _, _, -5, _, 2, _, -1, _, _, _, 2, _, _, _,
      -8, _, _, _, -8, _, -1, _, -5, _, _, _, -5, _, 2, _,
      -3, _, _, _, -1, _, _, _, 0, _, 7, _, 12, _, _, _,
    ],
    drums: '. . h . . . h . . . h . . . h .',
  },
  // 第 1 区：月面基地 —— 昂扬星际出击进行曲（C 大调，明快双声部方波）
  {
    id: 'lunar-march',
    root: 261.63,
    steps: [9, 9],
    leadWave: 'square',
    leadVol: 0.056,
    detune: 5,
    bassWave: 'triangle',
    melody: [
      0, H, 4, 7, 12, H, 11, 7, 9, H, 12, H, 7, H, _, _,
      5, H, 9, 12, 14, H, 12, 9, 7, H, H, 5, 4, 7, _, _,
      0, H, 4, 7, 12, H, 14, 16, 17, H, 16, 12, 14, H, _, _,
      16, 14, 12, 9, 7, H, 12, 14, 12, H, H, _, 0, 7, 12, _,
    ],
    arp: [4, 7, 12, 7, 2, 7, 11, 7, 0, 4, 9, 4, 0, 5, 9, 5],
    bass: [
      0, 12, 0, 12, -5, 7, -5, 7, -3, 9, -3, 9, -7, 5, -7, 5,
      -7, 5, -7, 5, -5, 7, -5, 7, 0, 12, 4, 7, -5, 2, 7, _,
      0, 12, 0, 12, 4, 16, 4, 16, 5, 17, 5, 17, 2, 14, 2, 14,
      -7, 5, -5, 7, 0, 7, -3, 9, -7, 5, -5, 7, 0, _, 0, _,
    ],
    drums: 'K h S h K K S h K h S h K S h S',
  },
  // 第 2 区：熔岩火山 —— 炽热疾驰摇滚脉冲（E 弗里吉亚小调，高速锯齿合成器）
  {
    id: 'magma-drive',
    root: 164.81,
    steps: [8, 8],
    leadWave: 'sawtooth',
    leadVol: 0.062,
    detune: 7,
    bassWave: 'sawtooth',
    melody: [
      12, _, 12, 13, 15, H, 13, 12, 10, _, 12, 10, 8, H, 7, _,
      12, _, 15, 17, 19, H, 17, 15, 13, H, 15, 13, 12, H, _, _,
      20, H, 19, 17, 15, H, 17, 19, 17, H, 15, 13, 12, 13, 15, _,
      17, _, 15, 13, 12, _, 10, 8, 7, H, 8, 10, 12, H, H, _,
    ],
    arp: null,
    bass: [
      0, 0, 12, 0, 1, 1, 13, 1, 0, 0, 12, 0, -2, -2, 3, 1,
      0, 0, 7, 0, 3, 3, 10, 3, 1, 1, 8, 1, 0, 0, 7, 12,
      -4, -4, 8, -4, -2, -2, 10, -2, 0, 0, 12, 0, 3, 3, 2, 0,
      1, 1, 8, 1, -2, -2, 5, -2, 0, 0, 1, 3, 0, 0, 12, _,
    ],
    drums: 'K K S h K K S S K h S h K K S S',
  },
  // 第 3 区：海上舰队 —— 蔚蓝海风波萨轻舞曲（G 大调，柔美木笛与水波琶音）
  {
    id: 'ocean-breeze',
    root: 196.0,
    steps: [11, 11],
    leadWave: 'triangle',
    leadVol: 0.105,
    subWave: 'sine',
    bassWave: 'sine',
    melody: [
      16, H, 14, 11, 12, H, 7, H, 9, 11, 12, 16, 14, H, H, _,
      19, H, 16, 14, 12, H, 9, H, 7, 9, 11, 14, 12, H, _, _,
      9, H, 12, 16, 19, H, 18, 16, 14, H, 11, 14, 16, H, _, _,
      21, H, 19, 16, 14, 16, 12, 9, 11, H, 14, 11, 12, H, H, _,
    ],
    arp: [7, 11, 14, 19, 4, 9, 12, 16, 2, 7, 11, 14, 0, 4, 9, 12],
    bass: [
      0, _, _, 0, _, _, 7, _, -3, _, _, -3, _, _, 4, _,
      -7, _, _, -7, _, _, 0, _, -5, _, _, -5, _, 2, 7, _,
      -3, _, _, -3, _, _, 4, _, -8, _, _, -8, _, _, -1, _,
      -7, _, _, -5, _, _, 2, _, 0, _, _, 7, 12, _, _, _,
    ],
    drums: 'K . h w . h K . . h w . K . h .',
  },
  // 第 4 区：深林树冠 —— 童话精灵五声木笛跳跃曲（F 大调五声，清脆断奏与木鱼节拍）
  {
    id: 'forest-canopy',
    root: 349.23,
    steps: [10, 10],
    leadWave: 'sine',
    leadVol: 0.095,
    subWave: 'triangle',
    bassWave: 'triangle',
    melody: [
      0, _, 4, 7, 9, _, 7, _, 12, 9, 7, 4, 2, _, 0, _,
      4, _, 7, 9, 12, _, 14, 12, 9, _, 7, 4, 7, H, _, _,
      9, 12, 14, _, 12, 9, 7, _, 4, 7, 9, 7, 4, _, 2, _,
      0, 2, 4, 7, 9, 12, 14, 16, 12, _, 9, 7, 12, H, _, _,
    ],
    arp: [0, 7, 4, 9, 2, 9, 7, 12, -3, 4, 0, 7, -5, 2, 4, 7],
    bass: [
      -12, _, -5, _, -12, _, -3, _, -10, _, -3, _, -12, _, -5, _,
      -8, _, -3, _, -12, _, -5, _, -10, _, -5, _, -5, _, _, _,
      -3, _, 4, _, -5, _, 2, _, -8, _, -1, _, -10, _, -3, _,
      -12, _, -8, _, -5, _, -3, _, -12, _, -5, _, -12, _, _, _,
    ],
    drums: 'w . h w . h w . w h . w . h w h',
  },
  // 第 5 区：金钱世界 —— 黄金都市爵士摇摆曲（Bb 大调 Swing 摇摆拍 + Walking Bass）
  {
    id: 'golden-swing',
    root: 233.08,
    steps: [12, 8],
    leadWave: 'sawtooth',
    leadVol: 0.056,
    detune: 4,
    bassWave: 'triangle',
    melody: [
      0, 4, 7, 9, 10, _, 7, _, 3, 4, 7, 4, 0, H, _, _,
      5, 8, 9, 12, 14, _, 12, 9, 7, _, 10, 9, 7, H, _, _,
      12, _, 15, 16, 14, 12, 9, 7, 5, 6, 7, 9, 7, _, 4, _,
      0, 3, 4, 7, 9, 12, 10, 7, 9, _, 7, 4, 12, H, _, _,
    ],
    arp: null,
    bass: [
      0, _, 4, _, 7, _, 9, _, 10, _, 9, _, 7, _, 4, _,
      5, _, 9, _, 12, _, 9, _, 0, _, 4, _, 7, _, 9, _,
      7, _, 11, _, 14, _, 11, _, 5, _, 9, _, 12, _, 8, _,
      0, _, 4, _, 7, _, 2, _, 5, _, 7, _, 0, _, 12, _,
    ],
    drums: 'K . h h S . h h K . h h S . h S',
  },
  // 第 6 区：陶土遗迹 —— 千年沙海异域回旋曲（D 希贾兹增二度神秘音阶 + 手鼓律动）
  {
    id: 'clay-mirage',
    root: 293.66,
    steps: [11, 11],
    leadWave: 'square',
    leadVol: 0.05,
    detune: 8,
    bassWave: 'triangle',
    melody: [
      0, H, 1, 4, 5, H, 4, 1, 4, 7, 8, 7, 5, 4, 1, _,
      0, H, 4, 7, 8, H, 11, 8, 7, H, H, 5, 4, H, _, _,
      12, H, 11, 8, 7, H, 8, 11, 8, 7, 5, 4, 5, H, _, _,
      7, 8, 7, 5, 4, 5, 4, 1, 0, 4, 7, 5, 0, H, H, _,
    ],
    arp: [0, 7, 12, 7, 1, 7, 13, 7, 0, 7, 12, 7, -2, 5, 10, 5],
    bass: [
      -12, _, _, -5, _, _, -12, _, -11, _, _, -5, _, _, -11, _,
      -12, _, _, -5, _, _, -4, _, -5, _, _, -8, _, _, -12, _,
      -4, _, _, 3, _, _, -4, _, -5, _, _, 2, _, _, -7, _,
      -11, _, _, -8, _, _, -7, _, -12, _, -5, _, -12, _, _, _,
    ],
    drums: 'K . h w . h K . K . w h S . w .',
  },
  // 第 7 区：太阳表面 —— 烈日破风极速电音曲（F# 小调，高速 16 分琶音 + 翱翔长音旋律）
  {
    id: 'solar-storm',
    root: 369.99,
    steps: [7, 7],
    leadWave: 'square',
    leadVol: 0.058,
    detune: 6,
    bassWave: 'sawtooth',
    melody: [
      0, H, H, 3, 7, H, H, 10, 12, H, 10, H, 7, H, H, _,
      8, H, H, 10, 12, H, 15, H, 14, H, H, 10, 12, H, _, _,
      15, H, H, 14, 12, H, 10, H, 8, H, 10, 12, 7, H, H, _,
      3, H, 7, H, 10, H, 14, H, 12, H, H, H, 12, H, _, _,
    ],
    arp: [0, 3, 7, 12, -4, 0, 3, 8, -2, 2, 5, 10, -5, -1, 2, 7],
    bass: [
      -12, -12, 0, -12, -12, -12, 0, -12, -16, -16, -4, -16, -16, -16, -4, -16,
      -14, -14, -2, -14, -9, -9, 3, -9, -10, -10, 2, -10, -17, -17, -5, -17,
      -16, -16, -4, -16, -14, -14, -2, -14, -12, -12, 0, -12, -17, -17, -5, -17,
      -16, -16, -4, -16, -14, -14, -2, -14, -12, -12, 0, -12, -12, _, 0, _,
    ],
    drums: 'K h h h S h K h K h K h S h h S',
  },
  // 第 8 区：太阳内部 —— 终章要塞决战交响曲（C 和声小调，双声部对位 + 戏剧半音下行低音）
  {
    id: 'core-finale',
    root: 261.63,
    steps: [9, 9],
    leadWave: 'square',
    leadVol: 0.06,
    detune: 6,
    subWave: 'sawtooth',
    bassWave: 'sawtooth',
    melody: [
      12, H, 15, 14, 12, H, 7, H, 8, H, 12, 10, 7, H, _, _,
      8, H, 10, 12, 14, H, 15, 17, 19, H, 17, 15, 14, H, _, _,
      20, H, 19, 15, 17, H, 15, 12, 14, H, 12, 8, 11, H, 7, _,
      12, 14, 15, 17, 19, H, 20, 22, 19, H, 17, 14, 12, H, H, _,
    ],
    arp: [3, 7, 12, 15, 2, 7, 11, 14, 0, 5, 8, 12, -1, 2, 7, 11],
    bass: [
      0, 12, 0, 12, -1, 11, -1, 11, -2, 10, -2, 10, -3, 9, -3, 9,
      -4, 8, -4, 8, -2, 10, -2, 10, -5, 7, -5, 7, -5, 2, 7, 11,
      -4, 8, -4, 8, 0, 12, 0, 12, -7, 5, -7, 5, -5, 7, -5, 7,
      0, 7, 3, 8, 7, 12, -4, 8, -5, 7, -1, 7, 0, _, 12, _,
    ],
    drums: 'K h S h K K S S K h S K K S S S',
  },
];

export const BOSS_THEME = {
  id: 'boss-alert',
  root: 196.0,
  steps: [7, 7],
  leadWave: 'sawtooth',
  leadVol: 0.062,
  detune: 8,
  bassWave: 'sawtooth',
  melody: [
    0, _, 3, 6, 7, _, 6, 3, 0, _, 10, 9, 7, 6, 3, _,
    0, _, 3, 6, 12, _, 11, 7, 9, _, 6, 7, 3, H, _, _,
    8, _, 7, 5, 6, _, 5, 3, 2, _, 5, 8, 7, H, _, _,
    12, 11, 9, 7, 6, 7, 9, 12, 11, _, 7, _, 12, H, _, _,
  ],
  arp: null,
  bass: [
    0, 0, 6, 0, 7, 0, 6, 3, 0, 0, 6, 0, 3, 2, 1, 0,
    0, 0, 6, 0, 7, 0, 10, 7, 6, 6, 3, 3, 2, 2, 7, _,
    -4, -4, 3, -4, -3, -3, 3, -3, -5, -5, 2, -5, -5, 0, 2, 6,
    0, 6, 7, 12, 6, 3, 2, 0, -1, -1, 2, 6, 7, _, 0, _,
  ],
  drums: 'K K S h K S K S K K S h K S S S',
};

const WEAPONS = [
  [820, 320, 'square'],
  [280, 58, 'triangle'],
  [980, 480, 'sine'],
  [165, 82, 'sawtooth'],
  [1420, 460, 'triangle'],
];
const BOMBS = {
  F: [178, 63, 'sawtooth'],
  B: [1100, 225, 'sine'],
  T: [1420, 65, 'square'],
  W: [660, 115, 'triangle'],
};

function holdSpan(seq, idx) {
  let n = 1;
  while (idx + n < seq.length && seq[idx + n] === H) n++;
  return n;
}

export class FlightSound {
  constructor() {
    this.enabled = true;
    this.lastStep = -1;
    this.trackKey = '';
    this.nodes = new Set();
    this.previewTimer = 0;
  }
  wake() {
    if (!this.enabled) return;
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
        this.gain = this.ctx.createGain();
        this.gain.gain.value = 0.44;
        this.gain.connect(this.ctx.destination);
        const len = Math.floor(this.ctx.sampleRate * 0.16);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const out = buf.getChannelData(0);
        for (let i = 0; i < len; i++) out[i] = Math.random() * 2 - 1;
        this.noiseBuf = buf;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    } catch {
      /* 无声设备仍可继续飞行。 */
    }
  }
  tone(a, b, duration, type = 'triangle', volume = 0.1, delay = 0, detune = 0) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running' || this.nodes.size > 56) return;
    const c = this.ctx,
      start = c.currentTime + delay,
      osc = c.createOscillator(),
      env = c.createGain();
    osc.type = type;
    if (detune) osc.detune.setValueAtTime(detune, start);
    osc.frequency.setValueAtTime(a, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, b), start + duration);
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(volume, start + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(env);
    env.connect(this.gain);
    this.nodes.add(osc);
    osc.start(start);
    osc.stop(start + duration + 0.012);
    osc.onended = () => {
      this.nodes.delete(osc);
      env.disconnect();
      osc.disconnect();
    };
  }
  noise(freq, q, duration, volume, type = 'bandpass') {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running' || !this.noiseBuf || this.nodes.size > 56) return;
    const c = this.ctx,
      start = c.currentTime,
      src = c.createBufferSource(),
      flt = c.createBiquadFilter(),
      env = c.createGain();
    src.buffer = this.noiseBuf;
    flt.type = type;
    flt.frequency.setValueAtTime(freq, start);
    flt.Q.setValueAtTime(q, start);
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(volume, start + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    src.connect(flt);
    flt.connect(env);
    env.connect(this.gain);
    this.nodes.add(src);
    src.start(start);
    src.stop(start + duration + 0.01);
    src.onended = () => {
      this.nodes.delete(src);
      env.disconnect();
      flt.disconnect();
      src.disconnect();
    };
  }
  drum(hit) {
    if (hit === 'K') this.tone(132, 34, 0.085, 'sine', 0.145);
    else if (hit === 'S') {
      this.noise(1750, 0.9, 0.075, 0.07, 'bandpass');
      this.tone(195, 92, 0.055, 'triangle', 0.065);
    } else if (hit === 'h') this.noise(6800, 1.2, 0.028, 0.028, 'highpass');
    else if (hit === 'w') this.tone(540, 310, 0.042, 'sine', 0.065);
  }
  effect(id) {
    if (id.startsWith('shot') || id.startsWith('hit')) {
      const [a, b, w] = WEAPONS[Number(id.at(-1)) - 1];
      const isHit = id.startsWith('hit');
      this.tone(isHit ? b : a, isHit ? b * 0.35 : b, isHit ? 0.068 : 0.095, w, isHit ? 0.055 : 0.068);
      return;
    }
    const spec = BOMBS[id.at(-1)];
    if (spec && /^(bomb|pulse|end)/.test(id)) {
      const [a, b, w] = spec;
      if (id.startsWith('bomb')) {
        this.tone(a, b, 0.39, w, 0.18);
        this.tone(a * 0.51, b * 1.5, 0.32, 'triangle', 0.15, 0.08);
      } else if (id.startsWith('pulse')) this.tone(b, a * 0.7, 0.13, w, 0.1);
      else this.tone(b * 2, b * 0.5, 0.26, 'sine', 0.12);
      return;
    }
    const notes = {
      pickup: [659, 880],
      life: [660, 825, 990],
      warning: [175, 175, 263],
      hurt: [190, 100, 64],
      victory: [392, 494, 587, 784],
      clear: [440, 554, 659, 880],
    }[id];
    notes?.forEach((n, i) => this.tone(n, n * 0.98, 0.15, 'triangle', 0.13, i * 0.092));
  }
  playThemeStep(theme, step) {
    const idx = step % 64;
    const [s0, s1] = theme.steps;
    const stepSec = ((step % 2 === 0 ? s0 : s1) / 60);

    const lead = theme.melody[idx];
    if (lead !== _ && lead !== H) {
      const span = holdSpan(theme.melody, idx);
      const dur = Math.min(0.85, stepSec * span * 0.9);
      const hz = theme.root * 2 ** (lead / 12);
      this.tone(hz, hz * 0.998, dur, theme.leadWave, theme.leadVol);
      if (theme.detune) this.tone(hz, hz, dur * 0.92, theme.leadWave, theme.leadVol * 0.55, 0, theme.detune);
      if (theme.subWave) this.tone(hz * 2, hz * 2, dur * 0.7, theme.subWave, theme.leadVol * 0.26);
    }

    if (theme.arp) {
      const bar = Math.floor(idx / 16) % 4;
      const arpSemi = theme.arp[bar * 4 + (idx % 4)];
      const ahz = theme.root * 2 ** (arpSemi / 12);
      this.tone(ahz, ahz, stepSec * 0.72, theme.subWave || 'triangle', 0.032);
    }

    const bassNote = theme.bass[idx];
    if (bassNote !== _ && bassNote !== H) {
      const bhz = theme.root * 0.5 * 2 ** (bassNote / 12);
      const bVol = theme.bassWave === 'sawtooth' ? 0.058 : 0.095;
      this.tone(bhz, bhz * 0.995, stepSec * 0.88, theme.bassWave, bVol);
    }

    const drumSeq = theme.drums.split(' ');
    const hit = drumSeq[idx % drumSeq.length];
    if (hit && hit !== '.') this.drum(hit);
  }
  frame(s) {
    if (!this.enabled) return;
    if (this.previewTimer) this.stopPreview();
    for (const id of new Set(s.sounds)) this.effect(id);
    const theme = s.boss ? BOSS_THEME : STAGE_THEMES[s.area] || STAGE_THEMES[1];
    const key = theme.id;
    if (key !== this.trackKey) {
      this.trackKey = key;
      this.lastStep = -1;
    }
    const [evenFrames, oddFrames] = theme.steps;
    const pairFrames = evenFrames + oddFrames;
    const pairs = Math.floor(s.areaTick / pairFrames);
    const rem = s.areaTick % pairFrames;
    const step = pairs * 2 + (rem >= evenFrames ? 1 : 0);
    if (step === this.lastStep) return;
    this.lastStep = step;
    this.playThemeStep(theme, step);
  }
  previewTest(code) {
    this.stopPreview();
    this.wake();
    if (!this.enabled) return;
    if (code >= 0 && code <= 9) {
      const theme = code === 9 ? BOSS_THEME : STAGE_THEMES[code];
      let step = 0;
      const run = () => {
        if (!this.enabled || step >= 32) {
          this.previewTimer = 0;
          return;
        }
        this.playThemeStep(theme, step);
        const waitMs = (theme.steps[step % 2] / 60) * 1000;
        step++;
        this.previewTimer = window.setTimeout(run, waitMs);
      };
      run();
    } else {
      this.effect('shot' + (1 + ((code - 10) % 5)));
    }
  }
  stopPreview() {
    if (this.previewTimer) {
      clearTimeout(this.previewTimer);
      this.previewTimer = 0;
    }
  }
  hush() {
    this.stopPreview();
    for (const n of this.nodes) {
      try {
        n.stop();
      } catch {}
    }
    this.nodes.clear();
    this.lastStep = -1;
  }
  dispose() {
    this.hush();
    this.ctx?.close().catch(() => {});
  }
}
