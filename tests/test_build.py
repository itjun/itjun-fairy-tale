import importlib.util
import json
import os
import subprocess
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('garden_build', Path(__file__).resolve().parents[1] / 'build.py')
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)


class ArgumentTests(unittest.TestCase):
    def test_tests_are_off_unless_requested(self):
        parser = build.argument_parser()
        self.assertFalse(parser.parse_args([]).test)
        self.assertTrue(parser.parse_args(['--test']).test)
        self.assertTrue(parser.parse_args(['--no-launch']).no_launch)


class ProcessScopeTests(unittest.TestCase):
    def test_mac_does_not_kill_shell_or_other_electron_apps(self):
        game = '/Applications/' + build.NAME + '.app/Contents/MacOS/' + build.NAME
        dev = str(build.ROOT / 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron')
        fixture = f'1 {game}\n2 /bin/sh -c {game}\n3 /Applications/Other.app/Contents/MacOS/Electron\n4 {dev} .\n5 {dev}Other\n'
        with patch.object(build.sys, 'platform', 'darwin'), patch.object(build.subprocess, 'check_output', return_value=fixture):
            self.assertEqual(build.processes(), [1, 4])

    def test_windows_unicode_and_install_locations(self):
        base = Path('/test-local') / 'Programs'
        fixture = [{'ProcessId': 1, 'ExecutablePath': str(base / 'GardenKingdom' / (build.NAME + '.exe'))},
                   {'ProcessId': 2, 'ExecutablePath': str(base / build.NAME / (build.NAME + '.exe'))},
                   {'ProcessId': 3, 'ExecutablePath': '/unrelated/electron.exe'}]
        with patch.object(build.sys, 'platform', 'win32'), patch.dict(build.os.environ, {'LOCALAPPDATA': '/test-local'}), patch.object(build.subprocess, 'check_output', return_value=json.dumps(fixture)) as output:
            self.assertEqual(build.processes(), [1, 2])
            self.assertIn('OutputEncoding', output.call_args.args[0][-1])


class HostTargetTests(unittest.TestCase):
    def test_rosetta_mac_uses_apple_silicon(self):
        with patch.object(build.sys, 'platform', 'darwin'), patch.object(build.platform, 'machine', return_value='x86_64'), patch.object(build.subprocess, 'check_output', return_value='1\n'):
            self.assertEqual(build.host_arch(), 'arm64')

    def test_intel_mac(self):
        with patch.object(build.sys, 'platform', 'darwin'), patch.object(build.platform, 'machine', return_value='x86_64'), patch.object(build.subprocess, 'check_output', side_effect=subprocess.CalledProcessError(1, 'sysctl')):
            self.assertEqual(build.host_arch(), 'x64')

    def test_native_arm_mac_does_not_ask_sysctl(self):
        with patch.object(build.sys, 'platform', 'darwin'), patch.object(build.platform, 'machine', return_value='arm64'), patch.object(build.subprocess, 'check_output') as output:
            self.assertEqual(build.host_arch(), 'arm64')
            output.assert_not_called()

    def test_windows_arm_from_emulated_python(self):
        with patch.object(build.sys, 'platform', 'win32'), patch.object(build.platform, 'machine', return_value='AMD64'), patch.dict(build.os.environ, {'PROCESSOR_ARCHITEW6432': 'ARM64'}):
            self.assertEqual(build.host_arch(), 'arm64')

    def test_windows_arm_from_os_architecture(self):
        env = {key: value for key, value in os.environ.items() if key not in ('PROCESSOR_ARCHITEW6432', 'PROCESSOR_ARCHITECTURE')}
        with patch.object(build.sys, 'platform', 'win32'), patch.object(build.platform, 'machine', return_value='AMD64'), patch.dict(build.os.environ, env, clear=True), patch.object(build.subprocess, 'check_output', return_value='Arm64\n'):
            self.assertEqual(build.host_arch(), 'arm64')

    def test_windows_x64(self):
        env = {key: value for key, value in os.environ.items() if key not in ('PROCESSOR_ARCHITEW6432', 'PROCESSOR_ARCHITECTURE')}
        with patch.object(build.sys, 'platform', 'win32'), patch.object(build.platform, 'machine', return_value='AMD64'), patch.dict(build.os.environ, env, clear=True), patch.object(build.subprocess, 'check_output', return_value='X64\n'):
            self.assertEqual(build.host_arch(), 'x64')

    def test_package_command_is_only_the_current_chip(self):
        self.assertEqual(build.package_args('darwin', 'arm64'), ['--mac', 'dmg', 'zip', '--arm64', '--publish', 'never'])
        self.assertEqual(build.package_args('darwin', 'x64'), ['--mac', 'dmg', 'zip', '--x64', '--publish', 'never'])
        self.assertEqual(build.package_args('win32', 'arm64'), ['--win', 'nsis', '--arm64', '--publish', 'never'])
        self.assertEqual(build.package_args('win32', 'x64'), ['--win', 'nsis', '--x64', '--publish', 'never'])
        self.assertEqual(build.mac_unpacked_app('arm64').parent.name, 'mac-arm64')
        self.assertEqual(build.mac_unpacked_app('x64').parent.name, 'mac')


if __name__ == '__main__':
    unittest.main()
