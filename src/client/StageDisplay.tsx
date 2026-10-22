import { useEffect, useRef, useState, type ReactNode } from 'react';
import QRCode from 'qrcode';
import './stage-display.css';

type StageDisplayProps = {
  url: string;
  roomCode?: string;
  storageKey?: string;
  initiallyStarted?: boolean;
  status?: ReactNode;
  children: ReactNode;
};

export function StageDisplay({ url, roomCode, storageKey, initiallyStarted = false, status, children }: StageDisplayProps) {
  const [started, setStarted] = useState(() => {
    try { return initiallyStarted || !!storageKey && sessionStorage.getItem(storageKey) === 'started'; }
    catch { return initiallyStarted; }
  });
  const [qr, setQr] = useState({ url: '', src: '', failed: false });
  const [attempt, setAttempt] = useState(0);
  const stage = useRef<HTMLElement>(null);
  useEffect(() => {
    let live = true;
    void QRCode.toDataURL(url, {
      width: 1024, margin: 4, color: { dark: '#0a102b', light: '#ffffff' },
    }).then(src => { if (live) setQr({ url, src, failed: false }); })
      .catch(() => { if (live) setQr({ url, src: '', failed: true }); });
    return () => { live = false; };
  }, [url, attempt]);
  const ready = qr.url === url && !!qr.src;
  const failed = qr.url === url && qr.failed;
  const launch = () => {
    try { if (storageKey) sessionStorage.setItem(storageKey, 'started'); } catch { /* Presentation still works without storage. */ }
    setStarted(true);
    stage.current?.focus();
  };
  return <main ref={stage} tabIndex={-1} className={`stage stage-display${started ? '' : ' stage-welcome'}`} aria-label={started ? 'Game screen' : 'Scan to join'}>
    {started && children}
    <div className={started ? 'stage-qr' : 'stage-welcome-content'}>
      <a className={started ? 'stage-qr-link' : 'stage-welcome-qr'} href={url} target="_blank" rel="noreferrer" aria-label="Join this room on your phone">
        {ready ? <img src={qr.src} alt="Scan to join" /> : <span role="status">{failed ? 'QR unavailable' : '…'}</span>}
        {roomCode && <span className="stage-room-code">{roomCode}</span>}
      </a>
      {failed && <button type="button" onClick={() => { setQr({ url: '', src: '', failed: false }); setAttempt(n => n + 1); }}>Retry QR</button>}
      {!started && <button type="button" className="primary stage-play" onClick={launch}>Play</button>}
    </div>
    {status}
  </main>;
}
