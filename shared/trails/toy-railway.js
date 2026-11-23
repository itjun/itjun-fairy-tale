const gift='rail-parcel',train='rail-engine',lever='rail-switch',gear='platform-gear';
function track(p,key,points,options={}) {
  // Keep the carriage roof above the station platform so it stays rideable.
  points=points.map(([x,y])=>[x,y+1.65]);
  const [x,y]=points[0],[endX,endY]=points.at(-1);
  const boarded=key+'-board',arrived=key+'-arrive';
  const t=p.move(x,y,8,endX,endY,{period:options.seconds||11,once:true,after:boarded,icon:train,width:9.6,height:5.8,below:.75,
    rail:points.map(([x,y])=>[p.origin+x,y]),
    ...(options.alt?{alt:options.alt.map(([x,y])=>[p.origin+x,y+1.65]),switchKey:options.switchKey}:{}),
    ...(options.hold?{hold:options.hold,unlock:key+'-restart'}:{})});
  p.station(boarded,t,'rail-ticket','上车发车',{after:options.after||[],atDock:0,size:1.45,received:'小火车出发了'});
  if(options.hold) {
    p.station(key+'-stop',t,'rail-signal','跟车到检修站',{after:[boarded],atDock:options.hold,wait:'坐到红灯前'});
    options.service(p,key+'-stop');
    p.station(key+'-restart',t,'rail-ticket','修好后回车上',{after:[key+'-fix'],atDock:options.hold,wait:'登车继续送货'});
  }
  p.station(arrived,t,'rail-signal','在目的站下车',{after:[options.hold?key+'-restart':boarded],atDock:1,wait:'乘车到站，沿轨道前进',goal:true,received:'到站了！'});
  return arrived;
}
function station(p,t) {p.prop('rail-depot',t,9,6.5);}
function first(p) {
  const floor=p.path([[0,0,13],[20,0],[41,-2],[64,-3],[87,-1],[108,1],[131,1]]);
  const dock=p.path([[16,1],[28,3],[39,4]]);
  p.station('parcel',dock[1],gift,'领取玩具包裹',{carryUntil:'send'});
  const end=track(p,'mail',[[41,4],[58,5],[79,7],[95,5]],{after:['parcel']});
  const top=p.path([[101,5,10],[117,5],[132,3]]);
  p.station('send',top[1],gift,'把包裹送到站房',{after:[end],goal:true,keep:true});station(p,dock[1]);station(p,top[1]);
  p.prize(floor[3]);p.finish(floor[0],p.tile(146,2,12));
}
function switches(p) {
  const road=p.path([[0,1,13],[22,1],[48,-1],[73,-3],[100,-1],[128,1]]);
  const cabin=p.path([[18,1],[29,4],[39,6],[48,7]]);
  p.station('spur',cabin[2],lever,'扳岔上观景轨',{optional:true,keep:true,received:'岔道已指向高轨'});
  const end=track(p,'fork',[[53,4],[63,4],[75,2],[92,2],[109,5]],{switchKey:'spur',alt:[[53,4],[63,4],[75,9],[92,9],[109,5]]});
  const balcony=p.tile(82,11.8,9);p.prize(balcony);
  const finish=p.path([[116,5,11],[136,5],[153,3]]);
  p.station('stamp',finish[1],gift,'盖上货运章',{after:[end],goal:true});station(p,finish[1]);p.prize(road[3]);
  p.finish(road[0],finish[2]);
}
function bridge(p) {
  const low=p.path([[0,0,13],[22,0],[46,-1],[66,-3],[81,-4],[99,-2],[119,1],[144,1]]);
  const deck=p.path([[15,1],[27,4],[42,5]]);
  const middle=p.path([[74,4,10],[85,2],[94,-1]]);
  const dock=track(p,'repair',[[42,5],[61,5],[78,5],[97,6],[114,6]],{hold:.5,service(q,stop){
    q.station('wheel',low[4],gear,'到桥下取齿轮',{after:[stop],carryUntil:'repair-fix'});
    q.station('repair-fix',middle[0],lever,'装齿轮接好吊桥',{after:['wheel'],keep:true});
  }});
  const far=p.path([[121,6,12],[136,6],[151,4]]);
  p.station('sign',far[1],'rail-signal','点亮过桥信号',{after:[dock],goal:true});p.prize(deck[1]);p.prize(low[5]);
  p.finish(low[0],far[2]);
}
function depot(p) {
  const floor=p.path([[0,0,14],[23,0],[46,-1],[69,-3],[92,-3],[115,-1],[139,1],[157,2]]);
  const roof=p.path([[21,0],[34,3],[48,6],[61,8]]);
  const out=track(p,'out',[[40,3],[62,3],[86,4],[107,3]],{});
  p.station('box',floor[5],gift,'去地库接玩具熊',{after:[out],carryUntil:'home'});
  const back=track(p,'back',[[111,5],[89,8],[66,9],[47,9]],{after:['box']});
  p.station('home',roof[3],gift,'把小熊送回老站',{after:[back],goal:true});
  p.gate('home',[[72,8],[96,8],[120,7],[144,4]]);station(p,roof[3]);p.prize(floor[3]);p.finish(floor[0],floor.at(-1));
}
function crane(p) {
  const street=p.path([[0,1,13],[21,1],[44,-2],[70,-2],[94,0],[119,1],[144,2]]);
  const loft=p.path([[21,1],[31,4],[44,7],[57,10]]);
  p.station('winch',loft[3],gear,'操纵吊机放下货箱',{keep:true});
  const hoist=p.move(68,0,8,68,9,{period:8,after:'winch',icon:gift,width:7,height:3.5});
  p.station('load',hoist,gift,'搭货箱上装车台',{after:['winch'],atDock:1,wait:'乘吊机升到栈桥'});
  const end=track(p,'crane',[[79,9],[93,10],[109,9],[123,7]],{after:['load']});
  const last=p.path([[130,7],[145,6],[158,4]]);
  p.station('unload',last[1],gift,'到积木镇卸货',{after:[end],goal:true});station(p,last[1]);p.prize(loft[2]);p.finish(street[0],last[2]);
}
function express(p) {
  const road=p.path([[0,1,13],[22,1],[49,-2],[75,-3],[101,-2],[127,0],[154,2],[181,3]]);
  const platform=p.path([[16,1],[28,4],[42,6]]);
  p.station('parcel',platform[1],gift,'装上庆典礼物',{carryUntil:'party'});
  const first=track(p,'local',[[41,5],[62,6],[82,5],[97,5]],{after:['parcel']});
  const cabin=p.path([[103,5],[114,8],[123,10]]);
  p.station('switch',cabin[1],lever,'扳动换乘信号',{after:[first],keep:true});
  const second=track(p,'express',[[124,9],[140,12],[158,11],[172,9]],{after:['switch']});
  const end=p.path([[179,9],[194,8],[209,6]]);
  p.station('party',end[1],gift,'送达庆典总站',{after:[second],goal:true,keep:true});
  station(p,platform[1]);station(p,end[1]);p.prize(cabin[2]);p.finish(road[0],end[2]);
}
export const toyRailway={id:'cartoon-toy-rail',theme:'cartoon',title:'玩具列车',subtitle:'扳岔道、修轨桥，把礼物送往积木镇',story:'列车会在站台等你。跳上车顶出发，看见岔道可以先下车扳一下。',landmark:'rail-depot',
  monsters:['toy','bell','puff'],arena:'积木总站',chapters(random){
    const middle=[['高低分轨',switches],['红灯检修桥',bridge]];if(random()<.5)middle.reverse();
    return [['玩具邮车',first],...middle,['货场守卫',null],['往返老车站',depot],['吊机装车台',crane],['庆典双车接力',express]];
  }};
