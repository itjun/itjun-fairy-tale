import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYABLE_WORLDS, WATERWAYS } from '../shared/levels.js';
import { createRoomWorld } from '../shared/room-world.js';
import { advanceStory, metGoals, syncStory } from '../shared/story-mechanisms.js';
import { newRoomState, stepRoom, isValidRoomState } from '../src/game/rooms.js';
import { createPlayer, platformY, stepPlayer } from '../src/game/physics.js';
import { roomFixture } from './helpers/adventure-fixtures.mjs';
import { readAdventure } from '../src/game/save.js';
import { openStore } from '../server/store.mjs';

const stages=[WATERWAYS], dt=1/120;
const roomTiles=(world,room)=>room.platformIds.map(id=>world.platforms[id]);
test('探险世界八个区段分别进入选关、成绩与续关，旧地图继续可读',()=>{
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

test('写入及重读探险世界的首领房和终点', () => {
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
      if(!canHop(from,to,tiles,room))continue;
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
