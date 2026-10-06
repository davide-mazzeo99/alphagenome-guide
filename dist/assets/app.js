/* AlphaGenome Guide — vanilla JS, no dependencies. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var root = document.documentElement;

  /* ---- theme (persisted in try/catch) ---- */
  var themeBtn = $('#theme-btn');
  function isDark() {
    var t = root.getAttribute('data-theme');
    return t ? t === 'dark' : window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function syncTheme() { if (themeBtn) themeBtn.setAttribute('aria-pressed', String(isDark())); }
  if (themeBtn) themeBtn.addEventListener('click', function () {
    var next = isDark() ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('ag-theme', next); } catch (e) { /* storage unavailable */ }
    syncTheme();
  });
  syncTheme();

  /* ---- mobile sidebar ---- */
  var menuBtn = $('#menu-btn'), scrim = $('#scrim');
  function setNav(open) {
    document.body.classList.toggle('nav-open', open);
    if (menuBtn) menuBtn.setAttribute('aria-expanded', String(open));
    if (scrim) scrim.hidden = !open;
  }
  if (menuBtn) menuBtn.addEventListener('click', function () { setNav(!document.body.classList.contains('nav-open')); });
  if (scrim) scrim.addEventListener('click', function () { setNav(false); });
  $$('.sidebar a').forEach(function (a) { a.addEventListener('click', function () { setNav(false); }); });

  /* ---- copy (clipboard API with file:// fallback) ---- */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
    }
    return legacyCopy(text);
  }
  function legacyCopy(text) {
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { /* ignore */ }
      document.body.removeChild(ta);
      ok ? resolve() : reject(new Error('copy failed'));
    });
  }
  function flash(btn, msg) {
    var old = btn.getAttribute('data-label') || btn.textContent;
    btn.setAttribute('data-label', old);
    btn.textContent = msg; btn.classList.add('done');
    setTimeout(function () { btn.textContent = old; btn.classList.remove('done'); }, 1500);
  }
  window.agCopy = function (text, btn) {
    return copyText(text).then(function () { flash(btn, 'Copied'); }, function () { flash(btn, 'Press Ctrl+C'); });
  };
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.copy-btn, [data-copy-from]');
    if (!b) return;
    var src = b.getAttribute('data-copy-from');
    var el = src ? $(src) : b.closest('.code-block').querySelector('code');
    if (el) window.agCopy(el.textContent, b);
  });

  /* ---- tabs (ARIA, arrow keys) ---- */
  $$('[data-tabs]').forEach(function (tabs) {
    var list = $('[role="tablist"]', tabs), btns = $$('[role="tab"]', list);
    function select(i, focus) {
      btns.forEach(function (b, j) {
        var on = i === j;
        b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1;
        $('#' + b.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) btns[i].focus();
    }
    btns.forEach(function (b, i) { b.addEventListener('click', function () { select(i); }); });
    list.addEventListener('keydown', function (e) {
      var i = btns.indexOf(document.activeElement);
      if (i < 0) return;
      var n = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: btns.length - 1 }[e.key];
      if (n === undefined) return;
      e.preventDefault(); select((n + btns.length) % btns.length, true);
    });
  });

  /* ---- decision helper ---- */
  $$('#model-helper input[name="model"]').forEach(function (r) {
    r.addEventListener('change', function () {
      $$('#helper-result .result').forEach(function (d) { d.hidden = d.getAttribute('data-i') !== r.value; });
    });
  });

  /* ---- sortable tables ---- */
  function cellVal(td) {
    var t = td.textContent.trim(), n = parseFloat(t.replace(/,/g, ''));
    return isNaN(n) || !/^[\d.,\s~≈±-]+$/.test(t) ? t.toLowerCase() : n;
  }
  $$('table[data-sortable]').forEach(function (tbl) {
    $$('thead th', tbl).forEach(function (th, col) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'sort'; b.innerHTML = th.innerHTML;
      th.innerHTML = ''; th.appendChild(b); th.setAttribute('aria-sort', 'none');
      b.addEventListener('click', function () {
        var dir = th.getAttribute('aria-sort') === 'ascending' ? -1 : 1;
        $$('thead th', tbl).forEach(function (o) { o.setAttribute('aria-sort', 'none'); });
        th.setAttribute('aria-sort', dir === 1 ? 'ascending' : 'descending');
        var body = tbl.tBodies[0];
        $$('tr', body).sort(function (a, c) {
          var x = cellVal(a.cells[col]), y = cellVal(c.cells[col]);
          return (x > y ? 1 : x < y ? -1 : 0) * dir;
        }).forEach(function (r) { body.appendChild(r); });
      });
    });
  });

  /* ---- filterable tables (text box + a dropdown for each low-cardinality column) ---- */
  $$('table[data-filterable]').forEach(function (tbl) {
    var wrap = tbl.closest('.table-wrap'), tools = document.createElement('div');
    tools.className = 'table-tools';
    var q = document.createElement('input');
    q.type = 'search'; q.placeholder = 'Filter rows…'; q.setAttribute('aria-label', 'Filter table rows');
    tools.appendChild(q);
    var rows = $$('tbody tr', tbl), heads = $$('thead th', tbl).map(function (t) { return t.textContent.trim(); });
    var selects = [];
    heads.forEach(function (h, col) {
      var vals = {};
      rows.forEach(function (r) { var v = r.cells[col] && r.cells[col].textContent.trim(); if (v) vals[v] = 1; });
      var keys = Object.keys(vals).sort();
      if (keys.length < 2 || keys.length > 12 || keys.length === rows.length) return;
      var s = document.createElement('select'); s.setAttribute('aria-label', 'Filter by ' + h);
      s.innerHTML = '<option value="">' + h + ': all</option>' + keys.map(function (k) { return '<option>' + k.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</option>'; }).join('');
      s.setAttribute('data-col', col); tools.appendChild(s); selects.push(s);
    });
    // Use-case catalogue: "task" (use-case column) and "output type" (keywords found in the outputs/scorers column).
    var taskCol = heads.findIndex(function (h) { return /use case/i.test(h); });
    var outCol = heads.findIndex(function (h) { return /output|scorer/i.test(h); });
    var taskSel = null, outSel = null;
    if (taskCol >= 0) {
      taskSel = document.createElement('select'); taskSel.setAttribute('aria-label', 'Filter by task');
      taskSel.innerHTML = '<option value="">Task: all</option>' + rows.map(function (r, i) {
        return '<option value="' + i + '">' + r.cells[taskCol].textContent.trim().replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</option>';
      }).join('');
      tools.appendChild(taskSel);
    }
    if (outCol >= 0) {
      var kw = {};
      rows.forEach(function (r) { (r.cells[outCol].textContent.match(/[A-Z][A-Z0-9]{2,}(?:_[A-Z0-9]+)*/g) || []).forEach(function (k) { kw[k] = 1; }); });
      var kws = Object.keys(kw).sort();
      if (kws.length > 1) {
        outSel = document.createElement('select'); outSel.setAttribute('aria-label', 'Filter by output type');
        outSel.innerHTML = '<option value="">Output type: all</option>' + kws.map(function (k) { return '<option>' + k + '</option>'; }).join('');
        tools.appendChild(outSel);
      }
    }
    var count = document.createElement('span'); count.className = 'count'; count.setAttribute('aria-live', 'polite');
    tools.appendChild(count);
    wrap.parentNode.insertBefore(tools, wrap);
    function apply() {
      var term = q.value.trim().toLowerCase(), n = 0;
      rows.forEach(function (r) {
        var ok = !term || r.textContent.toLowerCase().indexOf(term) >= 0;
        if (ok && taskSel && taskSel.value && String(rows.indexOf(r)) !== taskSel.value) ok = false;
        if (ok && outSel && outSel.value && r.cells[outCol].textContent.indexOf(outSel.value) < 0) ok = false;
        selects.forEach(function (s) { if (ok && s.value && r.cells[+s.getAttribute('data-col')].textContent.trim() !== s.value) ok = false; });
        r.hidden = !ok; if (ok) n++;
      });
      count.textContent = n + ' of ' + rows.length + ' rows';
    }
    q.addEventListener('input', apply); [taskSel, outSel].forEach(function (s) { if (s) s.addEventListener('change', apply); }); selects.forEach(function (s) { s.addEventListener('change', apply); }); apply();
  });

  /* ---- recipe <details>: open when targeted, expand for print ---- */
  function openTarget() {
    var el = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    var d = el && el.closest('details'); if (d) d.open = true;
    var p = el && el.closest('[role="tabpanel"][hidden]');
    if (p) { var t = $('#' + p.getAttribute('aria-labelledby')); if (t) t.click(); }
    if (el && (d || p)) el.scrollIntoView();
  }
  window.addEventListener('hashchange', openTarget); openTarget();
  var closedBefore = [];
  window.addEventListener('beforeprint', function () {
    closedBefore = $$('details:not([open])'); closedBefore.forEach(function (d) { d.open = true; });
  });
  window.addEventListener('afterprint', function () { closedBefore.forEach(function (d) { d.open = false; }); });

  /* ---- scroll-spy + "On this page" ---- */
  var sections = $$('.guide-section[id]'), navLinks = $$('.sidebar a[data-section]');
  var toc = $('#toc-list'), active = null, ticking = false;
  function buildToc(sec) {
    if (!toc) return;
    toc.innerHTML = '';
    $$('h3[id]', sec).forEach(function (h) {
      var li = document.createElement('li'), a = document.createElement('a');
      a.href = '#' + h.id; a.textContent = h.textContent.replace(/^#/, '');
      li.appendChild(a); toc.appendChild(li);
    });
    toc.parentNode.style.visibility = toc.children.length ? 'visible' : 'hidden';
  }
  function spy() {
    ticking = false;
    var cur = sections[0];
    sections.forEach(function (s) { if (s.getBoundingClientRect().top <= 120) cur = s; });
    if (cur && cur !== active) {
      active = cur;
      navLinks.forEach(function (a) {
        var on = a.getAttribute('data-section') === cur.id;
        if (on) { a.setAttribute('aria-current', 'true'); if (a.scrollIntoView && !document.body.classList.contains('nav-open')) a.scrollIntoView({ block: 'nearest' }); }
        else a.removeAttribute('aria-current');
      });
      buildToc(cur);
    }
    if (toc) {
      var hs = $$('h3[id]', active || document), best = null;
      hs.forEach(function (h) { if (h.getBoundingClientRect().top <= 120) best = h; });
      $$('a', toc).forEach(function (a) { best && a.getAttribute('href') === '#' + best.id ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current'); });
    }
  }
  if (sections.length) {
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(spy); } }, { passive: true });
    window.addEventListener('resize', spy); spy();
  }

  /* ---- search: prebuilt index (assets/search-index.js) + prefix/typo-tolerant scoring ---- */
  var input = $('#search'), box = $('#search-results'), idx = window.SEARCH_INDEX || [], sel = -1, built = false;
  var stem = function (w) { return w.length > 4 ? w.replace(/(ing|ed|es|s)$/, '') : w; };
  function lev1(a, b) { // true if edit distance <= 1
    if (Math.abs(a.length - b.length) > 1) return false;
    var i = 0, j = 0, d = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++d > 1) return false;
      if (a.length > b.length) i++; else if (a.length < b.length) j++; else { i++; j++; }
    }
    return d + (a.length - i) + (b.length - j) <= 1;
  }
  function build() {
    if (built) return; built = true;
    idx.forEach(function (e) {
      e.tl = e.title.toLowerCase(); e.xl = (e.title + ' ' + e.text).toLowerCase();
      e.words = {}; (e.xl.match(/[a-z0-9_.:+-]{2,}/g) || []).forEach(function (w) { e.words[stem(w)] = 1; });
    });
  }
  function score(e, toks) {
    var s = 0;
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i], st = stem(t), ts = 0;
      if (e.tl.indexOf(t) >= 0) ts += 8;
      if (e.xl.indexOf(t) >= 0) ts += 4;
      else {
        for (var w in e.words) {
          if (w.indexOf(st) === 0) { ts += 2; break; }
          if (t.length >= 5 && lev1(st, w)) { ts += 1; break; }
        }
      }
      if (!ts) return 0; // every term must match somewhere
      s += ts;
    }
    return s;
  }
  function snippet(e, toks) {
    var low = e.text.toLowerCase(), at = -1;
    for (var i = 0; i < toks.length && at < 0; i++) at = low.indexOf(toks[i]);
    var from = Math.max(0, at - 40), txt = e.text.slice(from, from + 120);
    return (from > 0 ? '…' : '') + txt + (from + 120 < e.text.length ? '…' : '');
  }
  var escH = function (s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
  function hl(s, toks) {
    var out = escH(s);
    toks.forEach(function (t) { if (t.length > 1) out = out.replace(new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>'); });
    return out;
  }
  function close() { box.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); sel = -1; }
  function run() {
    var toks = input.value.toLowerCase().split(/\s+/).filter(Boolean);
    if (!toks.length) return close();
    build();
    var res = idx.map(function (e) { return { e: e, s: score(e, toks) }; }).filter(function (r) { return r.s; })
      .sort(function (a, b) { return b.s - a.s; }).slice(0, 8);
    box.innerHTML = res.length ? res.map(function (r, i) {
      return '<li role="presentation"><a role="option" id="sr-' + i + '" aria-selected="false" href="index.html#' + r.e.id + '">' +
        '<div class="r-title">' + hl(r.e.title, toks) + '</div><div class="r-sec">' + escH(r.e.section) + '</div>' +
        '<div class="r-snip">' + hl(snippet(r.e, toks), toks) + '</div></a></li>';
    }).join('') : '<li class="empty" role="presentation">No results</li>';
    box.hidden = false; input.setAttribute('aria-expanded', 'true'); sel = -1;
  }
  function move(d) {
    var items = $$('a[role="option"]', box); if (!items.length) return;
    sel = (sel + d + items.length) % items.length;
    items.forEach(function (a, i) { a.setAttribute('aria-selected', String(i === sel)); });
    input.setAttribute('aria-activedescendant', items[sel].id); items[sel].scrollIntoView({ block: 'nearest' });
  }
  if (input) {
    input.addEventListener('input', run);
    input.addEventListener('focus', function () { if (input.value) run(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') { var a = $$('a[role="option"]', box)[Math.max(sel, 0)]; if (a) { e.preventDefault(); a.click(); } }
      else if (e.key === 'Escape') { if (!box.hidden) close(); else { input.value = ''; input.blur(); } }
    });
    box.addEventListener('click', function (e) { if (e.target.closest('a')) { close(); input.blur(); } });
    document.addEventListener('click', function (e) { if (!e.target.closest('.search')) close(); });
    document.addEventListener('keydown', function (e) {
      var tag = (document.activeElement && document.activeElement.tagName) || '';
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(tag) && !e.ctrlKey && !e.metaKey) { e.preventDefault(); input.focus(); input.select(); }
    });
  }
})();
