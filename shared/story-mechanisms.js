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
  if (count===room.goals.length) return '路通了，去发光的门';
  const active = room.stations.find(s=>s.goal && !done(state,s.key) && s.requires.every(k=>done(state,k)));
  const clue = active?.icon === 'clock-golden-bell' ? '找一找还在晃的金钟'
    : active?.kind === 'ride' ? '站上橙色指针，等它靠窗'
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

export function advanceStory(world,rooms,player,elapsed) {
  const state=rooms.story,room=world.rooms[rooms.roomId];
  let message='';
  const mark=(key,label)=>{if (!done(state,key)) {state.marks[key]=elapsed;message=label;}};
  for(const station of room.stations || []) {
    if (!player.isGrounded || player.ground?.id!==station.platformId || !station.requires.every(key=>done(state,key))) continue;
    const ground=player.ground;
    if (station.kind!=='ride' && Math.abs(player.x-ground.x-station.offset)>1.8) continue;
    const key=station.key;
    mark(key,station.label);
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
    if(rooms.cleared.includes(room.id) && !metGoals(room,state)) return false;
  }
  const valid=(values,allowed)=>Object.entries(values).every(([key,t])=>allowed.has(key)&&Number.isFinite(t)&&t>=0&&t<=elapsed);
  return (state.plate===null || launches.has(state.plate)) && valid(state.marks,marks) && valid(state.launches,launches);
}
