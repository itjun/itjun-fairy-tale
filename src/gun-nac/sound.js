// 本地合成的方波、三角波和鼓点。音符由有效游玩帧驱动，暂停时关闭输出。
const SONGS = [
  [0, 7, 10, 14, 12, 7, 3, 5, 0, 3, 7, 10, 5, 3, 2, -2],
  [0, 7, 12, 10, 7, 3, 5, 7, 0, 5, 12, 14, 10, 7, 5, 2],
  [0, 3, 6, 7, 10, 7, 6, 3, 0, -2, 3, 6, 7, 10, 6, 2],
  [0, 5, 7, 12, 14, 12, 7, 5, 2, 7, 10, 14, 12, 10, 5, 7],
  [0, 3, 7, 5, 2, 5, 8, 7, 3, 7, 10, 8, 5, 3, 2, -2],
  [0, 4, 7, 11, 7, 4, 9, 7, 2, 6, 9, 12, 11, 7, 4, 2],
  [0, 2, 3, 7, 5, 3, 2, -2, 0, 5, 7, 10, 7, 5, 2, -2],
  [0, 7, 8, 7, 12, 10, 7, 5, 0, -1, 5, 7, 10, 12, 7, 3],
  [0, 3, 6, 9, 7, 6, 3, 0, -3, 0, 3, 7, 6, 3, 2, -1],
];
const WEAPONS = [
  [780, 300, 'square'],
  [260, 60, 'triangle'],
  [910, 450, 'sine'],
  [145, 80, 'sawtooth'],
  [1350, 430, 'triangle'],
];
const BOMBS = {
  F: [178, 63, 'sawtooth'],
  B: [1100, 225, 'sine'],
  T: [1420, 65, 'square'],
  W: [660, 115, 'triangle'],
};
export class FlightSound {
  constructor() {
    this.enabled = true;
    this.lastBeat = -1;
    this.nodes = new Set();
  }
  wake() {
    if (!this.enabled) return;
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
        this.gain = this.ctx.createGain();
        this.gain.gain.value = 0.42;
        this.gain.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    } catch {
      /* 无声设备仍可继续飞行。 */
    }
  }
  tone(a, b, duration, type = 'triangle', volume = 0.1, delay = 0) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running' || this.nodes.size > 40) return;
    const c = this.ctx,
      start = c.currentTime + delay,
      osc = c.createOscillator(),
      env = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(a, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, b), start + duration);
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(volume, start + 0.007);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(env);
    env.connect(this.gain);
    this.nodes.add(osc);
    osc.start(start);
    osc.stop(start + duration + 0.01);
    osc.onended = () => {
      this.nodes.delete(osc);
      env.disconnect();
      osc.disconnect();
    };
  }
  effect(id) {
    if (id.startsWith('shot') || id.startsWith('hit')) {
      const [a, b, w] = WEAPONS[Number(id.at(-1)) - 1];
      const hit = id.startsWith('hit');
      this.tone(hit ? b : a, hit ? b * 0.33 : b, hit ? 0.065 : 0.095, w, hit ? 0.052 : 0.068);
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
  frame(s) {
    if (!this.enabled) return;
    for (const id of new Set(s.sounds)) this.effect(id);
    const tempo = s.boss ? 12 : [15, 15, 13, 17, 16, 14, 17, 12, 13][s.area],
      beat = Math.floor(s.areaTick / tempo);
    if (beat === this.lastBeat) return;
    this.lastBeat = beat;
    const phrase = SONGS[s.area],
      root = s.boss ? 185 : 220,
      bar = Math.floor(beat / 16) % 4;
    const note = phrase[beat % 16] + [0, -2, 3, 0][bar],
      hz = root * 2 ** (note / 12);
    if (beat % 8 !== 7) this.tone(hz, hz, 0.13, 'square', 0.03);
    if (beat % 2 === 0) {
      const bass = root * 0.5 * 2 ** (([0, -2, 3, 0][bar] + (beat % 4 ? 7 : 0)) / 12);
      this.tone(bass, bass, 0.17, 'triangle', 0.1);
    }
    if (beat % 4 === 0) this.tone(105, 32, 0.075, 'sine', 0.14);
    if (beat % 4 === 2) this.tone(1450, 180, 0.042, 'sawtooth', 0.035);
  }
  hush() {
    for (const n of this.nodes) {
      try {
        n.stop();
      } catch {}
    }
    this.nodes.clear();
    this.lastBeat = -1;
  }
  dispose() {
    this.hush();
    this.ctx?.close().catch(() => {});
  }
}
