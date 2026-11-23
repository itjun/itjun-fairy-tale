import * as THREE from 'three';
import { selectedRail } from '../../shared/trails/railway.js';

// Each route is a single paper strip, including both rails and the sleepers.
export function paintTracks(views,room) {
  const g=views.engine;
  for (const rail of room.moving.filter(m=>m.rail)) {
    for (const points of [rail.rail,rail.alt].filter(Boolean)) {
      const left=Math.min(...points.map(p=>p[0]))-.8, right=Math.max(...points.map(p=>p[0]))+.8;
      const bottom=Math.min(...points.map(p=>p[1]))-3.4, top=Math.max(...points.map(p=>p[1]))-1.4;
      const canvas=document.createElement('canvas'), scale=20;
      canvas.width=Math.ceil((right-left)*scale);canvas.height=Math.ceil((top-bottom)*scale);
      const c=canvas.getContext('2d');
      const xy=([x,y])=>[(x-left)*scale,(top-y+2.48)*scale];
      const nodes=points.map(xy);
      function stroke(line,color,width) {
        c.beginPath();line.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));
        c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();
      }
      for(let i=1;i<nodes.length;i++) {
        const [x,y]=nodes[i-1],[ex,ey]=nodes[i],n=Math.ceil(Math.abs(ex-x)/26);
        for(let j=0;j<n;j++){const u=j/n,s=x+(ex-x)*u,t=y+(ey-y)*u;stroke([[s-4,t-7],[s+4,t+7]],'#946f4d',5);}
      }
      for(const dy of [-4,4])stroke(nodes.map(([x,y])=>[x,y+dy]),points===rail.alt?'#8b6177':'#585c68',3.3);
      const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;g.textures.push(tex);
      const mat=g.material(new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}));
      const mesh=g.sprite(mat,(left+right)/2,(top+bottom)/2,right-left,top-bottom,-.44);
      views.items.push({roomId:room.id,update(state,here){
        mesh.visible=here;
        if(here)mat.opacity=selectedRail(room,rail,state.field)===points?1:.42;
      }});
    }
  }
}
