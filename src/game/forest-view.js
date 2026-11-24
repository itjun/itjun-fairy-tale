import { FOLLOWING, FOREST_TRAILS, HOME } from '../../shared/forest-rescue.js';

// 地形、碰撞与任务共用同一处落脚点，换种子时路牌、鸟和捷径跟着一起移动。
export function addForestViews(views) {
  const engine = views.engine, world = engine.world, forest = world.forest;
  const materials = new Map();
  const sprite = (name, x, y, width, height, z = .55) => {
    if (!materials.has(name)) materials.set(name, engine.spriteMaterial(name));
    return engine.sprite(materials.get(name), x, y, width, height, z);
  };
  const update = action => views.items.push({ roomId: 0, update: state => action(state.forest, engine.players[0]) });
  const floor = world.platforms[forest.nestId];
  const treeHeight = 11.2;
  const tree = sprite('forest-hollow', forest.nestX, floor.y + treeHeight / 2 - .12, 12.45, treeHeight, -.18);
  tree.material.opacity = .68;
  const nest = sprite('forest-nest', forest.nestX, floor.y + 1.25, 3.5, 2.5, .45);
  update((progress, player) => { tree.visible = nest.visible = !player.safe.isCave; });
  const forkSign = views.paper(forest.nestX, floor.y + 4.6, 5.6, .98, 430, 80);
  update((progress, player) => {
    const carrying = FOREST_TRAILS.some(side => progress[side] === FOLLOWING);
    forkSign.mesh.visible = !player.safe.isCave && Math.abs(player.x - forest.nestX) < 14 && player.y < 6 && world.bossArenas[0].isLocked;
    if (!forkSign.mesh.visible) return;
    const label = carrying ? '把幼鸟带到妈妈身边' : progress.roots === HOME ? '树冠幼鸟　→' : progress.crown === HOME ? '←　树根幼鸟' : '← 树根　　树冠 →';
    forkSign.draw(label, (ctx, width) => views.text(ctx, label, width / 2, 52, 36));
  });
  for (const side of FOREST_TRAILS) {
    const stops = forest.trails[side];
    const perch = world.platforms[stops.at(-1).platformId];
    const bird = sprite('forest-owlet', perch.x, perch.y + .85, 1.8, 1.35, .83);
    const chirp = views.glow(perch.x, perch.y + .8);
    update((progress, player) => {
      const step = progress[side], flutter = engine.isReducedMotion ? 0 : Math.sin(engine.elapsed * 5 + (side === 'roots' ? 2 : 0)) * .12;
      const offset = side === 'roots' ? -1.1 : 1.1;
      if (step === FOLLOWING) {
        bird.position.set(player.x - player.facing * 1.3 + offset * .45, player.y + 1.65 + flutter, .86);
      } else if (step === HOME) {
        bird.position.set(forest.nestX + offset, 1 + flutter, .82);
      } else {
        bird.position.set(perch.x, perch.y + .8 + flutter, .8);
      }
      bird.visible = step === FOLLOWING || !!player.safe.isCave === (step < FOLLOWING && side === 'roots');
      chirp.visible = step === FOLLOWING - 1 && bird.visible;
    });
    for (const [index, stop] of stops.entries()) {
      const p = world.platforms[stop.platformId];
      const icons = side === 'roots' ? ['collectible-star', 'bridge-rope', 'desert-cave-mouth'] : ['spring-flower', 'bridge-rope', 'forest-vine'];
      const item = index < FOLLOWING - 1 ? sprite(icons[index], p.x, p.y + 1, 2.25, 1.8) : null;
      const sign = views.paper(p.x, p.y + 3.1, 4.9, 1.05, 370, 82);
      update((progress, player) => {
        const near = Math.abs(player.x - p.x) < 25 && Math.abs(player.y - p.y) < 10 && !!player.safe.isCave === (side === 'roots');
        if (item) item.visible = near && progress[side] >= index;
        const isWaitingForLights = side === 'roots' && index === 0 && progress.lights !== 7;
        sign.mesh.visible = near && progress[side] === index && !isWaitingForLights;
        if (sign.mesh.visible) sign.draw(stop.action, (ctx, width) => views.text(ctx, stop.action, width / 2, 54, 42, '#79501b'));
      });
    }
    // 转弯处告诉玩家下一片地形在上一层还是下一层。
    for (const [index, stop] of stops.slice(0, -1).entries()) {
      const p = world.platforms[stop.platformId], next = stops[index + 1];
      const sign = views.paper(p.x, p.y + (side === 'roots' ? -3.2 : 6), 3.4, .78, 290, 68);
      sign.draw('direction', (ctx, w) => views.text(ctx, (side === 'roots' ? '↓ ' : '↑ ') + next.name, w / 2, 46, 35));
      update((progress, player) => { sign.mesh.visible = progress[side] === index + 1 && Math.abs(p.x - player.x) < 22 && !!player.safe.isCave === (side === 'roots'); });
    }
  }
  for (const [index, id] of forest.fireflies.entries()) {
    const p = world.platforms[id], glow = views.glow(p.x, p.y + 1.35);
    const bug = sprite('collectible-star', p.x, p.y + 1.2, .9, .9, .7);
    update((progress, player) => {
      const caught = !!(progress.lights & (1 << index));
      bug.visible = glow.visible = !!player.safe.isCave && progress.roots === 0;
      if (!bug.visible) return;
      const bob = engine.isReducedMotion ? 0 : Math.sin(engine.elapsed * 3 + index) * .23;
      bug.position.set(caught ? player.x - player.facing * (1.35 + index * .55) : p.x, (caught ? player.y + 1.5 + index * .27 : p.y + 1.2) + bob, .76);
      glow.position.set(bug.position.x, bug.position.y, .4);
      glow.scale.set(2.1, 2.1, 1);
    });
  }
  // 第一盏灯点亮后，沿洞内的实际落脚面亮起萤火，给回折处指路。
  for (const stop of forest.trails.roots.slice(1)) {
    for (const id of stop.path.filter((_, index) => index % 4 === 1)) {
      const p = world.platforms[id];
      const light = views.glow(p.x, p.y + 1.7);
      light.scale.set(1.2, 1.2, 1);
      update((progress, player) => { light.visible = progress.roots > 0 && !!player.safe.isCave && Math.abs(p.x - player.x) < 25; });
    }
  }
  const vine = forest.vine;
  for (let y = 0; y < vine.maxY; y += 4.2) {
    const height = Math.min(4.2, vine.maxY - y);
    const section = sprite('forest-vine', vine.x, y + height / 2, 1.55, height, .39);
    update((progress, player) => { section.visible = progress.crown >= 3 && !player.safe.isCave && (world.bossArenas[0].isLocked || y < 3); });
  }
  for (const mouth of world.rooms[0].traversal.cave.mouths) {
    const p = world.platforms[mouth.platformId];
    // 树拱原图上下留有透明纸边，让拱脚落在洞口所属的台面上。
    const marker = p.id === forest.nestId
      ? sprite('adventure-root-cave', mouth.x, p.y + .69, 3.4, 1.7, -.05)
      : sprite('desert-cave-mouth', mouth.x, p.y + 1.15, 2.8, 2.4, -.05);
    update((progress, player) => { marker.visible = !mouth.isClosed && !!player.safe.isCave === !!p.isCave; });
  }
}
