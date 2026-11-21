import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {CombatAudio,AUDIO_FILES} from '../src/game/combat-audio.js';

const ranged=['blade','moonblade','bubble','stars','flame','boomerang','seed','firefly'];
const read=name=>readFileSync(new URL(`../public/audio/combat/${name}.wav`,import.meta.url));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function pcm(name){
  const bytes=read(name);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WAVE');
  assert.equal(bytes.readUInt16LE(20),1);assert.equal(bytes.readUInt16LE(22),1);assert.equal(bytes.readUInt16LE(34),16);
  const rate=bytes.readUInt32LE(24),length=bytes.readUInt32LE(40),samples=[];
  assert.equal(length,bytes.length-44);
  for(let i=44;i<bytes.length;i+=2)samples.push(bytes.readInt16LE(i));
  return {bytes,rate,samples};
}
function mixer(){
  const audio=new CombatAudio();
  audio.context={currentTime:1,state:'running',destination:{},createBufferSource(){return {playbackRate:{value:1},connect(){},start(){},stop(){},disconnect(){}};},createGain(){return {gain:{value:0,cancelScheduledValues(){},setTargetAtTime(){}},connect(){},disconnect(){}};}};
  for(const name of AUDIO_FILES)audio.buffers.set(name,{});
  return audio;
}

test('每把远程武器的命中与击破都有独立 8-bit 音频，PCM 非静音且无削波',()=>{
  for(const event of ['hit','defeat'])for(const variant of [0,1,2]){
    const hashes=new Set(),duration=new Set();
    for(const kind of ranged){
      const name=`${kind}-${event}-${variant}`;assert.ok(AUDIO_FILES.includes(name));
      const {bytes,rate,samples}=pcm(name),seconds=samples.length/rate;
      assert.ok(seconds>=.075&&seconds<.25,`${name}: short impact`);
      assert.ok(samples.some(v=>Math.abs(v)>1000));assert.ok(samples.every(v=>Math.abs(v)<32700));
      hashes.add(hash(bytes));duration.add(samples.length);
    }
    assert.equal(hashes.size,8);assert.ok(duration.size>=6,'音色和节奏都不同');
  }
});

test('光刀命中和击破保留原版样本，出招短音有明确衍生记录',()=>{
  const original=readFileSync(new URL('../public/audio/combat/source/ng3-enemy-break.wav',import.meta.url));
  assert.equal(hash(original),'35c2106cfd9d66b2d0d1d460630031ab032bf3b58b98742b7cd3f0c56224a3d3');
  for(const variant of [0,1,2]){
    for(const event of ['hit','defeat'])assert.deepEqual(read(`lightblade-${event}-${variant}`),original);
    const fire=pcm(`lightblade-fire-${variant}`);assert.ok(fire.samples.length/fire.rate<.1);assert.notEqual(hash(fire.bytes),hash(original));
  }
  const provenance=JSON.parse(readFileSync(new URL('../public/audio/combat/design.json',import.meta.url)));
  assert.match(provenance.lightblade.fire,/NOT original swing command 0x06/);
});

test('命中和击破事件各播放所属武器，静音及暂停立即停止，出招不替代命中',()=>{
  const audio=mixer();
  for(const kind of [...ranged,'lightblade'])for(const event of ['fire','hit','defeat']){
    audio.pause();audio.context.currentTime+=.2;audio.play(`${kind}:${event}`);
    assert.deepEqual(audio.voices.map(v=>v.name),[`${kind}-${event}-0`]);
  }
  audio.pause();audio.context.currentTime+=1;audio.play('flame:loop');audio.play('lightblade:hit');
  assert.equal(audio.loops.size,1);audio.setMuted(true);assert.equal(audio.voices.length,0);assert.equal(audio.loops.size,0);
  audio.play('blade:hit');assert.equal(audio.voices.length,0);
  audio.setMuted(false);audio.context.currentTime+=1;audio.play('blade:hit');assert.equal(audio.voices.length,1);
  audio.play('pause');assert.equal(audio.voices.length,0);
});

test('密集命中占满声部后，新命中替换最旧命中，仍保留高优先级预警',()=>{
  const audio=mixer();audio.play('boss-warning');
  for(let i=0;i<24;i++){audio.context.currentTime+=.15;audio.play(`${ranged[i%8]}:hit`);}
  assert.equal(audio.voices.length,12);assert.ok(audio.voices.some(v=>v.name==='boss-warning'));
  assert.equal(audio.voices.at(-1).name,'firefly-hit-2');
});

test('导入音效优先按武器事件播放，缺少专用音效时走原来的声音', () => {
  const audio = mixer();
  audio.weaponBank = {
    clips: { '01': 3, '10': 2, '23': 1.8 },
    events: {
      'lightblade:fire': { clip: '01', rate: 1 },
      'lightblade:hit': { clip: '10', rate: 1 },
      'lightblade:clash': { clip: '23', rate: 1 },
      'stars:hit': { clip: '10', rate: 1.45 },
    },
  };
  for (const clip of ['01', '10', '23']) audio.buffers.set(`fc-ninja-gaiden/${clip}`, {});
  audio.play('lightblade:fire');
  audio.play('lightblade:hit');
  audio.play('lightblade:clash');
  audio.play('stars:hit');
  assert.deepEqual(audio.voices.map(voice=>voice.name), ['fc-ninja-gaiden/01', 'fc-ninja-gaiden/10', 'fc-ninja-gaiden/23', 'fc-ninja-gaiden/10']);
  assert.equal(audio.voices.at(-1).source.playbackRate.value, 1.45);
  assert.equal(audio.voices.at(-1).gain.gain.value, .64);
  audio.context.currentTime += .2;
  audio.buffers.delete('fc-ninja-gaiden/23');
  audio.play('lightblade:clash');
  audio.play('bubble:hit');
  assert.deepEqual(audio.voices.slice(-2).map(voice=>voice.name), ['block', 'bubble-hit-0']);
});
