import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createGardenServer } from './app.mjs';
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const port = portIndex >= 0 ? Number(args[portIndex + 1]) : 4173;
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('端口不正确');
let vite;
if (args.includes('--dev')) {
  const { createServer } = await import('vite');
  vite = await createServer({ root: project, server: { middlewareMode: true }, appType: 'spa' });
}
const databasePath = process.env.GARDEN_DB_PATH || resolve(project, 'data/garden.sqlite');
const { server } = createGardenServer({ databasePath, clientPath: resolve(project, 'dist/client'), middleware: vite?.middlewares });
server.on('error', error => { console.error(`无法启动：${error.message}`); process.exitCode = 1; vite?.close(); });
server.listen(port, '127.0.0.1', () => {
  console.log(`花园王国已打开：http://127.0.0.1:${port}\n成绩保存在 ${databasePath}，结束时按 Ctrl+C。`);
  if (args.includes('--open') && process.platform === 'win32') {
    const browser = spawn('cmd.exe', ['/d', '/c', 'start', '', `http://127.0.0.1:${port}`], { windowsHide: true });
    browser.on('error', () => console.log('请在浏览器中打开上方地址。'));
  }
});
let isClosing = false;
async function shutdown() { if (isClosing) return; isClosing = true; await vite?.close(); server.close(); server.closeIdleConnections(); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
