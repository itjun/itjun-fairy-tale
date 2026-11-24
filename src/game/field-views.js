import { paintTracks } from './toy-tracks.js';
import { paintWind } from './wind-streams.js';
import { paintTide } from './tidal-water.js';
import { trailArt, trailMaterial } from './trail-art.js';
import { addFieldReaction } from './field-reactions.js';
import { isFieldStopActive, hasMark, fieldStopReady } from '../../shared/trails/field-progress.js';

export function fieldImages(world) {
  if(!world.field)return [];
  return [...new Set([...(world.field==='desert'?['water-pond']:[]),...world.rooms.flatMap(r=>[...r.stops.flatMap(s=>[s.icon,...(s.display||[])]),...r.props.map(p=>p.icon),...r.moving.map(m=>m.icon)].filter(name=>name && !trailArt(name)))])];
}
export function addFieldViews(views) {
  const g=views.engine,w=g.world,materials=new Map();
  const sprite=(art,x,y,width,height,z)=>{
    if(!materials.has(art))materials.set(art,trailArt(art)?trailMaterial(g,art):g.spriteMaterial(art));
    return g.sprite(materials.get(art),x,y,width,height,z);
  };
  for(const r of w.rooms) {
    const watch=update=>views.items.push({roomId:r.id,update});
    if (r.moving.some(m=>m.rail)) paintTracks(views,r);
    if (r.tide) paintTide(views,r);
    if (r.wind) paintWind(views,r);
    for(const decor of r.props) {
      const obj=sprite(decor.icon,decor.x,decor.y+decor.height*.47,decor.width,decor.height,-1.7);
      watch((state,here)=>{obj.visible=here && (!decor.after || hasMark(r,state.field,decor.after));});
    }
    for(const s of r.stops) {
      const p=w.platforms[s.platformId], size=s.size||2.25;
      const item=sprite(s.icon==='platform-gear'?'mill-wheel':s.icon,p.x,p.y+size*.56,size,size,.54);
      const react=addFieldReaction(views,r,s,item,sprite);
      const halo=views.glow(p.x,p.y+1);
      const sign=views.paper(p.x,p.y+size+1.22,6.2,1.02,480,78);
      const delivered=(s.display||[]).map((art,i)=>sprite(art,p.x+.94,p.y+1+i*.56,1.36,1.18,.8+i*.015));
      watch((state,here)=>{
        const marks=state.field, player=g.players[0], done=hasMark(r,marks,s.key);
        const carrying=done && !!s.carryUntil && !hasMark(r,marks,s.carryUntil);
        here=here && (carrying || player.safe?.caveId===p.caveId);
        const close=here && Math.abs(player.x-p.x)<12 && Math.abs(player.y-p.y)<9;
        const isActive=here && isFieldStopActive(r,marks,s);
        const available=isActive && fieldStopReady(r,marks,s,g.elapsed);
        item.visible=here && (isActive || carrying || (done && (!!s.keep || !!s.display)));
        const offset=s.offset||0;
        if(carrying) {
          const carried=r.stops.filter(c=>c.carryUntil && hasMark(r,marks,c.key)&&!hasMark(r,marks,c.carryUntil));
          const n=carried.indexOf(s);
          item.scale.set(1.1,1.1,1);item.position.set(player.x-player.facing*1.2,player.y+1.14+n*.52,.84+n*.015);
        } else {
          item.scale.set(size*(s.icon==='platform-gear'?1.43:1),size,1);item.position.set(p.x+offset,p.y+size*.53+(isActive&&!g.isReducedMotion?Math.sin(g.elapsed*2.3)*.095:0),.54);
        }
        halo.visible=close && available;halo.scale.set(2.8,2.8,1);halo.position.set(p.x+offset,p.y+1.05,.38);
        sign.mesh.visible=close && isActive;
        if(sign.mesh.visible) {
          const text=available?(s.short||s.label):(s.wait||s.label);
          sign.mesh.position.set(p.x+offset,p.y+size+1.22,1.1);
          sign.draw(text,(ctx,width)=>views.text(ctx,text,width/2,52,Math.min(38,420/Math.max(1,text.length)),available?'#704629':'#756e68'));
        }
        const serveAge=done?Math.max(0,g.elapsed-marks[r.id+'/'+s.key]):0;
        delivered.forEach((obj,i)=>{
          obj.visible=here&&done;
          if(obj.visible) obj.position.y=p.y+1+i*.56+(g.isReducedMotion?0:Math.max(0,1-serveAge*2+i*.12));
        });
        react(state,here,carrying);
      });
    }
    for(const m of r.moving.filter(m=>m.icon)) {
      const p=w.platforms[m.platformId],body=sprite(m.icon,p.x,p.y,m.width||p.width,m.height||2,.24);
      watch((_,here)=>{
        body.visible=here;body.position.set(p.x,p.y-(m.below??.5),.24);
        if (m.rail) {
          g.platformViews.get(p.id).visible=false;
          body.scale.x=Math.abs(body.scale.x)*Math.sign(m.toX-m.x);
        }
      });
    }
  }
}
