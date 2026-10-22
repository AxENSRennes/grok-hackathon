import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Arena, type ArenaSource } from './Arena';
import { makeZones, WORLD, type PlayerView, type Question } from '../shared/protocol';

const question: Question = { text: 'Tu codes plutôt…', mode: 'choice', labels: ['Solo', 'En équipe'], duration: 30 };
function actor(id: string, x: number, color: number, hair: number): PlayerView {
  return { id, name: id, x, y: 545, color, hair, accessory: 'none', vx: 0, vy: 0, facing: 'down', jumpAt: 0, message: '', messageUntil: 0, online: true, lastSeq: 0 };
}

// A separate art preview: two local actors, no host access or fake live players.
export function ArcadePreview() {
  const source = useRef<ArenaSource>({ offset: 0, snapshot: {
    players: [actor('cyan', 355, 0, 0), actor('pink', 925, 1, 2)],
    phase: 'question', question, zones: makeZones(question), result: null,
    endsAt: 0, serverTime: Date.now(), paused: false, chatEnabled: true,
  } });
  const [qr, setQr] = useState('');
  const playUrl = `${location.origin}/play`;
  useEffect(() => { void QRCode.toDataURL(playUrl, { width: 160, margin: 1, color: { dark: '#0b102e', light: '#f1f5ff' } }).then(setQr); }, [playUrl]);
  useEffect(() => {
    const held = new Set<string>();
    const player = source.current.snapshot.players[0];
    const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '];
    const down = (event: KeyboardEvent) => {
      if (!keys.includes(event.key)) return;
      event.preventDefault(); held.add(event.key);
      if (event.key === ' ' && !event.repeat) player.jumpAt = Date.now();
    };
    const up = (event: KeyboardEvent) => { held.delete(event.key); };
    const clear = () => held.clear();
    let previous = performance.now(), frame = 0;
    const tick = (now: number) => {
      const dt = Math.min((now - previous) / 1000, 0.05); previous = now;
      const x = Number(held.has('ArrowRight')) - Number(held.has('ArrowLeft'));
      const y = Number(held.has('ArrowDown')) - Number(held.has('ArrowUp'));
      const divisor = Math.max(1, Math.hypot(x, y));
      player.vx = x / divisor * 180; player.vy = y / divisor * 180;
      player.x = Math.max(WORLD.left + 25, Math.min(WORLD.right - 25, player.x + player.vx * dt));
      player.y = Math.max(WORLD.top + 90, Math.min(WORLD.bottom - 10, player.y + player.vy * dt));
      if (x) player.facing = x < 0 ? 'left' : 'right';
      else if (y) player.facing = y < 0 ? 'up' : 'down';
      source.current.snapshot.serverTime = Date.now();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', clear);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', clear); };
  }, []);
  return <main className="stage arcade-preview" aria-label="Aperçu arcade avec deux personnages dessinés dans le code">
    <Arena session={source.current} onFps={() => {}} preview />
    <h1 className="sr-only">{question.text}</h1>
    <a className="stage-qr" href={playUrl} aria-label="Ouvrir la page joueur ; cet aperçu n'est pas une salle multijoueur">{qr && <img src={qr} alt="Page joueur" />}<span>APERÇU</span></a>
  </main>;
}
