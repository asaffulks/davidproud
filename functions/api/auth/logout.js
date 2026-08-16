// POST /api/auth/logout — forget the moderation session on this device.

import { json } from '../../../lib/util.js';
import { clearedCookie } from '../../../lib/auth.js';

export const onRequestPost = async () =>
  json({ ok: true }, 200, { 'set-cookie': clearedCookie() });
