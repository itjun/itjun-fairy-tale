import { ballPosition } from '../../shared/story-mechanisms.js';
import { addChannelWater } from './channel-water.js';
import { trailArt, trailMaterial } from './trail-art.js';

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
    if(!materials.has(art)) materials.set(art,trailArt(art)?trailMaterial(engine,art):engine.spriteMaterial(art));
    return engine.sprite(materials.get(art),x,y,w,h,z);
  }
  for (const room of world.rooms) {
    const watch=update=>views.items.push({roomId:room.id,update});
    const outlets=[];
    for(const frame of room.frames || []) {
      const scene=sprite('clock-tower-frame',frame.x,frame.y,frame.width,frame.width*.75,-3);
      watch((_,here)=>{scene.visible=here;});
    }
    for (const s of room.stations || []) {
      if(s.kind==='release') continue;
      const p=world.platforms[s.platformId],isBell=s.icon==='clock-golden-bell',isFlower=s.icon==='water-sunflower';
      const isGear=s.icon==='platform-gear', isGutter=s.icon==='water-gutter';
      const key=s.key.split('/')[1], isBeacon=key==='beacon';
      const height=isFlower?4.9:isBell?2.8:isGutter?1.55:1.8;
      const art=key==='rail'?'rail-switch':isGear?'mill-wheel':s.icon;
      const obj=sprite(art,p.x+s.offset,p.y+height*.53,isGutter?3.5:height*(isGear?1.43:isFlower?.65:.94),height,.55);
      if(isGutter) {
        const x=p.x+s.offset;
        let wheel;
        if(key==='wheel') {
          wheel=sprite('mill-wheel',p.x+p.width/2+.35,p.y+.05,3.4,2.38,-.06);
        }
        outlets.push({x:x+1.62,y:p.y+1.09,lip:p.x+p.width/2,wheel,at:state=>state.story.marks[s.key]});
        const inlet=sprite('water-pond',x,p.y+1.16,2,.24,.58);
        watch((state,here)=>{inlet.visible=here;inlet.rotation.z=Object.hasOwn(state.story.marks,s.key)?-.16:0;});
      }
      const light=isBeacon ? views.glow(p.x,p.y+1.45) : null;
      if(light) watch((state,here)=>{light.visible=here && Object.hasOwn(state.story.marks,s.key);light.scale.set(4.3,4.3,1);});
      const destination={chick:'nest',pollen:'bloom',star:'beacon'}[key];
      // 每件器材独立变色，贴图共用。
      obj.material=engine.material(obj.material.clone());
      watch((state,here)=>{
        const marks=state.story.marks,claimed=Object.hasOwn(marks,s.key),ready=s.requires.every(k=>Object.hasOwn(marks,k));
        const following=destination && claimed && !Object.hasOwn(marks,room.id+'/'+destination);
        const age=claimed?Math.max(0,engine.elapsed-marks[s.key]):0;
        const isCollecting=claimed && age<.55 && !engine.isReducedMotion;
        obj.visible=here && (!claimed || following || isBell || isFlower || isGear || isGutter || isBeacon || key==='nest' || isCollecting);
        if(!obj.visible) return;
        const time=engine.isReducedMotion?0:engine.elapsed;
        obj.material.color.set(!ready?'#969397':claimed?'#fff1c1':'#ffffff');
        obj.rotation.z=isBell && ready && !claimed ? Math.sin(time*2.3)*.13 : isGutter && claimed ? -.16 : 0;
        if(following) {
          const player=engine.players[0];
          obj.position.set(player.x-player.facing*1.45,player.y+.82+Math.abs(Math.sin(time*6))*.22,.64);
          if(key!=='chick') obj.scale.set(.85,.85,1);
        } else {
          obj.position.x=p.x+s.offset;
          obj.position.y=p.y+height*.53;
          if(isBell) {
            if(claimed) obj.rotation.z=engine.isReducedMotion?.12:Math.sin(age*13)*.64*Math.exp(-age*1.45);
            obj.position.x+=Math.sin(obj.rotation.z)*height*.44;
            obj.position.y+=1.45+(1-Math.cos(obj.rotation.z))*height*.44;
          }
          if(key==='rail') {
            obj.scale.x=(claimed?-1:1)*height*1.43;obj.position.x+=1.1;
          } else if(isGear && claimed) {
            obj.rotation.z=engine.isReducedMotion?-.6:-Math.min(age,1.4)*3.8;
            if(key==='weight') obj.position.y-=engine.isReducedMotion?.65:Math.min(.65,age*1.8);
          }
          if(isFlower) {
            const growth=claimed?(engine.isReducedMotion?1:Math.min(1,age/.65)):0;
            obj.scale.y=height*(.56+.44*growth);obj.scale.x=obj.scale.y*.65;
            obj.position.y=p.y+obj.scale.y*.51;
          } else if(isCollecting && !isBell && !isGear && !isGutter && !isBeacon && key!=='nest') {
            obj.position.y+=age*2;obj.scale.y=height*(1-age/.6);
          }
        }
      });
    }
    if(outlets.length) addChannelWater(views,room,outlets,{left:room.left,right:room.right,surface:room.bottom-.75});
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
