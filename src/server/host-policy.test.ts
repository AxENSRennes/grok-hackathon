import { describe, expect, it } from 'vitest';
import { isHost } from './host-policy';

describe('organizer authorization', () => {
  it.each([null, undefined])('rejects an absent session (%s)', user => {
    expect(isHost(user, 'owner@example.test')).toBe(false);
  });
  it('rejects an anonymous user even with an allowlisted email', () => {
    expect(isHost({ email: 'owner@example.test', isAnonymous: true }, 'owner@example.test')).toBe(false);
  });
  it('does not treat being registered as being an organizer', () => {
    expect(isHost({ email: 'guest@example.test', isAnonymous: false }, 'owner@example.test')).toBe(false);
  });
  it('normalizes case and surrounding allowlist whitespace', () => {
    expect(isHost({ email: 'Owner@Example.Test' }, ' other@example.test, OWNER@example.test , ')).toBe(true);
  });
  it.each(['', ' , , ', 'owner@example.test.attacker.test', 'someowner@example.test'])('does not allow a partial or empty match (%s)', allowed => {
    expect(isHost({ email: 'owner@example.test' }, allowed)).toBe(false);
  });
  it('allows each explicitly provisioned organizer', () => {
    for (const email of ['first@example.test', 'second@example.test']) {
      expect(isHost({ email, isAnonymous: false }, 'first@example.test,second@example.test')).toBe(true);
    }
  });
});
