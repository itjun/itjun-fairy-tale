import { railHeight, selectedRail } from './railway.js';
const idOf = (room,key) => room.id+'/'+key;
export const hasMark = (room,marks,key) => Object.hasOwn(marks,idOf(room,key));
export const canUse = (room,marks,stop) => stop.after.every(key=>hasMark(room,marks,key));
export const fieldComplete = (room,marks) => room.stops.every(s=>!s.goal || hasMark(room,marks,s.key));

function nextRequiredStop(room,marks) {
  return room.stops.find(s=>!s.optional && !hasMark(room,marks,s.key) && canUse(room,marks,s));
}
export function isFieldStopActive(room,marks,stop) {
  if(stop.optional) return !hasMark(room,marks,stop.key) && canUse(room,marks,stop);
  return nextRequiredStop(room,marks)===stop;
}

export const tideHeight = (time,period) => (1-Math.cos(2*Math.PI*time/period))/2;
export function fieldMotion(room,m,marks,time) {
  const start=m.after ? marks[idOf(room,m.after)] : 0;
  if (start === undefined) return 0;
  if (m.tide) return tideHeight(time,m.period);
  const elapsed=Math.max(0,time-start);
  if (m.hold && elapsed >= m.hold*m.period) {
    const resume=marks[idOf(room,m.unlock)];
    if (resume===undefined) return m.hold;
    return Math.min(1,m.hold+Math.max(0,time-Math.max(resume,start+m.hold*m.period))/m.period);
  }
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
    const x=m.x+(m.toX-m.x)*u;
    const y=m.rail ? railHeight(selectedRail(room,m,marks),x) : m.y+(m.toY-m.y)*u;
    p.deltaX=x-p.x;p.deltaY=y-p.y;p.x=x;p.y=y;
  }
}
export function fieldStopReady(room,marks,stop,time) {
  if(!isFieldStopActive(room,marks,stop)) return false;
  if(stop.atDock!==undefined) {
    const moving=room.moving.find(m=>m.platformId===stop.platformId);
    if(Math.abs(fieldMotion(room,moving,marks,time)-stop.atDock)>(moving.rail ? .001 : .065)) return false;
  }
  if(stop.tide) {
    const water=tideHeight(time,room.tide.period);
    return stop.tide==='low'?water<.32:water>.68;
  }
  return true;
}
export function stepField(world,rooms,player,time) {
  const room=world.rooms[rooms.roomId], marks=rooms.field;
  const waterGate=room.tide?.mouth;
  if(waterGate && tideHeight(time,room.tide.period)>.48 && player.vx>0 && player.x<waterGate.x && player.x>waterGate.x-1.3 && Math.abs(player.y-waterGate.y)<2.4) {
    player.x=waterGate.x-1.3;player.vx=0;
  }
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
  const next=nextRequiredStop(room,marks);
  if(!next)return room.clue || '看看附近的机关';
  const p=world.platforms[next.platformId],dx=p.x-player.x,dy=p.y-player.y;
  const cave=room.traversal?.cave;
  if(cave && !!player.safe?.isCave !== !!p.isCave) {
    const mouths=cave.mouths.filter(m=>world.platforms[m.platformId].caveId===player.safe?.caveId);
    const nearest=mouths.sort((a,b)=>Math.abs(a.x-player.x)-Math.abs(b.x-player.x))[0];
    if(nearest) {
      const cue=Math.abs(nearest.x-player.x)<2?'↑':nearest.x>player.x?'→':'←';
      return cue+(p.isCave?' 走到金色神灯下，向上进洞':' 走到神灯下，向上出洞');
    }
  }
  if (player.grip?.point?.side) return '↑ 沿凸石往上爬到岩台';
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
