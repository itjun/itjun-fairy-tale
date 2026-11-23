import * as THREE from 'three';

const ink='#554232';
// Draw interactive equipment on transparent paper in the same heavy outline as
// the original drawings. Coordinates are shared by foreground and moving pieces.
const drawings={
  'rail-engine'(a) {
    a.box(18,57,53,44,'#63aebc');a.box(14,48,62,12,'#de786c');a.box(28,64,28,21,'#ffe398');
    a.poly([[72,92],[72,71],[85,57],[139,57],[154,70],[154,94]],'#76b6a0');
    a.line([[17,51],[179,51]],'#997250',5);
    a.box(123,36,16,25,'#966951');a.box(116,29,30,10,'#ed9f68');
    a.box(17,91,143,12,'#e5b76f');a.poly([[155,83],[183,108],[157,107]],'#e88d7a');
    for(const x of [40,83,130]){a.circle(x,109,15,'#ba665f');a.circle(x,109,6,'#ffe2a1');}
    a.line([[41,108],[127,110]],'#735b65',4);
  },
  'rail-parcel'(a) {
    a.poly([[41,50],[97,27],[155,43],[103,67]],'#fbd28b');
    a.poly([[42,50],[103,67],[104,120],[44,99]],'#eaa767');
    a.poly([[103,67],[155,43],[155,100],[104,120]],'#d79870');
    a.line([[72,39],[129,56],[130,109]],'#8ab4a0',10);
    a.line([[67,68],[82,72],[82,84],[67,80]],'#f8ebd0',4);
  },
  'rail-ticket'(a) {
    a.poly([[30,50],[148,27],[164,91],[48,113]],'#ffdb8f');
    a.line([[58,62],[126,48]],'#b56465',5);a.line([[64,79],[106,70]],'#80727a',4);
    a.circle(131,79,8,'#81b7ac');
  },
  'rail-depot'(a) {
    a.box(40,52,116,74,'#f5cd80');a.poly([[21,57],[93,15],[174,54],[168,61],[28,64]],'#c8676b');
    a.box(57,80,24,33,'#8cc0c5');a.box(98,82,30,44,'#ac8068');a.circle(95,46,12,'#fff3bb');
    a.line([[94,39],[95,46],[101,48]],'#795156',2.4);a.box(29,123,144,7,'#bb907f');
  },
  'rail-switch'(a) {
    a.box(36,105,113,16,'#9aab94');a.line([[90,107],[122,44]],'#704f47',10);
    a.circle(125,37,15,'#e88370');a.circle(87,103,11,'#edbf73');
  },
  'rail-signal'(a) {
    a.box(91,66,12,59,'#a5826b');a.box(72,20,52,63,'#6e777b');
    a.circle(98,38,10,'#e79282');a.circle(98,65,10,'#98c98b');
  },
  'tidal-boat'(a) {
    a.poly([[19,95],[173,94],[147,115],[48,115]],'#d39869');
    a.line([[96,95],[96,17]]);a.poly([[90,22],[51,83],[91,82]],'#f3cc85');
    a.poly([[102,35],[102,83],[150,83]],'#e59e98');
  },
  'meadow-kite'(a) {
    a.poly([[99,11],[166,51],[101,108],[35,53]],'#f7cd71');
    a.poly([[99,11],[101,62],[35,53]],'#ee9c98');a.poly([[166,51],[101,108],[101,62]],'#76b9bc');
    a.line([[101,108],[107,117],[97,126],[102,134]],'#885451',2.6);
    a.poly([[96,117],[106,120],[115,113],[114,125],[104,121],[97,126]],'#d387b4');
  },
  'meadow-ribbon'(a) {
    a.line([[47,117],[49,23]],'#765541',7);
    a.poly([[49,24],[85,19],[113,30],[148,22],[168,31],[145,46],[156,54],[117,62],[85,50],[50,52]],'#76bcae');
    a.line([[57,33],[83,30],[112,43],[139,34]],'#ebedb7',4);
  },
  'meadow-letter'(a) {
    a.poly([[25,37],[164,29],[174,103],[38,112]],'#ffe9b2');
    a.line([[27,40],[91,78],[164,33]]);a.line([[39,107],[74,72]]);a.line([[168,103],[122,71]]);
    a.circle(105,75,10,'#dc8280');
  },
  'tidal-gauge'(a) {
    a.box(69,5,62,129,'#fff4c9');
    for(let i=0;i<5;i++){a.box(70,9+i*24,22,10,i%2?'#e99b60':'#cb696e');a.line([[97,16+i*24],[124,16+i*24]],ink,2);}
  },
  'tidal-cloud'(a) {
    a.poly([[15,99],[12,84],[21,68],[44,64],[47,48],[60,37],[79,39],[92,45],[101,29],[119,21],[140,23],[151,33],[157,53],[171,58],[181,71],[185,88],[174,100],[140,104],[102,101],[72,106],[44,101]],'#d5eaf2');
  },
  'kitchen-oven'(a) {
    a.poly([[29,118],[29,74],[40,48],[61,34],[95,29],[128,34],[150,51],[162,78],[163,119]],'#e79c70');
    a.box(119,15,18,27,'#cb7759');a.box(115,10,26,9,'#ecc7a4');
    a.poly([[58,108],[59,77],[70,60],[97,55],[119,63],[132,78],[133,109]],'#6c4c4b');
    a.poly([[73,102],[81,83],[89,92],[100,68],[104,85],[112,79],[122,101]],'#ffb744');
    a.line([[35,67],[50,69],[57,57]]);a.line([[40,88],[54,89]]);a.line([[143,69],[156,72]]);
    a.box(20,112,151,15,'#dbb581');a.box(36,127,14,8,'#916454');a.box(143,125,13,10,'#916454');
  },
  'kitchen-cart'(a) {
    a.circle(50,116,14,'#704b4c');a.circle(149,116,14,'#704b4c');
    a.circle(50,116,6,'#ffe7a3');a.circle(149,116,6,'#ffe7a3');
    a.poly([[23,73],[182,73],[173,104],[33,104]],'#f8b7bd');a.line([[35,85],[168,85]],'#fff2bd',6);
    a.box(23,65,159,10,'#ffdb94');a.line([[34,64],[34,46],[20,46]]);
  },
  'kitchen-counter'(a) {
    a.box(26,60,151,59,'#b48b77');a.box(19,53,166,14,'#fae1a1');
    for(let i=0;i<5;i++)a.poly([[28+i*29,69],[54+i*29,69],[54+i*29,86],[42+i*29,92],[28+i*29,85]],i%2?'#ffe2ac':'#ec8ba0');
    a.line([[38,119],[38,131]]);a.line([[165,119],[165,131]]);
    a.circle(80,43,11,'#ffb5c7');a.circle(103,43,13,'#96d6df');a.box(62,48,56,6,'#fff1c6');
  }
};
export function trailArt(name) { return Object.hasOwn(drawings,name); }
export function trailMaterial(g,name) {
  const canvas=document.createElement('canvas');canvas.width=400;canvas.height=280;
  const ctx=canvas.getContext('2d');ctx.scale(2,2);ctx.lineJoin='round';ctx.lineCap='round';
  function path(points,fill,color=ink,width=3.6) {
    ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
    if(fill){ctx.closePath();ctx.fillStyle=fill;ctx.fill();}
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
  }
  const a={poly:(pts,c)=>path(pts,c),line:(pts,c,w)=>path(pts,null,c,w),
    box:(x,y,w,h,c)=>path([[x,y],[x+w,y+.7],[x+w-.5,y+h],[x+.7,y+h]],c),
    circle:(x,y,rad,c)=>{ctx.beginPath();ctx.ellipse(x,y,rad,rad*.98,-.08,0,Math.PI*2);ctx.fillStyle=c;ctx.fill();ctx.strokeStyle=ink;ctx.lineWidth=3.5;ctx.stroke();}};
  drawings[name](a);
  ctx.globalCompositeOperation='source-atop';
  let n=93;const rand=()=>((n=n*16807%2147483647)/2147483647);
  for(let i=0;i<2700;i++){const x=rand()*200,y=rand()*140;ctx.strokeStyle=i%5?'rgba(255,249,227,.27)':'rgba(106,76,61,.13)';ctx.lineWidth=.3+rand()*.6;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+rand()*5,y-1-rand()*3);ctx.stroke();}
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;g.textures.push(tex);
  return g.material(new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}));
}
