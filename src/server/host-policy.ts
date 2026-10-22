export function isHost(user: { email: string; isAnonymous?: boolean | null } | null | undefined, allowedEmails = process.env.HOST_EMAILS || '') {
  const emails = allowedEmails.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return !!user && !user.isAnonymous && emails.includes(user.email.toLowerCase());
}
