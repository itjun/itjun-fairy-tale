import { useSyncExternalStore } from 'react';

// 难度只在出发前选。轻松是默认档，标准等于改版前的数值。
export const DIFFICULTIES = Object.freeze({
  easy: { name: '轻松', hint: '受伤减半，预告更久，掉坑不扣血', damage: 0.5, warning: 0.6, isFallFree: true, isExtraWave: false, rarityBonus: 0 },
  normal: { name: '标准', hint: '按原来的数值闯关', damage: 1, warning: 0, isFallFree: false, isExtraWave: false, rarityBonus: 0 },
  hard: { name: '挑战', hint: '战斗房多一波，会混进精英，好奖励更容易出', damage: 1, warning: 0, isFallFree: false, isExtraWave: true, rarityBonus: 0.2 },
});
export const DEFAULT_DIFFICULTY = 'easy';
export function difficultyOf(id) { return DIFFICULTIES[id] || DIFFICULTIES.normal; }

const KEY = 'garden-play-settings-v1';
const listeners = new Set();
let settings = { difficulty: DEFAULT_DIFFICULTY, isHelpOn: true };
try {
  const saved = JSON.parse(localStorage.getItem(KEY));
  if (saved) settings = { difficulty: DIFFICULTIES[saved.difficulty] ? saved.difficulty : DEFAULT_DIFFICULTY, isHelpOn: saved.isHelpOn !== false };
} catch { /* 读不到设置时用默认值，不影响游玩。 */ }
export const getPlaySettings = () => settings;
export function setPlaySettings(patch) {
  settings = { ...settings, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* 这次没存上，本次游玩仍按新设置。 */ }
  listeners.forEach(listener => listener());
}
function subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
export function usePlaySettings() { return useSyncExternalStore(subscribe, getPlaySettings); }
