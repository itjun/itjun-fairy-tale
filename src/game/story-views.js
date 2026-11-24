import { ballPosition } from '../../shared/story-mechanisms.js';

const townArt=['clock-tower-frame','clock-orange-hand','clock-golden-bell','clock-safety-net','clock-town-sky'];
const snowArt=['snow-expedition-ball','snow-cracked-wall','snow-tunnel-mouth','snow-lost-penguin','snow-crayon-bank','snow-expedition-ridge'];
export function storyImages(world) {
  if (!world.expedition) return [];
  const stations=world.rooms.flatMap(r=>(r.stations || []).map(s=>s.icon));
  return [...new Set([...stations,...(world.themeId==='family'?townArt:world.themeId==='snow'?snowArt:[])])];
}

export function addStoryViews(views) {
  const engine=views.engine,world=engine.world,materials=new Map();
  function sprite(art,x,y,w,h,z) {
    if(!materials.has(art)) materials.set(art,engine.spriteMaterial(art));
    return engine.sprite(materials.get(art),x,y,w,h,z);
  }
  for (const room of world.rooms) {
    const watch=update=>views.items.push({roomId:room.id,update});
    for(const frame of room.frames || []) {
      const scene=sprite('clock-tower-frame',frame.x,frame.y,frame.width,frame.width*.75,-3);
      watch((_,here)=>{scene.visible=here;});
    }
    for (const s of room.stations || []) {
      if(s.kind==='ride'||s.kind==='release') continue;
      const p=world.platforms[s.platformId],isBell=s.icon==='clock-golden-bell',isFlower=s.icon==='water-sunflower';
      const height=isFlower?4.9:isBell?2.8:s.icon==='water-gutter'?1.55:1.8;
      const obj=sprite(s.icon,p.x+s.offset,p.y+height*.53,s.icon==='water-gutter'?3.5:height*(isFlower?.65:.94),height,.62);
      // Each item changes its own tint, while the sprite textures stay shared.
      obj.material=engine.material(obj.material.clone());
      watch((state,here)=>{
        const marks=state.story.marks,claimed=Object.hasOwn(marks,s.key),ready=s.requires.every(k=>Object.hasOwn(marks,k));
        const following=s.key===room.id+'/chick' && claimed && !Object.hasOwn(marks,room.id+'/nest');
        obj.visible=here && (!claimed || following || isBell || isFlower || s.icon==='water-gutter' || s.key===room.id+'/nest');
        if(!obj.visible) return;
        const time=engine.isReducedMotion?0:engine.elapsed;
        obj.material.color.set(!ready?'#969397':claimed?'#fff1c1':'#ffffff');
        obj.rotation.z=isBell && ready && !claimed ? Math.sin(time*2.3)*.13 : s.icon==='water-gutter' && claimed ? -.16 : 0;
        if(following) {
          const player=engine.players[0];
          obj.position.set(player.x-player.facing*1.45,player.y+.82+Math.abs(Math.sin(time*6))*.22,.64);
        } else obj.position.y=p.y+height*.53+(ready&&!claimed&&!isFlower&&!isBell&&s.icon!=='water-gutter'?Math.sin(time*2)*.12:0);
      });
    }
    for(const ball of room.runs || []) {
      const start=ball.points[0],end=ball.points.at(-1);
      const boulder=sprite('snow-expedition-ball',start[0],start[1]+.35,3.05,3.05,.72);
      const drawMouth=(endpoint,key)=>{
        const [x,y]=endpoint;
        const cave=sprite('snow-tunnel-mouth',x+.5,y+1.25,7.8,5.3,-.9);
        const wall=sprite('snow-cracked-wall',x,y+1.15,3.8,4.3,.58);
        watch((state,here)=>{
          cave.visible=here;
          const broken=state.story.marks[key];
          const age=broken===undefined?0:Math.max(0,engine.elapsed-broken);
          wall.visible=here && (broken===undefined || age<.32);
          if (wall.visible) { wall.rotation.z=broken===undefined?0:-age*1.5;wall.scale.y=4.3*(1-Math.min(1,age/.32)); }
        });
      };
      drawMouth(end,ball.wall);
      if(ball.spur) drawMouth(ball.spur.at(-1),ball.secret);
      watch((state,here)=>{
        if(!here) {boulder.visible=false;return;}
        const pose=ballPosition(ball,state.story,engine.elapsed);
        const retry=ball.spur && (!(ball.secret in state.story.marks) || !(ball.wall in state.story.marks));
        boulder.visible=pose.progress<1 || !!retry;
        const x=pose.progress===1?start[0]:pose.x, y=pose.progress===1?start[1]:pose.y;
        boulder.position.set(x,y+.35,.72);boulder.rotation.z=-(x-start[0])/1.5;
      });
    }
    for(const id of room.platformIds) {
      const p=world.platforms[id];
      if (!p.needsMark) continue;
      const group=engine.platformViews.get(id);
      watch((state,here)=>{
        const at=state.story.marks[p.needsMark];
        group.visible=here && at!==undefined;
        if(!group.visible)return;
        const amount=engine.isReducedMotion?1:Math.min(1,.75+Math.max(0,engine.elapsed-at)*.9);
        group.scale.set(amount,amount,1);
      });
    }
  }
}
