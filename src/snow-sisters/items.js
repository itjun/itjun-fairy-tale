// 道具、药水、计分寿司、隐藏宝物、奖命阈值与确定性随机工具。

export const SUSHI_NAMES = [
  '海苔卷',
  '手卷寿司',
  '玉子烧',
  '章鱼寿司',
  '花枝寿司',
  '鲔鱼寿司',
  '鲜虾寿司',
  '鲑鱼卵',
  '大腹寿司',
  '海胆寿司',
];
export const SUSHI_SCORES = [100, 200, 300, 400, 600, 800, 1000, 1200, 1500, 2000];

export const HIDDEN_TREATS = {
  pie: { name: '苹果派', points: 5000 },
  milk: { name: '糖果奶昔', points: 7000 },
  burger: { name: '蘑菇汉堡', points: 10000 },
  sundae: { name: '樱桃圣代', points: 15000 },
};

export const CHAIN_SCORES = [500, 1000, 2000, 3000, 4000, 6000];

export function nextRng(s) {
  let x = (s.seed || 0x534e4f57) >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  s.seed = x >>> 0;
  return (s.seed >>> 0) / 4294967296;
}

export function spawnPopup(s, x, y, text, color = '#ffdf7b') {
  s.popups.push({
    id: ++s.serial,
    x,
    y,
    text: String(text),
    color,
    life: 48,
  });
}

export function addScore(s, playerOrId, points) {
  const player =
    typeof playerOrId === 'object' && playerOrId
      ? playerOrId
      : s.players.find((p) => p.id === playerOrId) || s.players[0];
  if (!player || points <= 0) return;
  player.score += points;
  if (player.score > s.hiScore) s.hiScore = player.score;
  while (player.score >= player.nextExtend) {
    player.lives = Math.min(99, player.lives + 1);
    s.sounds.push('oneUp');
    spawnPopup(s, player.x, player.y - 16, '1UP', '#78ff9c');
    player.nextExtend = player.nextExtend === 100000 ? 600000 : Infinity;
  }
}

export function awardLetter(s, player, letter) {
  if (!player || !'SNOW'.includes(letter)) return false;
  const had = player.letters.includes(letter);
  if (!had) player.letters.push(letter);
  s.sounds.push('letter');
  spawnPopup(s, player.x, player.y - 14, letter, '#7ce4ff');
  if (player.letters.length >= 4) {
    player.letters = [];
    player.lives = Math.min(99, player.lives + 1);
    s.sounds.push('oneUp');
    spawnPopup(s, player.x, player.y - 24, 'SNOW 1UP!', '#78ff9c');
    return true;
  }
  return false;
}

export function spawnItem(s, kind, x, y, extra = {}) {
  const clampedX = Math.max(16, Math.min(240, x));
  const clampedY = Math.max(24, Math.min(216, y));
  const item = {
    id: ++s.serial,
    kind,
    x: clampedX,
    y: clampedY,
    vy: extra.vy ?? -1.8,
    life: extra.life ?? 420,
    tier: extra.tier ?? 0,
    ...extra,
  };
  s.items.push(item);
  return item;
}

export function dropItemForKill(
  s,
  x,
  y,
  { chainCount = 1, wasColoredBall = false, isGreenKill = false, allowPotion = true } = {},
) {
  if (isGreenKill || wasColoredBall) {
    spawnItem(s, 'sushi', x, y, { tier: 9 });
    return;
  }
  const r = nextRng(s);
  if (allowPotion && chainCount >= 2 && r < 0.36) {
    const roll = nextRng(s);
    if (roll < 0.08 && !s.snowHeadUsed) {
      s.snowHeadUsed = true;
      spawnItem(s, 'snowHead', x, y);
      return;
    }
    if (roll < 0.22) {
      spawnItem(s, 'green', x, y, { life: 260 });
      return;
    }
    const pool = s.floor < 24 ? ['red', 'blue', 'yellow'] : ['red', 'blue'];
    const pick = pool[Math.floor(nextRng(s) * pool.length)];
    spawnItem(s, pick, x, y);
    return;
  }
  // 单杀有较低概率掉落低档寿司，连杀掉落更高档位寿司
  if (chainCount <= 1 && r > 0.45) return;
  const maxTier = Math.min(9, Math.max(0, chainCount + Math.floor(s.floor / 12)));
  const tier = Math.min(9, Math.floor(nextRng(s) * (maxTier + 1)));
  spawnItem(s, 'sushi', x, y, { tier });
}

export function collectItem(s, player, item) {
  switch (item.kind) {
    case 'red':
      if (player.potions.speed) addScore(s, player, 1000);
      else player.potions.speed = true;
      s.sounds.push('potion');
      spawnPopup(s, item.x, item.y - 8, player.potions.speed ? '加速!' : '+1000', '#ff6c82');
      return true;
    case 'blue':
      if (player.potions.power) addScore(s, player, 1000);
      else player.potions.power = true;
      s.sounds.push('potion');
      spawnPopup(s, item.x, item.y - 8, '强雪!', '#6ec8ff');
      return true;
    case 'yellow':
      if (player.potions.range) addScore(s, player, 1000);
      else player.potions.range = true;
      s.sounds.push('potion');
      spawnPopup(s, item.x, item.y - 8, '远射!', '#ffe366');
      return true;
    case 'green':
      player.giantTimer = 540;
      addScore(s, player, 8000);
      s.sounds.push('giant');
      spawnPopup(s, item.x, item.y - 10, '巨大无敌!', '#72ff98');
      return true;
    case 'sushi': {
      const pts = SUSHI_SCORES[item.tier] || 100;
      addScore(s, player, pts);
      s.sounds.push('sushi');
      spawnPopup(s, item.x, item.y - 8, `+${pts}`, '#fff3b8');
      return true;
    }
    case 'money10k':
      addScore(s, player, 10000);
      s.sounds.push('sushi');
      spawnPopup(s, item.x, item.y - 10, '+10000', '#ff6a78');
      return true;
    case 'money20k':
      addScore(s, player, 20000);
      s.sounds.push('oneUp');
      spawnPopup(s, item.x, item.y - 10, '+20000', '#ffd952');
      return true;
    case 'pie':
    case 'milk':
    case 'burger':
    case 'sundae': {
      const pts = HIDDEN_TREATS[item.kind].points;
      addScore(s, player, pts);
      s.sounds.push('sushi');
      spawnPopup(s, item.x, item.y - 10, `+${pts}`, '#ff9ce6');
      return true;
    }
    case 'warp':
      addScore(s, player, 10000);
      s.sounds.push('snowHead');
      return 'warp';
    case 'snowHead':
      s.sounds.push('snowHead');
      spawnPopup(s, item.x, item.y - 10, 'SNOW!', '#80e6ff');
      return 'snowHead';
    default:
      return false;
  }
}
