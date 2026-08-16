// GET /api/moderate/list — everything waiting for David, plus what he has
// already decided. Requires the moderation session cookie.

import { json } from '../../../lib/util.js';
import { isModerator } from '../../../lib/auth.js';
import { mailConfigured } from '../../../lib/mail.js';

const shape = (row) => ({
  id: row.id,
  kind: row.kind,
  slug: row.slug ?? undefined,
  pageTitle: row.page_title ?? undefined,
  name: row.name,
  email: row.email ?? undefined,
  role: row.role ?? undefined,
  body: row.body,
  status: row.status,
  flags: row.flags ? row.flags.split(', ') : [],
  createdAt: new Date(row.created_at * 1000).toISOString(),
});

export const onRequestGet = async ({ request, env }) => {
  if (!env.DB) return json({ error: 'Not set up yet.' }, 503);

  if (!(await isModerator(request, env))) {
    return json({ error: 'signin', mail: mailConfigured(env) }, 401);
  }

  const pending = await env.DB.prepare(
    `SELECT * FROM submissions WHERE status = 'pending' ORDER BY created_at DESC LIMIT 200`,
  ).all();

  const decided = await env.DB.prepare(
    `SELECT * FROM submissions WHERE status <> 'pending' ORDER BY moderated_at DESC LIMIT 60`,
  ).all();

  return json({
    pending: (pending.results ?? []).map(shape),
    decided: (decided.results ?? []).map(shape),
  });
};
