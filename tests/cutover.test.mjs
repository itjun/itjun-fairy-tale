import test from 'node:test';
import assert from 'node:assert/strict';
import { roomFixture } from './helpers/adventure-fixtures.mjs';
import { readAdventure, writeAdventure } from '../src/game/save.js';
import { openStore } from '../server/store.mjs';
import { ADVENTURE_GENERATION_VERSION } from '../shared/adventure-catalog.js';

const KEY = 'garden-active-adventure-v1';
const BACKUPS = ['single-player', 'life-only', 'boss-growth', 'easier-combat', 'hp-lives'].map(name => `${KEY}-before-${name}`);
function storage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
const range = { from: '2026-01-01', until: '2027-01-01' };
// 第 9 版留下来的一条成绩：小关编号、地图版本都是旧的，分数没法再算。
const retired = { id: '44444444-4444-4444-8444-444444444444', levelId: 'rainbow-1', startedAt: '2026-11-13T08:00:00.000Z', players: 1, seed: 7, scoringVersion: 3, generationVersion: 9,
  flowers: 3, collectedIds: [2, 5, 9], defeatedIds: [1, 4], platform: 3, seconds: 240, revision: 6, status: 'completed', score: 465 };

test('续关只认第 11 版：别的版本的存档和旧备份都删掉，第 11 版的留着', () => {
  assert.equal(ADVENTURE_GENERATION_VERSION, 11);
  const { run, state } = roomFixture();
  for (const version of [1, 7, 8, 9, 10, 12]) {
    const old = storage({ [KEY]: JSON.stringify({ run: { ...run, generationVersion: version }, state: { ...state, version } }), 'garden-album-v1': '画册', ...Object.fromEntries(BACKUPS.map(key => [key, '{"run":{}}'])) });
    assert.equal(readAdventure(old), null, `第 ${version} 版不能续关`);
    assert.deepEqual([...old.values.keys()], ['garden-album-v1'], '只删冒险存档和它的备份，别的不动');
  }
  // 版本号只改了一半的也不认。
  const half = storage({ [KEY]: JSON.stringify({ run, state: { ...state, version: 9 } }) });
  assert.equal(readAdventure(half), null); assert.equal(half.values.size, 0);
  const broken = storage({ [KEY]: '{坏的' });
  assert.equal(readAdventure(broken), null); assert.equal(broken.values.size, 0);
  const current = storage({ [BACKUPS[0]]: '{}' });
  writeAdventure(run, state, current);
  const saved = readAdventure(current);
  assert.equal(saved.state.version, 11); assert.equal(saved.run.id, run.id);
  assert.deepEqual([...current.values.keys()], [KEY], '第 11 版的存档留着，旧备份清掉');
  assert.equal(readAdventure(storage()), null);
});

test('成绩服务不再收旧版地图的新成绩，也不收旧的小关编号', () => {
  const store = openStore(':memory:');
  try {
    const { run } = roomFixture();
    for (const version of [1, 8, 9, 10]) assert.throws(() => store.save({ ...run, generationVersion: version }), /这一版地图已经停用/);
    assert.throws(() => store.save(retired), /这一版地图已经停用/);
    assert.throws(() => store.save({ ...run, levelId: 'rainbow-1' }), /新地图只有八个世界关/);
    assert.throws(() => store.save({ ...run, levelId: 'rainbow' }), /新地图只有八个世界关/);
    assert.equal(store.report(range).summary.sessions, 0);
    assert.equal(store.save(run).generationVersion, 11);
    assert.equal(store.report(range).summary.sessions, 1);
  } finally { store.close(); }
});

test('导入备份时旧版地图的成绩照原样留着，已经有的不改', () => {
  const store = openStore(':memory:');
  try {
    store.importRuns([retired]);
    const row = () => store.report(range).records.find(record => record.id === retired.id);
    assert.equal(row().score, 465); assert.equal(row().levelId, 'rainbow-1'); assert.equal(row().status, 'completed');
    // 同一条再导一次、或者带着别的分数再来，都不动原来那一行。
    store.importRuns([retired, { ...retired, score: 99999, revision: 7, seconds: 999, status: 'ended' }]);
    assert.equal(store.report(range).summary.sessions, 1);
    assert.equal(row().score, 465); assert.equal(row().seconds, 240); assert.equal(row().status, 'completed');
    // 格式不对的旧记录整批不收。
    const other = { ...retired, id: '55555555-5555-4555-8555-555555555555' };
    assert.throws(() => store.importRuns([other, { ...other, id: '66666666-6666-4666-8666-666666666666', collectedIds: [2, 2, 9] }]), /宝物明细/);
    assert.throws(() => store.importRuns([{ ...other, score: -1 }]), /积分/);
    assert.throws(() => store.importRuns([{ ...other, generationVersion: 0 }]), /地图版本/);
    assert.equal(store.report(range).summary.sessions, 1);
    // 导入完，平时的保存口子还是不收旧版。
    assert.throws(() => store.save({ ...retired, revision: 8 }), /这一版地图已经停用/);
  } finally { store.close(); }
});

test('没发出去的旧版成绩从待保存队列里丢掉，不挡后面的新成绩', async () => {
  const queueKey = 'garden-scores-pending-v2', sent = [];
  const { run } = roomFixture();
  const stale = { ...retired, revision: 9 }, legacy = { id: 'old-rule', revision: 1, scoringVersion: 2 };
  const local = storage({ [queueKey]: JSON.stringify({ [stale.id]: stale, [legacy.id]: legacy }) });
  const originalFetch = globalThis.fetch, originalStorage = globalThis.localStorage;
  globalThis.localStorage = local;
  globalThis.fetch = async (_url, options) => { const body = JSON.parse(options.body); sent.push(body); return { ok: true, json: async () => ({ run: body }) }; };
  try {
    const client = await import('../src/scores/client.js?cutover');
    assert.equal(client.pendingCount(), 1, '旧版地图的那条不算待保存');
    client.queueRun(stale);
    assert.equal(client.pendingCount(), 1, '再排进来也不收');
    client.queueRun(run);
    assert.equal((await client.flushScores()).isSaved, true);
    assert.deepEqual(sent.map(item => item.id).sort(), [legacy.id, run.id].sort());
    assert.equal(client.pendingCount(), 0);
    assert.equal(local.values.get(queueKey), '{}');
  } finally { globalThis.fetch = originalFetch; globalThis.localStorage = originalStorage; }
});
