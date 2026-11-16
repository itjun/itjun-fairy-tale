import { useEffect, useRef, useState } from 'react';
import { FloppyDisk, ClockCounterClockwise } from '@phosphor-icons/react';
import { gardenBackupText, readGardenBackup, readGardenAlbum, mergeGardenProgress } from './garden-backup.js';
import { readAlbum, writeAlbum, mergeAlbums } from './album/album.js';

function backupName(id) { return `${Number(id.slice(4, 6))} 月 ${Number(id.slice(6, 8))} 日 ${id.slice(9, 11)}:${id.slice(11, 13)}`; }

// 桌面版的备份和恢复都在应用里完成，不弹系统文件窗口。成绩本和花园进度一起存。
export function DesktopBackups({ progress, onImport }) {
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState('备份会把成绩本、花园进度和画册一起存到这台电脑的备份文件夹，最多留 20 份。');
  const [isBusy, setIsBusy] = useState(false);
  const isBusyRef = useRef(false);
  useEffect(() => {
    let isActive = true;
    window.gardenDesktop.listBackups().then(reply => { if (isActive && reply?.result) setItems(reply.result); });
    return () => { isActive = false; };
  }, []);
  async function run(task) {
    if (isBusyRef.current) return;
    isBusyRef.current = true; setIsBusy(true);
    try { await task(); }
    catch (error) { console.warn('备份操作未完成', error); setMessage(error.message || '这次没有成功，请再试一次。'); }
    finally { isBusyRef.current = false; setIsBusy(false); }
  }
  function create() {
    return run(async () => {
      const reply = await window.gardenDesktop.createBackup(gardenBackupText(progress));
      if (reply.error) throw new Error(reply.error);
      setItems(reply.result); setMessage('备份好了，已经排在下面第一份。');
    });
  }
  function restore(id) {
    return run(async () => {
      const reply = await window.gardenDesktop.restoreBackup(id);
      if (reply.error) throw new Error(reply.error);
      if (reply.result.garden) {
        const incoming = readGardenBackup(reply.result.garden), album = readGardenAlbum(reply.result.garden);
        if (album) writeAlbum(mergeAlbums(readAlbum(), album));
        onImport(current => mergeGardenProgress(current, incoming));
      }
      setMessage(`恢复好了。成绩本合并了 ${reply.result.runs} 条记录，重复的不会重复计分；小成就、贴纸和画册也合并了。`);
    });
  }
  return <div className="garden-backup">
    <button className="quiet-button" disabled={isBusy} onClick={create}><FloppyDisk size={18} />现在备份一份</button>
    {items.map(item => <button className="quiet-button" key={item.id} disabled={isBusy} onClick={() => restore(item.id)}><ClockCounterClockwise size={18} />恢复 {backupName(item.id)} 的备份</button>)}
    <p className="garden-backup-note" role="status">{message}{!items.length && ' 现在还没有备份。'}</p>
  </div>;
}
