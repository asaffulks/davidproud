// POST /api/auth/github — sign in to moderation using the GitHub session
// David already has from /admin.
//
// The CMS stores his GitHub token in this site's own localStorage. The page
// hands it here; we ask GitHub who it belongs to and whether that person can
// write to the site's repository. Only David, Asaf and Kira can — so a token
// with push access is proof enough, and David never types a second password.

import { json, ipHash } from '../../../lib/util.js';
import {
  mintToken, sessionCookie, tooManyAttempts, recordAttempt, SESSION_TTL,
} from '../../../lib/auth.js';

const DEFAULT_REPO = 'asaffulks/davidproud';

const gh = (url, token) =>
  fetch(`https://api.github.com${url}`, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'davidproud.uk-moderation',
    },
  });

export const onRequestPost = async ({ request, env }) => {
  if (!env.DB || !env.SESSION_SECRET) return json({ error: 'Sign-in is not set up yet.' }, 503);

  const hash = await ipHash(request, env);
  if (await tooManyAttempts(env, hash)) {
    return json({ error: 'Too many attempts. Please wait fifteen minutes.' }, 429);
  }

  let token;
  try {
    ({ token } = await request.json());
  } catch {
    return json({ error: 'Could not read that request.' }, 400);
  }
  if (!token || typeof token !== 'string') return json({ error: 'No GitHub session found.' }, 400);

  await recordAttempt(env, hash);

  try {
    const repo = env.GITHUB_REPO || DEFAULT_REPO;
    const res = await gh(`/repos/${repo}`, token);
    // A private repo returns 404 to anyone who cannot see it, so this covers
    // both "not a collaborator" and "token is no good".
    if (!res.ok) return json({ error: 'That GitHub account cannot edit this site.' }, 401);

    const data = await res.json();
    if (data?.permissions?.push !== true) {
      return json({ error: 'That GitHub account cannot edit this site.' }, 401);
    }

    const session = await mintToken(env.SESSION_SECRET, 'session', SESSION_TTL);
    return json({ ok: true }, 200, { 'set-cookie': sessionCookie(session) });
  } catch {
    return json({ error: 'Could not check that GitHub sign-in just now.' }, 502);
  }
};
