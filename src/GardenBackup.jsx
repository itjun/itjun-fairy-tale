import { useRef, useState } from 'react';
import { DownloadSimple, UploadSimple } from '@phosphor-icons/react';
import { readGardenBackup, mergeGardenProgress, GARDEN_BACKUP_LIMIT } from './garden-backup.js';
export function GardenBackup({ progress, onImport }) {
  const file = useRef(null);
  const [message, setMessage] = useState('换电脑或换到桌面版时，可以把小成就和贴纸一起带走。跳台成绩请在桌面菜单“成绩本”中备份。');
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ type: 'garden-progress', version: 2, progress })], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = '花园王国-花园进度.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  async function upload(event) {
    const selected = event.target.files?.[0]; if (!selected) return;
    try { if (selected.size > GARDEN_BACKUP_LIMIT) throw new Error('请选择花园进度的小文件。'); const incoming = readGardenBackup(await selected.text()); onImport(current => mergeGardenProgress(current, incoming)); setMessage('小成就和贴纸已合并。本机已有的小游戏继续原来一局，没有的已从备份带过来。'); }
    catch (error) { setMessage(error instanceof SyntaxError ? '文件读不懂，请选择导出的 JSON 进度文件。' : error.message); }
    event.target.value = '';
  }
  return <div className="garden-backup"><button className="quiet-button" onClick={download}><DownloadSimple size={18} />导出花园进度</button><button className="quiet-button" onClick={() => file.current.click()}><UploadSimple size={18} />导入花园进度</button><input ref={file} type="file" accept=".json,application/json" hidden onChange={upload} /><p className="garden-backup-note" role="status">{message}</p></div>;
}
