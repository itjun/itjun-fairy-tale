import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { newerVersion, selectUpdate, releaseAssetUrl } from '../desktop/update-policy.mjs';
import { verifyFile, UpdateManager, macSwapScript } from '../desktop/updates.mjs';
const exec = promisify(execFile);
const content = Buffer.from('verified-update');
const file = { platform: process.platform, arch: process.arch, name: 'GardenKingdom-0.2.0-test' + (process.platform === 'darwin' ? '.zip' : '.exe'), size: content.length, sha512: createHash('sha512').update(content).digest('hex') };
const url = `https://github.com/itjun/itjun-fairy-tale/releases/download/v0.2.0/${file.name}`;
const release = { tag_name: 'v0.2.0', assets: [{ name: 'garden-update.json', browser_download_url: 'https://github.com/itjun/itjun-fairy-tale/releases/download/v0.2.0/garden-update.json' }, { name: file.name, size: file.size, browser_download_url: url }] };
const manifest = { schema: 1, version: '0.2.0', files: [file] };
test('只接受正式升级、正确架构、固定仓库和匹配校验清单', () => {
  assert.equal(newerVersion('1.10.0','1.9.9'), true);
  assert.equal(newerVersion('0.1.0','0.2.0'), false);
  assert.throws(() => newerVersion('0.2.0-beta','0.1.0'));
  assert.equal(selectUpdate(manifest, release, '0.1.0', process.platform, process.arch).url, url);
  assert.equal(selectUpdate(manifest, release, '0.2.0', process.platform, process.arch), null);
  assert.throws(() => selectUpdate(manifest, {...release, prerelease:true}, '0.1.0', process.platform, process.arch));
  assert.throws(() => selectUpdate(manifest, release, '0.1.0', process.platform, 'wrong'));
  assert.throws(() => releaseAssetUrl('https://github.com/evil/repo/releases/download/v1/a.zip'));
  assert.throws(() => selectUpdate({...manifest,files:[{...file,sha512:'bad'}]}, release, '0.1.0', process.platform, process.arch));
});
test('损坏文件被拒绝；后台下载不直接安装，安全状态才准备保存退出', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'garden-updates-'));
  let installed = 0, requested = 0;
  const manager = new UpdateManager({ app: { isPackaged:true, getVersion:()=> '0.1.0', getPath:()=>dir }, notify:()=>{}, requestInstall:()=>requested++, fetcher:async address=> address.endsWith('/latest') ? Response.json(release) : address.endsWith('.json') ? Response.json(manifest) : new Response(content), installer:async()=>async()=>installed++ });
  try {
    const path = join(dir,'broken'); await writeFile(path, 'broken');
    await assert.rejects(verifyFile(path,file), /校验失败/);
    await Promise.all([manager.check(),manager.check()]);
    assert.equal(manager.state.phase,'ready'); assert.equal(installed,0); assert.equal(requested,0);
    manager.setSafe(true); assert.ok(manager.installTimer); manager.setSafe(false);
    manager.setSafe(true); await new Promise(resolve => setTimeout(resolve, 5100));
    assert.equal(requested,1); assert.equal(manager.state.phase,'installing'); assert.equal(installed,0);
    await manager.apply(); assert.equal(installed,1);
    manager.cancelInstall(); assert.equal(manager.state.phase,'error');
    await assert.rejects(manager.apply(), /尚未准备/);
  } finally { manager.stop(); await rm(dir,{recursive:true,force:true}); }
});
test('下载篡改时保持旧应用；断网可重试', async () => {
  const dir = await mkdtemp(join(tmpdir(),'garden-update-error-')); let called = false;
  const manager = new UpdateManager({app:{isPackaged:true,getVersion:()=> '0.1.0',getPath:()=>dir}, notify:()=>{}, requestInstall:()=>{}, installer:async()=>{called=true;}, fetcher:async address=> address.endsWith('/latest') ? Response.json(release) : address.endsWith('.json') ? Response.json(manifest) : new Response('wrong')});
  try {
    await manager.check(); assert.equal(manager.state.phase,'error'); assert.equal(called,false);
    manager.fetcher=async()=>{throw new Error('offline');}; await manager.check(); assert.match(manager.state.message,/offline/);
  } finally { manager.stop(); await rm(dir,{recursive:true,force:true}); }
});
test('Mac 替换保留旧包，目标写入失败时不丢原应用', {skip:process.platform!=='darwin'}, async()=>{
  const dir=await mkdtemp(join(tmpdir(),'garden-swap-'));
  try {
    const target=join(dir,'old.app'), staged=join(dir,'new.app'), backup=join(dir,'backup.app'), script=join(dir,'swap.sh');
    await mkdir(target); await mkdir(staged); await writeFile(join(target,'version'),'old'); await writeFile(join(staged,'version'),'new');
    // Substitute only OS launch with success; run the real filesystem replacement logic.
    await writeFile(script,macSwapScript().replaceAll('/usr/bin/open','/usr/bin/true'));
    await exec('/bin/sh',[script,'99999999',target,staged,backup]);
    assert.equal(await readFile(join(target,'version'),'utf8'),'new'); assert.equal(await readFile(join(backup,'version'),'utf8'),'old');
    await rm(backup,{recursive:true}); await mkdir(staged); await writeFile(join(staged,'version'),'next');
    await writeFile(script,macSwapScript().replace('if ! mv \"$staged\" \"$target\"; then', 'if ! /usr/bin/false; then'));
    await assert.rejects(exec('/bin/sh',[script,'99999999',target,staged,backup]));
    assert.equal(await readFile(join(target,'version'),'utf8'),'new');
  } finally { await rm(dir,{recursive:true,force:true}); }
});
