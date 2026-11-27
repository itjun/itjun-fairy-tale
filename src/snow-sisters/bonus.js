// FC 版独有的 Boss 战后 3 轮老虎机、隐藏跳关红包老虎机与秘密 Time 模式规则。

import { addScore, awardLetter, nextRng, spawnPopup } from './items.js';

export const SLOT_REELS = [
  ['S', 'X', 'N', 'DOLL', 'O', 'W', 'X', 'S'],
  ['N', 'O', 'X', 'S', 'DOLL', 'W', 'X', 'N'],
  ['W', 'S', 'DOLL', 'X', 'O', 'N', 'X', 'W'],
];

export const WARP_REELS = [
  ['X', '+1', 'X', '+1', 'X', '+1'],
  ['X', '+1', '+2', 'X', '+1', '+2'],
  ['X', '+1', '+2', '+3', 'X', '+2'],
];

export function startSlotBonus(s, kind = 'boss') {
  const activePlayers = s.players.filter((p) => p.active && p.lives > 0);
  const queue = kind === 'warp' ? [s.warpCollectorId || activePlayers[0]?.id || 1] : activePlayers.map((p) => p.id);
  const reels = kind === 'warp' ? WARP_REELS : SLOT_REELS;
  s.bonus = {
    kind,
    queue: queue.length ? queue : [1],
    turnIndex: 0,
    reels: reels.map((strip, idx) => ({
      strip,
      pos: Math.floor(nextRng(s) * strip.length),
      tick: idx * 3,
      stopped: false,
      symbol: null,
    })),
    activeReel: 0,
    doneTimer: 0,
    totalSkip: 0,
    message: kind === 'warp' ? '跳关老虎机！拍停三轮决定飞跃层数' : '过关老虎机！集齐 S-N-O-W 或娃娃赢奖命',
  };
  s.phase = kind === 'warp' ? 'warpSlot' : 'slot';
}

export function stepSlotBonus(s, pressStopIds = []) {
  const b = s.bonus;
  if (!b) return null;

  const ownerId = b.queue[b.turnIndex];
  const player = s.players.find((p) => p.id === ownerId) || s.players[0];

  for (const reel of b.reels) {
    if (!reel.stopped) {
      reel.tick++;
      if (reel.tick % 6 === 0) {
        reel.pos = (reel.pos + 1) % reel.strip.length;
        s.sounds.push('slotSpin');
      }
    }
  }

  if (b.doneTimer > 0) {
    b.doneTimer--;
    if (b.doneTimer === 0) {
      if (b.turnIndex + 1 < b.queue.length) {
        b.turnIndex++;
        b.activeReel = 0;
        const reels = b.kind === 'warp' ? WARP_REELS : SLOT_REELS;
        b.reels = reels.map((strip, idx) => ({
          strip,
          pos: Math.floor(nextRng(s) * strip.length),
          tick: idx * 3,
          stopped: false,
          symbol: null,
        }));
      } else {
        const result = {
          kind: b.kind,
          skip: b.totalSkip,
        };
        s.bonus = null;
        return result;
      }
    }
    return null;
  }

  const wantsStop = pressStopIds.includes(ownerId) || (b.queue.length === 1 && pressStopIds.length > 0);
  if (wantsStop && b.activeReel < 3) {
    const reel = b.reels[b.activeReel];
    reel.stopped = true;
    reel.symbol = reel.strip[reel.pos];
    s.sounds.push('slotStop');

    if (b.kind === 'warp') {
      const skip = reel.symbol.startsWith('+') ? Number(reel.symbol.slice(1)) : 0;
      b.totalSkip += skip;
    } else {
      if (reel.symbol === 'DOLL') {
        addScore(s, player, 50000);
        player.lives = Math.min(99, player.lives + 1);
        s.sounds.push('oneUp');
        spawnPopup(s, 128, 120, '娃娃 +50000 1UP!', '#78ff9c');
      } else if ('SNOW'.includes(reel.symbol)) {
        addScore(s, player, 10000);
        awardLetter(s, player, reel.symbol);
      }
    }

    b.activeReel++;
    if (b.activeReel >= 3) {
      b.doneTimer = 75;
    }
  }
  return null;
}

// 标题页隐藏秘籍：上×2、右×8、下×2、左×8 切换 Time 模式
export const TIME_CODE = [
  'up', 'up',
  'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right',
  'down', 'down',
  'left', 'left', 'left', 'left', 'left', 'left', 'left', 'left',
];

export function matchTimeCode(history, dir) {
  const next = [...history, dir].slice(-TIME_CODE.length);
  const matched =
    next.length === TIME_CODE.length && TIME_CODE.every((step, i) => step === next[i]);
  return { next: matched ? [] : next, matched };
}
