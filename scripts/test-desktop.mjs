import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import electron from 'electron';
import assert from 'node:assert/strict';
const profile = await mkdtemp(join(tmpdir(), 'garden-desktop-test-'));
for (const phase of ['play', 'reopen']) {
  await new Promise((resolve, reject) => {
    const child = spawn(electron, ['.'], { stdio: 'inherit', env: { ...process.env, GARDEN_DESKTOP_PROFILE: profile, GARDEN_DESKTOP_SMOKE: '1', GARDEN_DESKTOP_PHASE: phase } });
    const timer = setTimeout(() => { child.kill(); reject(new Error('Desktop smoke test timed out')); }, 90000);
    child.on('error', reject);
    child.on('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`Desktop smoke failed: ${code}`)); });
  });
}
const result = JSON.parse(await readFile(join(profile, 'result.json'), 'utf8'));
assert.equal(result.isFullscreen, false);
assert.equal(result.reopened, true);
assert.ok(result.total > 0);
console.log('Desktop frameless window / game / close-save / restart persistence passed:', result);
console.log('Isolated screenshots and database:', profile);
