#!/usr/bin/env python3
"""Stop this game's old processes, build, install locally and launch fullscreen."""
import argparse
import json
import os
from pathlib import Path
import platform
import shutil
import signal
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parent
NAME = '花园王国'


def run(args, **kwargs):
    print('>', ' '.join(map(str, args)), flush=True)
    return subprocess.run([str(arg) for arg in args], cwd=ROOT, check=True, **kwargs)


def processes():
    if sys.platform == 'darwin':
        output = subprocess.check_output(['ps', '-axo', 'pid=,command='], text=True)
        result = []
        for line in output.splitlines():
            pid, _, command = line.strip().partition(' ')
            # App bundles by exact executable suffix; dev Electron only in this checkout.
            own_bundle = f'/{NAME}.app/Contents/MacOS/{NAME}'
            own_dev = str(ROOT / 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron')
            if (own_bundle in command or command.startswith(own_dev)) and pid.isdigit():
                result.append(int(pid))
        return result
    script = "Get-CimInstance Win32_Process | Select-Object ProcessId,ExecutablePath,CommandLine | ConvertTo-Json -Compress"
    data = json.loads(subprocess.check_output(['powershell.exe', '-NoProfile', '-Command', script], text=True, encoding='utf-8-sig') or '[]')
    if isinstance(data, dict): data = [data]
    destination = Path(os.environ['LOCALAPPDATA']) / 'Programs' / 'GardenKingdom'
    results = []
    for item in data:
        path = item.get('ExecutablePath') or ''
        is_installed = path.casefold() == str(destination / f'{NAME}.exe').casefold()
        is_build = path.casefold().startswith(str(ROOT / 'release').casefold() + os.sep) and Path(path).name == f'{NAME}.exe'
        is_dev = path.casefold() == str(ROOT / 'node_modules/electron/dist/electron.exe').casefold() and str(ROOT).casefold() in (item.get('CommandLine') or '').casefold()
        if is_installed or is_build or is_dev: results.append(item['ProcessId'])
    return results


def stop_running():
    pids = processes()
    if not pids: return
    print('关闭本游戏旧进程：', pids, flush=True)
    if sys.platform == 'darwin':
        for pid in pids:
            try: os.kill(pid, signal.SIGTERM)
            except ProcessLookupError: pass
    else:
        for pid in pids:
            run(['powershell.exe', '-NoProfile', '-Command', f'(Get-Process -Id {pid} -ErrorAction SilentlyContinue).CloseMainWindow() | Out-Null'])
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline and set(pids) & set(processes()): time.sleep(0.3)
    for pid in set(pids) & set(processes()):
        if sys.platform == 'darwin':
            try: os.kill(pid, signal.SIGKILL)
            except ProcessLookupError: pass
        else: run(['taskkill', '/PID', str(pid), '/T', '/F'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--no-launch', action='store_true', help='构建安装，但不启动游戏')
    args = parser.parse_args()
    if sys.platform not in ('darwin', 'win32'): raise RuntimeError('本机安装仅支持 macOS / Windows')
    if not shutil.which('node') or not shutil.which('npm'): raise RuntimeError('开发构建需要先安装 .nvmrc 中指定的 Node LTS；普通玩家请下载安装包')
    npm = shutil.which('npm.cmd' if sys.platform == 'win32' else 'npm')
    required = (ROOT / '.nvmrc').read_text().strip()
    actual = subprocess.check_output(['node', '-p', 'process.versions.node'], text=True).strip()
    if actual != required: raise RuntimeError(f'请使用项目指定的 Node {required}，当前是 {actual}')
    arch = 'arm64' if platform.machine().lower() in ('arm64','aarch64') else 'x64'
    stop_running()
    run([npm, 'ci'])
    run([npm, 'run', 'build'])
    run([npm, 'test'])
    builder = ROOT / 'node_modules/electron-builder/cli.js'
    if sys.platform == 'darwin':
        run(['node', builder, '--mac', '--dir', '--' + arch, '--publish', 'never'])
        source = ROOT / 'release' / ('mac-arm64' if arch == 'arm64' else 'mac') / f'{NAME}.app'
        parent = Path('/Applications') if os.access('/Applications', os.W_OK) else Path.home() / 'Applications'
        parent.mkdir(parents=True, exist_ok=True)
        target = parent / f'{NAME}.app'
        stage, previous = parent / f'{NAME}.app.building', parent / f'{NAME}.app.previous'
        if stage.exists(): shutil.rmtree(stage)
        run(['/usr/bin/ditto', source, stage])
        run(['/usr/bin/codesign', '--verify', '--deep', '--strict', stage])
        stop_running()
        if previous.exists(): shutil.rmtree(previous)
        if target.exists(): target.rename(previous)
        try: stage.rename(target)
        except Exception:
            if previous.exists(): previous.rename(target)
            raise
        if not args.no_launch: run(['/usr/bin/open', target])
    else:
        # A stable per-user directory also permits unattended future NSIS updates.
        run(['node', builder, '--win', '--' + arch, '--publish', 'never'])
        version = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']
        installer = ROOT / 'release' / f'GardenKingdom-{version}-win-{arch}.exe'
        target = Path(os.environ['LOCALAPPDATA']) / 'Programs' / 'GardenKingdom'
        stop_running()
        run([installer, '/S', '/D=' + str(target)])
        executable = target / f'{NAME}.exe'
        if not executable.exists(): raise RuntimeError('安装未完成：找不到游戏程序')
        if not args.no_launch: subprocess.Popen([str(executable)], cwd=target)
    print('构建、安装完成。' + ('' if args.no_launch else ' 已启动全屏游戏。'), flush=True)


if __name__ == '__main__':
    try: main()
    except (RuntimeError, subprocess.CalledProcessError, OSError) as error:
        print(f'构建失败，已保存的成绩不会被删除：{error}', file=sys.stderr)
        sys.exit(1)
