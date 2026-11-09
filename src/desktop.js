import { flushScores } from './scores/client.js';

// The game synchronously snapshots its last frame before the queue is drained.
window.gardenDesktop?.onPrepareClose(async token => {
  const event = new Event('garden:prepare-close', { cancelable: true });
  window.dispatchEvent(event);
  const result = await flushScores();
  window.gardenDesktop.finishClose(token, result.isSaved && !event.defaultPrevented);
});
