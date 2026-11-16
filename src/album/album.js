import { WEAPONS, UPGRADES, MONSTERS } from '../../shared/adventure-catalog.js';
import { SPELLS } from '../../shared/combat-catalog.js';
import { LEVELS } from '../../shared/levels.js';

// 画册：11 页对应 11 幅原画，每页 6 块。集满一页解锁新东西，不加数值。
export const ALBUM_KEY = 'garden-album-v1';
export const PIECES_PER_PAGE = 6;
export const STARS_PER_PIECE = 9;
export const KILLS_PER_PIECE = 10;
export const CHEST_PIECE_LIMIT = 16;
export const GIFT_PIECE_LIMIT = 16;
const weapon = id => ({ type: 'weapon', id }), upgrade = id => ({ type: 'upgrade', id }), spell = id => ({ type: 'spell', id }), stamp = id => ({ type: 'stamp', id });
export const ALBUM_PAGES = Object.freeze([
  { name: '爱心花园', unlocks: [weapon('boomerang')] },
  { name: '绿色小城堡', unlocks: [upgrade('wreath'), upgrade('courage'), upgrade('snack'), stamp('rainbow')] },
  { name: '我们在一起', unlocks: [weapon('seed')] },
  { name: '阳光下的小家', unlocks: [spell('thunder')] },
  { name: '粉色城堡', unlocks: [upgrade('lure'), upgrade('breeze'), upgrade('landing'), stamp('icecream')] },
  { name: '彩虹花园王国', unlocks: [weapon('firefly')] },
  { name: '幸福的一家人', unlocks: [upgrade('companion'), upgrade('chain'), upgrade('haste'), stamp('balloon')] },
  { name: '蓝色大城堡', unlocks: [spell('rain')] },
  { name: '我的花园王国', unlocks: [weapon('flame')] },
  { name: '超级冰淇淋', unlocks: [upgrade('duplicate'), upgrade('explorer'), upgrade('cleanse'), stamp('shell')] },
  { name: '高高的城堡', unlocks: [stamp('snowflake'), stamp('mushroom')] },
]);
export const ALBUM_STAMPS = Object.freeze({
  rainbow: { name: '彩虹', image: 'collectible-rainbow' }, icecream: { name: '冰淇淋', image: 'icecream' }, balloon: { name: '气球', image: 'collectible-balloon' },
  shell: { name: '贝壳', image: 'collectible-shell' }, snowflake: { name: '雪花', image: 'collectible-snowflake' }, mushroom: { name: '蘑菇', image: 'collectible-mushroom' },
});
export function unlockName(item) {
  if (item.type === 'weapon') return `武器 ${WEAPONS[item.id].name}`;
  if (item.type === 'spell') return `大招 ${SPELLS[item.id].name}`;
  if (item.type === 'upgrade') return `本领 ${UPGRADES[item.id].name}`;
  return `花园贴纸 ${ALBUM_STAMPS[item.id].name}`;
}
export function unlockImage(item) {
  return (item.type === 'weapon' ? WEAPONS : item.type === 'spell' ? SPELLS : item.type === 'upgrade' ? UPGRADES : ALBUM_STAMPS)[item.id].image;
}

export function emptyAlbum() { return { version: 1, claimed: [], stars: 0, chests: 0, gifts: 0, kills: {}, owned: [] }; }
const THEMES = LEVELS.map(level => level.id);
const isClaim = id => typeof id === 'string' && /^(boss|elite):[a-z]+$/.test(id) && THEMES.includes(id.split(':')[1]);
const isOwned = id => typeof id === 'string' && /^(weapon|upgrade|spell):[a-zA-Z]+$/.test(id) && Object.hasOwn({ weapon: WEAPONS, upgrade: UPGRADES, spell: SPELLS }[id.split(':')[0]], id.split(':')[1]);
const isCount = value => Number.isInteger(value) && value >= 0 && value <= 1000000;
export function isValidAlbum(album) {
  return album?.version === 1 && Array.isArray(album.claimed) && album.claimed.length <= 16 && new Set(album.claimed).size === album.claimed.length && album.claimed.every(isClaim)
    && isCount(album.stars) && isCount(album.chests) && isCount(album.gifts)
    && !!album.kills && !Array.isArray(album.kills) && Object.entries(album.kills).every(([kind, count]) => Object.hasOwn(MONSTERS, kind) && isCount(count))
    && Array.isArray(album.owned) && new Set(album.owned).size === album.owned.length && album.owned.every(isOwned);
}
export function readAlbum() {
  try { const album = JSON.parse(localStorage.getItem(ALBUM_KEY)); if (isValidAlbum(album)) return album; }
  catch { /* 读不到时当成空画册，不影响游玩。 */ }
  return emptyAlbum();
}
export function writeAlbum(album) {
  try { localStorage.setItem(ALBUM_KEY, JSON.stringify(album)); return true; }
  catch { return false; }
}
export function hasAlbum() {
  try { return localStorage.getItem(ALBUM_KEY) !== null; } catch { return true; }
}

// 贴纸的五个来源。每个来源各自数，合起来就是点亮的块数。
export function albumSources(album) {
  return [
    { name: '第一次打赢首领', count: album.claimed.filter(id => id.startsWith('boss:')).length, limit: THEMES.length },
    { name: '第一次打赢精英', count: album.claimed.filter(id => id.startsWith('elite:')).length, limit: THEMES.length },
    { name: '解开宝箱房和贴纸门', count: Math.min(CHEST_PIECE_LIMIT, album.chests) + Math.min(GIFT_PIECE_LIMIT, album.gifts), limit: CHEST_PIECE_LIMIT + GIFT_PIECE_LIMIT },
    { name: `每攒 ${STARS_PER_PIECE} 颗房间星`, count: Math.floor(album.stars / STARS_PER_PIECE), limit: null },
    { name: `同一种怪打倒 ${KILLS_PER_PIECE} 只`, count: Object.values(album.kills).filter(count => count >= KILLS_PER_PIECE).length, limit: Object.keys(MONSTERS).length },
  ];
}
export function albumPieces(album) {
  return Math.min(ALBUM_PAGES.length * PIECES_PER_PAGE, albumSources(album).reduce((total, source) => total + source.count, 0));
}
export function albumPages(album) {
  const pieces = albumPieces(album);
  return ALBUM_PAGES.map((page, index) => {
    const count = Math.max(0, Math.min(PIECES_PER_PAGE, pieces - index * PIECES_PER_PAGE));
    return { ...page, index, pieces: count, isComplete: count === PIECES_PER_PAGE };
  });
}
export function unlockedItems(album) {
  const items = albumPages(album).filter(page => page.isComplete).flatMap(page => page.unlocks);
  return new Set([...items.map(item => `${item.type}:${item.id}`), ...album.owned]);
}
// 奖励池里要去掉的东西：放在画册里、还没解锁的武器、本领和大招。
export function lockedItems(album) {
  const unlocked = unlockedItems(album);
  return ALBUM_PAGES.flatMap(page => page.unlocks).filter(item => item.type !== 'stamp').map(item => `${item.type}:${item.id}`).filter(id => !unlocked.has(id));
}
export function unlockedStamps(album) {
  return albumPages(album).filter(page => page.isComplete).flatMap(page => page.unlocks).filter(item => item.type === 'stamp').map(item => item.id);
}

// 记一件事，返回新画册、这次点亮了几块、刚集满的页。
export function recordAlbum(album, event) {
  const next = { ...album, claimed: [...album.claimed], kills: { ...album.kills } };
  if (event.type === 'boss' || event.type === 'elite') {
    const id = `${event.type}:${event.themeId}`;
    if (isClaim(id) && !next.claimed.includes(id)) next.claimed.push(id);
  } else if (event.type === 'chest') next.chests++;
  else if (event.type === 'gift') next.gifts++;
  else if (event.type === 'stars') next.stars += event.count;
  else if (event.type === 'kill' && Object.hasOwn(MONSTERS, event.kind)) next.kills[event.kind] = (next.kills[event.kind] || 0) + 1;
  const before = albumPages(album), after = albumPages(next);
  return { album: next, gained: albumPieces(next) - albumPieces(album), completed: after.filter(page => page.isComplete && !before[page.index].isComplete) };
}
// 升级那一刻存档里已经有的武器、本领和大招直接算解锁。
export function unlockOwned(album, adventure) {
  if (!adventure) return album;
  const owned = [...adventure.weapons.map(id => `weapon:${id}`), ...Object.keys(adventure.upgrades).map(id => `upgrade:${id}`), ...Object.keys(adventure.magic?.ranks || {}).map(id => `spell:${id}`)].filter(isOwned);
  return { ...album, owned: [...new Set([...album.owned, ...owned])] };
}
// 恢复备份时两本画册合成一本，哪边多用哪边。
export function mergeAlbums(current, incoming) {
  const kills = { ...current.kills };
  for (const [kind, count] of Object.entries(incoming.kills)) kills[kind] = Math.max(kills[kind] || 0, count);
  return { version: 1, claimed: [...new Set([...current.claimed, ...incoming.claimed])], stars: Math.max(current.stars, incoming.stars), chests: Math.max(current.chests, incoming.chests), gifts: Math.max(current.gifts, incoming.gifts), kills, owned: [...new Set([...current.owned, ...incoming.owned])] };
}
