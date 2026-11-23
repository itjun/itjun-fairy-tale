import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomWorld } from '../shared/room-world.js';
import { PLAYABLE_WORLDS } from '../shared/levels.js';
import { pushInWind } from '../shared/trails/wind.js';
import { fieldThemes } from '../shared/trails/themes.js';
import { fieldComplete, fieldMotion, stepField, syncField, validField } from '../shared/trails/field-progress.js';
import { newRoomState, stepRoom } from '../src/game/rooms.js';
import { createPlayer, platformY, stepPlayer } from '../src/game/physics.js';
import { readAdventure } from '../src/game/save.js';
import { roomFixture } from './helpers/adventure-fixtures.mjs';
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
        return jump(from,to,tiles,r,state);
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
