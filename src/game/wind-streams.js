import * as THREE from 'three';
import { airParticles } from './air-particles.js';
import { hasMark } from '../../shared/trails/field-progress.js';

export function paintWind(views,r) {
  const g=views.engine;
  const arrow=new THREE.Shape();
  arrow.moveTo(-.85,-.05);arrow.quadraticCurveTo(-.4,.16,.31,.06);
  arrow.lineTo(.23,.26);arrow.lineTo(.78,.02);arrow.lineTo(.23,-.24);
  arrow.lineTo(.32,-.055);arrow.quadraticCurveTo(-.39,.07,-.85,-.05);
  const geometry=new THREE.ShapeGeometry(arrow);
  g.resources.push(geometry);
  const ink=g.material(new THREE.MeshBasicMaterial({color:0x619a8d,transparent:true,opacity:.82,depthWrite:false}));
  for(const jet of r.wind) {
    const leaves=airParticles(g,'wind',jet.x,jet.y+jet.height/2,-.6,
      {...jet,count:Math.ceil(jet.width+jet.height)});
    const direction=new THREE.Mesh(geometry,ink);
    direction.position.set(jet.x,jet.y+jet.height*.45,-.57);
    direction.rotation.z=Math.atan2(jet.dy,jet.dx);
    g.scene.add(direction);
    const sign=views.paper(jet.x,jet.y+1.1,4.2,.8,320,66);
    const destination=r.stops.find(stop=>stop.after.includes(jet.after));
    views.items.push({roomId:r.id,update:(state,here)=>{
      const on=!jet.after||hasMark(r,state.field,jet.after);
      const horizontal=Math.abs(jet.dx)>Math.abs(jet.dy);
      const hint=horizontal ? (jet.dx<0?'跳入横风 ←':'跳入横风 →') : '起跳乘上升风 ↑';
      sign.mesh.visible=here && on && (!destination || !hasMark(r,state.field,destination.key)) && Math.abs(g.players[0].x-jet.x)<14;
      if(sign.mesh.visible) sign.draw('wind',(ctx,w)=>views.text(ctx,hint,w/2,44,29,'#3b7166'));
      direction.visible=leaves.visible=here && on;
      if (leaves.visible) leaves.material.uniforms.clock.value=g.isReducedMotion ? .8 : g.elapsed;
    }});
  }
}
