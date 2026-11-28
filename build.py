#!/usr/bin/env python3
"""Stop this game's old processes, package this OS and chip, install and launch."""
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


def version_parts(text):
    numbers = []
    for part in text.strip().lstrip('v').split('.'):
        digits = ''
        for char in part:
            if char.isdigit(): digits += char
            else: break
        if digits: numbers.append(int(digits))
    return numbers


def version_at_least(actual, required):
    left, right = version_parts(actual), version_parts(required)
    width = max(len(left), len(right), 1)
    left.extend([0] * (width - len(left)))
    right.extend([0] * (width - len(right)))
    return left >= right


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
            bundle_roots = ('/Applications/', str(Path.home() / 'Applications') + '/', str(ROOT / 'release') + '/')
            is_bundle = command.startswith(bundle_roots) and own_bundle in command and command.split(own_bundle, 1)[1][:1] in ('', ' ')
            is_dev = command.startswith(own_dev) and command[len(own_dev):][:1] in ('', ' ')
            if (is_bundle or is_dev) and pid.isdigit():
                result.append(int(pid))
        return result
    script = "[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new(); Get-CimInstance Win32_Process | Select-Object ProcessId,ExecutablePath,CommandLine | ConvertTo-Json -Compress"
    data = json.loads(subprocess.check_output(['powershell.exe', '-NoProfile', '-Command', script], text=True, encoding='utf-8-sig') or '[]')
    if isinstance(data, dict): data = [data]
    destination = Path(os.environ['LOCALAPPDATA']) / 'Programs' / 'GardenKingdom'
    installed_paths = [destination / f'{NAME}.exe', destination.parent / NAME / f'{NAME}.exe', destination.parent / 'itjun-fairy-tale' / f'{NAME}.exe']
    results = []
    for item in data:
        path = item.get('ExecutablePath') or ''
        is_installed = path.casefold() in [str(item).casefold() for item in installed_paths]
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
            run(['powershell.exe', '-NoProfile', '-Command', f'try {{ $p = Get-Process -Id {pid} -ErrorAction SilentlyContinue; if ($null -ne $p) {{ $null = $p.CloseMainWindow() }} }} catch {{}}; exit 0'])
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline and set(pids) & set(processes()): time.sleep(0.3)
    for pid in set(pids) & set(processes()):
        if sys.platform == 'darwin':
            try: os.kill(pid, signal.SIGKILL)
            except ProcessLookupError: pass
        else: run(['taskkill', '/PID', str(pid), '/T', '/F'])


def trash_mac_bundle(bundle):
    if not bundle.exists(): return
    register = Path('/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister')
    if register.exists():
        for app_bundle in [bundle, *bundle.glob('Contents/Frameworks/*.app')]:
            subprocess.run([str(register), '-u', str(app_bundle)], check=False, capture_output=True)
    trash = Path.home() / '.Trash'
    trash.mkdir(exist_ok=True)
    destination = trash / f'{bundle.name}-{time.time_ns()}'
    shutil.move(str(bundle), str(destination))
    if register.exists():
        for app_bundle in [destination, *destination.glob('Contents/Frameworks/*.app')]:
            subprocess.run([str(register), '-u', str(app_bundle)], check=False, capture_output=True)
    print('构建副本移到废纸篓：', destination, flush=True)


def is_apple_silicon():
    # 硬件芯片。Rosetta 下 Python 的 platform.machine() 会报成 x86_64。
    try:
        arm = subprocess.check_output(['sysctl', '-n', 'hw.optional.arm64'], text=True, stderr=subprocess.DEVNULL).strip()
    except (subprocess.CalledProcessError, FileNotFoundError, OSError):
        arm = ''
    if arm == '1': return True
    try:
        brand = subprocess.check_output(['sysctl', '-n', 'machdep.cpu.brand_string'], text=True, stderr=subprocess.DEVNULL).strip()
    except (subprocess.CalledProcessError, FileNotFoundError, OSError):
        return False
    return brand.startswith('Apple')


def windows_os_arch():
    # x64 版 Python 跑在 ARM Windows 上时，进程环境仍是 AMD64，要问系统自己的架构。
    script = '[System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()'
    try:
        output = subprocess.check_output(['powershell.exe', '-NoProfile', '-Command', script], text=True, encoding='utf-8-sig', stderr=subprocess.DEVNULL)
    except (subprocess.CalledProcessError, FileNotFoundError, OSError):
        return ''
    return output.strip().lower()


def host_arch():
    machine = platform.machine().lower()
    if machine in ('arm64', 'aarch64'): return 'arm64'
    if sys.platform == 'darwin': return 'arm64' if is_apple_silicon() else 'x64'
    if sys.platform == 'win32':
        reported = (os.environ.get('PROCESSOR_ARCHITEW6432') or os.environ.get('PROCESSOR_ARCHITECTURE') or '').lower()
        if reported in ('arm64', 'aarch64') or windows_os_arch() == 'arm64': return 'arm64'
    if machine in ('x86_64', 'amd64', 'x64'): return 'x64'
    raise RuntimeError(f'认不出这块芯片：{platform.machine()}')


def host_label(os_name, arch):
    system = 'macOS' if os_name == 'darwin' else 'Windows'
    return f'{system} {arch}'


def package_args(os_name, arch):
    if arch not in ('arm64', 'x64'): raise RuntimeError(f'不支持的芯片：{arch}')
    # 配置里两种芯片都写了。命令行不写明目标时，electron-builder 会两份都打。
    # 这里写明目标和芯片，只打当前这一份。
    if os_name == 'darwin': return ['--mac', 'dmg', 'zip', '--' + arch, '--publish', 'never']
    if os_name == 'win32': return ['--win', 'nsis', '--' + arch, '--publish', 'never']
    raise RuntimeError('本机安装仅支持 macOS / Windows')


def mac_unpacked_app(arch):
    folder = 'mac-arm64' if arch == 'arm64' else 'mac'
    return ROOT / 'release' / folder / f'{NAME}.app'


def mac_binary_arch(app):
    binary = app / 'Contents' / 'MacOS' / NAME
    output = subprocess.check_output(['/usr/bin/lipo', '-archs', str(binary)], text=True)
    found = output.split()
    if found == ['arm64']: return 'arm64'
    if found == ['x86_64']: return 'x64'
    raise RuntimeError(f'安装包芯片和本机不一致：{output.strip()}')


def finish_mac_install(source, target, previous, arch):
    version = json.loads((ROOT / 'package.json').read_text())['version']
    archive = ROOT / 'release' / f'GardenKingdom-{version}-mac-{arch}.zip'
    image = ROOT / 'release' / f'GardenKingdom-{version}-mac-{arch}.dmg'
    if not archive.is_file() or not image.is_file():
        raise RuntimeError(f'缺少本机安装包：{archive.name}、{image.name}')
    # 安装包留在 release/；本机只登记正式安装，不留下构建/备份应用入口。
    trash_mac_bundle(source)
    trash_mac_bundle(previous)
    register = Path('/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister')
    if register.exists():
        run([register, '-f', target])
        for helper in target.glob('Contents/Frameworks/*.app'):
            subprocess.run([str(register), '-u', str(helper)], check=False, capture_output=True)
    print('安装包：', image, flush=True)
    print('更新包：', archive, flush=True)


def argument_parser():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--no-launch', action='store_true', help='构建安装，但不启动游戏')
    parser.add_argument('--test', action='store_true', help='打包前先跑 npm test')
    return parser


def main():
    args = argument_parser().parse_args()
    if sys.platform not in ('darwin', 'win32'): raise RuntimeError('本机安装仅支持 macOS / Windows')
    if not shutil.which('node') or not shutil.which('npm'): raise RuntimeError('开发构建需要先安装 .nvmrc 中指定的 Node LTS；普通玩家请下载安装包')
    npm = shutil.which('npm.cmd' if sys.platform == 'win32' else 'npm')
    required = (ROOT / '.nvmrc').read_text().strip()
    actual = subprocess.check_output(['node', '-p', 'process.versions.node'], text=True).strip()
    if not version_at_least(actual, required): raise RuntimeError(f'请使用不低于 {required} 的 Node，当前是 {actual}')
    arch = host_arch()
    launch = '' if args.no_launch else '，装好后启动'
    print(f'识别到本机是 {host_label(sys.platform, arch)}，只打包这一份{launch}。', flush=True)
    stop_running()
    run([npm, 'ci'])
    run([npm, 'run', 'build'])
    if args.test:
        run([npm, 'test'])
    else:
        print('跳过测试，直接打包。需要先测试时加上 --test。', flush=True)
    builder = ROOT / 'node_modules/electron-builder/cli.js'
    run(['node', builder, *package_args(sys.platform, arch)])
    if sys.platform == 'darwin':
        source = mac_unpacked_app(arch)
        if not source.exists(): raise RuntimeError(f'打包完成但找不到 {source}')
        built = mac_binary_arch(source)
        if built != arch: raise RuntimeError(f'打出来的是 {built}，本机是 {arch}')
        parent = Path('/Applications') if os.access('/Applications', os.W_OK) else Path.home() / 'Applications'
        parent.mkdir(parents=True, exist_ok=True)
        target = parent / f'{NAME}.app'
        stage, previous = parent / f'{NAME}.app.building', parent / f'{NAME}.app.previous'
        if stage.exists(): trash_mac_bundle(stage)
        run(['/usr/bin/ditto', source, stage])
        run(['/usr/bin/codesign', '--verify', '--deep', '--strict', stage])
        stop_running()
        if previous.exists(): trash_mac_bundle(previous)
        if target.exists(): target.rename(previous)
        try: stage.rename(target)
        except Exception:
            if previous.exists(): previous.rename(target)
            raise
        finish_mac_install(source, target, previous, arch)
        if not args.no_launch: run(['/usr/bin/open', target])
    else:
        # A stable per-user directory also permits unattended future NSIS updates.
        version = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']
        installer = ROOT / 'release' / f'GardenKingdom-{version}-win-{arch}.exe'
        target = Path(os.environ['LOCALAPPDATA']) / 'Programs' / 'GardenKingdom'
        stop_running()
        run([installer, '/S', '/D=' + str(target)])
        executable = target / f'{NAME}.exe'
        if not executable.exists(): raise RuntimeError('安装未完成：找不到游戏程序')
        if not args.no_launch: subprocess.Popen([str(executable)], cwd=target)
    print('构建、安装完成。' + ('' if args.no_launch else ' 已启动游戏。'), flush=True)


if __name__ == '__main__':
    try: main()
    except (RuntimeError, subprocess.CalledProcessError, OSError) as error:
        print(f'构建失败，已保存的成绩不会被删除：{error}', file=sys.stderr)
        sys.exit(1)
