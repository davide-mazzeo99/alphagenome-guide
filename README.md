# AlphaGenome Guide — static website

Unofficial internal site generated from `AlphaGenome_Guide.md` (the single source of truth).
No backend, no CDN at runtime: Markdown rendering and syntax highlighting happen at build time, so `dist/` has zero third-party runtime dependencies.

## Open locally
Open `dist/index.html` directly in a browser (works from `file://`). Pages: `index.html` (whole guide, anchored sections) and `snippet-builder.html`.

## Rebuild after editing the guide
```bash
npm install      # first time only (marked, prismjs, playwright)
npm run build    # rewrites dist/
npm run check    # headless-browser self-check + screenshots in screenshots/
```
Conventions the build relies on: `## N. Title` sections listed in the `## Contents` list; `### 6.x` subsections become collapsible recipe cards; tables in §1 are sortable and in §7 filterable; `>` blockquotes become Tip/Warning/Note callouts; the first table under `### 5.1` becomes the "common pitfall" callout; labelled code blocks under `### 4.2` become tabs. Sections listed in Contents but missing from the guide render as a visible `TODO` stub (and an HTML `TODO` comment).

## Deploy to GitHub Pages
*Settings → Pages → Source: GitHub Actions*. The workflow `.github/workflows/pages.yml` publishes the committed `dist/` on every push to `main` that touches `dist/`. It does not rebuild, so run `npm run build` and commit `dist/` first. (GitHub's branch-based Pages only offers `/` or `/docs`, which is why Actions is used for `dist/`.)

## Notes
- Never put an API key in the site; the placeholder is `ALPHA_GENOME_API_KEY`.
- The snippet builder generates code from the guide's recipes §6.5 and §6.6.1 (verbatim function bodies). If the API changes, update the guide and `src/builder.js` together.
