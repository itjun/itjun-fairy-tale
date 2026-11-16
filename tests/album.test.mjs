import test from 'node:test';
import assert from 'node:assert/strict';
import { ALBUM_PAGES, PIECES_PER_PAGE, STARS_PER_PIECE, KILLS_PER_PIECE, CHEST_PIECE_LIMIT, emptyAlbum, isValidAlbum, albumPieces, albumPages, lockedItems, unlockedStamps, recordAlbum, unlockOwned, mergeAlbums } from '../src/album/album.js';
import { readGardenBackup, readGardenAlbum, gardenBackupText } from '../src/garden-backup.js';

function record(album, events) {
  return events.reduce((current, event) => recordAlbum(current, event).album, album);
}

test('画册一共 11 页，每页 6 块，新画册什么都没点亮', () => {
  const album = emptyAlbum();
  assert.equal(ALBUM_PAGES.length, 11);
  assert.ok(isValidAlbum(album));
  assert.equal(albumPieces(album), 0);
  assert.ok(albumPages(album).every(page => page.pieces === 0 && !page.isComplete));
  assert.ok(lockedItems(album).includes('weapon:boomerang'));
  assert.ok(lockedItems(album).every(id => !id.startsWith('stamp:')));
  assert.deepEqual(unlockedStamps(album), []);
});

test('五个来源各自点亮拼块，同一位首领和精英只算第一次', () => {
  let album = emptyAlbum();
  let result = recordAlbum(album, { type: 'boss', themeId: 'rainbow' });
  assert.equal(result.gained, 1);
  result = recordAlbum(result.album, { type: 'boss', themeId: 'rainbow' });
  assert.equal(result.gained, 0);
  result = recordAlbum(result.album, { type: 'elite', themeId: 'rainbow' });
  assert.equal(result.gained, 1);
  assert.equal(recordAlbum(result.album, { type: 'boss', themeId: 'nowhere' }).gained, 0);

  album = recordAlbum(emptyAlbum(), { type: 'stars', count: STARS_PER_PIECE - 1 }).album;
  assert.equal(albumPieces(album), 0);
  assert.equal(recordAlbum(album, { type: 'stars', count: 1 }).gained, 1);

  album = record(emptyAlbum(), Array.from({ length: KILLS_PER_PIECE - 1 }, () => ({ type: 'kill', kind: 'plane' })));
  assert.equal(albumPieces(album), 0);
  assert.equal(recordAlbum(album, { type: 'kill', kind: 'plane' }).gained, 1);
  assert.equal(recordAlbum(album, { type: 'kill', kind: 'no-such-monster' }).gained, 0);

  album = record(emptyAlbum(), Array.from({ length: CHEST_PIECE_LIMIT }, () => ({ type: 'chest' })));
  assert.equal(albumPieces(album), CHEST_PIECE_LIMIT);
  assert.equal(recordAlbum(album, { type: 'chest' }).gained, 0);
  assert.equal(recordAlbum(album, { type: 'gift' }).gained, 1);
});

test('集满一页才解锁这一页的东西，并报出刚集满的是哪一页', () => {
  let album = recordAlbum(emptyAlbum(), { type: 'stars', count: STARS_PER_PIECE * (PIECES_PER_PAGE - 1) }).album;
  assert.ok(lockedItems(album).includes('weapon:boomerang'));
  const result = recordAlbum(album, { type: 'chest' });
  assert.deepEqual(result.completed.map(page => page.name), ['爱心花园']);
  assert.ok(!lockedItems(result.album).includes('weapon:boomerang'));
  assert.ok(lockedItems(result.album).includes('upgrade:wreath'));

  album = recordAlbum(result.album, { type: 'stars', count: STARS_PER_PIECE * PIECES_PER_PAGE }).album;
  assert.ok(!lockedItems(album).includes('upgrade:wreath'));
  assert.deepEqual(unlockedStamps(album), ['rainbow']);
  assert.equal(recordAlbum(album, { type: 'chest' }).completed.length, 0);

  const full = recordAlbum(emptyAlbum(), { type: 'stars', count: STARS_PER_PIECE * 1000 }).album;
  assert.equal(albumPieces(full), ALBUM_PAGES.length * PIECES_PER_PAGE);
  assert.deepEqual(lockedItems(full), []);
});

test('旧存档里已经有的武器、本领和大招直接算解锁，不点亮拼块', () => {
  const adventure = { weapons: ['moonblade', 'boomerang', 'not-a-weapon'], upgrades: { wreath: 1 }, magic: { ranks: { thunder: 2 } } };
  const album = unlockOwned(emptyAlbum(), adventure);
  assert.ok(isValidAlbum(album));
  assert.equal(albumPieces(album), 0);
  const locked = lockedItems(album);
  assert.ok(!locked.includes('weapon:boomerang') && !locked.includes('upgrade:wreath') && !locked.includes('spell:thunder'));
  assert.ok(locked.includes('weapon:seed'));
  assert.deepEqual(unlockOwned(album, adventure).owned, album.owned);
  assert.equal(unlockOwned(album, null), album);
});

test('两本画册合并时哪边多用哪边，合并后仍然有效', () => {
  const current = { ...emptyAlbum(), claimed: ['boss:rainbow'], stars: 30, chests: 2, kills: { plane: 12 }, owned: ['weapon:seed'] };
  const incoming = { ...emptyAlbum(), claimed: ['boss:rainbow', 'elite:family'], stars: 12, gifts: 3, kills: { plane: 4, balloon: 7 }, owned: ['weapon:seed', 'spell:rain'] };
  const merged = mergeAlbums(current, incoming);
  assert.ok(isValidAlbum(merged));
  assert.deepEqual(merged.claimed, ['boss:rainbow', 'elite:family']);
  assert.deepEqual([merged.stars, merged.chests, merged.gifts], [30, 2, 3]);
  assert.deepEqual(merged.kills, { plane: 12, balloon: 7 });
  assert.deepEqual(merged.owned, ['weapon:seed', 'spell:rain']);
  assert.deepEqual(mergeAlbums(merged, incoming), merged);
});

test('画册校验拒绝改坏的数据', () => {
  const album = emptyAlbum();
  assert.ok(!isValidAlbum({ ...album, version: 2 }));
  assert.ok(!isValidAlbum({ ...album, claimed: ['boss:rainbow', 'boss:rainbow'] }));
  assert.ok(!isValidAlbum({ ...album, claimed: ['boss:nowhere'] }));
  assert.ok(!isValidAlbum({ ...album, stars: -1 }));
  assert.ok(!isValidAlbum({ ...album, kills: { ghost: 3 } }));
  assert.ok(!isValidAlbum({ ...album, owned: ['weapon:laser'] }));
});

test('花园备份第 3 版带上画册，第 1、2 版照样能读', () => {
  const progress = { rainbow: 2, flowers: [1, 0, 0, 0], served: [false, false, false, false], stamps: [{ type: 'rainbow', x: 10, y: 20 }] };
  const album = recordAlbum(emptyAlbum(), { type: 'boss', themeId: 'rainbow' }).album;
  const text = gardenBackupText(progress, album);
  assert.equal(JSON.parse(text).version, 3);
  assert.deepEqual(readGardenAlbum(text), album);
  assert.deepEqual(readGardenBackup(text).stamps, progress.stamps);
  const old = JSON.stringify({ type: 'garden-progress', version: 2, progress: { ...progress, stamps: [] } });
  assert.equal(readGardenAlbum(old), null);
  assert.equal(readGardenBackup(old).rainbow, 2);
  assert.throws(() => readGardenAlbum(JSON.stringify({ type: 'garden-progress', version: 3, progress, album: { ...album, stars: -5 } })));
});
