import { describe, expect, it } from 'vitest';
import { loadQuestionDeck, QuestionSequence } from './index';

describe('question sources and session order', () => {
  it('uses an injected source and rejects questions that cannot be presented', async () => {
    const deck = await loadQuestionDeck();
    const replacement = { ...deck, id: 'replacement', questions: [deck.questions.at(-1)!] };
    expect(await loadQuestionDeck({ async load() { return replacement; } })).toEqual(replacement);
    await expect(loadQuestionDeck({ async load() {
      return { ...replacement, questions: [{ ...replacement.questions[0], question: { text: 'Broken' } }] };
    } })).rejects.toThrow();
  });

  it('keeps room cursors independent and stops after the closing question', async () => {
    const deck = await loadQuestionDeck();
    const firstRoom = new QuestionSequence(deck), secondRoom = new QuestionSequence(deck);
    const played = deck.questions.map(() => firstRoom.next());
    expect(secondRoom.next().id).toBe(played[0].id);
    expect(played.at(-1)).toMatchObject({ closing: true, question: { text: 'Same time next week?' } });
    expect(() => firstRoom.next()).toThrow('final question');
    played[0].question.labels[0] = 'Changed in one room';
    expect(deck.questions[0].question.labels[0]).not.toBe('Changed in one room');
  });

  it('rejects duplicate IDs and a closing question before the end', async () => {
    const deck = await loadQuestionDeck();
    await expect(loadQuestionDeck({ async load() {
      return { ...deck, questions: [deck.questions[0], { ...deck.questions.at(-1)!, id: deck.questions[0].id }] };
    } })).rejects.toThrow();
    await expect(loadQuestionDeck({ async load() {
      return { ...deck, questions: [deck.questions.at(-1)!, deck.questions[0]] };
    } })).rejects.toThrow();
  });
});
