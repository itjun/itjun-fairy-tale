export const BOSS_WARNINGS = {
  aimed:'瞄准你了，离开标记位置！', fan:'要散射了，换个高度躲开！', roots:'脚下要冒出来了，离开标记位置！',
  charge:'要冲过来了，跳起来或换一层！', rain:'要落下来了，离开标记位置！',
  bounce:'跳跳球要来了，换个位置！', lob:'要抛过来了，离开标记位置！',
  return:'叶刃会飞回来，留意来回两次！', ring:'音浪要来了，换个位置！', wave:'浪花要来了，跳起来躲开！',
};
export function currentBoss(world) { return world.enemies.find(e=>e.isBoss && !e.isDefeated && !e.isDormant); }
export function areBossesDefeated(world) { return (world.bossArenas || []).every(a=>world.enemies[a.bossId-1].isDefeated); }
export function constrainBossArena(world, player) {
  const boss=currentBoss(world);
  if (!boss) return;
  const arena=world.bossArenas[boss.arenaId];
  player.x=Math.max(arena.left+0.5,Math.min(arena.right-0.5,player.x));
}
function releaseBossSkill(boss, arena, skill, shots) {
  const x=boss.x+boss.direction*boss.width*.35,y=boss.baseY+Math.min(2.4,boss.height*.45);
  const targetX=boss.warningX,targetY=boss.warningY ?? arena.y+.8;
  const speed=skill.speed*.8*(boss.isEnraged?1.1:1),dx=targetX-x,dy=targetY-y;
  const angle=Math.atan2(dy,dx),flight=Math.max(.7,Math.min(3.5,Math.hypot(dx,dy)/speed));
  const emit=(px,py,vx,vy,extra={})=>shots.push({id:`boss:${boss.id}:${boss.attackIndex}:${shots.length}`,bossId:boss.id,x:px,y:py,vx,vy,gravity:0,age:0,life:6,kind:'boss',image:skill.image,size:1.2,damage:['rain','charge'].includes(skill.kind)?35:['aimed','lob'].includes(skill.kind)?25:20,isActive:true,...extra});
  const aim=(offset=0,extra={})=>emit(x,y,Math.cos(angle+offset)*speed,Math.sin(angle+offset)*speed,extra);
  if(skill.kind==='aimed') aim(0,{size:1.6});
  if(skill.kind==='fan') for(const offset of [-.24,0,.24]) aim(offset);
  if(skill.kind==='ring') {
    for(let n=0;n<8;n++)aim(n*Math.PI/4,{size:1});
  }
  if(skill.kind==='lob'||skill.kind==='bounce') {
    // 以锁定的玩家位置计算抛物线；高台和远端都有实际命中机会。
    for(const offset of skill.kind==='bounce'?[-1.6,0,1.6]:[0]) {
      emit(x,y,(dx+offset)/flight,(dy+3*flight*flight)/flight,{gravity:6,...(skill.kind==='bounce'?{floorY:arena.y+.4,bounces:0}:{}),size:1.4});
    }
  }
  if(skill.kind==='roots') {
    emit(targetX,targetY-.6,0,0,{kind:'vine',life:1.4,size:2});
    aim(0,{size:1});
  }
  if(skill.kind==='rain') {
    for(const offset of [-2.8,0,2.8])emit(Math.max(arena.left+.6,Math.min(arena.right-.6,targetX+offset)),targetY+7,0,-3,{gravity:5,size:1.5});
  }
  if(skill.kind==='return') aim(0,{turnAt:Math.max(1,Math.hypot(dx,dy)/speed+.35),size:1.5});
  if(skill.kind==='wave') {
    emit(x,arena.y+.35,boss.direction*speed,0,{kind:'shock',size:1.6});
    aim(0,{size:1.4});
  }
  // 远处或高台上的玩家也要躲开冲锋时甩出的主题弹道。
  if(skill.kind==='charge') aim(0,{size:1.4});
}
export function stepBosses(world, player, dt, elapsed, shots) {
  for (const arena of world.bossArenas || []) {
    const boss=world.enemies[arena.bossId-1];
    if (boss.isDefeated) { for(const shot of shots)if(shot.bossId===boss.id)shot.isActive=false;continue; }
    if (boss.isDormant) {
      const previous=world.bossArenas[arena.id-1];
      if (previous && !world.enemies[previous.bossId-1].isDefeated || player.x < arena.left || player.x > arena.right || Math.abs(player.y-arena.y)>9) continue;
      boss.isDormant=false;boss.isShielded=arena.layout==='mechanism';boss.attackTime=0;
    }
    boss.elapsed+=dt;
    if (boss.isWorldBoss && !boss.isEnraged && boss.hp <= boss.maxHp/2) { boss.isEnraged=true;boss.attackStage='rest';boss.attackTime=0; }
    if (arena.layout==='mechanism') {
      boss.isShielded=elapsed >= boss.shieldUntil;
      if (boss.isShielded && player.isGrounded && player.ground?.id===arena.floorId && Math.abs(player.x-arena.switchX)<1.4) { boss.shieldUntil=elapsed+12;boss.isShielded=false; }
    }
    if (boss.boundUntil>elapsed) continue;
    const slow=boss.slowUntil>elapsed?.8:1;
    boss.attackTime+=dt*slow;
    boss.isWarning=boss.attackStage==='warning';
    const skill=boss.skills[boss.attackIndex%boss.skills.length];
    if(boss.attackStage==='rest') {
      const gap=player.x-boss.x;
      boss.direction=Math.sign(gap)||boss.direction;
      // 蓄力时停下，空档主动接近；近身后退开，留出躲避和反击空间。
      const direction=Math.abs(gap)>7?boss.direction:Math.abs(gap)<4?-boss.direction:0;
      boss.x=Math.max(boss.minX,Math.min(boss.maxX,boss.x+direction*(boss.isEnraged?3.3:2.6)*slow*dt));
      const rest=boss.attackIndex===0?1:boss.isEnraged?2.5:3;
      if(boss.attackTime>=rest) {
        boss.attackStage='warning';boss.attackTime=0;boss.isWarning=true;
        boss.warningX=player.x;
        let targetY=player.y+.8;
        if(skill.kind==='roots') {
          const ground=world.platforms.filter(p=>p.zone===boss.zone&&p.isEnabled!==false&&Math.abs(p.x-player.x)<=p.width/2&&p.y<=player.y+.1).sort((a,b)=>b.y-a.y)[0];
          targetY=(ground?.y ?? arena.y)+.8;
        }
        boss.warningY=Math.max(arena.y+.8,Math.min(arena.y+9,targetY));
      }
    } else if (boss.attackStage==='warning' && boss.attackTime>=2) {
      boss.attackStage='attack';boss.attackTime=0;boss.isWarning=false;
      releaseBossSkill(boss,arena,skill,shots);
    } else if (boss.attackStage==='attack') {
      if(skill.kind==='charge')boss.x=Math.max(boss.minX,Math.min(boss.maxX,boss.x+boss.direction*6*dt));
      if(boss.attackTime>=1.2){boss.attackStage='rest';boss.attackTime=0;boss.attackIndex++;}
    }
  }
}
export function bossStatus(world, elapsed) {
  const boss=currentBoss(world);
  if (!boss) return null;
  const arena=world.bossArenas[boss.arenaId],skill=boss.skills[boss.attackIndex%boss.skills.length];
  return {id:boss.id,name:boss.name,hp:boss.hp,maxHp:boss.maxHp,isWorldBoss:boss.isWorldBoss,isMidBoss:!!boss.isMidBoss,isShielded:boss.isShielded,isEnraged:!!boss.isEnraged,
    shieldSeconds:Math.max(0,Math.ceil(boss.shieldUntil-elapsed)),warning:boss.isWarning?`${skill.name}：${BOSS_WARNINGS[skill.kind]}`:'',
    casting:boss.attackStage==='attack'?`正在施放：${skill.name}`:'',
    warningX:boss.warningX,warningY:boss.warningY ?? boss.baseY+.8,arena};
}
export function isValidBossState(saved, original, elapsed) {
  return typeof saved.isDormant==='boolean' && typeof saved.isShielded==='boolean' && (saved.isEnraged===undefined || typeof saved.isEnraged==='boolean')
    && ['rest','warning','attack'].includes(saved.attackStage) && Number.isInteger(saved.attackIndex) && saved.attackIndex>=0 && saved.attackIndex<100000
    && Number.isFinite(saved.attackTime) && saved.attackTime>=0 && saved.attackTime<=3.1
    && Number.isFinite(saved.shieldUntil) && saved.shieldUntil>=0 && saved.shieldUntil<=elapsed+12.1
    && Number.isFinite(saved.warningX) && saved.warningX>=original.minX-10 && saved.warningX<=original.maxX+10
    && (saved.warningY===undefined || Number.isFinite(saved.warningY)&&saved.warningY>=original.baseY+.7&&saved.warningY<=original.baseY+9.1)
    && saved.x>=original.minX && saved.x<=original.maxX && Math.abs(saved.y-original.baseY)<0.1
    && (saved.hp===0)===saved.isDefeated;
}
