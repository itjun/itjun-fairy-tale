const KINDS=['stars','bubble','moonblade','flame','blade','boomerang','seed','firefly','fire','snow','thunder','rain'];
const LOOPS=['flame','fire','snow','thunder','rain'];
export const AUDIO_FILES=[...KINDS.flatMap(id=>['fire','hit','defeat'].flatMap(event=>[0,1,2].map(n=>`${id}-${event}-${n}`))),...LOOPS.flatMap(id=>[`${id}-loop`,`${id}-end`]),'block','player-hurt','life-lost','boss-warning','boss-defeat','jump','flower','checkpoint','skill'];
export function soundPriority(event){return /boss-warning|player-hurt|life-lost/.test(event)?4:/block|:cast|boss-defeat/.test(event)?3:/:defeat|:hit/.test(event)?2:1;}
export class CombatAudio {
  constructor(){this.context=null;this.buffers=new Map();this.voices=[];this.loops=new Map();this.last=new Map();this.variants=new Map();this.isMuted=false;this.isDisposed=false;}
  async unlock(){
    // 开发模式会重放组件挂载；再次由玩家试用时重新建立已释放的音频会话。
    if(this.isDisposed){this.isDisposed=false;this.context=null;this.loading=null;}
    const Audio=globalThis.AudioContext || globalThis.webkitAudioContext;
    if(!Audio)return;
    this.context ||= new Audio();await this.context.resume();
    if(!this.loading)this.loading=Promise.all(AUDIO_FILES.map(async name=>{
      try{const response=await fetch(`./audio/combat/${name}.wav`);if(!response.ok)return;const buffer=await this.context.decodeAudioData(await response.arrayBuffer());if(!this.isDisposed)this.buffers.set(name,buffer);}catch{/* 静音时仍能游玩。 */}
    }));
    return this.loading;
  }
  setMuted(value){this.isMuted=value;if(value)this.pause();}
  play(event){
    if(event==='pause'){this.pause();return;}
    const [id,type]=event.split(':');
    if(type==='stop'){this.stopLoop(id);return;}
    if(!this.context || this.context.state!=='running' || this.isMuted || this.isDisposed)return;
    if(type==='loop'){if(this.loops.has(id))return;const voice=this.start(`${id}-loop`,1,true,.15);if(voice)this.loops.set(id,voice);return;}
    if(type==='end'){this.stopLoop(id);this.start(`${id}-end`,2,false,.23);return;}
    const now=this.context.currentTime,interval=id==='flame'&&type==='hit'?.14:.075;
    if(now-(this.last.get(event) ?? -10)<interval)return;
    this.last.set(event,now);
    const variant=(this.variants.get(event) || 0)%3;this.variants.set(event,variant+1);
    const name=type?`${KINDS.includes(id)?id:'blade'}-${type==='cast'?'fire':type}-${variant}`:event;
    this.start(name,soundPriority(event),false,soundPriority(event)>=3?.5:type==='fire'?.22:.32);
  }
  start(name,priority,isLoop,volume){
    const buffer=this.buffers.get(name);if(!buffer)return null;
    if(this.voices.length>=12){const quiet=this.voices.find(v=>v.priority<priority&&!v.isLoop);if(!quiet)return null;this.stop(quiet);}
    const source=this.context.createBufferSource(),gain=this.context.createGain();source.buffer=buffer;source.loop=isLoop;
    gain.gain.value=volume;source.connect(gain);gain.connect(this.context.destination);
    const voice={source,gain,priority,isLoop,name};this.voices.push(voice);
    source.onended=()=>{this.voices=this.voices.filter(v=>v!==voice);source.disconnect();gain.disconnect();};source.start();return voice;
  }
  stop(voice){if(!this.voices.includes(voice))return;this.voices=this.voices.filter(v=>v!==voice);voice.gain.gain.cancelScheduledValues(this.context.currentTime);voice.gain.gain.setTargetAtTime(0,this.context.currentTime,.015);try{voice.source.stop(this.context.currentTime+.05);}catch{}}
  stopLoop(id){const voice=this.loops.get(id);if(voice){this.loops.delete(id);this.stop(voice);}}
  pause(){for(const voice of [...this.voices])this.stop(voice);this.loops.clear();}
  async close(){this.pause();this.isDisposed=true;await this.context?.close();}
}
