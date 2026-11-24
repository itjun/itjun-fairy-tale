const jug='oasis-jug', mirror='oasis-mirror', basin='oasis-well';
const sand={skin:'sand'};

function traversal(p) {
  return p.room.traversal ||= {name:p.room.name,hint:'朝彩色石头跳，抓住后往上爬。到神灯下，向上进洞',walls:[],grips:[],art:[]};
}
function cliff(p,base,x,height) {
  const summit=p.tile(x,height,8,sand), route=traversal(p);
  const face=summit.x-summit.width/2-.18;
  route.walls.push({x:face,minY:base.y+.16,maxY:height-.55,side:-1,topId:summit.id,isNatural:true});
  route.art.push({image:'desert-cliff',x:summit.x,y:(height+base.y)/2-.24,width:8.8,height:height-base.y+.4});
  return summit;
}
function springCave(p,mouth1,mouth2,name) {
  const route=traversal(p), id='spring:'+p.id;
  const extra={skin:'cave-stone',isCave:true,caveId:id};
  const x=mouth1.x-p.origin, floor=-41;
  const ledges=p.path([[x,floor+5],[x+10,floor+2],[x+22,floor],[x+36,floor+1],[x+50,floor+4],[x+63,floor+6]],extra);
  const upper=p.path([[x+17,floor+5],[x+27,floor+7.5],[x+39,floor+7]],extra);
  const first=ledges[0],last=ledges.at(-1);
  const portal=(a,b,dir,label)=>({platformId:a.id,x:a.x,targetId:b.id,targetX:b.x+dir*1.7,direction:dir,label});
  route.cave={id,name,floorY:floor,left:first.x-first.width/2,right:last.x+last.width/2,
    pathIds:ledges.map(t=>t.id),branchIds:upper.map(t=>t.id),
    mouths:[portal(mouth1,first,1,'进入'+name),portal(mouth2,last,-1,'进入'+name),portal(first,mouth1,-1,'回到沙丘'),portal(last,mouth2,1,'回到绿洲')]};
  for(const t of [mouth1,mouth2,first,last])route.art.push({image:'desert-cave-mouth',x:t.x,y:t.y+2,width:5,height:4,caveId:t.caveId});
  route.art.push({image:'desert-cave-pool',x:ledges[2].x,y:floor-.6,width:17,height:3.3,caveId:id});
  p.prize(upper[1]);return {well:ledges[2],upper:upper[2]};
}
function lightBridge(p,key,from,to,label,options={}) {
  p.station(key,from,mirror,label,{keep:true,received:'光桥亮了，走上去吧！',...options,lightTargetId:to.id});
}

// 光桥排在原地图的平台后面，旧存档的落脚点和机关编号继续有效。
function addLightBridges(world,builder) {
  for (const room of world.rooms) for (const stop of room.stops) {
    if (stop.lightTargetId === undefined) continue;
    const from = world.platforms[stop.platformId], to = world.platforms[stop.lightTargetId];
    const high = from.y > to.y ? from : to;
    const low = high === from ? to : from;
    const downhill = Math.sign(low.x - high.x);
    const startX = high.x + downhill * high.width / 2;
    const endX = low.x, endY = low.y;
    const platform = builder.add((startX + endX) / 2, (high.y + endY) / 2, Math.abs(endX - startX), {
      roomId:room.id, zone:room.depth, progress:room.depth, skin:'sunlight',
      slope:(endY - high.y) / (endX - startX), fieldGate:stop.key, lightTopId:high.id, isEnabled:false,
    });
    room.platformIds.push(platform.id);
  }
}
function path(p,nodes) {return p.path(nodes,sand);}
function jugAt(p,t,dep,deliver,label='装满一壶泉水') {
  p.station('water',t,jug,label,{after:dep,carryUntil:deliver});
}
function altar(p,t,dep,label) {
  p.station('pour',t,basin,label,{after:dep,goal:true,keep:true,received:'水渠有水了！'});
  p.prop('oasis-palm',t,7.4,7.8,3);
  p.room.props.at(-1).after='pour';
}
function first(p) {
  const dune=path(p,[[0,0,14],[18,0],[38,0,11],[61,-1],[85,0],[108,1],[134,1]]);
  const top=cliff(p,dune[2],44,12), ledge=path(p,[[56,12],[72,10],[88,7],[100,5]]);
  lightBridge(p,'lens',top,dune[4],'爬上岩柱转日镜',{hint:'朝岩壁起跳，再向上爬到日镜'});
  jugAt(p,dune[4],['lens'],'pour','沿光找到泉眼装水');
  altar(p,dune[6],['water'],'浇开驿站的棕榈');p.prize(ledge[1]);
  p.gate('pour',[[146,3],[158,4]]);p.finish(dune[0],p.tile(171,4,12,sand));
}
function underground(p) {
  const road=path(p,[[0,1,13],[22,1],[42,-1],[68,0],[93,1],[116,1],[141,2]]);
  const cave=springCave(p,road[1],road[4],'蓝泉岩洞');
  p.station('map',road[1],'oasis-map','看看神灯旁的水纹',{keep:true});
  jugAt(p,cave.well,['map'],'pour');altar(p,road[5],['water'],'把洞泉送进石槽');
  p.prize(road[3]);p.finish(road[0],road[6]);
}
function mirrors(p) {
  const low=path(p,[[0,0,14],[23,0],[39,0,11],[61,-1],[80,0,11],[103,0],[126,2],[150,2]]);
  const west=cliff(p,low[2],45,11),east=cliff(p,low[4],86,14);
  lightBridge(p,'west',west,east,'让西镜照向东岩');
  lightBridge(p,'east',east,low[5],'对准谷底的蓄水池',{after:['west']});
  jugAt(p,low[5],['east'],'pour');
  altar(p,low[6],['water'],'灌满小绿洲');p.prize(p.tile(104,12,8,sand));p.finish(low[0],low[7]);
}
function shaduf(p) {
  const sandbank=path(p,[[0,1,13],[22,1],[44,-2],[63,-3],[86,-2],[111,0],[139,2],[160,2]]);
  const post=cliff(p,sandbank[2],50,10);
  p.station('weight',post,'platform-gear','在提水架挂上配重',{keep:true});
  jugAt(p,sandbank[3],['weight'],'pour','到河床把水罐装满');
  const lift=p.move(79,-2,8,88,11,{period:10,after:'water',icon:'oasis-bucket',width:8,height:3.6});
  p.station('rise',lift,'oasis-bucket','乘提水斗上高渠',{after:['water'],atDock:1,wait:'站在水斗上等它升高'});
  const banks=path(p,[[98,11],[114,10],[130,9],[146,6]]);
  altar(p,banks[2],['rise'],'把水倒入高渠');p.prize(banks[1]);p.finish(sandbank[0],sandbank[7]);
}
function carved(p) {
  const road=path(p,[[0,0,13],[23,1],[41,2],[65,1],[91,0],[115,0,11],[140,1],[163,2]]);
  const cave=springCave(p,road[2],road[4],'壁画暗河');
  p.station('star',cave.upper,'oasis-map','在洞顶拓下水纹',{carryUntil:'read'});
  p.station('read',cave.well,basin,'按水纹找到暗泉',{after:['star']});
  const top=cliff(p,road[5],121,13);
  lightBridge(p,'mirror',top,road[7],'登上岩台照亮出口',{after:['read'],goal:true});
  p.prize(road[3]);p.finish(road[0],road[7]);
}
function caravan(p) {
  const road=path(p,[[0,0,14],[19,0],[37,0,11],[60,1],[85,1],[110,-1],[133,0,11],[155,0],[177,2]]);
  const top=cliff(p,road[2],43,13),cave=springCave(p,road[3],road[5],'最后的泉室');
  lightBridge(p,'look',top,road[3],'用镜子找神灯',{hint:'爬到高台的镜子旁'});
  jugAt(p,cave.well,['look'],'pour');
  const waterTower=cliff(p,road[6],139,13);
  altar(p,waterTower,['water'],'给驼队打开引水闸');
  p.gate('pour',[[151,13],[164,11],[178,9],[191,6]]);
  p.prize(road[7]);p.finish(road[0],p.tile(203,5,12,sand));
}
export const oasisSprings={id:'desert-oasis-springs',theme:'desert',title:'攀岩寻泉',subtitle:'爬上日镜岩，钻进暗河，把水带回绿洲',
  story:'岩壁上有可以抓的凸石。爬上高台，看看镜子把阳光照到哪里。洞口挂着金色的神灯，走进去找泉水吧。',landmark:'oasis-palm',
  finishWorld:addLightBridges,monsters:['sandcastle','burrow','crab'],arena:'绿洲泉门',chapters(random){
    const middle=[['跟着神灯找泉水',underground],['日镜峡谷',mirrors]];if(random()<.5)middle.reverse();
    return [['日镜驿站',first],...middle,['商路哨口',null],['古井提水架',shaduf],['暗河水纹',carved],['驼队引水渠',caravan]];
  }};
