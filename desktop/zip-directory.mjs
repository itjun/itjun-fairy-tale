import { open } from 'node:fs/promises';

// Read UTF-8 names directly: macOS's bundled unzip can corrupt Chinese names
// even when the archive correctly sets the UTF-8 flag. Release ZIPs are < 1.5 GB.
export async function validateMacArchive(path) {
  const handle = await open(path, 'r');
  try {
    const { size } = await handle.stat();
    const tail = Buffer.alloc(Math.min(size, 65557));
    await handle.read(tail, 0, tail.length, size - tail.length);
    let end = tail.length - 22;
    for (; end >= 0; end--) {
      if (tail.readUInt32LE(end) === 0x06054b50 && end + 22 + tail.readUInt16LE(end + 20) === tail.length) break;
    }
    if (end < 0) throw new Error('更新 ZIP 目录缺失');
    const count = tail.readUInt16LE(end + 10), length = tail.readUInt32LE(end + 12), offset = tail.readUInt32LE(end + 16);
    if (tail.readUInt16LE(end + 4) || tail.readUInt16LE(end + 6) || count === 65535 || count !== tail.readUInt16LE(end + 8) || !count || length > 16 * 1024 * 1024 || offset + length > size - tail.length + end) throw new Error('更新 ZIP 目录无效');
    const directory = Buffer.alloc(length);
    const { bytesRead } = await handle.read(directory, 0, length, offset);
    if (bytesRead !== length) throw new Error('更新 ZIP 目录不完整');
    const names = []; let cursor = 0;
    for (let i = 0; i < count; i++) {
      if (cursor + 46 > length || directory.readUInt32LE(cursor) !== 0x02014b50) throw new Error('更新 ZIP 条目无效');
      const nameLength = directory.readUInt16LE(cursor + 28);
      const next = cursor + 46 + nameLength + directory.readUInt16LE(cursor + 30) + directory.readUInt16LE(cursor + 32);
      if (!nameLength || next > length) throw new Error('更新 ZIP 文件名无效');
      const name = new TextDecoder('utf-8', { fatal: true }).decode(directory.subarray(cursor + 46, cursor + 46 + nameLength));
      if (name.startsWith('/') || name.includes('\\') || name.includes('\0') || name.split('/').includes('..') || (!name.startsWith('花园王国.app/') && !name.startsWith('__MACOSX/'))) throw new Error('更新压缩包路径无效');
      names.push(name); cursor = next;
    }
    if (cursor !== length || !names.includes('花园王国.app/Contents/Info.plist')) throw new Error('更新应用目录不完整');
    return names;
  } finally { await handle.close(); }
}
