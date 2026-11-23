import * as THREE from 'three';
import { hasMark } from '../../shared/trails/field-progress.js';

// Arrows are drawn in the flow itself. In reduced motion their positions stay
// fixed, so the same direction information remains available without animation.
export function paintWind(views,r) {
  const g=views.engine,canvas=document.createElement('canvas');
  canvas.width=112;canvas.height=52;
  const c=canvas.getContext('2d');
  for(let i=0;i<3;i++){
    c.strokeStyle=['#4d9990','#85bbab','#d9efe0'][i];c.lineWidth=3.5-i*.65;c.lineCap='round';
    c.beginPath();c.moveTo(5,24+i*4);c.bezierCurveTo(28,13,44,36,86,24+i*4);c.stroke();
  }
  c.strokeStyle='#4f988b';c.lineWidth=4;c.beginPath();c.moveTo(71,14);c.lineTo(89,24);c.lineTo(74,35);c.stroke();
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;g.textures.push(tex);
  const mat=g.material(new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}));
  for(const jet of r.wind) {
    const arrows=Array.from({length:Math.max(5,Math.ceil(jet.width/2.5))},()=>g.sprite(mat,jet.x,jet.y,3.2,1.65,-.74));
    const sign=views.paper(jet.x,jet.y+1.1,4.2,.8,320,66);
    views.items.push({roomId:r.id,update:(state,here)=>{
      const on=!jet.after||hasMark(r,state.field,jet.after);
      const horizontal=Math.abs(jet.dx)>jet.dy;
      sign.mesh.visible=here && Math.abs(g.players[0].x-jet.x)<14;
      sign.draw(String(on),(ctx,w)=>views.text(ctx,on?(horizontal?'跳入横风 →':'起跳乘上升风 ↑'):'风筒还没打开',w/2,44,29,on?'#3b7166':'#867063'));
      for(const [i,arrow] of arrows.entries()){
        arrow.visible=here && on;if(!arrow.visible)continue;
        const u=(i/arrows.length+(g.isReducedMotion?0:g.elapsed*.22))%1;
        const stripe=(i%3-1)*.23;
        arrow.position.set(jet.x+(horizontal?(u-.5)*jet.width:stripe*jet.width),jet.y+(horizontal?.5+stripe:u)*jet.height,-.74);
        arrow.rotation.z=Math.atan2(jet.dy,jet.dx||.01);
      }
    }});
  }
}
