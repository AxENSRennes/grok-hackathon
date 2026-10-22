import { describe, expect, it } from 'vitest';
import { appearanceSchema, commandSchema, inputSchema, makeZones, questionSchema, WORLD, zoneAt, type Question } from './protocol';

const question: Question = { text: 'Which workshop?', mode: 'choice', labels: ['Agents', 'Robotics'], duration: 30 };
describe('untrusted controller input', () => {
  it.each([
    { x: NaN, y: 0, seq: 0 }, { x: 0, y: Infinity, seq: 0 },
    { x: 1.01, y: 0, seq: 0 }, { x: 0, y: -1.01, seq: 0 },
    { x: 0, y: 0, seq: -1 }, { x: 0, y: 0, seq: 0.5 },
    { x: 0, y: 0, seq: Number.MAX_SAFE_INTEGER + 1 },
  ])('rejects malformed movement %#', input => expect(inputSchema.safeParse(input).success).toBe(false));
  it.each([
    { color: 8, hair: 0, accessory: 'none' },
    { color: 0, hair: 4, accessory: 'none' },
    { color: 0, hair: 0, accessory: 'admin' },
  ])('rejects invalid avatar choices %#', input => expect(appearanceSchema.safeParse(input).success).toBe(false));
});
describe('question and command validation', () => {
  it.each([
    { text: '  ' }, { text: 'x'.repeat(181) }, { labels: ['Only one'] },
    { labels: ['A', 'B', 'C', 'D', 'E'] }, { labels: ['A', '  '] },
    { duration: 9 }, { duration: 181 }, { duration: 10.5 },
    { mode: 'scale', labels: ['A', 'B', 'C'] },
  ])('rejects questions that cannot be safely presented %#', invalid => {
    expect(questionSchema.safeParse({ ...question, ...invalid }).success).toBe(false);
  });
  it.each([{ action: 'start' }, { action: 'pause', paused: 'false' }, { action: 'chat', enabled: 1 }, { action: 'delete-all' }])('rejects malformed commands %#', command => {
    expect(commandSchema.safeParse(command).success).toBe(false);
  });
});
describe('spatial answers', () => {
  it.each([2, 3, 4])('keeps %i choice targets disjoint and inside the playable world', count => {
    const zones = makeZones({ ...question, labels: ['A', 'B', 'C', 'D'].slice(0, count) });
    expect(zones).toHaveLength(count);
    for (const zone of zones) {
      expect(zone.x).toBeGreaterThanOrEqual(WORLD.left);
      expect(zone.y).toBeGreaterThanOrEqual(WORLD.top);
      expect(zone.x + zone.width).toBeLessThanOrEqual(WORLD.right);
      expect(zone.y + zone.height).toBeLessThanOrEqual(WORLD.bottom);
      expect(zoneAt(zones, zone.x + zone.width / 2, zone.y + zone.height / 2)?.id).toBe(zone.id);
      for (const other of zones.filter(z => z !== zone)) {
        const overlapX = zone.x < other.x + other.width && other.x < zone.x + zone.width;
        const overlapY = zone.y < other.y + other.height && other.y < zone.y + zone.height;
        expect(overlapX && overlapY).toBe(false);
      }
    }
  });
  it('assigns every internal scale boundary to exactly one answer', () => {
    const zones = makeZones({ ...question, mode: 'scale' });
    for (const zone of zones) expect(zoneAt(zones, zone.x, zone.y + 10)?.id).toBe(zone.id);
    const last = zones.at(-1)!;
    expect(zoneAt(zones, last.x + last.width, last.y + 10)).toBeUndefined();
  });
  it.each([[NaN, 300], [300, Infinity], [-1, -1]])('keeps invalid or outside coordinates neutral (%s, %s)', (x, y) => {
    expect(zoneAt(makeZones(question), x, y)).toBeUndefined();
  });
});
