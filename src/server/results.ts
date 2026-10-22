import type { RoundResult } from '../shared/protocol.js';
import { storage } from './storage/index.js';

// Completed rounds only. Positions and chat are deliberately ephemeral.
export async function persistResult(result: RoundResult) {
  // Defer adapter execution so even a synchronous adapter error becomes a rejection.
  await Promise.resolve().then(() => storage.roundResults.save(result));
}
