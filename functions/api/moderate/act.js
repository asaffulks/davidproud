// POST /api/moderate/act — David's decision on one submission.
//
//   { id, action: 'approve' }   → publish it
//   { id, action: 'reject' }    → keep it out of sight but keep the record
//   { id, action: 'delete' }    → remove it entirely
//   { action: 'purge' }         → delete everything already rejected

import { json, now } from '../../../lib/util.js';
import { isModerator } from '../../../lib/auth.js';

export const onRequestPost = async ({ request, env }) => {
  if (!env.DB) return json({ error: 'Not set up yet.' }, 503);
  if (!(await isModerator(request, env))) return json({ error: 'signin' }, 401);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Could not read that request.' }, 400);
  }

  const { id, action } = payload;

  if (action === 'purge') {
    const result = await env.DB.prepare(`DELETE FROM submissions WHERE status = 'rejected'`).run();
    return json({ ok: true, removed: result.meta?.changes ?? 0 });
  }

  if (!id) return json({ error: 'Which one?' }, 400);

  if (action === 'delete') {
    await env.DB.prepare('DELETE FROM submissions WHERE id = ?').bind(id).run();
    return json({ ok: true });
  }

  if (action === 'approve' || action === 'reject') {
    const status = action === 'approve' ? 'approved' : 'rejected';
    await env.DB.prepare('UPDATE submissions SET status = ?, moderated_at = ? WHERE id = ?')
      .bind(status, now(), id).run();
    return json({ ok: true, status });
  }

  return json({ error: 'Unknown action.' }, 400);
};
