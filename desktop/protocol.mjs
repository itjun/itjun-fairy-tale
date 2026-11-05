import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

export const APP_ORIGIN = 'garden://app';
export function isAppUrl(value) {
  try { const url = new URL(value); return url.protocol === 'garden:' && url.host === 'app' && !url.username && !url.password; }
  catch { return false; }
}
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.json': 'application/json' };
const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-src 'none'";
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export function createAppHandler({ clientPath, store }) {
  const root = resolve(clientPath);
  return async request => {
    if (!isAppUrl(request.url)) return new Response('Forbidden', { status: 403 });
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith('/api/')) {
        if (request.method === 'PUT' && url.pathname === '/api/runs') {
          if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: '请求需要使用 JSON' }, 400);
          const body = await request.text();
          if (Buffer.byteLength(body) > 16384) return json({ error: '记录内容过大' }, 400);
          let run;
          try { run = JSON.parse(body); } catch { return json({ error: '记录内容无法读取' }, 400); }
          return json({ run: store.save(run) });
        }
        if (request.method === 'GET' && url.pathname === '/api/scores') {
          const q = url.searchParams;
          return json(store.report({ from: q.get('from'), until: q.get('until'), levelId: q.get('level') || undefined, timezone: q.get('timezone') || 'Asia/Shanghai', offset: Number(q.get('offset') || 0) }));
        }
        return json({ error: '没有这个接口' }, 404);
      }
      if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405 });
      const path = decodeURIComponent(url.pathname);
      if (path.includes('\\') || path.includes('\0')) return new Response(null, { status: 403 });
      const file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
      if (!file.startsWith(root + sep)) return new Response(null, { status: 403 });
      const bytes = await readFile(file);
      return new Response(request.method === 'HEAD' ? null : bytes, { headers: { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Content-Security-Policy': csp, 'X-Content-Type-Options': 'nosniff' } });
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'EISDIR') return new Response('Not found', { status: 404 });
      if (!error.status) console.error('桌面数据读取失败', error);
      return json({ error: error.status ? error.message : '本机保存失败，请检查磁盘空间后重试' }, error.status || 500);
    }
  };
}
