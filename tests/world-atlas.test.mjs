import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYABLE_WORLDS, findStage } from '../shared/levels.js';
import { ATLAS_LANDMARKS, ADVENTURE_WORLDS, findLandmark, isLastAdventureWorld, nextAdventureWorld } from '../shared/world-atlas.js';

test('世界地图包含 10 个地标：8 处跳台、北方雪山指向小雪人姐妹、空军基地指向彩笔战机', () => {
  assert.equal(ATLAS_LANDMARKS.length, 10);
  const ids = ATLAS_LANDMARKS.map(item => item.id);
  assert.equal(new Set(ids).size, 10);

  const snow = findLandmark('snow');
  assert.equal(snow.game, 'snow-sisters');
  assert.equal(snow.name, '小雪人姐妹');
  assert.equal(snow.region, '北方雪山');
  assert.equal(snow.stage, null);

  const airbase = findLandmark('airbase');
  assert.equal(airbase.game, 'gun-nac');
  assert.equal(airbase.name, '彩笔战机');
  assert.equal(airbase.region, '空军基地');
  assert.equal(airbase.stage, null);
  assert.ok(airbase.art.endsWith('atlas-airbase.png'));

  const platforms = ATLAS_LANDMARKS.filter(item => item.game === 'platform');
  assert.equal(platforms.length, 8);
  assert.ok(!platforms.some(item => item.id === 'snow'));
  assert.ok(platforms.every(item => item.stage && item.stage.themeId === item.id));
});

test('跳台冒险推进自动跳过已替换为怀旧游戏的雪山，并正常进入下一轮', () => {
  assert.equal(ADVENTURE_WORLDS.length, 8);
  assert.ok(!ADVENTURE_WORLDS.some(world => world.themeId === 'snow'));

  const meadow = PLAYABLE_WORLDS.find(world => world.themeId === 'meadow');
  const forest = PLAYABLE_WORLDS.find(world => world.themeId === 'forest');
  const desert = PLAYABLE_WORLDS.find(world => world.themeId === 'desert');
  const rainbow = PLAYABLE_WORLDS.find(world => world.themeId === 'rainbow');

  assert.equal(nextAdventureWorld(meadow).id, forest.id, '风车草地通关后跳过雪山直达蘑菇森林');
  assert.equal(isLastAdventureWorld(meadow), false);

  assert.equal(isLastAdventureWorld(desert), true, '沙漠绿洲仍是跳台最后一关');
  assert.equal(nextAdventureWorld(desert).id, rainbow.id, '沙漠绿洲通关后回到彩虹花园开始下一轮');

  // 兼容历史雪山跳台存档：findStage 仍可解析，且通关后自然推进到蘑菇森林。
  const legacySnow = findStage('snow-expedition-terraces');
  assert.ok(legacySnow);
  assert.equal(nextAdventureWorld(legacySnow).id, forest.id);
});
