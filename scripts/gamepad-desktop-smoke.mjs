// 由 test-gamepad-desktop.mjs 启动，始终使用独立用户目录。
import { app, BrowserWindow } from 'electron';
import assert from 'node:assert/strict';
import { adventureFixture, bossFixture } from '../tests/helpers/adventure-fixtures.mjs';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
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
  win.webContents.setBackgroundThrottling(false); win.show(); win.focus();
  const evaluate = code => win.webContents.executeJavaScript(code);
  await until(() => evaluate('!!document.querySelector(".home-play")'), '首页');
  const actualPads = await evaluate('[...navigator.getGamepads()].filter(Boolean).map(p=>({name:p.id,mapping:p.mapping}))');
  async function setupPad() {
    await evaluate(`
      window.testPad = { id: 'Xbox Wireless Controller (simulated)', index: 0, connected: true, mapping: 'standard', axes: [0,0,0,0], buttons: Array.from({length:17},()=>({pressed:false,value:0})) };
      window.testPads = [testPad];
      Object.defineProperty(navigator, 'getGamepads', {configurable:true,value:()=>testPads});
      window.testWait = ms=>new Promise(resolve=>setTimeout(resolve,ms));
      window.tap = async index=>{testPad.buttons[index]={pressed:true,value:1};await testWait(65);testPad.buttons[index]={pressed:false,value:0};await testWait(85);};
      window.choose = async selector=>{for(let i=0;i<90;i++){await tap(5);if(document.activeElement.matches(selector)){if(!document.activeElement.hasAttribute('data-gamepad-canvas'))await tap(0);return;}}throw Error('不能用手柄到达 '+selector);};
      window.dispatchEvent(new Event('focus'));
    `);
    await wait(150);
  }
  await setupPad();
  await evaluate('choose(".home-play")');
  await until(() => evaluate('!!document.querySelector(".level-choices")'), '选关');
  await evaluate('choose(".adventure-menu-actions .primary-button")');
  await until(() => evaluate('!!document.querySelector(".character-depart")'), '角色营地');
  await evaluate('choose(".starter-actions button:last-child")');
  await until(() => evaluate('!!document.querySelector(".starter-picker")'), '装备选择');
  await evaluate('tap(1)');
  await until(() => evaluate('!document.querySelector(".starter-picker")'), 'B 返回营地');
  await evaluate('choose(".character-depart")');
  await until(() => evaluate('document.querySelector(".platform-game")?.dataset.gameStatus === "playing"'), '开始探险');
  const before = await evaluate('JSON.parse(document.querySelector(".platform-game").dataset.playerPositions)[0]');
  await evaluate('testPad.axes[0]=0.6;testPad.buttons[0]={pressed:true,value:1};testPad.buttons[7]={pressed:true,value:1}');
  await wait(400);
  const after = await evaluate('JSON.parse(document.querySelector(".platform-game").dataset.playerPositions)[0]');
  assert.ok(after.x > before.x, '左摇杆实际移动角色'); assert.ok(after.y > before.y, 'A 实际跳跃');
  await evaluate('testPad.axes[0]=0;testPad.buttons[0]={pressed:false,value:0};testPad.buttons[7]={pressed:false,value:0}');
  await wait(100); await evaluate('tap(9)');
  await until(() => evaluate('document.querySelector(".platform-game")?.dataset.gameStatus === "paused"'), 'Menu 暂停');
  await evaluate('tap(1)');
  await until(() => evaluate('document.querySelector(".platform-game")?.dataset.gameStatus === "playing"'), 'B 继续');
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
  await until(() => evaluate('!!document.querySelector(".gamepad-settings")'), '手柄设置');
  await evaluate('choose(".gamepad-settings button[aria-pressed]")');
  assert.equal(await evaluate('document.querySelector(".gamepad-settings button[aria-pressed]").getAttribute("aria-pressed")'), 'false');
  await evaluate('choose("input[aria-label=摇杆死区]")');
  await evaluate('tap(15)');
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("garden-gamepad-settings-v1")).deadzone'), 0.24, '摇杆调整持久化设置');
  await evaluate('tap(1)');
  await until(() => evaluate('!!document.querySelector(".home-play")'), '返回首页');
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
  const saveKey = ['garden','active','adventure','v1'].join('-');
  async function loadFixture(fixture) {
    await win.loadURL('garden://app/');
    await until(() => evaluate('!!document.querySelector(".home-play")'), '测试首页');
    await evaluate(`localStorage.setItem(${JSON.stringify(saveKey)}, ${JSON.stringify(JSON.stringify(fixture))})`);
    await win.loadURL('garden://app/');
    await until(() => evaluate('!!document.querySelector(".home-play")'), '测试存档');
    win.focus(); await setupPad();
    await evaluate('choose(".home-play")');
  }
  await loadFixture(adventureFixture('reward'));
  await until(() => evaluate('document.querySelector(".platform-game")?.dataset.gameStatus === "reward"'), '奖励存档恢复');
  await evaluate('testPad.buttons[0]={pressed:true,value:1};testPad.buttons[2]={pressed:true,value:1}'); await wait(400);
  assert.equal(await evaluate('document.querySelectorAll(".reward-choice[aria-pressed=true]").length'), 0, '连按不选奖励');
  assert.equal(await evaluate('document.querySelector(".reward-confirm").disabled'), true);
  await evaluate('testPad.buttons[0]={pressed:false,value:0};testPad.buttons[2]={pressed:false,value:0}'); await wait(150);
  await evaluate('choose(".reward-choice")');
  assert.equal(await evaluate('document.querySelector(".platform-game").dataset.gameStatus'), 'reward', '选卡不自动领取');
  await evaluate('choose(".reward-confirm")');
  await until(() => evaluate('document.querySelector(".platform-game")?.dataset.gameStatus === "playing"'), '主动领取奖励');
  await loadFixture(adventureFixture('fallen'));
  await until(() => evaluate('document.querySelector(".platform-game")?.dataset.gameStatus === "fallen"'), '死亡存档恢复');
  await evaluate('testPad.buttons[0]={pressed:true,value:1}'); await wait(400);
  assert.equal(await evaluate('document.querySelector(".platform-game").dataset.gameStatus'), 'fallen', '死亡不默认继续');
  await evaluate('testPad.buttons[0]={pressed:false,value:0}'); await wait(150);
  await evaluate('choose(".death-menu .primary-button")');
  await until(() => evaluate('document.querySelector(".platform-game")?.dataset.gameStatus === "playing"'), '主动复活');
  const survival = await evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(saveKey)})).state.survival`);
  assert.equal(survival.lives, 2); assert.equal(survival.hp, survival.maxHp);
  await loadFixture(adventureFixture('over'));
  await until(() => evaluate('document.querySelector(".platform-game")?.dataset.gameStatus === "ended"'), '零命结算');
  assert.equal(await evaluate('document.querySelector(".death-menu .primary-button").disabled'), true);
  await evaluate('(async()=>{await tap(1);await tap(9)})()'); await wait(150);
  assert.equal(await evaluate('document.querySelector(".platform-game").dataset.gameStatus'), 'ended');
  await loadFixture(bossFixture('boss-loot-pending'));
  await until(() => evaluate('document.querySelector(".platform-game")?.dataset.gameStatus === "life-loot"'), '补给待选择');
  await evaluate('choose(".life-loot-panel .reward-choice:not(:disabled)")');
  assert.equal(await evaluate('document.querySelector(".platform-game").dataset.gameStatus'), 'life-loot');
  await evaluate('choose(".life-loot-panel footer .paper-action")');
  await until(() => evaluate('document.querySelector(".platform-game")?.dataset.gameStatus === "playing"'), '主动领取补给');
  console.log(JSON.stringify({ result: 'passed', actualPads, tests: ['菜单、选关、角色、装备', '移动、跳跃、暂停', '断连、重连、防误触、失焦', '设置持久化', '三个小游戏操作、放置与撤回', '花园贴纸', '奖励、补给、死亡、零命存档防误触'], before, after }));
  app.exit(0);
} catch (error) { console.error(error); app.exit(1); }

}
run();
