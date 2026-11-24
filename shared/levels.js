import { fieldStages } from './trails/themes.js';
import { collectionPoints } from './collectibles.js';
// requiredFlowers / flowers 保留旧版字段名，统一表示宝物数量，兼容既有 SQLite 成绩。
export const LEVELS = Object.freeze([
  { id: 'rainbow', route: 'stairs', name: '彩虹花园', subtitle: '跟着彩虹找宝物', image: 'level-rainbow', sources: [1, 2, 6, 9], platforms: 8, requiredFlowers: 4, bonus: 50, gapMin: 0.8, gapRange: 0.6, rise: 1, color: '#b65d83', side: '#dfb6cd' },
  { id: 'family', route: 'stairs', name: '家人小镇', subtitle: '穿过小屋去团聚', image: 'level-family', sources: [3, 4, 7, 11], platforms: 10, requiredFlowers: 6, bonus: 80, gapMin: 1, gapRange: 0.8, rise: 1.3, color: '#68864e', side: '#c2d2a9' },
  { id: 'sweet', route: 'cave', name: '甜甜城堡', subtitle: '去冰淇淋城堡做客', image: 'level-sweet', sources: [5, 8, 10], platforms: 12, requiredFlowers: 8, bonus: 100, gapMin: 1.2, gapRange: 1, rise: 1.5, color: '#4f8eaa', side: '#b5d8da' },
  { id: 'beach', route: 'cave', name: '贝壳海边', subtitle: '沿着灯塔找贝壳', image: 'level-beach', sources: [], backdropWidth: 30, backdropY: -1.5, backdropOffset: 4, story: '小帆船驶过灯塔，去沙滩找闪亮的贝壳。', platforms: 10, requiredFlowers: 6, bonus: 80, gapMin: 0.9, gapRange: 0.7, rise: 0.9, color: '#bd773b', side: '#eed3a0', surface: 'paper-texture', topColor: '#f7d77e', finish: 'collectible-shell' },
  { id: 'meadow', route: 'stairs', name: '风车草地', subtitle: '和小兔一起追彩虹', image: 'level-meadow', sources: [], backdropWidth: 30, backdropY: -1.5, backdropOffset: 4, story: '风车转呀转，小兔和奶牛在草地上等你。', platforms: 9, requiredFlowers: 5, bonus: 70, gapMin: 0.8, gapRange: 0.6, rise: 1, color: '#8a8d35', side: '#c5dc9d', topColor: '#d7efb8', finish: 'collectible-rainbow' },
  { id: 'snow', route: 'cave', name: '雪人乐园', subtitle: '和企鹅收集小雪花', image: 'level-snow', sources: [], backdropWidth: 30, backdropY: -1.5, backdropOffset: 4, story: '戴好围巾，和雪人、企鹅一起找小雪花。', platforms: 11, requiredFlowers: 7, bonus: 90, gapMin: 1, gapRange: 0.7, rise: 1.1, color: '#7376bb', side: '#bddde9', surface: 'paper-texture', topColor: '#edf7ff', finish: 'collectible-snowflake' },
  { id: 'forest', route: 'canopy', name: '蘑菇森林', subtitle: '去猫头鹰的树屋做客', image: 'level-forest', sources: [], backdropWidth: 30, backdropY: -1.5, backdropOffset: 4, story: '跟着萤火虫，穿过大树，找到松鼠的小树屋。', platforms: 12, requiredFlowers: 7, bonus: 90, gapMin: 1, gapRange: 0.8, rise: 1.3, color: '#347d73', side: '#b8c5a0', topColor: '#aed7a0', finish: 'collectible-mushroom' },
  { id: 'cartoon', route: 'canopy', name: '卡通梦工场', subtitle: '跟机器人和恐龙去冒险', image: 'level-cartoon', sources: [], backdropWidth: 30, backdropY: -1.5, backdropOffset: 4, story: '机器人、恐龙和小火箭，邀请你参加气球派对。', platforms: 12, requiredFlowers: 8, bonus: 100, gapMin: 1.1, gapRange: 0.8, rise: 1.4, color: '#b4556c', side: '#dcb8e9', surface: 'paper-texture', topColor: '#efb5de', finish: 'collectible-balloon' },
  { id: 'desert', route: 'cave', name: '沙漠绿洲', subtitle: '攀过砂岩，钻进洞窟', image: 'level-desert', sources: [], story: '沿凸石爬上砂岩峡谷，跳过风车遗迹，从洞里回到绿洲。', platforms: 12, requiredFlowers: 8, bonus: 110, color: '#aa6540', side: '#e7b671', surface: 'paper-texture', topColor: '#f4cc83', finish: 'collectible-star' },
]);
const CHAPTERS = [
  [['花丘分岔','hills'],['拱桥花径','arches'],['彩虹断谷','clouds']],
  [['街巷绕行','streets'],['屋内穿梭','houses'],['钟楼竖井','clock']],
  [['庭院开桥','gates'],['饼干迷廊','cookies'],['地窖回环','cellar']],
  [['潮汐浅滩','tides'],['木筏群岛','rafts'],['灯塔内外','lighthouse']],
  [['风谷跨越','wind'],['风车高塔','windmill'],['山脊分路','ridge']],
  [['冰面制动','ice'],['冰洞下降','icecave'],['雪山回升','snowpeak']],
  [['树根回环','roots'],['树干攀登','trunk'],['树冠横渡','canopy']],
  [['积木拼桥','blocks'],['玩具工厂','factory'],['火箭高塔','rocket']],
];
export const STAGES = Object.freeze(LEVELS.flatMap((level, worldIndex) => (CHAPTERS[worldIndex] || []).map(([chapterName, structure], chapter) => ({
  ...level, id: `${level.id}-${chapter + 1}`, themeId: level.id, worldIndex, chapter, chapterName, structure,
  index: worldIndex * 3 + chapter, roomCount: 3 + worldIndex + chapter, bonus: level.bonus + chapter * 25,
}))));
// 第 8 版新冒险：每个主题只留一关。旧的 24 小关仍给第 4～7 版存档使用。
const WORLD_RULES = [
  ['弹簧云丘', 'spring-cloud'],
  ['屋顶钟摆', 'roof-pendulum'],
  ['开桥传送', 'gate-belt'],
  ['木筏喷泉', 'tide'],
  ['跷板升降', 'rise'],
  ['冰面停步', 'ice'],
  ['爬上树屋', 'climb'],
  ['机关接力', 'relay'],
  ['攀岩钻洞', 'desert'],
];
export const WORLD_ACTS = Object.freeze(LEVELS.map((level, worldIndex) => {
  const [chapterName, structure] = WORLD_RULES[worldIndex];
  return {
    ...level, id: `${level.id}-world`, themeId: level.id, worldIndex, chapter: 0, chapterName, structure,
    index: worldIndex, roomCount: 3, bonus: level.bonus + 50,
  };
}));
// 独立关卡编号让进行中的旧森林和历史成绩继续使用原来的地形与物品编号。
export const FOREST_RESCUE = Object.freeze({
  ...WORLD_ACTS.find(stage => stage.themeId === 'forest'),
  id: 'forest-rescue', chapterName: '树冠救援', structure: 'forest-rescue',
  subtitle: '带两只猫头鹰宝宝回巢', story: '树冠和树根各传来一声呼唤。先去哪边，由你决定。',
});
export const FLOWER_VALLEY = Object.freeze({
  ...WORLD_ACTS[0], id: 'rainbow-flower-valley', chapterName: '花开成路', structure: 'flower-valley',
  subtitle: '让雨水浇出一条路', story: '河对岸就是城堡，水槽里的雨会流到哪里？',
});
export const WATERWAYS = Object.freeze({ ...FLOWER_VALLEY, id:'rainbow-waterways', chapterName:'花开成路 · 水乡长旅' });
const NEW_WORLDS = [WATERWAYS, FOREST_RESCUE, ...fieldStages(WORLD_ACTS)];
export const WORLD_MAPS = Object.freeze([...WORLD_ACTS, FLOWER_VALLEY, ...NEW_WORLDS]);
export const PLAYABLE_WORLDS = Object.freeze(WORLD_ACTS.map(stage => NEW_WORLDS.find(map => map.themeId === stage.themeId) || stage));
export function findStage(id) { return WORLD_MAPS.find(stage => stage.id === id) || STAGES.find(stage => stage.id === id); }
export function findLevel(id) { return LEVELS.find(level => level.id === id) || findStage(id); }
export function themeFor(level) { return LEVELS.find(theme => theme.id === (level.themeId || level.id)); }
export function calculateScore(flowers, isCompleted, level) { return (typeof flowers === 'number' ? flowers * 10 : collectionPoints(flowers)) + (isCompleted ? level.bonus : 0); }
export function hasCompleted(level, flowers, platform) { return flowers >= level.requiredFlowers && platform >= level.platforms; }
