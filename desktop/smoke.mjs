import { app } from 'electron';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function runSmoke({ win, requestClose }) {
  const wc = win.webContents, profile = app.getPath('userData');
  const evaluate = code => wc.executeJavaScript(code);
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function until(code) { for (let i = 0; i < 150; i++) { if (await evaluate(code)) return; await wait(100); } throw new Error(`Not ready: ${code}`); }
  await until('!!document.querySelector(".adventure-launch button")');
  await until('document.fonts.check("18px GardenHand")');
  await until('Array.from(document.images).every(image => image.complete && image.naturalWidth > 0)');
  await wait(1000);
  assert.equal(win.isFullScreen(), true);
  assert.equal(await evaluate('typeof window.require'), 'undefined');
  assert.equal(await evaluate('typeof window.gardenDesktop.quit'), 'function');
  // 通过实际界面记录三个独立盘面，退出桌面再打开后仍恢复同一局。
  const miniProofPath = join(profile, 'mini-games.json');
  const isReopen = process.env.GARDEN_DESKTOP_PHASE === 'reopen';
  const miniProof = isReopen ? JSON.parse(await readFile(miniProofPath, 'utf8')) : {};
  for (const [index, id] of ['rainbow', 'garden', 'treat'].entries()) {
    await evaluate(`document.querySelectorAll('.quest-card')[${index}].click()`);
    await until(`document.querySelector('.mini-${id} .mini-stage') !== null`);
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
    await writeFile(join(profile, `${id}-${isReopen ? 'reopen' : 'play'}.png`), (await wc.capturePage()).toPNG());
    await evaluate('document.querySelector(".mini-header .quiet-button").click()');
    await until('!!document.querySelector(".quest-card")');
  }
  if (!isReopen) await writeFile(miniProofPath, JSON.stringify(miniProof));
  const from = new Date(); from.setDate(from.getDate() - 1);
  const untilDate = new Date(); untilDate.setDate(untilDate.getDate() + 1);
  const reportCode = `fetch('/api/scores?from=${from.toISOString()}&until=${untilDate.toISOString()}').then(r=>r.json())`;
  if (process.env.GARDEN_DESKTOP_PHASE === 'reopen') {
    assert.equal(await evaluate('localStorage.getItem("desktop-test-marker")'), 'retained');
    const report = await evaluate(reportCode);
    assert.ok(report.summary.total > 0);
    assert.ok(report.records.every(run => run.status === 'paused'));
    await writeFile(join(profile, 'result.json'), JSON.stringify({ isFullscreen: win.isFullScreen(), reopened: true, total: report.summary.total, sessions: report.summary.sessions, electron: process.versions.electron, node: process.versions.node }));
    await evaluate('document.querySelector(".adventure-launch button").click()');
    await until('document.querySelector(".platform-game")?.dataset.gameStatus === "paused"');
    assert.ok(Number(await evaluate('document.querySelector(".score-total").textContent')) > 0);
    requestClose(); return;
  }
  await evaluate('localStorage.setItem("desktop-test-marker","retained")');
  await evaluate('document.querySelector(".adventure-launch button").click()');
  await until('document.querySelector(".platform-game")?.dataset.gameStatus === "ready"');
  await until('!!document.querySelector(".level-choices button")');
  assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".adventure-menu-actions button"), button => button.textContent.trim())'), ['出发吧', '回到我的花园']);
  assert.equal(await evaluate('!!document.querySelector(".adventure-menu .desktop-update-status")'), false);
  await wait(500);
  await writeFile(join(profile, 'levels.png'), (await wc.capturePage()).toPNG());
  win.setFullScreen(false); await wait(1200); win.focus(); wc.focus(); await wait(300);
  await evaluate('document.querySelector(".adventure-menu-actions .primary-button").click()');
  await until('document.querySelector(".platform-game")?.dataset.gameStatus === "playing"');
  win.focus(); await wait(800);
  if (await evaluate('document.querySelector(".platform-game")?.dataset.gameStatus === "paused"')) {
    await evaluate('document.querySelector(".adventure-menu-actions .primary-button").click()');
  }
  // Real key events exercise physics and collectible scoring before closing mid-run.
  for (let attempt = 0; attempt < 20; attempt++) {
    if (await evaluate('document.querySelector(".platform-game")?.dataset.gameStatus === "paused"')) await evaluate('document.querySelector(".adventure-menu-actions .primary-button").click()');
    wc.focus();
    wc.sendInputEvent({ type: 'keyDown', keyCode: 'Right' });
    wc.sendInputEvent({ type: 'keyDown', keyCode: 'Space' });
    await wait(600);
    wc.sendInputEvent({ type: 'keyUp', keyCode: 'Space' });
    wc.sendInputEvent({ type: 'keyUp', keyCode: 'Right' });
    await wait(400);
    if (Number(await evaluate('document.querySelector(".score-total").textContent')) > 0) break;
  }
  assert.ok(Number(await evaluate('document.querySelector(".score-total").textContent')) > 0, 'Real gameplay must collect a treasure: ' + await evaluate('JSON.stringify(document.querySelector(".platform-game").dataset)'));
  await writeFile(join(profile, 'playing.png'), (await wc.capturePage()).toPNG());
  win.setFullScreen(false); await wait(800); assert.equal(win.isFullScreen(), false);
  win.setFullScreen(true); await wait(800); assert.equal(win.isFullScreen(), true);
  requestClose();
}
