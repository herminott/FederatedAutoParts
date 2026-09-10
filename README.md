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

## Preview (GitHub Pages)

Live preview: **https://herminott.github.io/FederatedAutoParts/**

This project is configured for GitHub project Pages:

- `site`: `https://herminott.github.io`
- `base`: `/FederatedAutoParts/`

On every push to `main`, [.github/workflows/deploy.yml](.github/workflows/deploy.yml) runs `npm ci` + `npm run build`, uploads `dist/`, and deploys with `actions/deploy-pages`. You can also trigger the workflow manually from the Actions tab (`workflow_dispatch`).

Repo Settings → Pages should use **Source: GitHub Actions**.

Internal nav/header/footer links use `import.meta.env.BASE_URL` so assets and routes resolve under `/FederatedAutoParts/`.

## Deploy notes

`public/_redirects` includes example Netlify 301 rules that map legacy WordPress-style date URLs to `/news/:slug/`. Adjust patterns to match your historical URL structure before go-live. Those redirects are not used by GitHub Pages.

**Caveat:** Markdown content under `src/content/` still has many absolute root paths (`/media/...`, `/about-federated/`, etc.). Those will 404 on project Pages until rewritten to include the base path (or served from a custom domain at `/`).
