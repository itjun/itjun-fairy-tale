import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createGardenServer } from '../../server/app.mjs';
import { roomFixture } from './adventure-fixtures.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const vite = await createServer({root,server:{middlewareMode:true,ws:{port:4276}},appType:'spa'});
const middleware = async (request,response,next) => {
  const url = new URL(request.url,'http://127.0.0.1:4275');
  const mode = url.searchParams.get('fixture');
  // 例：/?fixture=room&stage=snow-world&seed=42&room=3 直接站到那间房的起点。
  if (url.pathname === '/' && mode) {
    try {
      const { run, state } = roomFixture(mode, url.searchParams.get('stage') || undefined, { seed: Number(url.searchParams.get('seed') || 42), roomId: Number(url.searchParams.get('room') || 0) });
      const fixture = { run, state };
      let html = await readFile(root+'index.html','utf8');
      const key = JSON.stringify(`qa-loaded:${url.search}`);
      html = html.replace('<head>',`<head><script>if(!sessionStorage.getItem(${key})){localStorage.setItem('garden-active-adventure-v1',${JSON.stringify(JSON.stringify(fixture))});sessionStorage.setItem(${key},'1');}</script>`);
      response.writeHead(200,{'Content-Type':'text/html'});response.end(await vite.transformIndexHtml(request.url,html));
    } catch (error) { console.error(error);response.writeHead(500);response.end('QA fixture failed'); }
    return;
  }
  vite.middlewares(request,response,next);
};
const {server} = createGardenServer({databasePath:'/tmp/garden-expansion-qa/fixtures.sqlite',clientPath:root+'dist/client',middleware});
server.listen(4275,'127.0.0.1',()=>console.log('隔离验收 http://127.0.0.1:4275/?fixture=reward'));
process.on('SIGTERM',()=>{vite.close();server.close();});
