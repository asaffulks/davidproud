// POST /api/submit — a visitor sends a blog response or a testimonial.
//
// Nothing written here is ever published by this endpoint. Everything lands in
// the moderation queue as 'pending'; only David's approval makes it visible.

import { json, now, clamp, ipHash, clientIp } from '../../lib/util.js';
import { scoreContent, verifyTurnstile, DROP_AT } from '../../lib/spam.js';
import { sendMail, submissionEmail } from '../../lib/mail.js';
import { mintToken, LINK_TTL } from '../../lib/auth.js';

const MAX_PER_HOUR = 5;

// Bots that are turned away are told the same thing as a happy visitor: there
// is nothing to learn from probing this endpoint.
const pretendSuccess = () => json({ ok: true, queued: false });

export const onRequestPost = async ({ request, env, waitUntil }) => {
  if (!env.DB) return json({ error: 'Responses are not set up yet.' }, 503);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Could not read that submission.' }, 400);
  }

  const kind = payload.kind === 'testimonial' ? 'testimonial' : 'comment';
  const name = clamp(payload.name, 80);
  const email = clamp(payload.email, 200);
  const role = clamp(payload.role, 120);
  const body = clamp(payload.body, 4000);
  const slug = kind === 'comment' ? clamp(payload.slug, 200) : null;
  const pageTitle = clamp(payload.pageTitle, 200);

  // 1. Honeypot — a real person never fills this in.
  if (clamp(payload.website, 200)) return pretendSuccess();

  // 2. Filled in impossibly fast? Not a reader.
  if (Number(payload.elapsed) >= 0 && Number(payload.elapsed) < 2500) return pretendSuccess();

  if (!name || !body) return json({ error: 'Please add your name and a few words.' }, 400);
  if (body.length < 2) return json({ error: 'Please write a little more.' }, 400);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'That email address does not look right.' }, 400);
  }
  if (kind === 'comment' && !slug) return json({ error: 'Could not tell which post this belongs to.' }, 400);

  // 3. Cloudflare Turnstile.
  //
  // A token that is present but *wrong* is a forgery — refuse it. A token that
  // never arrived usually means the widget could not load (an old browser, a
  // blocked script, a privacy extension), and a reader should not lose what
  // they wrote over that. Let it through to the queue with a note instead:
  // moderation, not Turnstile, is what actually keeps spam off the site.
  const extraFlags = [];
  if (env.TURNSTILE_SECRET_KEY && !payload.turnstile) {
    extraFlags.push('no spam-check');
  } else {
    const check = await verifyTurnstile(env.TURNSTILE_SECRET_KEY, payload.turnstile, clientIp(request));
    if (!check.ok) {
      return json({ error: 'The spam check did not pass. Please reload the page and try again.' }, 400);
    }
    if (check.skipped && check.reason) extraFlags.push('spam-check unavailable');
  }

  const hash = await ipHash(request, env);
  const timestamp = now();

  // 4. Rate limit.
  const recent = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM submissions WHERE ip_hash = ? AND created_at > ?',
  ).bind(hash, timestamp - 3600).first();
  if ((recent?.n ?? 0) >= MAX_PER_HOUR) {
    return json({ error: 'That is a few too many at once — please try again a little later.' }, 429);
  }

  // Double-click or resend of the same words: accept quietly, store once.
  const duplicate = await env.DB.prepare(
    'SELECT id FROM submissions WHERE ip_hash = ? AND body = ? AND created_at > ?',
  ).bind(hash, body, timestamp - 86400).first();
  if (duplicate) return json({ ok: true, queued: true });

  // 5. Content scoring — obvious junk never reaches the queue.
  const { score, flags: contentFlags } = scoreContent({ name, role, body });
  if (score >= DROP_AT) return pretendSuccess();
  const flags = [...extraFlags, ...contentFlags];

  await env.DB.prepare(
    `INSERT INTO submissions
       (id, kind, slug, page_title, name, email, role, body, status, flags, ip_hash, user_agent, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
  ).bind(
    crypto.randomUUID(),
    kind,
    slug,
    pageTitle || null,
    name,
    email || null,
    role || null,
    body,
    flags.length ? flags.join(', ') : null,
    hash,
    clamp(request.headers.get('user-agent'), 300) || null,
    timestamp,
  ).run();

  // 6. Tell David, without holding up the visitor's reply.
  waitUntil((async () => {
    const origin = new URL(request.url).origin;
    let moderateUrl = `${origin}/moderate/`;
    if (env.SESSION_SECRET) {
      const token = await mintToken(env.SESSION_SECRET, 'login', LINK_TTL);
      moderateUrl = `${origin}/api/auth/callback?t=${encodeURIComponent(token)}`;
    }
    await sendMail(env, submissionEmail({ kind, name, pageTitle, body, flags, moderateUrl }));
  })());

  return json({ ok: true, queued: true });
};
