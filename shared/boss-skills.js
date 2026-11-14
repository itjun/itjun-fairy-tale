// 同一世界的三位小首领各以一招为主，大首领组合使用本世界的招式。
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
};

export function bossSkills(themeId, chapter, isWorldBoss) {
  const skills=SKILLS[themeId];
  return isWorldBoss ? skills : [skills[chapter],skills[(chapter+1)%3]];
}
