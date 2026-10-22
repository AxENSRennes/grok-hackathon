import { z } from 'zod';
import { questionSchema } from '../../shared/protocol.js';
import hackathon from './hackathon.en.json';

const deckSchema = z.object({
  id: z.string().trim().min(1),
  questions: z.array(z.object({
    id: z.string().trim().min(1),
    closing: z.boolean().default(false),
    question: questionSchema,
  })).min(1),
}).superRefine((deck, ctx) => {
  const ids = new Set<string>();
  deck.questions.forEach((entry, index) => {
    if (ids.has(entry.id)) ctx.addIssue({ code: 'custom', path: ['questions', index, 'id'], message: 'Question IDs must be unique.' });
    ids.add(entry.id);
    if (entry.closing !== (index === deck.questions.length - 1)) {
      ctx.addIssue({ code: 'custom', path: ['questions', index, 'closing'], message: 'Only the final question must be marked as closing.' });
    }
  });
});

export type QuestionDeck = z.infer<typeof deckSchema>;

// Future database or AI adapters return the same payload. Validate it before play.
export interface QuestionSource {
  load(): Promise<unknown>;
}

export const localQuestionSource: QuestionSource = {
  async load() { return hackathon; },
};

export async function loadQuestionDeck(source: QuestionSource = localQuestionSource): Promise<QuestionDeck> {
  return deckSchema.parse(await source.load());
}

export class QuestionSequence {
  private index = -1;

  constructor(private readonly deck: QuestionDeck) {}

  get hasPrevious() { return this.index > 0; }
  get hasNext() { return this.index < this.deck.questions.length - 1; }

  next() {
    if (!this.hasNext) throw new Error('The final question has already been played.');
    this.index++;
    return structuredClone(this.deck.questions[this.index]);
  }

  previous() {
    if (!this.hasPrevious) throw new Error('There is no previous question.');
    this.index--;
    return structuredClone(this.deck.questions[this.index]);
  }
}
