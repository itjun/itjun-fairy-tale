import { placeEnemy } from '../room-terrain.js';
import { LEVEL_COLLECTIBLES } from '../collectibles.js';
import { fieldThemes } from './themes.js';

// Each trail contains explicit turns, bridges and balconies. Only long stretches
// between landmarks are subdivided to keep single jumps within the kids' reach.
function roomBuilder(world, builder, stage, name, kind, theme) {
  const id = world.rooms.length, origin = id ? Math.ceil(world.rooms.at(-1).right) + 55 : 0;
  const room = { id, depth:id, name, kind, platformIds:[], path:[], enemyIds:[], childIds:[], waves:0,
    reward:kind === 'battle' ? 'upgrade' : null, stops:[], gates:[], props:[], moving:[], field:theme.theme };
  world.rooms.push(room);
  builder.state.zoneId = id;
  function tile(x, y, width=8, extra={}) {
    const p = builder.add(origin+x, y, width, {roomId:id, ...(theme.theme==='beach' ? {skin:'sand'} : {}), ...extra});
    room.platformIds.push(p.id); room.path.push(p.id);
    return p;
  }
  const points = new Map();
  function path(nodes, extra={}) {
    const anchors=[];
    for (let i=0;i<nodes.length;i++) {
      const [x,y,width=8] = nodes[i], key=x+','+y;
      if (i) {
        const [lastX,lastY]=nodes[i-1];
        const pieces=Math.max(1,Math.ceil(Math.abs(x-lastX)/10),Math.ceil(Math.abs(y-lastY)/2.65));
        for(let j=1;j<pieces;j++) {
          const u=j/pieces;
          tile(lastX+(x-lastX)*u,lastY+(y-lastY)*u,Math.max(4.2,Math.abs(x-lastX)/pieces-1.35),extra);
        }
      }
      if(!points.has(key)) points.set(key,tile(x,y,width,extra));
      anchors.push(points.get(key));
    }
    return anchors;
  }
  function station(key,p,icon,label,options={}) {
    const stop={key,platformId:p.id,icon,label,after:[],...options};
    room.stops.push(stop); return stop;
  }
  function gate(key,nodes,extra={}) {
    const ledges=path(nodes,{...extra,isEnabled:false,fieldGate:key});
    room.gates.push(key); return ledges;
  }
  function prop(icon,p,width,height,dx=0,dy=0) {
    room.props.push({icon,x:p.x+dx,y:p.y+dy,width,height});
  }
  function prize(p) {
    const options=LEVEL_COLLECTIBLES[stage.themeId];
    world.treasures.push({id:world.treasures.length+1,roomId:id,platformId:p.id,
      kind:options[Math.floor(builder.random()*options.length)],x:p.x,y:p.y+1.3});
  }
  function enemy(p,kind,wave=0) {
    const guard=placeEnemy(world,stage,p,kind,builder.random);
    Object.assign(guard,{roomId:id,wave,isDormant:wave>0});room.enemyIds.push(guard.id);return guard;
  }
  function move(x,y,width,toX,toY,options) {
    const p=tile(x,y,width,{isMoving:true,skin:'raft',baseX:origin+x,baseY:y,deltaX:0,deltaY:0});
    room.moving.push({platformId:p.id,x:p.x,y,toX:origin+toX,toY,...options});
    return p;
  }
  function finish(start,exit) {
    const tiles=room.platformIds.map(i=>world.platforms[i]);
    Object.assign(room,{startId:start.id,exitId:exit.id,exitPlatformIds:[exit.id],
      left:Math.min(...tiles.map(p=>p.x-p.width/2)),right:Math.max(...tiles.map(p=>p.x+p.width/2)),
      bottom:Math.min(...tiles.map(p=>p.y)),top:Math.max(...tiles.map(p=>p.y))+3});
    for(const m of room.moving) { room.top=Math.max(room.top,m.toY+3);room.bottom=Math.min(room.bottom,m.toY); }
    room.fallY=room.bottom-7;exit.milestone=id+1;
    if(!id) world.start=start;
    world.mainPath.push(...room.path);
    world.zones.push({id,kind,name,isBoss:kind==='boss',roomIds:[id],startId:start.id,exitId:exit.id,
      platformIds:room.platformIds,minX:room.left,maxX:room.right,baseY:0});
  }
  return {room,world,builder,stage,id,origin,random:builder.random,tile,path,station,gate,move,prop,prize,enemy,finish};
}

function guardRoom(p,theme) {
  const ground=p.path([[0,0,13],[24,0,13],[45,-2,11],[68,0,13],[88,1,12],[112,0,13],[134,0,12]]);
  const high=p.path([[28,2.7],[39,5.4],[57,5.4],[76,3.1]]);
  for(const [i,home] of [ground[1],high[1],ground[2],ground[4],ground[5],high[3]].entries()) {
    p.enemy(home,theme.monsters[i%theme.monsters.length],i<3?0:1);
  }
  p.room.waves=2;p.room.encounters=[{endId:ground[2].id,lastWave:0},{endId:ground[5].id,lastWave:1}];
  p.prop(theme.landmark,ground[3],8,7);p.prize(high[2]);p.finish(ground[0],ground.at(-1));
}

export function buildFieldWorld(world,stage,builder,placeBoss) {
  const theme=fieldThemes.find(t=>t.id===stage.id);
  world.field=theme.theme;
  for(const chapter of theme.chapters(builder.random)) {
    const p=roomBuilder(world,builder,stage,chapter[0],chapter[1]?'mechanism':'battle',theme);
    if(chapter[1]) chapter[1](p); else guardRoom(p,theme);
  }
  const arena=roomBuilder(world,builder,stage,theme.arena,'boss',theme);
  const start=arena.tile(0,0,14,{isCheckpoint:true}),floor=arena.tile(27,0,34,{isOneWay:false,isBossFloor:true});
  const flag=arena.tile(54,0,14,{isFinish:true});
  for(const [x,y] of [[16,2.7],[24,5.4],[36,2.7]]) arena.tile(x,y,6.5);
  const boss=placeBoss(world,stage,arena.room,floor);
  world.bossArenas.push({id:0,bossId:boss.id,floorId:floor.id,exitId:flag.id,left:floor.x-16,right:floor.x+16,y:0,layout:'platform'});
  world.supplies.push({id:'medkit:0',kind:'medkit',platformId:start.id,x:start.x+1,y:1.2});
  arena.prop(theme.landmark,floor,11,9);arena.finish(start,flag);world.finish=flag;
  for(const r of world.rooms.slice(0,-1)) {
    const next=world.rooms[r.id+1];
    world.doors.push({id:r.id,roomId:r.id,targetRoomId:next.id,platformId:r.exitId,offsetX:2.5,kind:next.kind,reward:next.reward});
  }
  Object.assign(world,{minX:world.rooms[0].left,maxX:world.rooms.at(-1).right,
    minY:Math.min(...world.rooms.map(r=>r.fallY))-3,maxY:Math.max(...world.rooms.map(r=>r.top))+7,
    requiredFlowers:0,signature:world.rooms.map(r=>r.name+':'+r.stops.map(s=>s.key+'@'+s.platformId).join(',')).join('|')});
}
