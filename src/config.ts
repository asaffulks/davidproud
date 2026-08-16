// Site-wide settings that need to be known when the pages are built.
//
// TURNSTILE_SITE_KEY is Cloudflare Turnstile's *public* key — it is meant to be
// visible in the page source, so it lives here rather than in a secret. Its
// partner (the secret key) is stored as a Pages secret and never appears here.
//
// Leave it empty and the forms still work: the invisible spam check is simply
// skipped, and submissions rely on the honeypot, the rate limit, and the fact
// that nothing is published until David approves it.
export const TURNSTILE_SITE_KEY = '0x4AAAAAAERVovjxulQs6puC';
