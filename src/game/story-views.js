const townArt=['clock-tower-frame','clock-orange-hand','clock-golden-bell','clock-safety-net','clock-town-sky'];
export function storyImages(world) {
  if (!world.expedition) return [];
  const stations=world.rooms.flatMap(r=>(r.stations || []).map(s=>s.icon));
  return [...new Set([...stations,...(world.themeId==='family'?townArt:[])])];
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
        obj.visible=here && (!claimed || isBell || isFlower || s.icon==='water-gutter');
        if(!obj.visible) return;
        const time=engine.isReducedMotion?0:engine.elapsed;
        obj.material.color.set(!ready?'#969397':claimed?'#fff1c1':'#ffffff');
        obj.rotation.z=isBell && ready && !claimed ? Math.sin(time*2.3)*.13 : s.icon==='water-gutter' && claimed ? -.16 : 0;
        obj.position.y=p.y+height*.53+(ready&&!claimed&&!isFlower&&!isBell&&s.icon!=='water-gutter'?Math.sin(time*2)*.12:0);
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
