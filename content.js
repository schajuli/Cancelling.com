(() => {
  'use strict';
  if (window.__cancelling) return;
  window.__cancelling = true;

  const LOG = (...a) => console.log('[Cancelling]', ...a);
  const TTL = 6 * 60 * 60 * 1000; // Cache: 6 Stunden
  const DAY = 864e5;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Seiten, auf denen das Plugin aktiv wird
  const PAGE_RE = /mytrips|myreservations|trips|reservations|bookings|mybooking/i;
  // Kennzeichnung in der Buchungskarte ("· Kostenlose Stornierung")
  const MARKER_RE = /kostenlose\s+stornierung|free\s+cancell?ation|nicht\s+erstattungsf(?:ä|ae)hig|non-?refundable|teilweise\s+erstattungsf|partially\s+refundable/i;
  const NONREF_RE = /nicht\s+erstattungsf(?:ä|ae)hig|non-?refundable|keine\s+kostenlose\s+stornierung|no\s+free\s+cancell?ation/i;
  const PRICE_RE = /^(?:€|eur|chf|us\$|\$|£)\s?[\d.,\s]+$|^[\d.,\s]+\s?(?:€|eur|chf)$/i;
  // Links, die nie automatisch aufgerufen werden
  const SKIP_RE = /cancel|storn|modify|change|payment|invoice|review|message|chat|logout|print|delete/i;
  const DETAIL_RE = /(mytrips|myreservations|confirmation|booking_details|mybooking|manage|reservation)/i;

  const MONTHS = {
    januar: 0, jänner: 0, jaenner: 0, january: 0, jan: 0, jän: 0,
    februar: 1, february: 1, feb: 1, feber: 1,
    märz: 2, maerz: 2, mär: 2, march: 2, mar: 2, mrz: 2,
    april: 3, apr: 3,
    mai: 4, may: 4,
    juni: 5, june: 5, jun: 5,
    juli: 6, july: 6, jul: 6,
    august: 7, aug: 7,
    september: 8, sep: 8, sept: 8,
    oktober: 9, october: 9, okt: 9, oct: 9,
    november: 10, nov: 10,
    dezember: 11, december: 11, dez: 11, dec: 11,
  };

  // "Sie können diese Buchung vor dem Fr., 16. Oktober 2026 kostenlos stornieren." u. ä.
  const PHRASES = [
    /(?:kostenlos|kostenfrei|gebührenfrei|gratis)\w*\s+(?:storn\w*|absagen)\s+(?:bis|vor)\b(.{0,80})/i,
    /storn\w*\s+(?:ist\s+|sind\s+)?(?:kostenlos|kostenfrei|gebührenfrei)\w*\s+(?:bis|vor)\b(.{0,80})/i,
    /(?:bis|vor)\b(.{3,60}?)\s(?:kostenlos|kostenfrei|gebührenfrei)\w*\s+storn/i,
    /free\s+cancell?ation\s+(?:until|before|till|by)\b(.{0,80})/i,
    /cancel\s+(?:for\s+free|free\s+of\s+charge|without\s+(?:any\s+|a\s+)?(?:fee|charge|cost))\s+(?:until|before|by)\b(.{0,80})/i,
    /(?:until|before)\b(.{3,60}?)\s+(?:you\s+can\s+)?cancel\s+(?:for\s+free|free\s+of\s+charge)/i,
  ];
  const JSON_RE = /"(?:free_?cancell?ation_?(?:until|deadline|date)|freeCancell?ation(?:Until|Deadline|Date)|cancell?ation_?deadline|cancell?ationDeadline)"\s*:\s*"([^"]{6,40})"/i;

  // ---------- Datum erkennen ----------
  function timeIn(s) {
    const t = s.match(/\b(\d{1,2}):(\d{2})\s*(am|pm|a\.m\.|p\.m\.)?/);
    if (!t) return [undefined, undefined];
    let h = +t[1];
    if (t[3] && t[3].startsWith('p') && h < 12) h += 12;
    if (t[3] && t[3].startsWith('a') && h === 12) h = 0;
    return [h, t[2]];
  }

  function build(y, mo, d, hh, mm) {
    if (!(mo >= 0 && mo <= 11) || !(d >= 1 && d <= 31)) return null;
    const hasTime = hh !== undefined;
    const now = new Date();
    const date = new Date(y ?? now.getFullYear(), mo, d, hasTime ? +hh : 23, hasTime ? +mm : 59);
    if (isNaN(date)) return null;
    if (y == null && date < new Date(now - 60 * DAY)) date.setFullYear(date.getFullYear() + 1);
    return { date, hasTime };
  }

  function parseDate(raw) {
    const s = raw.toLowerCase();
    const iso = s.match(/(\d{4})-(\d{2})-(\d{2})(?:[t ](\d{2}):(\d{2}))?/);
    if (iso) return build(+iso[1], +iso[2] - 1, +iso[3], iso[4], iso[5]);
    const num = s.match(/\b(\d{1,2})[./](\d{1,2})[./](\d{2,4})\b/);
    if (num) {
      let y = +num[3];
      if (y < 100) y += 2000;
      return build(y, +num[2] - 1, +num[1], ...timeIn(s));
    }
    for (const x of s.matchAll(/\b(\d{1,2})\.?\s+([a-zäöü]{3,10})\.?(?:\s+(\d{4}))?/g)) {
      const mi = MONTHS[x[2]];
      if (mi !== undefined) return build(x[3] ? +x[3] : null, mi, +x[1], ...timeIn(s));
    }
    for (const x of s.matchAll(/\b([a-zäöü]{3,10})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?(?:\s+(\d{4}))?/g)) {
      const mi = MONTHS[x[1]];
      if (mi !== undefined) return build(x[3] ? +x[3] : null, mi, +x[2], ...timeIn(s));
    }
    return null;
  }

  function findDeadline(text, html) {
    const t = (text || '').replace(/\s+/g, ' ');
    for (const re of PHRASES) {
      const m = t.match(re);
      if (!m) continue;
      const d = parseDate(m[1]);
      if (d) {
        // "vor dem 16. Oktober" heißt: spätestens am 15. Oktober
        const before = /\b(vor|before)\b/i.test(m[0]) && !/\b(bis|until)\b/i.test(m[0]);
        if (before && !d.hasTime) {
          d.date = new Date(new Date(d.date.getFullYear(), d.date.getMonth(), d.date.getDate()) - 60000);
        }
        return { status: 'date', ...d, source: m[0].trim() };
      }
      return { status: 'text', label: m[0].trim().slice(0, 100) };
    }
    if (html) {
      const m = html.match(JSON_RE);
      if (m) { const d = parseDate(m[1]); if (d) return { status: 'date', ...d }; }
    }
    if (NONREF_RE.test(t)) return { status: 'nonref' };
    return null;
  }

  // ---------- Buchungskarten finden ----------
  const isOurs = (n) => {
    const el = n && (n.nodeType === 1 ? n : n.parentElement);
    return !!(el && el.closest && el.closest('.sf-badge, .sf-panel'));
  };

  function findMarkers() {
    const out = new Set();
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      if (!MARKER_RE.test(n.nodeValue)) continue;
      const el = n.parentElement;
      if (!el || isOurs(el) || el.closest('[role="tooltip"]')) continue;
      if ((el.textContent || '').length > 300) continue;
      if (!el.getClientRects().length) continue; // versteckt (z. B. zugeklappte Upgrade-Angebote)
      out.add(el);
    }
    return [...out];
  }

  function findCard(marker, markers) {
    let el = marker;
    while (el.parentElement && el.parentElement !== document.body) {
      const p = el.parentElement;
      if ((p.textContent || '').length > 3000) break;
      if (markers.some((m) => m !== marker && p.contains(m))) break;
      el = p;
    }
    return el;
  }

  function findPrice(card) {
    for (const el of card.querySelectorAll('*')) {
      if (isOurs(el) || el.childElementCount > 0) continue;
      const t = (el.textContent || '').trim();
      if (t.length < 25 && PRICE_RE.test(t)) return el;
    }
    return null;
  }

  function textWithoutBadges(card) {
    const c = card.cloneNode(true);
    c.querySelectorAll('.sf-badge').forEach((b) => b.remove());
    return c.textContent || '';
  }

  function bookingLink(card) {
    for (const a of card.querySelectorAll('a[href]')) {
      try {
        const u = new URL(a.href, location.href);
        if (!/(^|\.)booking\.com$/i.test(u.hostname)) continue;
        if (SKIP_RE.test(u.pathname) || !DETAIL_RE.test(u.pathname + u.search)) continue;
        return u.href;
      } catch { /* ignorieren */ }
    }
    return null;
  }

  // ---------- Tooltip auslesen (simuliertes Hovern) ----------
  function bodyMatches() {
    const set = new Set();
    const t = document.body.innerText || '';
    for (const re of PHRASES) {
      const g = new RegExp(re.source, 'gi');
      for (const m of t.matchAll(g)) set.add(m[0]);
    }
    return set;
  }

  function fire(el, types) {
    for (const type of types) {
      const Ctor = type.startsWith('pointer') && window.PointerEvent ? PointerEvent : MouseEvent;
      el.dispatchEvent(new Ctor(type, { bubbles: !/enter|leave/.test(type), cancelable: true, view: window }));
    }
  }

  async function readTooltip(marker) {
    const before = bodyMatches();
    const targets = [marker, ...marker.querySelectorAll('*')];
    for (const t of targets) {
      fire(t, ['pointerover', 'pointerenter', 'mouseover', 'mouseenter']);
      if (t.focus) try { t.focus({ preventScroll: true }); } catch { /* egal */ }
    }
    let found = null;
    for (let i = 0; i < 20 && !found; i++) {
      await sleep(100);
      for (const m of bodyMatches()) if (!before.has(m)) { found = m; break; }
    }
    for (const t of targets) {
      fire(t, ['pointerout', 'pointerleave', 'mouseout', 'mouseleave']);
      if (t.blur) try { t.blur(); } catch { /* egal */ }
    }
    await sleep(150);
    return found;
  }

  // ---------- Cache ----------
  const store = chrome.storage.local;
  async function cacheGet(key) {
    try {
      const v = (await store.get('sf:' + key))['sf:' + key];
      if (!v || Date.now() - v.ts > TTL) return null;
      if (v.date) v.date = new Date(v.date);
      return v;
    } catch { return null; }
  }
  async function cacheSet(key, info) {
    if (info.status === 'unknown') return;
    try {
      await store.set({ ['sf:' + key]: { ...info, date: info.date ? info.date.toISOString() : undefined, ts: Date.now() } });
    } catch (e) { LOG('Cache-Fehler', e); }
  }
  async function cacheClear() {
    try {
      const all = await store.get(null);
      await store.remove(Object.keys(all).filter((k) => k.startsWith('sf:')));
    } catch (e) { LOG('Cache-Fehler', e); }
  }

  async function fetchPage(url) {
    const u = new URL(url, location.href);
    if (u.origin === location.origin) return (await fetch(u.href, { credentials: 'include' })).text();
    const res = await chrome.runtime.sendMessage({ type: 'sf-fetch', url: u.href });
    if (!res || !res.ok) throw new Error((res && res.error) || 'Laden fehlgeschlagen');
    return res.text;
  }

  // ---------- Frist ermitteln ----------
  async function resolve(e) {
    // 1. Steht schon in der Karte (z. B. versteckter Tooltip)?
    const own = findDeadline(textWithoutBadges(e.card));
    if (own && own.status !== 'nonref') return own;

    // 2. Zwischengespeichert?
    const cached = await cacheGet(e.key);
    if (cached) return cached;

    // 3. Tooltip von "Kostenlose Stornierung" auslesen
    if (e.marker.isConnected && /kostenlos|free|teilweise|partially/i.test(e.marker.textContent)) {
      const tip = await readTooltip(e.marker);
      if (tip) {
        const info = findDeadline(tip);
        if (info) { LOG(e.title, 'aus Tooltip:', tip); await cacheSet(e.key, info); return info; }
      }
    }

    // 4. Detailseite laden (falls Link vorhanden)
    const url = bookingLink(e.card);
    if (url) {
      try {
        const html = await fetchPage(url);
        const doc = new DOMParser().parseFromString(html, 'text/html');
        doc.querySelectorAll('script,style,noscript,template').forEach((n) => n.remove());
        const info = findDeadline(doc.body ? doc.body.textContent : '', html);
        if (info) { LOG(e.title, 'aus Detailseite:', info); await cacheSet(e.key, info); return info; }
      } catch (err) { LOG('Detailseite fehlgeschlagen', err); }
    }

    if (own) return own;
    if (NONREF_RE.test(e.marker.textContent)) return { status: 'nonref' };
    return { status: 'unknown' };
  }

  // ---------- Sprache ----------
  const I18N = {
    de: {
      locale: 'de-AT',
      loading: 'Frist wird gesucht …',
      nonref: 'Nicht kostenlos stornierbar',
      text: 'Storno:',
      expired: 'Gratis-Storno abgelaufen',
      until: 'Gratis stornierbar bis',
      unknown: 'Stornofrist nicht gefunden',
      lastDay: 'letzter Tag!',
      daysLeft: (n) => (n === 1 ? 'noch 1 Tag' : `noch ${n} Tage`),
      panel: (n) => `Cancelling · ${n} Buchung${n === 1 ? '' : 'en'}`,
      soon: (n) => `${n} bald fällig`,
      foot: 'Angaben laut Booking, ohne Gewähr',
      reload: 'Neu laden',
      copy: 'Liste kopieren',
      copied: 'Kopiert ✓',
      copyFail: 'Kopieren fehlgeschlagen',
      copyHead: (ts) => `Meine Buchungen – kopiert am ${ts}`,
      source: (s) => `Booking: „${s}“`,
    },
    en: {
      locale: 'en-GB',
      loading: 'Looking for deadline …',
      nonref: 'Not free to cancel',
      text: 'Cancellation:',
      expired: 'Free cancellation expired',
      until: 'Free cancellation until',
      unknown: 'Deadline not found',
      lastDay: 'last day!',
      daysLeft: (n) => (n === 1 ? '1 day left' : `${n} days left`),
      panel: (n) => `Cancelling · ${n} booking${n === 1 ? '' : 's'}`,
      soon: (n) => `${n} due soon`,
      foot: 'Taken from Booking, no guarantee',
      reload: 'Reload',
      copy: 'Copy list',
      copied: 'Copied ✓',
      copyFail: 'Copy failed',
      copyHead: (ts) => `My bookings – copied on ${ts}`,
      source: (s) => `Booking: "${s}"`,
    },
  };
  let T = I18N.de;
  function applyLanguage(setting) {
    let lang = setting;
    if (!lang || lang === 'auto') {
      lang = (document.documentElement.lang || navigator.language || 'en').toLowerCase().startsWith('de') ? 'de' : 'en';
    }
    T = I18N[lang] || I18N.en;
  }
  async function loadSettings() {
    try {
      const r = await chrome.storage.sync.get('sf-settings');
      applyLanguage((r['sf-settings'] || {}).language);
    } catch { applyLanguage('auto'); }
  }

  // ---------- Anzeige ----------
  function fmtDate(info) {
    const o = { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' };
    if (info.hasTime) Object.assign(o, { hour: '2-digit', minute: '2-digit' });
    return info.date.toLocaleString(T.locale, o);
  }

  function describe(info) {
    switch (info.status) {
      case 'loading': return { cls: 'sf-loading', head: T.loading, rank: 9 };
      case 'nonref': return { cls: 'sf-bad', head: T.nonref, rank: 6 };
      case 'text': return { cls: 'sf-text', head: T.text, main: info.label, rank: 4 };
      case 'date': {
        const diff = info.date - new Date();
        if (diff < 0) return { cls: 'sf-bad', head: T.expired, main: fmtDate(info), rank: 5 };
        const days = Math.floor(diff / DAY);
        const rest = days === 0 ? T.lastDay : T.daysLeft(days);
        return { cls: days < 3 ? 'sf-soon' : 'sf-ok', head: T.until, main: fmtDate(info), sub: rest, rank: 1, sortDate: +info.date };
      }
      default: return { cls: 'sf-unknown', head: T.unknown, rank: 7 };
    }
  }

  function render(e) {
    if (!e.card.isConnected || !e.anchor || !e.anchor.isConnected) return;
    if (!e.badge || !e.badge.isConnected) {
      e.badge = document.createElement('div');
      e.badge.dataset.pos = e.anchor === e.marker ? 'line' : 'price';
      e.anchor.after(e.badge);
    }
    const d = describe(e.info);
    e.badge.className = `sf-badge sf-${e.badge.dataset.pos} ${d.cls}`;
    e.badge.textContent = '';
    for (const [cls, txt] of [['sf-head', d.head], ['sf-main', d.main], ['sf-sub', d.sub]]) {
      if (!txt) continue;
      const s = document.createElement('span');
      s.className = cls;
      s.textContent = txt;
      e.badge.append(s);
    }
    e.badge.title = e.info.source ? T.source(e.info.source) : '';
  }

  // ---------- Liste kopieren ----------
  function stayLine(e) {
    // Zeile "18. Okt.–19. Okt. · Vila Nova de Gaia · Kostenlose Stornierung" ohne den Storno-Teil
    let el = e.marker;
    while (el && el !== e.card && !/\d/.test(el.textContent)) el = el.parentElement;
    if (!el || (el.textContent || '').length > 200) return e.dates || '';
    return el.textContent
      .replace(new RegExp('\\s*[·•|,-]?\\s*(' + MARKER_RE.source + ')', 'gi'), '')
      .replace(/\s+/g, ' ')
      .replace(/\s*·\s*$/, '')
      .trim();
  }

  function cardLink(card) {
    const detail = bookingLink(card);
    if (detail) return detail;
    for (const a of card.querySelectorAll('a[href]')) {
      try {
        const u = new URL(a.href, location.href);
        if (/(^|\.)booking\.com$/i.test(u.hostname) && !SKIP_RE.test(u.pathname) && !/transport|taxi|car|attraction/i.test(u.pathname)) return u.href;
      } catch { /* ignorieren */ }
    }
    return '';
  }

  function buildCopyText() {
    const ts = new Date().toLocaleString(T.locale, { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const entries = [...state.values()]
      .filter((e) => e.lastSeen === scanCounter && e.card.isConnected)
      .sort((a, b) => (a.card.compareDocumentPosition(b.card) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    const lines = [T.copyHead(ts), ''];
    entries.forEach((e, i) => {
      const d = describe(e.info);
      lines.push(`${i + 1}. ${e.title}`);
      const stay = stayLine(e);
      if (stay) lines.push(`   ${stay}`);
      lines.push(`   ${[d.head, d.main].filter(Boolean).join(' ')}${d.sub ? ` (${d.sub})` : ''}`);
      const link = cardLink(e.card);
      if (link) lines.push(`   ${link}`);
      lines.push('');
    });
    return lines.join('\n').trim() + '\n';
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* Fallback */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.append(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch { return false; }
  }

  let panelOpen = false;
  function renderPanel(scanId) {
    let p = document.querySelector('.sf-panel');
    const entries = [...state.values()].filter((e) => e.lastSeen === scanId && e.card.isConnected);
    if (!entries.length) { if (p) p.remove(); return; }
    if (!p) {
      p = document.createElement('div');
      p.className = 'sf-panel';
      p.innerHTML = '<div class="sf-panel-body"><ul></ul><div class="sf-panel-foot"><span class="sf-foot-text"></span><span class="sf-actions"><button type="button" class="sf-copy"></button><button type="button" class="sf-reload"></button></span></div></div><button type="button" class="sf-panel-toggle"></button>';
      p.querySelector('.sf-panel-toggle').addEventListener('click', () => { panelOpen = !panelOpen; p.classList.toggle('sf-open', panelOpen); });
      p.querySelector('.sf-copy').addEventListener('click', async (ev) => {
        const btn = ev.currentTarget;
        const ok = await copyText(buildCopyText());
        btn.textContent = ok ? T.copied : T.copyFail;
        setTimeout(() => { btn.textContent = T.copy; }, 2000);
      });
      p.querySelector('.sf-reload').addEventListener('click', async () => {
        await cacheClear();
        state.forEach((e) => e.badge && e.badge.remove());
        state.clear();
        scan();
      });
      document.body.append(p);
    }
    p.classList.toggle('sf-open', panelOpen);
    const rows = entries.map((e) => ({ e, d: describe(e.info) }))
      .sort((a, b) => a.d.rank - b.d.rank || (a.d.sortDate || 0) - (b.d.sortDate || 0));
    const urgent = rows.filter((r) => r.d.cls === 'sf-soon').length;
    p.querySelector('.sf-panel-toggle').textContent = T.panel(entries.length) + (urgent ? ` · ${T.soon(urgent)}` : '');
    p.querySelector('.sf-foot-text').textContent = T.foot;
    p.querySelector('.sf-reload').textContent = T.reload;
    const cb = p.querySelector('.sf-copy');
    if (cb.textContent !== T.copied && cb.textContent !== T.copyFail) cb.textContent = T.copy;
    const ul = p.querySelector('ul');
    ul.textContent = '';
    for (const { e, d } of rows) {
      const li = document.createElement('li');
      li.className = d.cls;
      li.tabIndex = 0;
      const strong = document.createElement('strong');
      strong.textContent = e.title;
      li.append(strong, document.createTextNode([d.head, d.main, d.sub && `(${d.sub})`].filter(Boolean).join(' ')));
      const go = () => e.card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      li.addEventListener('click', go);
      li.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') go(); });
      ul.append(li);
    }
  }

  // ---------- Ablauf ----------
  const state = new Map();
  const queue = [];
  let running = false;
  let scanCounter = 0;

  async function processQueue() {
    if (running) return;
    running = true;
    let done = 0;
    while (queue.length) {
      done++;
      const e = state.get(queue.shift());
      if (!e) continue;
      let info;
      try { info = await resolve(e); } catch (err) { LOG('Fehler', e.title, err); info = { status: 'unknown' }; }
      e.tries = (e.tries || 0) + 1;
      if (info.status === 'unknown' && e.tries < 4) {
        // Booking hat die Karte evtl. gerade neu gezeichnet → später nochmal versuchen
        e.info = { status: 'loading' };
        setTimeout(() => { queue.push(e.key); processQueue(); }, 1500 * e.tries);
      } else {
        e.info = info;
      }
      render(e);
      renderPanel(scanCounter);
    }
    running = false;
    if (done) setTimeout(scan, 300); // nachgeladene Buchungen erfassen
  }

  function scan() {
    const id = ++scanCounter;
    if (!PAGE_RE.test(location.pathname + location.search)) { renderPanel(id); return; }
    const markers = findMarkers();
    const usedAnchors = new Set();
    let count = 0;
    for (const marker of markers) {
      const card = findCard(marker, markers);
      const anchor = findPrice(card) || marker;
      if (usedAnchors.has(anchor)) continue; // gleiche Karte schon erfasst → keine doppelte Anzeige
      usedAnchors.add(anchor);
      count++;
      const h = card.querySelector('h1,h2,h3,h4,h5,h6,[data-testid*="title" i],[data-testid*="name" i]');
      const title = ((h && h.textContent) || marker.textContent).replace(/\s+/g, ' ').trim().slice(0, 70);
      const dates = (card.textContent.match(/\d{1,2}\.\s*[A-Za-zÄÖÜäöü]{3,}\.?\s*[–-]\s*\d{1,2}\.\s*[A-Za-zÄÖÜäöü]{3,}\.?/) || [''])[0];
      const key = (title + '|' + (dates || marker.textContent)).replace(/\s+/g, ' ').trim().slice(0, 180);
      let e = state.get(key);
      if (!e) {
        e = { key, title, info: { status: 'loading' } };
        state.set(key, e);
        queue.push(key);
      }
      if (e.card !== card || e.anchor !== anchor) { if (e.badge) e.badge.remove(); e.badge = null; }
      e.card = card;
      e.anchor = anchor;
      e.marker = marker;
      e.title = title;
      e.dates = dates;
      e.lastSeen = id;
      render(e);
    }
    // Anzeigen von Einträgen, die es so nicht mehr gibt, entfernen
    for (const e of state.values()) {
      if (e.lastSeen !== id && e.badge) { e.badge.remove(); e.badge = null; }
    }
    // Verwaiste Kopien (z. B. wenn Booking Teile der Seite samt unserer Anzeige kopiert) löschen
    const live = new Set([...state.values()].map((e) => e.badge).filter(Boolean));
    document.querySelectorAll('.sf-badge').forEach((b) => { if (!live.has(b)) b.remove(); });
    if (count) LOG(`${count} Buchung(en) gefunden`);
    renderPanel(id);
    processQueue();
  }

  // Booking (React) zeichnet Teile der Seite neu und wirft dabei fremde Elemente raus.
  // Deshalb: bei Änderungen neu scannen – auch wenn unsere eigenen Hinweise entfernt wurden.
  let timer = null;
  const schedule = (ms = 400) => { clearTimeout(timer); timer = setTimeout(scan, ms); };
  new MutationObserver((muts) => {
    const relevant = muts.some((m) => {
      if (isOurs(m.target)) return false;
      if ([...m.removedNodes].some(isOurs)) return true; // unser Hinweis wurde entfernt
      const added = [...m.addedNodes];
      return added.length === 0 || !added.every(isOurs);
    });
    if (relevant) schedule();
  }).observe(document.body, { childList: true, subtree: true });

  // Sicherheitsnetz: regelmäßig prüfen, ob alle Hinweise noch da sind
  setInterval(() => {
    for (const e of state.values()) {
      if (e.lastSeen !== scanCounter) continue;
      if (!e.card.isConnected || !e.badge || !e.badge.isConnected) { schedule(0); return; }
    }
  }, 1500);

  // Sprache umgestellt (über das Extension-Symbol) → sofort neu anzeigen
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !changes['sf-settings']) return;
    applyLanguage((changes['sf-settings'].newValue || {}).language);
    state.forEach(render);
    renderPanel(scanCounter);
  });

  loadSettings().then(scan);
})();
