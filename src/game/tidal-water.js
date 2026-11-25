import { channelPool } from './water-effects.js';
import { trailMaterial } from './trail-art.js';
import { tideHeight } from '../../shared/trails/field-progress.js';

export function paintTide(views,room) {
  const g=views.engine,t=room.tide,depth=12;
  const mesh=channelPool(g,t.left,t.right,t.low,depth);
  const posts=[],skies=[];
  const sail=g.sprite(trailMaterial(g,'tidal-boat'),t.left+18,t.low+2,5,3.4,-1.45);
  const wood=trailMaterial(g,'tidal-gauge'),cloud=trailMaterial(g,'tidal-cloud');
  for(let x=t.left+6;x<t.right+20;x+=31)skies.push(g.sprite(cloud,x,t.high+7+(x%3),7,3.3,-4));
  const curtain=t.mouth?channelPool(g,t.mouth.x-1.8,t.mouth.x+1.8,t.mouth.y+3.4,3.7):null;
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
    const f=tideHeight(g.elapsed,t.period), level=t.low+(t.high-t.low)*f;
    const clock=g.isReducedMotion ? 0 : g.elapsed;
    mesh.material.uniforms.clock.value=clock;
    mesh.position.y=level-depth/2;
    if(curtain) {
      curtain.material.uniforms.clock.value=clock;
      curtain.position.z=.48;
    }
    sail.position.set(t.left+18+Math.sin(clock*.09)*4,level+1.2+.08*Math.sin(clock*2.1),-1.45);
    sail.rotation.z=.036*Math.sin(clock*2.1);
    const rising=g.elapsed%t.period<t.period/2;
    const label=f<.25?'低潮 · 露滩':f>.75?'高潮 · 乘筏':rising?'↑ 涨潮':'↓ 退潮';
    for(const {gauge} of posts)gauge.draw(label,(ctx,w)=>views.text(ctx,label,w/2,42,28,'#315e77'));
  }});
}
