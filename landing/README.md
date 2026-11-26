# Landing page

Everything in this folder is copied as it is to the root of the site
(`https://enoughmoney.app/`) when the app is built. The app itself is built
into `dist/app/` and served at `https://enoughmoney.app/app/` (decided in
v0.43.0). This README is not copied.

## Rules for the landing page

- **Plain static files.** No build step: what is here is what is served.
  Vite does not process these files, so reference assets with absolute
  paths (`/landing.css`, `/images/hero.webp`).
- **Content Security Policy.** The whole site gets the app's policy from
  `_headers` (written by `vite.config.ts`): scripts, styles, fonts and images
  only from this site (images also as `data:`), no inline `<script>`, no
  `<style>` blocks and no `style="…"` attributes, no third-party fonts,
  analytics or embeds. Self-host fonts and images in this folder. A new
  outside resource needs a change to `contentSecurityPolicy` in
  `vite.config.ts`, which also applies to the app, so ask first.
- **Keep `legacy-redirect.js` as the first script in `<head>`** of
  `index.html`. It sends old links (`/#budget`) and home screen icons saved
  before v0.43.0 on to `/app/`.
- **Keep `sw.js`.** It retires the old app's service worker at the root.
  Do not add a service worker or a web app manifest to the landing page; the
  installable app is `/app/` only.
- **Do not create an `app/` folder here**; that path belongs to the app.
- The app's icons are at `/app/icons/` and can be used here. Link to the
  app as `/app/`.
- Colours: purple `#4b2a68` (theme), background `#faf8fc`; the logo is
  `/app/icons/icon.svg`.

## Pictures

`images/` holds phone screenshots of the app with the test database's
sample household. Retake them all when a pictured screen changes:
`npm run landing:screenshots` (needs `.env.test` and `cwebp`, from
`brew install webp`). It reseeds the test project, photographs the app
(`landing-screenshots/shots.spec.ts`, saving nothing) and writes
600px-wide WebP files here. A new picture: add a `shot(…)` to that spec.

`email/` holds pictures for the emails Supabase sends
(`supabase/templates/`), as JPEG or PNG because email clients do not show
WebP. `email/envelopes.jpg` is `images/envelopes.webp` cut to its envelope
rows (600 × 836); cut it again when that picture is retaken.

## Sections and the old-link redirect

`legacy-redirect.js` forwards any `#…` address to the app, except the
landing page's own sections listed in it (`#why`, `#how-it-works`,
`#faq`). A new in-page link needs its id added there;
`e2e/landing.spec.ts` checks this.

## Previewing

`npm run build`, then `npx wrangler@4.148.0 dev` serves `dist/` the way
Cloudflare will (with `_headers`) at <http://localhost:8787/>. `npm run dev`
serves only the app, at <http://localhost:5173/app/>.
