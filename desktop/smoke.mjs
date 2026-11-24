import { roomFixture } from '../tests/helpers/adventure-fixtures.mjs';
import { ADVENTURE_GENERATION_VERSION, TIMED_ITEMS } from '../shared/adventure-catalog.js';
import { PLAYABLE_WORLDS } from '../shared/levels.js';
import { app } from 'electron';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function runSmoke({ win, requestClose }) {
  const wc = win.webContents, profile = app.getPath('userData');
  const evaluate = code => wc.executeJavaScript(code);
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function capture() {
    win.show(); win.focus();
    await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    try { return await wc.capturePage(); } catch (error) {
      if (!String(error).includes('UnknownVizError')) throw error;
      // 窗口大小切换后的合成帧偶尔尚未就绪；等待下一帧后仅重试一次截图。
      wc.invalidate(); await wait(300); return wc.capturePage();
    }
  }
  async function until(code) {
    for (let i = 0; i < 150; i++) {
      if (await evaluate(code)) return;
      // 无边框窗口失焦会正确暂停；测试回到前台后，像玩家一样明确继续。
      if (!win.isFocused() && !win.isMinimized()) {
        app.focus({steal:true}); win.show(); win.focus(); wc.focus(); await wait(200);
        if (/gameStatus === "(playing|reward|completed)"/.test(code) && await evaluate('document.hasFocus() && document.querySelector(".platform-game")?.dataset.gameStatus === "paused"')) {
          await evaluate('document.querySelector("[data-gamepad-resume]")?.click()');
        }
      }
      await wait(100);
    }
    throw new Error(`Not ready: ${code}; window=${JSON.stringify({focused:win.isFocused(),visible:win.isVisible(),minimized:win.isMinimized()})}; UI=${await evaluate('JSON.stringify({status:document.querySelector(".platform-game")?.dataset.gameStatus,text:document.body.innerText.slice(-1200)})')}`);
  }

  const isReopen = process.env.GARDEN_DESKTOP_PHASE === 'reopen';
  await until('!!document.querySelector(".home-play")');
  await until('document.fonts.check("18px GardenHand")');
  await until('Array.from(document.images).every(image => image.complete && image.naturalWidth > 0)');
  await wait(1000);
  assert.equal(win.isFullScreen(), !isReopen, '初次全屏，重启恢复窗口模式');
  assert.deepEqual(win.getBounds(),win.getContentBounds(),'无边框窗口内容应铺满客户区');
  assert.equal(await evaluate('document.querySelector(".desktop-window-bar")'),null);
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".home-title")).getPropertyValue("-webkit-app-region")'),'drag');
  assert.equal(await evaluate('typeof window.require'), 'undefined');
  assert.equal(await evaluate('typeof window.gardenDesktop.quit'), 'function');
  if (!isReopen) await evaluate('window.gardenDesktop.setWindowMode("windowed")');
  // 通过实际界面记录三个独立盘面，退出桌面再打开后仍恢复同一局。
  const miniProofPath = join(profile, 'mini-games.json');
  const miniProof = isReopen ? JSON.parse(await readFile(miniProofPath, 'utf8')) : {};
  await evaluate(`Array.from(document.querySelectorAll('.home-navigation button')).find(button => button.textContent === '小游戏').click()`);
  await until('!!document.querySelector(".home-games .quest-card")');
  for (const [index, id] of ['rainbow', 'garden', 'treat'].entries()) {
    await evaluate(`document.querySelectorAll('.quest-card')[${index}].click()`);
    await until(`document.querySelector('.mini-${id} .mini-stage') !== null`);
    try { await until('document.querySelector(".mini-game audio")?.readyState >= 2'); }
    catch { throw new Error('离线引导未就绪：' + await evaluate('JSON.stringify({src:document.querySelector("audio")?.src, ready:document.querySelector("audio")?.readyState, error:document.querySelector("audio")?.error?.message})')); }
    assert.equal(await evaluate('document.querySelector(".mini-game audio").error'), null);
    if (!isReopen) {
      if (id === 'rainbow') await evaluate(`document.querySelector('[aria-label="找到' + document.querySelector('.find-clue strong').textContent + '"]').click()`);
      if (id === 'garden') {
        await evaluate(`document.querySelector('[aria-label="' + document.querySelector('.plant-need span').textContent.slice(1) + '种子"]').click()`);
        await evaluate(`document.querySelector('.plant-target').click()`);
      }
      if (id === 'treat') {
        await evaluate(`document.querySelector('.mini-pick[aria-label="蛋筒"]').click()`);
        await evaluate(`document.querySelector('.icecream-drop').click()`);
      }
    }
    const evidence = await evaluate(`JSON.stringify({progress:document.querySelector('.mini-progress-copy').textContent, clue:document.querySelector('.mini-stage').getAttribute('aria-label'), images:Array.from(document.querySelectorAll('${id === 'garden' ? '.plant-target' : id === 'treat' ? '.icecream-drop' : '.find-clue'} img'),image=>image.alt)})`);
    if (isReopen) assert.equal(evidence, miniProof[id], `${id} 退出后盘面应保持不变`);
    else miniProof[id] = evidence;
    await until('Array.from(document.querySelectorAll(".mini-game img")).every(image => image.complete && image.naturalWidth > 0)');
    await writeFile(join(profile, `${id}-${isReopen ? 'reopen' : 'play'}.png`), (await capture()).toPNG());
    await evaluate('document.querySelector(".mini-header .quiet-button").click()');
    await until('!!document.querySelector(".quest-card")');
  }
  await evaluate('document.querySelector(".home-back").click()');
  await until('!!document.querySelector(".home-play")');
  if (!isReopen) await writeFile(miniProofPath, JSON.stringify(miniProof));
  const from = new Date(); from.setDate(from.getDate() - 1);
  const untilDate = new Date(); untilDate.setDate(untilDate.getDate() + 1);
  const reportCode = `fetch('/api/scores?from=${from.toISOString()}&until=${untilDate.toISOString()}').then(r=>r.json())`;
  if (process.env.GARDEN_DESKTOP_PHASE === 'reopen') {
    assert.equal(await evaluate('localStorage.getItem("desktop-test-marker")'), 'retained');
    const report = await evaluate(reportCode);
    assert.ok(report.summary.total > 0);
    assert.ok(report.records.some(run => run.status === 'ended'));
    await writeFile(join(profile, 'result.json'), JSON.stringify({ isFullscreen: win.isFullScreen(), reopened: true, total: report.summary.total, sessions: report.summary.sessions, electron: process.versions.electron, node: process.versions.node }));
    await evaluate('document.querySelector(".home-play").click()');
    await until('document.querySelector(".platform-game")?.dataset.gameStatus === "ended"');
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".adventure-menu-actions button"),b=>b.textContent.trim())'),['继续（没有剩余命数）','重来']);
    assert.equal(await evaluate('JSON.parse(localStorage.getItem("garden-active-adventure-v1")).state.survival.lives'),0);
    assert.equal(await evaluate('document.querySelector(".death-menu .primary-button").disabled'),true);
    await evaluate('document.querySelector(".death-menu .text-button").click()');
    await until('document.querySelector(".platform-game")?.dataset.gameStatus === "playing"');
    const fresh = await evaluate('JSON.parse(localStorage.getItem("garden-active-adventure-v1"))');
    // 旧局重来时，从当前第一世界的河谷重新出发。
    assert.equal(fresh.state.levelId,PLAYABLE_WORLDS[0].id);assert.equal(fresh.state.version,ADVENTURE_GENERATION_VERSION);assert.equal(fresh.state.rooms.roomId,0);assert.equal(fresh.state.survival.lives,3);assert.equal(fresh.state.survival.hp,100);assert.equal(fresh.state.survival.character,'mom');
    await writeFile(join(profile,'zero-life-reopen.png'),(await capture()).toPNG());
    requestClose(); return;
  }
  await evaluate('localStorage.setItem("desktop-test-marker","retained")');
  await evaluate('document.querySelector(".home-play").click()');
  await until('document.querySelector(".platform-game")?.dataset.gameStatus === "ready"');
  await until('!!document.querySelector(".atlas-mark")');
  assert.equal(await evaluate('document.querySelectorAll(".atlas-mark").length'), 9);
  await until('document.querySelector(".atlas-art")?.naturalWidth > 0');
  assert.equal(await evaluate('!!document.querySelector(".family-grid")'), false);
  assert.equal(await evaluate('!!document.querySelector(".adventure-menu .desktop-update-status")'), false);
  await wait(500);
  await writeFile(join(profile, 'levels.png'), (await capture()).toPNG());
  await wait(300); win.focus(); wc.focus(); await wait(300);
  await evaluate('document.querySelector(".atlas-page .departure-confirm").click()');
  await until('document.querySelector(".platform-game")?.dataset.gameStatus === "camp"');
  assert.equal(await evaluate('document.querySelectorAll(".family-portrait").length'),4);
  await evaluate('document.querySelectorAll(".family-portrait")[1].click()');
  assert.equal(await evaluate('document.querySelector(".family-portrait[aria-pressed=true]").dataset.character'), 'mom');
  await evaluate('document.querySelector(".family-page .departure-secondary").click()');
  await until('!!document.querySelector(".character-try-row button")');
  await evaluate('document.querySelector(".character-try-row button").click()');
  await wait(1600);
  await evaluate('document.querySelector(".loadout-page .departure-back").click()');
  await until('!!document.querySelector(".family-grid")');
  await writeFile(join(profile,'characters.png'),(await capture()).toPNG());
  await evaluate('document.querySelector(".character-depart-action").click()');
  await until('document.querySelector(".platform-game")?.dataset.gameStatus === "playing"');
  assert.equal(await evaluate('document.querySelectorAll(".reward-panel").length'),0);
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("garden-active-adventure-v1")).state.survival.lives'),3);
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("garden-active-adventure-v1")).state.survival.hp'),100);
  // 新花谷的进度条包含八个区域。
  await until('document.querySelectorAll(".room-hud-path li").length === 8');
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("garden-active-adventure-v1")).state.rooms.roomId'),0);
  await writeFile(join(profile, 'room.png'), (await capture()).toPNG());
  await evaluate('document.querySelector("[aria-label=暂停探险]").click()');
  await until('document.querySelector(".platform-game")?.dataset.gameStatus === "paused"');
  assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".pause-actions button"), button => button.textContent.trim())'), ['换世界', '回花园', '武器搭配', '本领一览', '选项']);
  assert.equal(await evaluate('document.activeElement.dataset.pauseAction'), 'resume');
  // 模拟本机存档写满。离开关卡的两个入口都必须留在画册里，让孩子可以重试。
  await evaluate(`(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'garden-active-adventure-v1') throw new DOMException('full', 'QuotaExceededError');
      return setItem.call(this, key, value);
    };
    try {
      document.querySelector('[data-pause-action=worlds]').click();
      document.querySelector('[data-pause-action=garden]').click();
    } finally { Storage.prototype.setItem = setItem; }
  })()`);
  await until('!!document.querySelector(".pause-book [role=alert]")');
  await evaluate('document.querySelector("[data-pause-action=overview]").click()');
  await until('document.querySelector(".platform-game")?.dataset.gameStatus === "overview"');
  assert.equal(await evaluate('document.querySelectorAll(".platform-game [role=dialog], .platform-game .adventure-overlay").length'),0,'本领一览是整页，不是弹窗');
  await writeFile(join(profile, 'overview.png'), (await capture()).toPNG());
  await evaluate('document.querySelector(".run-overview .home-back").click()');
  await until('document.activeElement.dataset.pauseAction === "overview"');
  await evaluate('document.querySelector("[data-pause-action=options]").click()');
  await until('document.querySelector(".platform-game")?.dataset.gameStatus === "options"');
  await writeFile(join(profile, 'game-options.png'), (await capture()).toPNG());
  await evaluate('document.querySelector(".home-options .home-back").click()');
  await until('document.activeElement.dataset.pauseAction === "options"');
  // 稀疏宝物不保证出现在任意随机路线；用固定局的真实宝物验证键盘拾取。
  await evaluate('document.querySelector("[data-pause-action=garden]").click()');
  await until('!!document.querySelector(".home-play")');
  const scoring=roomFixture('score');
  await evaluate(`localStorage.setItem('garden-active-adventure-v1',${JSON.stringify(JSON.stringify(scoring))})`);
  await new Promise(resolve=>{wc.once('did-finish-load',resolve);wc.reload();});
  await until('!!document.querySelector(".home-play")');
  await evaluate('document.querySelector(".home-play").click()');
  await until('document.querySelector(".platform-game")?.dataset.gameStatus === "paused"');
  await evaluate('document.querySelector("[data-gamepad-resume]").click()');
  win.focus(); await wait(800);
  if (await evaluate('document.querySelector(".platform-game")?.dataset.gameStatus === "paused"')) {
    await evaluate('document.querySelector("[data-gamepad-resume]").click()');
  }
  // Real key events exercise physics and collectible scoring before closing mid-run.
  for (let attempt = 0; attempt < 20; attempt++) {
    if (await evaluate('document.querySelector(".platform-game")?.dataset.gameStatus === "paused"')) await evaluate('document.querySelector("[data-gamepad-resume]").click()');
    app.focus({steal:true}); win.show(); win.focus(); wc.focus();
    await until('document.hasFocus()');
    wc.sendInputEvent({ type: 'keyDown', keyCode: 'Right' });
    await wait(350);
    wc.sendInputEvent({ type: 'keyUp', keyCode: 'Right' });
    await wait(400);
    if (Number(await evaluate('document.querySelector(".score-total").textContent')) > 0) break;
  }
  assert.ok(Number(await evaluate('document.querySelector(".score-total").textContent')) > 0, 'Real gameplay must collect a treasure: ' + await evaluate('JSON.stringify(document.querySelector(".platform-game").dataset)'));
  await writeFile(join(profile, 'playing.png'), (await capture()).toPNG());
  win.minimize(); await wait(500); assert.equal(win.isMinimized(),true);
  win.restore(); win.focus(); await wait(500);
  await evaluate('window.gardenDesktop.setWindowMode("maximized")'); assert.equal(win.isMaximized(),true); assert.equal(win.isFullScreen(),false);
  await evaluate('window.gardenDesktop.setWindowMode("windowed")'); assert.equal(win.isMaximized(),false);
  // 最小化会自动暂停，恢复窗口后也要由玩家主动继续。
  if (await evaluate('document.querySelector(".platform-game").dataset.gameStatus === "playing"')) {
    await evaluate('document.querySelector("[aria-label=暂停探险]").click()');
  }
  await until('document.querySelector(".platform-game")?.dataset.gameStatus === "paused"');
  await evaluate('document.querySelector("[data-pause-action=garden]").click()');
  await until('!!document.querySelector(".home-play")');
  const completed = roomFixture('finish');
  completed.state.adventure = roomFixture('stack').state.adventure;
  completed.state.survival.character='mom';completed.state.survival.attacks=3;
  await evaluate(`localStorage.setItem('garden-active-adventure-v1',${JSON.stringify(JSON.stringify(completed))})`);
  await new Promise(resolve => { wc.once('did-finish-load',resolve); wc.reload(); }); await until('!!document.querySelector(".home-play")');
  await evaluate('document.querySelector(".home-play").click()');
  await until('document.querySelector(".platform-game")?.dataset.gameStatus === "paused"');
  await evaluate('document.querySelector("[data-gamepad-resume]").click()');
  await until('document.querySelector(".platform-game")?.dataset.gameStatus === "reward"');
  assert.equal(await evaluate('document.activeElement.classList.contains("reward-panel")'), true);
  assert.equal(await evaluate('document.querySelector(".reward-confirm").disabled'), true);
  const beforeReward = await evaluate('JSON.parse(localStorage.getItem("garden-active-adventure-v1")).state');
  const pendingBefore = JSON.stringify(beforeReward.journey.pending);
  wc.focus();
  wc.sendInputEvent({ type: 'keyDown', keyCode: 'Space' });
  for (let i = 0; i < 6; i++) wc.sendInputEvent({ type: 'keyDown', keyCode: 'Space', isAutoRepeat: true });
  wc.sendInputEvent({ type: 'keyUp', keyCode: 'Space' });
  wc.sendInputEvent({ type: 'keyDown', keyCode: 'Return' });
  wc.sendInputEvent({ type: 'keyUp', keyCode: 'Return' });
  await wait(700);
  assert.equal(await evaluate('document.querySelector(".platform-game").dataset.gameStatus'), 'reward');
  assert.equal(await evaluate('document.querySelectorAll(".reward-choice[aria-pressed=true]").length'), 0);
  await writeFile(join(profile, 'reward.png'), (await capture()).toPNG());
  await evaluate('document.querySelectorAll(".reward-choice")[0].click()');
  await wait(400);
  assert.equal(await evaluate('document.querySelector(".platform-game").dataset.gameStatus'), 'reward');
  assert.equal(await evaluate('JSON.stringify(JSON.parse(localStorage.getItem("garden-active-adventure-v1")).state.journey.pending)'), pendingBefore);
  assert.equal(await evaluate('document.querySelectorAll(".reward-choice")[0].getAttribute("aria-pressed")'), 'true');
  await evaluate('document.querySelector(".reward-confirm").click()');
  await until('document.querySelector(".platform-game")?.dataset.gameStatus === "completed"');
  const afterReward = await evaluate('JSON.parse(localStorage.getItem("garden-active-adventure-v1")).state');
  const picked = beforeReward.journey.pending.choices[0], expectedEffects = {...beforeReward.adventure.effects};
  if (picked.type === 'timed') expectedEffects[picked.id] = Math.min(TIMED_ITEMS[picked.id].duration * 2, (expectedEffects[picked.id] || 0) + TIMED_ITEMS[picked.id].duration);
  assert.deepEqual(afterReward.adventure.effects, expectedEffects, '领奖等待期间不耗时，限时奖励按规则续时');
  await evaluate('document.querySelector(".adventure-menu-actions .primary-button").click()');
  await until('document.querySelector(".platform-game")?.dataset.gameStatus === "playing"');
  const carried = await evaluate('JSON.parse(localStorage.getItem("garden-active-adventure-v1")).state');
  // 下一关是第二个世界的开场房；角色、命数、血量、攻击累计和武器都带过去，不补满。
  assert.equal(carried.levelId,PLAYABLE_WORLDS[1].id);assert.equal(carried.version,ADVENTURE_GENERATION_VERSION);assert.equal(carried.rooms.roomId,0);
  assert.equal(carried.survival.character,'mom');assert.equal(carried.survival.hp,afterReward.survival.hp);assert.equal(carried.survival.lives,afterReward.survival.lives);assert.equal(carried.survival.attacks,3);assert.ok(carried.adventure.loadouts[0].weapons.length>=3);
  for (const [id, remaining] of Object.entries(expectedEffects)) assert.ok(carried.adventure.effects[id] > remaining - 1 && carried.adventure.effects[id] <= remaining, `${id} 的领奖后时长应带入下一关`);
  await evaluate('document.querySelector("[aria-label=暂停探险]").click()');
  await evaluate('document.querySelector("[data-pause-action=garden]").click()');
  await until('!!document.querySelector(".home-play")');
  const fallen=roomFixture('fallen');
  await evaluate(`localStorage.setItem('garden-active-adventure-v1',${JSON.stringify(JSON.stringify(fallen))})`);
  await new Promise(resolve => { wc.once('did-finish-load',resolve); wc.reload(); }); await until('!!document.querySelector(".home-play")');
  await evaluate('document.querySelector(".home-play").click()');
  await until('document.querySelector(".platform-game")?.dataset.gameStatus === "fallen"');
  assert.equal(await evaluate('document.querySelector(".adventure-menu-actions .primary-button").textContent'),'继续');
  await writeFile(join(profile,'life-lost.png'),(await capture()).toPNG());
  await evaluate('document.querySelector(".adventure-menu-actions .primary-button").click()');
  await until('document.querySelector(".platform-game")?.dataset.gameStatus === "playing"');
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("garden-active-adventure-v1")).state.survival.hp'),100);
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("garden-active-adventure-v1")).state.survival.lives'),2);
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("garden-active-adventure-v1")).state.players[0].safeX'),fallen.state.players[0].safeX);
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("garden-active-adventure-v1")).state.players[0].safeId'),fallen.state.players[0].safeId);
  await evaluate('document.querySelector("[aria-label=暂停探险]").click()');
  await evaluate('document.querySelector("[data-pause-action=garden]").click()');
  await until('!!document.querySelector(".home-play")');
  const over=roomFixture('over');
  await evaluate(`localStorage.setItem('garden-active-adventure-v1',${JSON.stringify(JSON.stringify(over))})`);
  await new Promise(resolve => { wc.once('did-finish-load',resolve); wc.reload(); }); await until('!!document.querySelector(".home-play")');
  await evaluate('document.querySelector(".home-play").click()');
  await until('document.querySelector(".platform-game")?.dataset.gameStatus === "ended"');
  await writeFile(join(profile,'zero-life.png'),(await capture()).toPNG());
  requestClose();
}
