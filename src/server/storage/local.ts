import { mkdir, appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { RoundResult } from '../../shared/protocol.js';
import type { RoundResultStore } from './contracts.js';

export class JsonlRoundResultStore implements RoundResultStore {
  constructor(private readonly directory: string) {}

  async save(result: RoundResult) {
    await mkdir(this.directory, { recursive: true });
    await appendFile(resolve(this.directory, 'rounds.jsonl'), JSON.stringify(result) + '\n', 'utf8');
  }
}
