import { createHash } from 'node:crypto';
import { mkdir, open, rename, rm, writeFile, access } from 'node:fs/promises';
import { createReadStream, constants } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { RELEASES, LATEST_RELEASE, REPOSITORY, releaseTag, releaseAssetUrl, selectUpdate, selectManifestUpdate } from './update-policy.mjs';
import { validateMacArchive } from './zip-directory.mjs';
const exec = promisify(execFile);

// Node fetch is intentionally separate from the renderer's blocked network session.
export async function fetchRelease(url, { method = 'GET' } = {}) {
  let target = url;
  const timeout = /\.(zip|exe)$/.test(new URL(url).pathname) ? 15 * 60 * 1000 : 30000;
  for (let i = 0; i < 6; i++) {
    const u = new URL(target);
    if (u.protocol !== 'https:' || !['api.github.com', 'github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'].includes(u.hostname) || u.username || u.password) throw new Error('更新下载地址不可信');
    const response = await fetch(target, { method, redirect: 'manual', signal: AbortSignal.timeout(timeout), headers: { 'User-Agent': 'GardenKingdom-Updater', Accept: u.hostname === 'api.github.com' ? 'application/vnd.github+json' : '*/*' } });
    if ([301,302,303,307,308].includes(response.status)) { target = new URL(response.headers.get('location'), target).href; await response.body?.cancel(); continue; }
    if (!response.ok) {
      const error = new Error(`更新服务暂不可用 (${response.status})`);
      error.isRateLimited = u.hostname === 'api.github.com' && (response.status === 429 || response.status === 403 && (response.headers.get('x-ratelimit-remaining') === '0' || response.headers.has('retry-after')));
      await response.body?.cancel();
      throw error;
    }
    return response;
  }
  throw new Error('更新重定向过多');
}
export async function findUpdate(fetcher, current, platform, arch) {
  let release;
  try { release = await (await fetcher(RELEASES)).json(); }
  catch (error) {
    if (!error.isRateLimited) throw error;
    // GitHub 的正式发布入口不占 REST 匿名额度；固定到解析出的标签，避免两次请求跨版本。
    const response = await fetcher(LATEST_RELEASE, { method: 'HEAD' });
    await response.body?.cancel();
    const tag = releaseTag(response.url);
    const manifest = await (await fetcher(releaseAssetUrl(`https://github.com/${REPOSITORY}/releases/download/${tag}/garden-update.json`))).json();
    return selectManifestUpdate(manifest, tag, current, platform, arch);
  }
  const asset = release.assets?.find(item => item.name === 'garden-update.json');
  if (!asset) throw new Error('正式版本尚未提供更新清单');
  const manifest = await (await fetcher(releaseAssetUrl(asset.browser_download_url))).json();
  return selectUpdate(manifest, release, current, platform, arch);
}
export async function verifyFile(path, expected) {
  const hash = createHash('sha512'); let size = 0;
  for await (const chunk of createReadStream(path)) { hash.update(chunk); size += chunk.length; }
  if (size !== expected.size || hash.digest('hex') !== expected.sha512) throw new Error('更新包校验失败，原应用未修改');
}
export function macSwapScript() {
  return `#!/bin/sh
set -eu
pid="$1"; target="$2"; staged="$3"; old="$4"
count=0
while kill -0 "$pid" 2>/dev/null; do
  count=$((count + 1)); [ "$count" -lt 60 ] || exit 1
  sleep 1
done
[ -d "$staged" ] && [ ! -e "$old" ] || exit 1
mv "$target" "$old"
if ! mv "$staged" "$target"; then mv "$old" "$target"; exit 1; fi
if ! /usr/bin/open "$target"; then
  mv "$target" "$staged"; mv "$old" "$target"; /usr/bin/open "$target"; exit 1
fi
# Keep the previous bundle for recovery; next successful update removes it.
`;
}
export async function prepareInstaller({ app, file, cache }) {
  await verifyFile(file.path, file);
  if (process.platform === 'win32') {
    const script = join(cache, 'install-update.ps1');
    await writeFile(script, `param([int]$OldPid,[string]$Installer)\n$ErrorActionPreference='Stop'\nWait-Process -Id $OldPid -Timeout 60 -ErrorAction SilentlyContinue\nif (Get-Process -Id $OldPid -ErrorAction SilentlyContinue) { exit 1 }\n$p=Start-Process -FilePath $Installer -ArgumentList '/S','--updated','--force-run' -Wait -PassThru\nexit $p.ExitCode\n`);
    return () => launch('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-OldPid', String(process.pid), '-Installer', file.path], cache);
  }
  const target = resolve(app.getAppPath(), '../../..');
  if (!target.endsWith('.app') || target.startsWith('/Volumes/') || target.includes('/AppTranslocation/')) throw new Error('请先将花园王国移到“应用程序”文件夹，再自动更新');
  await access(dirname(target), constants.W_OK);
  const unpack = join(cache, 'unpacked');
  await rm(unpack, { recursive: true, force: true }); await mkdir(unpack, { recursive: true });
  await validateMacArchive(file.path);
  await exec('/usr/bin/ditto', ['-x', '-k', file.path, unpack]);
  const bundle = join(unpack, '花园王国.app');
  await exec('/usr/bin/codesign', ['--verify', '--deep', '--strict', bundle]);
  for (const [key, value] of [['CFBundleIdentifier', 'com.itjun.fairytale'], ['CFBundleShortVersionString', file.version]]) {
    const result = await exec('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, join(bundle, 'Contents/Info.plist')]);
    if (result.stdout.trim() !== value) throw new Error('更新应用标识或版本不匹配');
  }
  const binary = join(bundle, 'Contents/MacOS/花园王国');
  const architectures = await exec('/usr/bin/lipo', ['-archs', binary]);
  if (!architectures.stdout.split(/\s+/).includes(process.arch === 'arm64' ? 'arm64' : 'x86_64')) throw new Error('更新架构不匹配');
  const staged = target + '.update', old = target + '.previous';
  await rm(staged, { recursive: true, force: true });
  await exec('/usr/bin/ditto', [bundle, staged]);
  await exec('/usr/bin/codesign', ['--verify', '--deep', '--strict', staged]);
  await rm(old, { recursive: true, force: true });
  const script = join(cache, 'install-update.sh'); await writeFile(script, macSwapScript(), { mode: 0o700 });
  return () => launch('/bin/sh', [script, String(process.pid), target, staged, old], cache);
}
function launch(command, args, cache) {
  return new Promise((resolveLaunch, reject) => {
    const child = spawn(command, args, { detached: true, stdio: 'ignore', cwd: cache, windowsHide: true });
    child.once('error', reject); child.once('spawn', () => { child.unref(); resolveLaunch(); });
  });
}
export class UpdateManager {
  constructor({ app, notify, requestInstall, fetcher = fetchRelease, installer = prepareInstaller }) {
    Object.assign(this, { app, notify, requestInstall, fetcher, installer });
    this.state = { phase: 'idle', message: `版本 ${app.getVersion()}`, version: app.getVersion() };
    this.safe = false;
  }
  emit(phase, message, extra = {}) { this.state = { ...this.state, phase, message, ...extra }; this.notify(this.state); }
  setSafe(safe) { this.safe = safe; this.maybeInstall(); }
  maybeInstall() {
    clearTimeout(this.installTimer);
    if (this.safe && this.state.phase === 'ready') this.installTimer = setTimeout(() => {
      if (this.safe && this.state.phase === 'ready') { this.emit('installing', '正在保存成绩，更新后会自动回来…'); this.requestInstall(); }
    }, 5000);
  }
  async check() {
    if (this.busy || ['ready','installing'].includes(this.state.phase)) return this.state;
    if (!this.app.isPackaged) { this.emit('idle', '开发模式不自动更新'); return this.state; }
    this.busy = true;
    try {
      this.emit('checking', '正在检查新版本…');
      const update = await findUpdate(this.fetcher, this.app.getVersion(), process.platform, process.arch);
      if (!update) { this.emit('current', '已经是最新版本'); return this.state; }
      const cache = join(this.app.getPath('userData'), 'updates'); await mkdir(cache, { recursive: true, mode: 0o700 });
      const path = join(cache, update.name), part = path + '.partial';
      this.emit('downloading', `正在下载 ${update.version}，可以继续玩…`, { progress: 0 });
      const response = await this.fetcher(update.url), handle = await open(part, 'w', 0o600);
      let bytes = 0, lastPercent = -1;
      try {
        for await (const chunk of response.body) {
          bytes += chunk.length; if (bytes > update.size) throw new Error('更新包超出预期大小');
          await handle.writeFile(chunk);
          const progress = Math.floor(bytes * 100 / update.size);
          if (progress !== lastPercent) { lastPercent = progress; this.emit('downloading', `正在下载新版 ${progress}%`, { progress }); }
        }
      } finally { await handle.close(); }
      await verifyFile(part, update); await rename(part, path);
      this.install = await this.installer({ app: this.app, file: { ...update, path }, cache });
      this.emit('ready', '新版已准备好，休息时自动保存并更新'); this.maybeInstall();
    } catch (error) { this.emit('error', `更新未完成，可继续玩：${error.message}`); }
    finally { this.busy = false; }
    return this.state;
  }
  async apply() { if (!this.install) throw new Error('更新尚未准备好'); await this.install(); }
  cancelInstall() { this.emit('error', '更新已暂停，请保存成绩后重新检查'); this.install = null; }
  start() { this.firstTimer = setTimeout(() => void this.check(), 12000); this.interval = setInterval(() => void this.check(), 4 * 60 * 60 * 1000); }
  stop() { clearTimeout(this.firstTimer); clearTimeout(this.installTimer); clearInterval(this.interval); }
}
