import type { Appearance } from '../shared/protocol';
import { COLORS } from '../shared/protocol';

export const AVATAR_SIZE = 48;
export interface AvatarPose { facing?: string; step?: number }
function shade(hex: string, amount: number) {
  const rgb = parseInt(hex.slice(1), 16);
  return `rgb(${[16, 8, 0].map(shift => Math.max(0, Math.min(255, ((rgb >> shift) & 255) + amount))).join(',')})`;
}

// One pixel-layer renderer supplies the selector, controller and arena poses.
export function drawAvatar(ctx: CanvasRenderingContext2D, appearance: Appearance, pose: AvatarPose = {}) {
  ctx.clearRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  ctx.save(); ctx.imageSmoothingEnabled = false;
  const facing = pose.facing || 'down', side = facing === 'left' || facing === 'right', back = facing === 'up';
  if (facing === 'left') { ctx.translate(48, 0); ctx.scale(-1, 1); }
  const step = pose.step === 1 ? -1 : pose.step === 2 ? 1 : 0;
  const ink = '#0b102e', skin = ['#edb384', '#f4cfaa', '#a96749', '#cf936e'][appearance.hair];
  const hair = ['#382334', '#e6b65e', '#262033', '#63323f'][appearance.hair], shirt = COLORS[appearance.color];
  const rect = (color: string, x: number, y: number, w: number, h: number) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
  const shape = (color: string, points: number[][]) => {
    ctx.fillStyle = color; ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill();
  };
  for (const [x, phase] of [[14, step], [26, -step]]) {
    rect(ink, x - 1, 38 + phase, 11, 9); rect('#242645', x + 1, 38 + phase, 7, 4);
    rect('#edf6ff', x, 43 + phase, 9, 3); rect(shirt, x, 46 + phase, 9, 1);
  }
  shape(ink, [[14, 27], [32, 27], [32, 29], [36, 29], [36, 34], [38, 34], [38, 41], [33, 41], [33, 43], [13, 43], [13, 40], [9, 40], [9, 32], [12, 32], [12, 29], [14, 29]]);
  rect(shade(shirt, -48), 14, 30, 20, 11); rect(shirt, 14, 29, 17, 10);
  rect(shade(shirt, 26), 15, 30, 3, 8); rect(shade(shirt, -25), 17, 39, 14, 2);
  rect(shirt, 11, 31 + Math.max(0, step), 5, 6); rect(shirt, 32, 31 + Math.max(0, -step), 4, 6);
  rect(skin, 11, 37 + Math.max(0, step), 4, 3); rect(skin, 33, 37 + Math.max(0, -step), 3, 3);
  if (back) { rect(shade(shirt, -60), 16, 28, 15, 5); rect(shirt, 18, 28, 11, 3); }
  else {
    rect(ink, side ? 28 : 21, 29, side ? 4 : 6, 2); rect('#def7ff', side ? 28 : 20, 31, 1, 5);
    if (!side) rect('#def7ff', 27, 31, 1, 5);
    rect(shade(shirt, -55), 20, 37, 9, 1);
  }
  shape(ink, [[14, 3], [19, 3], [19, 1], [25, 1], [25, 3], [31, 3], [31, 6], [35, 6], [35, 10], [38, 10], [38, 23], [35, 23], [35, 27], [31, 27], [31, 30], [16, 30], [16, 28], [11, 28], [11, 24], [8, 24], [8, 13], [10, 13], [10, 8], [14, 8]]);
  rect(shade(skin, -34), 13, 14, 21, 13); rect(skin, 14, 14, 19, 12); rect(shade(skin, 20), 15, 15, 15, 7);
  rect(skin, 10, 20, 4, 5); rect(skin, 33, 20, 4, 4); rect(shade(skin, -18), 14, 25, 19, 3);
  if (appearance.hair === 2) {
    for (const [x, y, w, h] of [[9, 8, 7, 13], [11, 4, 9, 14], [17, 2, 10, 15], [25, 4, 9, 14], [32, 8, 6, 14], [7, 13, 6, 11]]) {
      rect(ink, x - 1, y - 1, w + 2, h + 2); rect(hair, x, y, w, h); rect(shade(hair, 19), x + 1, y + 1, 3, 3);
    }
    rect(hair, 11, 11, 25, 7); rect(hair, 14, 17, 4, 4); rect(hair, 24, 16, 4, 3);
  } else if (appearance.hair === 3) {
    rect(ink, 20, 0, 11, 7); rect(hair, 22, 1, 7, 5);
    shape(hair, [[14, 7], [17, 4], [30, 4], [34, 8], [36, 15], [32, 19], [28, 17], [25, 20], [22, 16], [17, 20], [13, 22], [10, 18], [11, 12]]);
    rect(shade(hair, 25), 17, 6, 12, 3);
  } else {
    shape(hair, [[11, 13], [14, 13], [14, 8], [18, 8], [18, 5], [21, 5], [21, 3], [24, 3], [24, 6], [29, 5], [29, 8], [33, 8], [33, 11], [36, 11], [36, 18], [32, 18], [32, 16], [28, 16], [28, 13], [25, 13], [25, 17], [21, 17], [21, 20], [17, 20], [17, 23], [12, 23], [12, 20], [10, 20]]);
    rect(shade(hair, 19), 17, 9, 6, 3); rect(shade(hair, 19), 25, 7, 4, 3); rect(shade(hair, -12), 12, 17, 5, 5);
  }
  if (back) { rect(hair, 12, 15, 23, 11); rect(hair, 16, 25, 15, 3); rect(shade(hair, 13), 17, 18, 9, 3); }
  else if (side) { rect(skin, 29, 17, 5, 7); rect(skin, 33, 21, 4, 3); rect(ink, 30, 19, 2, 4); rect('#fff1d6', 33, 25, 2, 1); }
  else {
    rect(ink, 17, 20, 3, 5); rect(ink, 28, 20, 3, 5); rect('#fff1d6', 24, 26, 3, 1);
    rect(shade(skin, -24), 14, 24, 3, 1); rect(shade(skin, -24), 32, 24, 2, 1);
  }
  if (appearance.accessory === 'cap') {
    rect(ink, 12, 5, 23, 8); rect('#eaf5ff', 14, 5, 15, 6); rect(shirt, 29, 6, 5, 6); rect(shirt, side ? 28 : 24, 12, 14, 3);
  }
  if (appearance.accessory === 'leaf') { rect(ink, 23, 0, 3, 6); rect('#ffe256', 25, 0, 5, 3); rect('#19c6a1', 21, 1, 4, 3); }
  if (appearance.accessory === 'glasses' && !back) {
    if (side) { rect(ink, 28, 18, 6, 7); rect('#7fe7ff', 30, 19, 3, 3); }
    else { rect(ink, 15, 18, 8, 8); rect(ink, 26, 18, 8, 8); rect(ink, 22, 20, 5, 2); rect('#78d5ee', 17, 20, 4, 3); rect('#78d5ee', 28, 20, 4, 3); }
  }
  ctx.restore();
}
