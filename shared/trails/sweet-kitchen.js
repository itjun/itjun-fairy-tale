const cone='mini-cone', berry='mini-scoop-pink', milk='mini-scoop-blue', cup='mini-cup';
const names={ [cone]:'蛋筒',[berry]:'草莓球',[milk]:'蓝莓球',[cup]:'甜品杯' };

function order(p,recipe,sources,counter,options={}) {
  const label=recipe.map(icon=>names[icon]).join('＋');
  p.room.recipe='订单：'+label;
  p.prop('kitchen-counter',counter,5.6,3.8,-.8,-.1);
  recipe.forEach((icon,i)=>{
    p.station('piece'+i,sources[i],icon,'取'+names[icon],{after:i?['piece'+(i-1)]:[],carryUntil:'serve',sound:'flower'});
  });
  p.station('serve',counter,'icecream',options.label||'交给甜点柜',{after:['piece'+(recipe.length-1)],goal:true,
    received:'甜点做好了！',display:recipe,displayAfter:'serve'});
}
function pantry(p) {
  const road=p.mainTrail([[0,0,14],[19,0],[42,-1],[61,0],[78,0],[97,1]], [5, 0, -6, -3, 0, 4],[3]);
  if (p.stage.baseId) p.path([[0,5],[10,7.6],[19,10],[29,9],[37,7],[43,6]]);
  const shelf=p.path([[19,0],[31,3],[43,6],[55,7],[67,4],[78,0]]);
  p.prop('castle-cutaway',road[1],12,8.5,-5);
  order(p,[cone,berry],[road[1],shelf[3]],road[5]);
  const bridge=p.gate('serve',[[107,3],[124,5],[139,5]]);
  p.prop('castle-cutaway',road[5],10,8,-1);p.prize(shelf[2]);p.prize(bridge[1]);
  p.finish(road[0],p.tile(151,4,12));
}
function berryCellar(p) {
  const hall=p.mainTrail([[0,2,14],[22,2],[48,2],[74,2],[96,2]], [7, 2, 2, -3, 4],[2]);
  const cellar=p.path([[22,2],[36,-2],[54,-6],[75,-7],[83,-4],[73,-1],[60,2]]);
  const loft=p.path([[48,2],[38,5],[26,8],[15,10]]);
  order(p,[milk,berry],[cellar[3],loft[3]],hall[4],{label:'把果球送进冷柜'});
  p.gate('serve',[[106,4],[124,6],[139,5]]);
  p.prize(cellar[2]);p.prize(loft[2]);p.enemy(cellar[1],'jelly');p.finish(hall[0],p.tile(151,4,12));
}
function delivery(p) {
  const kitchen=p.mainTrail([[0,0,13],[18,0],[38,1],[57,2]], [-5, 0, -5, 2]);
  const upper=p.path([[18,0],[30,3],[42,6],[52,8]]);
  const car=p.move(64,2,7,98,5,{period:13,after:'serve',icon:'kitchen-cart',width:8.3,height:5,below:.18});
  const far=p.path([[105,5,12],[122,3],[139,2]]);
  order(p,[cup,milk],[kitchen[1],upper[3]],kitchen[3],{label:'给甜品车装杯'});
  p.station('ride',car,'mini-cup','随车到对岸',{after:['serve'],goal:true,atDock:1,wait:'搭上装好货的甜品车'});
  p.prop('castle-cutaway',far[2],8,7);p.prize(upper[2]);p.prize(far[1]);p.finish(kitchen[0],far[2]);
}
function wafers(p) {
  const floor=p.mainTrail([[0,1,13],[24,0],[45,-2],[69,-1],[91,1]], [6, 0, -6, -3, 1],[3]);
  const oven=p.path([[23,0],[35,3],[47,6],[59,8],[74,7]]);
  p.prop('kitchen-oven',floor[2],7,4.8,1);
  p.station('heat',floor[2],'mini-sun','点亮烤炉',{received:'饼干出炉，传送带转了'});
  const belt=p.gate('heat',[[78,7],[98,7],[118,7]],{conveyor:2.3,skin:'conveyor'});
  order(p,[cone,berry],[oven[3],belt.at(-1)],floor.at(-1));
  p.gate('serve',[[106,2],[125,4],[141,3]]);
  p.prize(oven[2]);p.enemy(floor[1],'flowerpot');p.finish(floor[0],p.tile(153,3,13));
}
function twins(p) {
  const main=p.mainTrail([[0,0,13],[19,0],[49,1],[76,0],[103,0],[125,1]], [5, 0, 7, 0, -6, 1],[2, 5]);
  const left=p.path([[19,0],[30,3],[41,6],[50,9]]);
  const right=p.path([[76,0],[86,-3],[99,-6],[112,-4],[125,1]]);
  const blueFirst=p.random()<.5;
  order(p,blueFirst?[cup,milk,berry]:[cup,berry,milk],[main[1],blueFirst?right[2]:left[3],blueFirst?left[3]:right[2]],main.at(-1));
  p.gate('serve',[[135,3],[151,5]]);p.prize(right[3]);p.prize(left[2]);p.finish(main[0],p.tile(163,5,12));
}
function banquet(p) {
  const lower=p.mainTrail([[0,0,13],[24,0],[48,-2],[72,0],[94,0]], [5, 0, -6, -2, 0],[3]);
  const upper=p.path([[24,0],[36,3],[48,6],[61,9],[76,9]]);
  const ramp=p.path([[94,0],[106,3],[118,6],[130,8]]);
  order(p,[cone,milk,berry],[lower[1],upper[4],lower[3]],ramp.at(-1),{label:'把三层甜点送上宴会桌'});
  const bridge=p.gate('serve',[[140,8],[158,8],[174,6]],{conveyor:1.6,skin:'conveyor'});
  p.prop('castle-cutaway',ramp[3],11,9);p.prize(ramp[2]);p.prize(bridge[1]);p.finish(lower[0],p.tile(187,5,13));
}
export const sweetKitchen={id:'sweet-banquet',theme:'sweet',title:'城堡甜点宴',subtitle:'按图配料，把甜点送上宴会桌',
  story:'看看订单画了什么，再到架子上取料。脚边拿到的东西会跟着你。',landmark:'castle-cutaway',
  monsters:['jelly','flowerpot','puff'],arena:'糖霜宴会厅',chapters(random){
    const middle=[['地下果窖',berryCellar],['悬空甜品车',delivery]];
    if(random()<.5)middle.reverse();
    return [['开张第一单',pantry],...middle,['城堡守卫',null],['饼干烤坊',wafers],['双塔接单',twins],['宴会总厨房',banquet]];
  }};
