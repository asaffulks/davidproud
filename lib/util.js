// Small helpers shared by the API functions.

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  });

export const now = () => Math.floor(Date.now() / 1000);

const encoder = new TextEncoder();

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Visitor IPs are never stored in the clear — only a salted hash, which is
// enough to rate-limit and spot duplicates but cannot be turned back into an IP.
export async function ipHash(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') ?? '';
  return sha256Hex(`${env.SESSION_SECRET ?? 'unsalted'}:${ip}`);
}

export function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') ?? '';
}

export const clamp = (value, max) => String(value ?? '').slice(0, max).trim();

export function readCookie(request, name) {
  const header = request.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
