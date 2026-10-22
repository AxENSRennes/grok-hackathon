import type { Appearance, Accessory } from '../shared/protocol';
import pixels from './avatar-pixels.json';

// The approved 24-cell character has padding for accessories and moving feet.
export const AVATAR_SIZE = 32;
export const AVATAR_FOOT_Y = 28;
export interface AvatarPose { facing?: string; step?: number }
type Grid = string[][];
const clothing = [
  ['#16bfff', '#0789c9', '#75ddff'], ['#ff359f', '#c61674', '#ff86c7'],
  ['#ffe256', '#c9a936', '#fff3a3'], ['#ac7afa', '#754bb8', '#d7b7ff'],
  ['#ff8d43', '#ce572b', '#ffc184'], ['#25d3ac', '#138969', '#8ff5cf'],
  ['#a9dcf5', '#5c9cbf', '#d4efff'], ['#f6efff', '#bcb0d4', '#ffffff'],
];
const accessoryPalette: Record<string, string> = { '#': '#0b102e', w: '#edf6ff', c: '#16bfff', a: '#75ddff', y: '#ffe256', g: '#32cd98', b: '#138969', p: '#ff359f', d: '#c61674' };
const emptyGrid = (): Grid => Array.from({ length: AVATAR_SIZE }, () => Array<string>(AVATAR_SIZE).fill('.'));

function stamp(grid: Grid, rows: string[], x: number, y: number) {
  rows.forEach((row, dy) => [...row].forEach((cell, dx) => {
    if (cell !== '.' && grid[y + dy]?.[x + dx] !== undefined) grid[y + dy][x + dx] = cell;
  }));
}

function head(hair: number, facing: string): string[] {
  const front = pixels.heads[hair] || pixels.heads[0];
  if (facing === 'down') return front;
  if (hair === 0) return (facing === 'up' ? pixels.back : pixels.right).slice(0, 14);
  if (facing === 'up') return front.map((row, y) => [...row].map((cell, x) => {
    if ('sdw'.includes(cell)) return y === 10 && (x === 2 || x === 13) ? 's' : 'h';
    if (y >= 7 && cell !== '.' && cell !== '#') return y === 10 && (x === 2 || x === 13) ? 's' : 'h';
    if (y >= 7 && cell === '#' && x > 3 && x < 12) return 'h';
    return cell;
  }).join(''));
  // Retain each crown and adapt the face to the shared profile.
  return front.slice(0, 7).map(row => row.replace(/[sdw]/g, 'h')).concat(pixels.right.slice(7, 14).map((row, i) => {
    if (hair !== 4) return row;
    const cells = [...row];
    if (i < 6) { cells[1] = '#'; cells[2] = 'h'; cells[3] = 'h'; }
    return cells.join('');
  }));
}

function addAccessory(grid: Grid, accessory: Accessory, facing: string) {
  const side = facing === 'right', back = facing === 'up';
  switch (accessory) {
    case 'cap':
      stamp(grid, back ? ['...########...', '..#wwwwcccc#..', '.#wwwwwccccc#.', '.#wwwwwccccc#.', '.############.', '....#wwww#....'] : side
        ? ['...########...', '..#wwwwcccc#..', '.#wwwwwccccc#.', '.#wwwwwccccc#.', '.############.', '.........#cccc#', '..........####.']
        : ['...########...', '..#wwwwcccc#..', '.#wwwwwccccc#.', '.#wwwwwccccc#.', '.############.', '......#cccccc#', '.......######.'], 9, 5);
      break;
    case 'leaf': stamp(grid, ['.##...##.', '#gg#.#gg#', '#gb#.#bg#', '.###b###.', '...#b#...', '...###...'], 12, 0); break;
    case 'headphones':
      stamp(grid, side ? ['....#####...', '...#yyyyy#..', '..#yy#####..', '..#y#.......', '..#y###.....', '..#yyyy#....', '..#ywwy#....', '..#yyyy#....', '...####.....']
        : ['....########....', '...#yyyyyyyy#...', '..#yy######yy#..', '..#y#......#y#..', '.##y#......#y##.', '#yy##......##yy#', '#yw#........#wy#', '#yy#........#yy#', '.##..........##.'], 8, 7);
      break;
    case 'glasses':
      if (!back) stamp(grid, side ? ['########', '...#waa#', '...#aaa#', '....###.'] : ['.#####.#####.', '#waa#####aaw#', '#aaa#...#aaa#', '.###.....###.'], side ? 15 : 9, 13);
      break;
    case 'bow': stamp(grid, ['##.....##', '#p#...#p#', '#pp###pp#', '#pd#y#dp#', '#p#####p#', '##.....##'], side || back ? 8 : 16, 5); break;
    case 'scarf':
      stamp(grid, back ? ['##########', '#ywywywyw#', '##########'] : side ? ['########', '#ywywyw#', '#####yw#', '....#yw#', '....####'] : ['##########', '#ywywywyw#', '#######yw#', '......#yw#', '......####'], side ? 12 : 11, 18);
      break;
  }
}

// All rendering comes from cells: no vector paths, smoothing or fractional pixels.
export function drawAvatar(ctx: CanvasRenderingContext2D, appearance: Appearance, pose: AvatarPose = {}) {
  const facing = pose.facing === 'left' ? 'right' : ['up', 'right'].includes(pose.facing || '') ? pose.facing! : 'down';
  const grid = emptyGrid();
  const body = facing === 'up' ? pixels.back : facing === 'right' ? pixels.right : pixels.front;
  stamp(grid, head(appearance.hair, facing).concat(body.slice(14)), 8, 4);
  if (pose.step === 1 || pose.step === 2) {
    const source = grid.map(row => [...row]);
    const left = facing === 'right' ? 12 : 11;
    const right = facing === 'right' ? 21 : 20;
    for (let y = 25; y <= 28; y++) for (let x = left; x <= right; x++) grid[y][x] = '.';
    for (let y = 25; y < 28; y++) for (let x = left; x <= right; x++) {
      const split = facing === 'right' ? 17 : 16;
      const dy = (x < split ? -1 : 1) * (pose.step === 1 ? 1 : -1);
      if (source[y][x] !== '.') grid[y + dy][x] = source[y][x];
    }
  }
  const [c, b, a] = clothing[appearance.color] || clothing[0];
  const palette: Record<string, unknown> = { ...(pixels.palettes[appearance.hair] || pixels.palettes[0]), c, b, a };
  for (const item of new Set([appearance.accessory, appearance.accessory2 || 'none'])) {
    const overlay = emptyGrid();
    addAccessory(overlay, item, facing);
    overlay.forEach((row, y) => row.forEach((cell, x) => {
      if (cell !== '.') { grid[y][x] = `accessory-${cell}`; palette[`accessory-${cell}`] = accessoryPalette[cell]; }
    }));
  }
  ctx.clearRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  ctx.save(); ctx.imageSmoothingEnabled = false;
  grid.forEach((row, y) => row.forEach((cell, x) => {
    if (cell !== '.') { ctx.fillStyle = palette[cell] as string; ctx.fillRect(pose.facing === 'left' ? AVATAR_SIZE - 1 - x : x, y, 1, 1); }
  }));
  ctx.restore();
}
