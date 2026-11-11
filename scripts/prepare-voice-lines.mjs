// 输出所有引导文案；只包含游戏模板，不读取任何家庭存档。
import { mkdir, writeFile } from 'node:fs/promises';
import { createMiniSession, actOnMiniSession, isMiniComplete, miniHint } from '../src/mini-games/session.js';
import { PHASE_NARRATION, warmHint, narrationFile } from '../src/mini-games/narration.js';
import { GEMS } from '../src/mini-games/rainbow.js';
import { FLOWERS, FLOWER_NAMES, TOOLS } from '../src/mini-games/flowers.js';
import { FAMILY, CONTAINERS, TOPPINGS, FLAVORS } from '../src/mini-games/treat.js';
const lines = new Set(Object.values(PHASE_NARRATION).flat());
const add = text => lines.add(warmHint(text));
for (const item of [...Object.values(GEMS),...Object.values(FLOWERS)]) for(let i=1;i<=6;i++) add(`试着把${item.name}放在第 ${i} 个位置。`);
for (const gem of Object.values(GEMS)) add(`找一找${gem.name}，它就在场景里。`);
for (const name of FLOWER_NAMES) for(const tool of Object.values(TOOLS)) add(`试着给${name}${tool}。`);
for (const person of FAMILY) {
  for (const container of Object.values(CONTAINERS)) add(`先给${person}放一个${container}。`);
  add(`做好啦，送给${person}吧！`);
}
for (const container of Object.values(CONTAINERS)) add(`这份需要${container}，用撤回调整一下。`);
for (const flavor of Object.values(FLAVORS)) add(`下一球放${flavor.name}。`);
for (const topping of Object.values(TOPPINGS)) add(`最后放${topping}装饰。`);
add('有一层口味不同，先撤回到那一层再调整。');
add('装饰和订单不同，撤回最后一步再看看。');
// 覆盖各任务的一层提示、全部放好后的提示，和正常流程的下一步提示。
for (const id of ['rainbow','garden','treat']) {
  let session=createMiniSession(id,42);
  while(!isMiniComplete(session)) {
    for(const hintLevel of [1,2]) add(miniHint({...session,hintLevel}));
    const task=session.tasks[session.taskIndex],board=session.board;
    let action;
    if(task.kind==='find') action={type:'find',item:task.target};
    else if(task.kind==='care') {const target=task.plants.findIndex((plant,i)=>board.steps[i]<plant.needs.length);action={type:'care',target,item:task.plants[target].needs[board.steps[target]]};}
    else if(task.kind==='orders') {
      const target=board.builds.findIndex(build=>!build.isServed),build=board.builds[target],order=task.orders[target];
      const item=!build.container?order.container:build.layers.length<order.layers.length?order.layers[build.layers.length]:build.topping!==order.topping?order.topping:null;
      action=item?{type:'ingredient',target,item}:{type:'serve',target};
    } else {const target=board.slots.findIndex((item,i)=>item!==task.answer[i]);action=target<0?{type:'check'}:{type:'place',target,item:task.answer[target]};}
    session=actOnMiniSession(session,{...action,taskId:task.id,revision:session.revision}).session;
  }
}
const manifest=[...lines].sort().map(text=>({file:narrationFile(text),text}));
if(new Set(manifest.map(item=>item.file)).size!==manifest.length) throw new Error('语音文件名冲突');
await mkdir('public/audio/guidance',{recursive:true});
await writeFile('public/audio/guidance/manifest.json',JSON.stringify({voice:'zh-CN-XiaoxiaoNeural',rate:'-5%',lines:manifest},null,2)+'\n');
console.log(`${manifest.length} 条离线语音文案`);
