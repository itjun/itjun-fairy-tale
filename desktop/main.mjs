import { app, BrowserWindow, dialog, ipcMain, Menu, protocol, session, shell } from 'electron';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { mkdir, access } from 'node:fs/promises';
import { DatabaseSync, backup } from 'node:sqlite';
import { openStore, validateRun } from '../server/store.mjs';
import { UpdateManager } from './updates.mjs';
import { APP_ORIGIN, createAppHandler, isAppUrl } from './protocol.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
app.setName('花园王国');
// Explicit test profile keeps verification out of the family's real saves.
if (process.env.GARDEN_DESKTOP_PROFILE) app.setPath('userData', resolve(process.env.GARDEN_DESKTOP_PROFILE));
protocol.registerSchemesAsPrivileged([{ scheme: 'garden', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
let win, store, databasePath, closeRequest, updater, installing = false, mayExit = false;
const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();

function trusted(event) { return win && event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame && isAppUrl(event.senderFrame.url); }
async function finishExit() {
  clearTimeout(closeRequest?.timer);
  if (installing) {
    try { await updater.apply(); }
    catch (error) { installing = false; closeRequest = null; updater.cancelInstall(); dialog.showErrorBox('更新未完成，游戏已保留', error.message); return; }
  }
  mayExit = true; app.quit();
}
async function closeFailed() {
  clearTimeout(closeRequest?.timer);
  closeRequest = null;
  if (installing) { installing = false; updater.cancelInstall(); }
  const { response } = await dialog.showMessageBox(win, { type: 'warning', title: '积分还没有保存好', message: '要留下来重试保存吗？', detail: '留在游戏中可以重试。直接退出后，尚未写入的积分会在下次打开时尝试补存。', buttons: ['留在游戏', '仍然退出'], defaultId: 0, cancelId: 0 });
  if (response === 1) finishExit();
}
function requestClose() {
  if (mayExit || closeRequest) return;
  const token = randomUUID();
  closeRequest = { token, timer: setTimeout(() => { void closeFailed(); }, 10000) };
  win.webContents.send('garden:prepare-close', token);
}
async function backupScores() {
  const { canceled, filePath } = await dialog.showSaveDialog(win, { title: '备份成绩本', defaultPath: `花园王国成绩-${new Date().toISOString().slice(0, 10)}.sqlite`, filters: [{ name: 'SQLite 成绩本', extensions: ['sqlite'] }] });
  if (canceled || !filePath) return;
  if (resolve(filePath) === databasePath) throw new Error('请选择其他备份位置。');
  const source = new DatabaseSync(databasePath, { readOnly: true });
  try { await backup(source, filePath); } finally { source.close(); }
  await dialog.showMessageBox(win, { message: '成绩本已备份。', detail: filePath });
}
async function importScores() {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, { title: '导入旧版或备份的成绩本', properties: ['openFile'], filters: [{ name: 'SQLite 成绩本', extensions: ['sqlite', 'db'] }] });
  if (canceled) return;
  if (resolve(filePaths[0]) === databasePath) throw new Error('这已经是正在使用的成绩本。');
  const source = new DatabaseSync(filePaths[0], { readOnly: true });
  let rows;
  try {
    rows = source.prepare('SELECT * FROM runs').all().map(row => ({ ...row, collectedIds: JSON.parse(row.collectedIds || '[]'), defeatedIds: JSON.parse(row.defeatedIds || '[]'), scoringVersion: row.scoringVersion || 1 }));
    rows.forEach(validateRun);
  } finally { source.close(); }
  store.importRuns(rows);
  await dialog.showMessageBox(win, { message: `已合并 ${rows.length} 条记录。`, detail: '原成绩本未修改，重复记录不会重复计分。重新打开“我的成绩本”即可查看。' });
}
function menuTask(task) { return () => { task().catch(error => dialog.showErrorBox('成绩本操作未完成', error.message)); }; }
async function createWindow() {
  win = new BrowserWindow({ width: 1280, height: 800, minWidth: 720, minHeight: 540, show: false, fullscreen: true, backgroundColor: '#faf8f1', title: '花园王国', icon: join(root, 'build/icon.png'), autoHideMenuBar: true,
    webPreferences: { preload: join(root, 'desktop/preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, spellcheck: false, backgroundThrottling: process.env.GARDEN_DESKTOP_SMOKE !== '1' } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => { if (!isAppUrl(url)) event.preventDefault(); });
  win.webContents.on('will-attach-webview', event => event.preventDefault());
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { event.preventDefault(); win.setFullScreen(!win.isFullScreen()); }
  });
  win.on('close', event => { if (!mayExit) { event.preventDefault(); requestClose(); } });
  win.once('ready-to-show', () => { win.show(); win.setFullScreen(true); });
  await win.loadURL(APP_ORIGIN + '/');
  if (!app.isPackaged && process.env.GARDEN_DESKTOP_SMOKE === '1') {
    try { const { runSmoke } = await import('./smoke.mjs'); await runSmoke({ win, databasePath, requestClose }); }
    catch (error) { console.error(error); app.exit(1); }
  }
}

if (hasLock) {
  app.on('second-instance', () => { if (win?.isMinimized()) win.restore(); win?.show(); win?.focus(); });
  app.on('before-quit', event => { if (!mayExit && win && !win.isDestroyed()) { event.preventDefault(); requestClose(); } });
  app.on('will-quit', () => { updater?.stop(); store?.close(); });
  process.on('SIGTERM', () => { if (win) requestClose(); else app.quit(); });
  app.on('activate', () => { win?.show(); win?.focus(); });
  app.whenReady().then(async () => {
    const dataDir = join(app.getPath('userData'), 'saves');
    await mkdir(dataDir, { recursive: true });
    databasePath = join(dataDir, 'garden.sqlite');
    // Development can migrate the existing project database once, without touching it.
    if (!app.isPackaged && !process.env.GARDEN_DESKTOP_PROFILE) {
      try {
        await access(databasePath);
      } catch {
        const legacy = join(root, 'data/garden.sqlite');
        try { await access(legacy); const source = new DatabaseSync(legacy, { readOnly: true }); try { await backup(source, databasePath); } finally { source.close(); } }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
    }
    store = openStore(databasePath);
    protocol.handle('garden', createAppHandler({ clientPath: join(root, 'dist/client'), store }));
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    // All game resources are local. External navigation and network access are unnecessary.
    session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (_details, callback) => callback({ cancel: true }));
    ipcMain.handle('garden:fullscreen', event => { if (trusted(event)) win.setFullScreen(!win.isFullScreen()); });
    ipcMain.handle('garden:update-state', event => trusted(event) ? updater.state : null);
    ipcMain.handle('garden:check-update', event => trusted(event) ? updater.check() : null);
    ipcMain.on('garden:update-safe', (event, safe) => { if (trusted(event)) updater.setSafe(safe === true); });
    ipcMain.handle('garden:quit', event => { if (trusted(event)) requestClose(); });
    ipcMain.on('garden:close-ready', (event, result) => {
      if (!trusted(event) || !closeRequest || result?.token !== closeRequest.token) return;
      clearTimeout(closeRequest.timer);
      if (result.isSaved === true) finishExit(); else void closeFailed();
    });
    updater = new UpdateManager({ app, notify: state => { if (win && !win.isDestroyed()) win.webContents.send('garden:update-state', state); }, requestInstall: () => { installing = true; requestClose(); } });
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      ...(process.platform === 'darwin' ? [{ label: '花园王国', submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { label: '保存并退出', accelerator: 'Cmd+Q', click: requestClose }] }] : []),
      { label: '游戏', submenu: [{ label: '全屏 / 窗口', accelerator: process.platform === 'darwin' ? 'Ctrl+Cmd+F' : 'F11', click: () => win.setFullScreen(!win.isFullScreen()) }, { label: '保存并退出', accelerator: process.platform === 'darwin' ? undefined : 'Alt+F4', click: requestClose }] },
      { label: '成绩本', submenu: [{ label: '备份成绩本…', click: menuTask(backupScores) }, { label: '导入成绩本…', click: menuTask(importScores) }, { label: '打开存档文件夹', click: () => shell.openPath(dataDir) }] },
      { role: 'editMenu', label: '编辑' },
      { label: '更新', submenu: [{ label: '检查新版本', click: () => void updater.check() }] },
    ]));
    await createWindow();
    if (app.isPackaged) updater.start();
  }).catch(error => { console.error(error); dialog.showErrorBox('花园王国暂时无法打开', error.message); app.exit(1); });
}
