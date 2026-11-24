const spool='platform-gear', kite='meadow-kite', tail='meadow-ribbon', vane='windmill-tall';
function wind(p,x,y,width,height,dx,dy,after) {
  (p.room.wind ||= []).push({x:p.origin+x,y,width,height,dx,dy,after});
}
function kiteStand(p,t) {p.prop('windmill-tall',t,7.7,9,-3);}
function school(p) {
  const lawn=p.mainTrail([[0,0,14],[18,0],[34,0],[52,-1],[71,0],[91,1],[109,1]], [-5, 0, 0, -5, -6, -2, 4],[4]);
  if (p.stage.baseId) p.path([[0,-5],[9,-7.6],[19,-8],[29,-5],[34,-2.5]]);
  const crest=p.path([[36,10.7,10],[54,10],[74,8],[90,6],[106,4]]);
  p.station('kite',lawn[1],kite,'取纸鸢迎风跳',{carryUntil:'perch'});
  wind(p,35,-.3,11,10,0,8,'kite');
  p.station('perch',crest[0],tail,'飞上风标台',{after:['kite'],goal:true,received:'风把纸鸢托上来了'});
  const bridge=p.gate('perch',[[118,3],[137,4],[151,2]]);
  kiteStand(p,lawn[1]);p.prize(crest[2]);p.prize(bridge[1]);p.finish(lawn[0],p.tile(163,2,12));
}
function mill(p) {
  const floor=p.mainTrail([[0,0,14],[22,0],[46,-1],[66,-2],[88,0],[110,1],[133,1]], [5, 0, -5, -2, -4, 3, 6],[5]);
  const loft=p.path([[19,0],[31,3],[43,6],[56,8]]);
  p.station('turn',floor[2],spool,'接好风车齿轮',{keep:true});
  wind(p,72,-2,13,11,1.1,8,'turn');
  const crown=p.path([[75,9.4,10],[91,11],[104,12],[119,10]]);
  p.station('flag',crown[2],tail,'在风车顶系飘带',{after:['turn'],goal:true,keep:true});
  kiteStand(p,crown[2]);p.prize(loft[3]);p.prize(crown[1]);p.enemy(floor[4],'squirrel');p.finish(floor[0],floor[6]);
}
function span(p) {
  const left=p.mainTrail([[0,2,13],[18,3],[36,4],[53,5]], [-3, 3, 7, 5]);
  const low=p.path([[16,1],[30,-2],[53,-5],[77,-5],[96,-2],[111,1]]);
  const right=p.path([[82,7,11],[102,7],[120,5],[137,3]]);
  p.station('tail',left[2],tail,'给纸鸢系长尾',{carryUntil:'land'});
  wind(p,66,2,34,7,5.8,3.4,'tail');
  p.station('land',right[0],kite,'借横风落到对岸',{after:['tail'],goal:true});
  p.prize(low[3]);p.prize(right[1]);p.finish(left[0],right[3]);
}
function relay(p) {
  const road=p.mainTrail([[0,0,13],[20,0],[40,-1],[60,0],[83,0],[105,0],[129,0],[147,1]], [5, 0, -2, -6, 2, -5, 4, 7],[4, 6]);
  const ridge=p.path([[31,9,10],[46,9],[63,7],[79,6]]);
  const high=p.path([[86,15.5,11],[103,15],[118,13],[132,10]]);
  p.station('spool',road[1],spool,'放开草坡风筒');wind(p,31,0,12,8.3,0,7.7,'spool');
  p.station('north',ridge[2],tail,'解开第二条风带',{after:['spool']});
  wind(p,84,4,13,11,1,8.4,'north');
  p.station('crest',high[1],kite,'飞越双风台',{after:['north'],goal:true});
  p.prize(ridge[1]);p.prize(high[2]);p.finish(road[0],road.at(-1));
}
function letters(p) {
  const lower=p.mainTrail([[0,1,13],[18,1],[39,-2],[61,-3],[84,-2],[105,1],[125,2],[147,2]], [6, 1, -3, -4, -6, 1, 5, 2]);
  const branch=p.path([[19,2],[31,5],[44,8],[56,9]]);
  p.station('mail',lower[3],'meadow-letter','取草地邮袋',{carryUntil:'post'});
  wind(p,63,-3,14,11,-2,7.9,'mail');
  p.station('stamp',branch[3],tail,'让风车盖个印',{reaction:'stamp',after:['mail']});
  const perch=p.path([[110,9],[125,10],[139,9]]);
  wind(p,103,0,16,9,2.4,8,'stamp');p.station('post',perch[1],'meadow-letter','送到山脊信箱',{after:['stamp'],goal:true,keep:true});
  kiteStand(p,branch[3]);p.prize(lower[4]);p.prize(perch[0]);p.finish(lower[0],lower.at(-1));
}
function skyFair(p) {
  const grass=p.mainTrail([[0,0,14],[22,0],[44,-1],[67,-2],[90,-2],[116,0],[143,1],[169,2]], [-5, 0, -3, -6, -1, -5, 4, 8],[3, 6]);
  const cliff=p.path([[31,10,11],[49,10],[64,8]]);
  const east=p.path([[88,9,11],[104,8],[121,8]]);
  const top=p.path([[139,17,11],[155,16],[171,15],[187,13]]);
  p.station('sail',grass[1],kite,'带纸鸢去风节',{carryUntil:'fly'});
  wind(p,30,0,12,9.4,0,8,'sail');p.station('blue',cliff[1],tail,'收起蓝飘带',{reaction:'unfold',after:['sail']});
  wind(p,76,3,30,9,5.6,3.5,'blue');p.station('red',east[1],'mini-gem-orange','点亮东风旗',{after:['blue']});
  wind(p,132,6,16,10,2.2,8.3,'red');p.station('fly',top[1],kite,'放飞风节大纸鸢',{after:['red'],goal:true,keep:true});
  kiteStand(p,top[1]);p.prize(east[0]);p.prize(top[2]);p.finish(grass[0],top[3]);
}
export const kiteMeadow={id:'meadow-kite-post',theme:'meadow',title:'借风送信',subtitle:'迎风起跳，给风车山脊送信',story:'找到飘动的风带，跳进去。纸鸢会带你飞到高处，也能顺横风飞过草沟。',landmark:vane,
  monsters:['squirrel','dandelion','leaf'],arena:'风车庆典台',chapters(random){
    const middle=[['风车机房',mill],['横风草沟',span]];if(random()<.5)middle.reverse();
    return [['试飞草坡',school],...middle,['牧场哨口',null],['双风台接力',relay],['草地邮局',letters],['山脊风节',skyFair]];
  }};
