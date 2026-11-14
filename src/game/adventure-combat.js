import { fireSkill, stepWave, damageEnemy } from './combat.js';
import { activeWeapons, upgradePower, weaponShotCount } from './adventure.js';
import { WEAPONS } from '../../shared/adventure-catalog.js';
import { weaponDamage } from './growth.js';

export function fireLoadout(player, elapsed, bounds, adventure, index = 0) {
  player.weaponShots ||= {}; player.weaponCycles ||= {};
  const shots = [];
  for (const weapon of activeWeapons(adventure,index)) {
    const emitter = {...player, nextShot:player.weaponShots[weapon] || 0};
    const waves = fireAdventureWeapon(emitter, elapsed, bounds, weapon, upgradePower(adventure,index,weapon));
    player.weaponShots[weapon] = emitter.nextShot;
    if(waves.length){
      player.attackUntil=emitter.attackUntil;player.weaponCycles[weapon]=((player.weaponCycles[weapon] || 0)+1)%60;
      if(adventure.qualities?.[`weapon:${weapon}`]==='legendary'){
        const root=waves[0];
        if(weapon==='blade')waves.push({...root,direction:-root.direction,remaining:Math.max(2,(root.x-(root.direction>0?bounds.left:bounds.right))*root.direction),damage:Math.round(root.damage*.5),powers:{},hitIds:new Set()});
        if(weapon==='stars'&&player.weaponCycles[weapon]%4===0)for(const slope of [-.3,0,.3])waves.push({...root,slope,damage:Math.round(root.damage*.5),powers:{},hitIds:new Set()});
        if(weapon==='flame'&&player.weaponCycles[weapon]%15===0)for(let i=0;i<4;i++)waves.push({...root,kind:'pulse',source:'flame',x:root.x+root.direction*4,y:root.y+1.5,delay:.3*i,age:0,radius:3,damage:Math.round(root.damage*1.5),powers:{}});
      }
    }
    shots.push(...waves);
  }
  return shots;
}

export function fireAdventureWeapon(player, elapsed, bounds, weapon, powers = {}) {
  const base = fireSkill(player, elapsed, bounds, weapon === 'bubble' ? weapon : 'blade');
  if (!base.length) return [];
  const root = base[0];
  let shots = base;
  if (weapon === 'boomerang') shots = [{ ...root, kind: weapon, speed: 22, remaining: Math.min(root.remaining, 15), originX: root.x, leg: 0 }];
  if (weapon === 'moonblade') shots = [{ ...root, kind:weapon, speed:20, remaining:40, targetId:null, headingX:root.direction, headingY:0 }];
  if (weapon === 'seed') shots = [{ ...root, kind: weapon, speed: 13, velocityY: 9, slope: 9 / 13, remaining: 24 }];
  if (weapon === 'firefly') shots = [{ ...root, kind:weapon, speed:18, remaining:25 }];
  if (weapon === 'flame') shots = [{...root,kind:weapon,speed:32,remaining:7,slope:0}];
  if (weapon === 'stars') shots = [{ ...root, kind:weapon }];
  const count=weaponShotCount(weapon,powers);
  shots=shots.flatMap(shot=>Array.from({length:count},(_,i)=>({...shot,y:shot.y+i*Math.min(.65,2/Math.max(1,count-1)),slope:weapon==='stars'?(i-(count-1)/2)*Math.min(.16,.9/Math.max(1,count-1)):shot.slope,hitIds:new Set()})));
  if(weapon==='moonblade')shots.forEach((shot,i)=>{
    const offset=i-(count-1)/2,angle=offset*Math.min(.24,1.2/Math.max(1,count-1));
    shot.y=root.y+offset*Math.min(.4,1.6/Math.max(1,count-1));
    shot.headingX=Math.cos(angle)*root.direction;shot.headingY=Math.sin(angle);shot.targetOffset=i;
  });
  player.nextShot = elapsed + WEAPONS[weapon].interval / (1 + 0.18 * (powers.rapid || 0));
  return shots.map(shot => ({ ...shot, damage:weaponDamage(weapon,powers.attackGrowth || 0,powers.weaponRank || 1), powers: { ...powers }, burstRadius: 3.8 + (powers.area || 0) * 0.7, radius: (weapon==='moonblade'?.7:.25) + (powers.area || 0) * 0.12 + (weapon === 'blade' ? (powers.wide || 0) * 0.25 : 0), hitIds: new Set(shot.hitIds) }));
}
export function areaAttack(x, y, radius, enemies, elapsed, powers = {}) {
  return enemies.filter(e => !e.isDefeated && !e.isDormant && !e.isHidden && Math.hypot(e.x - x, e.y + e.height / 2 - y) < radius).map(enemy => {
    if (powers.frost) enemy.slowUntil = elapsed + 1.5 + powers.frost;
    const isDefeated = damageEnemy(enemy, elapsed, { x, damage:powers.damage || Math.round(12 * (1 + (powers.attackGrowth || 0) * 0.1)) });
    return { enemy, isDefeated, damage:enemy.lastDamage, blocked:enemy.lastBlocked };
  });
}
export function stepAdventureWave(wave, enemies, platforms, dt, elapsed) {
  if (!wave.isActive) return { hits: [], spawned: [] };
  const powers = wave.powers || {}, spawned = [];
  const active = enemies.filter(e => !e.isDormant && !e.isHidden);
  if (wave.kind === 'pulse') {
    wave.age += dt;
    if (wave.age < wave.delay) return { hits: [], spawned };
    wave.isActive = false;
    wave.burst = { x: wave.x, y: wave.y, radius: wave.radius };
    return { hits: areaAttack(wave.x, wave.y, wave.radius, active, elapsed, {...powers,damage:wave.damage}), spawned };
  }
  if (wave.kind === 'seed') { wave.velocityY -= 17 * dt; wave.slope = wave.velocityY / wave.speed; }
  if (wave.kind === 'moonblade') {
    const targets=active.filter(e=>!e.isDefeated&&!wave.hitIds.has(e.id)&&Math.hypot(e.x-wave.x,e.y+e.height/2-wave.y)<=22);
    const target=targets.find(e=>e.id===wave.targetId)||targets.sort((a,b)=>Math.hypot(a.x-wave.x,a.y+a.height/2-wave.y)-Math.hypot(b.x-wave.x,b.y+b.height/2-wave.y))[(wave.targetOffset || 0)%targets.length];
    wave.targetId=target?.id ?? null;
    if(target) {
      const dx=target.x-wave.x,dy=target.y+target.height/2-wave.y,distance=Math.hypot(dx,dy);
      if(distance) {
        const heading=Math.atan2(wave.headingY,wave.headingX),difference=Math.atan2(dy,dx)-heading;
        const turn=Math.atan2(Math.sin(difference),Math.cos(difference));
        const next=heading+Math.max(-12*dt,Math.min(12*dt,turn));
        wave.headingX=Math.cos(next);wave.headingY=Math.sin(next);
        wave.direction=Math.sign(wave.headingX) || wave.direction;
      }
    }
  }
  if (['firefly','stars','flame'].includes(wave.kind)) {
    const target = active.filter(e => !e.isDefeated && (e.x - wave.x) * wave.direction > -0.5 && Math.abs(e.x - wave.x) < 18).sort((a, b) => Math.hypot(a.x - wave.x, a.y - wave.y) - Math.hypot(b.x - wave.x, b.y - wave.y))[0];
    if (target) wave.slope = Math.max(wave.kind==='firefly'?-1:-.55, Math.min(wave.kind==='firefly'?1:.55, (target.y + target.height / 2 - wave.y) / Math.max(1, Math.abs(target.x - wave.x))));
  }
  const previousY = wave.y;
  let hits = stepWave(wave, active, platforms, dt, elapsed);
  if (wave.kind === 'seed' && (hits.length || !wave.isActive || wave.velocityY < 0 && platforms.some(p => p.isEnabled !== false && Math.abs(p.x - wave.x) < p.width / 2 && previousY >= p.y && wave.y <= p.y))) {
    wave.isActive = false;
    const radius = 2.8 + (powers.area || 0) * 0.5;
    const ids = new Set(hits.map(h => h.enemy.id));
    hits.push(...areaAttack(wave.x, wave.y, radius, active.filter(e => !ids.has(e.id)), elapsed, {...powers,damage:wave.damage}));
    wave.burst = { x: wave.x, y: wave.y, radius };
    if (powers.bloom || powers.legendary) spawned.push({ kind: 'pulse', x: wave.x + wave.direction * 1.5, y: wave.y, radius, age: 0, delay: 0.6, isActive: true, powers, damage:Math.round(wave.damage * 0.5) });
  }
  if (wave.kind === 'bubble' && wave.burst && (powers.linger || powers.legendary)) {
    for (let i = 1; i <= 2; i++) spawned.push({ kind: 'pulse', x: wave.x, y: wave.y, radius: 3.8, age: 0, delay: i * 0.65, isActive: true, powers: powers.legendary?{...powers,frost:Math.max(1,powers.frost || 0)}:powers, damage:Math.round(wave.damage * 0.4) });
  }
  if (wave.kind === 'boomerang' && !wave.isActive && wave.leg === 0) {
    wave.leg = 1; wave.isActive = true; wave.direction *= -1; wave.remaining = Math.abs(wave.x - wave.originX); wave.hitIds = new Set();
    if (powers.returnSplit || powers.legendary) for (const slope of [-0.2, 0.2]) spawned.push({ ...wave, kind: 'stars', slope, powers: {}, hitIds: new Set() });
  }
  if(powers.legendary && wave.kind==='moonblade' && hits.length && !wave.isLegendChild && !wave.didLegendSplit){
    wave.didLegendSplit=true;
    spawned.push({...wave,damage:Math.round(wave.damage*.45),remaining:18,age:0,isActive:true,isLegendChild:true,targetId:null,powers:{},hitIds:new Set(wave.hitIds)});
  }
  for (const hit of [...hits]) {
    if (wave.bindingCharge && !wave.bindingCharge.isUsed) {
      wave.bindingCharge.isUsed = true;
      hit.enemy.boundUntil = elapsed + (hit.enemy.isBoss ? 0.25 : hit.enemy.isElite ? 0.7 : 1.6);
    }
    if (powers.frost) hit.enemy.slowUntil = elapsed + 1.5 + powers.frost;
    if (powers.chain && !wave.isChained) {
      const targets = active.filter(e => !e.isDefeated && !wave.hitIds.has(e.id) && Math.hypot(e.x - hit.enemy.x, e.y - hit.enemy.y) < 4 + powers.chain).slice(0, powers.chain);
      for (const enemy of targets) { wave.hitIds.add(enemy.id); const isDefeated=damageEnemy(enemy, elapsed, {x:wave.x,damage:Math.round(wave.damage*0.5)}); hits.push({ enemy, isDefeated, damage:enemy.lastDamage, blocked:enemy.lastBlocked }); }
    }
    if (powers.split && !wave.isSplit) for (const slope of [-0.25, 0.25]) spawned.push({ ...wave, kind: 'stars', damage:Math.max(1,Math.round(wave.damage*0.4)), x: hit.enemy.x, y: hit.enemy.y + 1, slope, remaining: 8, age: 0, isActive: true, isSplit: true, powers: {}, hitIds: new Set([hit.enemy.id]) });
  }
  return { hits, spawned };
}
