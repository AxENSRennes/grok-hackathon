import type { Appearance } from '../shared/protocol';
import { COLORS } from '../shared/protocol';

// Temporary code-native sprites. Replace this renderer with the selected sprite atlas.
export function drawAvatar(ctx: CanvasRenderingContext2D, appearance: Appearance) {
  ctx.clearRect(0, 0, 24, 32);
  const rect = (color: string, x: number, y: number, w: number, h: number) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
  const dark = '#283d35', skin = ['#f1ccac', '#d8a27b', '#af7657', '#7c5141'][appearance.hair];
  rect(dark, 5, 5, 14, 23); rect(dark, 3, 8, 18, 15);
  rect(COLORS[appearance.color], 5, 16, 14, 11);
  rect(skin, 5, 7, 14, 12); rect(skin, 3, 18, 3, 6); rect(skin, 18, 18, 3, 6);
  rect(['#564237', '#a77042', '#33333c', '#d7b37d'][appearance.hair], 5, 5, 14, 4);
  rect(dark, 8, 12, 2, 3); rect(dark, 15, 12, 2, 3);
  rect(dark, 6, 27, 5, 3); rect(dark, 14, 27, 5, 3);
  if (appearance.accessory === 'cap') { rect('#688cce', 4, 3, 15, 4); rect('#688cce', 16, 6, 6, 2); }
  if (appearance.accessory === 'leaf') { rect('#6f9c68', 11, 1, 3, 5); rect('#86b880', 14, 0, 5, 3); }
  if (appearance.accessory === 'glasses') { rect(dark, 6, 11, 6, 5); rect(skin, 8, 12, 2, 2); rect(dark, 13, 11, 6, 5); rect(skin, 15, 12, 2, 2); rect(dark, 11, 12, 2, 1); }
}
