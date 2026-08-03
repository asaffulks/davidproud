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
- Writings live in `src/content/writings/*.md` (frontmatter: title, date, category, excerpt, image, draft).
- Uploaded pictures go to `public/uploads/` (served at `/uploads/...`).
- Schema enforced in `src/content.config.ts`.

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
