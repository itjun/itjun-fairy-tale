import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import electron from 'electron';
import assert from 'node:assert/strict';

const profile = await mkdtemp(join(tmpdir(), 'garden-menu-test-'));
console.log('隔离桌面菜单测试目录：', profile);
await new Promise((resolve, reject) => {
  const child = spawn(electron, ['.'], { stdio: 'inherit', env: { ...process.env, GARDEN_DESKTOP_PROFILE: profile, GARDEN_DESKTOP_MENU_SMOKE: '1' } });
  const timer = setTimeout(() => { child.kill(); reject(new Error('桌面菜单测试超时')); }, 45000);
  child.on('error', error => { clearTimeout(timer); reject(error); });
  child.on('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`桌面菜单测试失败：${code}`)); });
});
let result;
for (let i = 0; i < 250; i++) {
  try { result = JSON.parse(await readFile(join(profile, 'menu-result.json'), 'utf8')); break; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await new Promise(resolve => setTimeout(resolve, 100));
}
assert.equal(result?.restarted, true, '重启后的新进程必须确认存档恢复');
// 验证新进程通过“退出游戏”退出，防止测试留下一份运行中的游戏。
let isExited = false;
for (let i = 0; i < 100; i++) {
  try { process.kill(result.pid, 0); }
  catch (error) { if (error.code !== 'ESRCH') throw error; isExited = true; break; }
  await new Promise(resolve => setTimeout(resolve, 100));
}
assert.equal(isExited, true, '退出游戏应正常结束重启后的进程');
console.log('全屏切换、保存失败重试、防重复重启、新进程存档恢复和退出均通过。');
