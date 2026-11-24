import test from 'node:test';
import assert from 'node:assert/strict';
import { FLOWER_VALLEY, WATERWAYS, PLAYABLE_WORLDS } from '../shared/levels.js';
import { createRoomWorld } from '../shared/room-world.js';
import { canLeaveValley, newWaterState, syncWaterRoutes, waterUnderfoot } from '../shared/flower-valley.js';
import { createPlayer, rescue, stepPlayer } from '../src/game/physics.js';
import { doorAt, encounterBarrier, enterDoor, newRoomState, stepRoom } from '../src/game/rooms.js';
import { headless } from './helpers/headless-engine.mjs';
import { roomFixture } from './helpers/adventure-fixtures.mjs';
import { readAdventure, writeAdventure } from '../src/game/save.js';
import { openStore } from '../server/store.mjs';

const dt = 1 / 120;
test('四位角色从岸边出发，用普通跳跃走完两种河谷和两条引水路线', () => {
  for (const seed of [1, 2]) for (const side of ['flower','pond']) for (const character of ['dad','mom','sister','little']) {
    const world = createRoomWorld(seed, FLOWER_VALLEY), room = world.rooms[0];
    const water = newWaterState(), tiles = room.platformIds.map(id => world.platforms[id]);
    const player = createPlayer(world.start, -2);
    player.character = character;
    let elapsed = 0;
    const frame = (direction, jump = false, drop = false) => {
      elapsed += dt;
      stepPlayer(player, { direction, jump, drop }, tiles, dt, { minX: room.left, maxX: room.right, minY: room.fallY, isFiniteLife:true });
      waterUnderfoot(world, water, player, elapsed);
      syncWaterRoutes(world, water, elapsed);
      assert.ok(player.y >= room.fallY, character + ' fell at ' + player.x);
    };
    const walk = x => {
      for (let i = 0; i < 400 && Math.abs(player.x-x) > .04; i++) frame(Math.sign(x-player.x));
    };
    const hop = target => {
      const from = player.ground;
      const direction = Math.sign(target.x - from.x);
      const edge = from.x + direction * (from.width/2 - .4);
      walk(direction > 0 ? Math.min(target.x,edge) : Math.max(target.x,edge));
      frame(Math.sign(target.x-player.x),true);
      for (let i=0; i<240 && !player.isGrounded; i++) frame(Math.abs(target.x-player.x)<.04 ? 0 : Math.sign(target.x-player.x));
      assert.equal(player.ground?.id, target.id, world.valley.layout+' '+side+' from '+from.x+','+from.y+' to '+target.x+','+target.y+' landed '+player.x+','+player.y);
      walk(target.x);
    };
    const control = key => world.valley.controls.find(item=>item.channel === key);
    const at = (x,y) => tiles.find(p=>p.x === x && p.y === y);
    walk(2); for (let i=0;i<140;i++) frame(0);
    hop(tiles.find(p=>p.channel === 'demo'));
    hop(at(18,0));
    hop(world.platforms[control(side).platformId]);
    for (let i=0;i<220;i++) frame(0);
    assert.equal(water.flow,side);
    frame(0,false,true);
    for (let i=0;i<100 && !player.isGrounded;i++) frame(0);
    const path = tiles.filter(p=>p.channel === side);
    for (const p of path) hop(p);
    if (world.valley.layout === 'aqueduct') {
      if (side === 'pond') for (const [x,y] of [[63,.5],[68,3],[63,5.6],[57,8.1]]) hop(at(x,y));
      for (const [x,y] of [[50.8,10.4],[44.4,12.8],[36.2,14.4],[25.7,14.4]]) hop(at(x,y));
      walk(control('bridge').x);
      for (let i=0;i<160;i++) frame(0);
      for (const p of tiles.filter(p=>p.channel === 'bridge')) hop(p);
    }
    hop(world.platforms[room.exitId]);
    assert.ok(canLeaveValley(world,water));
    const state = newRoomState(world);
    state.water = water;
    assert.ok(stepRoom(world,state,player,dt).some(event=>event.type === 'clear'));
    walk(world.platforms[room.exitId].x + world.doors[0].offsetX);
    enterDoor(world,state,doorAt(world,state,player));
    assert.equal(state.roomId,1);
    assert.ok(encounterBarrier(world,state));
    for (const id of world.rooms[1].enemyIds) world.enemies[id-1].isDefeated = true;
    assert.equal(encounterBarrier(world,state),null);
    assert.ok(stepRoom(world,state,player,dt).some(event=>event.type === 'clear'));
    assert.equal(world.rooms[1].reward,'upgrade');
    assert.ok(world.platforms.some(p=>p.roomId === 2 && p.channel === side && p.isEnabled));
    assert.equal(world.enemies.at(-1).skills[0].kind,'wave');
  }
});

test('重踩水槽与读档保留最早的浇水时间', () => {
  const {run,state}=roomFixture('room', FLOWER_VALLEY.id, {seed:1});
  const world=createRoomWorld(run.seed,FLOWER_VALLEY);
  const controls=world.valley.controls;
  const water=state.rooms.water;
  const trigger = (key, time) => {
    const item=controls.find(c=>c.channel===key);
    const p=world.platforms[item.platformId];
    return waterUnderfoot(world,water,createPlayer(p,item.x-p.x),time);
  };
  assert.equal(trigger('bridge',1),null);
  trigger('demo',2); trigger('flower',3); trigger('pond',5);
  assert.equal(trigger('pond',6),null);
  assert.equal(trigger('flower',7),'flower');
  assert.equal(water.flower,3);
  const store=new Map();
  const storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
  state.elapsed=7.2;
  writeAdventure(run,state,storage);
  const restored=readAdventure(storage);
  assert.deepEqual(restored.state.rooms.water,water);
  syncWaterRoutes(world,water,state.elapsed);
  const latest=world.platforms.filter(p=>p.channel==='flower' || p.channel==='pond');
  assert.ok(latest.every(p=>p.isEnabled));
  assert.ok(!world.platforms.find(p=>p.channel==='bridge').isEnabled);
  state.rooms.water.pond=20;
  writeAdventure(run,state,storage);
  assert.equal(readAdventure(storage),null);
});

test('两路都浇水时首领庭院上下重叠的跳台之间留一层净空', () => {
  const world = createRoomWorld(1, FLOWER_VALLEY);
  const perches = world.platforms.filter(p => p.roomId === 2 && p.channel);
  for (const p of perches) for (const q of perches) {
    if (p.id < q.id && Math.abs(p.x-q.x) < (p.width+q.width)/2) assert.ok(Math.abs(p.y-q.y) >= 2.4);
  }
});

test('掉坑与扣命后在已长出的荷叶恢复，回到游戏仍能站稳', () => {
  const game = headless('room', FLOWER_VALLEY.id);
  const player = game.players[0];
  for (const channel of ['demo', 'pond']) {
    const control = game.world.valley.controls.find(item => item.channel === channel);
    rescue(player, game.platforms[control.platformId], control.x);
    game.stepRooms(player, {});
    game.elapsed += 2;
  }
  syncWaterRoutes(game.world, game.roomState.water, game.elapsed);
  const lily = game.platforms.find(tile => tile.roomId === 0 && tile.channel === 'pond');
  rescue(player, lily);
  const water = structuredClone(game.roomState.water);
  player.y = -10;
  player.isGrounded = false;
  game.hurt(true);
  assert.equal(player.ground, lily);
  game.survival.hp = 1;
  game.hurt(false, 200);
  assert.equal(game.survival.phase, 'fallen');
  assert.equal(game.isPaused, true);
  const restored = headless('room', FLOWER_VALLEY.id);
  restored.restoreState(game.exportState());
  assert.ok(restored.revive());
  const safe = restored.players[0].ground;
  assert.equal(safe.id, lily.id);
  assert.ok(safe.isEnabled);
  assert.deepEqual(restored.roomState.water, water);
  assert.equal(restored.survival.lives, 2);
});

test('新冒险入口与旧河谷续关、成绩使用各自的地图', () => {
  assert.equal(PLAYABLE_WORLDS[0].baseId,WATERWAYS.id);
  const store=openStore(':memory:');
  try {
    for (const id of ['rainbow-world',FLOWER_VALLEY.id]) {
      const {run,state}=roomFixture('room',id);
      const world=createRoomWorld(run.seed,id);
      const storage={getItem:()=>JSON.stringify({run,state}),removeItem(){}};
      assert.equal(readAdventure(storage).run.levelId,id);
      assert.equal(store.save(run).levelId,id);
      assert.equal(world.zones.length,id === FLOWER_VALLEY.id ? 3 : 5);
    }
  } finally { store.close(); }
});
