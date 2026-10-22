import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { ACCESSORIES, ACCESSORY_NAMES, CHARACTER_COUNT, CHARACTER_COLORS, COLORS, type Appearance, type Accessory } from '../shared/protocol';
import { AVATAR_SIZE, drawAvatar } from './avatars';
import { pixelText } from './arcadeArt';
import './character-selector.css';

const COLOR_NAMES = ['Cyan', 'Pink', 'Yellow', 'Violet', 'Orange', 'Mint'];
const FACINGS = ['down', 'right', 'up', 'left'];
export interface CharacterChoice { name: string; appearance: Appearance }

function PixelWords({ children, className = '' }: { children: string; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const text = children.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (ctx) { ctx.clearRect(0, 0, text.length * 6, 7); pixelText(ctx, text, 0, 0, 1, '#f3f6ff'); }
  }, [text]);
  return <span className={`cs-pixel-words ${className}`}><span className="cs-sr">{children}</span><canvas aria-hidden="true" ref={canvas} width={text.length * 6 - 1} height={7} /></span>;
}

function CharacterSprite({ appearance, animated = false, facing = 'down' }: { appearance: Appearance; animated?: boolean; facing?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    let tick = 0;
    const paint = () => drawAvatar(ctx, appearance, { facing, step: animated && !matchMedia('(prefers-reduced-motion: reduce)').matches ? [0, 1, 0, 2][tick++ % 4] : 0 });
    paint();
    if (animated) { const timer = setInterval(paint, 150); return () => clearInterval(timer); }
  }, [appearance.color, appearance.hair, appearance.accessory, appearance.accessory2, animated, facing]);
  return <canvas aria-hidden="true" className="cs-sprite" ref={canvas} width={AVATAR_SIZE} height={AVATAR_SIZE} />;
}

function PixelArrow({ left = false }: { left?: boolean }) {
  return <svg aria-hidden="true" width="16" height="22" viewBox="0 0 8 11" className={left ? 'cs-arrow-left' : ''} shapeRendering="crispEdges"><path fill="currentColor" d="M0 0h2v2h2v2h2v1h2v1H6v1H4v2H2v2H0V8h2V3H0z" /></svg>;
}

export function CharacterSelector({ onConfirm, initialName = '', busy = false, error = '', roomCode, onRoomCodeChange }: {
  onConfirm?: (choice: CharacterChoice) => void; initialName?: string; busy?: boolean; error?: string;
  roomCode?: string; onRoomCodeChange?: (value: string) => void;
}) {
  const [appearance, setAppearance] = useState<Appearance>({ hair: 0, color: 0, accessory: 'none' });
  const [name, setName] = useState(initialName);
  const [facing, setFacing] = useState(0);
  const [jump, setJump] = useState(0);
  const [ready, setReady] = useState(false);
  const [arrival, setArrival] = useState<'left' | 'right'>('right');
  const swipe = useRef<number | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const update = (next: Partial<Appearance>) => { setAppearance(current => ({ ...current, ...next })); setReady(false); setJump(0); };
  const selectCharacter = (hair: number) => update({ hair, color: CHARACTER_COLORS[hair] });
  const browse = (delta: number) => { selectCharacter((appearance.hair + delta + CHARACTER_COUNT) % CHARACTER_COUNT); setArrival(delta > 0 ? 'right' : 'left'); };
  const toggleAccessory = (accessory: Accessory) => {
    if (accessory === 'none') { update({ accessory: 'none', accessory2: 'none' }); return; }
    const selected = [appearance.accessory, appearance.accessory2 || 'none'].filter(value => value !== 'none');
    const next = selected.includes(accessory) ? selected.filter(value => value !== accessory) : [...selected, accessory].slice(-2);
    update({ accessory: next[0] || 'none', accessory2: next[1] || 'none' });
  };
  const confirm = (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const trimmed = name.trim();
    if (!trimmed) { const input = form.current?.querySelector('input'); input?.setCustomValidity('Choose a nickname.'); input?.reportValidity(); return; }
    if (onConfirm) onConfirm({ name: trimmed, appearance });
    else setReady(true);
  };
  const neighbor = (delta: number): Appearance => {
    const hair = (appearance.hair + delta + CHARACTER_COUNT) % CHARACTER_COUNT;
    return { ...appearance, hair, color: CHARACTER_COLORS[hair] };
  };

  return <main className="cs-page" style={{ '--cs-selected': COLORS[appearance.color] } as CSSProperties}>
    <div className="cs-wall cs-wall-left" aria-hidden="true" /><div className="cs-wall cs-wall-right" aria-hidden="true" />
    <section className="cs-cabinet" aria-label="Character selection">
      <header className="cs-heading"><span className="cs-player" aria-hidden="true">1P</span><h1><PixelWords>YOUR CHARACTER</PixelWords></h1><span className="cs-heading-end" aria-hidden="true" /></header>

      <div className="cs-carousel" role="group" aria-label="Characters" aria-roledescription="carousel" tabIndex={0}
        onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); browse(event.key === 'ArrowLeft' ? -1 : 1); } }}
        onTouchStart={event => { swipe.current = event.touches[0].clientX; }}
        onTouchEnd={event => { if (swipe.current !== null) { const delta = event.changedTouches[0].clientX - swipe.current; if (Math.abs(delta) > 36) browse(delta < 0 ? 1 : -1); swipe.current = null; } }}>
        <div className="cs-floor" aria-hidden="true" />
        <button className="cs-side-character cs-previous" type="button" aria-label="Previous character" onClick={() => browse(-1)}><CharacterSprite appearance={neighbor(-1)} /><span className="cs-small-platform" /></button>
        <button className="cs-side-character cs-next" type="button" aria-label="Next character" onClick={() => browse(1)}><CharacterSprite appearance={neighbor(1)} /><span className="cs-small-platform" /></button>
        <div className="cs-main-character">
          <div className="cs-focus-corners" aria-hidden="true"><i /><i /><i /><i /></div>
          <button type="button" className="cs-hero" aria-label="Make the character jump" onClick={() => setJump(current => current + 1)}><span key={`${appearance.hair}-${jump}`} className={`cs-hero-body ${jump ? 'cs-hop' : `cs-arrive-${arrival}`}`}><CharacterSprite appearance={appearance} facing={FACINGS[facing]} animated /></span></button>
          <span className="cs-shadow" aria-hidden="true" /><span className="cs-main-platform" aria-hidden="true" />
        </div>
        <button type="button" className="cs-chevron cs-chevron-left" aria-label="Browse left" onClick={() => browse(-1)}><PixelArrow left /></button>
        <button type="button" className="cs-chevron cs-chevron-right" aria-label="Browse right" onClick={() => browse(1)}><PixelArrow /></button>
      </div>

      <div className="cs-browse-footer"><div className="cs-dots" role="group" aria-label="Choose a character">{Array.from({ length: CHARACTER_COUNT }, (_, index) => <button type="button" key={index} aria-label={`Character ${index + 1}`} aria-pressed={appearance.hair === index} onClick={() => selectCharacter(index)}><span /></button>)}</div><button type="button" className="cs-turn" aria-label="Turn the character" onClick={() => setFacing(current => (current + 1) % 4)}><svg aria-hidden="true" viewBox="0 0 16 16" width="22" height="22" shapeRendering="crispEdges"><path fill="currentColor" d="M5 1h7v2h2v6h-2V3H5v2H3V3H1V1h2v-1h2zm-3 6h2v6h7v-2h2v2h2v2h-2v1h-2v-1H4v-2H2z" /></svg></button></div>

      <div className="cs-customize">
        <fieldset className="cs-colors"><legend>COLOR</legend><div className="cs-color-options">{COLORS.slice(0, 6).map((color, index) => <button type="button" key={color} aria-label={`${COLOR_NAMES[index]} color`} aria-pressed={appearance.color === index} onClick={() => update({ color: index })} style={{ '--swatch': color } as CSSProperties}><span /></button>)}</div></fieldset>
        <fieldset className="cs-accessories"><legend>ACCESSORIES · 2 MAX</legend><div className="cs-accessory-options">{ACCESSORIES.map(accessory => <button type="button" key={accessory} aria-label={ACCESSORY_NAMES[accessory]} aria-pressed={accessory === 'none' ? appearance.accessory === 'none' && (!appearance.accessory2 || appearance.accessory2 === 'none') : appearance.accessory === accessory || appearance.accessory2 === accessory} onClick={() => toggleAccessory(accessory)}><CharacterSprite appearance={{ ...appearance, accessory, accessory2: 'none' }} /></button>)}</div></fieldset>
      </div>

      <form ref={form} className="cs-confirm" onSubmit={confirm}>
        {onRoomCodeChange && <><label className="cs-sr" htmlFor="cs-room">Room code</label><input className="cs-room" id="cs-room" aria-label="Room code" placeholder="Room code" maxLength={8} required value={roomCode || ''} onChange={event => onRoomCodeChange(event.target.value.toUpperCase())} /></>}
        <label className="cs-sr" htmlFor="cs-nickname">Your nickname</label><input id="cs-nickname" name="nickname" aria-label="Your nickname" placeholder="Your nickname" maxLength={18} autoComplete="nickname" required value={name} onChange={event => { event.currentTarget.setCustomValidity(''); setName(event.target.value); setReady(false); }} />
        <button disabled={busy} type={ready ? 'button' : 'submit'} className={`cs-play ${ready ? 'cs-ready' : ''}`} onClick={ready ? () => setReady(false) : undefined}><PixelWords>{busy ? 'JOINING' : ready ? 'EDIT' : "THAT'S ME!"}</PixelWords></button>
      </form>
      {error && <p className="cs-error" role="alert">{error}</p>}
      <div className="cs-announcement" role="status" aria-live="polite">{ready ? <><span className="cs-ready-check" aria-hidden="true">✓</span> Ready, {name.trim()}!</> : <span className="cs-sr">Character {appearance.hair + 1} of {CHARACTER_COUNT}, {COLOR_NAMES[appearance.color]}, {ACCESSORY_NAMES[appearance.accessory]}{appearance.accessory2 && appearance.accessory2 !== 'none' ? `, ${ACCESSORY_NAMES[appearance.accessory2]}` : ''}.</span>}</div>
    </section>
  </main>;
}
