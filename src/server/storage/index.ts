import { resolve } from 'node:path';
import { localQuestionSource } from '../questions/index.js';
import { JsonlRoundResultStore } from './local.js';
import type { BackendStorage } from './contracts.js';

// Server-only composition root: select future database adapters here.
// Never select an adapter from room options or expose its credentials to clients.
export const storage: BackendStorage = {
  roundResults: new JsonlRoundResultStore(resolve(process.env.DATA_DIR || './data')),
  questions: localQuestionSource,
};
