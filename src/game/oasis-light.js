import * as THREE from 'three';
import { hasMark } from '../../shared/trails/field-progress.js';

export function paintSunlight(views,r) {
  const g=views.engine, c=document.createElement('canvas');c.width=256;c.height=40;
  const pen=c.getContext('2d');
  for(let i=0;i<4;i++){
    pen.strokeStyle=['#f5bc48','#ffdf75','#fff2b3','#ffcf6a'][i];pen.lineWidth=4-i*.5;
    pen.beginPath();pen.moveTo(0,15+i*2);pen.bezierCurveTo(84,10+i*3,169,21+i,256,17+i*2);pen.stroke();
  }
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;g.textures.push(tex);
  const material=g.material(new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}));
  for(const ray of r.beams) {
    const dx=ray.endX-ray.x,dy=ray.endY-ray.y;
    const mesh=g.sprite(material,(ray.x+ray.endX)/2,(ray.y+ray.endY)/2,Math.hypot(dx,dy),1.4,-.9);
    mesh.rotation.z=Math.atan2(dy,dx);
    views.items.push({roomId:r.id,update(state,here){mesh.visible=here && !g.players[0].safe?.isCave && hasMark(r,state.field,ray.after);}});
  }
}
