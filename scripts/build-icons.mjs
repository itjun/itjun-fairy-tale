import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
const source = new URL('../build/icon-source.png', import.meta.url);
const build = new URL('../build/', import.meta.url);
const publicDir = new URL('../public/', import.meta.url);
await mkdir(build, { recursive: true });
const sizes = [16, 32, 48, 64, 128, 256, 512, 1024];
const images = new Map();
for (const size of sizes) images.set(size, await sharp(source.pathname).resize(size, size, { fit: 'contain', background: '#00000000' }).png().toBuffer());
await writeFile(new URL('icon.png', build), images.get(1024));
await writeFile(new URL('app-icon.png', publicDir), images.get(512));
await writeFile(new URL('favicon.png', publicDir), images.get(32));
// Modern Windows ICO entries and macOS ICNS entries carry lossless PNG frames.
const icoSizes = sizes.filter(size => size <= 256), header = Buffer.alloc(6 + 16 * icoSizes.length);
header.writeUInt16LE(1, 2); header.writeUInt16LE(icoSizes.length, 4);
let offset = header.length;
icoSizes.forEach((size, i) => {
  const data = images.get(size), pos = 6 + 16 * i;
  header[pos] = header[pos + 1] = size === 256 ? 0 : size;
  header.writeUInt16LE(1, pos + 4); header.writeUInt16LE(32, pos + 6);
  header.writeUInt32LE(data.length, pos + 8); header.writeUInt32LE(offset, pos + 12);
  offset += data.length;
});
await writeFile(new URL('icon.ico', build), Buffer.concat([header, ...icoSizes.map(size => images.get(size))]));
const entries = Object.entries({ icp4: 16, icp5: 32, icp6: 64, ic07: 128, ic08: 256, ic09: 512, ic10: 1024 }).map(([type, size]) => {
  const png = images.get(size), entry = Buffer.alloc(8);
  entry.write(type); entry.writeUInt32BE(png.length + 8, 4);
  return Buffer.concat([entry, png]);
});
const icns = Buffer.alloc(8); icns.write('icns'); icns.writeUInt32BE(8 + entries.reduce((sum, entry) => sum + entry.length, 0), 4);
await writeFile(new URL('icon.icns', build), Buffer.concat([icns, ...entries]));
console.log('Generated macOS ICNS, Windows ICO, app PNG and favicon.');
