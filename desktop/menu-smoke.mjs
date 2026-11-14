import { app, dialog } from 'electron';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { rogueliteFixture } from '../tests/helpers/adventure-fixtures.mjs';

export async function runMenuSmoke({ win, tray, trayMenu, requestClose }) {
  const profile = app.getPath('userData');
  const evaluate = code => win.webContents.executeJavaScript(code);
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function until(check) {
    for (let i = 0; i < 150; i++) { if (await check()) return; await wait(100); }
    throw new Error('桌面菜单验收等待超时');
  }
  await until(() => evaluate('!!document.querySelector(".home-play")'));
  assert.equal(tray.isDestroyed(), false);
  assert.deepEqual(trayMenu.items.filter(item => item.type !== 'separator').map(item => item.label), ['全屏游玩', '重新启动', '退出游戏']);
  assert.equal(win.isFullScreen(), false, '启动仍为普通窗口');
  const restartMarker = join(profile, 'menu-restart-requested.json');
  let previous;
  try { previous = JSON.parse(await readFile(restartMarker, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (previous) {
    assert.notEqual(process.pid, previous.pid, '必须启动新进程，而非刷新页面');
    assert.equal(await evaluate('localStorage.getItem("menu-close-count")'), '2', '重复入口只能保存一次；失败后允许重试');
    const saved = await evaluate('JSON.parse(localStorage.getItem("garden-active-adventure-v1"))');
    assert.equal(saved.state.seed, previous.seed);
    assert.equal(saved.state.survival.hp, previous.hp);
    assert.equal(saved.state.survival.lives, previous.lives);
    await writeFile(join(profile, 'menu-result.json'), JSON.stringify({ restarted: true, pid: process.pid, previousPid: previous.pid, fullscreen: true, saveRetry: true, seed: saved.state.seed }));
    trayMenu.getMenuItemById('garden-quit').click();
    return;
  }
  trayMenu.getMenuItemById('garden-fullscreen').click();
  await until(() => win.isFullScreen() && trayMenu.getMenuItemById('garden-fullscreen').checked);
  trayMenu.getMenuItemById('garden-fullscreen').click();
  await until(() => !win.isFullScreen() && !trayMenu.getMenuItemById('garden-fullscreen').checked);

  const fixture = rogueliteFixture('rogue-score');
  await evaluate(`localStorage.setItem('garden-active-adventure-v1',${JSON.stringify(JSON.stringify(fixture))})`);
  await win.loadURL('garden://app/');
  await until(() => evaluate('!!document.querySelector(".home-play")'));
  await evaluate('document.querySelector(".home-play").click()');
  await until(() => evaluate('document.querySelector(".platform-game")?.dataset.gameStatus === "paused"'));
  // 第一次保存被阻止，留在游戏；重复点击重启/退出不得重发保存或意外退出。
  await evaluate(`window.addEventListener('garden:prepare-close', event => {
    const count = Number(localStorage.getItem('menu-close-count') || 0) + 1;
    localStorage.setItem('menu-close-count', String(count));
    if (count === 1) event.preventDefault();
  })`);
  const originalMessageBox = dialog.showMessageBox;
  let isFailureShown = false;
  dialog.showMessageBox = async () => { isFailureShown = true; await wait(150); return { response: 0 }; };
  trayMenu.getMenuItemById('garden-restart').click();
  trayMenu.getMenuItemById('garden-restart').click();
  requestClose();
  await until(() => isFailureShown);
  await wait(250);
  dialog.showMessageBox = originalMessageBox;
  assert.equal(await evaluate('localStorage.getItem("menu-close-count")'), '1');
  assert.equal(win.isDestroyed(), false);
  const saved = await evaluate('JSON.parse(localStorage.getItem("garden-active-adventure-v1"))');
  await writeFile(restartMarker, JSON.stringify({ pid: process.pid, seed: saved.state.seed, hp: saved.state.survival.hp, lives: saved.state.survival.lives }));
  trayMenu.getMenuItemById('garden-restart').click();
  trayMenu.getMenuItemById('garden-restart').click();
}
