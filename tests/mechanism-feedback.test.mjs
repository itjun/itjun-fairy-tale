import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PLAYABLE_WORLDS, WATERWAYS } from '../shared/levels.js';
import { createRoomWorld } from '../shared/room-world.js';
import { advanceStory } from '../shared/story-mechanisms.js';
import { newRoomState } from '../src/game/rooms.js';
import { createPlayer } from '../src/game/physics.js';
import { addStoryViews } from '../src/game/story-views.js';
import { fieldReaction } from '../src/game/field-reactions.js';
import { paintWind } from '../src/game/wind-streams.js';
import { GardenEngine } from '../src/game/engine.js';

test('新旧双渠都能看见水面，踩哪一渠哪一渠出水，续关时仍通水', t => {
  // 只替代木轮贴图的画布。水面、出水口、房间、触点和计时均使用游戏本身。
  const pen = Object.fromEntries(['scale','beginPath','ellipse','fill','stroke','lineTo','moveTo','closePath'].map(k=>[k,()=>{}]));
  globalThis.document = { createElement: () => ({getContext:()=>pen}) };
  t.after(()=>{ delete globalThis.document; });
  for (const stage of [WATERWAYS, PLAYABLE_WORLDS[0]]) {
    const world=createRoomWorld(42,stage), room=world.rooms.find(r=>r.name==='双渠水磨');
    const state=newRoomState(world);
    state.roomId=room.id;
    const engine=Object.assign(Object.create(GardenEngine.prototype),{
      world, scene:new THREE.Scene(), resources:[], textures:[], planeGeometry:new THREE.PlaneGeometry(),
      platformViews:new Map(world.platforms.map(p=>[p.id,new THREE.Group()])),
      players:[createPlayer(world.platforms[room.startId])], elapsed:0, textureFor:()=>null,
      spriteMaterial(name) { return this.material(new THREE.MeshBasicMaterial({name})); },
    });
    const views={engine,items:[]};
    addStoryViews(views);
    const draw=(rooms=state)=>views.items.forEach(v=>v.update(rooms,v.roomId===rooms.roomId));
    const visible = name => engine.scene.children.filter(obj=>obj.visible && obj.name===name);
    draw();
    const rivers=engine.scene.children.filter(obj=>obj.visible && obj.material?.name==='water-pond');
    assert.equal(rivers.length,1,stage.id+' 关闸时已有河水');
    assert.equal(visible('water-stream').length,0);
    const river=rivers[0], riverBox=new THREE.Box3().setFromObject(river);
    assert.ok(riverBox.max.x-riverBox.min.x > room.right-room.left-1);
    const open=[];
    for(const stop of room.stations) {
      const p=world.platforms[stop.platformId];
      assert.equal(advanceStory(world,state,createPlayer(p),engine.elapsed),stop.label);
      engine.elapsed+=.3;draw();
      const jet=visible('water-stream').find(o=>o.position.x>p.x && o.position.x<p.x+2 && o.position.y>p.y);
      assert.ok(jet,'水流从刚打开的木槽右端流出');
      open.push(jet);
      assert.ok(open.every(o=>o.visible),'先打开的水槽持续出水');
      const u=jet.material.uniforms;
      assert.ok(u.front.value>0 && u.front.value<u.duration.value,'刚开闸时水还在空中');
      engine.elapsed+=15;draw(structuredClone(state));
      assert.ok(u.front.value>=u.duration.value,'续关时水已经到达落点');
      const inPool=visible('water-impact').filter(o=>o.material.uniforms.pool.value===1);
      assert.equal(inPool.length,open.length,'每一股水最终流进河里');
      for(const splash of inPool) assert.ok(Math.abs(splash.position.y-.78-(river.position.y+1.6))<.001);
    }
    draw({...state,roomId:3});
    assert.equal(river.visible,false);
    assert.equal(visible('water-stream').length+visible('water-impact').length,0,'离开水磨后水流与水花都隐藏');
  }
});

test('各探索地图每个触点都有相应的器材、搬运、交付或载具反应', () => {
  const reactions=new Set();
  for(const stage of PLAYABLE_WORLDS) {
    const world=createRoomWorld(42,stage);
    for(const room of world.rooms) for(const stop of room.stops||[]) {
      const kind=fieldReaction(stop);
      assert.ok(kind,room.name+' '+stop.label);
      reactions.add(kind);
    }
  }
  for(const kind of ['heat','beam','flag','lever','pour','mirror','fill','carry','serve','ride','turn','signal'])
    assert.ok(reactions.has(kind),kind);
});

test('点炉、点灯、扳道岔的反馈在各自的触点出现，换房后收起', async () => {
  const { addFieldReaction }=await import('../src/game/field-reactions.js');
  const { stepField }=await import('../shared/trails/field-progress.js');
  for(const [index,key,art] of [[2,'heat','oven-flame'],[3,'beacon','lantern-beam'],[7,'spur',null]]) {
    const world=createRoomWorld(612,PLAYABLE_WORLDS[index]);
    const room=world.rooms.find(r=>r.stops.some(s=>s.key===key));
    const stop=room.stops.find(s=>s.key===key), platform=world.platforms[stop.platformId];
    const state=newRoomState(world);
    state.roomId=room.id;
    for(const dep of stop.after) state.field[room.id+'/'+dep]=1;
    const player=createPlayer(platform), engine={world,players:[player],elapsed:5,resources:[],
      scene:new THREE.Scene(),planeGeometry:new THREE.PlaneGeometry(),material:m=>m};
    const views={engine,items:[]}, scene=new THREE.Scene();
    const sprite=(name,x,y,width,height,z)=>{
      const mesh=new THREE.Object3D();mesh.name=name;mesh.scale.set(width,height,1);mesh.position.set(x,y,z);
      scene.add(mesh);return mesh;
    };
    const item=sprite(stop.icon,platform.x,platform.y,2.25,2.25,.54);
    const update=addFieldReaction(views,room,stop,item,sprite);
    update(state,true,false);
    const effect=art?scene.getObjectByName(art):item;
    if(art) assert.equal(effect.visible,false);
    else assert.ok(item.scale.x>0);
    assert.equal(stepField(world,state,player,5),stop);
    engine.elapsed=6;
    update(state,true,false);
    assert.equal(effect.visible,true);
    assert.ok(Math.abs(effect.position.x-platform.x)<10,'反馈应出现在触点旁');
    if(!art) assert.ok(item.scale.x<0,'扳柄拨向另一边');
    if(art) {
      update(state,false,false);
      assert.equal(effect.visible,false);
      if(key==='heat') for(const plume of engine.scene.children) assert.equal(plume.visible,false);
      update(structuredClone(state),true,false);
      assert.equal(effect.visible,true,'再进房间时保持点亮');
      if(key==='heat') {
        assert.deepEqual(engine.scene.children.map(m=>m.name),['particles-vapor','particles-ember']);
        for(const plume of engine.scene.children) {
          assert.equal(plume.visible,true);
          assert.equal(plume.material.uniforms.clock.value,1);
        }
        engine.isReducedMotion=true;
        engine.elapsed+=2;
        update(state,true,false);
        for(const plume of engine.scene.children) assert.equal(plume.material.uniforms.clock.value,0);
      }
    }
  }
});

test('风场解锁后按实际风向绘制，减少动态时保持方向，离开房间时收起', () => {
  const engine={scene:new THREE.Scene(),resources:[],planeGeometry:new THREE.PlaneGeometry(),
    material:m=>m,players:[{x:0}],elapsed:2};
  const views={engine,items:[],paper:()=>({mesh:new THREE.Object3D(),draw(){}})};
  const room={id:3,stops:[],wind:[{x:0,y:0,width:5,height:6,dx:-6,dy:2,after:'flag'}]};
  paintWind(views,room);
  const [particles,arrow]=engine.scene.children;
  const update=(field,here)=>views.items[0].update({field},here);
  update({},true);
  assert.equal(particles.visible,false);
  const field={'3/flag':1};
  update(field,true);
  assert.ok(particles.visible && arrow.visible && particles.geometry.isInstancedBufferGeometry);
  assert.deepEqual(particles.material.uniforms.flow.value.toArray(),[-6,2]);
  assert.equal(arrow.rotation.z,Math.atan2(2,-6));
  assert.equal(particles.material.uniforms.clock.value,2);
  engine.isReducedMotion=true;
  update(field,true);
  const still=particles.material.uniforms.clock.value;
  engine.elapsed=7;update(field,true);
  assert.equal(particles.material.uniforms.clock.value,still);
  update(field,false);
  assert.equal(particles.visible || arrow.visible,false);
});
