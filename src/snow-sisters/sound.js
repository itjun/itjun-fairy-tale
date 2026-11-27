// 本地 Web Audio 2A03 芯片音色合成：12 首独立乐曲（对照 VGMPF NES 曲目表）与 20+ 种动作/打击音效。

const _ = null;
const H = '=';

export const SNOW_TRACKS = [
  // 0: 标题曲 Title Theme（C 大调明快迎宾序曲）
  {
    id: 'title',
    name: '01 标题：冰雪小夜曲',
    root: 261.63,
    steps: [10, 10],
    leadWave: 'square',
    leadVol: 0.055,
    bassWave: 'triangle',
    melody: [
      0, _, 4, 7, 12, H, 11, 7, 9, H, 7, 4, 5, H, _, _,
      2, _, 5, 9, 11, H, 9, 5, 7, H, 5, 2, 4, H, _, _,
      0, _, 4, 7, 12, H, 14, 16, 17, H, 14, 12, 11, H, _, _,
      12, 11, 9, 7, 5, 4, 2, 4, 0, H, _, _, _, _, _, _,
    ],
    bass: [
      0, _, 7, _, 0, _, 7, _, -3, _, 4, _, -7, _, 0, _,
      -10, _, -3, _, -5, _, 2, _, -7, _, 2, _, 0, _, 7, _,
      0, _, 7, _, 4, _, 11, _, 5, _, 12, _, 2, _, 7, _,
      -3, _, 4, _, -5, _, 2, _, 0, _, 7, _, 12, _, _, _,
    ],
    drums: 'K . h . S . h . K . h . S . h h',
  },
  // 1: 开场剧场 Intro（阿奇奇魔王抓走公主）
  {
    id: 'intro',
    name: '02 开场：大魔王驾到',
    root: 220.0,
    steps: [9, 9],
    leadWave: 'sawtooth',
    leadVol: 0.058,
    bassWave: 'triangle',
    melody: [
      0, 3, 7, 6, 3, 0, _, _, 1, 4, 8, 7, 4, 1, _, _,
      12, _, 11, _, 10, _, 8, _, 7, H, 6, 3, 0, H, _, _,
      0, 7, 12, 15, 14, 12, 10, 7, 8, 12, 15, 19, 17, 15, 14, 12,
      11, H, 7, H, 12, H, _, _, 0, _, _, _, _, _, _, _,
    ],
    bass: [
      0, 0, 7, 0, 0, 0, 7, 0, 1, 1, 8, 1, 1, 1, 8, 1,
      0, 0, -1, -1, -2, -2, -4, -4, -5, -5, 2, -5, 0, _, _, _,
      0, _, 7, _, 3, _, 10, _, -4, _, 3, _, -2, _, 5, _,
      -5, _, 2, _, 0, _, 7, _, 0, _, _, _, _, _, _, _,
    ],
    drums: 'K K S h K K S S K h S h K S S .',
  },
  // 2: 第 1-9 / 31-39 层主旋律（经典欢快跳跃曲）
  {
    id: 'floors1',
    name: '03 主关卡：冰阶与熔岩',
    root: 293.66,
    steps: [8, 8],
    leadWave: 'square',
    leadVol: 0.056,
    detune: 4,
    bassWave: 'triangle',
    melody: [
      0, 4, 7, 4, 12, _, 11, _, 9, 12, 9, 7, 4, _, _, _,
      5, 9, 12, 9, 14, _, 12, _, 11, 9, 7, 5, 4, _, _, _,
      0, 4, 7, 12, 16, _, 14, 12, 11, 12, 14, 11, 7, _, _, _,
      9, 12, 14, 16, 14, 12, 11, 9, 12, _, 7, _, 12, H, _, _,
    ],
    bass: [
      0, 12, 0, 12, 4, 16, 4, 16, -3, 9, -3, 9, 0, 7, 0, 7,
      -7, 5, -7, 5, -5, 7, -5, 7, -7, 5, -5, 7, 0, 7, 12, _,
      0, 12, 0, 12, 4, 16, 4, 16, -5, 7, -5, 7, -5, 2, 7, _,
      -3, 9, -5, 7, -7, 5, -5, 7, 0, 7, 0, 7, 12, _, _, _,
    ],
    drums: 'K h S h K K S h K h S h K S h S',
  },
  // 3: Boss 登场警告 Boss Stage
  {
    id: 'bossAlert',
    name: '04 警告：Boss 即将登场',
    root: 196.0,
    steps: [7, 7],
    leadWave: 'square',
    leadVol: 0.06,
    bassWave: 'sawtooth',
    melody: [
      0, _, 1, _, 3, _, 4, _, 6, _, 7, _, 9, _, 11, _,
      12, _, 12, _, 11, _, 10, _, 9, _, 7, _, 6, _, 3, _,
      0, 3, 6, 9, 12, 9, 6, 3, 0, 3, 6, 9, 12, H, _, _,
      12, _, 12, _, 12, _, _, _, _, _, _, _, _, _, _, _,
    ],
    bass: [
      0, 0, 0, 0, 1, 1, 1, 1, 3, 3, 3, 3, 6, 6, 7, 7,
      0, 0, 12, 0, -1, -1, 11, -1, -2, -2, 10, -2, -5, -5, 7, -5,
      0, 3, 6, 3, 0, 3, 6, 3, 0, 3, 6, 3, 0, 7, 12, _,
      0, _, 0, _, 0, _, _, _, _, _, _, _, _, _, _, _,
    ],
    drums: 'K K S K K K S S K K S K K S S S',
  },
  // 4: 第 10/20/30/40 层 Boss 战
  {
    id: 'boss10_40',
    name: '05 首领战：10-40 层激斗',
    root: 220.0,
    steps: [7, 7],
    leadWave: 'sawtooth',
    leadVol: 0.06,
    detune: 6,
    bassWave: 'sawtooth',
    melody: [
      0, _, 3, 7, 10, _, 7, 3, 0, _, 5, 8, 12, _, 8, 5,
      14, _, 12, 10, 8, _, 7, 5, 3, 5, 7, 8, 7, H, _, _,
      12, _, 15, 14, 12, _, 10, 7, 8, _, 12, 10, 8, _, 7, 5,
      3, 5, 7, 10, 12, 14, 15, 14, 12, _, 7, _, 12, H, _, _,
    ],
    bass: [
      0, 0, 12, 0, 0, 0, 12, 0, -4, -4, 8, -4, -4, -4, 8, -4,
      -2, -2, 10, -2, -5, -5, 7, -5, 0, 3, 7, 3, -5, 2, 7, _,
      0, 0, 12, 0, -2, -2, 10, -2, -4, -4, 8, -4, -5, -5, 7, -5,
      -9, -9, 3, -9, -7, -7, 5, -7, 0, 7, -5, 7, 0, _, _, _,
    ],
    drums: 'K K S h K S K S K K S h K S S S',
  },
  // 5: 第 11-29 层主题（机械糖屋与云端斜坡）
  {
    id: 'floors2',
    name: '06 中盘关卡：糖屋与云梯',
    root: 329.63,
    steps: [9, 9],
    leadWave: 'square',
    leadVol: 0.052,
    bassWave: 'triangle',
    melody: [
      7, _, 9, 11, 12, _, 16, 14, 12, _, 9, 7, 5, _, 7, _,
      4, _, 7, 9, 11, _, 14, 12, 9, _, 7, 5, 4, H, _, _,
      12, 14, 16, _, 14, 12, 11, _, 9, 11, 12, _, 14, 11, 9, 7,
      5, 7, 9, 11, 12, 14, 16, 19, 16, _, 12, _, 12, H, _, _,
    ],
    bass: [
      0, _, 7, _, 4, _, 11, _, -3, _, 4, _, -7, _, 0, _,
      -8, _, -1, _, -5, _, 2, _, -7, _, 0, _, -8, _, -1, _,
      0, _, 7, _, -5, _, 2, _, -3, _, 4, _, -7, _, 0, _,
      -7, _, 0, _, -5, _, 2, _, 0, _, 7, _, 12, _, _, _,
    ],
    drums: 'K . h w S . h . K . h w S . h S',
  },
  // 6: 第 41-49 层 Dosskoi Snow（和风相扑激燃曲）
  {
    id: 'dosskoi',
    name: '07 高塔：Dosskoi Snow',
    root: 246.94,
    steps: [8, 8],
    leadWave: 'square',
    leadVol: 0.058,
    detune: 5,
    bassWave: 'triangle',
    melody: [
      0, 1, 5, 7, 8, _, 7, 5, 7, _, 5, 1, 0, _, _, _,
      0, 1, 5, 7, 12, _, 8, 7, 5, 7, 8, 12, 7, H, _, _,
      12, 13, 17, 13, 12, _, 8, 7, 5, 7, 8, 7, 5, 1, 0, _,
      1, 5, 7, 8, 12, 13, 12, 8, 7, _, 5, _, 12, H, _, _,
    ],
    bass: [
      0, 12, 0, 12, 1, 13, 1, 13, 0, 7, 1, 8, 0, 7, 0, _,
      0, 12, 0, 12, -4, 8, -4, 8, -7, 5, -5, 7, 0, 7, 12, _,
      0, 12, 1, 13, 0, 12, -4, 8, -7, 5, -4, 8, -7, 5, 0, _,
      1, 13, -7, 5, -4, 8, -5, 7, 0, 7, 0, 7, 12, _, _, _,
    ],
    drums: 'K w S h K K S w K w S h K S S w',
  },
  // 7: 过关/跳关老虎机 Bonus Slot
  {
    id: 'slot',
    name: '08 奖励：幸运老虎机',
    root: 349.23,
    steps: [9, 9],
    leadWave: 'triangle',
    leadVol: 0.085,
    bassWave: 'sine',
    melody: [
      0, 4, 7, 9, 12, _, 9, 7, 4, 7, 9, 12, 14, _, _, _,
      16, 14, 12, 9, 7, _, 9, 12, 11, 9, 7, 5, 4, _, _, _,
      0, 4, 7, 9, 12, _, 14, 16, 19, _, 16, 14, 12, _, _, _,
      9, 11, 12, 14, 12, 9, 7, 4, 0, _, 7, _, 12, _, _, _,
    ],
    bass: [
      0, _, 7, _, 0, _, 7, _, -3, _, 4, _, -5, _, 2, _,
      0, _, 7, _, -3, _, 4, _, -7, _, 2, _, 0, _, 7, _,
      0, _, 7, _, 4, _, 11, _, 5, _, 12, _, 0, _, 7, _,
      -7, _, 2, _, -5, _, 2, _, 0, _, 7, _, 12, _, _, _,
    ],
    drums: 'w . h . w . h . w . h . w h w .',
  },
  // 8: 雪人头 Bonus Kun 狂欢曲
  {
    id: 'snowHead',
    name: '09 隐藏：雪人头字母秀',
    root: 392.0,
    steps: [7, 7],
    leadWave: 'square',
    leadVol: 0.055,
    bassWave: 'triangle',
    melody: [
      0, 4, 7, 12, 7, 4, 0, 4, 7, 12, 16, 12, 7, 4, 0, _,
      2, 5, 9, 14, 9, 5, 2, 5, 7, 11, 14, 19, 14, 11, 7, _,
      0, 4, 7, 12, 16, 19, 16, 12, 9, 12, 16, 21, 16, 12, 9, _,
      14, 11, 7, 14, 12, 9, 5, 12, 16, 12, 7, 12, 24, H, _, _,
    ],
    bass: [
      0, 12, 0, 12, 0, 12, 0, 12, 4, 16, 4, 16, 0, 12, 0, _,
      -10, 2, -10, 2, -5, 7, -5, 7, -5, 7, -5, 7, -5, 7, -5, _,
      0, 12, 0, 12, 4, 16, 4, 16, -3, 9, -3, 9, -3, 9, -3, _,
      -5, 7, -5, 7, -7, 5, -7, 5, 0, 7, 0, 7, 12, _, _, _,
    ],
    drums: 'K h S h K h S h K h S h K S S S',
  },
  // 9: Game Over / Continue
  {
    id: 'gameOver',
    name: '10 结束：再接再厉',
    root: 261.63,
    steps: [12, 12],
    leadWave: 'triangle',
    leadVol: 0.085,
    bassWave: 'sine',
    melody: [
      7, _, 6, _, 5, _, 4, _, 3, H, 2, _, 0, H, _, _,
      -5, _, -3, _, -1, _, 0, _, 2, H, 4, _, 0, H, _, _,
      7, _, 5, _, 4, _, 2, _, 0, _, _, _, _, _, _, _,
      _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,
    ],
    bass: [
      0, _, 7, _, -5, _, 2, _, -9, _, -2, _, -12, _, _, _,
      -5, _, 2, _, -7, _, 0, _, -5, _, 2, _, -12, _, _, _,
      -7, _, 2, _, -5, _, 2, _, -12, _, _, _, _, _, _, _,
      _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,
    ],
    drums: '. . . . . . . . . . . . . . . .',
  },
  // 10: 50 层最终 Boss（Boss De Ska）
  {
    id: 'finalBoss',
    name: '11 最终战：Boss De Ska',
    root: 261.63,
    steps: [7, 7],
    leadWave: 'square',
    leadVol: 0.062,
    detune: 7,
    bassWave: 'sawtooth',
    melody: [
      0, 3, 7, 12, 15, 14, 12, 10, 8, 12, 15, 19, 17, 15, 14, 12,
      11, 14, 17, 20, 19, 17, 15, 14, 12, 11, 8, 7, 12, H, _, _,
      15, 14, 12, 15, 14, 12, 10, 14, 12, 10, 8, 12, 10, 8, 7, _,
      11, 14, 17, 14, 19, 17, 14, 11, 12, 15, 19, 24, 24, H, _, _,
    ],
    bass: [
      0, 12, 0, 12, -2, 10, -2, 10, -4, 8, -4, 8, -5, 7, -5, 7,
      -1, 11, -1, 11, -5, 7, -5, 7, 0, 7, -4, 8, 0, 12, 0, _,
      -9, 3, -9, 3, -10, 2, -10, 2, -4, 8, -4, 8, -5, 7, -5, 7,
      -1, 11, -5, 7, -1, 11, -5, 7, 0, 7, 12, 7, 12, _, _, _,
    ],
    drums: 'K K S h K S K S K K S K K S S S',
  },
  // 11: 大结局 Ending（双胞胎公主获救）
  {
    id: 'ending',
    name: '12 结局：公主归来',
    root: 261.63,
    steps: [11, 11],
    leadWave: 'sine',
    leadVol: 0.09,
    bassWave: 'triangle',
    melody: [
      12, H, 16, 14, 12, H, 9, H, 7, 9, 11, 12, 14, H, _, _,
      16, H, 19, 17, 16, H, 12, H, 9, 12, 14, 16, 12, H, _, _,
      17, H, 16, 14, 12, H, 14, 16, 19, H, 16, 14, 12, H, _, _,
      9, 11, 12, 14, 16, 19, 24, H, 19, H, 16, H, 12, H, H, _,
    ],
    bass: [
      0, _, 7, _, 4, _, 11, _, -3, _, 4, _, -5, _, 2, _,
      0, _, 7, _, -4, _, 3, _, -7, _, 0, _, 0, _, 7, _,
      -7, _, 0, _, -3, _, 4, _, -5, _, 2, _, 0, _, 7, _,
      -7, _, 0, _, -5, _, 2, _, 0, _, 7, _, 12, _, _, _,
    ],
    drums: 'K . h . S . h . K . h . S . h .',
  },
];

function holdSpan(seq, idx) {
  let n = 1;
  while (idx + n < seq.length && seq[idx + n] === H) n++;
  return n;
}

export class SnowSound {
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
        this.gain.gain.value = 0.42;
        this.gain.connect(this.ctx.destination);
        const len = Math.floor(this.ctx.sampleRate * 0.14);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const out = buf.getChannelData(0);
        for (let i = 0; i < len; i++) out[i] = Math.random() * 2 - 1;
        this.noiseBuf = buf;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    } catch {
      /* 无音频设备仍可正常运行 */
    }
  }

  tone(a, b, duration, type = 'triangle', volume = 0.1, delay = 0, detune = 0) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running' || this.nodes.size > 56) return;
    const c = this.ctx;
    const start = c.currentTime + delay;
    const osc = c.createOscillator();
    const env = c.createGain();
    osc.type = type;
    if (detune) osc.detune.setValueAtTime(detune, start);
    osc.frequency.setValueAtTime(a, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, b), start + duration);
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(volume, start + 0.006);
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
    const c = this.ctx;
    const start = c.currentTime;
    const src = c.createBufferSource();
    const flt = c.createBiquadFilter();
    const env = c.createGain();
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
    if (hit === 'K') this.tone(132, 36, 0.08, 'sine', 0.14);
    else if (hit === 'S') {
      this.noise(1750, 0.9, 0.07, 0.065, 'bandpass');
      this.tone(195, 92, 0.05, 'triangle', 0.06);
    } else if (hit === 'h') this.noise(6800, 1.2, 0.024, 0.025, 'highpass');
    else if (hit === 'w') this.tone(560, 320, 0.04, 'sine', 0.06);
  }

  effect(id) {
    switch (id) {
      case 'shot':
        this.tone(720, 340, 0.07, 'square', 0.058);
        break;
      case 'freeze':
        this.tone(860, 1180, 0.065, 'triangle', 0.07);
        break;
      case 'wrap':
        this.tone(440, 880, 0.13, 'square', 0.075);
        this.tone(660, 1120, 0.12, 'triangle', 0.06, 0.04);
        break;
      case 'kick':
        this.tone(360, 120, 0.14, 'triangle', 0.13);
        this.noise(980, 1.4, 0.06, 0.055);
        break;
      case 'bounce':
        this.tone(240, 175, 0.07, 'triangle', 0.09);
        break;
      case 'chain':
        this.tone(523, 1046, 0.14, 'square', 0.08);
        this.tone(784, 1568, 0.12, 'sine', 0.07, 0.05);
        break;
      case 'squash':
        this.tone(260, 72, 0.12, 'sawtooth', 0.095);
        this.noise(1200, 1.0, 0.08, 0.05);
        break;
      case 'jump':
        this.tone(280, 620, 0.11, 'square', 0.058);
        break;
      case 'potion':
        [523, 659, 784, 1046].forEach((n, i) => this.tone(n, n * 1.02, 0.08, 'square', 0.065, i * 0.045));
        break;
      case 'giant':
        [392, 494, 587, 784, 988].forEach((n, i) => this.tone(n, n * 1.04, 0.1, 'sawtooth', 0.065, i * 0.05));
        break;
      case 'sushi':
        this.tone(880, 1320, 0.09, 'triangle', 0.08);
        break;
      case 'letter':
        [659, 880, 1175].forEach((n, i) => this.tone(n, n, 0.09, 'square', 0.06, i * 0.045));
        break;
      case 'snowHead':
        [523, 659, 784, 1046, 1318].forEach((n, i) => this.tone(n, n, 0.1, 'triangle', 0.08, i * 0.05));
        break;
      case 'oneUp':
        [523, 659, 784, 1046, 1318, 1568].forEach((n, i) => this.tone(n, n, 0.11, 'square', 0.07, i * 0.055));
        break;
      case 'pumpkin':
        this.tone(180, 92, 0.25, 'sawtooth', 0.09);
        this.tone(240, 120, 0.25, 'square', 0.06, 0.08);
        break;
      case 'melt':
        [440, 349, 262, 185].forEach((n, i) => this.tone(n, n * 0.78, 0.12, 'triangle', 0.1, i * 0.07));
        break;
      case 'bossHit':
        this.tone(160, 78, 0.09, 'sawtooth', 0.09);
        break;
      case 'bossDown':
        [392, 330, 262, 196, 147].forEach((n, i) => this.tone(n, n * 0.8, 0.14, 'sawtooth', 0.09, i * 0.065));
        break;
      case 'slotSpin':
        this.tone(620, 740, 0.035, 'triangle', 0.045);
        break;
      case 'slotStop':
        this.tone(988, 1318, 0.1, 'square', 0.075);
        break;
      case 'stageStart':
        [392, 494, 587, 784].forEach((n, i) => this.tone(n, n, 0.1, 'square', 0.06, i * 0.06));
        break;
      case 'gameOver':
        [392, 349, 311, 262].forEach((n, i) => this.tone(n, n * 0.94, 0.22, 'triangle', 0.1, i * 0.14));
        break;
      case 'ending':
        [523, 659, 784, 1046, 1318].forEach((n, i) => this.tone(n, n, 0.2, 'sine', 0.09, i * 0.11));
        break;
      default:
        break;
    }
  }

  playTrackStep(track, step) {
    const idx = step % 64;
    const [s0, s1] = track.steps;
    const stepSec = (step % 2 === 0 ? s0 : s1) / 60;

    const lead = track.melody[idx];
    if (lead !== _ && lead !== H) {
      const span = holdSpan(track.melody, idx);
      const dur = Math.min(0.8, stepSec * span * 0.9);
      const hz = track.root * 2 ** (lead / 12);
      this.tone(hz, hz * 0.998, dur, track.leadWave, track.leadVol);
      if (track.detune) this.tone(hz, hz, dur * 0.9, track.leadWave, track.leadVol * 0.5, 0, track.detune);
    }

    const bassNote = track.bass[idx];
    if (bassNote !== _ && bassNote !== H) {
      const bhz = track.root * 0.5 * 2 ** (bassNote / 12);
      const bVol = track.bassWave === 'sawtooth' ? 0.055 : 0.09;
      this.tone(bhz, bhz * 0.995, stepSec * 0.88, track.bassWave, bVol);
    }

    const drumSeq = track.drums.split(' ');
    const hit = drumSeq[idx % drumSeq.length];
    if (hit && hit !== '.') this.drum(hit);
  }

  trackForState(s) {
    if (!s) return SNOW_TRACKS[0];
    if (s.phase === 'intro') return SNOW_TRACKS[1];
    if (s.phase === 'ending') return SNOW_TRACKS[11];
    if (s.phase === 'over') return SNOW_TRACKS[9];
    if (s.phase === 'slot' || s.phase === 'warpSlot') return SNOW_TRACKS[7];
    if (s.snowHeadTimer > 0) return SNOW_TRACKS[8];
    if (s.floor === 50) return SNOW_TRACKS[10];
    if (s.floor % 10 === 0) return SNOW_TRACKS[4];
    if (s.floor >= 41) return SNOW_TRACKS[6];
    if (s.floor >= 11 && s.floor <= 29) return SNOW_TRACKS[5];
    return SNOW_TRACKS[2];
  }

  frame(s) {
    if (!this.enabled || !s) return;
    if (this.previewTimer) this.stopPreview();
    for (const id of new Set(s.sounds || [])) this.effect(id);
    const track = this.trackForState(s);
    if (track.id !== this.trackKey) {
      this.trackKey = track.id;
      this.lastStep = -1;
    }
    const [evenFrames, oddFrames] = track.steps;
    const pairFrames = evenFrames + oddFrames;
    const pairs = Math.floor(s.frame / pairFrames);
    const rem = s.frame % pairFrames;
    const step = pairs * 2 + (rem >= evenFrames ? 1 : 0);
    if (step === this.lastStep) return;
    this.lastStep = step;
    this.playTrackStep(track, step);
  }

  previewTest(code) {
    this.stopPreview();
    this.wake();
    if (!this.enabled) return;
    if (code >= 0 && code < SNOW_TRACKS.length) {
      const track = SNOW_TRACKS[code];
      let step = 0;
      const run = () => {
        if (!this.enabled || step >= 32) {
          this.previewTimer = 0;
          return;
        }
        this.playTrackStep(track, step);
        const waitMs = (track.steps[step % 2] / 60) * 1000;
        step++;
        this.previewTimer = window.setTimeout(run, waitMs);
      };
      run();
    } else {
      const sfxList = ['shot', 'wrap', 'kick', 'chain', 'potion', 'oneUp'];
      this.effect(sfxList[(code - SNOW_TRACKS.length) % sfxList.length]);
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
