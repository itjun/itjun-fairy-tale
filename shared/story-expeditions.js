import { LEVEL_COLLECTIBLES } from './collectibles.js';
import { placeEnemy } from './room-terrain.js';

// Positions in each chapter are local. Doors join chapters, while landmarks and
// the routes between them are one continuous piece of playable terrain.
export function storyRoom(world, stage, builder, name, kind = 'mechanism', reward = null) {
  const id = world.rooms.length;
  const origin = id ? Math.ceil(world.rooms.at(-1).right) + 54 : 0;
  const room = { id, depth: id, name, kind, reward, enemyIds: [], childIds: [], waves: 0,
    path: [], platformIds: [], goals: [], stations: [], hands: [], runs: [], frames: [] };
  world.rooms.push(room);
  builder.state.zoneId = id;
  const tag = key => id + '/' + key;
  function tile(x, y, width, skin, props = {}) {
    const p = builder.add(origin + x, y, width, { roomId: id, ...(skin ? { skin } : {}), ...(skin === 'ice' ? { isIce:true } : {}), ...props });
    room.platformIds.push(p.id);
    room.path.push(p.id);
    return p;
  }
  function trail(points, skin) { return points.map(([x,y,w=7]) => tile(x,y,w,skin)); }
  function treasure(p) {
    const kinds = LEVEL_COLLECTIBLES[stage.themeId];
    world.treasures.push({ id: world.treasures.length + 1, roomId: id, platformId: p.id,
      kind: kinds[Math.floor(builder.random()*kinds.length)], x: p.x, y: p.y+1.25 });
  }
  function station(key, p, icon, label, options = {}) {
    const s = { key: tag(key), platformId: p.id, offset: options.offset || 0, icon, label,
      requires: (options.after || []).map(tag), kind: options.kind || 'touch', goal: options.goal !== false };
    room.stations.push(s);
    if (s.goal) room.goals.push(s.key);
    return s.key;
  }
  function gated(points, key, skin) {
    return points.map(([x,y,w=7]) => tile(x,y,w,skin,{ needsMark: tag(key), isEnabled:false }));
  }
  function enemy(p, kind) {
    const e = placeEnemy(world,stage,p,kind,builder.random);
    Object.assign(e,{roomId:id,wave:0,isDormant:false});
    room.enemyIds.push(e.id);
    return e;
  }
  function spring(p) {
    world.springs.push({platformId:p.id,x:p.x-1.8,y:p.y,power:17});
  }
  function ferry(x,y,travel) {
    const p=tile(x,y,6,'raft',{isMoving:true,axis:'x',baseX:origin+x,baseY:y,travel,period:8});
    world.lifts.push(p);
    return p;
  }
  function finish(start, exit) {
    const ps = room.platformIds.map(i => world.platforms[i]);
    if (room.id && room.kind==='mechanism') {
      // Space encounters along the walk and keep the actual controls clear.
      const pool={rainbow:['leaf','puff','mushroom'],family:['toy','puff','bell'],snow:['snowball','puff','snowflower']}[stage.themeId];
      const pads=new Set(room.stations.map(s=>s.platformId));
      const homes=ps.filter(p=>p!==start && p!==exit && !p.isMoving && !p.needsMark && !pads.has(p.id) && p.width>=7);
      for(const fraction of [.27,.73]) {
        const home=homes[Math.floor(homes.length*fraction)];
        if(home) enemy(home,pool[Math.floor(builder.random()*pool.length)]);
      }
    }
    Object.assign(room,{ startId:start.id, exitId:exit.id, exitPlatformIds:[exit.id],
      left:Math.min(...ps.map(p=>p.x-p.width/2)),right:Math.max(...ps.map(p=>p.x+p.width/2)),
      bottom:Math.min(...ps.map(p=>p.y)),top:Math.max(...ps.map(p=>p.y))+2 });
    room.fallY = room.bottom-5;
    exit.milestone = id+1;
    if (!id) world.start=start;
    world.mainPath.push(...room.path);
    world.zones.push({id,kind,name,isBoss:kind==='boss',roomIds:[id],startId:start.id,exitId:exit.id,
      platformIds:room.platformIds,minX:room.left,maxX:room.right,baseY:0});
  }
  return {room,origin,tile,trail,treasure,station,gated,enemy,spring,ferry,finish,random:builder.random};
}

const leaves = 'water-leaf', lilies = 'water-lily';
const water = 'water-gutter';

function nursery(p) {
  const {tile,trail,station,gated,treasure,finish}=p;
  const bank=trail([[0,0,13],[13,-1,10],[24,-2,9],[35,-2,9],[46,-1,9],[57,0,9],[68,1,9],[79,0,9],[90,-1,9]],'bank');
  const canopy=trail([[16,1.6],[24,4.2],[33,6.8],[42,8],[51,7]],leaves);
  station('spring',bank[4],water,'引来地下泉水');
  const back=gated([[38,1],[31,3.8],[23,6]],'spring',lilies);
  station('seed',canopy[4],'water-sunflower','唤醒花圃',{after:['spring']});
  gated([[99,1.4],[107,3.5],[115,4.8]],'seed',leaves);
  p.spring(bank[2]);
  treasure(canopy[2]);treasure(back[0]);treasure(bank[7]);
  finish(bank[0],tile(125,5,11));
}
function watermill(p) {
  const {tile,trail,station,gated,treasure,finish}=p;
  const stream=trail([[0,0,14],[12,-1,7],[21,-2,8],[31,-3,9],[42,-3,9],[53,-1,9],[64,0,9],[75,-1,9],[86,-2,9],[97,-2,9]],lilies);
  const ridge=trail([[13,2.4],[22,4.8],[31,7.2],[40,7.2],[49,6.6],[58,5.4],[67,4.8],[76,4.8],[85,5.8],[94,7]],leaves);
  station('wheel',stream[4],water,'下渠的水轮转起来了');
  station('sluice',ridge[8],water,'打开高处的闸口');
  const grow=gated([[104,.4],[112,2.8],[120,5.2]],'wheel',lilies);
  gated([[104,7.2],[113,7.8],[122,8]],'sluice',leaves);
  p.ferry(37,2.25,20);
  treasure(ridge[3]);treasure(stream[7]);treasure(grow[1]);
  finish(stream[0],tile(132,6,13));
}
function pollen(p) {
  const {tile,trail,station,gated,treasure,finish}=p;
  const floor=trail([[0,0,12],[12,0,9],[23,0,9],[34,-1,9],[45,-2,9],[56,-2,9],[67,-1,9],[78,0,9],[89,0,9],[100,1,9],[111,1,9]],'bank');
  const flower=trail([[12,2.6],[20,5.2],[28,7.8],[36,10.4],[44,10.8]],leaves);
  station('pollen',flower.at(-1),'flower','沾上金色花粉');
  const islands=trail([[62,1.6],[70,4],[78,6.6],[86,9.1],[94,9.1]],leaves);
  station('bloom',islands.at(-1),'water-sunflower','花粉送到了另一朵花',{after:['pollen']});
  gated([[119,3.6],[127,6]],'bloom',leaves);
  p.spring(floor[5]);
  treasure(floor[5]);treasure(islands[2]);treasure(flower[2]);
  finish(floor[0],tile(137,6,12));
}
function cistern(p) {
  const {tile,trail,station,gated,treasure,finish}=p;
  const bowl=trail([[0,0,13],[13,-1,10],[25,-3,10],[37,-5,10],[49,-7,10],[61,-7,10],[73,-5,10],[85,-3,10],[97,-1,10],[109,1,10]],'rock');
  station('plug',bowl[5],water,'水池开始蓄水');
  const across=gated([[55,-4],[47,-1.4],[39,1.2],[31,3.8],[23,6.4]],'plug',lilies);
  station('crest',across.at(-1),water,'放开上层的溢水口',{after:['plug']});
  const top=gated([[32,8.8],[41,9.4],[50,9.4],[59,8.9],[68,8],[77,7.4],[86,6.2],[95,5.8],[104,5.2]],'crest',leaves);
  treasure(bowl[4]);treasure(top[4]);
  finish(bowl[0],tile(118,3,12));
}
function orchard(p) {
  const {tile,trail,station,gated,treasure,finish}=p;
  const road=trail([[0,0,14],[13,0,9],[24,0,9],[35,0,9],[46,0,9],[57,0,9],[68,0,9],[79,0,9],[90,0,9],[101,0,9],[112,0,9]],'bank');
  const high=trail([[17,2.6],[25,5.2],[33,7.8],[42,8.6],[51,8.6]],leaves);
  station('first',high[3],'water-gutter','第一条彩渠有水了');
  const mid=gated([[57,6.2],[66,4.8],[75,3.6],[84,3.6]],'first',lilies);
  station('last',road[9],water,'浇开城堡花冠',{after:['first']});
  gated([[113,2.6],[121,5.2],[129,7.8]],'last',leaves);
  treasure(high[4]);treasure(mid[1]);treasure(road[5]);
  finish(road[0],tile(139,8,12));
}
export function addGardenChapters(world,stage,builder,secondHalf) {
  const chapters = secondHalf ? [['花粉山脊',pollen],['回流蓄水池',cistern],['城堡果园',orchard]]
    : [['沉睡的苗圃',nursery],['双渠水磨',watermill]];
  if (secondHalf && world.valley.layout==='aqueduct') [chapters[0],chapters[1]]=[chapters[1],chapters[0]];
  for (const [name,build] of chapters) build(storyRoom(world,stage,builder,name));
}
