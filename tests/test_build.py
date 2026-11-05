import importlib.util
import json
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('garden_build', Path(__file__).resolve().parents[1] / 'build.py')
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)


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


if __name__ == '__main__':
    unittest.main()
