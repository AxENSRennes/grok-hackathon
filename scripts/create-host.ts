import { auth, createAuth, isHost, migrateAuth } from '../src/server/auth.js';

// Password arrives through stdin, never a command argument or deployment log.
const email = process.env.HOST_EMAILS?.split(',')[0]?.trim();
if (!email || !isHost({ email })) throw new Error('Set HOST_EMAILS before provisioning a host.');
let password = '';
for await (const chunk of process.stdin) password += chunk;
password = password.trim();
if (password.length < 12) throw new Error('Provide a password of at least 12 characters via stdin.');
await migrateAuth();
const provisioning = createAuth(true);
await provisioning.api.signUpEmail({ body: { email, password, name: 'Organisateur' } });
// Ensure provisioning cannot accidentally leave sign-up enabled on the app instance.
if (!auth.options.emailAndPassword?.disableSignUp) throw new Error('Public sign-up must remain disabled.');
console.log('Organizer account provisioned. Public registration remains disabled.');
