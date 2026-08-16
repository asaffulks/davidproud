// GET /api/published?kind=comment&slug=<post>   → approved responses on a post
// GET /api/published?kind=testimonial           → approved testimonials
//
// Approved items only, and only the fields meant for the public — email
// addresses, IP hashes and moderation notes never leave the database.

import { json } from '../../lib/util.js';

const LIMIT = 300;

export const onRequestGet = async ({ request, env }) => {
  if (!env.DB) return json({ items: [] });

  const params = new URL(request.url).searchParams;
  const kind = params.get('kind') === 'testimonial' ? 'testimonial' : 'comment';
  const slug = (params.get('slug') ?? '').slice(0, 200);

  if (kind === 'comment' && !slug) return json({ items: [] });

  try {
    // Responses read oldest-first, as a conversation does; testimonials lead
    // with the most recent.
    const statement = kind === 'comment'
      ? env.DB.prepare(
          `SELECT name, body, created_at FROM submissions
            WHERE kind = 'comment' AND slug = ? AND status = 'approved'
            ORDER BY created_at ASC LIMIT ${LIMIT}`,
        ).bind(slug)
      : env.DB.prepare(
          `SELECT name, role, body, created_at FROM submissions
            WHERE kind = 'testimonial' AND status = 'approved'
            ORDER BY created_at DESC LIMIT ${LIMIT}`,
        );

    const { results } = await statement.all();

    const items = (results ?? []).map((row) => ({
      name: row.name,
      role: row.role ?? undefined,
      body: row.body,
      created_at: new Date(row.created_at * 1000).toISOString(),
    }));

    return json({ items }, 200, { 'cache-control': 'public, max-age=30' });
  } catch {
    return json({ items: [] });
  }
};
