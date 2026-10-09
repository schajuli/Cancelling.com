// Gemeinsam für content.js (Buchungsübersicht) und quiet.js (Buchungsdetailseite):
// liest das gebuchte Zimmer aus dem Abschnitt "Ihre Zimmerinformationen".
//
// Aufbau bei Booking (Stand 10/2026), jeweils eigene Textstücke:
//   Ihre Zimmerinformationen
//   Ganzes Studio            ← Art der Unterkunft
//   Studio                   ← gebuchte Zimmerkategorie
//   Zimmerkategorie ändern   ← Link, Ende des Blocks
(() => {
  if (globalThis.CancellingRoom) return;

  const START_RE = /^(?:ihre?\s+zimmer(?:informationen|details)?|zimmerinformationen|ihre\s+wohneinheit(?:en)?|your\s+room(?:s|\s+info(?:rmation)?|\s+details)?|room\s+info(?:rmation)?)$/i;
  const STOP_RE = /zimmerkategorie ändern|zimmer ändern|change room|change your room|zimmerdetails|room details|name des gastes|guest name|maximale belegung|max(?:imum)? occupancy|^preis|^price|^gesamtpreis|^total price/i;
  const TYPE_RE = /^(?:ganze[srn]?|entire|privat\w*|private|geteilt\w*|shared|gemeinsam\w*)\b/i;
  const SKIP_RE = /^(?:garantiert|guaranteed|genius|bestätigt|confirmed|details|einzelheiten|mehr|more|\d+\s*(?:x|×))$/i;

  // Alle sichtbaren Textstücke eines Elements der Reihe nach (ohne Skripte)
  function textsOf(root) {
    const out = [];
    const w = (root.ownerDocument || document).createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement && n.parentElement.closest('script,style,noscript,template,.sf-badge,.sf-panel')
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    let n;
    while ((n = w.nextNode())) {
      const t = n.nodeValue.replace(/\s+/g, ' ').trim();
      if (t) out.push(t);
    }
    return out;
  }

  function fromTexts(texts) {
    const rooms = [];
    for (let i = 0; i < texts.length; i++) {
      if (!START_RE.test(texts[i])) continue;
      let type = '';
      let name = '';
      for (let j = i + 1; j < Math.min(texts.length, i + 12); j++) {
        const t = texts[j];
        if (STOP_RE.test(t) || START_RE.test(t)) break;
        if (t.length < 2 || t.length > 120 || SKIP_RE.test(t)) continue;
        if (TYPE_RE.test(t)) { type = type || t; continue; }
        name = t;
        break;
      }
      const room = name || type;
      if (room && !rooms.includes(room)) rooms.push(room);
    }
    return rooms.slice(0, 4).join(' + ');
  }

  // Schlüssel, unter dem das Zimmer gespeichert wird: auth_key bzw. Buchungsnummer aus der URL
  function bookingIdFromUrl(href) {
    try {
      const u = new URL(href, location.href);
      for (const k of ['auth_key', 'bn', 'res_id', 'reservation_id']) {
        const v = u.searchParams.get(k);
        if (v) return `${k}=${v}`;
      }
    } catch { /* egal */ }
    return '';
  }

  globalThis.CancellingRoom = { textsOf, fromTexts, bookingIdFromUrl };
})();
