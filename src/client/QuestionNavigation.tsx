import { useEffect } from 'react';
import type { Session } from './session';

export function QuestionNavigation({ session }: { session: Session }) {
  const connected = session.status === 'connected';
  const previous = connected && session.snapshot.hasPreviousQuestion;
  const next = connected && session.snapshot.hasNextQuestion;

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.defaultPrevented) return;
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        if (event.key === 'ArrowLeft' && previous) session.command({ action: 'previous' });
        if (event.key === 'ArrowRight' && next) session.command({ action: 'next' });
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [session, previous, next]);

  return <nav className="stage-question-navigation" aria-label="Questions">
    <button type="button" disabled={!previous} onClick={() => session.command({ action: 'previous' })} aria-label="Previous question" aria-keyshortcuts="ArrowLeft" title="Previous question (Left arrow)">←</button>
    <button type="button" disabled={!next} onClick={() => session.command({ action: 'next' })} aria-label="Next question" aria-keyshortcuts="ArrowRight" title="Next question (Right arrow)">Next</button>
  </nav>;
}
