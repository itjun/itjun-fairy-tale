import { createRogueliteWorld } from './roguelite-world.js';
import { STAGES } from './levels.js';
import { bossSkills } from './boss-skills.js';

// 每个世界三位小关首领和一位大关首领。招式顺序与场地共同决定打法。
export const BOSS_THEMES = Object.freeze({
  rainbow: { image:'boss-flower', leader:'彩虹花王', small:['果冻队长','云朵领航员','花丘守卫'], kinds:['jelly','puff','flowerpot'], family:'power' },
  family: { image:'boss-clock', leader:'钟楼守卫', small:['街巷哨兵','屋顶跳跳王','铃铛队长'], kinds:['toy','pillow','bell'], family:'flight' },
  sweet: { image:'boss-pudding', leader:'布丁国王', small:['糖球队长','饼干卫士','奶油蘑菇'], kinds:['candy','pillow','mushroom'], family:'bubble' },
  beach: { image:'boss-crab', leader:'贝壳蟹王', small:['沙堡卫士','泡泡鱼王','浪花蟹队长'], kinds:['sandcastle','fish','crab'], family:'bubble' },
  meadow: { image:'boss-windmill', leader:'风车守卫', small:['叶盾队长','松果投手','疾风萤火'], kinds:['leafshield','squirrel','firefly'], family:'nature' },
  snow: { image:'boss-snowman', leader:'雪人国王', small:['雪球队长','冰花卫士','冰锥守卫'], kinds:['snowball','snowflower','icicle'], family:'frost' },
  forest: { image:'boss-tree', leader:'古树守卫', small:['蘑菇守卫','松果卫士','灯笼蛾王'], kinds:['mushroom','squirrel','moth'], family:'nature' },
  cartoon: { image:'boss-toy', leader:'发条巨人', small:['积木卫士','彩笔队长','飞星领航员'], kinds:['toy','paint','bell'], family:'power' },
});

export function createBossWorld(seed, selected) {
  const world = createRogueliteWorld(seed, selected);
  const stage = STAGES.find(item => item.id === world.stageId), theme = BOSS_THEMES[world.themeId];
  world.version = 5; world.bossArenas = [];
  for (const enemy of world.enemies) { enemy.hp *= 12; enemy.maxHp = enemy.hp; enemy.combatVersion = 2; }
  let previous = world.finish; previous.isFinish = false;
  const chapter = stage.index % 3;
  for (let ordinal = 0; ordinal < (chapter === 2 ? 2 : 1); ordinal++) {
    const isWorldBoss = ordinal === 1, zone = world.zones.length;
    const layout = isWorldBoss ? 'mechanism' : stage.index < 2 ? 'open' : 'platform';
    const add = (x,y,width,extra={}) => { const p={id:world.platforms.length,x,y,width,isOneWay:true,zone,progress:zone,skin:previous.skin,...extra};world.platforms.push(p);return p; };
    const floor = add(previous.x + previous.width/2 + 16, previous.y, 32, {isCheckpoint:true,isBossFloor:true});
    world.edges.push({from:previous.id,to:floor.id,kind:'jump'});world.mainPath.push(floor.id);
    const ids=[floor.id];
    if(layout!=='open') {
      for(const side of [-1]) {
        const low=add(floor.x+side*10,floor.y+2.2,6,{skin:world.themeId==='forest'?'leaf':floor.skin});
        const high=add(floor.x+side*5.5,floor.y+4.4,6,{skin:low.skin});
        ids.push(low.id,high.id);world.edges.push({from:floor.id,to:low.id,kind:'jump'},{from:low.id,to:high.id,kind:'jump'},{from:high.id,to:floor.id,kind:'drop'});
      }
    }
    const kind=theme.kinds[chapter], definition=world.enemies.find(e=>e.kind===kind);
    const hp=isWorldBoss?480+stage.worldIndex*100:180+stage.index*24;
    const skills=bossSkills(world.themeId,chapter,isWorldBoss);
    const boss={id:world.enemies.length+1,kind,image:isWorldBoss?theme.image:world.themeId==='forest'&&chapter===0?'boss-mushroom':definition?.image,
      name:isWorldBoss?theme.leader:theme.small[chapter],isBoss:true,isWorldBoss,arenaId:world.bossArenas.length,combatVersion:2,
      platformId:floor.id,zone,x:floor.x+7,y:floor.y,baseY:floor.y,minX:floor.x-10,maxX:floor.x+11,direction:-1,speed:0,
      width:isWorldBoss?5.8:3.2,height:isWorldBoss?7.5:4.2,hp,maxHp:hp,elapsed:0,phase:0,points:isWorldBoss?250:100,
      family:theme.family,skills,patterns:skills.map(skill=>skill.kind),
      isDormant:true,isDefeated:false,isShielded:false,shieldUntil:0,attackIndex:0,attackTime:0,attackStage:'rest',warningX:floor.x,drop:null};
    world.enemies.push(boss);
    const exit=add(floor.x+floor.width/2+4,floor.y,8,{isCheckpoint:true,milestone:zone+1});
    ids.push(exit.id);world.edges.push({from:floor.id,to:exit.id,kind:'jump'});world.mainPath.push(exit.id);world.milestones.push(exit.id);
    const arena={id:world.bossArenas.length,bossId:boss.id,floorId:floor.id,exitId:exit.id,left:floor.x-15,right:floor.x+15,y:floor.y,layout,switchX:floor.x-9,switchY:floor.y};
    world.bossArenas.push(arena);
    world.zones.push({id:zone,name:boss.name,kind:'boss',isBoss:true,startId:floor.id,exitId:exit.id,minX:arena.left,maxX:exit.x+4,baseY:floor.y,platformIds:ids});
    world.decorations.push({kind:world.themeId,x:floor.x+5,y:floor.y-4,width:32,height:22,zone});
    previous=exit;
  }
  world.finish=previous;previous.isFinish=true;world.maxX=previous.x+5;
  world.maxY=Math.max(world.maxY,...world.platforms.map(p=>p.y+7));
  world.signature+=`:boss:${world.bossArenas.map(a=>a.layout).join('/')}`;
  return world;
}
