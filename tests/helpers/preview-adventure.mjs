import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createGardenServer } from '../../server/app.mjs';
import { adventureFixture, expansionFixture } from './adventure-fixtures.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const vite = await createServer({root,server:{middlewareMode:true,ws:{port:4276}},appType:'spa'});
const middleware = async (request,response,next) => {
  const url = new URL(request.url,'http://127.0.0.1:4275');
  const mode = url.searchParams.get('fixture');
  if (url.pathname === '/' && ['reward','workbench','duo','completed','fallen','over','expanded-reward','expanded-camp','expanded-play'].includes(mode)) {
    try {
      const fixture = mode.startsWith('expanded-') ? expansionFixture(mode) : adventureFixture(mode);
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
