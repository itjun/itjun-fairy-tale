import test from 'node:test';
import assert from 'node:assert/strict';
import { readGardenBackup, mergeGardenProgress } from '../src/garden-backup.js';
test('花园进度迁移保留已有成就，重复导入不重复贴纸，拒绝无效文件', () => {
  const current = { rainbow: 6, flowers: [2, 0, 0, 0], served: [true, false, false, false], stamps: [{ type: 'heart', x: 20, y: 30 }] };
  const incoming = { rainbow: 1, flowers: [0, 2, 2, 2], served: [false, true, true, true], stamps: [{ type: 'heart', x: 20, y: 30 }] };
  const decoded = readGardenBackup(JSON.stringify({ type: 'garden-progress', version: 1, progress: incoming }));
  const merged = mergeGardenProgress(current, decoded);
  assert.equal(merged.rainbow, 6); assert.deepEqual(merged.flowers, [2, 2, 2, 2]); assert.equal(merged.stamps.length, 1); assert.ok(merged.served.every(Boolean));
  assert.throws(() => readGardenBackup('{}'));
  assert.throws(() => readGardenBackup(JSON.stringify({ type: 'garden-progress', version: 1, progress: { ...incoming, stamps: [{ type: 'script', x: 0, y: 0 }] } })));
});
