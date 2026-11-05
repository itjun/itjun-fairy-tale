const QUEUE_KEY = ['garden', 'scores', 'pending', 'v2'].join('-');
let inFlight;
let memoryQueue = {};
let isStorageAvailable = true;
function readQueue() {
  try { return { ...JSON.parse(localStorage.getItem(QUEUE_KEY) || '{}'), ...memoryQueue }; }
  catch { isStorageAvailable = false; return { ...memoryQueue }; }
}
function writeQueue(queue) {
  memoryQueue = queue;
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)); isStorageAvailable = true; }
  catch { isStorageAvailable = false; }
}
export function pendingCount() { return Object.keys(readQueue()).length; }
export function queueRun(run) {
  const queue = readQueue();
  if (!queue[run.id] || queue[run.id].revision < run.revision) queue[run.id] = run;
  writeQueue(queue);
}
async function send(run, isKeepalive = false) {
  const response = await fetch('/api/runs', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(run), keepalive: isKeepalive, signal: AbortSignal.timeout(5000) });
  if (!response.ok) { let data; try { data = await response.json(); } catch {} throw new Error(data?.error || '本机成绩服务暂时没有连接'); }
  const data = await response.json();
  if (!data.run?.id) throw new Error('成绩服务返回了不完整的记录');
  const queue = readQueue();
  if (queue[run.id]?.revision === run.revision) { delete queue[run.id]; writeQueue(queue); }
  return data.run;
}
export async function flushScores() {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      while (pendingCount()) {
        for (const run of Object.values(readQueue())) await send(run);
      }
      return { isSaved: pendingCount() === 0, message: pendingCount() ? '正在保存最新积分…' : '积分已保存到这台电脑' };
    } catch (error) {
      const reason = error instanceof TypeError || error.name === 'TimeoutError' ? '本机成绩服务暂时没有连接' : error.message;
      return { isSaved: false, message: isStorageAvailable ? `暂未写入成绩本：${reason}。已暂存，连接恢复后补存。` : '积分暂未保存，请保持页面打开并重试。' };
    }
  })();
  try { return await inFlight; } finally { inFlight = null; }
}
export function saveOnLeave(run) { queueRun(run); send(run, true).catch(() => {}); }
