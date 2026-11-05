import { flushScores } from './scores/client.js';

// The game synchronously snapshots its last frame before the queue is drained.
window.gardenDesktop?.onPrepareClose(async token => {
  window.dispatchEvent(new Event('garden:prepare-close'));
  const result = await flushScores();
  window.gardenDesktop.finishClose(token, result.isSaved);
});
