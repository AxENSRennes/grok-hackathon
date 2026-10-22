import { useEffect, useState } from 'react';
import type { Session } from './session';

export function useSession(session: Session | null) {
  const [, refresh] = useState(0);
  useEffect(() => session?.subscribe(() => refresh(n => n + 1)), [session]);
  return session;
}
