import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYABLE_WORLDS, WATERWAYS, CLOCK_TOWER, SNOW_EXPEDITION } from '../shared/levels.js';
import { createRoomWorld } from '../shared/room-world.js';
import { advanceStory, ballPosition, metGoals, movingHand, syncStory } from '../shared/story-mechanisms.js';
import { newRoomState, stepRoom, isValidRoomState } from '../src/game/rooms.js';
import { createPlayer, platformY, stepPlayer } from '../src/game/physics.js';
import { roomFixture } from './helpers/adventure-fixtures.mjs';
import { readAdventure } from '../src/game/save.js';
import { openStore } from '../server/store.mjs';

const stages=[WATERWAYS,CLOCK_TOWER,SNOW_EXPEDITION], dt=1/120;
const roomTiles=(world,room)=>room.platformIds.map(id=>world.platforms[id]);
test('三个世界八个区段分别进入选关、成绩与续关，旧地图继续可读',()=>{
  const store=openStore(':memory:');
  try {
    for(const stage of stages) {
      assert.equal(PLAYABLE_WORLDS[stage.worldIndex],stage);
      const w=createRoomWorld(1,stage), other=createRoomWorld(2,stage);
      assert.equal(w.rooms.length,8);
      assert.equal(w.rooms.filter(r=>r.reward==='upgrade').length,1);
      assert.equal(w.rooms.at(-1).kind,'boss');
      assert.ok(w.rooms.reduce((n,r)=>n+r.right-r.left,0)>850);
      assert.notEqual(w.signature,other.signature);
      for(const room of w.rooms.slice(0,-1)) assert.equal(w.doors.find(d=>d.roomId===room.id).targetRoomId,room.id+1);
    }
    for(const id of [...stages.map(s=>s.id),'rainbow-flower-valley','family-world','snow-world']) {
      const {run,state}=roomFixture('room',id);
      assert.ok(readAdventure({getItem:()=>JSON.stringify({run,state}),removeItem(){}}));
      assert.equal(store.save(run).levelId,id);
    }
  } finally {store.close();}
});

test('写入及重读三个世界的首领房和终点，保存滚动中的雪球', () => {
  const restore = ({ run, state }) => readAdventure({ getItem: () => JSON.stringify({ run, state }), removeItem() {} });
  for (const stage of stages) {
    for (const mode of ['boss', 'finish']) {
      const fixture = roomFixture(mode, stage.id);
      const saved = restore(fixture);
      assert.ok(saved, stage.name + ' ' + mode);
      assert.equal(saved.state.rooms.roomId, 7);
      assert.deepEqual(saved.state.rooms.story, fixture.state.rooms.story);
    }
  }
  const fixture = roomFixture('room', SNOW_EXPEDITION.id);
  const world = createRoomWorld(fixture.state.seed, SNOW_EXPEDITION);
  const room = world.rooms[0], ball = room.runs[0];
  const release = room.stations.find(s => s.key === ball.release);
  advanceStory(world, fixture.state.rooms, createPlayer(world.platforms[release.platformId]), 17);
  const saved = restore(fixture);
  assert.ok(saved);
  const before = ballPosition(ball, fixture.state.rooms.story, fixture.state.elapsed);
  assert.ok(before.progress > 0 && before.progress < 1);
  assert.deepEqual(ballPosition(ball, saved.state.rooms.story, saved.state.elapsed), before);
});

// Try a real single or double jump from the near edge. Platforms between the
// source and destination participate in collision, including overhead ledges.
function canHop(from,to,tiles,room) {
  if(from===to)return true;
  const target=to.x, dir=Math.sign(target-from.x);
  const offset=Math.min(from.width/2-.45,Math.abs(target-from.x))*dir;
  if(Math.abs(target-(from.x+offset))>to.width/2+11 || to.y-from.y>9)return false;
  for(const edge of [offset,0]) for(const jumpAgain of [0,45,72,-1]) {
    const player=createPlayer(from,edge);
    player.y=platformY(from,player.x);
    let airborne=false;
    for(let i=0;i<235;i++) {
      const dx=target-player.x;
      stepPlayer(player,{direction:Math.abs(dx)<.08?0:Math.sign(dx),jump:jumpAgain>=0&&(i===0||i===jumpAgain),drop:jumpAgain===-1&&i===0},tiles,dt,{minX:room.left,maxX:room.right,minY:room.fallY,isFiniteLife:true});
      if(!player.isGrounded)airborne=true;
      if(player.ground===to)return true;
      if((airborne && player.isGrounded)||player.y<room.fallY)break;
    }
  }
  return false;
}
function pathExists(w,room,start,destination) {
  const tiles=roomTiles(w,room).filter(p=>p.isEnabled!==false), queue=[start],seen=new Set(queue);
  while(queue.length) {
    const from=queue.shift();
    if(from===destination)return true;
    for (const to of tiles) {
      if(seen.has(to))continue;
      const phases=(room.hands||[]).some(id=>id===from.id||id===to.id)?[0,1.8,4.9,6.2]:[0];
      if(!phases.some(t=>{
        for(const id of room.hands||[])movingHand(w.platforms[id],t);
        return canHop(from,to,tiles,room);
      }))continue;
      queue.push(to);seen.add(to);
    }
  }
  return false;
}
test('按机关的实际顺序，从上一个落点走到下一个机关和出口',()=>{
  for (const stage of stages) for (const seed of [1,2]) {
    const w=createRoomWorld(seed,stage),s=newRoomState(w);
    for (const room of w.rooms.filter(r=>r.stations?.length)) {
      s.roomId=room.id;
      let at=w.platforms[room.startId],elapsed=20;
      for(const st of room.stations) {
        const target=w.platforms[st.platformId];
        syncStory(w,s,elapsed);
        assert.ok(pathExists(w,room,at,target),room.name+' → '+st.label);
        const player=createPlayer(target,st.offset);
        advanceStory(w,s,player,elapsed);
        elapsed+=20;
        advanceStory(w,s,player,elapsed);
        at=target;
      }
      syncStory(w,s,elapsed);
      assert.ok(metGoals(room,s.story),room.name+' 目标未完成');
      assert.ok(pathExists(w,room,at,w.platforms[room.exitId]),room.name+' → 出口');
      assert.ok(stepRoom(w,s,createPlayer(w.platforms[room.exitId]),dt).some(e=>e.type==='clear'));
    }
  }
});

test('指针载人随转轴升降，松开方向不会滑下，错过窗台还会回来',()=>{
  const w=createRoomWorld(3,CLOCK_TOWER),s=newRoomState(w),r=w.rooms[0];
  const p=w.platforms[r.hands[0]],tiles=roomTiles(w,r);
  movingHand(p,0);
  const rider=createPlayer(p,p.width*.38);rider.y=platformY(p,rider.x);
  let low=rider.y,high=rider.y;
  for (let i=1;i<=840;i++) {
    movingHand(p,i*dt,rider);
    stepPlayer(rider,{direction:0},tiles,dt,{minX:r.left,maxX:r.right,minY:r.fallY,isFiniteLife:true});
    assert.equal(rider.ground,p);
    low=Math.min(low,rider.y);high=Math.max(high,rider.y);
    advanceStory(w,s,rider,i*dt);
  }
  assert.ok(high-low>7);assert.ok(Object.hasOwn(s.story.marks,'0/ride'));
  assert.ok(!metGoals(r,s.story));
  const net=tiles.find(t=>t.skin==='safety-net');
  const fallen=createPlayer(net,net.width*.25);
  fallen.y+=12;fallen.ground=null;fallen.isGrounded=false;
  for(let i=0;i<240 && !fallen.isGrounded;i++) {
    stepPlayer(fallen,{direction:0},[net],dt,{minX:r.left,maxX:r.right,minY:r.fallY,isFiniteLife:true});
  }
  assert.equal(fallen.ground,net);
  assert.equal(fallen.y,platformY(net,fallen.x));
  assert.ok(pathExists(w,r,net,p),'从网面还能再次搭针');
});

test('雪球途中保存后位置一致；错过岔轨可再发一次，破冰与宝物支路各只开启一次',()=>{
  const w=createRoomWorld(1,SNOW_EXPEDITION),r=w.rooms.find(r=>r.name==='岔轨雪沟'),s=newRoomState(w);
  s.roomId=r.id;
  const b=r.runs[0], station=k=>r.stations.find(x=>x.key===k), stand=k=>createPlayer(w.platforms[station(k).platformId]);
  advanceStory(w,s,stand(b.release),2);
  const saved=structuredClone(s);
  assert.deepEqual(ballPosition(b,s.story,4),ballPosition(b,saved.story,4));
  assert.ok(ballPosition(b,s.story,4).progress>0 && ballPosition(b,s.story,4).progress<1);
  advanceStory(w,s,stand(b.lever),20);
  assert.ok(Object.hasOwn(s.story.marks,b.wall));assert.ok(!(b.secret in s.story.marks));
  advanceStory(w,s,stand(b.release),21);advanceStory(w,s,stand(b.lever),42);
  assert.ok(b.secret in s.story.marks);
  const marks=structuredClone(s.story.marks);
  advanceStory(w,s,stand(b.release),49);assert.deepEqual(s.story.marks,marks);
  s.path=[0,r.id];s.cleared=[0];s.stars={0:3};
  assert.equal(isValidRoomState(s,w),false);
});
