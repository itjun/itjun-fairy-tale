// 由 test-gamepad-desktop.mjs 启动，始终使用独立用户目录。
import { app, BrowserWindow } from 'electron';
import assert from 'node:assert/strict';
import { roomFixture } from '../tests/helpers/adventure-fixtures.mjs';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { completeMiniGame } from './helpers/gamepad-mini-games.mjs';
import { createRoomWorld, spotPosition } from '../shared/room-world.js';
import { resourcesFor } from '../src/game/expedition.js';
import { WEAPONS } from '../shared/adventure-catalog.js';
if (!process.env.GARDEN_DESKTOP_PROFILE) throw new Error('手柄测试必须指定隔离目录');
await import('../desktop/main.mjs');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let win;
async function until(check, label) {
  for (let i = 0; i < 150; i++) { if (await check()) return; await wait(100); }
  throw new Error(`等待超时：${label}`);
}
async function run() {
try {
  await app.whenReady();
  await until(() => { win = BrowserWindow.getAllWindows()[0]; return win && !win.webContents.isLoading(); }, '主窗口');
  win.webContents.setBackgroundThrottling(false);
  const evaluate = code => win.webContents.executeJavaScript(code);
  const saveKey = ['garden','active','adventure','v1'].join('-');
  const status = name => () => evaluate(`document.querySelector(".platform-game")?.dataset.gameStatus === "${name}"`);
  async function focusWindow() {
    app.focus({ steal: true }); win.show(); win.focus(); win.webContents.focus();
    await until(() => evaluate('document.hasFocus() && !document.hidden'), '测试窗口获得焦点');
  }
  await focusWindow();
  await until(() => evaluate('!!document.querySelector(".home-play")'), '首页');
  const actualPads = await evaluate('[...navigator.getGamepads()].filter(Boolean).map(p=>({name:p.id,mapping:p.mapping}))');
  async function setupPad() {
    await evaluate(`
      window.testPad = { id: 'Xbox Wireless Controller (simulated)', index: 0, connected: true, mapping: 'standard', axes: [0,0,0,0], buttons: Array.from({length:17},()=>({pressed:false,value:0})) };
      window.testPads = [testPad];
      window.padSamples = []; window.padFocusEvents = []; window.padFrames = 0;
      for (const name of ['focus','blur','visibilitychange']) window.addEventListener(name,()=>padFocusEvents.push({name,at:performance.now(),focus:document.hasFocus(),hidden:document.hidden}));
      Object.defineProperty(navigator, 'getGamepads', {configurable:true,value:()=>{padFrames++;padSamples.push({at:performance.now(),keys:testPad.buttons.flatMap((b,i)=>b.pressed?[i]:[]),focus:document.hasFocus(),hidden:document.hidden});if(padSamples.length>60)padSamples.shift();return testPads;}});
      window.testWait = ms=>new Promise(resolve=>setTimeout(resolve,ms));
      window.waitPadFrames = async ()=>{
        const start=padFrames,deadline=performance.now()+3000;
        while(padFrames<start+3){if(performance.now()>deadline)throw Error('手柄没有被轮询');await testWait(10);}
        if(!document.hasFocus())throw Error('测试窗口失去焦点');
      };
      window.tap = async index=>{
        await waitPadFrames();
        testPad.buttons[index]={pressed:true,value:1};
        try{await waitPadFrames();}finally{testPad.buttons[index]={pressed:false,value:0};}
        await waitPadFrames();
      };
      const isShown = node=>!node.closest('[inert],[hidden],[aria-hidden="true"]')&&node.getClientRects().length>0&&getComputedStyle(node).visibility!=='hidden';
      const center = node=>{const rect=node.getBoundingClientRect();return {x:rect.x+rect.width/2,y:rect.y+rect.height/2};};
      const selectable='button:not(:disabled),a[href],select:not(:disabled),input:not(:disabled):not([type=hidden]):not([type=file]),[data-gamepad-canvas]';
      // 根据布局找一条方向键路线，只发送真实手柄按键，不直接 focus/click。
      // 每步重算，因为滚动、选中样式和动态按钮会改变位置。
      window.reach = async selector=>{
        for(let i=0;i<60;i++){
          const scope=[...document.querySelectorAll('[role=dialog],dialog[open]')].filter(isShown).at(-1)||[...document.querySelectorAll('.app-shell,.home-page,.home-menu,.mini-game,.score-screen')].filter(isShown).at(-1);
          const items=[...scope.querySelectorAll(selectable)].filter(isShown),target=items.find(node=>node.matches(selector));
          if(!target)throw Error('页面上没有可用的 '+selector);
          const active=document.activeElement;
          if(active===target)return;
          if(active.hasAttribute('data-gamepad-canvas')){await tap(1);continue;}
          if(!items.includes(active)){await tap(13);continue;}
          const queue=[{node:active,path:[]}],seen=new Set([active]);let path;
          for(let n=0;n<queue.length&&!path;n++){
            const {node,path:steps}=queue[n],from=center(node);
            for(const [key,horizontal,sign] of [[12,false,-1],[13,false,1],[14,true,-1],[15,true,1]]){
              if(horizontal&&node.matches('input,select'))continue;
              let next,score=Infinity;
              for(const candidate of items){
                const point=center(candidate),dx=point.x-from.x,dy=point.y-from.y,forward=(horizontal?dx:dy)*sign,sideways=Math.abs(horizontal?dy:dx);
                const value=forward+sideways*2.5;
                if(forward>2&&value<score){next=candidate;score=value;}
              }
              if(!next||seen.has(next))continue;
              const route=[...steps,key];if(next===target){path=route;break;}
              seen.add(next);if(!next.hasAttribute('data-gamepad-canvas'))queue.push({node:next,path:route});
            }
          }
          if(!path)throw Error('方向键无法到达 '+selector+'，当前 '+active.textContent.trim().slice(0,20));
          await tap(path[0]);
        }
        throw Error('方向键走不到 '+selector);
      };
      window.choose = async selector=>{
        await reach(selector);
        if(!document.activeElement.matches('input,select,[data-gamepad-canvas]'))await tap(0);
      };
      void 0;
    `);
    await evaluate('waitPadFrames()');
  }
  await setupPad();
  if (process.env.GARDEN_GAMEPAD_CASE === 'worlds') { await checkWorldSwitch(); console.log('手柄换关及重开续玩通过'); app.exit(0); return; }
  if (process.env.GARDEN_GAMEPAD_CASE === 'completion') { await checkCompletion(); console.log('手柄通关衔接通过'); app.exit(0); return; }
  if (process.env.GARDEN_GAMEPAD_CASE === 'bindings') { await checkWeaponBindings(); console.log('手柄圆环换装通过'); app.exit(0); return; }
  await evaluate('choose(".home-play")');
  await until(() => evaluate('!!document.querySelector(".level-choices")'), '选关');
  const difficulty = 'document.querySelector(".difficulty-row [aria-pressed=true]").textContent';
  assert.equal(await evaluate(difficulty), '轻松', '默认是轻松档');
  await evaluate('tap(5)');
  assert.equal(await evaluate(difficulty), '标准', 'RB 换难度');
  await evaluate('tap(4)');
  assert.equal(await evaluate(difficulty), '轻松', 'LB 换回来');
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("garden-play-settings-v1")).difficulty'), 'easy');
  await evaluate('reach(".level-choices button:last-child")');
  assert.equal(await evaluate('document.activeElement === document.querySelector(".level-choices button:last-child")'), true, '方向键能滚到最后一个世界');
  await evaluate('reach(".level-choices button:first-child")');
  await evaluate('choose(".adventure-menu-actions .primary-button")');
  await until(() => evaluate('!!document.querySelector(".character-depart")'), '角色营地');
  await evaluate('choose(".starter-actions button:last-child")');
  await until(() => evaluate('!!document.querySelector(".starter-picker")'), '装备选择');
  await evaluate('tap(1)');
  await until(() => evaluate('!document.querySelector(".starter-picker")'), 'B 返回营地');
  await evaluate('tap(0)');
  await until(() => evaluate('!!document.querySelector(".starter-picker")'), '回到已高亮的自己选择后，一次 A 再打开');
  await evaluate('choose(".starter-options button:not(:disabled)[aria-pressed=false]")');
  await evaluate('choose(".starter-picker footer button:last-child")');
  await until(() => evaluate('!document.querySelector(".starter-picker")'), '确认出发装备');
  await evaluate('choose("[data-gamepad-practice]")');
  await evaluate('tap(2)'); await evaluate('tap(0)'); await evaluate('tap(1)');
  assert.equal(await evaluate('document.activeElement.matches(".character-try-row button")'), true, 'B 退出角色试用');
  await evaluate('choose(".character-depart")');
  await until(() => evaluate('document.querySelector(".platform-game")?.dataset.gameStatus === "playing"'), '开始探险');
  const before = await evaluate('JSON.parse(document.querySelector(".platform-game").dataset.playerPositions)[0]');
  await evaluate('testPad.axes[0]=0.6;testPad.buttons[0]={pressed:true,value:1};testPad.buttons[7]={pressed:true,value:1}');
  await wait(400);
  const after = await evaluate('JSON.parse(document.querySelector(".platform-game").dataset.playerPositions)[0]');
  assert.ok(after.x > before.x, '左摇杆实际移动角色'); assert.ok(after.y > before.y, 'A 实际跳跃');
  await evaluate('testPad.axes[0]=0;testPad.buttons[0]={pressed:false,value:0};testPad.buttons[7]={pressed:false,value:0}');
  await wait(100);
  assert.equal(await evaluate('document.documentElement.dataset.inputMode'), 'gamepad');
  assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".room-hud-keys .pad-key"), key => key.textContent)'), ['A', 'X', 'Y', 'B'], '战斗显示三个武器槽，包括空位');
  await evaluate('tap(1)'); await wait(200);
  assert.equal(await evaluate('document.querySelector(".platform-game").dataset.gameStatus'), 'playing', '游玩中 B 不暂停');
  await evaluate('tap(8)');
  await until(status('overview'), 'View 打开本领一览');
  await evaluate('tap(1)');
  await until(status('playing'), 'B 从本领一览回到游戏');
  await evaluate('tap(9)');
  await until(status('paused'), 'Menu 暂停');
  assert.equal(await evaluate('document.activeElement.matches("[data-gamepad-resume]")'), true, '暂停时光标已在继续上');
  await evaluate('tap(0)');
  await until(status('playing'), '已高亮的继续按钮按一次 A 就继续');
  await evaluate('tap(9)');
  await until(status('paused'), '再次暂停');
  await evaluate('choose(".adventure-menu-actions button:nth-child(3)")');
  await until(status('overview'), '暂停里打开本领一览');
  await evaluate('tap(1)');
  await until(status('paused'), 'B 从本领一览回到暂停');
  await evaluate('choose(".adventure-menu-actions button:nth-child(4)")');
  await until(status('options'), '暂停里打开选项');
  await evaluate('tap(5)');
  await until(() => evaluate('!!document.querySelector(".platform-game .gamepad-settings")'), 'RB 换到手柄分类');
  await evaluate('tap(1)');
  await until(status('paused'), 'B 从选项回到暂停');
  await evaluate('tap(1)');
  await until(status('playing'), 'B 继续');
  await evaluate('testPad.axes[0]=1'); await wait(100);
  await evaluate('testPads=[]');
  await until(() => evaluate('document.querySelector(".platform-game")?.dataset.gameStatus === "paused"'), '断连暂停');
  const stopped = await evaluate('document.querySelector(".platform-game").dataset.playerPositions');
  await evaluate('testPads=[testPad];testPad.buttons[0]={pressed:true,value:1}'); await wait(350);
  assert.equal(await evaluate('document.querySelector(".platform-game").dataset.gameStatus'), 'paused', '按住键重连不能自动继续');
  assert.equal(await evaluate('document.querySelector(".platform-game").dataset.playerPositions'), stopped, '暂停后不残留移动');
  await evaluate('testPad.axes[0]=0;testPad.buttons[0]={pressed:false,value:0}');await wait(150);
  await evaluate('tap(9)');
  await until(() => evaluate('document.querySelector(".platform-game")?.dataset.gameStatus === "playing"'), '重连后手动继续');
  await evaluate('window.dispatchEvent(new Event("blur"))');
  await until(() => evaluate('document.querySelector(".platform-game")?.dataset.gameStatus === "paused"'), '失焦暂停');
  await evaluate('window.dispatchEvent(new Event("focus"))'); await wait(150);
  await evaluate('choose(".adventure-menu-actions .text-button")');
  await until(() => evaluate('!!document.querySelector(".home-play")'), '回到主菜单');
  await evaluate('choose(".home-navigation button:last-child")');
  await until(() => evaluate('!!document.querySelector(".home-options")'), '选项页');
  await evaluate('tap(5)');
  await until(() => evaluate('!!document.querySelector(".gamepad-settings")'), 'RB 换到手柄设置');
  await evaluate('choose(".gamepad-settings button[aria-pressed]")');
  assert.equal(await evaluate('document.querySelector(".gamepad-settings button[aria-pressed]").getAttribute("aria-pressed")'), 'false');
  await evaluate('choose("input[aria-label=摇杆死区]")');
  await evaluate('tap(15)');
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("garden-gamepad-settings-v1")).deadzone'), 0.24, '摇杆调整持久化设置');
  await evaluate('tap(1)');
  await until(() => evaluate('!!document.querySelector(".home-play")'), '返回首页');
  // 存档分类：备份和恢复都在应用里点，不弹系统文件窗口。
  await evaluate('choose(".home-navigation button:last-child")');
  await until(() => evaluate('!!document.querySelector(".home-options")'), '再进选项页');
  // 选项页记着上次停在哪一类，所以一类一类翻到存档为止。
  for (let i = 0; i < 5 && !await evaluate('!!document.querySelector(".garden-backup")'); i++) await evaluate('tap(5)');
  await until(() => evaluate('!!document.querySelector(".garden-backup")'), 'RB 换到存档分类');
  await evaluate('choose(".garden-backup .quiet-button")');
  await until(() => evaluate('document.querySelectorAll(".garden-backup .quiet-button").length === 2'), '手柄备份一份');
  await evaluate('choose(".garden-backup .quiet-button:nth-of-type(2)")');
  await until(() => evaluate('document.querySelector(".garden-backup-note").textContent.startsWith("恢复好了")'), '手柄恢复备份');
  await evaluate('tap(1)');
  await until(() => evaluate('!!document.querySelector(".home-play")'), '从存档返回首页');
  await evaluate('choose(".home-navigation button:last-child")');
  await evaluate('choose(".home-options-categories button:nth-child(4)")');
  await evaluate('choose(".home-options-grid > button:first-child")');
  await until(() => evaluate('!!document.querySelector(".score-summary")'), '成绩本加载');
  await evaluate('choose(".score-presets button:last-child")');
  await until(() => evaluate('!!document.querySelector(".score-summary")'), '全部成绩');
  await evaluate('choose(".score-date-range select")'); await evaluate('tap(15)');
  assert.equal(await evaluate('document.querySelector(".score-date-range select").selectedIndex'), 1, '手柄切换关卡筛选');
  await evaluate('tap(14)');
  await until(() => evaluate('!!document.querySelector(".score-stepper")'), '成绩曲线');
  await evaluate('tap(5)');
  assert.equal(await evaluate('document.querySelector(".score-stepper [role=status]").textContent.includes("第 1 /")'), true, 'RB 查看成绩曲线点');
  await evaluate('choose("select[aria-label=曲线查看方式]")'); await evaluate('tap(15)');
  assert.equal(await evaluate('document.querySelector("select[aria-label=曲线查看方式]").value'), 'daily', '手柄切换每日平均');
  await evaluate('tap(1)');
  await until(() => evaluate('!!document.querySelector(".home-options")'), '成绩本返回选项');
  await evaluate('choose(".home-options-grid > button:nth-child(2)")');
  await until(() => evaluate('!!document.querySelector(".home-gallery")'), '画展');
  const galleryPage = await evaluate('parseInt(document.querySelector(".gallery-controls span").textContent)');
  await evaluate('tap(5)');
  assert.equal(await evaluate('parseInt(document.querySelector(".gallery-controls span").textContent)'), galleryPage % 11 + 1, 'RB 翻原画');
  await evaluate('tap(4)');
  assert.equal(await evaluate('parseInt(document.querySelector(".gallery-controls span").textContent)'), galleryPage, 'LB 回到上一幅');
  await evaluate('tap(1)');
  await evaluate('choose(".home-options-grid > button:nth-child(3)")');
  await until(() => evaluate('!!document.querySelector(".home-collection")'), '小成就');
  await evaluate('tap(1)');
  await evaluate('choose(".home-options-categories button:nth-child(3)")');
  for (const [mode, check] of [
    ['windowed', () => !win.isFullScreen() && !win.isMaximized()],
    ['maximized', () => !win.isFullScreen() && win.isMaximized()],
    ['fullscreen', () => win.isFullScreen()],
    ['windowed', () => !win.isFullScreen() && !win.isMaximized()],
  ]) {
    const changesFullscreen = win.isFullScreen() !== (mode === 'fullscreen');
    const button = `.window-mode-row button[value=${mode}]`;
    await evaluate(`choose(${JSON.stringify(button)})`);
    await until(() => check() && evaluate(`document.querySelector(${JSON.stringify(button)})?.getAttribute("aria-pressed") === "true"`), `手柄选择显示模式 ${mode}`);
    // macOS 切换桌面空间时，窗口模式会先于焦点稳定下来。
    if (changesFullscreen && process.platform === 'darwin') await wait(700);
    await focusWindow();
  }
  await evaluate('tap(1)');
  await until(() => evaluate('!!document.querySelector(".home-play")'), '窗口设置返回首页');
  await evaluate('choose(".home-navigation button:nth-last-child(3)")');
  await until(() => evaluate('!!document.querySelector(".home-album")'), '画册');
  const albumPage = 'document.querySelector(".album-pages [aria-pressed=true]").getAttribute("aria-label")';
  assert.equal(await evaluate(albumPage), '第 1 页 爱心花园');
  // 第一次打开要解码十几张原画，等画面稳住再按，免得短按落在卡住的那一帧里。
  await until(() => evaluate('Array.from(document.querySelectorAll(".home-album img")).every(image => image.complete && image.naturalWidth > 0)'), '画册图片');
  await wait(300);
  await evaluate('tap(5)');
  assert.equal(await evaluate(albumPage), '第 2 页 绿色小城堡', 'RB 翻到下一页');
  await evaluate('tap(4)');
  assert.equal(await evaluate(albumPage), '第 1 页 爱心花园', 'LB 翻回来');
  await evaluate('tap(1)');
  await until(() => evaluate('!!document.querySelector(".home-play")'), '画册 B 返回');
  await evaluate('choose(".home-navigation button:nth-last-child(2)")');
  await until(() => evaluate('!!document.querySelector(".home-games")'), '小游戏入口');
  for (let i = 1; i <= 3; i++) {
    await evaluate(`choose('.home-games .quest-card:nth-child(${i})')`);
    await until(() => evaluate('!!document.querySelector(".mini-game")'), '小游戏');
    await evaluate('choose(".mini-assistance-actions button:last-child")');
    assert.ok(await evaluate('document.querySelector(".mini-feedback").textContent.length > 0'));
    if (i === 1) {
      const index = await evaluate(`Object.values(localStorage).map(value=>{try{return JSON.parse(value)}catch{return null}}).find(p=>p?.miniGames?.rainbow).miniGames.rainbow.tasks[0]`).then(task => task.options.indexOf(task.target) + 1);
      await evaluate(`choose('.hidden-gem:nth-of-type(${index})')`);
      assert.ok(await evaluate('document.querySelector(".mini-game").dataset.gamepadPage.endsWith(":1")'), '手柄找到彩虹线索进入下一题');
    } else {
      if (i === 2) {
        const index = await evaluate(`Object.values(localStorage).map(value=>{try{return JSON.parse(value)}catch{return null}}).find(p=>p?.miniGames?.garden).miniGames.garden.tasks[0]`).then(task => task.options.indexOf(task.answer[0]) + 1);
        await evaluate(`choose('.garden-tray .mini-pick:nth-of-type(${index})')`);
      } else await evaluate('choose(".mini-pick")');
      await evaluate('choose(".mini-drop:not(:disabled)")');
      assert.ok(await evaluate('document.querySelector(".mini-assistance-actions button").disabled === false'), '物品点选、放置成功，可撤回');
      await evaluate('choose(".mini-assistance-actions button")');
      assert.ok(await evaluate('document.querySelector(".mini-assistance-actions button").disabled'), '手柄撤回成功');
    }
    await completeMiniGame(['rainbow', 'garden', 'treat'][i - 1], evaluate, until);
    await evaluate('tap(1)');
    await until(() => evaluate('!!document.querySelector(".home-games")'), '小游戏 B 返回');
  }
  await evaluate('choose(".home-games .home-page-content > .quiet-button")');
  await until(() => evaluate('!!document.querySelector(".decorate-toggle")'), '花园');
  await evaluate('choose(".decorate-toggle")');
  await evaluate('choose("[data-gamepad-stamps]")');
  await wait(120); await evaluate('tap(0)');
  assert.equal(await evaluate('document.querySelectorAll(".placed-stamp").length'), 1, 'A 在画布放贴纸');
  await evaluate('tap(1)');
  assert.equal(await evaluate('document.activeElement.className'), 'decorate-toggle active', 'B 退出画布');
  await writeFile(join(process.env.GARDEN_DESKTOP_PROFILE, 'gamepad.png'), (await win.webContents.capturePage()).toPNG());
  async function loadFixture(fixture) {
    await win.loadURL('garden://app/');
    await until(() => evaluate('!!document.querySelector(".home-play")'), '测试首页');
    await evaluate(`localStorage.setItem(${JSON.stringify(saveKey)}, ${JSON.stringify(JSON.stringify(fixture))})`);
    await win.loadURL('garden://app/');
    await until(() => evaluate('!!document.querySelector(".home-play")'), '测试存档');
    await focusWindow(); await setupPad();
    await evaluate('choose(".home-play")');
  }
  await loadFixture(roomFixture('reward'));
  await until(() => evaluate('document.querySelector(".platform-game")?.dataset.gameStatus === "reward"'), '奖励存档恢复');
  await evaluate('testPad.buttons[0]={pressed:true,value:1};testPad.buttons[2]={pressed:true,value:1}'); await wait(400);
  assert.equal(await evaluate('document.querySelectorAll(".reward-choice[aria-pressed=true]").length'), 0, '连按不选奖励');
  assert.equal(await evaluate('document.querySelector(".reward-confirm").disabled'), true);
  await evaluate('testPad.buttons[0]={pressed:false,value:0};testPad.buttons[2]={pressed:false,value:0}'); await wait(150);
  await evaluate('choose(".reward-choice")');
  assert.equal(await evaluate('document.querySelector(".platform-game").dataset.gameStatus'), 'reward', '选卡不自动领取');
  await evaluate('choose(".reward-confirm")');
  await until(() => evaluate('document.querySelector(".platform-game")?.dataset.gameStatus === "playing"'), '主动领取奖励');
  await loadFixture(roomFixture('fallen'));
  await until(() => evaluate('document.querySelector(".platform-game")?.dataset.gameStatus === "fallen"'), '死亡存档恢复');
  await evaluate('testPad.buttons[0]={pressed:true,value:1}'); await wait(400);
  assert.equal(await evaluate('document.querySelector(".platform-game").dataset.gameStatus'), 'fallen', '死亡不默认继续');
  await evaluate('testPad.buttons[0]={pressed:false,value:0}'); await wait(150);
  await evaluate('choose(".death-menu .primary-button")');
  await until(() => evaluate('document.querySelector(".platform-game")?.dataset.gameStatus === "playing"'), '主动复活');
  const survival = await evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(saveKey)})).state.survival`);
  assert.equal(survival.lives, 2); assert.equal(survival.hp, survival.maxHp);
  await loadFixture(roomFixture('over'));
  await until(() => evaluate('document.querySelector(".platform-game")?.dataset.gameStatus === "ended"'), '零命结算');
  assert.equal(await evaluate('document.querySelector(".death-menu .primary-button").disabled'), true);
  await evaluate('(async()=>{await tap(1);await tap(9)})()'); await wait(150);
  assert.equal(await evaluate('document.querySelector(".platform-game").dataset.gameStatus'), 'ended');
  await evaluate('choose(".death-menu .text-button")');
  await until(status('playing'), '零命后用手柄重来');
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(saveKey)})).state.survival.lives`), 3, '重来恢复三条命');
  await loadFixture(roomFixture('loot-pending'));
  await until(() => evaluate('document.querySelector(".platform-game")?.dataset.gameStatus === "life-loot"'), '补给待选择');
  // 补给是点一下就领走，没有第二步确认；按住的键不算数。
  await evaluate('testPad.buttons[0]={pressed:true,value:1}'); await wait(400);
  assert.equal(await evaluate('document.querySelector(".platform-game").dataset.gameStatus'), 'life-loot', '按住 A 不会误领补给');
  await evaluate('testPad.buttons[0]={pressed:false,value:0}'); await wait(150);
  await evaluate('choose(".life-loot-panel .reward-choice:not(:disabled)")');
  await until(() => evaluate('document.querySelector(".platform-game")?.dataset.gameStatus === "playing"'), '主动领取补给');
  const doorSave = roomFixture();
  await loadFixture(doorSave);
  await until(status('paused'), '门前存档恢复');
  // 新房间画面恢复后先让手柄保持松开，跨页防误触才会接受下一次 Menu。
  await evaluate('testWait(150)');
  await evaluate('tap(9)');
  await until(status('playing'), 'Menu 继续');
  assert.equal(await evaluate('document.body.textContent.includes("进门")'), false, '画面上不写进门');
  const depth = '[...document.querySelectorAll(".room-hud-path li")].findIndex(item => item.hasAttribute("aria-current"))';
  await evaluate('testPad.buttons[0]={pressed:true,value:1};testPad.buttons[2]={pressed:true,value:1}'); await wait(500);
  await evaluate('testPad.buttons[0]={pressed:false,value:0};testPad.buttons[2]={pressed:false,value:0}'); await wait(900);
  assert.equal(await evaluate(depth), 0, '没跳到发光的门上，连按跳和攻击不会进门');
  await evaluate('testPad.axes[0]=1');
  await until(() => evaluate(`${depth} === 1`), '摇杆走到低门进入下一间');
  await evaluate('testPad.axes[0]=0');
  await evaluate('tap(9)');
  await until(status('paused'), '进入下一间后暂停');
  // 只用存档把人放到小店摊位前，买东西仍必须实际按方向键上。
  let shopWorld, shop;
  for (let seed = 1; seed <= 40 && !shop; seed++) {
    shopWorld = createRoomWorld(seed, doorSave.state.levelId);
    shop = shopWorld.rooms.find(room => room.kind === 'shop');
  }
  assert.ok(shop, '测试种子里有小店');
  const shopSave = roomFixture('room', doorSave.state.levelId, { seed: shopWorld.seed, roomId: shop.id });
  const stall = shop.stalls.find(item => item.id === 'heal');
  assert.ok(stall);
  Object.assign(shopSave.state.players[0], { safeId: stall.platformId, safeX: spotPosition(shopWorld, stall).x });
  shopSave.state.survival.hp = 40; resourcesFor(shopSave.state.adventure).balance = 20;
  await loadFixture(shopSave); await until(status('paused'), '小店存档');
  await evaluate('tap(9)'); await until(status('playing'), '继续逛小店');
  await evaluate('tap(12)');
  await until(() => evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(saveKey)})).state.rooms.bought.includes(${JSON.stringify(`${shop.id}:heal`)})`), '手柄按上购买');
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(saveKey)})).state.survival.hp`), 90, '购买恢复血量');
  async function checkWorldSwitch() {
    const first = roomFixture('room', 'rainbow-waterways', { roomId: 3 });
    const current = () => evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(saveKey)}))`);
    await loadFixture(first);
    await until(status('paused'), '第一关中途存档');
    await evaluate('choose("[data-switch-world]")');
    await until(status('worlds'), '暂停选关');
    await evaluate('tap(1)');
    await until(status('paused'), 'B 取消换关');
    await evaluate('choose("[data-switch-world]")');
    await evaluate('choose("[data-world=family]")');
    await until(status('camp'), '新世界选角色');
    await evaluate('tap(1)');
    await until(status('worlds'), '营地返回换关页');
    await evaluate('tap(1)');
    await until(status('paused'), '取消出发回到原来的第一关');
    assert.equal((await current()).run.id, first.run.id);
    await evaluate('choose("[data-switch-world]")');
    await evaluate('choose("[data-world=family]")');
    await until(status('camp'), '再次进入新世界营地');
    await evaluate('choose(".character-depart")');
    await until(status('playing'), '第二关出发');
    await evaluate('tap(9)');
    await until(status('paused'), '保存第二关');
    const second = await current();
    assert.notEqual(second.run.id, first.run.id);
    await win.loadURL('garden://app/');
    await until(() => evaluate('!!document.querySelector(".home-play")'), '重开首页');
    await focusWindow(); await setupPad();
    await evaluate('choose(".home-play")');
    await until(status('paused'), '首页继续最近的第二关');
    await evaluate('choose("[data-switch-world]")');
    await evaluate('choose("[data-world=rainbow]")');
    await until(status('playing'), '恢复第一关');
    const resumed = await current();
    assert.equal(resumed.run.id, first.run.id);
    assert.equal(resumed.run.seed, first.run.seed);
    assert.deepEqual(resumed.state.rooms.path, first.state.rooms.path);
    assert.equal(resumed.state.players[0].safeId, first.state.players[0].safeId);
    assert.deepEqual(resumed.state.collectedIds, first.state.collectedIds);
    await evaluate('tap(9)');
    await until(status('paused'), '第一关再暂停');
    await evaluate('choose("[data-switch-world]")');
    await evaluate('choose("[data-world=family]")');
    await until(status('playing'), '恢复第二关');
    assert.equal((await current()).run.id, second.run.id);
  }
  async function checkCompletion() {
    await loadFixture(roomFixture('finish'));
    await until(status('paused'), '首领打赢后存档');
    await evaluate('tap(9)');
    await until(status('reward'), '通关奖励');
    await evaluate('choose(".reward-choice")'); await evaluate('choose(".reward-confirm")');
    await until(status('completed'), '通关结算');
    await until(() => evaluate('!!document.querySelector(".result-saved")'), '结算保存完成');
    assert.equal(await evaluate('document.activeElement.matches(".adventure-menu-actions .primary-button")'), true, '结算保存后焦点仍在去下一关');
    const finishedCharacter = await evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(saveKey)})).state.survival.character`);
    await evaluate('tap(0)');
    await until(status('playing'), '结算已高亮的下一关按一次 A 直接出发');
    assert.equal(await evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(saveKey)})).state.survival.character`), finishedCharacter, '下一关保留角色');
  }
  async function checkWeaponBindings() {
    win.setContentSize(1280, 720);
    const fixture = roomFixture('boss'), adventure = fixture.state.adventure;
    adventure.weapons = ['lightblade', 'bubble', 'moonblade', 'stars', 'seed'];
    adventure.loadouts[0].weapon = 'lightblade'; adventure.loadouts[0].weapons = [...adventure.weapons];
    adventure.magic.ranks.snow = 1; adventure.magic.equipped = ['snow']; adventure.magic.charges.snow = 16;
    adventure.attackBindings = ['lightblade', 'moonblade', 'snow'];
    const save = `JSON.parse(localStorage.getItem(${JSON.stringify(saveKey)})).state`;
    await loadFixture(fixture);
    await until(status('paused'), '测试局暂停');
    await evaluate('tap(9)'); await until(status('playing'), '手柄继续探险');
    await evaluate('tap(9)'); await until(status('paused'), 'Menu 暂停');
    await evaluate('tap(13)');
    assert.match(await evaluate('document.activeElement.textContent'), /武器搭配/);
    await evaluate('tap(0)');
    await until(status('weapon-bindings'), '暂停菜单打开圆环');
    const elapsed = await evaluate(`${save}.elapsed`);
    await evaluate('tap(1)');
    assert.equal(await evaluate('document.querySelector(".weapon-wheel button[aria-pressed=true]")'), null);
    await evaluate('testPad.axes[0]=Math.sqrt(3)/2;testPad.axes[1]=-.5;waitPadFrames()');
    await evaluate('testPad.axes[0]=0;testPad.axes[1]=0;waitPadFrames()');
    assert.equal(await evaluate('document.querySelector(".weapon-wheel button[aria-pressed=true]").getAttribute("aria-label")'), '魔法泡泡');
    await writeFile(join(process.env.GARDEN_DESKTOP_PROFILE, 'weapon-wheel.png'), (await win.webContents.capturePage()).toPNG());
    await evaluate('tap(7)');
    assert.deepEqual(await evaluate(`${save}.adventure.attackBindings`), ['lightblade', 'moonblade', 'snow'], 'RT 在圆环里不会替 X 绑定');
    await evaluate('tap(3)');
    assert.deepEqual(await evaluate(`${save}.adventure.attackBindings`), ['lightblade', 'bubble', 'snow']);
    await evaluate('tap(12);');
    await evaluate('tap(1)');
    assert.deepEqual(await evaluate(`${save}.adventure.attackBindings`), ['snow', 'bubble', 'lightblade'], 'B 绑定并交换两格');
    assert.equal(await evaluate(`${save}.elapsed`), elapsed, '换装全程继续暂停');
    await evaluate('tap(9)'); await until(status('paused'), 'Menu 返回暂停');
    await evaluate('tap(0)'); await until(status('playing'), '暂停菜单继续探险');
    await evaluate('tap(9)'); await until(status('paused'), '重新暂停');

    fixture.state.adventure.weapons = Object.keys(WEAPONS);
    await loadFixture(fixture); await until(status('paused'), '读取多武器测试存档');
    await evaluate('tap(13)'); await evaluate('tap(0)');
    await until(status('weapon-bindings'), '打开多页圆环');
    assert.equal(await evaluate('document.querySelectorAll(".weapon-wheel button").length'), 8);
    await evaluate('tap(5)');
    assert.equal(await evaluate('document.querySelectorAll(".weapon-wheel button").length'), 2);
    await evaluate('tap(5)');
    assert.equal(await evaluate('document.querySelectorAll(".weapon-wheel button").length'), 8);
  }
  await checkCompletion();
  await checkWorldSwitch();
  console.log(JSON.stringify({ result: 'passed', actualPads, tests: ['方向键走遍菜单、选关、角色、装备和试用', '已高亮菜单一次 A 生效', '移动、跳跃、暂停、本领一览、选项', '断连、重连、防误触、失焦', '设置、全屏、成绩筛选、画展、成就、画册', '应用内备份和恢复', '三个小游戏全部题目、完成和重玩', '花园贴纸', '奖励、补给、死亡、零命重来', '进门、小店购买、通关领奖、结算、直接下一关'], before, after }));
  app.exit(0);
} catch (error) {
  console.error(error);
  if (win && !win.isDestroyed()) {
    console.error('手柄失败现场', await win.webContents.executeJavaScript('JSON.stringify({focus:document.hasFocus(),hidden:document.hidden,active:document.activeElement?.outerHTML.slice(0,300),page:document.body.innerText.slice(0,700),events:window.padFocusEvents,samples:window.padSamples?.slice(-15)})'));
    await writeFile(join(process.env.GARDEN_DESKTOP_PROFILE,'failure.png'),(await win.webContents.capturePage()).toPNG());
  }
  app.exit(1);
}

}
run();
