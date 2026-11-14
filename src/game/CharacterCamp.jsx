import { useGamepad } from '../input/GamepadSupport.jsx';
import { CombatAudio } from './combat-audio.js';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Heart, Star } from '@phosphor-icons/react';
import { INITIAL_LIVES, CHARACTERS, newSurvival, takeDamage, recordAttack, bloomAtHit } from './characters.js';
import { createPlayer, stepPlayer } from './physics.js';
import { fireLoadout, fireAdventureWeapon, stepAdventureWave } from './adventure-combat.js';
import { WEAPONS, UPGRADES } from './adventure.js';
import { starterAdventure, recommendedStarter } from './starter-build.js';
import { StarterPicker } from './StarterPicker.jsx';
import { trapFocus } from './AdventurePanels.jsx';
import './characters.css';

function CharacterPractice({ character, build, isTrying, onProgress, mixer }) {
  const canvas = useRef(null);
  useEffect(() => {
    const pad = { actions: new Set(), direction: 0 };
    const node = canvas.current, context = node.getContext('2d'), images = {}, keys = new Set();
    const person = CHARACTERS[character], survival = newSurvival(character), adventure=starterAdventure(0,build);
    const floor = { id:0, x:14, y:0, width:28 }, player = createPlayer(floor), enemy = { id:1, combatVersion:2, x:14, y:0, width:1.5, height:2.5, hp:999, isDefeated:false };
    player.x = 8.5;
    let isDisposed = false, frame, previous = 0, elapsed = 0, waves = [], jump = false, effect, nextDemoJump = 0, nextContact = 2;
    const names = [...new Set([person.image, person.attack, 'enemy-leaf', 'flame-stream', ...Object.values(WEAPONS).map(w=>w.image), 'flower', 'collectible-rainbow', 'enemy-burst'])];
    onProgress({ attacks:0, shieldRemaining:0 });
    function keydown(event) {
      if (!['ArrowLeft','ArrowRight','KeyA','KeyD','KeyJ','Space','ArrowUp','KeyW'].includes(event.code) || event.code === 'Space' && event.target.closest('button')) return;
      event.preventDefault(); if (['Space','ArrowUp','KeyW'].includes(event.code) && !keys.has(event.code)) jump = true; keys.add(event.code);
    }
    const keyup = event => keys.delete(event.code), clear = () => { keys.clear(); pad.actions = new Set(); pad.direction = 0; jump = false; };
    const gamepadInput = event => {
      const actions = event.detail?.actions || new Set();
      if (actions.has('confirm') && !pad.actions.has('confirm')) jump = true;
      pad.actions = actions; pad.direction = event.detail?.direction || 0;
      if (actions.size) mixer.unlock();
    };
    node.addEventListener('garden:practice-input', gamepadInput); node.addEventListener('blur', clear);
    window.addEventListener('keydown',keydown); window.addEventListener('keyup',keyup); window.addEventListener('blur',clear);
    Promise.all(names.map(name => new Promise((resolve,reject) => { const image = new Image(); image.onload = () => { images[name] = image; resolve(); }; image.onerror = reject; image.src = `./assets/${name}.png`; }))).then(() => { if (!isDisposed) frame = requestAnimationFrame(draw); }).catch(() => { if (!isDisposed) onProgress({ error:'素材还没准备好，请返回后重试。' }); });
    function draw(time) {
      const dt = previous ? Math.min((time-previous)/1000,0.035) : 0; previous = time; elapsed += dt;
      survival.shieldRemaining = Math.max(0,survival.shieldRemaining-dt);
      if (isTrying && character === 'little' && elapsed >= nextDemoJump) { jump = true; nextDemoJump = player.isGrounded ? elapsed+0.48 : elapsed+2; }
      stepPlayer(player,{ direction:pad.direction || Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')), jump, isDoubleJump:character==='little' },[floor],dt,{minX:3,maxX:22,minY:-10}); jump=false;
      if (keys.has('KeyJ') || pad.actions.has('attack') || isTrying) {
        const shots = fireLoadout(player,elapsed,{left:0,right:28},adventure);
        if (shots.length) {
          if (recordAttack(survival)) {
            if (character === 'mom') { const floralCharge={isUsed:false}; shots.forEach(shot=>{shot.floralCharge=floralCharge;}); }
            if (character === 'sister') shots.push(...fireAdventureWeapon({...player,nextShot:0},elapsed,{left:0,right:28},'stars'));
          }
          for(const kind of new Set(shots.map(s=>s.kind)))mixer.play(`${kind}:fire`);
          waves.push(...shots); onProgress({...survival});
        }
      }
      if (character === 'dad' && isTrying && elapsed >= nextContact && survival.shieldRemaining === 0) {
        takeDamage(survival); effect={x:player.x,y:player.y+1,at:elapsed,isShield:true}; nextContact=elapsed+20; onProgress({...survival});
      }
      const spawned=[];
      for (const wave of waves) { const result=stepAdventureWave(wave,[enemy],[floor],dt,elapsed); spawned.push(...result.spawned); for(const hit of result.hits)if(hit.damage || hit.blocked)mixer.play(hit.blocked?'block':`${wave.kind}:hit`); const bloom=bloomAtHit(wave,result.hits,[enemy],elapsed); if(bloom) effect=bloom; }
      waves=[...waves.filter(w=>w.isActive),...spawned].slice(-80); enemy.hp=999;enemy.isDefeated=false;
      context.clearRect(0,0,node.width,node.height);
      const scale=node.width/28, ground=node.height*0.86;
      function picture(name,x,y,w,h){ const im=images[name]; if(im)context.drawImage(im,(x-w/2)*scale,ground-(y+h)*scale,w*scale,h*scale); }
      const size=person.height*2.8;
      picture(elapsed < (player.attackUntil||0) ? person.attack : person.image,player.x,player.y,size,size);
      picture('enemy-leaf',enemy.x,0,4,4);
      for(const wave of waves) {
        if(wave.kind==='moonblade') {
          context.save();context.translate(wave.x*scale,ground-wave.y*scale);context.rotate(-wave.age*10);context.drawImage(images['weapon-moonblade'],-.8*scale,-.8*scale,1.6*scale,1.6*scale);context.restore();
        } else picture(wave.kind==='flame'?'flame-stream':WEAPONS[wave.kind]?.image||'collectible-star',wave.x,wave.y,1.8,1.8);
      }
      if(effect && elapsed-effect.at<1.7) {
        if(effect.isShield) picture('collectible-rainbow',player.x,player.y+2.3,5,3);
        else for(let i=0;i<5;i++)picture('flower',effect.x+Math.cos(i*1.25)*1.5,effect.y+Math.sin(i*1.25)*1.5,1.8,1.8);
      }
      frame=requestAnimationFrame(draw);
    }
    return () => { node.removeEventListener('garden:practice-input', gamepadInput); node.removeEventListener('blur', clear); isDisposed=true; cancelAnimationFrame(frame); window.removeEventListener('keydown',keydown); window.removeEventListener('keyup',keyup); window.removeEventListener('blur',clear); };
  },[character,build,isTrying,onProgress,mixer]);
  return <canvas ref={canvas} data-gamepad-canvas data-gamepad-practice tabIndex={0} onPointerDown={event => event.currentTarget.focus()} width="1060" height="530" aria-label={`${CHARACTERS[character].name}技能试用场景`}/>;
}
export function CharacterCamp({ character, build, isSound, onBuild, onSelect, onBack, onStart }) {
  const gamepadState = useGamepad();
  const root=useRef(null), [isTrying,setIsTrying]=useState(false), [progress,setProgress]=useState({attacks:0}),[isPicking,setIsPicking]=useState(false);
  const isPickerPreviouslyOpen=useRef(false),audio=useRef(null);audio.current ||= new CombatAudio();
  useEffect(()=>{audio.current.setMuted(!isSound);return()=>audio.current.pause();},[isSound]);
  useEffect(()=>()=>{audio.current.close();},[]);
  const person=CHARACTERS[character];
  useEffect(()=>{root.current?.querySelector('[aria-pressed=true]')?.focus();},[]);
  useEffect(()=>{if(isPickerPreviouslyOpen.current&&!isPicking)root.current?.querySelector('.starter-actions button:last-child')?.focus();isPickerPreviouslyOpen.current=isPicking;},[isPicking]);
  return <section ref={root} className="character-camp" role="dialog" aria-modal="true" aria-labelledby="character-heading" onKeyDown={trapFocus}>
    <header inert={isPicking}><button className="paper-action" data-gamepad-back onClick={onBack}><ArrowLeft/>返回</button><h2 id="character-heading">选好角色，试试本领</h2></header>
    <div className="character-camp-layout" inert={isPicking}>
      <div className="character-camp-left">
        <div className="character-choices" aria-label="选择角色">{Object.entries(CHARACTERS).map(([id,item])=><button key={id} aria-pressed={character===id} onClick={()=>{setIsTrying(false);onSelect(id);}}><img src={`./assets/${item.image}.png`} alt=""/><strong>{item.name}</strong>{character===id&&<Check className="character-check" weight="bold"/>}</button>)}</div>
        <div className="character-practice"><img className="character-camp-background" src="./assets/character-camp.png" alt="彩笔森林里的出发营地"/><CharacterPractice character={character} build={build} isTrying={isTrying} onProgress={setProgress} mixer={audio.current}/></div>
        <div className="character-try-row"><button className="paper-action" onClick={()=>{audio.current.unlock();setIsTrying(!isTrying);}}><img src="./assets/collectible-star.png" alt=""/>{isTrying?'停一下':'试一试'}</button><small>{gamepadState.mode === 'gamepad' ? '选中场景，左摇杆移动、A 跳跃、X 攻击、B 返回' : '点场景后，用方向键、空格和 J'}<br/>营地练习不扣命、不计分</small></div>
      </div>
      <div className="character-info"><h3>{person.name}</h3><h4><img src={`./assets/${person.icon}.png`} alt=""/>{person.talent}</h4><p>{person.hint}</p>
        <div className="character-talent-demo" aria-live="polite">{['mom','sister'].includes(character) ? <div className="talent-pips" aria-label={`已累计 ${progress.attacks||0} 次攻击`}>{[0,1,2,3].map(i=><Star key={i} size={48} weight={i<(progress.attacks||0)?'fill':'regular'}/>)}</div> : <span>{person.detail}</span>}</div>
        {progress.error&&<p role="alert">{progress.error}</p>}
        <div className="starter-build"><h4>初始搭配</h4><div className="starter-actions"><button className="paper-action" onClick={()=>{setIsTrying(false);onBuild(recommendedStarter(character));}}>自动搭配</button><button className="paper-action" onClick={()=>{setIsTrying(false);setIsPicking(true);}}>自己选择</button></div><div className="starter-summary" aria-label="当前初始搭配">{build.weapons.map(id=><span key={id}><img src={`./assets/${WEAPONS[id].image}.png`} alt=""/>{WEAPONS[id].name}</span>)}{build.upgrades.map(id=><span key={id}><img src={`./assets/${UPGRADES[id].image}.png`} alt=""/>{UPGRADES[id].name}</span>)}</div><small>初始 1 种武器、最多 2 项本领，探索中继续叠加</small></div>
        <div className="character-rules"><p><Heart weight="duotone"/>血瓶 ×{INITIAL_LIVES}　血量 100 / 100</p><progress aria-label="初始血量" value={INITIAL_LIVES} max={INITIAL_LIVES}/><p>受伤先扣血，血条耗尽才扣一条命。</p></div>
        <button className="paper-action character-depart" onClick={onStart}><img src="./assets/checkpoint-flag.png" alt=""/>用{person.name}出发<ArrowRight/></button>
      </div>
    </div>
    {isPicking&&<StarterPicker build={build} onClose={()=>setIsPicking(false)} onConfirm={next=>{onBuild(next);setIsPicking(false);}}/>}
  </section>;
}
