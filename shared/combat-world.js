import { createBossWorld } from './boss-world.js';
import { MONSTERS } from './adventure-catalog.js';
import { STAGES } from './levels.js';
import { randomGenerator } from './random.js';

const NEW_MONSTERS={rainbow:['plane','balloon','dandelion'],family:['twins','plane','balloon'],sweet:['balloon','twins','octopus'],beach:['octopus','plane','balloon'],meadow:['dandelion','plane','twins'],snow:['penguin','balloon','plane'],forest:['dandelion','octopus','balloon'],cartoon:['twins','plane','octopus']};
// 第六版独立扩展；第 1～5 版的种子、编号与地图完全不变。
export function createCombatWorld(seed,level) {
  const world=createBossWorld(seed,level),stage=STAGES.find(s=>s.id===world.stageId);
  const random=randomGenerator((seed^Math.imul(stage.index+1,0x672175))>>>0);
  world.version=6;
  const originals=world.enemies.filter(e=>!e.isBoss&&!e.parentId);
  for(const zone of world.zones.filter(z=>!z.isBoss)){
    const existing=originals.filter(e=>e.zone===zone.id);
    const pool=NEW_MONSTERS[world.themeId],offset=Math.floor(random()*pool.length);
    const candidates=zone.platformIds.map(id=>world.platforms[id]).filter(p=>!p.isMoving&&!p.isCheckpoint&&!p.isCrumbling&&!p.slope&&!p.isSeesaw&&p.gateId===undefined&&p.width>=5.5&&p.x>16&&Math.abs(p.x-world.platforms[zone.startId].x)>8&&!world.hazards.some(h=>h.platformId===p.id))
      .map(p=>({p,order:random()})).sort((a,b)=>a.order-b.order);
    const count=Math.ceil(existing.length*.5);
    for(let i=0;i<count;i++){
      const p=candidates.find(({p})=>!world.enemies.some(e=>e.platformId===p.id))?.p || candidates.find(({p})=>p.width>=10)?.p;
      if(!p)continue;
      const kind=pool[(offset+i)%pool.length],hp=stage.index<9?24:36;
      const twins=kind==='twins'?2:1;
      for(let n=0;n<twins;n++){
        const x=p.x+(twins===2?(n?1.4:-1.4):0);
        world.enemies.push({id:world.enemies.length+1,kind,...MONSTERS[kind],platformId:p.id,zone:zone.id,x,y:p.y,baseY:p.y,minX:p.x-p.width/2+.8,maxX:p.x+p.width/2-.8,direction:n?-1:1,speed:.9,width:1.3,height:kind==='balloon'?2:1.65,phase:kind==='twins'?n*1.8:random()*2,elapsed:0,hp,maxHp:hp,combatVersion:2,isDefeated:false,isElite:false,drop:null,hasShell:kind==='penguin'});
      }
    }
  }
  const ordinaryZones=world.zones.filter(z=>!z.isBoss),middle=ordinaryZones[Math.max(0,Math.floor(ordinaryZones.length/2)-1)];
  const previous=world.platforms[middle.exitId],pathIndex=world.mainPath.indexOf(previous.id),nextId=world.mainPath[pathIndex+1];
  const cut=previous.x+previous.width/2+.01,shift=32;
  const moved=new Set();
  for(const list of [world.platforms,world.enemies,world.treasures,world.springs,world.switches,world.camps,world.hazards,world.supplies,world.decorations,world.forks,world.zones,world.bossArenas])for(const item of list){
    if(moved.has(item))continue;moved.add(item);
    for(const key of ['x','baseX','minX','maxX','left','right','switchX','warningX'])if(Number.isFinite(item[key])&&item[key]>=cut)item[key]+=shift;
  }
  const floor={id:world.platforms.length,x:previous.x+previous.width/2+16,y:previous.y,width:32,isOneWay:true,isCheckpoint:true,isBossFloor:true,zone:middle.id,progress:middle.id,skin:previous.skin};
  world.platforms.push(floor);world.mainPath.splice(pathIndex+1,0,floor.id);
  for(const edge of world.edges)if(edge.from===previous.id&&world.platforms[edge.to].x>floor.x)edge.from=floor.id;
  world.edges.push({from:previous.id,to:floor.id,kind:'jump'});
  const template=world.enemies.find(e=>e.isBoss),kind=NEW_MONSTERS[world.themeId][stage.index%3],hp=140+stage.worldIndex*18;
  const boss={...structuredClone(template),...MONSTERS[kind],kind,id:world.enemies.length+1,name:`${MONSTERS[kind].name}队长`,image:MONSTERS[kind].image,isMidBoss:true,isWorldBoss:false,arenaId:0,platformId:floor.id,zone:middle.id,x:floor.x+6,y:floor.y,baseY:floor.y,minX:floor.x-10,maxX:floor.x+11,width:3,height:3.8,hp,maxHp:hp,points:65,warningX:floor.x,skills:template.skills.slice(0,1)};
  // 中段在短走廊里练一种主题招式，终点仍使用组合招式。
  boss.skills=[{...boss.skills[0],kind:['charge','lob','fan'][stage.index%3]}];boss.patterns=boss.skills.map(s=>s.kind);
  world.enemies.push(boss);
  for(const arena of world.bossArenas){arena.id++;world.enemies[arena.bossId-1].arenaId=arena.id;}
  world.bossArenas.unshift({id:0,bossId:boss.id,floorId:floor.id,exitId:floor.id,left:floor.x-15,right:floor.x+15,y:floor.y,layout:stage.index%3===0?'open':'platform',switchX:floor.x-9,switchY:floor.y});
  if(stage.index%3!==0){const ledge={...floor,id:world.platforms.length,x:floor.x-7,y:floor.y+2.2,width:6,isCheckpoint:false,isBossFloor:false};world.platforms.push(ledge);world.edges.push({from:floor.id,to:ledge.id,kind:'jump'},{from:ledge.id,to:floor.id,kind:'drop'});middle.platformIds.push(ledge.id);}
  middle.platformIds.push(floor.id);
  world.supplies.push({id:'midboss:medkit',kind:'medkit',bossId:boss.id,platformId:floor.id,x:floor.x+10,y:floor.y+1});
  world.maxX+=shift;world.signature+=':combat6:'+world.enemies.map(e=>e.kind).join(',');
  return world;
}
