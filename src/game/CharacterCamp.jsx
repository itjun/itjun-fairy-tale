import { useGamepad } from '../input/GamepadSupport.jsx';
import { CombatAudio } from './combat-audio.js';
import { useEffect, useRef, useState } from 'react';
import { Check, GearSix } from '@phosphor-icons/react';
import { CHARACTERS, newSurvival, takeDamage, applyWeaponTalent, bloomAtHit } from './characters.js';
import { createPlayer, stepPlayer } from './physics.js';
import { fireLoadout, stepAdventureWave, attackSource } from './adventure-combat.js';
import { WEAPONS, UPGRADES } from './adventure.js';
import { starterAdventure, recommendedStarter } from './starter-build.js';
import { StarterPicker } from './StarterPicker.jsx';
import { DIFFICULTIES, setPlaySettings, usePlaySettings } from './difficulty.js';
import { ConfirmAction, DeparturePage } from './DeparturePage.jsx';
import './characters.css';

function CharacterPractice({ character, build, isTrying, onError, mixer }) {
  const canvas = useRef(null);
  useEffect(() => {
    const pad = { actions: new Set(), direction: 0 };
    const node = canvas.current, context = node.getContext('2d'), images = {}, keys = new Set();
    const person = CHARACTERS[character], survival = newSurvival(character), adventure=starterAdventure(0,build);
    const floor = { id:0, x:14, y:0, width:28 }, player = createPlayer(floor), enemy = { id:1, combatVersion:2, x:14, y:0, width:1.5, height:2.5, hp:999, isDefeated:false };
    player.x = build.weapons.includes('lightblade') ? 11.5 : 8.5;
    let isDisposed = false, frame, previous = 0, elapsed = 0, waves = [], jump = false, effect, nextDemoJump = 0, nextContact = 2;
    const names = [...new Set([person.image, person.attack, 'enemy-leaf', 'flame-stream', ...Object.values(WEAPONS).map(w=>w.image), 'flower', 'collectible-rainbow', 'enemy-burst'])];
    onError('');
    function keydown(event) {
      if (document.activeElement !== node || !['ArrowLeft','ArrowRight','KeyA','KeyD','KeyJ','Space','ArrowUp','KeyW'].includes(event.code) || event.code === 'Space' && event.target.closest('button')) return;
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
    Promise.all(names.map(name => new Promise((resolve,reject) => { const image = new Image(); image.onload = () => { images[name] = image; resolve(); }; image.onerror = reject; image.src = `./assets/${name}.png`; }))).then(() => { if (!isDisposed) frame = requestAnimationFrame(draw); }).catch(() => { if (!isDisposed) onError('素材还没准备好，请返回后重试。'); });
    function draw(time) {
      const dt = previous ? Math.min((time-previous)/1000,0.035) : 0; previous = time; elapsed += dt;
      survival.shieldRemaining = Math.max(0,survival.shieldRemaining-dt);
      if (isTrying && character === 'little' && elapsed >= nextDemoJump) { jump = true; nextDemoJump = player.isGrounded ? elapsed+0.48 : elapsed+2; }
      stepPlayer(player,{ direction:pad.direction || Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')), jump },[floor],dt,{minX:3,maxX:22,minY:-10}); jump=false;
      if (keys.has('KeyJ') || pad.actions.has('attack') || isTrying) {
        const shots = fireLoadout(player,elapsed,{left:0,right:28},adventure,0,waves);
        if (shots.length) {
          applyWeaponTalent(survival, shots);
          for(const kind of new Set(shots.map(attackSource)))mixer.play(`${kind}:fire`);
          waves.push(...shots);
        }
      }
      if (character === 'dad' && isTrying && elapsed >= nextContact && survival.shieldRemaining === 0) {
        takeDamage(survival); effect={x:player.x,y:player.y+1,at:elapsed,isShield:true}; nextContact=elapsed+20;
      }
      const spawned=[];
      for (const wave of waves) {
        const result=stepAdventureWave(wave,[enemy],[floor],dt,elapsed,player); spawned.push(...result.spawned);
        for(const hit of result.hits){mixer.play(`${attackSource(wave)}:hit`);if(hit.blocked)mixer.play('block');}
        const bloom=bloomAtHit(wave,result.hits,[enemy],elapsed); if(bloom) effect=bloom;
        if (wave.bonusEffect && result.hits.some(hit => hit.damage)) {
          effect = { x: enemy.x, y: enemy.y + 1, at: elapsed, spark: 'collectible-star' };
          delete wave.bonusEffect;
        }
      }
      waves=[...waves.filter(w=>w.isActive),...spawned].slice(-80); enemy.hp=999;enemy.isDefeated=false;
      context.clearRect(0,0,node.width,node.height);
      // 近战练习按正式关卡的相对比例放大，刀光才能对齐手部和练习靶。
      const isMelee=build.weapons.includes('lightblade'), zoom=isMelee?2.8:1;
      const scale=node.width/28*zoom, ground=node.height*0.86, origin=isMelee?player.x-8.5/zoom:0;
      function picture(name,x,y,w,h){ const im=images[name]; if(im)context.drawImage(im,(x-origin-w/2)*scale,ground-(y+h)*scale,w*scale,h*scale); }
      const size=person.height*(isMelee?1:2.8);
      picture(elapsed < (player.attackUntil||0) ? person.attack : person.image,player.x,player.y,size,size);
      picture('enemy-leaf',enemy.x,0,isMelee?enemy.height:4,isMelee?enemy.height:4);
      for(const wave of waves) {
        if(wave.kind==='lightblade') {
          if(wave.age < wave.delay) continue;
          context.save();context.translate((wave.x-origin)*scale,ground-wave.y*scale);context.scale(wave.direction,1);
          context.drawImage(images['weapon-lightblade'],-(wave.reach-.25)/2*scale,-wave.halfHeight*scale,(wave.reach-.25)*scale,wave.halfHeight*2*scale);context.restore();
        } else if(wave.kind==='moonblade') {
          context.save();context.translate((wave.x-origin)*scale,ground-wave.y*scale);context.rotate(-wave.age*10);context.drawImage(images['weapon-moonblade'],-.8*scale,-.8*scale,1.6*scale,1.6*scale);context.restore();
        } else picture(wave.kind==='flame'?'flame-stream':WEAPONS[wave.kind]?.image||'collectible-star',wave.x,wave.y,1.8,1.8);
      }
      if(effect && elapsed-effect.at<1.7) {
        if(effect.isShield) picture('collectible-rainbow',player.x,player.y+2.3,5,3);
        else for(let i=0;i<5;i++)picture(effect.spark || 'flower',effect.x+Math.cos(i*1.25)*1.5,effect.y+Math.sin(i*1.25)*1.5,1.8,1.8);
      }
      frame=requestAnimationFrame(draw);
    }
    return () => { node.removeEventListener('garden:practice-input', gamepadInput); node.removeEventListener('blur', clear); isDisposed=true; cancelAnimationFrame(frame); window.removeEventListener('keydown',keydown); window.removeEventListener('keyup',keyup); window.removeEventListener('blur',clear); };
  },[character,build,isTrying,onError,mixer]);
  return <canvas ref={canvas} data-gamepad-canvas data-gamepad-practice tabIndex={0} onPointerDown={event => event.currentTarget.focus()} width="1060" height="530" aria-label={`${CHARACTERS[character].name}技能试用场景`}/>;
}
function DepartureSettings({ character, build, locked, isSound, onBuild, onBack }) {
  const buildButton = useRef(null);
  const [isTrying, setTrying] = useState(false);
  const [error, setError] = useState('');
  const [picking, setPicking] = useState(false);
  const mixer = useRef(null);
  mixer.current ||= new CombatAudio();
  const { mode } = useGamepad();
  const { difficulty } = usePlaySettings();
  const person = CHARACTERS[character];
  useEffect(() => { mixer.current.setMuted(!isSound); }, [isSound]);
  useEffect(() => () => mixer.current.close(), []);
  useEffect(() => { if (!picking) buildButton.current?.focus({ preventScroll: true }); }, [picking]);

  if (picking) return <StarterPicker build={build} locked={locked} onClose={() => setPicking(false)}
    onConfirm={next => { onBuild(next); setPicking(false); }} />;

  return <DeparturePage title="出发设置" backLabel="回选角" onBack={onBack} className="loadout-page">
    <div className="loadout-content">
      <section className="practice-column">
        <div className="character-practice"><img className="character-camp-background" alt="" src="./assets/character-camp.png" />
          <CharacterPractice character={character} build={build} isTrying={isTrying} onError={setError} mixer={mixer.current} />
        </div>
        <div className="character-try-row">
          <button className="departure-secondary" onClick={() => { mixer.current.unlock(); setTrying(!isTrying); }}>{isTrying ? '停一下' : '试一试'}</button>
          <span>{mode === 'gamepad' ? '选中场景，A 跳跃，X 攻击' : '点场景，空格跳跃，J 攻击'}</span>
        </div>
        {error && <p role="alert">{error}</p>}
      </section>
      <section className="loadout-options">
        <h3>{person.name} · {person.talent}</h3><p>{person.hint}</p>
        <h3>初始搭配</h3>
        <div className="loadout-items">
          {[...build.weapons.map(id => WEAPONS[id]), ...build.upgrades.map(id => UPGRADES[id])].map(item =>
            <span key={item.name}><img src={`./assets/${item.image}.png`} alt="" />{item.name}</span>)}
        </div>
        <div className="starter-actions">
          <button className="departure-secondary" onClick={() => onBuild(recommendedStarter(character))}>自动搭配</button>
          <button ref={buildButton} className="departure-secondary" onClick={() => { setTrying(false); setPicking(true); }}>自己选择</button>
        </div>
        <h3>难度</h3><div className="departure-difficulty" data-gamepad-tabs="换难度">
          {Object.entries(DIFFICULTIES).map(([id, item]) => <button key={id} className="departure-secondary"
            aria-pressed={id === difficulty} onClick={() => setPlaySettings({ difficulty: id })}>{item.name}</button>)}
        </div><p>{DIFFICULTIES[difficulty].hint}。</p>
      </section>
    </div>
  </DeparturePage>;
}

export function CharacterCamp({ character, build, locked = [], isSound, onBuild, onSelect, onBack, onStart }) {
  const page = useRef(null);
  const [settings, setSettings] = useState(false);
  const { mode } = useGamepad();
  useEffect(() => {
    if (settings) return;
    page.current?.querySelector('[aria-pressed=true]')?.focus({ preventScroll: true });
  }, [settings]);

  if (settings) return <DepartureSettings character={character} build={build} locked={locked} isSound={isSound}
    onBuild={onBuild} onBack={() => setSettings(false)} />;

  return <DeparturePage pageRef={page} title="选角色" backLabel="回地图" onBack={onBack} className="family-page">
    <div className="family-grid" aria-label="选择角色">
      {Object.entries(CHARACTERS).map(([id, person]) => {
        const selected = id === character;
        return <button key={id} className="family-portrait" data-character={id} aria-pressed={selected} tabIndex={selected ? 0 : -1}
          onFocus={() => { if (!selected) onSelect(id); }}
          onClick={event => {
            if (!selected) onSelect(id);
            else if (event.detail === 0) onStart();
          }}>
          <span className="portrait-crop"><img src={`./assets/${person.image}.png`} alt="" /></span>
          <span className="portrait-name"><strong>{person.name}</strong>
            {selected && <small><Check weight="bold" />{id === 'little' ? '跳得更高' : person.talent}</small>}
          </span>
        </button>;
      })}
    </div>
    <footer className="departure-footer">
      <button data-gamepad-settings className="departure-secondary" onClick={() => setSettings(true)}>
        {mode === 'gamepad' ? <kbd aria-hidden="true">Y</kbd> : <GearSix />}出发设置
      </button>
      <ConfirmAction className="character-depart-action" onClick={onStart}>出发</ConfirmAction>
    </footer>
  </DeparturePage>;
}
