// 新冒险的内容目录与旧地图版本分开，服务端和游戏共用怪物奖励定义。
export const ADVENTURE_GENERATION_VERSION = 2;
export const MONSTERS = Object.freeze({
  jelly: { name: '果冻怪', points: 10, family: 'power', behavior: 'hop', image: 'enemy-jelly' },
  leaf: { name: '叶子怪', points: 15, family: 'flight', behavior: 'leap', image: 'enemy-leaf' },
  puff: { name: '云朵怪', points: 20, family: 'flight', behavior: 'float', image: 'enemy-puff' },
  mushroom: { name: '弹跳蘑菇', points: 20, family: 'bubble', behavior: 'bounce', image: 'enemy-mushroom' },
  crab: { name: '贝壳蟹', points: 20, family: 'power', behavior: 'scuttle', image: 'enemy-crab' },
  fish: { name: '泡泡鱼', points: 25, family: 'bubble', behavior: 'bubble', image: 'enemy-fish' },
  snowball: { name: '雪球团', points: 20, family: 'frost', behavior: 'roll', image: 'enemy-snowball' },
  snowflower: { name: '喷雪花', points: 25, family: 'frost', behavior: 'fan', image: 'enemy-snowflower' },
  squirrel: { name: '松果松鼠', points: 25, family: 'nature', behavior: 'lob', image: 'enemy-squirrel' },
  firefly: { name: '萤火虫', points: 25, family: 'flight', behavior: 'dart', image: 'enemy-firefly' },
  toy: { name: '发条玩具', points: 25, family: 'power', behavior: 'charge', image: 'enemy-toy' },
  candy: { name: '糖果团', points: 20, family: 'bubble', behavior: 'split', image: 'enemy-candy' },
});
export const THEME_MONSTERS = Object.freeze({
  rainbow: ['jelly', 'leaf', 'mushroom', 'puff'], family: ['leaf', 'toy', 'puff', 'squirrel'],
  sweet: ['jelly', 'candy', 'mushroom', 'toy'], beach: ['crab', 'fish', 'puff', 'jelly'],
  meadow: ['leaf', 'squirrel', 'firefly', 'mushroom'], snow: ['snowball', 'snowflower', 'puff', 'toy'],
  forest: ['mushroom', 'squirrel', 'firefly', 'leaf'], cartoon: ['toy', 'candy', 'fish', 'firefly'],
});
export const WEAPONS = Object.freeze({
  blade: { name: '贯穿光刃', shortName: '光刃', image: 'light-wave', hint: '穿过平台和沿途小怪', family: 'power' },
  bubble: { name: '魔法泡泡', shortName: '泡泡', image: 'magic-bubble', hint: '炸开泡泡，击中周围小怪', family: 'bubble' },
  stars: { name: '彩虹星雨', shortName: '星雨', image: 'collectible-star', hint: '星星散开，打到高低的小怪', family: 'flight' },
  boomerang: { name: '回旋星镖', shortName: '星镖', image: 'weapon-boomerang', hint: '飞出去，还会飞回来', family: 'flight' },
  seed: { name: '花种弹', shortName: '花种', image: 'weapon-seed', hint: '抛出花种，落地开花', family: 'nature' },
  firefly: { name: '萤火法杖', shortName: '萤火', image: 'weapon-firefly', hint: '小萤光追着前方小怪飞', family: 'nature' },
});
export const UPGRADES = Object.freeze({
  double: { name: '双重发射', hint: '一次发出两组攻击', image: 'collectible-star', family: 'power' },
  split: { name: '星光分裂', hint: '命中时再散出小星星', image: 'collectible-star', family: 'bubble' },
  frost: { maxRank: 3, name: '冰霜', hint: '打中后，小怪慢下来', image: 'upgrade-frost', family: 'frost' },
  chain: { maxRank: 3, name: '连锁光点', hint: '光点跳向附近的小怪', image: 'collectible-rainbow', family: 'nature' },
  area: { maxRank: 3, name: '范围加宽', hint: '攻击变大，更容易打中', image: 'magic-bubble', family: 'bubble' },
  rapid: { maxRank: 3, name: '轻快连发', hint: '按住攻击，发射更快', image: 'light-wave', family: 'power' },
  wide: { maxRank: 3, name: '宽宽光刃', hint: '光刃更高，打到更多小怪', image: 'light-wave', family: 'power', weapon: 'blade' },
  linger: { name: '泡泡滞留', hint: '泡泡爆开后，还会闪两下', image: 'magic-bubble', family: 'bubble', weapon: 'bubble' },
  fan: { maxRank: 3, name: '满天星雨', hint: '更多星星向上下散开', image: 'collectible-star', family: 'flight', weapon: 'stars' },
  returnSplit: { name: '回程分裂', hint: '飞回来时，分成两颗星', image: 'upgrade-return-split', family: 'flight', weapon: 'boomerang' },
  bloom: { name: '再次开花', hint: '花种落地后，再开一朵花', image: 'flower', family: 'nature', weapon: 'seed' },
  seek: { name: '萤火接力', hint: '多一只萤光，一起追小怪', image: 'weapon-firefly', family: 'nature', weapon: 'firefly' },
  magnet: { maxRank: 3, name: '宝物磁吸', hint: '附近宝物，自动飞过来', image: 'upgrade-magnet', family: 'nature' },
  shield: { maxRank: 3, name: '轻碰护罩', hint: '碰到小怪后，保护更久', image: 'magic-bubble', family: 'frost' },
  air: { maxRank: 3, name: '轻盈转向', hint: '在空中轻松飞远一点', image: 'collectible-balloon', family: 'flight' },
  landing: { name: '落地光环', hint: '跳下来时，光环打退小怪', image: 'collectible-rainbow', family: 'power' },
  companion: { maxRank: 3, name: '同行萤火', hint: '小萤光自动帮忙攻击', image: 'weapon-firefly', family: 'nature' },
  haste: { maxRank: 3, name: '轻快脚步', hint: '打败小怪后，跑快一小会儿', image: 'collectible-star', family: 'power' },
});
export const FAMILY_LABELS = { power: '光刃强化', bubble: '泡泡强化', flight: '星雨强化', frost: '冰霜强化', nature: '花种强化' };
