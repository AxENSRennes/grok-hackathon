import { z } from 'zod';

export const WORLD = { width: 1280, height: 760, left: 60, right: 1220, top: 220, bottom: 706 } as const;
export const TICK_RATE = 60;
export const PATCH_MS = 33;
export const PLAYER_RADIUS = 14;
export const COLORS = ['#16bfff', '#ff369a', '#ffe15a', '#a776f6', '#ff9149', '#25d3ac', '#a9dcf5', '#f6efff'] as const;
export const ACCESSORIES = ['none', 'cap', 'leaf', 'glasses'] as const;
export type Accessory = typeof ACCESSORIES[number];
export type Role = 'host' | 'screen' | 'player';
export const inputSchema = z.object({
  x: z.number().finite().min(-1).max(1), y: z.number().finite().min(-1).max(1),
  seq: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
});
export const appearanceSchema = z.object({
  color: z.number().int().min(0).max(COLORS.length - 1),
  hair: z.number().int().min(0).max(3),
  accessory: z.enum(ACCESSORIES),
});
export const questionSchema = z.object({
  text: z.string().trim().min(3).max(180),
  mode: z.enum(['choice', 'scale']),
  labels: z.array(z.string().trim().min(1).max(36)).min(2).max(4),
  duration: z.number().int().min(10).max(180),
}).superRefine((value, ctx) => {
  if (value.mode === 'scale' && value.labels.length !== 2) ctx.addIssue({ code: 'custom', path: ['labels'], message: 'A scale must have exactly two endpoint labels.' });
});
export const commandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('start'), question: questionSchema }),
  z.object({ action: z.literal('next') }),
  z.object({ action: z.literal('previous') }),
  z.object({ action: z.literal('finish') }),
  z.object({ action: z.literal('lobby') }),
  z.object({ action: z.literal('chat'), enabled: z.boolean() }),
  z.object({ action: z.literal('pause'), paused: z.boolean() }),
]);
export type Question = z.infer<typeof questionSchema>;
export type HostCommand = z.infer<typeof commandSchema>;
export type Input = z.infer<typeof inputSchema>;
export type Appearance = z.infer<typeof appearanceSchema>;
export interface Zone { id: string; label: string; x: number; y: number; width: number; height: number; color: string }
export interface PlayerView extends Appearance {
  id: string; name: string; x: number; y: number; vx: number; vy: number;
  facing: string; jumpAt: number; message: string; messageUntil: number;
  online: boolean; lastSeq: number;
}
export interface RoundResult {
  id: string; roomId: string; question: Question; endedAt: string;
  counts: { id: string; label: string; count: number }[];
  outside: number; participants: number;
}
export interface Snapshot {
  players: PlayerView[]; phase: 'lobby' | 'question' | 'results';
  question: Question | null; zones: Zone[]; result: RoundResult | null;
  endsAt: number; serverTime: number; paused: boolean; chatEnabled: boolean;
  hasPreviousQuestion: boolean; hasNextQuestion: boolean;
}

export function makeZones(question: Question): Zone[] {
  const x = WORLD.left + 30, y = WORLD.top + 25;
  const width = WORLD.right - WORLD.left - 60, height = WORLD.bottom - WORLD.top - 50;
  if (question.mode === 'scale') return Array.from({ length: 5 }, (_, i) => ({
    id: `scale-${i}`, label: i === 0 ? question.labels[0] : i === 4 ? question.labels[1] : `${i + 1} / 5`,
    x: x + i * width / 5, y, width: width / 5, height,
    color: COLORS[[1, 6, 7, 0, 2][i]],
  }));
  const gap = 26, n = question.labels.length;
  const columns = 2, rows = n > 2 ? 2 : 1;
  const zoneWidth = (width - gap) / columns, zoneHeight = (height - gap * (rows - 1)) / rows;
  return question.labels.map((label, i) => ({
    id: `choice-${i}`, label, x: x + (i % 2) * (zoneWidth + gap),
    y: y + Math.floor(i / 2) * (zoneHeight + gap), width: zoneWidth, height: zoneHeight, color: COLORS[i],
  }));
}

export function zoneAt(zones: Zone[], x: number, y: number): Zone | undefined {
  return zones.find(zone => x >= zone.x && x < zone.x + zone.width && y >= zone.y && y < zone.y + zone.height);
}
