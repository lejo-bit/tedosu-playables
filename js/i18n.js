// =====================================================================
// I18N: language switching (English / Deutsch / Polski).
// The translation strings live in js/translations.js (loaded BEFORE this
// file) - edit that file to add or change translations.
// =====================================================================

const LANGUAGES = ['en', 'de', 'pl'];

// Returns the plural form index for a language + count:
//   en: 1 -> 0, other -> 1
//   de: always 0 (Leben is the same in both forms)
//   pl: 1 -> 0, 2-4 (except 12-14) -> 1, else -> 2
function pluralIndex(lang, n) {
  if (lang === 'pl') {
    if (n === 1) return 0;
    if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return 1;
    return 2;
  }
  return n === 1 ? 0 : 1;
}

let currentLang = 'en';

// Flag + native name per language (shown on the language button).
const LANGUAGE_FLAGS = { en: '🇬🇧', de: '🇩🇪', pl: '🇵🇱' };
const LANGUAGE_NAMES = { en: 'English', de: 'Deutsch', pl: 'Polski' };

// Keeps the flag button in sync with the current language.
function syncLanguageButton() {
  if (typeof document === 'undefined') return;
  const btn = document.getElementById('langBtn');
  if (!btn) return;
  btn.textContent = LANGUAGE_FLAGS[currentLang] || '🌐';
  btn.title = LANGUAGE_NAMES[currentLang] || currentLang;
}

// Cycles to the next language (en -> de -> pl -> en).
function cycleLanguage() {
  const idx = LANGUAGES.indexOf(currentLang);
  const next = LANGUAGES[(idx + 1) % LANGUAGES.length];
  setLanguage(next);
}

// Translates a key for the current language. `vars` fills {placeholders};
// array values are pluralized using vars.n and the language's plural rules.
function T(key, vars) {
  if (!key) return '';
  let val = strings[currentLang][key];
  if (val === undefined) val = strings.en[key];
  if (val === undefined) return key; // unknown key -> show the key itself
  if (Array.isArray(val)) {
    const n = vars && typeof vars.n === 'number' ? vars.n : 1;
    val = val[pluralIndex(currentLang, n)] || val[0];
  }
  if (vars) {
    val = val.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
  }
  return val;
}

// Applies data-i18n attributes to static HTML.
//   data-i18n             -> textContent
//   data-i18n-title       -> title attribute
//   data-i18n-placeholder -> placeholder attribute
function applyStaticTranslations() {
  if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return;
  const nodes = document.querySelectorAll('[data-i18n]');
  for (const el of nodes) {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = T(key);
    const tKey = el.getAttribute('data-i18n-title');
    if (tKey) el.setAttribute('title', T(tKey));
    const pKey = el.getAttribute('data-i18n-placeholder');
    if (pKey) el.setAttribute('placeholder', T(pKey));
  }
}

// Switches the game language and refreshes static + dynamic text.
function setLanguage(lang) {
  if (!LANGUAGES.includes(lang)) return;
  currentLang = lang;
  try { localStorage.setItem('tedosu_lang', lang); } catch (e) { /* ignore */ }
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = lang;
  }
  applyStaticTranslations();
  syncLanguageButton();
  if (typeof applyLanguage === 'function') applyLanguage();
}

// Restores the saved language (called once at startup).
function initLanguage() {
  let saved = null;
  try { saved = localStorage.getItem('tedosu_lang'); } catch (e) { /* ignore */ }
  if (LANGUAGES.includes(saved)) currentLang = saved;
  syncLanguageButton();
}
