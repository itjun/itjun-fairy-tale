import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PLAYABLE_WORLDS, WATERWAYS } from '../shared/levels.js';
import { createRoomWorld } from '../shared/room-world.js';
import { advanceStory } from '../shared/story-mechanisms.js';
import { newRoomState } from '../src/game/rooms.js';
import { createPlayer } from '../src/game/physics.js';
import { addStoryViews } from '../src/game/story-views.js';
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
