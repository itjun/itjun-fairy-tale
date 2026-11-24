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
      players:[createPlayer(world.platforms[room.startId])], elapsed:0,
      spriteMaterial(name) { return this.material(new THREE.MeshBasicMaterial({name})); },
    });
    const views={engine,items:[]};
    addStoryViews(views);
    const draw=(rooms=state)=>views.items.forEach(v=>v.update(rooms,v.roomId===rooms.roomId));
    const bodies=engine.scene.children.filter(obj=>obj.material?.name==='water-pond' && obj.geometry!==engine.planeGeometry);
    const visibleWater=()=>bodies.filter(obj=>obj.visible);
    draw();
    assert.equal(visibleWater().length,1,stage.id+' 关闸时已有河水');
    const river=visibleWater()[0];
    const riverBox=new THREE.Box3().setFromObject(river);
    assert.ok(riverBox.max.x-riverBox.min.x > room.right-room.left-1);
    for(const [i,stop] of room.stations.entries()) {
      const p=world.platforms[stop.platformId];
      assert.equal(advanceStory(world,state,createPlayer(p),engine.elapsed),stop.label);
      engine.elapsed+=.15;draw();
      const jet=visibleWater().at(-1);
      assert.equal(visibleWater().length,2+i);
      const box=new THREE.Box3().setFromObject(jet);
      assert.ok(box.min.x>p.x && box.min.x<p.x+2,'水流从木槽右端流出');
      assert.ok(box.max.y>p.y && box.min.y<=riverBox.max.y,'水能落进河里');
      const partial=jet.geometry.drawRange.count;
      assert.ok(partial>0 && partial<jet.geometry.index.count);
      engine.elapsed+=2;draw(structuredClone(state));
      assert.equal(jet.geometry.drawRange.count,jet.geometry.index.count,'续关保留已经放出的水');
    }
    draw({...state,roomId:3});
    assert.equal(visibleWater().length,0,'离开水磨时水面和出水口一起隐藏');
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
    const player=createPlayer(platform), engine={world,players:[player],elapsed:5};
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
      update(structuredClone(state),true,false);
      assert.equal(effect.visible,true,'再进房间时保持点亮');
    }
  }
});
