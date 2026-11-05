import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const directory = process.argv[2] || 'release';
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const files = [];
for (const [platform, os, extension] of [['darwin','mac','zip'], ['win32','win','exe']]) {
  for (const arch of ['arm64', 'x64']) {
    const name = `GardenKingdom-${version}-${os}-${arch}.${extension}`;
    const path = join(directory, name), info = await stat(path), hash = createHash('sha512');
    for await (const chunk of createReadStream(path)) hash.update(chunk);
    files.push({ platform, arch, name, size: info.size, sha512: hash.digest('hex') });
  }
}
await writeFile(join(directory, 'garden-update.json'), JSON.stringify({ schema: 1, version, files }, null, 2) + '\n');
const checksums = [];
for (const name of (await readdir(directory)).filter(name => /^GardenKingdom-.*\.(dmg|zip|exe)$/.test(name) || name === 'garden-update.json').sort()) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(join(directory, name))) hash.update(chunk);
  checksums.push(`${hash.digest('hex')}  ${name}`);
}
await writeFile(join(directory, 'SHA256SUMS.txt'), checksums.join('\n') + '\n');
console.log(`Validated ${files.length} architecture-specific update packages for ${version}`);
