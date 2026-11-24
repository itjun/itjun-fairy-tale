import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomWorld } from '../shared/room-world.js';
import { PLAYABLE_WORLDS } from '../shared/levels.js';
import { pushInWind } from '../shared/trails/wind.js';
import { fieldThemes } from '../shared/trails/themes.js';
import { fieldComplete, fieldMotion, stepField, syncField, validField } from '../shared/trails/field-progress.js';
import { newRoomState, stepRoom } from '../src/game/rooms.js';
import { createPlayer, platformY, stepPlayer } from '../src/game/physics.js';
import { beginCrawl, caveMouthAt, stepTraversal } from '../src/game/traversal.js';
import { readAdventure } from '../src/game/save.js';
import { roomFixture } from './helpers/adventure-fixtures.mjs';
import { headless } from './helpers/headless-engine.mjs';
import { openStore } from '../server/store.mjs';

function jump(from,to,tiles,r,state) {
  const dt=1/120,dx=to.x-from.x;
  const edge=Math.sign(dx)*Math.min(Math.abs(dx),from.width/2-.42);
  if(Math.abs(dx-edge)>to.width/2+(r.wind?27:12) || to.y-from.y>(r.wind?21:9.1))return false;
  for(const offset of [edge,0])for(const second of [46,68,23,-1]) {
    const p=createPlayer(from,offset);
    p.y=platformY(from,p.x);
    let left=false;
    for(let i=0;i<(r.wind?470:235);i++) {
      if(r.wind)pushInWind(r,state.field,p,dt);
      const direction=Math.abs(to.x-p.x)<.06?0:Math.sign(to.x-p.x);
      stepPlayer(p,{direction,jump:second>=0&&(i===0||i===second),drop:second===-1&&i===0},tiles,dt,{minX:r.left,maxX:r.right,minY:r.fallY,isFiniteLife:true});
      if(p.ground===to)return true;
      if(left&&p.isGrounded||p.y<(from.isCave?r.traversal.cave.floorY-4:r.fallY))break;
      left ||= !p.isGrounded;
    }
  }
  return false;
}

function climbFrom(w,r,from,wall,tiles) {
  const takeoff=wall.x+wall.side*.3;
  if(from.isCave || Math.abs(takeoff-from.x)>from.width/2 || from.y<wall.minY-1.5 || from.y>wall.maxY)return false;
  const p=createPlayer(from,takeoff-from.x);
  for(let i=0;i<850;i++){
    stepTraversal(p,{direction:p.grip?0:-wall.side,vertical:1,jump:i===0},tiles,w.platforms,1/120,
      {minX:r.left,maxX:r.right,minY:r.fallY,isFiniteLife:true},r.traversal);
    if(p.ground?.id===wall.topId)return true;
  }
  return false;
}
function throughMouth(w,r,from,mouth,tiles) {
  const p=createPlayer(from,mouth.x-from.x);
  if(caveMouthAt(r,p)!==mouth)return false;
  beginCrawl(p,mouth);
  for(let i=0;i<44;i++)stepTraversal(p,{direction:0,vertical:0},tiles,w.platforms,1/120,
    {minX:r.left,maxX:r.right,minY:r.fallY,isFiniteLife:true},r.traversal);
  return p.ground?.id===mouth.targetId;
}
function reachable(w,r,state,start,goal,elapsed) {
  const tiles=r.platformIds.map(id=>w.platforms[id]).filter(p=>p.isEnabled!==false);
  const todo=[start],seen=new Set(todo);
  while(todo.length) {
    const from=todo.shift();
    if(from===goal)return true;
    const layer=tiles.filter(t=>t.caveId===from.caveId);
    const enqueue=target=>{if(!seen.has(target)){seen.add(target);todo.push(target);}};
    for(const wall of r.traversal?.walls||[]) {
      if(!seen.has(w.platforms[wall.topId]) && climbFrom(w,r,from,wall,layer))enqueue(w.platforms[wall.topId]);
    }
    for(const mouth of r.traversal?.cave?.mouths||[]) {
      if(mouth.platformId===from.id && throughMouth(w,r,from,mouth,layer))enqueue(w.platforms[mouth.targetId]);
    }
    for(const to of layer) {
      if(seen.has(to))continue;
      const moving=r.moving.filter(m=>m.platformId===from.id||m.platformId===to.id);
      const times=moving.length?Array.from({length:13},(_,i)=>elapsed+i*moving[0].period/12):[elapsed];
      if(times.some(t=>{
        syncField(w,state,t);
        for(const p of tiles){p.deltaX=0;p.deltaY=0;}
        return jump(from,to,layer,r,state);
      })) {seen.add(to);todo.push(to);}
    }
  }
  return false;
}
test('海蚀洞随潮封口，退潮取芯，涨潮筏能载人到高台',()=>{
  const w=createRoomWorld(42,'beach-tide-lights'),s=newRoomState(w);
  const r=w.rooms.find(r=>r.tide?.mouth);s.roomId=r.id;
  const {x,y}=r.tide.mouth,person={x:x-.25,y,vx:2,isGrounded:false};
  stepField(w,s,person,6);assert.equal(person.x,x-1.3);
  Object.assign(person,{x:x-.25,vx:2});stepField(w,s,person,12);assert.equal(person.x,x-.25);
  const wharf=w.rooms.find(r=>r.name==='潮汐码头'),boat=wharf.moving[0];
  s.roomId=wharf.id;s.field[wharf.id+'/rope']=0;
  assert.equal(fieldMotion(wharf,boat,s.field,0),0);assert.equal(fieldMotion(wharf,boat,s.field,6),1);
  const pad=w.platforms[boat.platformId];syncField(w,s,0);const rider=createPlayer(pad);
  for(let i=1;i<=720;i++){syncField(w,s,i/120);stepPlayer(rider,{direction:0},[pad],1/120,{minX:wharf.left,maxX:wharf.right,minY:wharf.fallY,isFiniteLife:true});}
  assert.equal(rider.ground,pad);assert.ok(rider.y>7.9);
});
test('纸鸢上升风实际托升普通角色，关闭风筒时保持普通跳高',()=>{
  const w=createRoomWorld(42,'meadow-kite-post'),r=w.rooms[0],jet=r.wind[0],dt=1/120;
  const floor=w.platforms[r.platformIds.find(id=>Math.abs(w.platforms[id].x-jet.x)<4 && w.platforms[id].y===0)];
  function fly(marks){
    const p=createPlayer(floor);let peak=p.y;
    for(let i=0;i<300;i++){pushInWind(r,marks,p,dt);stepPlayer(p,{direction:0,jump:i===0},[floor],dt,{minX:r.left,maxX:r.right,minY:r.fallY,isFiniteLife:true});peak=Math.max(peak,p.y);}
    return peak;
  }
  assert.ok(fly({})<5);assert.ok(fly({'0/kite':1})>10);
});
test('在提水斗上退出再进入，保持本次升降进度、站位与岸上复活点',()=>{
  const id='desert-oasis-springs',w=createRoomWorld(42,id),room=w.rooms.find(r=>r.name==='古井提水架');
  const fx=roomFixture('room',id,{seed:42,roomId:room.id});
  const g=headless('room',id);g.restoreState(fx.state);
  const lift=room.moving[0],rider=g.players[0];
  g.roomState.field[room.id+'/weight']=13;g.roomState.field[room.id+'/water']=16;g.elapsed=20;
  syncField(g.world,g.roomState,g.elapsed);const deck=g.platforms[lift.platformId];
  Object.assign(rider,{x:deck.x+.7,y:deck.y,ground:deck,isGrounded:true});
  const originalSafe=rider.safe.id,saved=g.exportState();
  const storage={getItem:()=>JSON.stringify({run:fx.run,state:saved}),removeItem(){}};
  assert.ok(readAdventure(storage));g.restoreState(saved);
  assert.equal(rider.ground,deck);assert.ok(Math.abs(rider.x-deck.x-.7)<1e-6);assert.equal(rider.safe.id,originalSafe);
  saved.players[0].ride.offset=93;assert.equal(readAdventure(storage),null);
});
test('绿洲从岩脚抓壁爬上日镜，暗河入口和两个出口均能钻通',()=>{
  const w=createRoomWorld(42,'desert-oasis-springs'),r=w.rooms[0],wall=r.traversal.walls[0];
  assert.ok(r.platformIds.map(i=>w.platforms[i]).some(t=>climbFrom(w,r,t,wall,w.platforms)));
  for(const cr of w.rooms.filter(r=>r.traversal?.cave)){
    const cave=cr.traversal.cave;
    for(const mouth of cave.mouths) {
      const from=w.platforms[mouth.platformId];
      assert.ok(throughMouth(w,cr,from,mouth,cr.platformIds.map(i=>w.platforms[i]).filter(t=>t.caveId===from.caveId)));
      assert.notEqual(from.caveId,w.platforms[mouth.targetId].caveId);
    }
  }
});
test('列车在岔口锁定路线，红灯检修时等人回车再开',()=>{
  const w=createRoomWorld(42,'cartoon-toy-rail'),s=newRoomState(w);
  const fork=w.rooms.find(r=>r.moving.some(m=>m.alt)),train=fork.moving[0];
  const pad=w.platforms[train.platformId];s.roomId=fork.id;
  const key=k=>fork.id+'/'+k;
  s.field[key(train.after)]=100;
  syncField(w,s,106);const low=pad.y;
  s.field[key(train.switchKey)]=106;syncField(w,s,106);assert.equal(pad.y,low);
  s.field[key(train.switchKey)]=99;syncField(w,s,106);assert.ok(pad.y>=low+6);
  const repair=w.rooms.find(r=>r.moving.some(m=>m.hold)),m=repair.moving[0];
  s.roomId=repair.id;s.field[repair.id+'/'+m.after]=100;
  syncField(w,s,100);const engine=w.platforms[m.platformId],child=createPlayer(engine);
  for(let i=1;i<=1800;i++){
    syncField(w,s,100+i/120);stepPlayer(child,{direction:0},repair.platformIds.map(id=>w.platforms[id]),1/120,{minX:repair.left,maxX:repair.right,minY:repair.fallY,isFiniteLife:true});
  }
  assert.equal(child.ground,engine);assert.ok(Math.abs(engine.x-(m.x+m.toX)/2)<.001);
  s.field[repair.id+'/'+m.unlock]=115;
  syncField(w,s,115);assert.equal(child.x,engine.x);
  syncField(w,s,116);assert.ok(engine.x>child.x);
  syncField(w,s,127);assert.equal(engine.x,m.toX);
});
const journeyStages=fieldThemes.flatMap(theme=>[theme,PLAYABLE_WORLDS.find(s=>s.baseId===theme.id)]);
for(const theme of journeyStages) test((theme.title || theme.chapterName+'分层版')+'：两组种子逐段走到每个机关，开门并读回存档',()=>{
  const store=openStore(':memory:');
  try {
    assert.ok(PLAYABLE_WORLDS.some(s=>s.baseId===(theme.baseId || theme.id)));
    for(const seed of [1,42]) {
      const w=createRoomWorld(seed,theme.id),s=newRoomState(w);
      assert.equal(w.rooms.length,8);assert.equal(w.rooms.at(-1).kind,'boss');
      assert.ok(w.rooms.reduce((length,r)=>length+r.right-r.left,0)>850);
      let elapsed=2;
      for(const r of w.rooms) {
        s.roomId=r.id;if(r.id)s.path.push(r.id);
        let from=w.platforms[r.startId];
        for(const stop of r.stops) {
          const target=w.platforms[stop.platformId];syncField(w,s,elapsed);
          assert.ok(reachable(w,r,s,from,target,elapsed),r.name+'：前往'+stop.label);
          let got;
          for(let i=0;i<350&&!got;i++){
            elapsed+=.15;syncField(w,s,elapsed);
            const player=createPlayer(target,stop.offset||0);got=stepField(w,s,player,elapsed);
          }
          assert.equal(got?.key,stop.key,r.name+'：触发'+stop.label);
          from=target;
        }
        syncField(w,s,elapsed);
        if(r.kind==='mechanism') {
          assert.ok(fieldComplete(r,s.field));
          assert.ok(reachable(w,r,s,from,w.platforms[r.exitId],elapsed),r.name+'：出口');
          assert.ok(stepRoom(w,s,createPlayer(w.platforms[r.exitId]),1/120).some(e=>e.type==='clear'));
        } else {s.cleared.push(r.id);s.stars[r.id]=3;}
        assert.ok(validField(w,s,elapsed));elapsed+=20;
      }
      const fixture=roomFixture('boss',theme.id,{seed});
      fixture.state.rooms.field=structuredClone(s.field);fixture.state.elapsed=elapsed;fixture.run.seconds=Math.floor(elapsed);
      const saved=readAdventure({getItem:()=>JSON.stringify(fixture),removeItem(){}});
      assert.ok(saved,'首领前可以续关');assert.deepEqual(saved.state.rooms.field,s.field);
      assert.equal(store.save(fixture.run).levelId,theme.id);
    }
  } finally {store.close();}
});

test('暗河水纹地面与洞内各层留出跳台间隙', () => {
  const world = createRoomWorld(42, 'desert-oasis-springs');
  const room = world.rooms.find(r => r.name === '暗河水纹');
  const tiles = room.platformIds.map(id => world.platforms[id]);
  for (const [index, a] of tiles.entries()) for (const b of tiles.slice(index + 1)) {
    if (a.slope || b.slope || a.caveId !== b.caveId || Math.abs(a.y - b.y) >= 2.4) continue;
    const gap = Math.abs(a.x - b.x) - (a.width + b.width) / 2;
    assert.ok(gap >= 1.1 - 1e-6, `平台 ${a.id}、${b.id} 的间隙为 ${gap}`);
  }
});

test('暗河水纹沿途和洞内都能遇到守卫，洞口、机关和出生点留空', () => {
  const world = createRoomWorld(42, 'desert-oasis-springs');
  const room = world.rooms.find(r => r.name === '暗河水纹');
  const homes = room.enemyIds.map(id => world.platforms[world.enemies[id - 1].platformId]);
  assert.ok(homes.filter(p => p.isCave).length >= 2);
  assert.ok(homes.filter(p => !p.isCave).length >= 6);
  const safe = [room.startId, room.exitId, ...room.stops.map(s => s.platformId),
    ...room.traversal.cave.mouths.map(m => m.platformId)];
  assert.ok(homes.every(p => !safe.includes(p.id)));
});
