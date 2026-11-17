import { MONSTERS } from '../../shared/adventure-catalog.js';
import { encounterBarrier, remainingRoomEnemies } from './rooms.js';

// 与剩余数量共用候选，指向最近的一只；打倒后自动换下一只，不写进存档。
export function roomEnemyGuide(world, state, player, project, isExtraWave = false, viewport = { width: 1280, height: 800 }) {
  const barrier = encounterBarrier(world, state, isExtraWave);
  if (!barrier) return null;
  const enemies = remainingRoomEnemies(world, state, isExtraWave).filter(enemy => !enemy.isDormant);
  const enemy = enemies.reduce((nearest, item) => !nearest || Math.hypot(item.x - player.x, item.y - player.y) < Math.hypot(nearest.x - player.x, nearest.y - player.y) ? item : nearest, null);
  if (!enemy) return null;
  const target = project(enemy.x, enemy.y + enemy.height + 0.6);
  // 留开顶部状态栏和底部操作区；超出可标记区域时，把箭头留在边缘。
  const marginX = Math.max(12, Math.min(40, 110 / viewport.width * 100));
  const top = Math.min(65, Math.max(34, 300 / viewport.height * 100));
  const bottom = Math.max(top, Math.min(76, (viewport.height - (viewport.width < 1100 ? 170 : 100)) / viewport.height * 100));
  const x = Math.max(marginX, Math.min(100 - marginX, target.x)), y = Math.max(top, Math.min(bottom, target.y));
  const isAtEdge = x !== target.x || y !== target.y;
  const horizontal = Math.abs(enemy.x - player.x) < 2 ? '' : enemy.x < player.x ? '左' : '右';
  const vertical = Math.abs(enemy.y - player.y) < 2 ? '' : enemy.y > player.y ? '上' : '下';
  const direction = vertical ? `${horizontal}${vertical}方` : horizontal ? `${horizontal}边` : '附近';
  return {
    id: enemy.id, image: MONSTERS[enemy.kind].image, name: MONSTERS[enemy.kind].name, x, y, isAtEdge,
    angle: isAtEdge ? Math.atan2((target.y - y) * viewport.height, (target.x - x) * viewport.width) * 180 / Math.PI : 90,
    label: isAtEdge ? `${direction}还有小怪` : '打败这只小怪',
    isNearBarrier: Math.abs(player.x - barrier.x) < 8,
  };
}
