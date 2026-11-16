import { useRef, useState } from 'react';
import { DownloadSimple, UploadSimple } from '@phosphor-icons/react';
import { readGardenBackup, readGardenAlbum, gardenBackupText, mergeGardenProgress, GARDEN_BACKUP_LIMIT } from './garden-backup.js';
import { readAlbum, writeAlbum, mergeAlbums } from './album/album.js';
export function GardenBackup({ progress, onImport }) {
  const file = useRef(null);
  const [message, setMessage] = useState('换电脑或换到桌面版时，可以把小成就、贴纸和画册一起带走。');
  function download() {
    const url = URL.createObjectURL(new Blob([gardenBackupText(progress)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = '花园王国-花园进度.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  async function upload(event) {
    const selected = event.target.files?.[0]; if (!selected) return;
    try { if (selected.size > GARDEN_BACKUP_LIMIT) throw new Error('请选择花园进度的小文件。'); const text = await selected.text(), incoming = readGardenBackup(text), album = readGardenAlbum(text); if (album) writeAlbum(mergeAlbums(readAlbum(), album)); onImport(current => mergeGardenProgress(current, incoming)); setMessage('小成就、贴纸和画册已合并。本机已有的小游戏继续原来一局，没有的已从备份带过来。'); }
    catch (error) { setMessage(error instanceof SyntaxError ? '文件读不懂，请选择导出的 JSON 进度文件。' : error.message); }
    event.target.value = '';
  }
  return <div className="garden-backup"><button className="quiet-button" onClick={download}><DownloadSimple size={18} />导出花园进度</button><button className="quiet-button" onClick={() => file.current.click()}><UploadSimple size={18} />导入花园进度</button><input ref={file} type="file" accept=".json,application/json" hidden onChange={upload} /><p className="garden-backup-note" role="status">{message}</p></div>;
}
