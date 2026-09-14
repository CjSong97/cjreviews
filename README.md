# CJ Reviews

A review site for in-ear monitors, headphones, and games, written by one person
and published from Notion. Astro renders on demand; Notion is the only content
store.

**Live:** https://cjreviews.co.uk

## Stack

| Piece | Choice |
|---|---|
| Framework | Astro 6, `output: "server"` |
| Interactivity | Svelte 5 (runes), only where client state is genuinely needed |
| Styling | Tailwind v4 via `@tailwindcss/vite` — tokens in `src/styles/tailwind.css` |
| Motion | GSAP + Lenis |
| CMS | Notion, via `@notionhq/client` |
| Host | Vercel, `@astrojs/vercel` with 60s ISR |
| Tests | Vitest |

Node **>= 22.12.0** is required (see `engines` in `package.json`).

## Environment variables

Create a `.env` in the project root. It is gitignored; never commit it.

| Variable | Required | Description |
|---|---|---|
| `NOTION_TOKEN` | Yes | Notion integration token. The integration must be shared with the Cj Reviews database, or every query returns empty. |
| `NOTION_DATA_SOURCE_ID` | Yes | The Notion **data source** id — not the database id. Under Notion's data-source model a database contains one or more data sources, and the API expects the inner id. |
| `NOTION_PUBLISHED_MODE` | No | How strictly to filter published posts: `checkboxOnly`, `preferStatus` (default), or `requireStatus`. See `src/lib/notion/adapter.ts`. |

The same three are set in Vercel under **Project → Settings → Environment
Variables**, for Production, Preview, and Development.

## Local development

```sh
npm install
npm run dev        # http://localhost:4321
```

| Command | Action |
|---|---|
| `npm run dev` | Dev server on port 4321 |
| `npm run build` | Production build |
| `npm run preview` | Serve the build locally |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Vitest in watch mode |

## Deploying

The site deploys to Vercel from `master`.

1. Push to `master`. Vercel builds automatically; a PR gets a preview URL.
2. Build command `npm run build`, output handled by `@astrojs/vercel` — no
   output directory to configure.
3. Confirm the three environment variables are present for the target
   environment **before** the first deploy of a new Vercel project. A missing
   `NOTION_TOKEN` fails the build, not the request.
4. After deploy, check a review page and the homepage: both hit Notion at request
   time, so a green build does not by itself prove content renders.

To deploy by hand from a working tree:

```sh
npx vercel --prod
```

### Content publishing

Content ships without a deploy. Tick **Published** on a row in the Cj Reviews
database (and set **Status** to `Published` under the default `preferStatus`
mode); it appears within ~60 seconds on the next request, because pages are
rendered on demand and cached by ISR for 60s.

## Troubleshooting

**Build fails with `NOTION_DATA_SOURCE_ID is not set`**
`src/lib/notion/adapter.ts` throws at module load when the variable is absent, so
this surfaces as a build failure rather than a runtime 500. Add the variable to
`.env` locally, or to the Vercel environment for the failing environment
specifically — setting it for Production alone leaves Preview broken.

**A newly published post doesn't appear**
Wait 60 seconds and refresh: ISR caches each path for that long. If it still
doesn't show, the row almost certainly fails the published filter — under the
default `preferStatus` mode, `Published` must be ticked *and* `Status` must be
`Published` if the Status property exists. Check the slug too: a post needs a
`Canonical Slug`, or a formula `Slug` that resolves, or `pageToReviewPost`
throws.

**Images 404, 403, or vanish after an hour**
Notion serves uploaded files from S3 behind signed URLs carrying
`X-Amz-Expires=3600`. Any raw Notion URL that reaches the browser dies an hour
later. Every image must go through `ProxyImage.astro` → `/api/img/[kind]/[id]`.
Never construct a proxy URL by hand and never embed an S3 URL — see
`agent-os/product/decisions.md` → *Notion Image Proxy*.

**A page 500s that used to build fine**
Under on-demand rendering, Zod validation at the CMS boundary fails at request
time rather than at build time. A malformed Notion row now takes down one page
instead of the whole build. Check the Vercel function logs for the Zod error and
fix the row.

**`@astrojs/vercel` upgrade breaks the build**
It must stay on the **v10** line. v11 requires Astro 7 and this project is on
Astro 6.

## Project layout

```text
src/
  lib/
    cms/types.ts           domain types, no Notion imports
    cms/catalogue.ts       aggregate figures for the About page (pure, tested)
    notion/adapter.ts      Notion → CMS translation and the public query API
    notion/images.ts       the single authority for public image URLs
    audio/curve.ts         tuning-signature curves (pure, tested)
    motion/scroll.ts       all GSAP / ScrollTrigger / Lenis setup
  components/              hero, rack, instrument, compare, controls, article
  layouts/BaseLayout.astro shared head, chrome, analytics
  pages/                   routes, plus the image proxy, RSS, and sitemap
  styles/tailwind.css      @theme design tokens — the single token system
```

## Conventions

Three documents govern changes here. They are gitignored and live only in the
working tree:

- `DESIGN.md` — the Signal Path design system, and the PR gate checklist
- `agent-os/product/code-style.md` — TypeScript, component, and styling rules
- `agent-os/product/decisions.md` — architectural decisions and their reasoning

The rules most likely to bite: no hydration by default (`client:load` is reserved
for the canvas hero), every numeral mono with `tabular-nums`, no raw Notion S3
URL in served HTML, and a working `prefers-reduced-motion` path for anything that
moves.
