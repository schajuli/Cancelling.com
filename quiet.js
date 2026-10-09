// Schließt auf Booking-Buchungsseiten nur das Werbe-Fenster
// "Vergessen Sie nicht, Ihre Prämien zu nutzen" (Flughafentransfer, Auto, Aktivitäten …).
// Alle anderen Fenster – z. B. Storno-Bestätigungen – werden nicht angefasst.
(() => {
  'use strict';
  if (window.__cancellingQuiet) return;
  window.__cancellingQuiet = true;

  const PROMO_RE = /vergessen sie nicht,?\s+ihre prämien zu nutzen|don.?t forget (?:to use|about) your rewards|remember to use your rewards/i;
  const KEY = 'sf-settings';
  const handled = new WeakSet();
  let enabled = true;

  function isVisible(el) {
    return !!el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  }

  // Oberstes festes Element (Overlay) um den Dialog finden
  function overlayOf(dialog) {
    let top = dialog;
    for (let el = dialog; el && el !== document.body; el = el.parentElement) {
      if (getComputedStyle(el).position === 'fixed') top = el;
    }
    return top;
  }

  function close(dialog) {
    handled.add(dialog);
    console.log('[Cancelling] Werbe-Fenster geschlossen');
    // 1. Wie ein Mensch: auf das X klicken – so räumt Booking selbst sauber auf
    const btn = dialog.querySelector('button[aria-label*="schließen" i], button[aria-label*="close" i], button[aria-label*="dismiss" i]');
    if (btn) btn.click();
    // 2. Falls es danach noch da ist: nur ausblenden und Scrollen wieder erlauben
    setTimeout(() => {
      if (!dialog.isConnected || !isVisible(dialog)) return;
      overlayOf(dialog).style.setProperty('display', 'none', 'important');
      for (const el of [document.documentElement, document.body]) {
        el.style.removeProperty('overflow');
        el.style.removeProperty('position');
      }
    }, 300);
  }

  function check() {
    if (!enabled) return;
    for (const d of document.querySelectorAll('[role="dialog"], [aria-modal="true"], dialog')) {
      if (handled.has(d) || !isVisible(d)) continue;
      // Nur den Anfang prüfen: die Überschrift des Werbe-Fensters
      if (PROMO_RE.test((d.textContent || '').slice(0, 600))) close(d);
    }
  }

  let timer = null;
  new MutationObserver(() => {
    if (timer) return;
    timer = setTimeout(() => { timer = null; check(); }, 150);
  }).observe(document.body, { childList: true, subtree: true });

  chrome.storage.sync.get(KEY).then((r) => {
    enabled = ((r[KEY] || {}).hidePromos) !== false; // Standard: an
    check();
  }).catch(() => check());

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes[KEY]) enabled = ((changes[KEY].newValue || {}).hidePromos) !== false;
  });
})();
