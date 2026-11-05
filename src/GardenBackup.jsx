import { useRef, useState } from 'react';
import { DownloadSimple, UploadSimple } from '@phosphor-icons/react';
import { readGardenBackup, mergeGardenProgress } from './garden-backup.js';
export function GardenBackup({ progress, onImport }) {
  const file = useRef(null);
  const [message, setMessage] = useState('换电脑或换到桌面版时，可以把小成就和贴纸一起带走。跳台成绩请在桌面菜单“成绩本”中备份。');
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ type: 'garden-progress', version: 1, progress })], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = '花园王国-花园进度.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  async function upload(event) {
    const selected = event.target.files?.[0]; if (!selected) return;
    try { if (selected.size > 65536) throw new Error('请选择花园进度的小文件。'); const incoming = readGardenBackup(await selected.text()); onImport(current => mergeGardenProgress(current, incoming)); setMessage('花园进度已合并，已有的小成就也都保留啦。'); }
    catch (error) { setMessage(error instanceof SyntaxError ? '文件读不懂，请选择导出的 JSON 进度文件。' : error.message); }
    event.target.value = '';
  }
  return <details className="garden-backup"><summary>家长工具 · 带走花园进度</summary><p role="status">{message}</p><div className="desktop-actions"><button className="quiet-button" onClick={download}><DownloadSimple size={18} />导出花园进度</button><button className="quiet-button" onClick={() => file.current.click()}><UploadSimple size={18} />导入花园进度</button><input ref={file} type="file" accept=".json,application/json" hidden onChange={upload} /></div></details>;
}
