export const RARITIES = Object.freeze({
  common: {name:'普通',color:'#8e8986',rank:0}, rare: {name:'稀有',color:'#3b87bf',rank:1},
  epic: {name:'史诗',color:'#9363b4',rank:2}, legendary: {name:'传奇',color:'#c47a1c',rank:3},
});
export const SPELLS = Object.freeze({
  fire: {name:'暖阳火环',image:'flame-stream',family:'power',charge:18,duration:4,damage:32,hint:'战斗充能 18 秒，火环跟随 4 秒，挡一次伤害'},
  snow: {name:'雪花风暴',image:'collectible-snowflake',family:'frost',charge:22,duration:3,damage:44,hint:'战斗充能 22 秒，两道雪幕冻结小怪、减缓首领'},
  thunder: {name:'彩虹雷链',image:'upgrade-chain',family:'flight',charge:20,duration:1.4,damage:52,hint:'战斗充能 20 秒，雷光在附近敌人间跳跃'},
  rain: {name:'星云甘霖',image:'platform-cloud',family:'nature',charge:26,duration:4,damage:28,hint:'战斗充能 26 秒，雨幕清普通敌弹，回血 10'},
});
export const LEGENDARY_EFFECTS = Object.freeze({
  blade:'前后光刃：追加一把较弱的后向光刃', bubble:'花漾泡泡：爆开后留下减速花田',
  moonblade:'月牙接力：首次命中分出一把小月牙寻找其他敌人', stars:'繁星齐放：每四轮追加一组扇形星弹',
  flame:'小龙同行：喷火时小龙短暂加入攻击', boomerang:'回旋余辉：回程留下两颗星弹',
  seed:'花开两次：落地后再开一朵花', firefly:'萤光接力：额外一只萤火帮忙追敌',
  fire:'花环守护：火环挡伤后散出花瓣反击', snow:'雪落回响：结束时追加冰晶伤害，不再次冻结',
  thunder:'彩虹回声：结束时回击第一个仍存活的目标', rain:'雨后彩虹：雨停后获得一次护罩',
});
