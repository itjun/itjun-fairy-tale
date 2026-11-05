import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAppHandler, isAppUrl } from '../desktop/protocol.mjs';
import { openStore } from '../server/store.mjs';
const run = { id: '22222222-2222-4222-8222-222222222222', levelId: 'rainbow', startedAt: '2026-01-01T00:00:00.000Z', players: 1, seed: 1, flowers: 1, platform: 1, seconds: 10, revision: 1, status: 'ended', scoringVersion: 2, collectedIds: [1] };

test('桌面协议在固定来源提供素材和真实 SQLite 成绩，拒绝越界路径及无效记录', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'garden-protocol-'));
  const store = openStore(join(dir, 'scores.sqlite'));
  try {
    await writeFile(join(dir, 'index.html'), '<html>花园王国</html>');
    const handler = createAppHandler({ clientPath: dir, store });
    const page = await handler(new Request('garden://app/'));
    assert.equal(page.status, 200); assert.match(page.headers.get('Content-Security-Policy'), /default-src 'self'/);
    assert.match(await page.text(), /花园王国/);
    for (const url of ['garden://evil/', 'garden://app/%2e%2e%2foutside', 'garden://app/a%5cb']) assert.equal((await handler(new Request(url))).status, 403);
    assert.equal(isAppUrl('garden://user@app/'), false);
    assert.equal(isAppUrl('https://app/'), false);
    const save = body => handler(new Request('garden://app/api/runs', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
    assert.equal((await save({ ...run, flowers: 2 })).status, 400);
    const response = await save(run);
    assert.equal(response.status, 200);
    const { run: saved } = await response.json();
    assert.ok(saved.score > 0);
    await save(run);
    const report = await (await handler(new Request('garden://app/api/scores?from=2026-01-01&until=2027-01-01'))).json();
    assert.equal(report.summary.sessions, 1); assert.equal(report.summary.total, saved.score);
    assert.equal((await handler(new Request('garden://app/missing.png'))).status, 404);
  } finally { store.close(); await rm(dir, { recursive: true, force: true }); }
});

test('导入成绩重复不计分，冲突整批回滚，旧积分保留', () => {
  const store = openStore(':memory:');
  try {
    store.save(run);
    const second = { ...run, id: '33333333-3333-4333-8333-333333333333' };
    assert.throws(() => store.importRuns([second, { ...run, seed: 9 }]));
    const report = () => store.report({ from: '2026-01-01', until: '2027-01-01' });
    assert.equal(report().summary.sessions, 1);
    store.importRuns([run, run, { ...second, scoringVersion: 1, collectedIds: [] }]);
    assert.equal(report().summary.sessions, 2);
    assert.equal(report().records.find(row => row.id === second.id).score, 10);
  } finally { store.close(); }
});
