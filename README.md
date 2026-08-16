# davidproud.uk

Poetry & philosophy site for David Proud. Astro (static) + Sveltia CMS, hosted free on Cloudflare Pages. David writes/publishes himself at **/admin**.

## Local dev
```
npm install
npm run dev      # http://localhost:4321  (site)
                 # http://localhost:4321/admin  (content manager, local mode)
npm run build    # -> dist/
```

## Content model
- Writings live in `src/content/writings/*.md` (frontmatter: title, date, category, topic, excerpt, image, draft).
  `category: Poetry` renders on /poetry/, `Philosophy` on /writings/.
- Blog posts live in `src/content/blog/*.md` (title, date, excerpt, image, comments, draft) → /blog/.
- Photos, testimonials and editable page copy: `src/content/{photos,testimonials,pages}/`.
- Uploaded pictures go to `public/uploads/` (served at `/uploads/...`).
- Schema enforced in `src/content.config.ts`.

## Responses & testimonials (the small API)

Visitors can send a response on a blog post and a testimonial on /testimonials/.
**Nothing is published until David approves it at /moderate/** — that moderation
step, not the spam check, is what keeps the site clean.

- **Where it runs:** Cloudflare Pages Functions in `functions/`, shared code in
  `lib/`. `wrangler pages deploy` compiles them automatically — the existing CI
  command needs no change.
- **Store:** D1 database `davidproud-responses` (id `0a5b2a4d-2c77-4347-8631-301f5a39b1a4`),
  bound as `DB` in `wrangler.toml`. Schema in `migrations/`.
  Apply with `npx wrangler d1 execute davidproud-responses --remote --file=./migrations/0001_create_submissions.sql`.
- **Endpoints:** `POST /api/submit`, `GET /api/published`, `POST /api/auth/login`,
  `GET /api/auth/callback`, `POST /api/auth/logout`, `GET /api/moderate/list`,
  `POST /api/moderate/act`.
- **Rendering:** approved items are fetched client-side, so approving something
  shows it immediately — no rebuild, and no spam ever enters the git repo.

### Spam layers
Honeypot field → minimum fill time → Cloudflare Turnstile → 5-per-hour per-IP
rate limit (IPs stored only as a salted hash) → content scoring (score ≥ 5 is
dropped silently, lower scores are flagged for David) → moderation.

A *forged* Turnstile token is refused. A *missing* one is allowed through and
flagged `no spam-check`, so a reader whose widget failed to load does not lose
what they wrote. Turnstile does not render in CDP-controlled browsers, so it
cannot be exercised by automated tests — check it by eye in a real browser.

### Secrets (Pages → production)
`SESSION_SECRET`, `TURNSTILE_SECRET_KEY`, `MODERATOR_PASSPHRASE`, `MODERATOR_EMAIL`,
and — once a Resend account exists — `RESEND_API_KEY` and `MAIL_FROM`.
Set with `npx wrangler pages secret put NAME --project-name davidproud`.
Without the Resend pair, notification email and the emailed sign-in link are
skipped; David signs in at /moderate/ with the passphrase instead.
Turnstile site key (public) lives in `src/config.ts`.

## Deploy (Cloudflare Pages)
1. Push this repo to GitHub (account that owns it = the OWNER below).
2. Cloudflare Pages → Create project → connect the GitHub repo.
   - Build command: `npm run build`
   - Output dir: `dist`
3. Add custom domain `davidproud.uk` (domain's nameservers must already point to Cloudflare).

## CMS login (the one setup task)
Sveltia's GitHub backend needs OAuth. Set `backend.repo` in `public/admin/config.yml`
to `OWNER/davidproud`, then wire auth:
- Easiest: deploy the **sveltia-cms-auth** Cloudflare Worker (GitHub OAuth relay),
  create a GitHub OAuth App, set `base_url` in config.yml to the Worker URL.
- David logs in at davidproud.uk/admin with the dedicated `davidproud-site`
  GitHub account (created by Asaf, who holds the recovery email + password).

`local_backend: true` is on so the CMS can be tried locally before OAuth is set up.

## Status
Scaffold complete + builds clean (2026-08-03). Placeholder content in place.
TODO: real content, GitHub repo + username, Cloudflare Pages project, OAuth relay,
optional image compression, David's photo/bio on /about.
