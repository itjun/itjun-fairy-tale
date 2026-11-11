import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { openStore, InputError } from './store.mjs';
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.mp3': 'audio/mpeg' };
function json(response, status, data) { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(data)); }
async function readJson(request) {
  if (!request.headers['content-type']?.startsWith('application/json')) throw new InputError('请求需要使用 JSON');
  let body = '';
  for await (const chunk of request) { body += chunk; if (Buffer.byteLength(body) > 16384) throw new InputError('记录内容过大'); }
  try { return JSON.parse(body); } catch { throw new InputError('记录内容无法读取'); }
}
export function createGardenServer({ databasePath, clientPath, middleware }) {
  const store = openStore(databasePath), root = resolve(clientPath);
  const server = createServer(async (request, response) => {
    try {
      const host = request.headers.host || '';
      if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) { json(response, 403, { error: '仅支持本机访问' }); return; }
      const url = new URL(request.url, `http://${host}`);
      if (url.pathname.startsWith('/api/')) {
        if (request.headers.origin && request.headers.origin !== url.origin) { json(response, 403, { error: '请从花园王国页面访问' }); return; }
        if (request.method === 'GET' && url.pathname === '/api/health') { json(response, 200, { ok: true }); return; }
        if (request.method === 'PUT' && url.pathname === '/api/runs') { json(response, 200, { run: store.save(await readJson(request)) }); return; }
        if (request.method === 'GET' && url.pathname === '/api/scores') {
          const query = url.searchParams;
          json(response, 200, store.report({ from: query.get('from'), until: query.get('until'), levelId: query.get('level') || undefined, timezone: query.get('timezone') || 'Asia/Shanghai', offset: Number(query.get('offset') || 0) })); return;
        }
        json(response, 404, { error: '没有这个接口' }); return;
      }
      if (middleware) { middleware(request, response, () => { response.writeHead(404); response.end('Not found'); }); return; }
      if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
      let file = resolve(root, '.' + decodeURIComponent(url.pathname));
      if (!file.startsWith(root + sep) && file !== root) { response.writeHead(403); response.end(); return; }
      try { if (!(await stat(file)).isFile()) file = resolve(root, 'index.html'); }
      catch { if (extname(url.pathname)) { response.writeHead(404); response.end('Not found'); return; } file = resolve(root, 'index.html'); }
      const bytes = await readFile(file);
      response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
      response.end(request.method === 'HEAD' ? undefined : bytes);
    } catch (error) {
      if (response.headersSent) { response.end(); return; }
      if (!(error instanceof InputError)) console.error('本机服务请求失败', error);
      json(response, error.status || 500, { error: error.status ? error.message : '本机保存失败，请检查磁盘空间后重试' });
    }
  });
  server.on('close', () => store.close());
  return { server, store };
}
