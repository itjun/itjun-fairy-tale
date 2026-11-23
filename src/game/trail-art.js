import * as THREE from 'three';

const ink='#554232';
// Draw interactive equipment on transparent paper in the same heavy outline as
// the original drawings. Coordinates are shared by foreground and moving pieces.
const drawings={
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
