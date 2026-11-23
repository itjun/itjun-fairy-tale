import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomWorld } from '../shared/room-world.js';
import { PLAYABLE_WORLDS } from '../shared/levels.js';
import { fieldThemes } from '../shared/trails/themes.js';
import { fieldComplete, fieldMotion, stepField, syncField, validField } from '../shared/trails/field-progress.js';
import { newRoomState, stepRoom } from '../src/game/rooms.js';
import { createPlayer, platformY, stepPlayer } from '../src/game/physics.js';
import { readAdventure } from '../src/game/save.js';
import { roomFixture } from './helpers/adventure-fixtures.mjs';
import { openStore } from '../server/store.mjs';

function jump(from,to,tiles,r) {
  const dt=1/120,dx=to.x-from.x;
  const edge=Math.sign(dx)*Math.min(Math.abs(dx),from.width/2-.42);
  if(Math.abs(dx-edge)>to.width/2+12 || to.y-from.y>9.1)return false;
  for(const offset of [edge,0])for(const second of [46,68,23,-1]) {
    const p=createPlayer(from,offset);
    p.y=platformY(from,p.x);
    let left=false;
    for(let i=0;i<235;i++) {
      const direction=Math.abs(to.x-p.x)<.06?0:Math.sign(to.x-p.x);
      stepPlayer(p,{direction,jump:second>=0&&(i===0||i===second),drop:second===-1&&i===0},tiles,dt,{minX:r.left,maxX:r.right,minY:r.fallY,isFiniteLife:true});
      if(p.ground===to)return true;
      if(left&&p.isGrounded||p.y<r.fallY)break;
      left ||= !p.isGrounded;
    }
  }
  return false;
}

function reachable(w,r,state,start,goal,elapsed) {
  const tiles=r.platformIds.map(id=>w.platforms[id]).filter(p=>p.isEnabled!==false);
  const todo=[start],seen=new Set(todo);
  while(todo.length) {
    const from=todo.shift();
    if(from===goal)return true;
    for(const to of tiles) {
      if(seen.has(to))continue;
      const moving=r.moving.filter(m=>m.platformId===from.id||m.platformId===to.id);
      const times=moving.length?Array.from({length:13},(_,i)=>elapsed+i*moving[0].period/12):[elapsed];
      if(times.some(t=>{
        syncField(w,state,t);
        for(const p of tiles){p.deltaX=0;p.deltaY=0;}
        return jump(from,to,tiles,r);
      })) {seen.add(to);todo.push(to);}
    }
  }
  return false;
}
for(const theme of fieldThemes) test(theme.title+'：两组种子逐段走到每个机关，开门并读回存档',()=>{
  const store=openStore(':memory:');
  try {
    assert.ok(PLAYABLE_WORLDS.some(s=>s.id===theme.id));
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
