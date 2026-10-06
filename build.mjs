// Build the static site from AlphaGenome_Guide.md.  Usage: npm run build
// Runtime has zero third-party dependencies: Markdown and syntax highlighting happen here, at build time.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';

const require = createRequire(import.meta.url);
const Prism = require('prismjs');
require('prismjs/components/')(['python', 'bash']);

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = process.env.OUT_DIR ? path.resolve(process.env.OUT_DIR) : path.join(ROOT, 'dist');
const ASSETS = path.join(DIST, 'assets');
const SRC = fs.readFileSync(process.env.GUIDE_MD || path.join(ROOT, 'AlphaGenome_Guide.md'), 'utf8');

const SITE_TITLE = 'AlphaGenome Guide';
const LINKS = {
  docs: 'https://alphagenomedocs.com',
  access: 'https://deepmind.google.com/science/alphagenome',
  github: 'https://github.com/google-deepmind/alphagenome',
  ols: 'https://www.ebi.ac.uk/ols4',
};

// ---------- helpers ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slug = (s) => s.toLowerCase().replace(/[`*_]/g, '').replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s/g, '-');
const used = new Set();
const uniq = (id) => { let i = id, n = 1; while (used.has(i)) i = `${id}-${n++}`; used.add(i); return i; };
const headings = []; // {level,text,id}
let tableAttr = '';
let uid = 0;

const marked = new Marked({ gfm: true });
marked.use({
  renderer: {
    code(code, info) {
      const lang = (info || '').trim().split(/\s+/)[0].toLowerCase();
      const grammar = Prism.languages[lang];
      const body = grammar ? Prism.highlight(code, grammar, lang) : esc(code);
      return `<div class="code-block"><div class="code-head"><span class="lang-badge">${esc(lang || 'text')}</span>` +
        `<button type="button" class="copy-btn" aria-label="Copy code to clipboard">Copy</button></div>` +
        `<pre tabindex="0"><code class="language-${esc(lang || 'text')}">${body.replace(/\n$/, '')}</code></pre></div>\n`;
    },
    heading(text, level, raw) {
      const id = uniq(slug(raw));
      headings.push({ level, text: raw, id });
      return `<h${level} id="${id}"><a class="anchor" href="#${id}" aria-label="Link to this heading">#</a>${text}</h${level}>\n`;
    },
    blockquote(quote) {
      const plain = quote.replace(/<[^>]+>/g, ' ');
      let kind = 'note';
      const m = plain.match(/^\s*(Tip|Warning|Caution|Note|Important)\b/i);
      if (m) kind = /warning|caution|important/i.test(m[1]) ? 'warning' : /tip/i.test(m[1]) ? 'tip' : 'note';
      else if (/rule of thumb|tip:|hint/i.test(plain)) kind = 'tip';
      else if (/warning|never|caution|must not|do not|pitfall/i.test(plain)) kind = 'warning';
      const label = { tip: 'Tip', warning: 'Warning', note: 'Note' }[kind];
      return `<aside class="callout callout-${kind}" role="note"><p class="callout-title">${label}</p>${quote}</aside>\n`;
    },
    table(header, body) {
      return `<div class="table-wrap" tabindex="0" role="region" aria-label="Table (scrolls horizontally)"><table ${tableAttr}><thead>${header}</thead><tbody>${body}</tbody></table></div>\n`;
    },
    link(href, title, text) {
      const ext = /^https?:/i.test(href);
      return `<a href="${esc(href)}"${title ? ` title="${esc(title)}"` : ''}${ext ? ' target="_blank" rel="noopener"' : ''}>${text}</a>`;
    },
  },
});
const render = (tokens) => { const arr = [...tokens]; arr.links = {}; return marked.parser(arr); };
const inline = (s) => marked.parseInline(s);
const plain = (s) => s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[`*_>#|]/g, ' ').replace(/-{3,}/g, ' ').replace(/\s+/g, ' ').trim();

// ---------- parse the guide ----------
const tokens = marked.lexer(SRC);
let title = SITE_TITLE, subtitle = '', checked = '';
const contents = []; // {title,id}
const sections = new Map(); // id -> {title,id,tokens}
let cur = null, inContents = false, seenH1 = false;
for (const t of tokens) {
  if (t.type === 'heading' && t.depth === 1 && !seenH1) {
    seenH1 = true; title = t.text; continue;
  }
  if (t.type === 'heading' && t.depth === 2) {
    inContents = /^contents$/i.test(t.text.trim());
    if (inContents) { cur = null; continue; }
    const id = slug(t.text);
    cur = { title: t.text, id, tokens: [] };
    sections.set(id, cur);
    continue;
  }
  if (!seenH1 || t.type === 'space') continue;
  if (inContents) {
    if (t.type === 'list') t.items.forEach((it, i) => {
      const m = it.raw.match(/\[(.+?)\]\(#([^)]+)\)/);
      // Contents is an ordered list, so the "1." marker is not part of the link text: restore it.
      if (m) contents.push({ title: /^\d+\./.test(m[1]) ? m[1] : `${(+t.start || 1) + i}. ${m[1]}`, id: m[2] });
    });
    continue;
  }
  if (!cur) {
    if (t.type === 'paragraph') { const ls = t.text.split('\n'); subtitle = ls[0] || ''; checked = ls[1] || ''; }
    continue;
  }
  if (t.type === 'hr') continue;
  cur.tokens.push(t);
}
const order = contents.length ? contents : [...sections.values()].map(({ title, id }) => ({ title, id }));
for (const s of sections.values()) if (!order.some((o) => o.id === s.id)) order.push({ title: s.title, id: s.id });

// ---------- render sections ----------
const num = (t) => { const m = t.match(/^(\d+)\./); return m ? +m[1] : 0; };
const splitSubs = (toks) => {
  const intro = [], subs = [];
  let sub = null;
  for (const t of toks) {
    if (t.type === 'heading' && t.depth === 3) { sub = { head: t, tokens: [] }; subs.push(sub); }
    else (sub ? sub.tokens : intro).push(t);
  }
  return { intro, subs };
};

const tabsHtml = (tabs) => {
  const g = ++uid;
  const list = tabs.map((t, i) => `<button type="button" role="tab" id="tab-${g}-${i}" aria-controls="panel-${g}-${i}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${esc(t.label)}</button>`).join('');
  const panels = tabs.map((t, i) => `<div role="tabpanel" id="panel-${g}-${i}" aria-labelledby="tab-${g}-${i}" data-label="${esc(t.label)}" tabindex="0"${i === 0 ? '' : ' hidden'}>${t.html}</div>`).join('');
  return `<div class="tabs" data-tabs><div role="tablist" aria-label="Installation method">${list}</div>${panels}</div>\n`;
};

function renderSubBody(sub, ctx) {
  const n = sub.head.text.match(/^(\d+\.\d+)/)?.[1] || '';
  // 4.2 -> tabbed install commands (+ Colab tab from 4.3)
  if (n === '4.2') {
    const tabs = [], out = []; let at = -1;
    for (let i = 0; i < sub.tokens.length; i++) {
      const t = sub.tokens[i], nx = sub.tokens[i + 1];
      const m = t.type === 'paragraph' && t.raw.trim().match(/^\*\*([^*]+?):?\*\*:?$/);
      if (m && nx && nx.type === 'code') {
        if (at < 0) { at = out.length; out.push(null); }
        tabs.push({ label: m[1].replace(/\s*\(.*\)/, '').replace(/^from source$/i, 'From source'), html: `<p class="tab-note">${esc(m[1])}</p>` + render([nx]) });
        i++;
      } else out.push(t);
    }
    if (tabs.length >= 2) {
      if (ctx.colab) tabs.push({ label: 'Colab', html: ctx.colab });
      return out.map((t, i) => (i === at ? tabsHtml(tabs) : render([t]))).join('');
    }
  }
  // 5.1 -> coordinate table as a pitfall callout
  if (n === '5.1') {
    return sub.tokens.map((t) => t.type === 'table'
      ? `<aside class="callout callout-pitfall" role="note"><p class="callout-title">⚠️ Common pitfall: coordinate systems</p>${render([t])}</aside>\n`
      : render([t])).join('');
  }
  return render(sub.tokens);
}

function renderSection(o) {
  const s = sections.get(o.id);
  const n = num(o.title);
  if (!s) {
    return `<section id="${o.id}" class="guide-section" data-num="${n}" data-stub>
<!-- TODO: section "${esc(o.title)}" is listed in the guide's Contents but missing from AlphaGenome_Guide.md. Add it and rebuild. -->
<h2><a class="anchor" href="#${o.id}" aria-label="Link to this heading">#</a>${esc(o.title)}</h2>
<aside class="callout callout-note" role="note"><p class="callout-title">Note</p><p>This section is not in the version of <code>AlphaGenome_Guide.md</code> used for this build.${n === 6 ? ' The recipe cards (6.1–6.14) will appear here automatically as collapsible cards once the <code>### 6.x</code> subsections exist in the guide.' : ''} <strong>TODO:</strong> add it to the guide and run <code>npm run build</code>.</p></aside>
${n === 11 ? citationHtml(null) : ''}
</section>`;
  }
  headings.push({ level: 2, text: o.title, id: o.id });
  used.add(o.id);
  tableAttr = n === 1 ? 'data-sortable' : n === 7 ? 'data-filterable data-sortable' : '';
  const { intro, subs } = splitSubs(s.tokens);
  const ctx = {};
  const colabSub = subs.find((x) => /^4\.3/.test(x.head.text));
  if (n === 4 && colabSub) ctx.colab = '<p class="tab-note">Google Colab</p>' + render(colabSub.tokens);
  let html = `<section id="${o.id}" class="guide-section" data-num="${n}">\n<h2><a class="anchor" href="#${o.id}" aria-label="Link to this heading">#</a>${inline(esc(o.title).replace(/&#39;/g, "'"))}</h2>\n`;
  html += render(intro);
  for (const sub of subs) {
    if (n === 6) {
      const id = uniq(slug(sub.head.text));
      headings.push({ level: 3, text: sub.head.text, id });
      html += `<details class="recipe" id="${id}"><summary><h3><a class="anchor" href="#${id}" aria-label="Link to this recipe">#</a>${inline(sub.head.text)}</h3></summary><div class="recipe-body">${render(sub.tokens)}</div></details>\n`;
    } else {
      html += render([sub.head]) + renderSubBody(sub, ctx);
    }
  }
  if (n === 11) html += citationHtml(s);
  tableAttr = '';
  return html + '</section>\n';
}

function citationHtml(s) {
  let text = null, bib = null;
  if (s) {
    const walk = (ts) => { for (const t of ts) {
      if (t.type === 'code' && /@\w+\s*\{/.test(t.text)) bib = bib || t.text;
      if (t.type === 'paragraph' && /Avsec/.test(t.text)) text = text || plain(t.text);
      if (t.items) t.items.forEach((it) => walk(it.tokens || []));
      if (t.tokens && t.type === 'blockquote') walk(t.tokens);
    } };
    walk(s.tokens);
  }
  if (text && !bib) {
    // Derive BibTeX from the guide's citation line (no extra facts added).
    const m = text.match(/et al\.\s+(.+?\.)\s+(\w+)\s+(\d+),\s*([\d–-]+)\s*\((\d{4})\)\.\s*doi:(\S+)/);
    if (m) bib = `@article{avsec${m[5]}alphagenome,\n  author  = {Avsec, {\\v{Z}}. and others},\n  title   = {${m[1].replace(/\.$/, '')}},\n  journal = {${m[2]}},\n  volume  = {${m[3]}},\n  pages   = {${m[4].replace('–', '--')}},\n  year    = {${m[5]}},\n  doi     = {${m[6]}}\n}`;
  }
  const fallbackText = 'Avsec et al., Nature 2026 — AlphaGenome (Google DeepMind). TODO: full reference from guide §11.';
  const fallbackBib = '% TODO: add the BibTeX entry from guide §11 (not present in this build of the guide).';
  return `<div class="citation card">
<h3 class="plain-h">Cite AlphaGenome</h3>
<pre id="cite-text" class="cite" tabindex="0">${esc(text || fallbackText)}</pre>
<pre id="cite-bib" class="cite" tabindex="0">${esc(bib || fallbackBib)}</pre>
<div class="btn-row"><button type="button" class="btn" data-copy-from="#cite-text">Copy citation (plain text)</button><button type="button" class="btn" data-copy-from="#cite-bib">Copy BibTeX</button></div>
</div>\n`;
}

const sectionHtml = order.map(renderSection).join('\n');

// ---------- home (hero, cards, decision helper) ----------
const findId = (re) => headings.find((h) => re.test(h.text))?.id;
const sec1 = sections.get(order.find((o) => num(o.title) === 1)?.id);
const whatIs = sec1?.tokens.find((t) => t.type === 'paragraph');
const cardTarget = {
  install: '#' + (order.find((o) => num(o.title) === 4)?.id || ''),
  predict: '#' + (findId(/^5\.6/) || ''),
  score: 'snippet-builder.html',
  splice: '#' + (findId(/^2\.1/) || ''),
};

// Decision helper data comes straight from the guide's tables (§2 comparison, §3 access).
function tableOf(sec) { return sec?.tokens.find((t) => t.type === 'table'); }
function decisionData() {
  const out = [];
  try {
    const t2 = tableOf(sections.get(order.find((o) => num(o.title) === 2)?.id));
    const row = (re) => t2.rows.find((r) => re.test(r[0].text));
    const rq = row(/question/i), ri = row(/^input/i), ro = row(/^output/i), ra = row(/^access/i);
    const names = ['AlphaGenome', 'AlphaFold', 'AlphaMissense'];
    const href2 = '#' + order.find((o) => num(o.title) === 2)?.id;
    names.forEach((name, i) => out.push({ name, q: rq[i + 1].text, rows: [['Input', ri[i + 1].text], ['Output', ro[i + 1].text], ['Access', ra[i + 1].text]], href: href2 }));
    const t3 = tableOf(sections.get(order.find((o) => num(o.title) === 3)?.id));
    const at = t3.rows.find((r) => /atlas/i.test(r[0].text));
    out.push({ name: 'AlphaGenome Atlas', q: at[1].text, rows: [['Route', at[0].text], ['Cost / licence', at[2].text], ['Hardware', at[3].text]], href: '#' + order.find((o) => num(o.title) === 3)?.id });
  } catch (e) { console.warn("decision helper:", e.stack); }
  return out;
}
const decision = decisionData();
const decisionHtml = decision.length ? `<div class="card helper" id="model-helper"><h3 class="plain-h">Which DeepMind model do I need?</h3>
<fieldset><legend>I want to know…</legend>
${decision.map((d, i) => `<label class="opt"><input type="radio" name="model" value="${i}"><span>${inline(d.q)}</span></label>`).join('\n')}
</fieldset>
<div id="helper-result" aria-live="polite">
${decision.map((d, i) => `<div class="result" data-i="${i}" hidden><p class="result-name">→ ${esc(d.name)}</p><dl>${d.rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${inline(v)}</dd>`).join('')}</dl><p><a href="${d.href}">Read more in this guide</a></p></div>`).join('\n')}
</div></div>` : '';

const homeHtml = `<section id="home" class="guide-section" data-num="0">
<h1>${inline(title)}</h1>
<p class="subtitle">${inline(subtitle)}</p>
<h2 class="plain-h">What is AlphaGenome</h2>
${whatIs ? render([whatIs]) : '<!-- TODO: §1 intro paragraph missing -->'}
<div class="cards">
<a class="card link-card" href="${cardTarget.install}"><span class="card-kicker">1</span><strong>Install</strong><span>Python ≥ 3.10 · pip, conda, uv, source or Colab · API key</span></a>
<a class="card link-card" href="${cardTarget.predict}"><span class="card-kicker">2</span><strong>Predict tracks</strong><span><code>predict_sequence</code>, <code>predict_interval</code>, <code>predict_variant</code></span></a>
<a class="card link-card" href="${cardTarget.score}"><span class="card-kicker">3</span><strong>Score variants</strong><span>Scalar ALT-vs-REF effect scores — try the snippet builder</span></a>
<a class="card link-card" href="${cardTarget.splice}"><span class="card-kicker">4</span><strong>Splicing</strong><span><code>SPLICE_SITES</code>, <code>SPLICE_SITE_USAGE</code>, <code>SPLICE_JUNCTIONS</code></span></a>
</div>
${decisionHtml}
<p class="updated">${inline(checked)} · Site built ${new Date().toISOString().slice(0, 10)}.</p>
</section>\n`;

// ---------- page chrome ----------
const navItems = [{ id: 'home', title: 'Home' }, ...order];
const navHtml = (page) => `<ul>${navItems.map((o) => `<li><a href="${page === 'index' ? '' : 'index.html'}#${o.id}" data-section="${o.id}">${esc(o.title)}</a></li>`).join('')}
<li class="nav-sep"><a href="snippet-builder.html" data-page="builder"${page === 'builder' ? ' aria-current="page"' : ''}>Snippet builder</a></li></ul>`;

const layout = ({ page, pageTitle, body, scripts }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${esc(pageTitle)}</title>
<meta name="description" content="Unofficial internal guide to AlphaGenome: installation, variant scoring, splicing analysis and troubleshooting.">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<script>try{var t=localStorage.getItem('ag-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
<link rel="stylesheet" href="assets/style.css">
</head>
<body data-page="${page}">
<a class="skip" href="#main">Skip to content</a>
<header class="topbar">
<button type="button" class="icon-btn menu-btn" id="menu-btn" aria-label="Toggle navigation" aria-expanded="false" aria-controls="sidebar"><svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
<a class="brand" href="${page === 'index' ? '#home' : 'index.html'}">${SITE_TITLE}</a>
<div class="search" role="search">
<input id="search" type="search" placeholder="Search the guide  ( / )" aria-label="Search the guide" role="combobox" aria-expanded="false" aria-controls="search-results" aria-autocomplete="list" autocomplete="off" spellcheck="false">
<ul id="search-results" role="listbox" aria-label="Search results" hidden></ul>
</div>
<button type="button" class="icon-btn" id="theme-btn" aria-label="Toggle light/dark theme" title="Toggle theme"><svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2a8 8 0 1 0 8 8 6 6 0 0 1-8-8z" fill="currentColor"/></svg></button>
</header>
<div class="layout">
<nav class="sidebar" id="sidebar" aria-label="Guide sections">${navHtml(page)}</nav>
<div class="scrim" id="scrim" hidden></div>
<div class="content-wrap">
<main id="main" class="content" tabindex="-1">
${body}
<footer class="site-footer">
<p>Unofficial internal guide — not affiliated with Google DeepMind. AlphaGenome API and weights are for non-commercial use.</p>
<p>Official resources:
<a href="${LINKS.docs}" target="_blank" rel="noopener">AlphaGenome docs</a> ·
<a href="${LINKS.access}" target="_blank" rel="noopener">API access &amp; terms</a> ·
<a href="${LINKS.github}" target="_blank" rel="noopener">GitHub repository</a> ·
<a href="${LINKS.ols}" target="_blank" rel="noopener">EBI OLS (ontology terms)</a></p>
</footer>
</main>
${page === 'index' ? '<aside class="toc" aria-label="On this page"><p class="toc-title">On this page</p><ul id="toc-list"></ul></aside>' : ''}
</div>
</div>
${scripts}
</body>
</html>
`;

// ---------- search index ----------
const index = [];
for (const o of order) {
  const s = sections.get(o.id);
  if (!s) continue;
  const { intro, subs } = splitSubs(s.tokens);
  const txt = (ts) => ts.map((t) => (t.type === 'code' ? t.text : plain(t.raw))).join(' ');
  index.push({ id: o.id, title: o.title, section: o.title, text: txt(intro) });
  for (const sub of subs) {
    const h = headings.find((x) => x.level === 3 && x.text === sub.head.text);
    index.push({ id: h?.id || o.id, title: sub.head.text, section: o.title, text: txt(sub.tokens) });
  }
}
index.forEach((e) => { e.text = e.text.slice(0, 6000); });

// ---------- snippet builder page ----------
const builderBody = fs.readFileSync(path.join(ROOT, 'src', 'builder.template.html'), 'utf8');

// ---------- write ----------
fs.mkdirSync(ASSETS, { recursive: true });
for (const f of ['style.css', 'app.js', 'builder.js']) fs.copyFileSync(path.join(ROOT, 'src', f), path.join(ASSETS, f));
fs.writeFileSync(path.join(ASSETS, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#0a6a85"/><path d="M9 6c0 7 14 7 14 14s-14 7-14 0m0-7h14M9 20h14" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>');
fs.writeFileSync(path.join(ASSETS, 'search-index.js'), 'window.SEARCH_INDEX=' + JSON.stringify(index) + ';');
fs.writeFileSync(path.join(DIST, 'index.html'), layout({
  page: 'index', pageTitle: `${title} — ${SITE_TITLE}`,
  body: `<article>\n${homeHtml}${sectionHtml}</article>`,
  scripts: '<script src="assets/search-index.js"></script>\n<script src="assets/app.js"></script>',
}));
fs.writeFileSync(path.join(DIST, 'snippet-builder.html'), layout({
  page: 'builder', pageTitle: `Snippet builder — ${SITE_TITLE}`, body: `<article>\n${builderBody}</article>`,
  scripts: '<script src="assets/search-index.js"></script>\n<script src="assets/app.js"></script>\n<script src="assets/builder.js"></script>',
}));
fs.writeFileSync(path.join(DIST, '.nojekyll'), '');
console.log(`Built ${order.length} sections (${order.filter((o) => !sections.has(o.id)).length} stubbed), ${index.length} search entries → dist/`);
