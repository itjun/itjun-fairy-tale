import { SPELLS } from '../../shared/combat-catalog.js';
import { damageEnemy } from './combat.js';
import { heal } from './expedition.js';

export function newMagic() { return {ranks:{},equipped:[],charges:{},ready:[],active:[],gap:0,shield:0,counterCooldown:0}; }
export function isValidMagic(m) {
  if(m===undefined)return true;
  const finite=(v,max)=>Number.isFinite(v)&&v>=0&&v<=max;
  if(!m || !m.ranks || !m.charges || !Array.isArray(m.equipped) || !Array.isArray(m.ready) || !Array.isArray(m.active))return false;
  return Object.entries(m.ranks).every(([id,r])=>SPELLS[id]&&Number.isInteger(r)&&r>=1&&r<=3)
    && new Set(m.equipped).size===m.equipped.length && m.equipped.every(id=>m.ranks[id])
    && Object.entries(m.charges).every(([id,v])=>m.ranks[id]&&finite(v,SPELLS[id].charge))
    && new Set(m.ready).size===m.ready.length && m.ready.every(id=>m.ranks[id]&&m.charges[id]===SPELLS[id].charge)
    && finite(m.gap,2.5) && [0,1].includes(m.shield) && finite(m.counterCooldown,6)
    && m.active.length<=4 && new Set(m.active.map(e=>e.id)).size===m.active.length
    && m.active.every(e=>m.ranks[e.id]&&finite(e.age,6)&&finite(e.nextTick,7)&&finite(e.duration,6)&&[e.x,e.y].every(Number.isFinite)&&typeof e.isShield==='boolean'&&Array.isArray(e.hitIds)&&e.hitIds.length<=20&&e.hitIds.every(Number.isSafeInteger));
}
export function equipSpell(adventure,id) {
  const m=adventure.magic;
  if(!m?.ranks[id] || m.active.some(e=>e.id===id))return false;
  m.equipped=m.equipped.includes(id)?m.equipped.filter(key=>key!==id):[...m.equipped,id];adventure.revision++;return true;
}
function hit(enemy,elapsed,damage,x,source) {
  const isDefeated=damageEnemy(enemy,elapsed,{x,damage});
  return {enemy,isDefeated,damage:enemy.lastDamage,blocked:enemy.lastBlocked,source};
}
// 只由固定游玩步长调用；充能、持续效果、命中记录一起保存，暂停不推进。
export function stepMagic(adventure,survival,player,enemies,shots,dt,elapsed,isFiring,bounds) {
  if(dt<=0)return {hits:[],events:[]};
  const m=adventure.magic ||= newMagic(),hits=[],events=[];
  m.gap=Math.max(0,m.gap-dt);m.counterCooldown=Math.max(0,m.counterCooldown-dt);
  const visible=enemies.filter(e=>!e.isDefeated&&!e.isDormant&&!e.isHidden&&e.x>=bounds.left&&e.x<=bounds.right&&Math.abs(e.y-player.y)<14);
  for(const id of m.equipped) {
    if(!isFiring||!visible.length||m.active.some(e=>e.id===id)||m.ready.includes(id))continue;
    m.charges[id]=Math.min(SPELLS[id].charge,(m.charges[id] || 0)+dt);
    if(m.charges[id]===SPELLS[id].charge)m.ready.push(id);
  }
  if(isFiring && visible.length && !m.gap) {
    const id=m.ready.find(key=>m.equipped.includes(key)&&(key!=='fire'||visible.some(e=>Math.hypot(e.x-player.x,e.y-player.y)<6.5)));
    if(id){
      m.ready=m.ready.filter(key=>key!==id);m.charges[id]=0;m.gap=2.5;
      m.active.push({id,age:0,nextTick:0,duration:SPELLS[id].duration+(id==='fire'?m.ranks[id]-1:0),x:player.x,y:player.y+1,isShield:id==='fire',hitIds:[]});
      if(id==='rain'){heal(survival,10);for(const shot of shots)if(!shot.bossId&&Math.abs(shot.x-player.x)<20)shot.isActive=false;}
      events.push({type:'cast',id});
    }
  }
  for(const effect of m.active) {
    const id=effect.id,rank=m.ranks[id],isLegend=adventure.qualities?.[`spell:${id}`]==='legendary';
    effect.age+=dt;
    if(id==='fire'){effect.x=player.x;effect.y=player.y+1;}
    const damage=Math.round(SPELLS[id].damage*(1+(rank-1)*.2+(adventure.growth?.power || 0)*.1));
    if(effect.age>=effect.nextTick && effect.age<effect.duration){
      effect.nextTick+=id==='fire'?.5:id==='snow'?1.5:id==='rain'?1:.3;
      let targets=visible;
      if(id==='fire')targets=targets.filter(e=>Math.hypot(e.x-effect.x,e.y+e.height/2-effect.y)<4.5+rank*.3);
      if(id==='rain')targets=targets.filter(e=>Math.abs(e.x-effect.x)<11+rank);
      if(id==='snow')targets=targets.filter(e=>Math.abs(e.x-effect.x)<16);
      if(id==='thunder') {
        const count=id=>effect.hitIds.filter(n=>n===id).length;
        // 先找尚未命中的目标；传奇为结束时的回响留出首目标第二击。
        targets=targets.filter(e=>count(e.id)<(isLegend&&e.id===effect.hitIds[0]?1:2)).sort((a,b)=>count(a.id)-count(b.id)||Math.hypot(a.x-effect.x,a.y-effect.y)-Math.hypot(b.x-effect.x,b.y-effect.y)).slice(0,1);
        if(effect.hitIds.length>=4+rank*2)targets=[];
      }
      for(const enemy of targets){
        hits.push(hit(enemy,elapsed,damage,effect.x,id));
        if(id==='thunder'){effect.hitIds.push(enemy.id);effect.x=enemy.x;effect.y=enemy.y+enemy.height/2;}
        if(id==='snow'){
          if(!enemy.isBoss && !(enemy.freezeImmuneUntil>elapsed)){enemy.frozenUntil=elapsed+1;enemy.freezeImmuneUntil=elapsed+4;}
          enemy.slowUntil=Math.max(enemy.slowUntil || 0,elapsed+2);
        }
      }
    }
    if(effect.age>=effect.duration){
      if(isLegend && id==='rain')m.shield=1;
      if(isLegend && id==='snow')for(const enemy of visible)hits.push(hit(enemy,elapsed,Math.round(damage*.5),effect.x,id));
      if(isLegend && id==='thunder'){const enemy=visible.find(e=>e.id===effect.hitIds[0]);if(enemy && effect.hitIds.filter(n=>n===enemy.id).length<2)hits.push(hit(enemy,elapsed,Math.round(damage*.6),effect.x,id));}
      events.push({type:'end',id});
    }
  }
  m.active=m.active.filter(e=>e.age<e.duration);
  return {hits,events};
}
export function consumeMagicShield(adventure,player,enemies,elapsed) {
  const m=adventure.magic;
  if(!m)return null;
  const fire=m.active.find(e=>e.id==='fire'&&e.isShield);
  if(!fire&&!m.shield)return null;
  if(fire)fire.isShield=false;else m.shield=0;
  const hits=[];
  if(fire&&adventure.qualities?.['spell:fire']==='legendary')for(const enemy of enemies.filter(e=>!e.isDefeated&&!e.isDormant&&Math.hypot(e.x-player.x,e.y-player.y)<6))hits.push(hit(enemy,elapsed,45,player.x,'fire'));
  return hits;
}
export function shieldCounter(adventure,player,enemies,elapsed) {
  const m=adventure.magic;
  if(!adventure.counterShield||!m||m.counterCooldown)return [];
  m.counterCooldown=6;
  return enemies.filter(e=>!e.isDefeated&&!e.isDormant&&Math.hypot(e.x-player.x,e.y-player.y)<5).map(e=>hit(e,elapsed,35,player.x,'shield'));
}
