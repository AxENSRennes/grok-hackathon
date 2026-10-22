import { mkdir, appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { RoundResult } from '../shared/protocol.js';

// Completed rounds only. Positions and chat are deliberately ephemeral.
export async function persistResult(result: RoundResult) {
  const directory = resolve(process.env.DATA_DIR || './data');
  await mkdir(directory, { recursive: true });
  await appendFile(resolve(directory, 'rounds.jsonl'), JSON.stringify(result) + '\n', 'utf8');
}
