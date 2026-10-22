import React, {useLayoutEffect, useRef} from 'react';
import {AbsoluteFill} from 'remotion';
import {drawAvatar} from '../../src/client/avatars';
import type {Appearance} from '../../src/shared/protocol';

// Exact game sprites enlarged with nearest-neighbour sampling for art review.
const examples: {name: string; appearance: Appearance}[] = [
  {name: 'CYAN / HOODIE', appearance: {color: 0, hair: 0, accessory: 'none'}},
  {name: 'PINK / LEAF', appearance: {color: 1, hair: 3, accessory: 'leaf'}},
  {name: 'YELLOW / CAP', appearance: {color: 2, hair: 1, accessory: 'cap'}},
  {name: 'VIOLET / GLASSES', appearance: {color: 3, hair: 2, accessory: 'glasses'}},
];
export function CharacterSheet() {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current!.getContext('2d')!;
    ctx.fillStyle = '#171f3c'; ctx.fillRect(0, 0, 1280, 800);
    ctx.fillStyle = '#f1f5ff'; ctx.font = 'bold 32px monospace';
    ctx.fillText('CURRENT GAME CHARACTERS', 40, 55);
    ctx.fillStyle = '#aebbd5'; ctx.font = '18px monospace';
    ctx.fillText('Actual code renderer / enlarged 3x / no redesign', 40, 86);
    ctx.textAlign = 'center';
    for (let col = 0; col < examples.length; col++) {
      const x = 205 + col * 265;
      ctx.font = 'bold 18px monospace'; ctx.fillStyle = '#f1f5ff';
      ctx.fillText(examples[col].name, x + 72, 131);
      ['down', 'right', 'up'].forEach((facing, row) => {
        const sprite = document.createElement('canvas'); sprite.width = 48; sprite.height = 48;
        drawAvatar(sprite.getContext('2d')!, examples[col].appearance, {facing, step: 0});
        ctx.imageSmoothingEnabled = false; ctx.drawImage(sprite, x, 156 + row * 214, 144, 144);
      });
    }
    ctx.textAlign = 'left'; ctx.font = 'bold 22px monospace'; ctx.fillStyle = '#32d6f5';
    ['FRONT', 'SIDE', 'BACK'].forEach((label, row) => ctx.fillText(label, 40, 235 + row * 214));
  }, []);
  return <AbsoluteFill><canvas ref={ref} width={1280} height={800}/></AbsoluteFill>;
}
