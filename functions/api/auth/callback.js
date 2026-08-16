// GET /api/auth/callback?t=<token> — the sign-in link from David's email.
// Exchanges a short-lived link token for a long-lived session cookie.

import { verifyToken, mintToken, sessionCookie, SESSION_TTL } from '../../../lib/auth.js';

export const onRequestGet = async ({ request, env }) => {
  const token = new URL(request.url).searchParams.get('t');
  const origin = new URL(request.url).origin;

  if (!env.SESSION_SECRET || !(await verifyToken(env.SESSION_SECRET, token, 'login'))) {
    return Response.redirect(`${origin}/moderate/?expired=1`, 302);
  }

  const session = await mintToken(env.SESSION_SECRET, 'session', SESSION_TTL);
  return new Response(null, {
    status: 302,
    headers: {
      location: `${origin}/moderate/`,
      'set-cookie': sessionCookie(session),
      'cache-control': 'no-store',
    },
  });
};
