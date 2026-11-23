import { paintWind } from './wind-streams.js';
import { paintTide } from './tidal-water.js';
import { trailArt, trailMaterial } from './trail-art.js';
import { canUse, hasMark, fieldStopReady } from '../../shared/trails/field-progress.js';

export function fieldImages(world) {
  if(!world.field)return [];
  return [...new Set(world.rooms.flatMap(r=>[...r.stops.flatMap(s=>[s.icon,...(s.display||[])]),...r.props.map(p=>p.icon),...r.moving.map(m=>m.icon)].filter(name=>name && !trailArt(name))))];
}
export function addFieldViews(views) {
  const g=views.engine,w=g.world,materials=new Map();
  const sprite=(art,x,y,width,height,z)=>{
    if(!materials.has(art))materials.set(art,trailArt(art)?trailMaterial(g,art):g.spriteMaterial(art));
    return g.sprite(materials.get(art),x,y,width,height,z);
  };
  for(const r of w.rooms) {
    const watch=update=>views.items.push({roomId:r.id,update});
    if (r.tide) paintTide(views,r);
    if (r.wind) paintWind(views,r);
    for(const decor of r.props) {
      const obj=sprite(decor.icon,decor.x,decor.y+decor.height*.47,decor.width,decor.height,-1.7);
      watch((_,here)=>{obj.visible=here;});
    }
    for(const s of r.stops) {
      const p=w.platforms[s.platformId], size=s.size||2.25;
      const item=sprite(s.icon,p.x,p.y+size*.56,size,size,.62);
      const halo=views.glow(p.x,p.y+1);
      const sign=views.paper(p.x,p.y+size+1.22,6.2,1.02,480,78);
      const delivered=(s.display||[]).map((art,i)=>sprite(art,p.x+.94,p.y+1+i*.56,1.36,1.18,.8+i*.015));
      watch((state,here)=>{
        const marks=state.field, player=g.players[0], done=hasMark(r,marks,s.key);
        const carrying=done && s.carryUntil && !hasMark(r,marks,s.carryUntil);
        const close=here && Math.abs(player.x-p.x)<12 && Math.abs(player.y-p.y)<9;
        item.visible=here && (!done || !!carrying || !!s.keep || !!s.display);
        const ready=canUse(r,marks,s),available=fieldStopReady(r,marks,s,g.elapsed);
        const offset=s.offset||0;
        if(carrying) {
          const carried=r.stops.filter(c=>c.carryUntil && hasMark(r,marks,c.key)&&!hasMark(r,marks,c.carryUntil));
          const n=carried.indexOf(s);
          item.scale.set(1.1,1.1,1);item.position.set(player.x-player.facing*1.2,player.y+1.14+n*.52,.84+n*.015);
        } else {
          item.scale.set(size,size,1);item.position.set(p.x+offset,p.y+size*.53+(ready&&!done&&!g.isReducedMotion?Math.sin(g.elapsed*2.3)*.095:0),.62);
        }
        halo.visible=close && available && !done;halo.scale.set(2.8,2.8,1);halo.position.set(p.x+offset,p.y+1.05,.38);
        sign.mesh.visible=close && (!done || s.keep || s.display);
        if(sign.mesh.visible) {
          const text=done?'✓ '+(s.short||s.label):!ready?(s.locked||'先看上方线索'):available?(s.short||s.label):(s.wait||s.label);
          sign.mesh.position.set(p.x+offset,p.y+size+1.22,1.1);
          sign.draw(text,(ctx,width)=>views.text(ctx,text,width/2,52,Math.min(38,420/Math.max(1,text.length)),done?'#44784d':available?'#704629':'#756e68'));
        }
        delivered.forEach(obj=>{obj.visible=here&&done;});
      });
    }
    for(const m of r.moving.filter(m=>m.icon)) {
      const p=w.platforms[m.platformId],body=sprite(m.icon,p.x,p.y,m.width||p.width,m.height||2,.24);
      watch((_,here)=>{body.visible=here;body.position.set(p.x,p.y-(m.below??.5),.24);});
    }
  }
}
