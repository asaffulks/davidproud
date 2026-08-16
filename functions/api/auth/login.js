// POST /api/auth/login
//
//   { action: 'link' }                    → email David a one-time sign-in link
//   { action: 'passphrase', passphrase }  → sign in directly
//
// The link is the everyday route; the passphrase is the fallback for when he
// is not near his email, or before the mail service is configured.

import { json, ipHash } from '../../../lib/util.js';
import {
  mintToken, sessionCookie, tooManyAttempts, recordAttempt,
  secretEquals, LINK_TTL, SESSION_TTL,
} from '../../../lib/auth.js';
import { sendMail, signInEmail, mailConfigured } from '../../../lib/mail.js';

export const onRequestPost = async ({ request, env }) => {
  if (!env.DB || !env.SESSION_SECRET) {
    return json({ error: 'Sign-in is not set up yet.' }, 503);
  }

  const hash = await ipHash(request, env);
  if (await tooManyAttempts(env, hash)) {
    return json({ error: 'Too many attempts. Please wait fifteen minutes.' }, 429);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Could not read that request.' }, 400);
  }

  if (payload.action === 'link') {
    await recordAttempt(env, hash);
    if (!mailConfigured(env)) {
      return json({ error: 'Email sign-in is not configured yet — please use the passphrase.' }, 400);
    }
    const token = await mintToken(env.SESSION_SECRET, 'login', LINK_TTL);
    const url = `${new URL(request.url).origin}/api/auth/callback?t=${encodeURIComponent(token)}`;
    await sendMail(env, signInEmail({ url }));
    return json({ ok: true, sent: true });
  }

  if (payload.action === 'passphrase') {
    await recordAttempt(env, hash);
    const supplied = String(payload.passphrase ?? '');
    const expected = String(env.MODERATOR_PASSPHRASE ?? '');
    if (!expected) {
      return json({ error: 'No passphrase is set on this site.' }, 400);
    }
    if (!(await secretEquals(env.SESSION_SECRET, supplied, expected))) {
      return json({ error: 'That passphrase was not right.' }, 401);
    }
    const session = await mintToken(env.SESSION_SECRET, 'session', SESSION_TTL);
    return json({ ok: true }, 200, { 'set-cookie': sessionCookie(session) });
  }

  return json({ error: 'Unknown sign-in method.' }, 400);
};
