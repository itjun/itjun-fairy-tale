import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import sharp from 'sharp';
import { createCampaignWorld } from '../shared/campaign.js';
import { GardenEngine } from '../src/game/engine.js';

async function material(name) {
  const {width,height}=await sharp(new URL(`../public/assets/${name}.png`,import.meta.url).pathname).metadata();
  const map=new THREE.Texture({width,height});
  return new THREE.MeshBasicMaterial({map,transparent:true,alphaTest:.08});
}
async function renderPlatforms(world,platforms) {
  const awning=await material('platform-awning'),rock=await material('terrain-rock');
  const game=Object.assign(Object.create(GardenEngine.prototype),{
    world:{version:5,platforms,hazards:[],supplies:[],treasures:[],enemies:[],springs:[],switches:[],decorations:[],finish:world.finish},
    level:{id:'family'},platforms,scene:new THREE.Scene(),platformViews:new Map(),
    planeGeometry:new THREE.PlaneGeometry(1,1),awningMaterial:awning,terrainMaterials:{rock},flagMaterial:awning,
  });
  game.buildWorld();game.scene.updateMatrixWorld(true);
  return {game,platforms,meshes:platforms.map(p=>game.platformViews.get(p.id).children[0])};
}
async function renderStart() {
  const world=createCampaignWorld(42,'family-3',5);
  return renderPlatforms(world,[world.start,world.platforms[world.forks[0].routes[1].platformIds[0]]]);
}

test('钟楼主路与高处支路有稳定前后层级，不用相同深度争抢同一像素',async()=>{
  // 种子 1 的主路与高路在同一高度汇合，缩短贴图也不能消除这处重叠。
  const world=createCampaignWorld(1,'family-3',5);
  const {meshes}=await renderPlatforms(world,[world.platforms[3],world.platforms[12]]);
  const [top,lower]=meshes.map(mesh=>new THREE.Box3().setFromObject(mesh));
  const isOverlapping=top.min.x<lower.max.x&&top.max.x>lower.min.x&&top.min.y<lower.max.y&&top.max.y>lower.min.y;
  assert.ok(isOverlapping,'测试必须覆盖实际互相重叠的贴图');
  assert.ok(Math.abs(top.min.z-lower.min.z)>.0001||meshes.every(mesh=>!mesh.material.depthWrite),
    `重叠贴图深度相同：${top.min.z} / ${lower.min.z}，移动镜头时会争抢像素`);
});

test('宽平台只露出一部分时仍绘制，不因中心离开镜头就突然消失',async t=>{
  const world=createCampaignWorld(42,'family-3',5),floor=world.platforms[world.bossArenas[0].floorId];
  const {game}=await renderPlatforms(world,[floor]);
  const cameraX=floor.x-25,character=new THREE.Mesh(game.planeGeometry,game.awningMaterial);
  Object.assign(game,{isReady:true,isPaused:true,lastTime:0,lastPublish:0,elapsed:0,cameraX,cameraY:4,
    camera:new THREE.OrthographicCamera(-12,12,9,-9,.1,150),players:[{x:cameraX-3,y:0,facing:1}],survival:{character:'dad'},
    journey:{},combatLoot:{drops:[]},backdrops:[],bossSwitchViews:new Map(),skillEffects:{update(){}},waves:[],enemyShots:[],enemyShotViews:new Map(),
    playerViews:[character],characterMaterials:{dad:{standing:game.awningMaterial}},talentView:character,treasureViews:new Map(),renderer:{render(){}}});
  const original=globalThis.requestAnimationFrame;globalThis.requestAnimationFrame=()=>0;
  t.after(()=>{if(original===undefined)delete globalThis.requestAnimationFrame;else globalThis.requestAnimationFrame=original;});
  game.animate(16);
  assert.ok(floor.x-floor.width/2<game.cameraX+game.camera.right,'平台边缘位于画面内');
  assert.ok(game.platformViews.get(floor.id).visible,'平台仍在画面内，不能突然隐藏');
});

test('宽地面不会把整张图片等比撑高并盖住地下支路的落脚面',async()=>{
  const {game,platforms}=await renderStart();
  const upper=new THREE.Box3().setFromObject(game.platformViews.get(platforms[0].id));
  assert.ok(upper.min.y>platforms[1].y+.25,`起点图片延伸到 ${upper.min.y}，支路台面位于 ${platforms[1].y}`);
});
