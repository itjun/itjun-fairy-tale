export function completedQuests(progress) {
  return {
    rainbow: progress.rainbow === 6,
    garden: progress.flowers.every(step => step === 2),
    treat: progress.served.every(Boolean),
  };
}

export function earnedQuests(progress) {
  const completed = completedQuests(progress);
  return Object.fromEntries(Object.entries(completed).map(([id, isComplete]) => [id, isComplete || progress.achievements?.[id] === true || (progress.miniGames?.[id] ? isMiniComplete(progress.miniGames[id]) : false)]));
}

export function replayQuest(progress, id) {
  if (!completedQuests(progress)[id]) return progress;
  const achievements = earnedQuests(progress);
  if (id === 'rainbow') return { ...progress, achievements, rainbow: 0 };
  if (id === 'garden') return { ...progress, achievements, flowers: [0, 0, 0, 0] };
  if (id === 'treat') return { ...progress, achievements, served: [false, false, false, false] };
  return progress;
}
import { isMiniComplete } from './mini-games/session.js';
