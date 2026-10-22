import { PLAYER_RADIUS as R, WORLD } from '../shared/protocol.js';

export interface Body {
  id: string; x: number; y: number; vx: number; vy: number; online: boolean;
  facing: string;
}
export interface HeldInput { x: number; y: number; at: number }
export const SPEED = 190;
export const INPUT_TIMEOUT_MS = 450;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function stepPhysics(players: Body[], inputs: Map<string, HeldInput>, dt: number, now: number) {
  const active = players.filter(p => p.online);
  for (const p of active) {
    const input = inputs.get(p.id);
    let ix = input && now - input.at <= INPUT_TIMEOUT_MS ? input.x : 0;
    let iy = input && now - input.at <= INPUT_TIMEOUT_MS ? input.y : 0;
    const length = Math.hypot(ix, iy);
    if (length > 1) { ix /= length; iy /= length; }
    const blend = 1 - Math.exp(-18 * dt);
    p.vx += (ix * SPEED - p.vx) * blend;
    p.vy += (iy * SPEED - p.vy) * blend;
    if (length > 0) p.facing = Math.abs(ix) > Math.abs(iy) ? (ix < 0 ? 'left' : 'right') : (iy < 0 ? 'up' : 'down');
    p.x += p.vx * dt; p.y += p.vy * dt;
    constrain(p);
  }
  // Equal mass, bounded impulses: nobody can accumulate an unstoppable shove.
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) {
      const a = active[i], b = active[j];
      let dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy);
      if (distance >= 2 * R) continue;
      if (distance < 0.001) { dx = a.id < b.id ? 1 : -1; dy = 0; distance = 1; }
      const nx = dx / distance, ny = dy / distance;
      const correction = Math.min(2 * R - distance, R) * 0.5;
      a.x -= nx * correction; a.y -= ny * correction;
      b.x += nx * correction; b.y += ny * correction;
      if (pass === 0) {
        const approach = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        const impulse = clamp(approach * 0.25, 0, 45);
        a.vx -= nx * impulse; a.vy -= ny * impulse;
        b.vx += nx * impulse; b.vy += ny * impulse;
      }
      constrain(a); constrain(b);
    }
  }
}
function constrain(p: Body) {
  p.x = clamp(p.x, WORLD.left + R, WORLD.right - R);
  p.y = clamp(p.y, WORLD.top + R, WORLD.bottom - R);
  const speed = Math.hypot(p.vx, p.vy);
  if (speed > SPEED * 1.15) { p.vx *= SPEED * 1.15 / speed; p.vy *= SPEED * 1.15 / speed; }
}
