import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PLAYABLE_WORLDS } from '../shared/levels.js';
import { createRoomWorld } from '../shared/room-world.js';
import { waterCourse } from '../src/game/water-course.js';
import { gutterLip } from '../src/game/water-gutter.js';
import { addChannelWater } from '../src/game/channel-water.js';

const near = (a,b) => assert.ok(Math.abs(a-b)<1e-5, a+' 与 '+b+' 不一致');

test('回流蓄水池开闸后先打在下一片荷叶，再从叶尖逐层流到池里',()=>{
  const world=createRoomWorld(41,PLAYABLE_WORLDS[0]);
  const room=world.rooms.find(r=>r.name==='回流蓄水池');
  const tiles=room.platformIds.map(id=>world.platforms[id]);
  const gate=room.stations.find(s=>s.key.endsWith('/crest'));
  const mount=world.platforms[gate.platformId];
  for(const p of tiles) p.isEnabled=true;
  const source=gutterLip(mount.x,mount.y,3.5,1.55);
  const surface=room.bottom-.75;
  const parts=waterCourse(source,tiles,surface);
  const firstLeaf=tiles.find(p=>p!==mount && p.needsMark===mount.needsMark && Math.abs(p.x-mount.x-8)<.01);
  const [jet,sheet,overflow]=parts;
  assert.ok(jet.gravity>0 && jet.vy<0);
  assert.ok(sheet.isSheet && Math.abs(sheet.y-firstLeaf.y)<.32);
  assert.ok(overflow.y<sheet.y);
  assert.ok(Math.abs(sheet.x-firstLeaf.x)<firstLeaf.width/2);
  near(overflow.x,firstLeaf.x+firstLeaf.width/2);
  for(const [i,part] of parts.entries()) {
    const t=part.duration, next=parts[i+1];
    const endY=part.y+part.vy*t-.5*part.gravity*t*t;
    if (!next) { near(endY,surface); break; }
    near(part.x+part.vx*t,next.x);
    near(endY,next.y);
    near(part.start+t,next.start);
  }
  firstLeaf.isEnabled=false;
  assert.ok(waterCourse(source,tiles,surface)[0].duration>jet.duration);
});

test('斜面把水往低端引，其他洞层的平台接不到这股水',()=>{
  const source={x:0,y:4,vx:2,vy:-.5,caveId:'A'};
  const platform={x:1,y:2,width:4,slope:.18,caveId:'A'};
  const other={...platform,y:3,caveId:'B'};
  const [,sheet,spill]=waterCourse(source,[other,platform],0);
  assert.ok(sheet.vx<0);
  near(spill.x,-1);
  near(spill.y,platform.y-platform.width/2*platform.slope);
});

test('水花与水位等水到达才变化，暂停、续关和减少动态效果都保留正确的落点',()=>{
  const g={resources:[], scene:new THREE.Scene(), planeGeometry:new THREE.PlaneGeometry(),
    world:{platforms:[]},players:[{safe:{}}],textureFor:()=>null,material:m=>m};
  const views={engine:g,items:[]};
  const source={x:0,y:3,vx:3,at:state=>state.start};
  addChannelWater(views,{id:0,platformIds:[]},[source],{left:-8,right:8,surface:0,depth:2});
  const update=(elapsed,start=10,here=true)=>{g.elapsed=elapsed;views.items[0].update({start},here);};
  const river=g.scene.children[0];
  update(9,null);
  assert.equal(g.scene.children.filter(o=>o.visible).length,1);
  const time=waterCourse(source,[],0)[0].duration;
  update(10+time/2);
  const [,stream,splash]=g.scene.children;
  assert.ok(stream.visible && !splash.visible);
  near(river.position.y,-1);
  update(10+time+.13);
  assert.ok(splash.visible && river.position.y>-1);
  near(splash.position.y-.78,river.position.y+1);
  const at=splash.material.uniforms.clock.value;
  update(10+time+.13);
  near(splash.material.uniforms.clock.value,at);
  update(14,10,false);
  assert.ok(g.scene.children.every(o=>!o.visible));
  update(14);
  assert.ok(splash.visible);
  near(splash.position.y-.78,.45);
  g.isReducedMotion=true;
  update(10.01);
  const still=splash.material.uniforms.clock.value;
  update(19);
  near(splash.material.uniforms.clock.value,still);
  g.players[0].safe.caveId='别的洞';
  update(19);
  assert.ok(g.scene.children.every(o=>!o.visible));
});
