import { describe, it, expect } from 'vitest';
import { stepPhysics, SPEED, INPUT_TIMEOUT_MS, type Body } from './physics';
import { WORLD, PLAYER_RADIUS, makeZones, zoneAt } from '../shared/protocol';

const body = (id: string, x = 200, y = 400): Body => ({ id, x, y, vx: 0, vy: 0, online: true, facing: 'down' });
describe('authoritative movement', () => {
  it('normalizes diagonals and bounds speed', () => {
    const p = body('a');
    for (let i = 0; i < 60; i++) stepPhysics([p], new Map([['a', { x: 1, y: 1, at: 1000 }]]), 1 / 60, 1000);
    expect(Math.hypot(p.vx, p.vy)).toBeCloseTo(SPEED, 1);
  });
  it('stops after a controller disappears', () => {
    const p = body('a'); p.vx = SPEED;
    for (let i = 0; i < 60; i++) stepPhysics([p], new Map([['a', { x: 1, y: 0, at: 0 }]]), 1 / 60, INPUT_TIMEOUT_MS + 1 + i * 17);
    expect(Math.abs(p.vx)).toBeLessThan(0.01);
    expect(p.x).toBeLessThan(220);
  });
  it('separates exact overlapping spawns without NaN', () => {
    const a = body('a'), b = body('b');
    for (let i = 0; i < 10; i++) stepPhysics([a, b], new Map(), 1 / 60, 0);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(2 * PLAYER_RADIUS - 0.01);
    expect(Number.isFinite(a.x + a.y + b.x + b.y)).toBe(true);
  });
  it('keeps a crowded group inside the map', () => {
    const players = Array.from({ length: 60 }, (_, i) => body(String(i), 100 + (i % 10) * 40, 300 + Math.floor(i / 10) * 35));
    for (let tick = 0; tick < 300; tick++) {
      const inputs = new Map(players.map(p => [p.id, { x: 1, y: -1, at: tick * 17 }]));
      stepPhysics(players, inputs, 1 / 60, tick * 17);
    }
    for (const p of players) {
      expect(p.x).toBeGreaterThanOrEqual(WORLD.left + PLAYER_RADIUS);
      expect(p.x).toBeLessThanOrEqual(WORLD.right - PLAYER_RADIUS);
      expect(p.y).toBeGreaterThanOrEqual(WORLD.top + PLAYER_RADIUS);
      expect(p.y).toBeLessThanOrEqual(WORLD.bottom - PLAYER_RADIUS);
      expect(Math.hypot(p.vx, p.vy)).toBeLessThanOrEqual(SPEED * 1.15 + 0.01);
    }
  });
});
describe('spatial votes', () => {
  it('counts shared boundaries once and leaves outside positions and multiple-choice corridors neutral', () => {
    const zones = makeZones({ text: 'A question', mode: 'scale', labels: ['Yes', 'No'], duration: 20 });
    expect(zoneAt(zones, zones[1].x, zones[1].y + 20)?.id).toBe('scale-1');
    expect(zoneAt(zones, 0, 0)).toBeUndefined();
    const choices = makeZones({ text: 'A question', mode: 'choice', labels: ['A', 'B', 'C', 'D'], duration: 20 });
    expect(zoneAt(choices, choices[0].x + choices[0].width + 10, choices[0].y + 50)).toBeUndefined();
  });
});
