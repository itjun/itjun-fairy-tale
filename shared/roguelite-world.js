import { randomGenerator } from './random.js';
import { STAGES, themeFor } from './levels.js';
import { LEVEL_COLLECTIBLES } from './collectibles.js';
import { MONSTERS, EXPANDED_THEME_MONSTERS } from './adventure-catalog.js';

// 每个小关有自己的结构语法，种子选择房间、连接与支路；旧版本不经过这里。
export const ROOM_GRAMMARS = Object.freeze({
  hills: ['hill','arch','hollow'], arches: ['arch','bridge','switch'], clouds: ['cloud','spring','tower'],
  streets: ['street','hollow','bridge'], houses: ['house','switch','street'], clock: ['tower','pendulum','house'],
  gates: ['switch','arch','conveyor'], cookies: ['crumbles','pendulum','bridge'], cellar: ['hollow','switch','spring'],
  tides: ['islands','geyser','bridge'], rafts: ['ferry','islands','geyser'], lighthouse: ['tower','ferry','house'],
  wind: ['spring','seesaw','hill'], windmill: ['lift','seesaw','tower'], ridge: ['zigzag','bridge','spring'],
  ice: ['slide','icebridge','hill'], icecave: ['hollow','icebridge','geyser'], snowpeak: ['zigzag','lift','slide'],
  roots: ['hollow','arch','switch'], trunk: ['tower','lift','spring'], canopy: ['bridge','cloud','seesaw'],
  blocks: ['house','switch','zigzag'], factory: ['conveyor','pendulum','crumbles'], rocket: ['tower','spring','lift'],
});
const SURFACES = { rainbow:'bank', family:'roof', sweet:'cookie', beach:'rock', meadow:'bank', snow:'ice', forest:'root', cartoon:'blocks' };
const HAZARDS = { rainbow:'thorns', family:'pendulum', sweet:'steam', beach:'geyser', meadow:'pendulum', snow:'icicle', forest:'thorns', cartoon:'steam' };

export function createRogueliteWorld(seed, selected) {
  const requestedId = typeof selected === 'string' ? selected : selected.id;
  const stage = STAGES.find(s => s.id === requestedId) || STAGES.find(s => s.themeId === requestedId);
  if (!stage) throw new Error('找不到这个小关');
  const theme = themeFor(stage), random = randomGenerator((seed ^ Math.imul(stage.index + 1, 0x45d9f3b)) >>> 0);
  const pick = items => items[Math.floor(random() * items.length)];
  const world = { version:4, seed, levelId:requestedId, stageId:stage.id, themeId:theme.id, route:stage.structure,
    platforms:[], treasures:[], enemies:[], springs:[], lifts:[], switches:[], zones:[], milestones:[], decorations:[], mainPath:[], edges:[], forks:[], camps:[], hazards:[], supplies:[], routeGraph:[] };
  let zoneId = 0;
  const add = (x,y,width=6,extra={}) => {
    const p = {id:world.platforms.length,x,y,width,isOneWay:true,zone:zoneId,progress:zoneId,skin:SURFACES[theme.id],...extra};
    world.platforms.push(p); return p;
  };
  const edge = (a,b,kind='jump') => world.edges.push({from:a.id,to:b.id,kind});
  let cursor = add(0,0,14,{isCheckpoint:true});
  world.start=cursor;world.mainPath.push(cursor.id);
  const next = (dy=0,width=6,gap=1.2,extra={}) => {
    const p=add(cursor.x+cursor.width/2+gap+width/2,cursor.y+dy,width,extra);
    edge(cursor,p);cursor=p;world.mainPath.push(p.id);return p;
  };
  const lift = (axis,travel,skin='leaf') => {
    const base=cursor, p=add(base.x+base.width/2+3,base.y,5,{isMoving:true,axis,baseX:base.x+base.width/2+3,baseY:base.y,travel,period:7,skin});
    edge(base,p,'board');world.lifts.push(p);world.mainPath.push(p.id);
    cursor=p;
    const exit=add(p.x+(axis==='x'?travel:0)+6,p.y+(axis==='y'?travel:0),7);
    edge(p,exit,'ride');cursor=exit;world.mainPath.push(exit.id);
  };
  const hazard = (p,kind=HAZARDS[theme.id]) => {
    if (p.width<7 || p.isMoving || p.isCheckpoint) return;
    world.hazards.push({id:world.hazards.length,kind,platformId:p.id,x:p.x,y:p.y,period:6+random()*2,phase:random()*2,length:5,warning:1.35,active:1.35});
  };
  const slope = (rise,width=10) => next(rise/2,width,0,{slope:rise/width,skin:SURFACES[theme.id],depth:3.5});
  const spring = () => {
    const p=cursor;world.springs.push({x:p.x,y:p.y,platformId:p.id,power:18});
    const top=add(p.x+5,p.y+5.5,6,{skin:theme.id==='forest'?'leaf':SURFACES[theme.id]});edge(p,top,'spring');cursor=top;world.mainPath.push(top.id);
  };
  for (zoneId=0;zoneId<stage.roomCount;zoneId++) {
    const grammar=ROOM_GRAMMARS[stage.structure], kind=zoneId===0?grammar[0]:pick(grammar);
    const entry=cursor, first=world.platforms.length;
    const zone={id:zoneId,name:`${stage.chapterName} ${zoneId+1}`,kind,startId:entry.id,minX:entry.x,baseY:entry.y,platformIds:[]};world.zones.push(zone);
    // 每种房间以实际不同的碰撞轮廓与机关组织主路，不重复旧十二步循环。
    if(kind==='hill') { slope(2.4);next(1.2,9,0);slope(-2.4);next(-1.2,8,1); }
    if(kind==='arch') { next(2,4);next(2,5);next(0,12,1,{isBridge:true});next(-2,4);next(-2,8); }
    if(kind==='bridge') { next(1,5);next(0,14,1,{isBridge:true});next(-1,9);hazard(cursor); }
    if(kind==='hollow') { next(-2,7,0,{isTunnel:true,depth:5});next(-2,10,1,{isTunnel:true,depth:3});hazard(cursor);next(2,5);next(2,7); }
    if(kind==='street') { next(0,14,0,{depth:5});next(2,4,1,{skin:'awning'});next(2,12,0,{skin:'roof',depth:6});next(-4,12,1,{depth:5}); }
    if(kind==='house') { next(2,5,0,{skin:'awning'});next(2,10,0,{skin:'roof',depth:5});next(2,4,0,{skin:'awning'});next(0,10,1,{skin:'roof'});next(-4,7);next(-2,10,0); }
    if(kind==='tower') {
      next(0,6);const bottom=cursor;
      for(let n=0;n<4;n++){const p=add(bottom.x+(n%2?0:5),bottom.y+(n+1)*2.3,4.5,{skin:theme.id==='family'?'awning':theme.id==='forest'?'leaf':SURFACES[theme.id]});edge(cursor,p);cursor=p;world.mainPath.push(p.id);}
      next(0,9);next(-3,5);next(-3,7);next(-3.2,8);
    }
    if(kind==='cloud') { next(1.8,5,1.5,{isCrumbling:true,skin:'cloud'});next(1.8,4.5,1.5,{isCrumbling:true,skin:'cloud'});next(-1.8,6,2,{skin:'leaf'});next(-1.8,8); }
    if(kind==='switch') {
      next(0,8);const switchBase=cursor;
      const bridge=next(0,12,0,{isBridge:true,gateId:world.switches.length,isEnabled:false});world.edges.at(-1).kind='gate';
      world.switches.push({id:world.switches.length,x:switchBase.x,y:switchBase.y,platformId:switchBase.id,bridgeId:bridge.id,isOpen:false});next(0,10,0);
    }
    if(kind==='crumbles'||kind==='icebridge') {
      for(let n=0;n<4;n++)next(n%2?-.7:.7,4.5,1.4,{isCrumbling:true,skin:kind==='icebridge'?'ice':'cookie',isIce:kind==='icebridge'});
      next(0,9);
    }
    if(kind==='islands') {next(-1.5,10,1,{depth:5});next(1.5,4,2);next(-2,7,2,{depth:5});next(2,10,2,{depth:4});}
    if(kind==='ferry') { next(0,7,0,{skin:'rock'});lift('x',10,'raft');next(1.5,7,1,{skin:'rock'});next(-1.5,9); }
    if(kind==='geyser') { next(0,12,1,{skin:'rock'});hazard(cursor,theme.id==='snow'?'icicle':'geyser');next(2,5);next(-2,10); }
    if(kind==='spring') {next(-2,8);spring();next(-1.5,5);next(-2,9);}
    if(kind==='lift') {next(0,8);lift('y',6,theme.id==='meadow'?'gear':'leaf');next(-2,6);next(-2,7);next(-2,8);}
    if(kind==='zigzag') {next(2,5);next(2,8);next(-2,4);next(2,4);next(-4,9);}
    if(kind==='slide') {next(0,10,0,{isIce:true});slope(-2,12);cursor.isIce=true;next(0,7,1,{isIce:true});next(2,9,0);}
    if(kind==='conveyor') {next(0,12,1,{conveyor:random()<.5?-1.4:1.4});next(2,5);next(-2,12,1,{conveyor:1.4});hazard(cursor,'steam');next(0,8);}
    if(kind==='pendulum') {next(0,16,1,{isBridge:true});hazard(cursor,'pendulum');next(2,5);next(-2,8);}
    if(kind==='seesaw') {next(0,12,1,{isSeesaw:true,slope:0,skin:'plank'});next(0,6);next(0,9);}
    // 保持出口与入口同一高度范围，避免随机拼接把后来房间推到不可恢复的位置。
    while(Math.abs(cursor.y-entry.y)>2.3)next(Math.sign(entry.y-cursor.y)*2,5,1);
    if (zoneId === stage.roomCount - 1 && !world.hazards.length) { next(0,12,1); hazard(cursor); }
    const exit=next(entry.y-cursor.y,10,1,{isCheckpoint:true,milestone:zoneId+1});
    zone.exitId=exit.id;world.milestones.push(exit.id);zone.maxX=exit.x+exit.width/2;
    zone.platformIds=world.platforms.slice(first).map(p=>p.id);
    world.routeGraph.push({id:`room:${zoneId}`,kind,next:zoneId+1<stage.roomCount?[`room:${zoneId+1}`]:['finish']});
    // 高路和地下路的连接会按种子变化，并包含不同的回环长度、机关和安全支路。
    if(zoneId===0||random()<.65){
      const isUpper=random()<.5, sign=isUpper?1:-1, routeId=isUpper?'upper':'lower', family=pick(['power','bubble','flight','nature','frost']);
      const fork={id:zoneId,zone:zoneId,startId:entry.id,endId:exit.id,x:entry.x,y:entry.y,routes:[]};
      const ids=[];let prior=entry;
      const span=exit.x-entry.x, count=Math.max(4,Math.ceil(span/7));
      for(let n=1;n<count;n++){
        const edgeRise=Math.min(n,count-n,2)*2.3;
        const p=add(entry.x+span*n/count,entry.y+sign*edgeRise,5+random()*2,{isBranch:true,isTunnel:!isUpper,skin:!isUpper?'rock':theme.id==='forest'?'leaf':SURFACES[theme.id],forkRoute:{forkId:zoneId,routeId}});
        ids.push(p.id);edge(prior,p,n===1&&!isUpper?'drop':'jump');prior=p;
      }
      edge(prior,exit,isUpper?'drop':'jump');
      const mainIds=zone.platformIds.filter(id=>id!==exit.id);
      mainIds.forEach(id=>world.platforms[id].forkRoute={forkId:zoneId,routeId:'main'});
      fork.routes=[{id:'main',name:'机关小路',family:pick(['power','frost','flight'].filter(value=>value!==family)),platformIds:mainIds},{id:routeId,name:isUpper?'高处绕行':'洞里探索',family,platformIds:ids}];
      world.forks.push(fork);zone.platformIds.push(...ids);
      world.routeGraph.find(node=>node.id===`room:${zoneId}`).next.push(`detour:${zoneId}`);world.routeGraph.push({id:`detour:${zoneId}`,kind:routeId,next:[`room:${zoneId}`,...(zoneId+1<stage.roomCount?[`room:${zoneId+1}`]:['finish'])]});
    }
    const grounds=zone.platformIds.map(id=>world.platforms[id]).filter(p=>!p.isMoving&&!p.isCheckpoint&&!p.isCrumbling&&p.gateId===undefined&&!p.slope&&!p.isSeesaw&&p.width>=6&&!world.hazards.some(h=>Math.abs(h.x-p.x)<5&&Math.abs(h.y-p.y)<3));
    if(grounds.length){
      const rewardHome=pick(grounds), treasureKind=pick(LEVEL_COLLECTIBLES[theme.id]);
      world.treasures.push({id:world.treasures.length+1,kind:treasureKind,platformId:rewardHome.id,x:rewardHome.x,y:rewardHome.y+1.4});
      const pool=EXPANDED_THEME_MONSTERS[theme.id];
      for(const p of grounds.filter(p=>Math.abs(p.x-entry.x)>9&&Math.abs(p.x-exit.x)>7).slice(0,2+Math.min(2,Math.floor(stage.worldIndex/3)))){
        const enemyKind=pick(pool), definition=MONSTERS[enemyKind], isElite=zoneId===stage.roomCount-1&&world.enemies.every(e=>!e.isElite);
        world.enemies.push({id:world.enemies.length+1,platformId:p.id,zone:zoneId,kind:enemyKind,...definition,x:p.x,y:p.y,baseY:p.y,minX:p.x-p.width/2+1,maxX:p.x+p.width/2-1,direction:random()<.5?-1:1,speed:.7+random()*.4,width:1.3,height:isElite?2:1.55,phase:random()*3,elapsed:0,hp:isElite?4:1+Number(stage.index>10),isElite,isDefeated:false,drop:null});
      }
    }
    world.decorations.push({kind:theme.id,x:(entry.x+exit.x)/2,y:Math.min(...zone.platformIds.map(id=>world.platforms[id].y))-4,width:exit.x-entry.x,height:18,zone:zoneId});
    cursor=exit;
  }
  world.finish=cursor;cursor.isFinish=true;
  const supplyZone=world.zones[Math.floor(world.zones.length/2)], fork=world.forks.find(f=>f.zone===supplyZone.id)||world.forks[0];
  const supplyIds=fork?.routes[1].platformIds||supplyZone.platformIds;
  const p=world.platforms[supplyIds[Math.floor(supplyIds.length/2)]];
  world.supplies.push({id:'life:0',kind:'life',platformId:p.id,x:p.x,y:p.y+1.1});
  world.camps=[{id:'start',platformId:0,x:-3,y:0,zone:0}];
  world.requiredFlowers=0;
  world.minX=-7;world.maxX=cursor.x+5;world.minY=Math.min(...world.platforms.map(p=>p.y))-14;world.maxY=Math.max(...world.platforms.map(p=>p.y+(p.axis==='y'?p.travel:0)))+6;
  world.signature=`${stage.structure}:${world.zones.map(z=>z.kind).join('/')}:${world.forks.map(f=>`${f.zone}:${f.routes[1].id}:${f.routes[1].platformIds.length}`).join('/')}`;
  // 子怪编号提前确定，存档、奖励唯一性与服务器计分保持一致。
  for(const parent of [...world.enemies])if(['candy','paint'].includes(parent.kind)){
    parent.childIds=[];for(let i=0;i<2;i++){const child={...parent,id:world.enemies.length+1,parentId:parent.id,childIds:undefined,isDormant:true,isElite:false,hp:1,height:.8,width:.8,points:5,direction:i?1:-1};parent.childIds.push(child.id);world.enemies.push(child);}
  }
  return world;
}
