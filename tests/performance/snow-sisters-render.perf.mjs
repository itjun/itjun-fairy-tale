import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createGardenServer } from '../../server/app.mjs';
import { newSnowGame } from '../../src/snow-sisters/engine.js';

// 高清渲染的帧时间守护：用真实 Chrome 的硬件 GPU 在 4K 画布上打 Boss 战，量 requestAnimationFrame 间隔。
// 没有 Chrome、没有构建产物或只有软件渲染时跳过，不拿慢机器的数字误报。
const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].find(existsSync);
const CLIENT = resolve('dist/client');

test('2880×2160 画布（1080p 窗口 2 倍像素比）打 Boss 战，帧时间中位数与最差 5% 都在预算内', { timeout: 120000 }, async (t) => {
  if (!CHROME) return t.skip('没有找到 Chrome');
  if (!existsSync(join(CLIENT, 'index.html'))) return t.skip('还没有 npm run build');

  const dir = mkdtempSync(join(tmpdir(), 'snow-render-'));
  const { server } = createGardenServer({ databasePath: join(dir, 'db.sqlite'), clientPath: CLIENT });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const debugPort = 9400 + Math.floor(Math.random() * 400);
  const chrome = spawn(
    CHROME,
    ['--headless=new', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${join(dir, 'profile')}`, '--no-first-run', '--enable-gpu', '--ignore-gpu-blocklist', 'about:blank'],
    { stdio: 'ignore' },
  );
  let ws;
  try {
    let targets;
    for (let i = 0; i < 60 && !targets; i++) {
      try {
        targets = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
      } catch {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    assert.ok(targets, 'Chrome 未能启动');
    ws = new WebSocket(targets.find((x) => x.type === 'page').webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r));
    let seq = 0;
    const waiting = new Map();
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && waiting.has(m.id)) {
        waiting.get(m.id)(m);
        waiting.delete(m.id);
      }
    });
    const send = (method, params = {}) =>
      new Promise((resolveCall, reject) => {
        const id = ++seq;
        waiting.set(id, (m) => (m.error ? reject(new Error(JSON.stringify(m.error))) : resolveCall(m.result)));
        ws.send(JSON.stringify({ id, method, params }));
      });
    const run = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails));
      return r.result.value;
    };

    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 2, mobile: false });
    await send('Page.navigate', { url: origin });
    await new Promise((r) => setTimeout(r, 2000));

    const gpu = await run(`(()=>{const g=document.createElement('canvas').getContext('webgl2');if(!g)return 'none';const e=g.getExtension('WEBGL_debug_renderer_info');return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):'unknown'})()`);
    if (/none|swiftshader|llvmpipe|software/i.test(String(gpu))) return t.skip(`没有硬件 GPU（${gpu}），不测帧时间`);

    const game = newSnowGame({ players: 2, startFloor: 30, skipIntro: true, hiScore: 0 });
    for (const p of game.players) p.invuln = 99999;
    await run(`localStorage.setItem('garden-snow-sisters-v1', ${JSON.stringify(JSON.stringify(game))}); 1`);
    await send('Page.navigate', { url: origin });
    await new Promise((r) => setTimeout(r, 2000));

    const result = JSON.parse(
      await run(`(async()=>{
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const click = async (text) => {
          const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes(text));
          if (!b) throw new Error('找不到按钮 ' + text);
          b.click();
          await wait(600);
        };
        await click('怀旧游戏'); await click('小雪人姐妹'); await click('继续');
        const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code, bubbles: true }));
        key('KeyD', true); key('KeyJ', true);
        await wait(2500);
        const gaps = [];
        let last = performance.now();
        const end = last + 6000;
        await new Promise((done) => {
          const tick = (now) => { gaps.push(now - last); last = now; if (now > end) done(); else requestAnimationFrame(tick); };
          requestAnimationFrame(tick);
        });
        gaps.shift();
        gaps.sort((a, b) => a - b);
        const canvas = document.querySelector('canvas');
        return JSON.stringify({ n: gaps.length, p50: gaps[Math.floor(gaps.length * 0.5)], p95: gaps[Math.floor(gaps.length * 0.95)], worst: gaps[gaps.length - 1], width: canvas.width, height: canvas.height });
      })()`),
    );
    console.log(`  高清帧时间：p50 ${result.p50.toFixed(1)}ms，p95 ${result.p95.toFixed(1)}ms，最差 ${result.worst.toFixed(1)}ms（${result.n} 帧，画布 ${result.width}×${result.height}）`);
    assert.ok(result.width >= 2800, `画布应跟随 2 倍像素比，实际 ${result.width}`);
    assert.ok(result.n > 200, `6 秒应有足够多的帧，实际 ${result.n}`);
    assert.ok(result.p50 <= 20, `中位帧时间 ${result.p50}ms 超过 20ms`);
    assert.ok(result.p95 <= 40, `95% 帧时间 ${result.p95}ms 超过 40ms`);
  } finally {
    try {
      ws?.close();
    } catch {
      /* 已关闭 */
    }
    const exited = new Promise((done) => chrome.once('exit', done));
    chrome.kill();
    await Promise.race([exited, new Promise((done) => setTimeout(done, 3000))]);
    server.close();
    server.closeIdleConnections?.();
    rmSync(dir, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
  }
});
