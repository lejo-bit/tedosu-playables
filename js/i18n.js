// =====================================================================
// I18N: language switching (9 languages: EN/DE/PL/ES/RU/TR/FR/NO/ZH).
// The translation strings live in js/translations.js (loaded BEFORE this
// file) - edit that file to add or change translations.
// =====================================================================

const LANGUAGES = ['en', 'de', 'pl', 'es', 'ru', 'tr', 'fr', 'no', 'zh'];

// Returns the plural form index for a language + count:
//   en / es / fr / no: n == 1 -> 0, other -> 1 (no: both forms identical)
//   de:                0 or 1 (both forms are identical: "Leben")
//   pl / ru:           n%10 == 1 (except 11) -> 0, n%10 in 2-4 (except 12-14) -> 1, else -> 2
//   tr / zh:           always 0 (the noun stays singular after a number)
function pluralIndex(lang, n) {
  if (lang === 'pl' || lang === 'ru') {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 0;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 1;
    return 2;
  }
  if (lang === 'tr' || lang === 'zh') return 0;
  return n === 1 ? 0 : 1;
}

let currentLang = 'en';

// Native name per language (used for tooltips / aria labels).
const LANGUAGE_NAMES = { en: 'English', de: 'Deutsch', pl: 'Polski', es: 'Español', ru: 'Русский', tr: 'Türkçe', fr: 'Français', no: 'Norsk', zh: '中文' };

// Highlights the matching language button in the settings panel.
function syncLanguageButton() {
  if (typeof document === 'undefined') return;
  for (const lang of LANGUAGES) {
    const id = 'lang' + lang.charAt(0).toUpperCase() + lang.slice(1); // langEn / langDe / langPl
    const btn = document.getElementById(id);
    if (!btn) continue;
    const active = lang === currentLang;
    btn.classList.toggle('active', active);
    if (btn.setAttribute) btn.setAttribute('aria-pressed', String(active));
    btn.title = LANGUAGE_NAMES[lang] || lang;
  }
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
