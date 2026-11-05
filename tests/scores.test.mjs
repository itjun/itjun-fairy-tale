import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { openStore } from '../server/store.mjs';
import { createGardenServer } from '../server/app.mjs';
import { LEVELS } from '../shared/levels.js';
const fixture = (overrides = {}) => ({ id: randomUUID(), levelId: 'rainbow', startedAt: '2026-01-01T03:00:00.000Z', players: 1, seed: 123, flowers: 2, platform: 2, seconds: 30, revision: 1, status: 'playing', ...overrides });
const range = { from: '2025-12-31T16:00:00Z', until: '2026-01-03T16:00:00Z', timezone: 'Asia/Shanghai' };

test('新增世界与旧关卡成绩共存，重启后仍可按主题筛选和汇总', () => {
  const dir = mkdtempSync(join(tmpdir(), 'garden-worlds-'));
  let store = openStore(join(dir, 'test.sqlite'));
  try {
    store.save(fixture({ status: 'ended' }));
    const worlds = LEVELS.slice(3);
    for (const level of worlds) {
      store.save(fixture({ levelId: level.id, flowers: level.requiredFlowers, platform: level.platforms, status: 'completed' }));
    }
    store.close(); store = openStore(join(dir, 'test.sqlite'));
    assert.equal(store.report({ ...range, levelId: 'rainbow' }).summary.total, 20);
    for (const level of worlds) {
      const report = store.report({ ...range, levelId: level.id });
      assert.equal(report.summary.sessions, 1);
      assert.equal(report.summary.completed, 1);
      assert.equal(report.summary.total, level.requiredFlowers * 10 + level.bonus);
      assert.equal(report.points[0].levelId, level.id);
    }
    const all = store.report(range);
    assert.equal(all.summary.sessions, 6);
    assert.equal(all.summary.total, 20 + worlds.reduce((sum, level) => sum + level.requiredFlowers * 10 + level.bonus, 0));
  } finally { store.close(); rmSync(dir, { recursive: true }); }
});

test('SQLite 重启后保留成绩；同一局重复、乱序保存不加次数也不倒退', () => {
  const dir = mkdtempSync(join(tmpdir(), 'garden-score-'));
  let store = openStore(join(dir, 'test.sqlite'));
  try {
    const record = fixture();
    store.save(record); store.save(record);
    store.save({ ...record, revision: 3, flowers: 5, seconds: 60 });
    store.save({ ...record, revision: 2, flowers: 1, seconds: 40 });
    store.save({ ...record, revision: 4, flowers: 4, seconds: 55, status: 'ended' });
    store.save({ ...record, revision: 5, flowers: 8, seconds: 90 });
    store.close(); store = openStore(join(dir, 'test.sqlite'));
    const report = store.report(range);
    assert.equal(report.summary.sessions, 1); assert.equal(report.summary.total, 50);
    assert.equal(report.records[0].status, 'ended'); assert.equal(report.records[0].seconds, 60);
  } finally { store.close(); rmSync(dir, { recursive: true }); }
});
test('服务端计算积分，只在完成目标时发放一次通关奖励', () => {
  const store = openStore(':memory:');
  try {
    assert.throws(() => store.save(fixture({ status: 'completed', flowers: 3, platform: 8 })), /目标/);
    const run = fixture({ status: 'completed', flowers: 4, platform: 8, score: 999999 });
    assert.equal(store.save(run).score, 90);
    assert.equal(store.save({ ...run, revision: 2, score: 999999 }).score, 90);
    assert.equal(store.report(range).summary.completed, 1);
    assert.throws(() => store.save(fixture({ flowers: 99 })), /小花/);
    assert.throws(() => store.save(fixture({ levelId: "' OR 1=1 --" })), /关卡/);
    assert.throws(() => store.save({ ...run, levelId: 'family', flowers: 6, platform: 10 }), /不能改变/);
  } finally { store.close(); }
});
test('日期半开区间、关卡筛选、时间排序、逐日平均和汇总一致', () => {
  const store = openStore(':memory:');
  try {
    store.save(fixture({ startedAt: '2026-01-01T15:59:59.000Z', flowers: 2, status: 'ended' }));
    store.save(fixture({ startedAt: '2026-01-01T16:00:00.000Z', flowers: 4, status: 'ended' }));
    store.save(fixture({ startedAt: '2026-01-02T01:00:00.000Z', flowers: 6, status: 'ended' }));
    store.save(fixture({ startedAt: '2026-01-02T02:00:00.000Z', levelId: 'sweet', flowers: 8, platform: 12, status: 'completed' }));
    store.save(fixture({ startedAt: '2026-01-02T16:00:00.000Z', flowers: 8, status: 'ended' }));
    const report = store.report({ ...range, from: '2026-01-01T16:00:00Z', until: '2026-01-02T16:00:00Z' });
    assert.equal(report.summary.sessions, 3); assert.equal(report.summary.total, 280);
    assert.equal(report.summary.best, 180); assert.equal(report.summary.average, 93.3);
    assert.equal(report.days.find(day => day.levelId === 'rainbow').average, 50);
    assert.equal(report.days[0].date, '2026-01-02');
    assert.deepEqual(report.points.map(point => point.score), [40, 60, 180]);
    assert.equal(store.report({ ...range, levelId: 'sweet' }).summary.total, 180);
    assert.equal(store.report({ ...range, from:'2024-01-01',until:'2024-01-02' }).summary.sessions, 0);
    assert.throws(() => store.report({ ...range, from:'invalid' }), /日期/);
  } finally { store.close(); }
});
test('分页不影响汇总，空记录不伪造曲线', () => {
  const store = openStore(':memory:');
  try {
    assert.deepEqual(store.report(range).points, []);
    for (let i=0;i<25;i++) store.save(fixture({ status:'ended' }));
    const first = store.report(range), second = store.report({ ...range, offset:20 });
    assert.equal(first.records.length,20); assert.equal(second.records.length,5);
    assert.equal(second.summary.total,500);
    assert.ok(!first.records.some(record => second.records.some(other=>other.id===record.id)));
  } finally { store.close(); }
});
test('本机 HTTP 实际写入、读取、错误响应和跨来源保护', async () => {
  const { server } = createGardenServer({ databasePath: ':memory:', clientPath:'dist/client' });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    const run = fixture({ status:'ended' });
    const response = await fetch(url+'/api/runs',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(run)});
    assert.equal(response.status,200); assert.equal((await response.json()).run.score,20);
    const query = new URLSearchParams(range);
    assert.equal((await (await fetch(url+'/api/scores?'+query)).json()).summary.sessions,1);
    assert.equal((await fetch(url+'/api/runs',{method:'PUT',headers:{'Content-Type':'application/json',Origin:'https://example.org'},body:JSON.stringify(run)})).status,403);
    assert.equal((await fetch(url+'/api/runs',{method:'PUT',headers:{'Content-Type':'application/json'},body:'{bad'})).status,400);
    assert.equal((await fetch(url+'/api/scores?from=x&until=y')).status,400);
    assert.equal((await fetch(url+'/data/garden.sqlite')).status,404);
    assert.match(await (await fetch(url+'/')).text(), /花园王国/);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
