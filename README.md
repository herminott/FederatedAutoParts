# Federated Auto Parts

Static marketing and news site for Federated Auto Parts, built with [Astro](https://astro.build/).

Repository: https://github.com/herminott/FederatedAutoParts

## Stack

- Astro (static output)
- TypeScript
- Content Collections (Markdown + Zod schemas)

## Commands

| Command           | Action                                      |
| ----------------- | ------------------------------------------- |
| `npm install`     | Install dependencies                        |
| `npm run dev`     | Start local dev server (`localhost:4321`)   |
| `npm run build`   | Build production site to `./dist/`          |
| `npm run preview` | Preview the production build locally        |

Requires **Node.js 22.12+**.

## Project structure

```text
/
├── public/
│   └── _redirects          # Netlify-style redirects (WP date URLs → /news/:slug/)
├── src/
│   ├── components/
│   ├── content/
│   │   ├── news/           # News Markdown collection
│   │   └── pages/          # Marketing / legal page collection
│   ├── content.config.ts   # Collection loaders + Zod schemas
│   ├── layouts/
│   ├── pages/              # File-based routes
│   └── styles/
└── package.json
```

## Routes

- `/` — Home
- `/news/` — News index
- `/news/[slug]/` — News article
- `/[slug]/` — Marketing / legal pages from the `pages` collection
- `/find-a-store/` — Store locator stub (coming soon)

## Importing WordPress export content

A separate WordPress Markdown export lives at `/workspace/federated-rebuild` (or your local `content/news` + `content/pages` folders from that export).

To import:

1. Copy Markdown files into this project:
   - `content/news/*.md` → `src/content/news/`
   - `content/pages/*.md` → `src/content/pages/`
2. Ensure frontmatter matches the Zod schemas in `src/content.config.ts`.
3. Run `npm run build` and fix any schema validation errors.

Do **not** overwrite this Astro scaffold with the WordPress export wholesale — only migrate content files into `src/content/`.


## News search

Client-side search on `/news/` and category pages (`/news/category/:slug/`):

- Filters rendered news cards by title, description/excerpt, categories, and tags
- Debounced (~175ms), clear button, live result count, empty state
- URL `?q=` is kept in sync (shareable / bookmarkable)
- On `/news/` search spans the full index; on category pages it filters within that category only

No Pagefind / server index — suitable for GitHub Pages static hosting.

## Preview (GitHub Pages)

Live preview: **https://herminott.github.io/FederatedAutoParts/**

This project is configured for GitHub project Pages:

- `site`: `https://herminott.github.io`
- `base`: `/FederatedAutoParts/`

Internal nav/header/footer links use `import.meta.env.BASE_URL` so assets and routes resolve under `/FederatedAutoParts/`.

### Current publish path

The preview is published from the `gh-pages` branch (built `dist/` contents). Pages source: **Deploy from a branch → `gh-pages` / root**.

### GitHub Actions workflow (recommended next step)

A workflow is prepared at `.github/workflows/deploy.yml` (checkout → Node 22 → `npm ci` → `npm run build` → `upload-pages-artifact` → `deploy-pages`). Pushing it requires a GitHub token with the `workflow` scope (the current `gh` OAuth token only has `repo`).

To switch to Actions deploys:

1. `gh auth refresh -h github.com -s workflow,repo,read:org,gist`
2. Commit and push `.github/workflows/deploy.yml` to `main`
3. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**
   (or `gh api repos/herminott/FederatedAutoParts/pages -X PUT -f build_type=workflow`)

## Deploy notes

`public/_redirects` includes example Netlify 301 rules that map legacy WordPress-style date URLs to `/news/:slug/`. Adjust patterns to match your historical URL structure before go-live. Those redirects are not used by GitHub Pages.

Markdown content keeps root-absolute `/media/...` and internal `/...` links. At build time a rehype plugin (`rehypePrefixBase` in `src/lib/withBase.ts`) prefixes Astro `base` onto those URLs. Components use the `withBase()` helper for the same purpose.
