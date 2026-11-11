"""按已审阅的 manifest 生成离线引导音频；开发工具依赖 edge-tts==7.3.1。"""
import asyncio
import json
from pathlib import Path
import edge_tts

ROOT = Path(__file__).resolve().parents[1] / 'public' / 'audio' / 'guidance'

async def main():
    manifest = json.loads((ROOT / 'manifest.json').read_text())
    semaphore = asyncio.Semaphore(3)
    completed = 0
    async def generate(line):
        nonlocal completed
        async with semaphore:
            destination = ROOT / line['file']
            if not destination.exists() or destination.stat().st_size < 1000:
                temporary = destination.with_suffix('.part.mp3')
                for attempt in range(3):
                    try:
                        await asyncio.wait_for(edge_tts.Communicate(line['text'], manifest['voice'], rate=manifest['rate']).save(str(temporary)), 45)
                        if temporary.stat().st_size < 1000:
                            raise ValueError('语音文件为空')
                        temporary.replace(destination)
                        break
                    except Exception:
                        temporary.unlink(missing_ok=True)
                        if attempt == 2:
                            raise
                        await asyncio.sleep(1 + attempt)
            completed += 1
            if completed % 10 == 0 or completed == len(manifest['lines']):
                print(f"已生成 {completed}/{len(manifest['lines'])}", flush=True)
    await asyncio.gather(*(generate(line) for line in manifest['lines']))

if __name__ == '__main__':
    asyncio.run(main())
