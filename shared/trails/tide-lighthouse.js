const shell='collectible-shell',lamp='mini-sun',raft='platform-raft',wick='mini-sprout',lens='mini-gem-blue';
function bay(p,start,end,low=-3.9,high=2.5) {
  p.room.tide={left:p.origin+start,right:p.origin+end,low,high,period:12};
}
function low(p,key,tile,icon,label,options={}) {
  return p.station(key,tile,icon,label,{tide:'low',wait:'看水尺，退潮时走到这里',...options});
}
function light(p,key,tile,label,after) {
  p.prop('island-lighthouse',tile,9,9.5,1);
  p.station(key,tile,lamp,label,{after,reaction:'beam',goal:true,keep:true,received:'灯亮了，回头看看海面'});
}
function inlet(p) {
  bay(p,4,104);
  const shore=p.mainTrail([[0,3,14],[16,3],[29,0],[41,-2],[59,-2],[74,0],[91,3],[106,4]], [8, 3, 0, -4, -6, -2, 3, 6]);
  if (p.stage.baseId) p.path([[0,8],[10,10.6],[20,11],[29,8.5],[39,8]]);
  const bluff=p.path([[16,3],[26,6],[39,8],[55,8],[67,5]]);
  low(p,'shell',shore[3],shell,'退潮捡到潮纹贝',{carryUntil:'beacon'});
  light(p,'beacon',shore[7],'把贝壳挂到岸灯',['shell']);
  const bridge=p.gate('beacon',[[116,5],[135,5],[149,4]],{skin:'plank'});
  p.prize(bluff[2]);p.prize(bridge[1]);p.finish(shore[0],p.tile(161,4,13));
}
function wharf(p) {
  bay(p,17,96,-3,4);
  const jetty=p.mainTrail([[0,2,14],[18,2],[36,1],[52,0]], [7, 2, -3, 0]);
  p.station('rope',jetty[2],'bridge-rope','解开系筏绳');
  const boat=p.move(59,0,8,78,8,{period:12,tide:true,after:'rope',icon:raft,width:8,height:1.5,below:.5});
  p.station('cross',boat,shell,'乘潮到高码头',{after:['rope'],atDock:1,wait:'站稳木筏，跟着水位上升',goal:true});
  const cliff=p.path([[87,8,12],[104,10],[125,9],[144,6]]);
  light(p,'lamp',cliff[2],'点亮码头灯',['cross']);
  p.prize(cliff[1]);p.finish(jetty[0],cliff[3]);
}
function glassCove(p) {
  bay(p,7,115,-6,1);
  const upper=p.mainTrail([[0,4,14],[24,4],[49,5],[72,4],[98,5],[122,4],[144,4]], [9, 4, 8, 10, 5, -1, 5],[3]);
  const pools=p.path([[24,4],[36,1],[49,-2],[62,-5],[75,-5],[88,-2],[98,5]]);
  low(p,'glass',pools[3],lens,'从潮池取蓝镜片',{carryUntil:'focus'});
  const arch=p.path([[98,5],[86,8],[74,11],[62,13]]);
  p.station('focus',arch[3],lamp,'镜片对准灯座',{after:['glass'],reaction:'beam',goal:true,keep:true});
  p.gate('focus',[[72,13],[92,13],[111,11],[130,8]],{skin:'plank'});
  p.prize(arch[1]);p.prize(pools[4]);p.enemy(upper[4],'jelly');p.finish(upper[0],upper[6]);
}
function cave(p) {
  if (p.stage.baseId) {
    bay(p,13,120,-9,3);
    const shore=p.path([[0,8,14],[16,5],[28,2],[40,-1],[52,-4],[64,-7],[80,-8]],{skin:'rock'});
    const rim=p.path([[0,8],[9,10.6],[18,13.2],[28,12],[39,9],[47,6],[55,3],[61,0],[67,-3]],{skin:'rock'});
    p.prize(rim[3]);
    const climb=p.path([[80,-8],[91,-5],[102,-2],[113,1],[107,4],[97,7],[86,10]]);
    p.room.tide.mouth={x:shore[3].x,y:shore[3].y};
    p.prop('desert-cave-mouth',shore[3],6,5);
    low(p,'wick',shore.at(-1),wick,'退潮取洞中灯芯',{carryUntil:'home'});
    p.move(70,-7,8,76,9,{period:12,tide:true,after:'wick',icon:raft,height:1.6});
    const tower=p.path([[86,10],[75,12],[63,14],[50,15]]);
    light(p,'home',tower.at(-1),'带灯芯回到旧灯塔',['wick']);
    const bridge=p.gate('home',[[60,18],[75,18],[92,16],[109,13],[126,11]],{skin:'plank'});
    p.prize(climb[2]);p.prize(tower[2]);p.finish(shore[0],bridge.at(-1));
    return;
  }
  bay(p,17,124,-6,2.5);
  const beach=p.mainTrail([[0,3,14],[21,3],[44,3],[65,4],[89,4],[111,4],[136,3]], [9, 3, 7, 4, 9, 4, 8],[2, 4]);
  const cave=p.path([[21,3],[33,0],[45,-3],[60,-5],[82,-5],[94,-3],[111,4]],{skin:'rock'});
  p.room.tide.mouth={x:cave[2].x,y:cave[2].y};
  p.prop('desert-cave-mouth',cave[2],6,5);
  low(p,'wick',cave[4],wick,'退潮取洞中灯芯',{carryUntil:'home'});
  const high=p.path([[65,4],[53,7],[40,10],[26,11]]);
  light(p,'home',high[3],'带灯芯回到旧灯塔',['wick']);
  p.gate('home',[[37,12],[58,12],[78,10],[100,8],[122,5]],{skin:'plank'});
  p.prize(cave[3]);p.prize(high[2]);p.finish(beach[0],beach[6]);
}
function buoys(p) {
  bay(p,2,139,-4,3);
  const bottom=p.mainTrail([[0,1,14],[18,-1],[37,-2],[56,-2],[76,-1],[94,-2],[116,-1],[137,1],[151,3]], [6, -1, -4, 1, -4, -2, 3, -1, 5]);
  const a=p.move(43,-1,7,43,6,{period:12,tide:true,icon:raft,height:1.6});
  const b=p.move(98,-1,7,98,7,{period:12,tide:true,icon:raft,height:1.6});
  p.station('west',a,'mini-gem-orange','举起西边浮标旗',{reaction:'flag',atDock:1,wait:'搭浮标升到水线顶'});
  low(p,'note',bottom[4],shell,'退潮取漂流信',{after:['west'],carryUntil:'east'});
  p.station('east',b,'mini-gem-blue','把信交给东浮标',{atDock:1,after:['note'],wait:'乘东浮标到高处',goal:true});
  p.prize(bottom[2]);p.prize(bottom[6]);p.finish(bottom[0],bottom[8]);
}
function lantern(p) {
  bay(p,6,135,-5,4);
  const sand=p.mainTrail([[0,2,14],[20,1],[38,-2],[56,-4],[73,-3],[90,-1],[110,1],[130,2]], [7, 1, -3, -6, -2, -5, 1, 5],[5]);
  const ridge=p.path([[20,1],[32,4],[44,7],[57,9],[72,9],[87,6],[100,4]]);
  low(p,'oil',sand[3],'mini-cup','装一杯灯油',{carryUntil:'lit'});
  p.station('lens',ridge[4],lens,'取下灯塔透镜',{after:['oil'],carryUntil:'lit'});
  const boat=p.move(116,1,9,132,9,{period:12,tide:true,after:'lens',icon:raft,height:1.65});
  p.station('up',boat,'mini-gem-orange','从船头登上灯廊',{atDock:1,after:['lens'],wait:'在船头等涨潮'});
  const top=p.path([[142,9,13],[156,11],[173,12]]);
  light(p,'lit',top[1],'点亮远航灯',['up']);p.prize(ridge[3]);p.finish(sand[0],top[2]);
}
export const tideLighthouse={id:'beach-tide-lights',theme:'beach',title:'潮汐灯塔',subtitle:'退潮进洞，涨潮乘筏，把灯芯送回海岬',
  story:'看岸边的水尺。海水退下会露出贝壳，涨起来会把木筏送到高处。',landmark:'island-lighthouse',
  monsters:['crab','fish','sandcastle'],arena:'岬角灯塔',chapters(random){
    const middle=[['潮汐码头',wharf],['蓝镜潮池',glassCove]];if(random()<.5)middle.reverse();
    return [['初见潮纹',inlet],...middle,['礁石哨口',null],['灯芯海蚀洞',cave],['双浮标传信',buoys],['远航灯廊',lantern]];
  }};
