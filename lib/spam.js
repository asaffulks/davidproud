// Spam defences for visitor submissions.
//
// The layers, weakest to strongest:
//   1. honeypot field      — catches naive bots
//   2. minimum fill time   — catches instant form-stuffers
//   3. Cloudflare Turnstile— catches nearly all of the rest, invisibly
//   4. rate limit          — caps the damage from anything that gets through
//   5. content scoring     — obvious junk is dropped, borderline is flagged
//   6. MODERATION          — the real defence: nothing is published until
//                            David approves it, so spam never reaches the site.

const SPAM_WORDS = [
  'viagra', 'cialis', 'casino', 'porn', 'escort', 'payday loan', 'crypto giveaway',
  'buy backlinks', 'seo services', 'cheap flights', 'replica watches', 'binary options',
  'forex signals', 'weight loss pills', 'work from home', 'bitcoin doubler', 'nude',
];

const LINK_RE = /(https?:\/\/|www\.)/gi;         // counting — global
const HAS_LINK_RE = /(https?:\/\/|www\.)/i;      // testing — non-global, so no lastIndex to trip over
const MARKUP_RE = /(<a\s|<\/a>|\[url|\[\/url\]|<script)/i;

/**
 * Score a submission. Higher is worse.
 * Returns { score, flags } — flags are shown to David in the queue.
 */
export function scoreContent({ name = '', role = '', body = '' }) {
  const flags = [];
  let score = 0;

  const links = (body.match(LINK_RE) ?? []).length;
  if (links > 0) flags.push(links === 1 ? '1 link' : `${links} links`);
  if (links > 1) score += (links - 1) * 2;

  if (MARKUP_RE.test(body)) {
    flags.push('markup');
    score += 2;
  }

  const haystack = `${name} ${role} ${body}`.toLowerCase();
  const hit = SPAM_WORDS.find((word) => haystack.includes(word));
  if (hit) {
    flags.push(`term: ${hit}`);
    score += 3;
  }

  if (HAS_LINK_RE.test(name) || HAS_LINK_RE.test(role)) {
    flags.push('link in name');
    score += 2;
  }

  const letters = body.replace(/[^a-z]/gi, '');
  if (letters.length > 40) {
    const caps = (body.match(/[A-Z]/g) ?? []).length / letters.length;
    if (caps > 0.6) {
      flags.push('shouting');
      score += 1;
    }
  }

  if (/(.)\1{9,}/.test(body)) {
    flags.push('repetition');
    score += 1;
  }

  return { score, flags };
}

/** At or above this, the submission is discarded rather than queued. */
export const DROP_AT = 5;

export async function verifyTurnstile(secret, token, ip) {
  // No secret configured → the check is simply not in play. The other layers,
  // moderation above all, still apply.
  if (!secret) return { ok: true, skipped: true };
  if (!token) return { ok: false, reason: 'missing' };

  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    });
    const data = await res.json();
    return { ok: data?.success === true, reason: (data?.['error-codes'] ?? []).join(',') };
  } catch {
    // If Cloudflare's verifier is unreachable, do not lock legitimate readers
    // out of the form — let it through to moderation instead.
    return { ok: true, skipped: true, reason: 'verifier-unreachable' };
  }
}
