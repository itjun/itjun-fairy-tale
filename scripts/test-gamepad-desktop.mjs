import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import electron from 'electron';
const profile = await mkdtemp(join(tmpdir(), 'garden-gamepad-test-'));
console.log('隔离手柄测试目录：', profile);
await new Promise((resolve, reject) => {
  const child = spawn(electron, ['scripts/gamepad-desktop-smoke.mjs'], { stdio: 'inherit', env: { ...process.env, GARDEN_DESKTOP_PROFILE: profile } });
  const timer = setTimeout(() => { child.kill(); reject(new Error('手柄测试超时')); }, 180000);
  child.on('error', error => { clearTimeout(timer); reject(error); });
  child.on('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`手柄测试失败：${code}`)); });
});
