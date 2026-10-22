import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { COLORS, type Appearance } from '../shared/protocol';
import { AVATAR_SIZE, drawAvatar } from './avatars';
import { pixelText } from './arcadeArt';
import './remote-control.css';

export type Direction = 'up' | 'down' | 'left' | 'right';
type ConnectionState = 'connected' | 'reconnecting' | 'disconnected' | 'preview';
interface RemoteControlProps {
  name: string;
  appearance: Appearance;
  roomId?: string;
  status: ConnectionState;
  disabled?: boolean;
  chatEnabled?: boolean;
  pressed: ReadonlySet<Direction>;
  notice?: string;
  onDirection: (direction: Direction, down: boolean) => void;
  onJump: () => void;
  onSend: (message: string) => void;
}

function PixelWord({ text, color = '#f1f5ff' }: { text: string; color?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const width = (text.length * 6 - 1) * 2;
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) { ctx.clearRect(0, 0, width, 14); pixelText(ctx, text, 0, 0, 2, color); }
  }, [text, color, width]);
  return <canvas ref={ref} width={width} height={14} aria-hidden="true" />;
}

function Character({ appearance, facing, moving }: { appearance: Appearance; facing: Direction; moving: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    let frame = 0;
    const tick = (time: number) => {
      const cycle = [0, 1, 0, 2][Math.floor(time / 125) % 4];
      drawAvatar(ctx, appearance, { facing, step: moving ? cycle : 0 });
      if (moving) frame = requestAnimationFrame(tick);
    };
    tick(performance.now());
    return () => cancelAnimationFrame(frame);
  }, [appearance.color, appearance.hair, appearance.accessory, facing, moving]);
  return <canvas ref={ref} width={AVATAR_SIZE} height={AVATAR_SIZE} aria-hidden="true" />;
}

function Arrow() {
  return <svg viewBox="0 0 16 17" aria-hidden="true" shapeRendering="crispEdges"><path d="M7 1h2v2h2v2h2v2h2v2h-5v7H6V9H1V7h2V5h2V3h2z" fill="currentColor" /></svg>;
}

export function RemoteControl({ name, appearance, roomId, status, disabled = false, chatEnabled = true, pressed, notice, onDirection, onJump, onSend }: RemoteControlProps) {
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  const [jumping, setJumping] = useState(false);
  const [facing, setFacing] = useState<Direction>('down');
  const jumpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (jumpTimer.current) clearTimeout(jumpTimer.current); if (sentTimer.current) clearTimeout(sentTimer.current); }, []);
  useEffect(() => {
    const direction = Array.from(pressed).at(-1);
    if (direction) setFacing(direction);
  }, [pressed]);
  const jump = () => {
    if (disabled) return;
    onJump(); setJumping(true);
    if (jumpTimer.current) clearTimeout(jumpTimer.current);
    jumpTimer.current = setTimeout(() => setJumping(false), 620);
  };
  const labels: Record<Direction, string> = { up: 'Move up', left: 'Move left', right: 'Move right', down: 'Move down' };
  const connectionLabels: Record<ConnectionState, string> = { connected: 'Connected', reconnecting: 'Reconnecting…', disconnected: 'Disconnected', preview: 'Local preview' };
  const arrow = (direction: Direction) => <button key={direction} type="button" className={`remote-direction remote-${direction} ${pressed.has(direction) ? 'is-pressed' : ''}`} aria-label={labels[direction]} aria-pressed={pressed.has(direction)} disabled={disabled}
    onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); onDirection(direction, true); }}
    onPointerUp={() => onDirection(direction, false)} onPointerCancel={() => onDirection(direction, false)} onLostPointerCapture={() => onDirection(direction, false)}
    onKeyDown={event => { if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) { event.preventDefault(); onDirection(direction, true); } }}
    onKeyUp={event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); onDirection(direction, false); } }}
    onBlur={() => onDirection(direction, false)}><Arrow /></button>;
  return <main className="remote-control" style={{ '--player-color': COLORS[appearance.color] } as CSSProperties} aria-label="Arcade controller">
    <header className="remote-header">
      <div className="remote-identity"><span className="remote-player-mark" aria-hidden="true" /><strong>{name || 'Player'}</strong></div>
      <div className={`remote-connection is-${status}`} role="status" aria-label={connectionLabels[status]}><span aria-hidden="true" className="remote-signal"><i /><i /><i /></span><span>{status === 'connected' ? roomId : connectionLabels[status]}</span></div>
    </header>

    <section className="remote-movement" aria-label="Movement and jump">
      <div className="remote-deck">
        <span className="remote-screw top-left" aria-hidden="true" /><span className="remote-screw top-right" aria-hidden="true" />
        <div className="remote-pad" role="group" aria-label="Directional pad">
          {arrow('up')}{arrow('left')}
          <button className={`remote-jump ${jumping ? 'is-jumping' : ''}`} type="button" aria-label="Jump" disabled={disabled} onPointerDown={event => { event.preventDefault(); jump(); }} onClick={event => { if (event.detail === 0) jump(); }}>
            <span className="remote-jump-character"><Character appearance={appearance} facing={facing} moving={pressed.size > 0} /></span>
            <span className="remote-character-shadow" aria-hidden="true" />
            <PixelWord text="JUMP" color="#0b102e" />
          </button>
          {arrow('right')}{arrow('down')}
        </div>
        <span className="remote-screw bottom-left" aria-hidden="true" /><span className="remote-screw bottom-right" aria-hidden="true" />
      </div>
    </section>

    <section className="remote-chat" aria-label="Message to the shared screen">
      <form onSubmit={event => {
        event.preventDefault();
        if (!text.trim() || sent || !chatEnabled || (status !== 'connected' && status !== 'preview')) return;
        onSend(text.trim()); setText(''); setSent(true);
        if (sentTimer.current) clearTimeout(sentTimer.current);
        sentTimer.current = setTimeout(() => setSent(false), 2500);
      }}>
        <label className="remote-chat-title" htmlFor="remote-message"><svg viewBox="0 0 18 18" aria-hidden="true" shapeRendering="crispEdges"><path d="M2 2h14v10H8l-4 4v-4H2z" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M5 5h8v2H5z" fill="currentColor" /></svg><span className="sr-only">Message</span><PixelWord text="MESSAGE" /></label>
        <textarea id="remote-message" rows={3} maxLength={80} value={text} onChange={event => setText(event.target.value)} placeholder={chatEnabled ? 'Your message…' : 'Messages paused'} disabled={!chatEnabled || (status !== 'connected' && status !== 'preview')} />
        <div className="remote-chat-bottom"><small aria-live="polite">{sent ? 'Message sent' : text.length ? `${text.length}/80` : '\u00a0'}</small><button type="submit" className="remote-send" aria-label="Send message" disabled={sent || !text.trim() || !chatEnabled || (status !== 'connected' && status !== 'preview')}>
          <svg viewBox="0 0 20 20" aria-hidden="true" shapeRendering="crispEdges">{sent ? <path d="M2 10h4v4h3V9h3V6h3V3h3v5h-3v3h-3v3H9v4H5v-4H2z" fill="currentColor" /> : <path d="M2 2h4v2h4v2h4v2h4v4h-4v2h-4v2H6v2H2v-6h8V8H2z" fill="currentColor" />}</svg>
        </button></div>
      </form>
    </section>
    {notice && <div className="remote-notice" role="alert">{notice}</div>}
  </main>;
}

export function ControllerPreview() {
  const held = useRef(new Set<Direction>());
  const [pressed, setPressed] = useState(new Set<Direction>());
  const [message, setMessage] = useState('');
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const change = (direction: Direction, down: boolean) => {
    if (down) held.current.add(direction); else held.current.delete(direction);
    setPressed(new Set(held.current));
  };
  useEffect(() => {
    const clear = () => { held.current.clear(); setPressed(new Set()); };
    const visibility = () => { if (document.hidden) clear(); };
    const keys: Record<string, Direction> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    const key = (event: KeyboardEvent, down: boolean) => {
      if (event.target instanceof HTMLTextAreaElement || !keys[event.key]) return;
      event.preventDefault(); change(keys[event.key], down);
    };
    const down = (event: KeyboardEvent) => key(event, true), up = (event: KeyboardEvent) => key(event, false);
    window.addEventListener('blur', clear); window.addEventListener('keydown', down); window.addEventListener('keyup', up); document.addEventListener('visibilitychange', visibility);
    return () => { window.removeEventListener('blur', clear); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); document.removeEventListener('visibilitychange', visibility); if (messageTimer.current) clearTimeout(messageTimer.current); };
  }, []);
  return <RemoteControl name="Axel" appearance={{ color: 0, hair: 0, accessory: 'none' }} status="preview" pressed={pressed} onDirection={change} onJump={() => {}} onSend={value => {
    setMessage(`Message preview: ${value}`);
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setMessage(''), 4000);
  }} notice={message} />;
}
