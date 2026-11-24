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
  function contour(points, skin, heights) {
    return trail(stage.baseId ? points.map(([x,,w],i)=>[x,heights[i],w]) : points,skin);
  }
  function snowbank(points,depth) {
    return points.slice(1).map(([x2,y2],i)=>{
      const [x1,y1]=points[i];
      return tile((x1+x2)/2,(y1+y2)/2,x2-x1,'ice',{slope:(y2-y1)/(x2-x1),snowDepth:depth});
    });
  }
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
  function hand(x, y, length, period = 7, phase = 0) {
    const p = tile(x+length/2,y,length,'clock-hand',{ isMoving:true, pivotX:origin+x, pivotY:y,
      handLength:length, period, phase, slope:0, deltaX:0, deltaY:0 });
    room.hands.push(p.id);
    room.frames.push({ x:origin+x+length*.52, y:y+1.4, width:length*2.8 });
    return p;
  }
  function run(key, source, points, label, {fork, spur, switchKey} = {}) {
    const absolute = path => path.map(([x,y]) => [origin+x,y]);
    const release = station(key+'-release',source,'snow-expedition-ball','放出雪球',{kind:'release',goal:false});
    const ball = { release, wall:tag(key), points:absolute(points),
      label, ...(spur ? { fork, spur:absolute(spur), lever:tag(switchKey), secret:tag(key+'-spur') } : {}) };
    room.runs.push(ball);
    room.goals.push(ball.wall);
    return ball;
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
      if(stage.themeId!=='rainbow' && homes.length>4) {
        const home=homes[Math.floor(homes.length*.52)];
        world.hazards.push({id:world.hazards.length,kind:stage.themeId==='snow'?'icicle':'pendulum',platformId:home.id,
          x:home.x,y:home.y,period:7,phase:builder.random()*2,length:3.9,warning:1.5,active:1.2});
      }
    }
    // Match the local slope of the snow channel under the rolling ball.
    for (const ball of room.runs) for (let i=1;i<ball.points.length;i++) {
      const [x0,y0]=ball.points[i-1],[x1,y1]=ball.points[i];
      for (const p of ps) if(p.isIce && !p.snowDepth && p.x>x0 && p.x<=x1 && Math.abs(p.y-(y1-1))<1.25) p.slope=(y1-y0)/(x1-x0);
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
  return {room,origin,layered:!!stage.baseId,tile,trail,contour,snowbank,treasure,station,gated,enemy,hand,run,spring,ferry,finish,random:builder.random};
}

const leaves = 'water-leaf', lilies = 'water-lily', roof = 'roof', plank = 'plank';
const water = 'water-gutter', bell = 'clock-golden-bell', gear = 'platform-gear', crystal = 'collectible-snowflake';

function nursery(p) {
  const {tile,trail,station,gated,treasure,finish}=p;
  const bank=p.contour([[0,0,13],[13,-1,10],[24,-2,9],[35,-2,9],[46,-1,9],[57,0,9],[68,1,9],[79,0,9],[90,-1,9]],'bank',[4, 1, -2, -4, -6, -4, -1, 2, 0]);
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
  const stream=p.contour([[0,0,14],[12,-1,7],[21,-2,8],[31,-3,9],[42,-3,9],[53,-1,9],[64,0,9],[75,-1,9],[86,-2,9],[97,-2,9]],lilies,[4, 1, -2, -5, -7, -5, -2, 1, -1, -3]);
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
  const floor=p.contour([[0,0,12],[12,0,9],[23,0,9],[34,-1,9],[45,-2,9],[56,-2,9],[67,-1,9],[78,0,9],[89,0,9],[100,1,9],[111,1,9]],'bank',[4, 1, -2, -5, -7, -5, -2, 1, -2, 1, 3]);
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
  const road=p.contour([[0,0,14],[13,0,9],[24,0,9],[35,0,9],[46,0,9],[57,0,9],[68,0,9],[79,0,9],[90,0,9],[101,0,9],[112,0,9]],'bank',[5, 2, -1, -4, -6, -4, -1, 2, 5, 2, 0]);
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


function towerSchool(p) {
  const {tile,trail,station,hand,treasure,finish}=p;
  if (p.layered) {
    const steps=trail([[0,1,13],[13,-2,9],[25,-4,9],[36,-1,8],[47,2,8],[56,5,8]],plank);
    const awnings=trail([[8,3.6,5.5],[16,6.2,7],[26,8.3,7.5],[37,7,8],[48,5.5,7]],roof);
    const arm=hand(54,6.5,14,8);
    station('ride',arm,gear,'搭上了时针',{kind:'ride'});
    tile(69,1,14,'safety-net');
    const gallery=trail([[73,11,9],[63,13.6,8],[53,16.2,8],[43,18.8,8],[32,20,11]],roof);
    station('chime',gallery.at(-1),bell,'折回钟亭敲响晨钟',{after:['ride']});
    const bridge=p.gated([[44,23,8],[55,24,9],[67,23,9],[79,21,10],[91,18.5,10],[103,16,10],[115,14,10]],'chime',plank);
    treasure(awnings[2]);treasure(gallery[2]);finish(steps[0],bridge.at(-1));
    return;
  }
  const street=trail([[0,0,14],[13,0,9],[24,0,9],[35,0,9]],plank);
  const stairs=trail([[12,2.6],[20,5.2],[28,7.8]],roof);
  const arm=hand(34,7.7,13);
  station('ride',arm,gear,'搭上了时针',{kind:'ride'});
  tile(42,1.1,17,'safety-net');
  const window=tile(54,12.2,11,plank);
  station('chime',window,bell,'敲响街口的晨钟',{after:['ride']});
  const roofs=trail([[65,11,9],[76,9,9],[87,7,9],[98,5,9],[109,3,9]],roof);
  treasure(stairs[2]);treasure(roofs[2]);finish(street[0],tile(121,2,12));
}
function rooftops(p) {
  const {tile,trail,station,gated,treasure,finish}=p;
  const alley=p.contour([[0,0,14],[14,0,10],[26,0,10],[38,-1,10],[50,-2,10],[62,-2,10],[74,-1,10],[86,0,10],[98,0,10],[110,0,10]],plank,[5, 2, -1, -4, -6, -7, -5, -2, 1, 3]);
  const roofline=trail([[16,2.6],[24,5.2],[32,7.8],[41,9],[50,8.2],[59,7],[68,6.2],[77,6],[86,7.6],[95,9]],roof);
  station('weight',alley[5],gear,'放下钟楼的配重');
  station('latch',roofline[8],bell,'屋顶的窗锁松开了');
  const landing=gated([[111,2.6],[119,5.2],[127,7.8]],'weight',plank);
  treasure(roofline[3]);treasure(alley[7]);treasure(landing[0]);finish(alley[0],tile(137,8,13,roof));
}
function twinHands(p) {
  const {tile,trail,station,hand,treasure,finish}=p;
  const base=tile(0,0,13,plank);
  trail([[11,2.5],[19,5],[27,7.5]],roof);
  const first=hand(32,7.5,14,7);
  station('brass',first,gear,'短针齿轮咬合',{kind:'ride'});
  const ledge=tile(54,11.6,12,plank);
  const step=tile(66,13.9,9,roof);
  const second=hand(72,13.9,15,8,2.7);
  station('copper',second,gear,'长针开始带动钟面',{kind:'ride',after:['brass']});
  tile(43,2,22,'safety-net');tile(81,8.1,19,'safety-net');
  trail([[93,18,9],[104,19,9],[115,17,9],[126,16,9]],roof);
  treasure(ledge);treasure(step);finish(base,tile(139,15,13,plank));
}
function echoGallery(p) {
  const {tile,trail,station,gated,treasure,finish}=p;
  const floor=p.contour([[0,0,13],[13,0,10],[25,0,10],[37,0,10],[49,0,10],[61,0,10],[73,0,10],[85,0,10],[97,0,10]],plank,[5, 2, -1, -4, -7, -4, -1, 2, 0]);
  const west=trail([[14,2.6],[22,5.2],[30,7.8],[38,8.6]],roof);
  const east=trail([[58,2.6],[66,5.2],[74,7.8],[82,8.6]],roof);
  // Each seed determines which of the two balconies sends the first echo.
  const [first,reply]=p.random()<.5?[west,east]:[east,west];
  station('call',first.at(-1),bell,'第一声钟响了');
  station('answer',reply.at(-1),bell,'对面传来回应',{after:['call']});
  gated([[106,2.6],[114,5.2],[122,7.8]],'answer',plank);
  treasure(west[2]);treasure(east[2]);treasure(floor[5]);finish(floor[0],tile(132,8,12,roof));
}
function belfry(p) {
  const {tile,trail,station,hand,gated,treasure,finish}=p;
  const lower=p.contour([[0,0,13],[13,0,9],[24,0,9],[35,0,9],[46,0,9],[57,0,9],[68,0,9],[79,0,9]],plank,[5, 2, -1, -4, -7, -5, -2, 0]);
  const steps=trail([[78,2.6],[70,5.2],[62,7.8],[54,10.4],[46,13]],roof);
  const arm=hand(24,13.2,14,7,2);
  station('ride',arm,gear,'转轴接上了钟绳',{kind:'ride'});
  // Return left along the high gallery, then walk across the unlocked bridge.
  tile(32,5.2,18,'safety-net');tile(22,13.2,6,plank);
  const top=tile(13,15.5,9,roof);
  station('bell',top,bell,'大钟放下了广场吊桥',{after:['ride']});
  const bridge=gated([[23,18],[32,18],[41,18],[50,18],[59,18],[68,18],[77,18],[86,17],[95,15.5]],'bell',plank);
  treasure(steps[2]);treasure(bridge[4]);finish(lower[0],tile(106,14,12,roof));
}
function clockParade(p) {
  const {tile,trail,station,hand,treasure,finish}=p;
  const roads=p.contour([[0,0,14],[13,0,9],[24,0,9],[35,0,9],[46,0,9],[57,0,9],[68,0,9],[79,0,9],[90,0,9],[101,0,9]],plank,[5, 2, -1, -4, -6, -4, -1, 2, 0, -3]);
  const steps=trail([[13,2.5],[21,5],[29,7.5]],roof);
  const arm=hand(35,7.6,14,8);
  station('pass',arm,gear,'搭针越过街巷',{kind:'ride'});
  tile(44,2.7,17,'safety-net');
  const balcony=trail([[56,11.9,10],[67,10,9],[77,8.5,8],[87,7,9],[97,6,8]],roof);
  station('flag',balcony[3],bell,'广场游行开始了',{after:['pass']});
  const shortcut=trail([[107,4.2],[116,3]],plank);
  treasure(steps[1]);treasure(roads[6]);treasure(shortcut[0]);finish(roads[0],tile(127,2,12));
}

// The ball and the child travel on independent routes. The valley follows the
// ball, the upper ridge reaches the switch before it passes the junction.
function snowChute(p, {key='ice',label,spur=false}) {
  const {tile,trail,station,run,treasure,gated,finish}=p;
  const start=tile(0,p.layered?7:4,14,'ice');
  const launch=tile(13,4,10,'ice');
  const low=p.snowbank([[18,4],[24,2],[35,0],[46,-2],[57,-3],[72,-3],[89,-3],[101,-2],[113,0],[118,1]],4.3);
  const high=[
    ...p.snowbank([[20,6.4],[28,8.3],[37,9.5],[45,10],[52,9.2]],1.6),
    ...p.snowbank([[54,9],[66,7.5],[77,6.4],[88,5],[97,4]],2)
  ];
  if (spur) station('rail',high[2],gear,'岔轨转向蓝冰窟',{goal:false});
  const points=[[13,5],[24,3],[35,1],[46,-1],[57,-2],[72,-2],[89,-2]];
  run(key,launch,points,label,spur ? {fork:4,spur:[[57,-2],[65,0],[73,2],[81,2]],switchKey:'rail'} : {});
  if (spur) {
    const secret=gated([[82,1.4,7],[91,1.8,7]],key+'-spur','ice');
    treasure(secret[0]);treasure(secret[1]);
  }
  treasure(high[4]);treasure(low[3]);
  if (p.layered) {
    const pass=trail([[123,3.5,8],[133,6.1,8],[143,8.7,9],[154,10,11]],'ice');
    finish(start,pass.at(-1));
  } else finish(start,tile(125,1,13,'ice'));
}
function starPass(p) {
  const {tile,trail,station,run,gated,treasure,finish}=p;
  const base=p.contour([[0,0,13],[13,0,10],[25,0,10],[37,0,10],[49,0,10]],'rock',[5, 2, -1, -4, -7]);
  const climb=trail([[11,2.6],[19,5.2],[27,7.8],[35,10.4],[43,13],[52,14,9]],'ice');
  run('arch',climb.at(-1),[[52,15],[64,12],[76,9],[88,6],[100,3],[110,2]],'山脚的星灯洞打开了');
  const descent=trail([[64,11,10],[76,8,10],[88,5,10],[100,2,10],[112,1,10],[124,1,10]],'ice');
  station('star',descent.at(-1),'collectible-star','带回了雪洞里的星光',{after:['arch']});
  const rise=gated([[119,3.6],[111,6.2],[103,8.8],[95,11.4],[87,14],[79,16.6]],'star','ice');
  station('beacon',rise.at(-1),'collectible-star','点亮山口的星灯',{after:['star']});
  gated([[88,19],[97,19],[106,18],[115,17],[124,16]],'beacon','ice');
  treasure(base[3]);treasure(climb[3]);treasure(rise[3]);finish(base[0],tile(135,15,12,'ice'));
}
function relay(p) {
  const {tile,trail,run,station,gated,treasure,finish}=p;
  const top=trail([[0,p.layered?7.5:4,13],[13,4,10],[25,2,10],[37,0,10],[49,-2,10],[61,-4,10],[73,-4,10]],'ice');
  run('rose',top[1],[[13,5],[25,3],[37,1],[49,-1],[61,-3],[70,-3]],'冰门打开，通往第二个雪球台');
  const shaft=gated([[76,-1.4],[68,1.2],[76,3.8],[84,6.4],[92,9],[100,11.6]],'rose','ice');
  const shelf=tile(111,12,12,'ice');
  const lower=trail([[124,10,10],[136,8,10],[148,6,10],[160,4,10],[172,2,10],[184,1,10]],'ice');
  const high=trail([[121,14.6],[129,17.2],[137,19.8],[146,20],[155,18.5],[164,17]],'rock');
  station('rail',high[1],gear,'切换了最后一道岔轨',{goal:false});
  run('blue',shelf,[[111,13],[124,11],[136,9],[148,7],[160,5],[172,3],[184,2]],'山顶哨站的通路打开了',
    {fork:3,spur:[[148,7],[159,9],[173,8]],switchKey:'rail'});
  const secret=gated([[169,6.2],[178,5.6]],'blue-spur','ice');
  treasure(shaft[3]);treasure(lower[2]);treasure(secret[0]);finish(top[0],tile(197,1,13,'ice'));
}
function glacierLake(p) {
  const {tile,trail,station,gated,treasure,finish}=p;
  const lake=trail([[0,2,14],[13,0,9],[24,-2,9],[35,-4,9],[46,-5,9],[57,-5,9],[68,-4,9],[79,-3,9],[90,-2,9],[101,0,9]],'ice');
  const ridge=trail([[14,4.5],[22,7],[30,9.5],[39,10],[48,9.3],[57,8],[66,7],[75,6],[84,5.4]],'rock');
  station('blue',lake[5],crystal,'找到湖底蓝晶');
  station('white',ridge[5],crystal,'找到山脊白晶');
  gated([[110,2.4],[118,4.8],[126,7.2]],'blue','ice');
  treasure(lake[3]);treasure(ridge[3]);finish(lake[0],tile(137,7.2,12,'ice'));
}
function penguin(p) {
  const {tile,trail,station,gated,run,treasure,finish}=p;
  const shelf=trail([[0,p.layered?7:3,14],[13,3,10],[25,2,10],[37,0,10],[49,-2,10],[61,-3,10],[73,-3,10],[85,-3,10],[97,-2,10],[109,0,10]],'ice');
  run('den',shelf[1],[[13,4],[25,3],[37,1],[49,-1],[61,-2],[73,-2],[86,-2]],'冰封的企鹅洞打开了');
  station('chick',shelf[8],'snow-lost-penguin','小企鹅跟上你了',{after:['den']});
  const ledges=trail([[108,2.6],[100,5.2],[92,7.8],[84,9.6],[75,9.6],[66,9.6],[57,9.6],[48,9.6],[39,9.6]],'rock');
  station('nest',ledges.at(-1),'snow-lost-penguin','小企鹅回到了巢里',{after:['chick']});
  const bridge=gated([[49,12.2],[58,12.4],[67,13],[76,13],[85,13.1],[94,13],[103,12.6],[112,12.2]],'nest','ice');
  treasure(bridge[4]);treasure(shelf[5]);finish(shelf[0],tile(123,12,12,'ice'));
}

function sentries(p,theme) {
  const {tile,trail,enemy,treasure,finish,room}=p;
  const path=p.contour([[0,0,14],[15,0,12],[29,1.2,12],[43,0,12],[57,0,12],[71,1.6,12],[85,0,12],[99,0,12],[113,0,12]],theme==='snow'?'ice':plank,[4, 1, -2, -5, -2, 1, 4, 1, -2]);
  const high=trail([[30,3.8],[38,6.2],[47,5],[68,4.2],[77,6.6],[86,5.2]],theme==='snow'?'rock':roof);
  for (const [i,home] of [path[1],high[0],path[3],path[5],high[4],path[7]].entries()) {
    const guard = enemy(home,theme==='snow'?['puff','snowball','jelly'][i%3]:['puff','flowerpot','jelly'][i%3]);
    if (i>=3) Object.assign(guard,{wave:1,isDormant:true});
  }
  room.waves=2;room.encounters=[{endId:path[3].id,lastWave:0},{endId:path[8].id,lastWave:1}];
  treasure(high[2]);treasure(high[4]);finish(path[0],tile(127,0,12));
}
function arena(world,stage,builder,placeBoss) {
  const p=storyRoom(world,stage,builder,stage.themeId==='snow'?'雪山守望台':'广场钟庭','boss');
  const start=p.tile(0,0,12), floor=p.tile(24,0,32,undefined,{isBossFloor:true,isOneWay:false}), exit=p.tile(49,stage.baseId?7.8:0,13,undefined,{isFinish:true});
  for (const [x,y] of [[14,2.6],[22,5.2],[33,2.6]]) p.tile(x,y,6,stage.themeId==='snow'?'ice':roof);
  if (stage.baseId) {
    p.tile(40,5.2,7,stage.themeId==='snow'?'ice':roof);
    p.tile(29,8,7,stage.themeId==='snow'?'ice':roof);
  }
  const boss=placeBoss(world,stage,p.room,floor);
  world.bossArenas.push({id:0,bossId:boss.id,floorId:floor.id,exitId:exit.id,left:floor.x-15,right:floor.x+15,y:0,layout:'platform'});
  world.supplies.push({id:'medkit:0',kind:'medkit',platformId:start.id,x:start.x+1,y:1.1});
  p.finish(start,exit);world.finish=exit;
}
export function buildStoryWorld(world,stage,builder,placeBoss) {
  world.expedition=true;
  const snow=stage.themeId==='snow';
  const chapters=snow ? [
    ['松林放雪球',p=>snowChute(p,{label:'山脚的薄冰碎开了'})],['双晶冰湖',glacierLake],
    ['岔轨雪沟',p=>snowChute(p,{spur:true,label:'雪沟出口通了'})],['冰川哨站',null],
    ['寻找小企鹅',penguin],['回望星灯岭',starPass],
    ['双崖接力',relay]
  ] : [
    ['街口学搭针',towerSchool],['屋顶与暗巷',rooftops],['双针齿轮房',twinHands],['报时街守卫',null],
    ['回声钟廊',echoGallery],['登楼放吊桥',belfry],['屋脊大巡游',clockParade]
  ];
  if (builder.random()<.5) [chapters[1],chapters[2]]=[chapters[2],chapters[1]];
  for (const [name,build] of chapters) {
    const p=storyRoom(world,stage,builder,name,build?'mechanism':'battle',build?null:'upgrade');
    if(build) build(p); else sentries(p,stage.themeId);
  }
  arena(world,stage,builder,placeBoss);
  for(const room of world.rooms.slice(0,-1)) {
    const next=world.rooms[room.id+1];
    world.doors.push({id:room.id,roomId:room.id,targetRoomId:next.id,platformId:room.exitId,offsetX:2.5,kind:next.kind,reward:next.reward});
  }
  Object.assign(world,{minX:world.rooms[0].left,maxX:world.rooms.at(-1).right,minY:Math.min(...world.rooms.map(r=>r.fallY))-3,
    maxY:Math.max(...world.rooms.map(r=>r.top))+6,requiredFlowers:0,signature:world.rooms.map(r=>r.name).join('|')+'|'+world.treasures.map(t=>t.kind).join(',')});
}
