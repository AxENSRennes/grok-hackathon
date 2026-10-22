import { createRoot } from 'react-dom/client';
import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import { type Appearance } from '../shared/protocol';
import { Session, createSession, joinSession, randomToken, guestToken } from './session';
import { useSession } from './useSession';
import { CharacterSelector, type CharacterChoice } from './CharacterSelector';
import './styles.css';
import './arcade.css';
import { authClient } from './auth';
import { RemoteControl, ControllerPreview, type Direction } from './RemoteControl';
import { StageDisplay } from './StageDisplay';
import { QuestionNavigation } from './QuestionNavigation';

const Arena = lazy(() => import('./Arena').then(module => ({ default: module.Arena })));
const ArcadePreview = lazy(() => import('./ArcadePreview').then(module => ({ default: module.ArcadePreview })));
const roomFromUrl = () => (new URLSearchParams(location.search).get('room') || '').toUpperCase();
const initialAppearance: Appearance = { color: 0, hair: 0, accessory: 'none' };
function Notice({ text }: { text: string }) { return text ? <div role="alert" className="notice">{text}</div> : null; }
function Connection({ session }: { session: Session }) {
  return session.status === 'connected' ? null : <span className="connection" role="status">{session.status === 'reconnecting' ? 'Reconnecting…' : 'Disconnected'}</span>;
}
function usePublicBase() {
  const [base, setBase] = useState(location.origin);
  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(config => {
      if (config.publicUrl) setBase(config.publicUrl.replace(/\/$/, ''));
      else if (['localhost', '127.0.0.1'].includes(location.hostname) && config.lanUrls[0]) setBase(config.lanUrls[0]);
    }).catch(() => {});
  }, []);
  return base;
}
function JoinPlayer() {
  const [roomId, setRoomId] = useState(roomFromUrl());
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => () => session?.close(), [session]);
  if (session) return <Controller session={session} />;
  const join = async ({ name, appearance }: CharacterChoice) => {
    setError(''); setBusy(true);
    try {
      const room = roomId.trim().toUpperCase();
      const joined = await joinSession(room, { role: 'player', token: guestToken(room), name: name.trim(), ...appearance });
      localStorage.setItem('sidequest:name', name.trim());
      history.replaceState(null, '', `/play?room=${room}`); setSession(joined);
    } catch (e) { setError((e as Error).message || 'Unable to connect.'); }
    finally { setBusy(false); }
  };
  return <CharacterSelector onConfirm={join} initialName={localStorage.getItem('sidequest:name') || ''} busy={busy} error={error}
    roomCode={roomId} onRoomCodeChange={roomFromUrl() ? undefined : setRoomId} />;
}
function Controller({ session: initial }: { session: Session }) {
  const session = useSession(initial)!;
  const held = useRef(new Set<Direction>());
  const [pressed, setPressed] = useState<Set<Direction>>(new Set());
  const player = session.snapshot.players.find(p => p.id === session.playerId);
  const send = () => session.input(Number(held.current.has('right')) - Number(held.current.has('left')), Number(held.current.has('down')) - Number(held.current.has('up')));
  const press = (direction: Direction, down: boolean) => {
    if (down) held.current.add(direction); else held.current.delete(direction);
    setPressed(new Set(held.current)); send();
  };
  useEffect(() => {
    const clear = () => { held.current.clear(); setPressed(new Set()); session.input(0, 0); };
    const keys: Record<string, Direction> = { ArrowUp: 'up', w: 'up', z: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', a: 'left', q: 'left', ArrowRight: 'right', d: 'right' };
    const keydown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (keys[e.key]) { e.preventDefault(); press(keys[e.key], true); }
      if (e.code === 'Space' && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); if (!e.repeat) session.jump(); }
    };
    const keyup = (e: KeyboardEvent) => { if (keys[e.key]) press(keys[e.key], false); };
    const visibility = () => { if (document.hidden) clear(); };
    const heartbeat = setInterval(() => { if (!document.hidden && session.status === 'connected') send(); }, 150);
    window.addEventListener('blur', clear); window.addEventListener('pagehide', clear);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup);
    return () => { clear(); clearInterval(heartbeat); window.removeEventListener('blur', clear); window.removeEventListener('pagehide', clear); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); };
  }, [session]);
  const disabled = session.status !== 'connected' || session.snapshot.paused || session.snapshot.phase === 'results';
  useEffect(() => {
    if (disabled) { held.current.clear(); setPressed(new Set()); session.input(0, 0); }
  }, [disabled, session]);
  return <RemoteControl name={player?.name || 'Joueur'} appearance={player || initialAppearance} roomId={session.room.roomId} status={session.status === 'connected' ? 'connected' : session.status === 'closed' ? 'disconnected' : 'reconnecting'} disabled={disabled} chatEnabled={session.snapshot.chatEnabled} pressed={pressed} notice={session.notice} onDirection={press} onJump={() => session.jump()} onSend={text => session.chat(text)} />;
}
function StageAccess() {
  const [host, setHost] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const check = async () => {
    const response = await fetch('/api/me');
    if (!response.ok) throw new Error('Unable to connect. Please try again.');
    const data = await response.json();
    setHost(data.host);
    return data.host as boolean;
  };
  useEffect(() => { void check().catch(e => { setError(e.message); setHost(false); }); }, []);
  // Viewing an existing screen stays public; only creating/controlling requires a host.
  if (host === null) return <main className="stage-loading">…</main>;
  if (roomFromUrl() && location.pathname !== '/host') return <Stage canHost={host === true} />;
  if (host) return <Stage canHost />;
  const login = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) throw new Error('Incorrect email or password.');
      if (!await check()) { await authClient.signOut(); throw new Error('This account does not have host access.'); }
      setPassword('');
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  return <main className="join"><form className="join-card" onSubmit={login}>
    <strong>Host sign-in</strong>
    <label htmlFor="host-email">Email</label><input id="host-email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required />
    <label htmlFor="host-password">Password</label><input id="host-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
    <Notice text={error} /><button className="primary full" disabled={busy}>{busy ? '…' : 'Open room'}</button>
    <a href="/play">Join as a player</a>
  </form></main>;
}
function Stage({ canHost }: { canHost: boolean }) {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState('');
  const base = usePublicBase();
  useSession(session);
  useEffect(() => {
    let live = true, current: Session | undefined;
    const roomId = roomFromUrl();
    const key = canHost && roomId && sessionStorage.getItem(`sidequest:host:${roomId}`);
    const connect = roomId ? joinSession(roomId, key ? { role: 'host', hostKey: key } : { role: 'screen' }) : createSession(randomToken());
    connect.then(value => {
      current = value;
      if (!live) { value.close(); return; }
      history.replaceState(null, '', `/?room=${value.room.roomId}`);
      setSession(value);
    }).catch(e => { if (live) setError(e.message || 'Unable to connect.'); });
    return () => { live = false; current?.close(); };
  }, []);
  if (!session) return <main className="stage-loading"><Notice text={error} />{error ? <button onClick={() => { location.href = '/'; }}>Try again</button> : <span aria-label="Connecting">…</span>}</main>;
  const url = `${base}/play?room=${session.room.roomId}`;
  return <StageDisplay url={url} roomCode={session.room.roomId} storageKey={`sidequest:display:${session.room.roomId}`} status={<div className="stage-status"><Connection session={session} /><Notice text={session.notice} /></div>}>
    <Suspense fallback={null}><Arena session={session} onFps={() => {}} /></Suspense>
    {session.snapshot.question && <h1 className="sr-only">{session.snapshot.question.text}</h1>}
    {session.snapshot.paused && <div className="pause-overlay">Ⅱ</div>}
    {session.isHost && <QuestionNavigation session={session} />}
  </StageDisplay>;
}
createRoot(document.getElementById('root')!).render(location.pathname === '/controller-preview' ? <ControllerPreview /> : location.pathname === '/preview'
  ? <Suspense fallback={<main className="stage-loading">…</main>}><ArcadePreview /></Suspense>
  : location.pathname === '/play' ? <JoinPlayer /> : <StageAccess />);
