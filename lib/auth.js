// Sign-in for the moderation page.
//
// There is no account and no password stored anywhere. David either clicks a
// one-time link emailed to him, or types the passphrase Asaf gave him. Both
// end in the same thing: a signed, expiring cookie. The signature is an HMAC
// over the site's SESSION_SECRET, so a cookie cannot be forged without it.

import { readCookie, now } from './util.js';

const encoder = new TextEncoder();
export const SESSION_COOKIE = 'dp_mod';

const b64url = (bytes) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return b64url(new Uint8Array(signature));
}

// Constant-time-ish comparison: never bail out early on a mismatch.
function equal(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function mintToken(secret, purpose, ttlSeconds) {
  const payload = `${purpose}.${now() + ttlSeconds}`;
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function verifyToken(secret, token, purpose) {
  if (!secret || !token) return false;
  const parts = String(token).split('.');
  if (parts.length !== 3) return false;
  const [tokenPurpose, expiry, signature] = parts;
  if (tokenPurpose !== purpose) return false;
  const expected = await hmac(secret, `${tokenPurpose}.${expiry}`);
  if (!equal(signature, expected)) return false;
  return Number(expiry) > now();
}

// Compare two secrets without leaking, through timing, how much of one matched.
// Both are hashed first, so the comparison runs over equal-length digests.
export async function secretEquals(secret, a, b) {
  const [left, right] = await Promise.all([
    hmac(secret, `passphrase:${a}`),
    hmac(secret, `passphrase:${b}`),
  ]);
  return equal(left, right);
}

export const SESSION_TTL = 60 * 60 * 24 * 30;   // 30 days
export const LINK_TTL = 60 * 60;                // 1 hour

export function sessionCookie(token, maxAge = SESSION_TTL) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

export const clearedCookie = () =>
  `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;

export async function isModerator(request, env) {
  return verifyToken(env.SESSION_SECRET, readCookie(request, SESSION_COOKIE), 'session');
}

/** Sign-in attempts are capped so the passphrase cannot be guessed at speed. */
export async function tooManyAttempts(env, hash) {
  const since = now() - 15 * 60;
  const row = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM auth_attempts WHERE ip_hash = ? AND at > ?',
  ).bind(hash, since).first();
  return (row?.n ?? 0) >= 10;
}

export async function recordAttempt(env, hash) {
  await env.DB.prepare('INSERT INTO auth_attempts (ip_hash, at) VALUES (?, ?)')
    .bind(hash, now()).run();
}
