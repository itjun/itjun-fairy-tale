// 游玩时长：只统计游戏真正往前走的时间，暂停、菜单、补给和结算不计入。
export const FLIGHT_PLAYTIME_KEY = 'garden-gun-nac-playtime-v1';
export const SNOW_PLAYTIME_KEY = 'garden-snow-sisters-playtime-v1';
const FLIGHT_SAVE_KEY = 'garden-gun-nac-flight-v1';
const SNOW_SAVE_KEY = 'garden-snow-sisters-v1';
const LOGIC_FPS = 60;

export function formatPlaytime(value) {
  const total = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  const hours = Math.floor(total / 3600), minutes = Math.floor(total % 3600 / 60), seconds = total % 60;
  return hours ? `${hours}小时${minutes}分${seconds}秒` : `${minutes}分${seconds}秒`;
}

export function frameSeconds(frame) {
  return Number.isFinite(frame) && frame > 0 ? Math.floor(frame / LOGIC_FPS) : 0;
}

function whole(value) {
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

export function readLedger(key, storage = localStorage) {
  try {
    const value = JSON.parse(storage.getItem(key));
    if (!value || !Number.isFinite(value.bankedSeconds) || !Number.isFinite(value.sessionSeconds)) return null;
    return { bankedSeconds: whole(value.bankedSeconds), sessionSeconds: whole(value.sessionSeconds) };
  } catch { return null; }
}

function writeLedger(key, ledger, storage) {
  try { storage.setItem(key, JSON.stringify(ledger)); } catch { /* 存储已满时下次保存再补 */ }
}

// 保存时调用：只改写本局秒数，重复保存不会加倍。
export function recordSession(key, seconds, storage = localStorage) {
  const ledger = readLedger(key, storage) || { bankedSeconds: 0, sessionSeconds: 0 };
  writeLedger(key, { ...ledger, sessionSeconds: whole(seconds) }, storage);
}

// 新开一局前调用：先写下当前这局的秒数，再并入累计并清零。
export function bankSession(key, currentSeconds, storage = localStorage) {
  const ledger = readLedger(key, storage) || { bankedSeconds: 0, sessionSeconds: 0 };
  const session = Math.max(ledger.sessionSeconds, whole(currentSeconds));
  writeLedger(key, { bankedSeconds: ledger.bankedSeconds + session, sessionSeconds: 0 }, storage);
}

function savedFrameSeconds(saveKey, storage) {
  try { return frameSeconds(JSON.parse(storage.getItem(saveKey))?.frame); } catch { return 0; }
}

// 成绩本用：没有账本时，用当前存档里的帧数补出本局。
export function totalPlaytime(key, saveKey, storage = localStorage) {
  const ledger = readLedger(key, storage);
  if (ledger) return ledger.bankedSeconds + ledger.sessionSeconds;
  return savedFrameSeconds(saveKey, storage);
}

export const flightPlaytime = (storage = localStorage) => totalPlaytime(FLIGHT_PLAYTIME_KEY, FLIGHT_SAVE_KEY, storage);
export const snowPlaytime = (storage = localStorage) => totalPlaytime(SNOW_PLAYTIME_KEY, SNOW_SAVE_KEY, storage);
