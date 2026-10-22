import { createAuthClient } from 'better-auth/react';
import { anonymousClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({ plugins: [anonymousClient()] });
let signingIn: Promise<void> | undefined;
export async function ensureGuestSession() {
  // Share the operation within this page so rapid repeated clicks do not create identities.
  if (signingIn) return signingIn;
  signingIn = (async () => {
    const session = await authClient.getSession();
    if (session.error) throw new Error('Unable to check your session. Please try again.');
    if (session.data) return;
    const result = await authClient.signIn.anonymous();
    if (result.error) throw new Error('Unable to connect. Please try again in a moment.');
  })();
  try { await signingIn; } finally { signingIn = undefined; }
}
