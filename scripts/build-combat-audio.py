"""离线生成战斗 WAV：远程命中使用原创 8-bit 短音，光刀使用已验证的 FC 击破底样。"""
from pathlib import Path
import math, random, wave, struct, shutil, json, hashlib
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

# 命中不再只是把同一条柔和发射声升调。每把武器有独立的音高节拍、占空比和噪声尾音。
# 按约 60 Hz 更新音高，脉冲与三角音保留红白机时代短促的阶梯感。
impacts={
    'blade':{'notes':[1320,880,440,220],'step':.020,'duty':.5,'noise':.18,'label':'亮斩下落，四阶脉冲'},
    'moonblade':{'notes':[540,810,1080,720,360],'step':.017,'duty':.125,'noise':.10,'label':'弧形上挑再落下，窄脉冲'},
    'bubble':{'notes':[720,420,220,110,70],'step':.022,'duty':.5,'noise':.20,'triangle':True,'label':'圆润降调气泡，低音爆开'},
    'stars':{'notes':[1568,2093,1568,1046,784],'step':.014,'duty':.25,'noise':.06,'label':'高音五点星响'},
    'flame':{'notes':[170,145,120,95,75,60],'step':.018,'duty':.25,'noise':.82,'label':'粗颗粒火焰噼啪'},
    'boomerang':{'notes':[660,440,330,440,660,880],'step':.015,'duty':.125,'noise':.12,'label':'回旋双向滑音'},
    'seed':{'notes':[240,120,80,60,45],'step':.028,'duty':.5,'noise':.48,'triangle':True,'label':'低沉落地爆种'},
    'firefly':{'notes':[1175,1568,2349,1760],'step':.018,'duty':.125,'noise':.03,'label':'轻亮上行电子铃音'},
}
def write_pcm(path,values,rate=RATE,peak=.65):
    amplitude=max((abs(v) for v in values),default=0)
    scale=peak*32767/max(amplitude,.00001)
    with wave.open(str(path),'wb') as w:
        w.setparams((1,2,rate,0,'NONE','not compressed'))
        w.writeframes(b''.join(struct.pack('<h',round(v*scale)) for v in values))

def render_impact(key,event,variant):
    p=impacts[key];notes=p['notes'];step=p['step'];is_defeat=event=='defeat'
    # 击破保留该武器的完整命中起音，再接一段更低的短尾；一击打倒也能辨认武器。
    duration=len(notes)*step+(.050 if is_defeat else .018)
    phase=0;noise_phase=0;lfsr=1+variant*107;held=1;values=[];filtered=0
    for i in range(round(RATE*duration)):
        t=i/RATE;index=min(len(notes)-1,int(t/step));f=notes[index]*(1+(variant-1)*.025)
        if t>=len(notes)*step:f*=.6
        phase=(phase+f/RATE)%1
        tone=1 if phase<p['duty'] else -1
        if p.get('triangle'):tone=1-4*abs(phase-.5)
        noise_phase+=(2400 if key=='flame' else 7000)/RATE
        if noise_phase>=1:
            noise_phase-=1;bit=(lfsr^(lfsr>>1))&1;lfsr=(lfsr>>1)|(bit<<14);held=1 if lfsr&1 else -1
        env=min(1,t/.0015)*max(0,1-t/duration)**1.6
        # 火龙两次短促噼啪，区别于种子的单次厚响。
        if key=='flame':env*=.55+.45*(int(t/.018)%2==0)
        value=((1-p['noise'])*tone+p['noise']*held)*env
        filtered=filtered*.22+value*.78;values.append(filtered)
    write_pcm(OUT/f'{key}-{event}-{variant}.wav',values)

for key in impacts:
    for event in ['hit','defeat']:
        for variant in range(3):render_impact(key,event,variant)

source=OUT/'source/ng3-enemy-break.wav'
source_bytes=source.read_bytes()
assert hashlib.sha256(source_bytes).hexdigest()=='35c2106cfd9d66b2d0d1d460630031ab032bf3b58b98742b7cd3f0c56224a3d3'
with wave.open(str(source),'rb') as w:
    sample_rate=w.getframerate();raw=w.readframes(w.getnframes());samples=struct.unpack('<'+'h'*(len(raw)//2),raw)
for variant in range(3):
    for event in ['hit','defeat']:shutil.copyfile(source,OUT/f'lightblade-{event}-{variant}.wav')
    # 仅缩短原击破底样作为出招声；不是原游戏的挥刀命令 0x06，不能混称。
    length=round(sample_rate*.095)
    values=[v*min(1,i/(sample_rate*.0015))*min(1,(length-i)/(sample_rate*.025)) for i,v in enumerate(samples[:length])]
    write_pcm(OUT/f'lightblade-fire-{variant}.wav',values,sample_rate,peak=.48)

metadata={
    'ranged':{'origin':'Original deterministic 8-bit synthesis; not recordings from Ninja Gaiden or other games.','profiles':impacts},
    'lightblade':{'source':'source/ng3-enemy-break.wav','source_sha256':hashlib.sha256(source_bytes).hexdigest(),
        'hit_and_defeat':'Unmodified verified Ninja Gaiden III enemy-break sample (sound command 0x2D). All variants intentionally identical.',
        'fire':'First 95 ms of the same enemy-break sample with short fades and normalization. Derived cue, NOT original swing command 0x06.',
        'source_page':'https://nesninja.com/game/nes/ninja-gaiden-iii-the-ancient-ship-of-doom/music',
        'copyright_in_source':'1991 Tecmo, Ltd.','original_validation':'Game emulation linked enemy defeats and score increases to 0x2D; NSFE zero-based track 67 maps to 0x2D. See source/source.json.'},
    'files':{}
}
for key in [*impacts,'lightblade']:
    for event in ['fire','hit','defeat']:
        for variant in range(3):
            name=f'{key}-{event}-{variant}';p=OUT/f'{name}.wav'
            with wave.open(str(p),'rb') as w:
                raw=w.readframes(w.getnframes());values=struct.unpack('<'+'h'*(len(raw)//2),raw)
                metadata['files'][name]={'seconds':len(values)/w.getframerate(),'sample_rate':w.getframerate(),'peak':max(abs(v) for v in values),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
(OUT/'design.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n')
print(f'Created {len(list(OUT.glob("*.wav")))} combat WAV files; original sample provenance in source/source.json')
