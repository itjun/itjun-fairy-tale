import * as THREE from 'three';
import { trailMaterial } from './trail-art.js';
import { tideHeight } from '../../shared/trails/field-progress.js';

// Segment the crayon line at regular intervals so a long bay retains a fine rippled outline.
export function paintTide(views,room) {
  const g=views.engine,t=room.tide;
  const canvas=document.createElement('canvas');canvas.width=384;canvas.height=160;
  const c=canvas.getContext('2d');
  c.fillStyle='#8fd9e5';c.beginPath();c.moveTo(0,13);
  for(let x=0;x<=384;x+=4)c.lineTo(x,13+Math.sin(x*Math.PI/48)*3);
  c.lineTo(384,160);c.lineTo(0,160);c.fill();
  for(let i=0;i<49;i++) {
    const x=i*89%384,y=25+i*31%116;
    c.strokeStyle=i%3?'#d1f3ee':'#58adc9';c.lineWidth=i%3?2:1.5;
    c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+7,y-5,x+18,y-1);c.stroke();
  }
  c.strokeStyle='#387eaa';c.lineWidth=4;c.beginPath();
  for(let x=0;x<=384;x+=4){const y=13+Math.sin(x*Math.PI/48)*3;x?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
  tex.wrapS=THREE.RepeatWrapping;tex.repeat.x=(t.right-t.left)/17;g.textures.push(tex);
  const material=g.material(new THREE.MeshBasicMaterial({map:tex,transparent:true,opacity:.64,depthWrite:false}));
  const depth=12,mesh=g.sprite(material,(t.left+t.right)/2,t.low-depth/2,t.right-t.left,depth,-.3);
  const posts=[],skies=[];
  const sail=g.sprite(trailMaterial(g,'tidal-boat'),t.left+18,t.low+2,5,3.4,-1.45);
  const wood=trailMaterial(g,'tidal-gauge'),cloud=trailMaterial(g,'tidal-cloud');
  for(let x=t.left+6;x<t.right+20;x+=31)skies.push(g.sprite(cloud,x,t.high+7+(x%3),7,3.3,-4));
  const curtain=t.mouth?g.sprite(material,t.mouth.x,t.mouth.y+1.55,3.6,3.7,.48):null;
  for(let x=t.left+7;x<t.right;x+=36){
    const post=g.sprite(wood,x,t.low+2.5,1.65,t.high-t.low+2,-.48);
    const gauge=views.paper(x+1.25,t.high+1.4,3.2,.85,270,64);
    posts.push({post,gauge});
  }
  views.items.push({roomId:room.id,update:(_,here)=>{
    sail.visible=here;for(const sky of skies)sky.visible=here;
    if(curtain)curtain.visible=here && tideHeight(g.elapsed,t.period)>.48;
    mesh.visible=here;for(const {post,gauge} of posts){post.visible=here;gauge.mesh.visible=here;}
    if(!here)return;
    const f=tideHeight(g.elapsed,t.period);mesh.position.y=t.low+(t.high-t.low)*f-depth/2+.5;
    sail.position.set(t.left+18+Math.sin(g.elapsed*.09)*4,t.low+(t.high-t.low)*f+1.2,-1.45);
    const rising=g.elapsed%t.period<t.period/2;
    const label=f<.25?'低潮 · 露滩':f>.75?'高潮 · 乘筏':rising?'↑ 涨潮':'↓ 退潮';
    for(const {gauge} of posts)gauge.draw(label,(ctx,w)=>views.text(ctx,label,w/2,42,28,'#315e77'));
  }});
}
