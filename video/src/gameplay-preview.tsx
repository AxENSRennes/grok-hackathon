import React, {useLayoutEffect, useRef} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {AVATAR_SIZE, AVATAR_FOOT_Y, drawAvatar} from '../../src/client/avatars';
import {drawArcadeQuestion, drawArcadeRoom} from '../../src/client/arcadeArt';
import {makeZones, questionSchema, zoneAt, type Appearance} from '../../src/shared/protocol';
import {stepPhysics, type Body} from '../../src/server/physics';
import bank from '../../src/server/questions/hackathon.en.json';

// Scripted inputs run through the game's real movement and collision solver.
// The film is a deterministic local simulation, not a live multiplayer recording.
const FPS = 30;
const DURATION = 900;
const COUNT = 28;
const rounds = [bank.questions[2].question, bank.questions[4].question, bank.questions[5].question].map(question => questionSchema.parse(question));
const appearances: Appearance[] = Array.from({length: COUNT}, (_, i) => ({
  color: i % 8, hair: (i * 3) % 4,
  accessory: (['none', 'cap', 'none', 'glasses', 'leaf'] as const)[i % 5],
}));
const spawnAt = (i: number) => 12 + i * 3;
const roundAt = (f: number) => f < 120 ? -1 : f < 390 ? 0 : f < 660 ? 1 : 2;
const roundStart = (r: number) => [120, 390, 660][r];
const assignment = (i: number, r: number) => (i * [1, 3, 1][r] + Math.floor(i / 4) + r) % 4;

type Actor = Body & {index: number; born: number};
function simulate() {
  const bodies: Actor[] = Array.from({length: COUNT}, (_, i) => ({
    id: `actor-${String(i).padStart(2, '0')}`, index: i, born: spawnAt(i),
    x: 355 + (i % 7) * 92, y: 468 + Math.floor(i / 7) * 48,
    vx: 0, vy: 0, facing: 'down', online: false,
  }));
  const frames: Actor[][] = [];
  for (let f = 0; f < DURATION; f++) {
    const r = roundAt(f), age = r < 0 ? f : f - roundStart(r);
    for (let sub = 0; sub < 2; sub++) {
      const now = (f * 2 + sub) * 1000 / 60;
      const inputs = new Map();
      for (const actor of bodies) {
        actor.online = f >= actor.born;
        if (!actor.online) continue;
        const i = actor.index;
        let tx = 340 + (i % 7) * 95, ty = 465 + Math.floor(i / 7) * 48;
        if (r >= 0) {
          const group = assignment(i, r), zone = makeZones(rounds[r])[group];
          const members = bodies.filter(p => assignment(p.index, r) === group);
          const rank = members.indexOf(actor);
          tx = zone.x + zone.width / 2 + ((rank % 4) - 1.5) * 58;
          ty = zone.y + 115 + Math.floor(rank / 4) * 47;
          // Crossing through the centre creates visible, bounded contact.
          if (r > 0 && age < 35 + (i % 4) * 5) {
            tx = 620 + (i % 3) * 18; ty = 462 + (i % 4) * 17;
          }
          if (age < (i % 7) * 3) {tx = actor.x; ty = actor.y;}
        }
        const dx = tx - actor.x, dy = ty - actor.y, distance = Math.hypot(dx, dy);
        const speed = Math.min(1, distance / 22);
        inputs.set(actor.id, {x: distance > 3 ? dx / distance * speed : 0, y: distance > 3 ? dy / distance * speed : 0, at: now});
      }
      stepPhysics(bodies, inputs, 1 / 60, now);
    }
    frames.push(bodies.filter(p => p.online).map(p => ({...p})));
  }
  return frames;
}
const simulation = simulate();
const spriteCache = new Map<string, HTMLCanvasElement>();
function sprite(actor: Actor, step: number) {
  const key = `${actor.index}:${actor.facing}:${step}`;
  if (!spriteCache.has(key)) {
    const canvas = document.createElement('canvas'); canvas.width = AVATAR_SIZE; canvas.height = AVATAR_SIZE;
    drawAvatar(canvas.getContext('2d')!, appearances[actor.index], {facing: actor.facing, step});
    spriteCache.set(key, canvas);
  }
  return spriteCache.get(key)!;
}
function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number) {
  const lines: string[] = [];
  for (const word of text.toUpperCase().split(' ')) {
    const last = lines.at(-1);
    if (last && ctx.measureText(last + ' ' + word).width < max) lines[lines.length - 1] += ' ' + word;
    else lines.push(word);
  }
  lines.forEach((line, i) => ctx.fillText(line, x, y + i * 26));
}
export function GameplayPreview() {
  const frame = useCurrentFrame(), ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current!.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    drawArcadeRoom(ctx);
    const r = roundAt(frame), age = r < 0 ? frame : frame - roundStart(r);
    const actors = simulation[frame], zones = r < 0 ? [] : makeZones(rounds[r]);
    // The question renderer clears its own transparent layer.
    const board = document.createElement('canvas'); board.width = 1280; board.height = 190;
    drawArcadeQuestion(board.getContext('2d')!, r < 0 ? 'SIDEQUEST LIVE. SCAN. SPAWN. PLAY.' : rounds[r].text);
    ctx.drawImage(board, 0, 0);
    const settled = r >= 0 && age > 205;
    for (const zone of zones) {
      const alpha = Math.min(1, age / 12);
      ctx.globalAlpha = alpha * .13; ctx.fillStyle = zone.color; ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
      ctx.globalAlpha = alpha; ctx.strokeStyle = zone.color; ctx.lineWidth = 4; ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
      for (const x of [zone.x, zone.x + zone.width - 22]) for (const y of [zone.y, zone.y + zone.height - 4]) ctx.fillRect(x, y, 22, 4);
      ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#f1f5ff';
      wrap(ctx, zone.label, zone.x + zone.width / 2, zone.y + 34, zone.width - 30);
      if (settled) {
        const count = actors.filter(a => zoneAt(zones, a.x, a.y)?.id === zone.id).length;
        ctx.fillStyle = zone.color; ctx.fillRect(zone.x + zone.width - 61, zone.y + zone.height - 46, 49, 34);
        ctx.fillStyle = '#0b102e'; ctx.font = 'bold 25px monospace'; ctx.fillText(String(count), zone.x + zone.width - 36, zone.y + zone.height - 20);
      }
    }
    ctx.globalAlpha = 1;
    for (const actor of [...actors].sort((a, b) => a.y - b.y)) {
      const bornAge = frame - actor.born;
      const pop = Math.min(1, bornAge / 8);
      const jumpAge = (frame - 170 - actor.index * 3) % 270;
      const jump = jumpAge >= 0 && jumpAge < 19 ? Math.sin(jumpAge / 19 * Math.PI) * 38 : 0;
      const moving = Math.hypot(actor.vx, actor.vy) > 15;
      const step = moving ? [0, 1, 0, 2][Math.floor(frame / 4) % 4] : 0;
      const scale = 3, size = AVATAR_SIZE * scale;
      ctx.fillStyle = '#080d2477'; ctx.beginPath(); ctx.ellipse(actor.x, actor.y + 1, 19 * pop, 5, 0, 0, 2 * Math.PI); ctx.fill();
      if (bornAge < 16) {
        ctx.strokeStyle = appearances[actor.index].color % 2 ? '#ff369a' : '#16bfff';
        ctx.globalAlpha = 1 - bornAge / 16; ctx.lineWidth = 3;
        ctx.strokeRect(actor.x - 15 - bornAge, actor.y - 6 - bornAge / 3, 30 + bornAge * 2, 12 + bornAge * 2 / 3); ctx.globalAlpha = 1;
      }
      ctx.globalAlpha = pop;
      ctx.drawImage(sprite(actor, step), Math.round(actor.x - size / 2), Math.round(actor.y - AVATAR_FOOT_Y * scale - jump), size, size);
      ctx.globalAlpha = 1;
    }
    if (r === 0 && age > 100 && age < 170) {
      const a = actors[7];
      ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = '#f1f5ff'; ctx.fillRect(a.x - 98, a.y - 116, 196, 32); ctx.fillRect(a.x - 3, a.y - 84, 7, 7);
      ctx.fillStyle = '#0b102e'; ctx.fillText('one last deploy...', a.x, a.y - 94);
    }
    ctx.fillStyle = '#090e27'; ctx.fillRect(0, 760, 1280, 40);
    ctx.font = '16px monospace'; ctx.textAlign = 'left'; ctx.fillStyle = '#aebbd5';
    ctx.fillText('CHOREOGRAPHED PREVIEW / GAME AVATARS + MOVEMENT + COLLISIONS', 24, 786);
    ctx.textAlign = 'right'; ctx.fillStyle = '#17cafa';
    ctx.fillText(r < 0 ? 'JOIN THE ROOM' : settled ? 'FINAL POSITIONS COUNT' : 'MOVE TO ANSWER', 1255, 786);
  }, [frame]);
  return <AbsoluteFill style={{background: '#090e27'}}><canvas ref={ref} width={1280} height={800}/></AbsoluteFill>;
}
