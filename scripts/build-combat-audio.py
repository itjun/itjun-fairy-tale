"""原创彩笔战斗音效，确定性合成 PCM WAV；无需网络或第三方录音。"""
from pathlib import Path
import math, random, wave, struct
OUT=Path(__file__).resolve().parents[1]/'public/audio/combat'
OUT.mkdir(parents=True,exist_ok=True)
RATE=22050
profiles={'stars':(880,.08,'wood'),'bubble':(320,.14,'pop'),'moonblade':(740,.10,'swoosh'),'flame':(155,.15,'crackle'),'blade':(440,.16,'swoosh'),'boomerang':(520,.16,'sweep'),'seed':(240,.17,'wood'),'firefly':(1100,.08,'bell'),'fire':(260,.35,'swoosh'),'snow':(520,.4,'wind'),'thunder':(440,.28,'zap'),'rain':(720,.35,'drop')}
def render(name,freq,duration,timbre,variant=0,event='fire'):
    rng=random.Random(name+str(variant));count=int(RATE*duration);values=[];filtered=0
    for i in range(count):
        t=i/RATE;u=t/duration;noise=rng.uniform(-1,1);filtered=filtered*.8+noise*.2
        f=freq*(1+(variant-1)*.035);phase=2*math.pi*f*t
        env=min(1,t/.008)*math.exp(-u*(3 if event=='loop' else 5))*min(1,(1-u)*20)
        if event=='loop':env=min(1,t/.03,(duration-t)/.03)*.65
        if timbre=='wood':v=math.sin(phase)*math.exp(-t*22)+.35*math.sin(phase*2.76)*math.exp(-t*50)
        elif timbre=='pop':v=math.sin(phase*(1-u*.6))+.25*filtered
        elif timbre in ['swoosh','sweep']:v=filtered*2*math.sin(math.pi*u)+.3*math.sin(phase*(1-u*.35))
        elif timbre=='crackle':v=filtered*2+.25*math.sin(phase)+(noise*.15 if i%700<35 else 0)
        elif timbre=='wind':v=filtered*2+.15*math.sin(phase)
        elif timbre=='zap':v=.55*math.sin(phase+3*math.sin(phase*.7))+filtered
        elif timbre=='drop':v=math.sin(phase*(1+.2*u))*.6+.2*math.sin(phase*1.5)
        else:v=math.sin(phase)+.3*math.sin(phase*2.7)*math.exp(-t*30)
        values.append(v*env)
    peak=max(max(abs(v) for v in values),1)
    with wave.open(str(OUT/(name+'.wav')),'wb') as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(RATE);w.writeframes(b''.join(struct.pack('<h',round(v/peak*11000)) for v in values))
for key,(f,d,t) in profiles.items():
    for event in ['fire','hit','defeat']:
        for variant in range(3):render(f'{key}-{event}-{variant}',f*(1.25 if event=='hit' else 1.5 if event=='defeat' else 1),d*(1.6 if event=='defeat' else 1),t,variant,event)
    if key in ['flame','fire','snow','thunder','rain']:
        render(f'{key}-loop',f,.8,t,event='loop');render(f'{key}-end',f*.7,.18,t)
for key,f,d,t in [('block',220,.12,'wood'),('player-hurt',294,.2,'pop'),('life-lost',330,.55,'wood'),('boss-warning',660,.65,'bell'),('boss-defeat',784,.6,'bell'),('jump',440,.12,'pop'),('flower',988,.15,'bell'),('checkpoint',784,.4,'bell'),('skill',1046,.4,'bell')]:
    render(key,f,d,t)
print(f'Created {len(list(OUT.glob("*.wav")))} original WAV files')
