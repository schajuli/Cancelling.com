const KEY = 'sf-settings';
const TEXT = {
  de: { auto: 'Automatisch (wie Booking)', saved: 'Gespeichert' },
  en: { auto: 'Automatic (match Booking)', saved: 'Saved' },
};

function uiLang(value) {
  if (value === 'de' || value === 'en') return value;
  return (navigator.language || 'en').toLowerCase().startsWith('de') ? 'de' : 'en';
}

function label(value) {
  const t = TEXT[uiLang(value)];
  document.getElementById('auto').textContent = t.auto;
  document.documentElement.lang = uiLang(value);
  return t;
}

(async () => {
  const r = await chrome.storage.sync.get(KEY);
  const current = (r[KEY] || {}).language || 'auto';
  document.querySelector(`input[value="${current}"]`).checked = true;
  label(current);

  for (const input of document.querySelectorAll('input[name="language"]')) {
    input.addEventListener('change', async () => {
      const settings = { ...(r[KEY] || {}), language: input.value };
      await chrome.storage.sync.set({ [KEY]: settings });
      const t = label(input.value);
      const saved = document.getElementById('saved');
      saved.textContent = t.saved;
      setTimeout(() => { saved.textContent = ''; }, 1500);
    });
  }
})();
