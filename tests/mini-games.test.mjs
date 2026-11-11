import test from 'node:test';
import assert from 'node:assert/strict';
import { createMiniSession, actOnMiniSession, readMiniSession, isMiniComplete, weatherFor, miniHint } from '../src/mini-games/session.js';
import { readGardenBackup, mergeGardenProgress } from '../src/garden-backup.js';
import { earnedQuests } from '../src/garden-progress.js';
import { readFile, stat } from 'node:fs/promises';
import { narrationText, narrationFile, PHASE_NARRATION } from '../src/mini-games/narration.js';

const empty = { rainbow: 0, flowers: [0,0,0,0], served: [false,false,false,false], stamps: [] };
function perform(session, action) {
  return actOnMiniSession(session, { ...action, taskId: session.tasks[session.taskIndex]?.id, revision: session.revision });
}
function solveAction(session) {
  const task = session.tasks[session.taskIndex], board = session.board;
  if (task.kind === 'find') return { type: 'find', item: task.target };
  if (task.kind === 'care') {
    const target = task.plants.findIndex((plant, i) => board.steps[i] < plant.needs.length);
    return { type: 'care', target, item: task.plants[target].needs[board.steps[target]] };
  }
  if (task.kind === 'orders') {
    const target = board.builds.findIndex(build => !build.isServed), build = board.builds[target], order = task.orders[target];
    if (!build.container) return { type: 'ingredient', target, item: order.container };
    if (build.layers.length < order.layers.length) return { type: 'ingredient', target, item: order.layers[build.layers.length] };
    if (build.topping !== order.topping) return { type: 'ingredient', target, item: order.topping };
    return { type: 'serve', target };
  }
  const target = board.slots.findIndex((item, i) => item !== task.answer[i]);
  return target >= 0 ? { type: 'place', target, item: task.answer[target] } : { type: 'check' };
}
function finish(session) {
  let count = 0;
  while (!isMiniComplete(session)) {
    const result = perform(session, solveAction(session));
    assert.notEqual(result.session, session, result.message);
    session = result.session;
    assert.ok(++count < 250, '每局应能通过正常操作结束');
  }
  return session;
}

test('三款各 80 种随机局正常可解，任务内容有变化，同种子可复现且不随恢复改变', () => {
  for (const id of ['rainbow','garden','treat']) {
    const fingerprints = new Set();
    for (let seed = 0; seed < 80; seed++) {
      const initial = createMiniSession(id, seed);
      assert.deepEqual(initial, createMiniSession(id, seed));
      fingerprints.add(JSON.stringify(initial.tasks));
      const result = finish(initial);
      assert.equal(result.completed.length, result.tasks.length);
      assert.deepEqual(readMiniSession(JSON.parse(JSON.stringify(result)), id), result);
      assert.equal(earnedQuests({ ...empty, miniGames: { [id]: result } })[id], true);
    }
    assert.equal(fingerprints.size, 80);
  }
});

test('内容规模与难度按已确认的阶段展开', () => {
  const rainbow = createMiniSession('rainbow', 42);
  assert.deepEqual([0,1,2].map(phase=>rainbow.tasks.filter(task=>task.phase===phase).length), [6,4,3]);
  assert.deepEqual(rainbow.tasks.filter(task=>task.phase===1).map(task=>task.answer.length),[3,4,4,5]);
  assert.deepEqual(rainbow.tasks.filter(task=>task.phase===2).map(task=>task.answer.length),[4,5,6]);
  const garden = createMiniSession('garden',42);
  assert.equal(garden.tasks.filter(task=>task.kind==='sow').flatMap(task=>task.plants).length,6);
  assert.equal(garden.tasks.filter(task=>task.kind==='care').flatMap(task=>task.plants).length,6);
  const needs = garden.tasks.filter(task=>task.kind==='care').flatMap(task=>task.plants.map(plant=>plant.needs));
  assert.equal(new Set(needs.map(sequence=>JSON.stringify(sequence))).size,6);
  assert.deepEqual(needs.map(sequence=>sequence.length),[4,4,4,5,5,5]);
  assert.equal(garden.tasks.filter(task=>task.phase===2).length,3);
  const treat = createMiniSession('treat',42);
  assert.equal(treat.tasks.flatMap(task=>task.orders).length,12);
  assert.deepEqual(treat.tasks.map(task=>task.orders.length),[1,1,1,1,1,1,2,2,2]);
});

test('每一步都可保存恢复；错误输入、旧任务与同版本重复操作不能跳关或丢进度', () => {
  for (const id of ['rainbow','garden','treat']) {
    let session = createMiniSession(id, 137);
    while (!isMiniComplete(session)) {
      assert.equal(perform(session,{type:'place',target:-1,item:'unknown'}).session,session);
      const action = { ...solveAction(session), taskId:session.tasks[session.taskIndex].id, revision:session.revision };
      const result = actOnMiniSession(session,action);
      assert.equal(actOnMiniSession(result.session,action).session,result.session);
      const loaded = readMiniSession(JSON.parse(JSON.stringify(result.session)),id);
      assert.deepEqual(loaded,result.session);
      session = loaded;
    }
  }
});

test('两级提示不代做，配方与排列撤回恢复原盘面', () => {
  for (const id of ['rainbow','garden','treat']) {
    let session = createMiniSession(id, 42);
    if(id==='rainbow') for(let i=0;i<6;i++) session=perform(session,solveAction(session)).session;
    const original=session;
    session=perform(session,{type:'hint'}).session;
    assert.ok(miniHint(session));
    const hint1=miniHint(session);
    session=perform(session,{type:'hint'}).session;
    assert.notEqual(miniHint(session),hint1);
    assert.deepEqual(session.board,original.board);
    session=perform(session,solveAction(session)).session;
    session=perform(session,{type:'undo'}).session;
    assert.deepEqual(session.board,original.board);
    assert.deepEqual(readMiniSession(JSON.parse(JSON.stringify(session)),id),session);
  }
});

test('天气只满足当前对应的需求，同一天气不可重复发放；暂停不会自然推进', () => {
  let session=createMiniSession('garden',17);
  while(session.tasks[session.taskIndex].kind!=='care') session=perform(session,solveAction(session)).session;
  let used=false;
  for(let i=0;i<12 && session.tasks[session.taskIndex].kind==='care';i++) {
    const task=session.tasks[session.taskIndex], weather=weatherFor(task,session.board);
    const before=session;
    const result=perform(session,{type:'weather'});
    if(result.session!==session) {
      used=true; session=result.session;
      if(session.taskIndex===before.taskIndex) {
        assert.ok(session.board.weatherUsed.includes(weather.turn));
        if(weatherFor(task,session.board).turn===weather.turn) assert.equal(perform(session,{type:'weather'}).session,session);
      }
    } else session=perform(session,solveAction(session)).session;
  }
  assert.ok(used);
  assert.deepEqual(readMiniSession(JSON.parse(JSON.stringify(session)),'garden'),session);
});

test('双订单可交替制作并独立保留；送出后不能撤回或重复送出', () => {
  let session=createMiniSession('treat',9);
  while(session.tasks[session.taskIndex].phase<2) session=perform(session,solveAction(session)).session;
  const orders=session.tasks[session.taskIndex].orders;
  for(const target of [1,0]) session=perform(session,{type:'ingredient',target,item:orders[target].container}).session;
  assert.equal(session.board.builds[0].container,orders[0].container);
  assert.equal(session.board.builds[1].container,orders[1].container);
  const before=session;
  assert.equal(perform(session,{type:'serve',target:1}).session,before);
  for(const item of [...orders[1].layers,orders[1].topping]) session=perform(session,{type:'ingredient',target:1,item}).session;
  session=perform(session,{type:'serve',target:1}).session;
  assert.equal(session.board.builds[1].isServed,true);
  assert.equal(session.history.length,0);
  assert.equal(perform(session,{type:'serve',target:1}).session,session);
  assert.equal(perform(session,{type:'undo'}).session,session);
  assert.ok(isMiniComplete(finish(session)));
});

test('v2 备份完整恢复随机局，v1 成就保留，合并以本机整局为先且不混拼', () => {
  const old={...empty,rainbow:6,flowers:[2,2,2,2]};
  const legacy=readGardenBackup(JSON.stringify({type:'garden-progress',version:1,progress:old}));
  assert.deepEqual(legacy.achievements,{rainbow:true,garden:true,treat:false});
  const current={...legacy,miniGames:{rainbow:perform(createMiniSession('rainbow',11),{type:'hint'}).session}};
  const incoming={...empty,miniGames:{rainbow:createMiniSession('rainbow',22),treat:createMiniSession('treat',33)}};
  const loaded=readGardenBackup(JSON.stringify({type:'garden-progress',version:2,progress:incoming}));
  const merged=mergeGardenProgress(current,loaded);
  assert.deepEqual(merged.miniGames.rainbow,current.miniGames.rainbow);
  assert.deepEqual(merged.miniGames.treat,incoming.miniGames.treat);
  assert.equal(merged.achievements.garden,true);
  assert.deepEqual(mergeGardenProgress(merged,loaded),merged);
  assert.throws(()=>readGardenBackup(JSON.stringify({type:'garden-progress',version:2,progress:{...incoming,miniGames:{treat:{...incoming.miniGames.treat,taskIndex:500}}}})));
});

test('损坏任务、盘面和撤回历史被拒绝，重玩使用新种子且不影响旧成就', () => {
  const session=createMiniSession('rainbow',4);
  for(const invalid of [{...session,seed:-1},{...session,taskIndex:1},{...session,tasks:[]},{...session,board:null},{...session,history:[{slots:['script']}]},{...session,revision:NaN}]) assert.equal(readMiniSession(invalid,'rainbow'),null);
  const completed=finish(session), progress={...empty,miniGames:{rainbow:completed}};
  const replay={...progress,achievements:earnedQuests(progress),miniGames:{rainbow:createMiniSession('rainbow',5)}};
  assert.equal(earnedQuests(replay).rainbow,true);
  assert.equal(replay.miniGames.rainbow.taskIndex,0);
  assert.notDeepEqual(replay.miniGames.rainbow.tasks,completed.tasks);
});

test('导入拒绝无法继续的自动完成盘面及能复活已送出订单的历史', () => {
  let garden = createMiniSession('garden', 3);
  const sow = garden.tasks[0];
  assert.equal(readMiniSession({...garden, board:{slots:sow.answer}}, 'garden'), null);
  while (garden.tasks[garden.taskIndex].kind !== 'care') garden = perform(garden, solveAction(garden)).session;
  assert.equal(readMiniSession({...garden, board:{steps:[4,4,4],weatherUsed:[]}}, 'garden'), null);
  let treat = createMiniSession('treat', 3);
  while (treat.tasks[treat.taskIndex].phase < 2) treat = perform(treat, solveAction(treat)).session;
  const unserved = structuredClone(treat.board);
  while (!treat.board.builds[0].isServed) treat = perform(treat, solveAction(treat)).session;
  assert.equal(readMiniSession({...treat, history:[unserved]}, 'treat'), null);
  assert.equal(readMiniSession({...treat, id:'unknown'}, 'unknown'), null);
});

test('离线自然语音覆盖三个阶段、结算和每一步两级提示，文件完整且不依赖系统朗读', async () => {
  const directory = new URL('../public/audio/guidance/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('manifest.json', directory), 'utf8'));
  const clips = new Map(manifest.lines.map(line => [line.text, line.file]));
  for (const line of manifest.lines) {
    assert.equal(line.file, narrationFile(line.text));
    assert.ok((await stat(new URL(line.file, directory))).size > 1000);
  }
  for (const id of ['rainbow','garden','treat']) {
    for (const text of PHASE_NARRATION[id]) assert.ok(clips.has(text));
    for (let seed = 0; seed < 80; seed++) {
      let session = createMiniSession(id, seed);
      while (!isMiniComplete(session)) {
        for (const hintLevel of [0,1,2]) assert.ok(clips.has(narrationText({...session,hintLevel})), narrationText({...session,hintLevel}));
        session = perform(session, solveAction(session)).session;
      }
      assert.ok(clips.has(narrationText(session)));
    }
  }
});
