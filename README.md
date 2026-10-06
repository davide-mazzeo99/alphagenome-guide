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
Beginner material lives in `extras/` and is **not** part of the guide: `00-start-here.md` (S1–S5: plain-language intro, route chooser, glossary, how to read results, what to trust) and `10-practical-guides.md` (G0–G7: step-by-step worked examples from the AlphaGenome paper). Files with a prefix below `50` are placed before the reference guide, others after it; each `##` heading becomes a section. Rebuilding also checks that every internal link points to an existing heading and turns references such as `§6.6.1`, `G2` or `S4` into links automatically. The paper-derived facts come from Avsec et al., Nature 2026, [doi:10.1038/s41586-025-10014-0](https://doi.org/10.1038/s41586-025-10014-0).

Conventions the build relies on: `## N. Title` sections listed in the `## Contents` list; `### 6.x` subsections become collapsible recipe cards; tables in §1 are sortable and in §7 filterable; `>` blockquotes become Tip/Warning/Note callouts; the first table under `### 5.1` becomes the "common pitfall" callout; labelled code blocks under `### 4.2` become tabs. Sections listed in Contents but missing from the guide render as a visible `TODO` stub (and an HTML `TODO` comment).

## Deploy to GitHub Pages
*Settings → Pages → Source: GitHub Actions*. The workflow `.github/workflows/pages.yml` publishes the committed `dist/` on every push to `main` that touches `dist/`. It does not rebuild, so run `npm run build` and commit `dist/` first. (GitHub's branch-based Pages only offers `/` or `/docs`, which is why Actions is used for `dist/`.)

## Notes
- Never put an API key in the site; the placeholder is `ALPHA_GENOME_API_KEY`.
- The snippet builder generates code from the guide's recipes §6.5 and §6.6.1 (verbatim function bodies). If the API changes, update the guide and `src/builder.js` together.
