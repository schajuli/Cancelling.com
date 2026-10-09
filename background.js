// Lädt Buchungsdetailseiten, falls sie auf einer anderen booking.com-Subdomain liegen
// als die Übersicht (Content-Scripts dürfen das wegen CORS nicht selbst).
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'sf-open-help') { chrome.runtime.openOptionsPage(); return; }
  if (!msg || msg.type !== 'sf-fetch') return;
  fetch(msg.url, { credentials: 'include' })
    .then((r) => r.text())
    .then((text) => sendResponse({ ok: true, text }))
    .catch((e) => sendResponse({ ok: false, error: String(e) }));
  return true; // asynchrone Antwort
});

// Nach der Installation einmal die Hilfeseite zeigen
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') chrome.runtime.openOptionsPage();
});
