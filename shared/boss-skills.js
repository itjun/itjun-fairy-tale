// 每个世界一位首领：样子、名字，还有它带的小怪种类和偏向的本领一类。
export const BOSS_THEMES = Object.freeze({
  rainbow: { image:'boss-flower', leader:'彩虹花王', kinds:['jelly','puff','flowerpot'], family:'power' },
  family: { image:'boss-clock', leader:'钟楼守卫', kinds:['toy','pillow','bell'], family:'flight' },
  sweet: { image:'boss-pudding', leader:'布丁国王', kinds:['candy','pillow','mushroom'], family:'bubble' },
  beach: { image:'boss-crab', leader:'贝壳蟹王', kinds:['sandcastle','fish','crab'], family:'bubble' },
  meadow: { image:'boss-windmill', leader:'风车守卫', kinds:['leafshield','squirrel','firefly'], family:'nature' },
  snow: { image:'boss-snowman', leader:'雪人国王', kinds:['snowball','snowflower','icicle'], family:'frost' },
  forest: { image:'boss-tree', leader:'古树守卫', kinds:['mushroom','squirrel','moth'], family:'nature' },
  cartoon: { image:'boss-toy', leader:'发条巨人', kinds:['toy','paint','bell'], family:'power' },
  desert: { image:'boss-crab', leader:'砂岩蟹王', kinds:['sandcastle','burrow','crab'], family:'nature' },
});
// 首领先用哪一招：半血前只用这一招，半血后和下一招轮着来。
const FIRST_SKILL = { rainbow: 0, family: 1, sweet: 1, beach: 0, meadow: 2, snow: 0, forest: 0, cartoon: 1, desert: 0 };
const SKILLS = {
  rainbow: [
    {name:'花瓣散射',kind:'fan',image:'flower',speed:8},
    {name:'彩虹跳跳球',kind:'bounce',image:'magic-bubble',speed:9},
    {name:'花藤冒芽',kind:'roots',image:'weapon-seed',speed:8},
  ],
  family: [
    {name:'铃铛音浪',kind:'ring',image:'collectible-star',speed:8},
    {name:'钟摆冲锋',kind:'charge',image:'weapon-boomerang',speed:9},
    {name:'铃铛落雨',kind:'rain',image:'monster-bell',speed:7},
  ],
  sweet: [
    {name:'糖球弹跳',kind:'bounce',image:'enemy-candy',speed:8},
    {name:'糖果抛投',kind:'lob',image:'enemy-candy',speed:9},
    {name:'奶油冒泡',kind:'roots',image:'magic-bubble',speed:7},
  ],
  beach: [
    {name:'浪花追击',kind:'wave',image:'magic-bubble',speed:8},
    {name:'贝壳抛投',kind:'lob',image:'collectible-shell',speed:9},
    {name:'蟹钳冲锋',kind:'charge',image:'collectible-shell',speed:10},
  ],
  meadow: [
    {name:'回旋叶刃',kind:'return',image:'enemy-leaf',speed:9},
    {name:'花种散射',kind:'fan',image:'weapon-seed',speed:8},
    {name:'旋风追击',kind:'aimed',image:'weapon-firefly',speed:10},
  ],
  snow: [
    {name:'冰锥落雨',kind:'rain',image:'monster-icicle',speed:8},
    {name:'雪球连跳',kind:'bounce',image:'enemy-snowball',speed:8},
    {name:'霜花散射',kind:'fan',image:'collectible-snowflake',speed:9},
  ],
  forest: [
    {name:'树根追踪',kind:'roots',image:'weapon-seed',speed:8},
    {name:'蘑菇孢子',kind:'lob',image:'collectible-mushroom',speed:8},
    {name:'飞叶回旋',kind:'return',image:'enemy-leaf',speed:9},
  ],
  cartoon: [
    {name:'飞星光波',kind:'aimed',image:'weapon-boomerang',speed:10},
    {name:'积木落雨',kind:'rain',image:'enemy-toy',speed:8},
    {name:'发条冲锋',kind:'charge',image:'weapon-boomerang',speed:10},
  ],
  desert: [
    {name:'沙浪冲锋',kind:'charge',image:'monster-sandcastle',speed:9},
    {name:'砂石落雨',kind:'rain',image:'collectible-shell',speed:8},
  ],
};

export function bossSkills(themeId) {
  const skills=SKILLS[themeId],first=FIRST_SKILL[themeId];
  return [skills[first],skills[(first+1)%skills.length]];
}
