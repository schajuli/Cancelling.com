// Gemeinsame Einstellungen für popup.html und help.html
(() => {
  const KEY = 'sf-settings';
  let settings = {};

  const resolveLang = (v) =>
    v === 'de' || v === 'en' ? v : (navigator.language || 'en').toLowerCase().startsWith('de') ? 'de' : 'en';

  function show() {
    const lang = resolveLang(settings.language);
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-lang]').forEach((el) => { el.hidden = el.dataset.lang !== lang; });
    const radio = document.querySelector(`input[name="language"][value="${settings.language || 'auto'}"]`);
    if (radio) radio.checked = true;
    const promo = document.querySelector('input[name="hidePromos"]');
    if (promo) promo.checked = settings.hidePromos !== false;
  }

  async function save(patch) {
    settings = { ...settings, ...patch };
    await chrome.storage.sync.set({ [KEY]: settings });
    show();
    const status = document.getElementById('saved');
    if (status) {
      status.textContent = resolveLang(settings.language) === 'de' ? 'Gespeichert' : 'Saved';
      clearTimeout(save.t);
      save.t = setTimeout(() => { status.textContent = ''; }, 1500);
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    try { settings = (await chrome.storage.sync.get(KEY))[KEY] || {}; } catch { settings = {}; }
    show();
    document.querySelectorAll('input[name="language"]').forEach((i) =>
      i.addEventListener('change', () => save({ language: i.value })));
    const promo = document.querySelector('input[name="hidePromos"]');
    if (promo) promo.addEventListener('change', () => save({ hidePromos: promo.checked }));
    const help = document.getElementById('open-help');
    if (help) help.addEventListener('click', (e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); window.close(); });
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes[KEY]) { settings = changes[KEY].newValue || {}; show(); }
  });
})();
