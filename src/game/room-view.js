import { addForestViews } from './forest-view.js';
import * as THREE from 'three';
import { DOOR_REWARDS, TILE_COLORS, doorPosition, spotPosition } from '../../shared/room-world.js';
import { ELITE_TRAITS } from '../../shared/monster-roles.js';
import { SHOP_ITEMS } from './room-rewards.js';
import { currentRoom, dropPosition, isRoomCleared, isStallSold, encounterBarrier } from './rooms.js';

const FONT = 'GardenHand, "Kaiti SC", "KaiTi", sans-serif';
const CARD_FACES = ['collectible-heart', 'collectible-star', 'collectible-rainbow'];
export const ROOM_IMAGES = ['boss-gate', 'boss-chest', 'supply-medkit', ...CARD_FACES, ...Object.values(DOOR_REWARDS).map(item => item.image), ...Object.values(SHOP_ITEMS).map(item => item.image)];

// 门牌、摊位牌、精英名字都画在场景里的纸片上，跟着镜头走，不会和画面错位。
export class RoomViews {
  constructor(engine) {
    this.engine = engine;
    this.items = [];
    const world = engine.world;
    if (world.forest) addForestViews(this);
    for (const door of world.doors) {
      const spot = doorPosition(world, door);
      const gate = engine.sprite(engine.material(engine.bossGateMaterial.clone()), spot.x, spot.y + 1.7, 3.3, 3.3, -0.3);
      const glow = this.glow(spot.x, spot.y + 1.7);
      // 两扇门长得一样，不写字。能进去的时候才发光，跳上去就进。
      this.items.push({ roomId: door.roomId, update: (state, isCurrent) => {
        const home = world.rooms[door.roomId];
        const isWaiting = DOOR_REWARDS[home.reward]?.isChoice && !engine.journey.claimed.includes(`room:${engine.levelKey}:${home.id}`);
        const isOpen = isCurrent && isRoomCleared(state) && !isWaiting;
        gate.visible = isCurrent;
        glow.visible = isOpen;
        gate.material.color.set(isOpen ? '#fff6c2' : '#6e675e');
        const pulse = isOpen && !engine.isReducedMotion ? 1 + Math.sin(engine.elapsed * 5) * 0.08 : 1;
        gate.scale.set(3.3 * pulse, 3.3 * pulse, 1);
        glow.scale.set(5.4 * pulse, 5.4 * pulse, 1);
        glow.material.opacity = isOpen ? 0.55 + (pulse - 1) * 2 : 0;
      } });
    }
    for (const room of world.rooms) {
      for (const encounter of room.encounters || []) this.addBarrier(room, encounter);
      const spot = dropPosition(world, room);
      if (room.reward && !DOOR_REWARDS[room.reward].isChoice) {
        const drop = engine.sprite(engine.spriteMaterial(DOOR_REWARDS[room.reward].image), spot.x, spot.y, 1.5, 1.5, 0.7);
        this.items.push({ roomId: room.id, update: (state, isCurrent) => {
          drop.visible = isCurrent && state.drops.some(item => item.roomId === room.id && !item.isTaken);
          drop.position.y = spot.y + (engine.isReducedMotion ? 0 : Math.sin(engine.elapsed * 2.5) * 0.15);
        } });
      }
      if (room.kind === 'puzzle') this.addPuzzle(room, spot);
      for (const stall of room.stalls || []) this.addStall(room, stall);
    }
    for (const enemy of world.enemies.filter(item => item.trait)) {
      const sign = this.paper(enemy.x, enemy.y, 2.6, 0.9, 208, 72);
      sign.draw('trait', (context, width) => this.text(context, ELITE_TRAITS[enemy.trait].name, width / 2, 50, 40, '#a0465f'));
      this.items.push({ roomId: enemy.roomId, update: (state, isCurrent) => {
        sign.mesh.visible = isCurrent && !enemy.isDormant && !enemy.isDefeated && !enemy.isHidden;
        sign.mesh.position.set(enemy.x, enemy.y + enemy.height + 1.3, 1.2);
        // 带盾的精英，盾还在时整只发蓝。
        if (enemy.hasShell && !enemy.isDefeated) engine.enemyViews.get(enemy.id).material.color.set('#9fd8ff');
      } });
    }
  }
  addBarrier(room, encounter) {
    const engine = this.engine, floor = engine.world.platforms[encounter.endId];
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 576;
    const context = canvas.getContext('2d');
    context.lineCap = 'round'; context.lineWidth = 12;
    for (const [offset, color] of [[0, '#c88ba6'], [2, '#e6b1c4']]) {
      context.strokeStyle = color; context.beginPath();
      context.moveTo(28 + offset, 562); context.lineTo(32 + offset, 18);
      context.moveTo(100 + offset, 562); context.lineTo(96 + offset, 18);
      for (let y = 38; y < 490; y += 94) {
        context.moveTo(28, y); context.lineTo(100, y + 74);
        context.moveTo(100, y); context.lineTo(28, y + 74);
      }
      context.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; engine.textures.push(texture);
    const mesh = engine.sprite(engine.material(new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })), floor.x + 2, floor.y + 4.5, 2, 9, 0.7);
    this.items.push({ roomId: room.id, update: (state, isCurrent) => {
      mesh.visible = isCurrent && encounterBarrier(engine.world, state, engine.difficulty.isExtraWave)?.endId === encounter.endId;
    } });
  }
  addPuzzle(room, chestSpot) {
    const engine = this.engine, world = engine.world, puzzle = room.puzzle;
    const chest = engine.sprite(engine.bossChestMaterial, chestSpot.x, chestSpot.y - 0.2, 2.4, 1.85, 0.6);
    this.items.push({ roomId: room.id, update: (state, isCurrent) => { chest.visible = isCurrent && !isRoomCleared(state, room.id); } });
    if (puzzle.kind === 'tiles') {
      const floor = world.platforms[room.floorId];
      const sign = this.paper(floor.x, floor.y + 6.6, 7, 1.9, 560, 152);
      const pads = puzzle.tiles.map(tile => {
        const platform = world.platforms[tile.platformId];
        const material = engine.material(new THREE.MeshBasicMaterial({ color: TILE_COLORS[tile.color], transparent: true }));
        return { tile, mesh: engine.sprite(material, platform.x, platform.y + 0.22, platform.width - 0.3, 0.5, 0.8) };
      });
      this.items.push({ roomId: room.id, update: (state, isCurrent) => {
        const step = isRoomCleared(state, room.id) ? puzzle.order.length : isCurrent ? state.puzzle.step : 0;
        sign.mesh.visible = isCurrent;
        for (const pad of pads) {
          pad.mesh.visible = isCurrent;
          pad.mesh.material.opacity = puzzle.order.indexOf(pad.tile.color) < step ? 1 : 0.55;
        }
        sign.draw(`${step}`, context => {
          this.text(context, '按顺序踩', 96, 92, 38);
          puzzle.order.forEach((color, index) => {
            const x = 220 + index * 84;
            context.beginPath(); context.arc(x, 76, 30, 0, Math.PI * 2);
            context.fillStyle = TILE_COLORS[color]; context.fill();
            context.lineWidth = 5; context.strokeStyle = '#5c4a3a'; context.stroke();
            this.text(context, index < step ? '✓' : `${index + 1}`, x, 90, 36, '#ffffff');
          });
        });
      } });
    }
    if (puzzle.kind === 'cards') {
      const cards = puzzle.cards.map((card, index) => {
        const spot = spotPosition(world, card);
        return { index, face: card.face, sign: this.paper(spot.x, spot.y, 1.5, 1.9, 120, 152) };
      });
      this.items.push({ roomId: room.id, update: (state, isCurrent) => {
        const isDone = isRoomCleared(state, room.id);
        for (const card of cards) {
          card.sign.mesh.visible = isCurrent;
          const isMatched = isDone || isCurrent && state.puzzle.matched.includes(card.index), isOpen = isMatched || isCurrent && state.puzzle.open.includes(card.index);
          card.sign.draw(`${isOpen}:${isMatched}`, (context, width, height) => {
            if (isOpen) context.drawImage(engine.textureFor(CARD_FACES[card.face]).image, 16, 32, width - 32, width - 32);
            else this.text(context, '？', width / 2, height / 2 + 26, 72, '#b98a5a');
            if (isMatched) { context.lineWidth = 10; context.strokeStyle = '#7fb069'; context.strokeRect(8, 8, width - 16, height - 16); }
          });
        }
      } });
    }
    if (puzzle.kind === 'keys') {
      const keys = puzzle.keys.map((key, index) => {
        const spot = spotPosition(world, key);
        const material = engine.material(engine.starMaterial.clone());
        material.color.set('#ffd84d');
        return { index, spot, mesh: engine.sprite(material, spot.x, spot.y, 1.4, 1.4, 0.7) };
      });
      this.items.push({ roomId: room.id, update: (state, isCurrent) => {
        for (const key of keys) {
          key.mesh.visible = isCurrent && !isRoomCleared(state, room.id) && !state.puzzle.found.includes(key.index);
          key.mesh.rotation.z = engine.isReducedMotion ? 0 : Math.sin(engine.elapsed * 3 + key.index) * 0.25;
        }
      } });
    }
  }
  addStall(room, stall) {
    const engine = this.engine, item = SHOP_ITEMS[stall.id], spot = spotPosition(engine.world, stall);
    const goods = engine.sprite(engine.spriteMaterial(item.image), spot.x, spot.y + 1.2, 1.7, 1.7, 0.4);
    const sign = this.paper(spot.x, spot.y + 3.2, 3.6, 1.6, 324, 144);
    this.items.push({ roomId: room.id, update: (state, isCurrent) => {
      goods.visible = sign.mesh.visible = isCurrent;
      if (!isCurrent) return;
      const isSold = isStallSold(state, stall);
      goods.material.opacity = isSold ? 0.3 : 1;
      sign.draw(`${isSold}`, (context, width) => {
        this.text(context, item.name, width / 2, 58, 44);
        this.text(context, isSold ? '卖完了' : `${item.price} 片碎片`, width / 2, 112, 36, isSold ? '#a09482' : '#8a6a4c');
      });
    } });
  }
  glow(x, y) {
    const engine = this.engine, canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(64, 64, 8, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255, 236, 140, 0.95)');
    gradient.addColorStop(1, 'rgba(255, 236, 140, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    engine.textures.push(texture);
    const mesh = engine.sprite(engine.material(new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })), x, y, 5.4, 5.4, -0.45);
    mesh.visible = false;
    return mesh;
  }
  text(context, value, x, y, size, color = '#5c4a3a', align = 'center') {
    context.font = `${size}px ${FONT}`;
    context.textAlign = align;
    context.fillStyle = color;
    context.fillText(value, x, y);
  }
  // 一张彩笔描边的小纸片。draw 只在内容变了的时候重画。
  paper(x, y, width, height, pixelWidth, pixelHeight) {
    const engine = this.engine, canvas = document.createElement('canvas');
    canvas.width = pixelWidth; canvas.height = pixelHeight;
    const context = canvas.getContext('2d'), texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    engine.textures.push(texture);
    const mesh = engine.sprite(engine.material(new THREE.MeshBasicMaterial({ map: texture, transparent: true })), x, y, width, height, 1.1);
    let drawn = null;
    return { mesh, draw(key, paint) {
      if (drawn === key) return;
      drawn = key;
      context.clearRect(0, 0, pixelWidth, pixelHeight);
      context.beginPath(); context.roundRect(5, 5, pixelWidth - 10, pixelHeight - 10, 22);
      context.fillStyle = '#fffaf0'; context.fill();
      context.lineWidth = 6; context.strokeStyle = '#6b5a45'; context.stroke();
      paint(context, pixelWidth, pixelHeight);
      texture.needsUpdate = true;
    } };
  }
  update() {
    const state = this.engine.roomState, room = currentRoom(this.engine.world, state);
    for (const item of this.items) item.update(state, item.roomId === room.id);
  }
}
