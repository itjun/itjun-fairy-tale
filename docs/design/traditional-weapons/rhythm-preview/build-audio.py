"""仅供审阅：用已验证的 FC 击破样本制作四种衍生音效，不修改原样本。"""
from pathlib import Path
import hashlib
import json
import math
import struct
import wave

ROOT = Path(__file__).resolve().parent
RATE = 44100
SOURCE = ROOT.parent / 'audio/ng3-enemy-break.wav'
with wave.open(str(SOURCE), 'rb') as f:
    assert f.getframerate() == RATE and f.getnchannels() == 1
    raw = [v / 32768 for v in struct.unpack('<' + 'h' * f.getnframes(), f.readframes(f.getnframes()))]


def resample(rate, duration):
    out = []
    for i in range(round(duration * RATE)):
        p = i * rate
        j = int(p)
        out.append(raw[j] * (1 - p + j) + raw[j + 1] * (p - j) if j + 1 < len(raw) else 0)
    return out


def lowpass(values, hz):
    alpha = 1 - math.exp(-2 * math.pi * hz / RATE)
    last = 0
    out = []
    for value in values:
        last += alpha * (value - last)
        out.append(last)
    return out


def highpass(values, hz):
    lows = lowpass(values, hz)
    return [x - y for x, y in zip(values, lows)]


def finish(values, decay, peak=.72):
    values = [v * min(1, i / (RATE * .002)) * min(1, (len(values) - i - 1) / (RATE * .012)) * math.exp(-decay * i / len(values)) for i, v in enumerate(values)]
    scale = peak / max(max(map(abs, values)), .0001)
    return [v * scale for v in values]


def save(name, values):
    path = ROOT / 'audio' / name
    peak = max(map(abs, values))
    scale = min(1, .86 / max(peak, .0001))
    pcm = struct.pack('<' + 'h' * len(values), *[round(x * scale * 32767) for x in values])
    with wave.open(str(path), 'wb') as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(RATE); f.writeframes(pcm)
    rms = math.sqrt(sum(x*x*scale*scale for x in values) / len(values))
    return {'file': 'audio/' + name, 'duration': round(len(values) / RATE, 4), 'peak_dbfs': round(20*math.log10(peak*scale), 2), 'rms_dbfs': round(20*math.log10(rms), 2), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}


clips = {}
clips['saber'] = finish(highpass(resample(1.0, .20), 180), .7)
# 火尖枪有短促抖尾，仍只使用同一个原始采样，没有振荡器或随机噪声。
v = highpass(resample(1.22, .16), 650)
for i in range(len(v)):
    v[i] *= .72 + .28 * max(0, math.sin(i / RATE * math.pi * 2 * 65))
clips['spear'] = finish(v, 1.1, .68)
clips['sword'] = finish(highpass(resample(1.68, .064), 1200), 1.25, .62)
low = lowpass(resample(.62, .36), 1550)
body = lowpass(resample(.88, .36), 3600)
clips['halberd'] = finish([x*.8 + y*.25 for x,y in zip(low,body)], 1.3, .76)

meta = {'mode': 'derived WAV samples, not four unmodified original game sounds', 'source': '../audio/ng3-enemy-break.wav', 'source_sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(), 'sample_rate': RATE, 'scope': 'design preview only', 'weapons': {}}
phrases = {
    'saber': {'name': '唐刀', 'description': '保留原始音高的短促单次击破，收尾干净。', 'times': [.12], 'recipe': '1.00x, highpass 180 Hz, 200 ms, exponential release'},
    'spear': {'name': '火尖枪', 'description': '较亮的火焰抖尾，钻刺两次命中分别发声。', 'times': [.16,.27], 'recipe': '1.22x, highpass 650 Hz, 160 ms, sample-amplitude flutter'},
    'sword': {'name': '青锋剑', 'description': '更短、更清脆的三连击，每段各一个响点。', 'times': [.065,.125,.185], 'recipe': '1.68x, highpass 1200 Hz, 64 ms, short release'},
    'halberd': {'name': '方天戟', 'description': '低沉的重击与下落余音，落地时只响一次。', 'times': [.28], 'recipe': '0.62x lowpass 1550 Hz + 0.88x lowpass 3600 Hz, 360 ms'},
}
for weapon, values in clips.items():
    p = phrases[weapon]
    impact = save(weapon+'-impact.wav', values)
    length = round((p['times'][-1] + len(values)/RATE + .08)*RATE)
    cue = [0.] * length
    for t in p['times']:
        start = round(t*RATE)
        for i,v in enumerate(values): cue[start+i] += v
    meta['weapons'][weapon] = {**p, 'impact': impact, 'phrase': save(weapon+'-phrase.wav',cue)}
(ROOT / 'audio/design.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({w:{'hit':m['impact']['duration'],'phrase':m['phrase']['duration'],'peak':m['phrase']['peak_dbfs']} for w,m in meta['weapons'].items()},ensure_ascii=False))

# 保留同一套参数生成的串联对比，顺序与页面一致。
comparison = []
for weapon in ['saber', 'spear', 'sword', 'halberd']:
    with wave.open(str(ROOT / 'audio' / (weapon + '-phrase.wav')), 'rb') as f:
        comparison.extend(v / 32768 for v in struct.unpack('<' + 'h' * f.getnframes(), f.readframes(f.getnframes())))
    comparison.extend([0.] * (RATE // 2))
save('four-weapons-comparison.wav', comparison)
