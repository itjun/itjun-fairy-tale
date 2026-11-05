export function readGardenBackup(text) {
  if (text.length > 65536) throw new Error('备份文件太大了，请选择花园进度文件。');
  const input = JSON.parse(text), p = input?.progress;
  if (input?.type !== 'garden-progress' || input.version !== 1 || !p || !Number.isInteger(p.rainbow) || p.rainbow < 0 || p.rainbow > 6 || !Array.isArray(p.flowers) || p.flowers.length !== 4 || p.flowers.some(v => ![0, 1, 2].includes(v)) || !Array.isArray(p.served) || p.served.length !== 4 || p.served.some(v => typeof v !== 'boolean') || !Array.isArray(p.stamps) || p.stamps.length > 40 || p.stamps.some(v => !v || !['flower', 'heart', 'star', 'butterfly'].includes(v.type) || !Number.isFinite(v.x) || !Number.isFinite(v.y) || v.x < 0 || v.x > 100 || v.y < 0 || v.y > 100)) throw new Error('这不是有效的花园进度备份。');
  return { rainbow: p.rainbow, flowers: p.flowers, served: p.served, stamps: p.stamps.map(({ type, x, y }) => ({ type, x, y })) };
}
export function mergeGardenProgress(current, incoming) {
  const stamps = [...new Map([...current.stamps, ...incoming.stamps].map(stamp => [JSON.stringify(stamp), stamp])).values()].slice(-40);
  return { rainbow: Math.max(current.rainbow, incoming.rainbow), flowers: current.flowers.map((v, i) => Math.max(v, incoming.flowers[i])), served: current.served.map((v, i) => v || incoming.served[i]), stamps };
}
