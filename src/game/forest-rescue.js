import { FOLLOWING, FOREST_TRAILS, HOME, syncForestRoutes } from '../../shared/forest-rescue.js';

export function newForestProgress(world) {
  const progress = { crown: 0, roots: 0, lights: 0 };
  syncForestRoutes(world, progress);
  return progress;
}

export function isValidForestProgress(progress) {
  return progress && Number.isInteger(progress.lights) && progress.lights >= 0 && progress.lights <= 7 && (!progress.roots || progress.lights === 7) && FOREST_TRAILS.every(side => Number.isInteger(progress[side]) && progress[side] >= 0 && progress[side] <= HOME);
}

export function stepForestRescue(world, progress, player) {
  if (!player.isGrounded || player.crawl) return null;
  const forest = world.forest;
  if (player.ground.id === forest.nestId && Math.abs(player.x - forest.nestX) < 2.4) {
    const returning = FOREST_TRAILS.filter(side => progress[side] === FOLLOWING);
    if (!returning.length) return null;
    for (const side of returning) progress[side] = HOME;
    syncForestRoutes(world, progress);
    return { message: world.bossArenas[0].isLocked ? '第一只幼鸟到家啦！另一只还在等你' : '两只幼鸟都到家了！守住鸟巢', sound: 'owl-home', delivered: true };
  }
  const side = player.ground.isCave ? 'roots' : 'crown';
  if (side === 'roots' && progress.roots === 0) {
    const index = forest.fireflies.indexOf(player.ground.id);
    if (index >= 0 && !(progress.lights & (1 << index)) && Math.abs(player.x - player.ground.x) < 1.9) {
      progress.lights |= 1 << index;
      return { message: progress.lights === 7 ? '三只萤火虫聚齐了，带它们去点灯' : '一只萤火虫跟来了！', sound: 'flower' };
    }
    if (progress.lights !== 7) return null;
  }
  const stop = forest.trails[side][progress[side]];
  if (!stop || player.ground.id !== stop.platformId || Math.abs(player.x - player.ground.x) > 2) return null;
  progress[side]++;
  syncForestRoutes(world, progress);
  const next = forest.trails[side][progress[side]];
  return { message: next ? stop.action + '啦！接下来去' + next.name : side === 'crown' ? '树冠幼鸟跟上啦！沿藤梯回巢' : '树根幼鸟跟上啦！旁边的树皮门通回鸟巢', sound: next ? 'checkpoint' : 'owl-home' };
}

export function forestHint(world, progress, player) {
  const inCave = !!player.safe?.isCave;
  const side = inCave ? 'roots' : 'crown';
  const home = FOREST_TRAILS.filter(key => progress[key] === HOME).length;
  if (home === 2) return world.enemies[world.rooms[0].bossId - 1].isDefeated ? '鸟巢安全了，往右走到终点' : '守住鸟巢，藤梯可以换层躲招';
  if (!inCave && Math.abs(player.x) < 17 && player.y < 6 && FOREST_TRAILS.some(key => progress[key] === FOLLOWING)) return '走到鸟巢里的妈妈身边，让幼鸟回家';
  if (progress[side] === FOLLOWING) return inCave ? '在幼鸟身旁向上推，穿树皮门回巢' : '沿叶藤梯下来，走到猫头鹰妈妈身边';
  if (progress[side] === HOME) return inCave ? '从亮着的树洞出洞，上树冠找另一只幼鸟' : '到妈妈左边的洞口，向上推进入树根';
  if (!inCave && Math.abs(player.x) < 17 && player.y < 6 && !progress.crown) {
    return progress.roots === HOME ? '向右过蘑菇坡，寻找树冠幼鸟' : '往右上树冠　或去妈妈左边钻树洞';
  }
  if (inCave && !progress.roots && progress.lights !== 7) {
    const missing = world.forest.fireflies.map((id, i) => progress.lights & (1 << i) ? null : world.platforms[id]).filter(Boolean);
    const near = missing.sort((a,b) => Math.abs(a.x-player.x) - Math.abs(b.x-player.x))[0];
    const where = Math.abs(near.x-player.x) > 5 ? (near.x > player.x ? '右边' : '左边') : near.y > player.y + 1.5 ? '上面的石龛' : '旁边的石台';
    return '萤火虫 ' + (3 - missing.length) + '/3 · 去' + where + '接它';
  }
  const stop = world.forest.trails[side][progress[side]], target = world.platforms[stop.platformId];
  const dx = target.x - player.x, dy = target.y - player.y;
  const direction = Math.abs(dx) > 8 ? (dx > 0 ? '往右' : '往左') : Math.abs(dy) > 3 ? (dy > 0 ? '往上' : '往下') : '就在附近';
  return direction + ' · ' + stop.name + ' · ' + stop.action;
}
