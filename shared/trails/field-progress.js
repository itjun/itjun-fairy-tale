const idOf = (room,key) => room.id+'/'+key;
export const hasMark = (room,marks,key) => Object.hasOwn(marks,idOf(room,key));
export const canUse = (room,marks,stop) => stop.after.every(key=>hasMark(room,marks,key));
export const fieldComplete = (room,marks) => room.stops.every(s=>!s.goal || hasMark(room,marks,s.key));

export function fieldMotion(room,m,marks,time) {
  const start=m.after ? marks[idOf(room,m.after)] : 0;
  if (start === undefined) return 0;
  const elapsed=Math.max(0,time-start);
  if (m.once) return Math.min(1,elapsed/m.period);
  // Dwell at both landings to make boarding possible with either controller.
  const phase=((elapsed+(m.phase||0))/m.period)%1;
  const along=phase<.5?phase*2:(1-phase)*2;
  return Math.max(0,Math.min(1,(along-.14)/.72));
}
export function syncField(world,rooms,time) {
  const room=world.rooms[rooms.roomId],marks=rooms.field;
  for(const id of room.platformIds) {
    const p=world.platforms[id];
    if(p.fieldGate) p.isEnabled=hasMark(room,marks,p.fieldGate);
  }
  for(const m of room.moving) {
    const p=world.platforms[m.platformId],u=fieldMotion(room,m,marks,time);
    const x=m.x+(m.toX-m.x)*u,y=m.y+(m.toY-m.y)*u;
    p.deltaX=x-p.x;p.deltaY=y-p.y;p.x=x;p.y=y;
  }
}
export function fieldStopReady(room,marks,stop,time) {
  if(!canUse(room,marks,stop)) return false;
  if(stop.atDock!==undefined) {
    const moving=room.moving.find(m=>m.platformId===stop.platformId);
    if(Math.abs(fieldMotion(room,moving,marks,time)-stop.atDock)>.065) return false;
  }
  if(stop.tide) {
    const water=(1-Math.cos(2*Math.PI*time/room.tide.period))/2;
    return stop.tide==='low'?water<.32:water>.68;
  }
  return true;
}
export function stepField(world,rooms,player,time) {
  const room=world.rooms[rooms.roomId], marks=rooms.field;
  if(!player.isGrounded) return null;
  for(const stop of room.stops) {
    if(hasMark(room,marks,stop.key) || stop.platformId!==player.ground?.id || !fieldStopReady(room,marks,stop,time))continue;
    if(Math.abs(player.x-player.ground.x-(stop.offset||0))>(stop.atDock!==undefined?player.ground.width/2:1.8))continue;
    marks[idOf(room,stop.key)]=time;return stop;
  }
  return null;
}
export function fieldHint(world,rooms,player,time) {
  const room=world.rooms[rooms.roomId],marks=rooms.field;
  if(!room.stops.length) return '';
  if(fieldComplete(room,marks)) return '通路打开了　去发光的门';
  const active=room.stops.filter(s=>!s.optional&&!hasMark(room,marks,s.key)&&canUse(room,marks,s));
  const distance=s=>Math.abs(player.x-world.platforms[s.platformId].x);
  const next=active.sort((a,b)=>distance(a)-distance(b))[0];
  if(!next)return room.clue || '看看附近的机关';
  const p=world.platforms[next.platformId],dx=p.x-player.x,dy=p.y-player.y;
  const arrow=Math.abs(dx)>5 ? (dx>0?'→':'←') : Math.abs(dy)>2?(dy>0?'↑':'↓'):'';
  const hint=next.wait && !fieldStopReady(room,marks,next,time)?next.wait:(next.hint||next.label);
  return [room.recipe,arrow+' '+hint].filter(Boolean).join('　');
}
export function validField(world,rooms,time=Infinity) {
  const marks=rooms.field;
  if(!marks || typeof marks!=='object'||Array.isArray(marks))return false;
  const allowed=new Set();
  for(const room of world.rooms.filter(r=>rooms.path.includes(r.id))) {
    for(const stop of room.stops) {
      const id=idOf(room,stop.key);allowed.add(id);
      if(Object.hasOwn(marks,id) && !stop.after.every(k=>hasMark(room,marks,k)&&marks[idOf(room,k)]<=marks[id]))return false;
    }
    if(rooms.cleared.includes(room.id) && !fieldComplete(room,marks))return false;
  }
  return Object.entries(marks).every(([key,t])=>allowed.has(key)&&Number.isFinite(t)&&t>=0&&t<=time);
}
