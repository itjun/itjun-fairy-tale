import test from 'node:test';
import assert from 'node:assert/strict';
import { completedQuests, earnedQuests, replayQuest } from '../src/garden-progress.js';
import { readGardenBackup, mergeGardenProgress } from '../src/garden-backup.js';

const finished = { rainbow: 6, flowers: [2, 2, 2, 2], served: [true, true, true, true], stamps: [{ type: 'heart', x: 20, y: 30 }] };
const allEarned = { rainbow: true, garden: true, treat: true };

for (const [id, field, initial] of [['rainbow', 'rainbow', 0], ['garden', 'flowers', [0, 0, 0, 0]], ['treat', 'served', [false, false, false, false]]]) {
  test(`${id} 完成后可反复重玩，只重置本局并保留旧存档成就和贴纸`, () => {
    const original = structuredClone(finished);
    const replay = replayQuest(original, id);
    assert.deepEqual(replay[field], initial);
    assert.equal(completedQuests(replay)[id], false);
    assert.deepEqual(earnedQuests(replay), allEarned);
    for (const other of ['rainbow', 'flowers', 'served', 'stamps'].filter(key => key !== field)) assert.deepEqual(replay[other], original[other]);
    assert.deepEqual(original, finished);
    const completedAgain = { ...replay, [field]: original[field] };
    assert.deepEqual(replayQuest(completedAgain, id), replay);
    const restored = JSON.parse(JSON.stringify(replay));
    assert.deepEqual(earnedQuests(restored), allEarned);
    assert.deepEqual(replayQuest(restored, id), restored);
  });
}

test('未完成的小游戏再次进入保留当前进度', () => {
  const partial = { rainbow: 2, flowers: [2, 1, 0, 0], served: [true, false, false, false], stamps: [] };
  for (const id of ['rainbow', 'garden', 'treat']) assert.equal(replayQuest(partial, id), partial);
  assert.deepEqual(earnedQuests(partial), { rainbow: false, garden: false, treat: false });
});

test('重玩中的备份导出、读取及合并保留成就，兼容旧版备份', () => {
  let replay = finished;
  for (const id of ['rainbow', 'garden', 'treat']) replay = replayQuest(replay, id);
  const decoded = readGardenBackup(JSON.stringify({ type: 'garden-progress', version: 1, progress: replay }));
  assert.deepEqual(decoded, replay);
  const empty = { rainbow: 0, flowers: [0, 0, 0, 0], served: [false, false, false, false], stamps: [] };
  assert.deepEqual(earnedQuests(mergeGardenProgress(empty, decoded)), allEarned);
  assert.deepEqual(earnedQuests(mergeGardenProgress(decoded, empty)), allEarned);
  const legacy = readGardenBackup(JSON.stringify({ type: 'garden-progress', version: 1, progress: finished }));
  assert.deepEqual(earnedQuests(legacy), allEarned);
});
