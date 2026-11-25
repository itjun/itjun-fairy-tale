export function newStoryState() { return { marks:{}, launches:{}, plate:null }; }
const done = (state,key) => Object.hasOwn(state.marks,key);
function reached(room,state,key) {
  const ball=room.runs?.find(b=>b.wall===key);
  return done(state,key) || !!ball?.secret && done(state,ball.secret);
}
export function metGoals(room,state) { return (room.goals || []).every(key=>reached(room,state,key)); }

export function storyHint(room,state) {
  if (!room.goals?.length) return '';
  const count = room.goals.filter(key=>reached(room,state,key)).length;
  if (count===room.goals.length) return '跳到门前，门亮了就进去';
  const active = room.stations.find(s=>s.goal && !done(state,s.key) && s.requires.every(k=>done(state,k)));
  const clue = active?.icon === 'clock-golden-bell' ? '找一找还在晃的金钟'
    : active?.kind === 'ride' ? '站上橙色指针，等它靠窗'
    : active?.icon === 'snow-lost-penguin' ? (done(state,room.id+'/chick')?'带小企鹅回高处的巢':'听听冰洞里的叫声')
    : active?.icon === 'collectible-snowflake' ? '山脊和湖底都有冰晶'
    : room.runs?.some(ball=>!reached(room,state,ball.wall)) ? '靠近雪球，看它会滚到哪里'
    : active?.icon === 'water-gutter' ? '哪条水渠还没通水？'
    : active?.icon === 'flower' ? '高处的花粉熟了'
    : active?.icon === 'water-sunflower' ? '找找还没开花的地方' : '看看附近会动的机关';
  return clue+'　'+count+' / '+room.goals.length;
}

export function movingHand(p,elapsed,rider) {
  const previousX=p.x,previousY=p.y,previousSlope=p.slope;
  const u=rider?.isGrounded && rider.ground===p ? (rider.x-p.x)/p.width : null;
  // Short pauses at the ends let a child board or step onto a balcony.
  const angle=.38*Math.max(-1,Math.min(1,1.4*Math.sin(elapsed*Math.PI*2/p.period+p.phase)));
  const width=p.handLength*Math.cos(angle);
  p.x=p.pivotX+width/2;p.y=p.pivotY+p.handLength*Math.sin(angle)/2;
  p.width=width;p.slope=Math.tan(angle);
  if (u!==null) {
    const previousHeight=previousY+(rider.x-previousX)*previousSlope;
    rider.x=p.x+u*width;
    rider.y+=p.y+u*width*p.slope-previousHeight;
  }
}

export function syncStory(world,rooms,elapsed,player) {
  const room=world.rooms[rooms.roomId],state=rooms.story;
  for (const id of room.hands || []) movingHand(world.platforms[id],elapsed,player);
  for (const id of room.platformIds) {
    const tile=world.platforms[id];
    if (tile.needsMark) tile.isEnabled=done(state,tile.needsMark);
  }
}

function sample(path,x) {
  for(let i=1;i<path.length;i++) {
    const [x2,y2]=path[i];
    if (x<=x2) {
      const [x1,y1]=path[i-1];
      return y1+(y2-y1)*Math.max(0,(x-x1)/(x2-x1));
    }
  }
  return path.at(-1)[1];
}
export function ballPosition(ball,state,elapsed) {
  const at=state.launches[ball.release];
  if (at===undefined) return {x:ball.points[0][0],y:ball.points[0][1],progress:0,diverted:false};
  const age=Math.max(0,elapsed-at);
  const fork=ball.spur && ball.points[ball.fork][0];
  const diverted=!!ball.spur && !(state.marks[ball.secret]<at) && state.marks[ball.lever] <= at+(fork-ball.points[0][0])/8;
  const path=diverted ? [...ball.points.slice(0,ball.fork),...ball.spur] : ball.points;
  const start=path[0][0],end=path.at(-1)[0],x=Math.min(end,start+8*age);
  return {x,y:sample(path,x),progress:(x-start)/(end-start),diverted};
}

export function advanceStory(world,rooms,player,elapsed) {
  const state=rooms.story,room=world.rooms[rooms.roomId];
  let message='', plate=null;
  const mark=(key,label)=>{if (!done(state,key)) {state.marks[key]=elapsed;message=label;}};
  for(const station of room.stations || []) {
    if (!player.isGrounded || player.ground?.id!==station.platformId || !station.requires.every(key=>done(state,key))) continue;
    const ground=player.ground;
    if (station.kind!=='ride' && Math.abs(player.x-ground.x-station.offset)>1.8) continue;
    const key=station.key;
    if(station.kind==='release') {
      const ball=room.runs.find(b=>b.release===key);
      // A missed switch can be tried again from the same release ledge.
      plate=key;
      const retry=ball.spur && (done(state,ball.secret) && !done(state,ball.wall) || done(state,ball.wall) && done(state,ball.lever) && !done(state,ball.secret));
      if (state.plate!==key && (state.launches[key]===undefined || retry && ballPosition(ball,state,elapsed).progress===1)) {
        state.launches[key]=elapsed;message='雪球出发了';
      }
    } else mark(key,station.label);
  }
  state.plate=plate;
  for(const ball of room.runs || []) {
    const pose=ballPosition(ball,state,elapsed);
    if(state.launches[ball.release]!==undefined && pose.progress===1) {
      if(pose.diverted) mark(ball.secret,'侧洞的宝物露出来了');
      else mark(ball.wall,ball.label);
    }
    const walls=[[ball.wall,ball.points.at(-1)]];
    if(ball.spur) walls.push([ball.secret,ball.spur.at(-1)]);
    for (const [key,[x,y]] of walls) {
      if(!done(state,key) && Math.abs(player.x-x)<1.65 && player.y<y+2.9 && player.y+1.8>y-1.3) {
        player.x=x+(player.x<=x?-1.65:1.65);
        player.vx=0;
      }
    }
  }
  return message;
}
export function validStoryState(world,rooms,elapsed=Infinity) {
  const state=rooms.story;
  const record=value=>value && typeof value==='object' && !Array.isArray(value);
  if(!record(state)||!record(state.marks)||!record(state.launches)) return false;
  const marks=new Set(),launches=new Set();
  for (const room of world.rooms.filter(r=>rooms.path.includes(r.id))) {
    for (const s of room.stations || []) {
      if(s.kind!=='release') marks.add(s.key);
      if(done(state,s.key) && !s.requires.every(k=>done(state,k)&&state.marks[k]<=state.marks[s.key])) return false;
    }
    for(const b of room.runs || []) {
      marks.add(b.wall);launches.add(b.release);
      if(b.secret) marks.add(b.secret);
      if(done(state,b.wall) && !Object.hasOwn(state.launches,b.release)) return false;
      if(b.secret && done(state,b.secret) && (!done(state,b.lever)||!Object.hasOwn(state.launches,b.release))) return false;
    }
    if(rooms.cleared.includes(room.id) && !metGoals(room,state)) return false;
  }
  const valid=(values,allowed)=>Object.entries(values).every(([key,t])=>allowed.has(key)&&Number.isFinite(t)&&t>=0&&t<=elapsed);
  return (state.plate===null || launches.has(state.plate)) && valid(state.marks,marks) && valid(state.launches,launches);
}
