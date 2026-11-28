import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openStore } from '../server/store.mjs';
import {
  FLIGHT_PLAYTIME_KEY, bankSession, flightPlaytime, formatPlaytime, frameSeconds, readLedger, recordSession, snowPlaytime,
} from '../src/playtime.js';

function memoryStorage() {
  const map = new Map();
  return { getItem: key => map.has(key) ? map.get(key) : null, setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key) };
}

test('时长文案：不满一小时写分秒，满一小时写小时', () => {
  assert.equal(formatPlaytime(0), '0分0秒');
  assert.equal(formatPlaytime(723), '12分3秒');
  assert.equal(formatPlaytime(3723), '1小时2分3秒');
  assert.equal(formatPlaytime(undefined), '0分0秒');
  assert.equal(frameSeconds(60 * 61 + 59), 61);
});

test('重复保存本局只改写本局秒数，不会加倍', () => {
  const storage = memoryStorage();
  recordSession(FLIGHT_PLAYTIME_KEY, 30, storage);
  recordSession(FLIGHT_PLAYTIME_KEY, 30, storage);
  recordSession(FLIGHT_PLAYTIME_KEY, 45, storage);
  assert.deepEqual(readLedger(FLIGHT_PLAYTIME_KEY, storage), { bankedSeconds: 0, sessionSeconds: 45 });
  assert.equal(flightPlaytime(storage), 45);
});

test('新开一局把上一局并入累计，再从零计本局', () => {
  const storage = memoryStorage();
  recordSession(FLIGHT_PLAYTIME_KEY, 100, storage);
  bankSession(FLIGHT_PLAYTIME_KEY, 100, storage);
  assert.deepEqual(readLedger(FLIGHT_PLAYTIME_KEY, storage), { bankedSeconds: 100, sessionSeconds: 0 });
  recordSession(FLIGHT_PLAYTIME_KEY, 20, storage);
  bankSession(FLIGHT_PLAYTIME_KEY, 25, storage);
  assert.equal(flightPlaytime(storage), 125);
});

test('没有账本时，用当前存档的帧数补出本局', () => {
  const storage = memoryStorage();
  storage.setItem('garden-gun-nac-flight-v1', JSON.stringify({ frame: 60 * 90 }));
  storage.setItem('garden-snow-sisters-v1', JSON.stringify({ frame: 60 * 30 + 5 }));
  assert.equal(flightPlaytime(storage), 90);
  assert.equal(snowPlaytime(storage), 30);
  bankSession(FLIGHT_PLAYTIME_KEY, 90, storage);
  assert.equal(flightPlaytime(storage), 90);
});

test('存档损坏时累计按零显示', () => {
  const storage = memoryStorage();
  storage.setItem('garden-gun-nac-playtime-v1', '{坏掉');
  storage.setItem('garden-snow-sisters-v1', '坏的');
  assert.equal(flightPlaytime(storage), 0);
  assert.equal(snowPlaytime(storage), 0);
});

test('成绩接口的冒险累计时长不受日期和关卡筛选影响', () => {
  const store = openStore(':memory:');
  try {
    const base = { levelId: 'rainbow', players: 1, seed: 1, flowers: 0, platform: 0, revision: 1, status: 'ended' };
    store.save({ ...base, id: randomUUID(), startedAt: '2026-01-01T03:00:00.000Z', seconds: 30 });
    store.save({ ...base, id: randomUUID(), startedAt: '2026-02-01T03:00:00.000Z', seconds: 70 });
    const narrow = store.report({ from: '2025-12-31T16:00:00Z', until: '2026-01-03T16:00:00Z', timezone: 'Asia/Shanghai' });
    assert.equal(narrow.summary.seconds, 30);
    assert.equal(narrow.lifetimeSeconds, 100);
    const empty = store.report({ from: '2024-01-01T00:00:00Z', until: '2024-01-02T00:00:00Z' });
    assert.equal(empty.summary.seconds, 0);
    assert.equal(empty.lifetimeSeconds, 100);
  } finally { store.close(); }
});
