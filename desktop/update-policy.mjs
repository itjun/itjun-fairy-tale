export const REPOSITORY = 'itjun/itjun-fairy-tale';
export const RELEASES = `https://api.github.com/repos/${REPOSITORY}/releases/latest`;
export function newerVersion(next, current) {
  const parse = value => { if (!/^\d+\.\d+\.\d+$/.test(value)) throw new Error('无效的稳定版本号'); return value.split('.').map(Number); };
  const a = parse(next), b = parse(current);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}
export function releaseAssetUrl(url) {
  const parsed = new URL(url);
  if (parsed.origin !== 'https://github.com' || !parsed.pathname.startsWith(`/${REPOSITORY}/releases/download/`) || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error('更新包来源不可信');
  return parsed.href;
}
export function selectUpdate(manifest, release, current, platform, arch) {
  if (release.draft || release.prerelease || manifest.schema !== 1 || release.tag_name !== `v${manifest.version}`) throw new Error('更新清单与正式版本不匹配');
  if (!newerVersion(manifest.version, current)) return null;
  const file = manifest.files?.find(item => item.platform === platform && item.arch === arch);
  if (!file || !/^[\w.-]+$/.test(file.name) || !/^[a-f0-9]{128}$/.test(file.sha512) || !Number.isSafeInteger(file.size) || file.size < 1 || file.size > 1_500_000_000) throw new Error('缺少当前系统的有效更新包');
  const extension = platform === 'darwin' ? '.zip' : '.exe';
  if (!file.name.endsWith(extension)) throw new Error('更新包格式不匹配');
  const asset = release.assets.find(item => item.name === file.name);
  if (!asset || asset.size !== file.size) throw new Error('更新包大小不匹配');
  const url = releaseAssetUrl(asset.browser_download_url);
  if (!new URL(url).pathname.startsWith(`/${REPOSITORY}/releases/download/v${manifest.version}/`)) throw new Error('更新包版本不匹配');
  return { ...file, version: manifest.version, url };
}
