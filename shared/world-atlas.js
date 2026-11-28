import { PLAYABLE_WORLDS } from './levels.js';

const worldByTheme = Object.fromEntries(PLAYABLE_WORLDS.map(world => [world.themeId, world]));

// 世界地图地标注册表：每处地标可指向跳台冒险或独立 FC 风格玩法。
// 后续把东海替换为《冒险岛》或接入更多玩法时，只需在此调整对应地标的 game 字段。
export const ATLAS_LANDMARKS = Object.freeze([
  Object.freeze({
    id: 'rainbow',
    name: worldByTheme.rainbow.name,
    game: 'platform',
    stage: worldByTheme.rainbow,
    x: 46.8,
    y: 48,
    portraitX: 49.5,
    portraitY: 41.8,
    region: '四川盆地',
    description: '群山环抱花田，江水向东流。',
  }),
  Object.freeze({
    id: 'family',
    name: worldByTheme.family.name,
    game: 'platform',
    stage: worldByTheme.family,
    x: 74.7,
    y: 25.6,
    portraitX: 74.5,
    portraitY: 22.4,
    region: '东部平原',
    description: '穿过河畔的小镇，找找钟楼。',
  }),
  Object.freeze({
    id: 'sweet',
    name: worldByTheme.sweet.name,
    game: 'platform',
    stage: worldByTheme.sweet,
    x: 67.8,
    y: 54.4,
    portraitX: 68.1,
    portraitY: 66.7,
    region: '江南丘陵',
    description: '顺着起伏的山丘，去城堡做甜点。',
  }),
  Object.freeze({
    id: 'beach',
    name: worldByTheme.beach.name,
    game: 'platform',
    stage: worldByTheme.beach,
    x: 85.5,
    y: 60.4,
    portraitX: 82.5,
    portraitY: 51.4,
    region: '东海与海岛',
    description: '沿海岸找贝壳，隔海望见小岛。',
  }),
  Object.freeze({
    id: 'meadow',
    name: worldByTheme.meadow.name,
    game: 'platform',
    stage: worldByTheme.meadow,
    x: 31.6,
    y: 24,
    portraitX: 25.1,
    portraitY: 22.7,
    region: '北方草原',
    description: '翻过草坡，风把风车吹转了。',
  }),
  Object.freeze({
    id: 'snow',
    name: '小雪人姐妹',
    game: 'snow-sisters',
    stage: null,
    x: 54.4,
    y: 19.6,
    portraitX: 50,
    portraitY: 13.1,
    region: '北方雪山',
    description: '白雪盖住山脊，和姐妹一起堆雪球闯高塔。',
  }),
  Object.freeze({
    id: 'forest',
    name: worldByTheme.forest.name,
    game: 'platform',
    stage: worldByTheme.forest,
    x: 32.5,
    y: 80.5,
    portraitX: 27,
    portraitY: 83.8,
    region: '南方雨林',
    description: '循着鸟鸣，走进藤蔓缠绕的雨林。',
  }),
  Object.freeze({
    id: 'cartoon',
    name: worldByTheme.cartoon.name,
    game: 'platform',
    stage: worldByTheme.cartoon,
    x: 65,
    y: 84,
    portraitX: 74.5,
    portraitY: 89.1,
    region: '东南河谷',
    description: '小火车沿着河谷，开往积木镇。',
  }),
  Object.freeze({
    id: 'desert',
    name: worldByTheme.desert.name,
    game: 'platform',
    stage: worldByTheme.desert,
    x: 16.2,
    y: 46.8,
    portraitX: 20.5,
    portraitY: 49.4,
    region: '西部沙漠',
    description: '从敦煌石窟到绿洲，一排排小树挡住风沙。',
  }),
  Object.freeze({
    id: 'airbase',
    name: '彩笔战机',
    game: 'gun-nac',
    stage: null,
    art: './assets/atlas-airbase.png',
    x: 16,
    y: 18.5,
    portraitX: 16.5,
    portraitY: 11.5,
    region: '空军基地',
    description: '从彩笔机场起飞，驾驶小战机飞过星际关卡。',
  }),
]);

// 当前仍在跳台冒险主线中的世界（按原始世界顺序，自动跳过已改为其他游戏的地标）。
const platformThemes = new Set(ATLAS_LANDMARKS.filter(item => item.game === 'platform').map(item => item.id));
export const ADVENTURE_WORLDS = Object.freeze(PLAYABLE_WORLDS.filter(world => platformThemes.has(world.themeId)));

export function findLandmark(id) {
  return ATLAS_LANDMARKS.find(item => item.id === id) || ATLAS_LANDMARKS[0];
}

export function isLastAdventureWorld(level) {
  const last = ADVENTURE_WORLDS.at(-1);
  return !!level && !!last && (level.themeId === last.themeId || level.worldIndex >= last.worldIndex);
}

// 跳台通关后前往下一个跳台世界；若当前位于最后一个跳台世界，则回到第一个跳台世界开启新轮回。
// 兼容历史雪山跳台存档：通关后自动衔接下一个跳台世界（蘑菇森林）。
export function nextAdventureWorld(level) {
  if (!level) return ADVENTURE_WORLDS[0];
  return ADVENTURE_WORLDS.find(world => world.worldIndex > level.worldIndex) || ADVENTURE_WORLDS[0];
}
