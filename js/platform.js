// =====================================================================
// PLATFORM: safe YouTube Playables SDK integration layer.
//
// The game runs unchanged in every environment:
//   - YouTube Playables (SDK present)
//   - GitHub Pages / local file:// (SDK absent)
//   - the Node test harness (no `window`, no SDK)
//
// When the SDK is not present, every call is a silent no-op, so a missing
// `ytgame` object can never throw "is not defined" or stop the game.
//
// Current SDK API (https://developers.google.com/youtube/gaming/playables):
//   <script src="https://www.youtube.com/game_api/v1"></script>
//   ytgame.game.firstFrameReady()
//   ytgame.game.gameReady()
//   ytgame.engagement.sendScore({ value: <number> })
//   ytgame.game.loadData()        -> Promise<string|null>
//   ytgame.game.saveData(<string>)
//   ytgame.system.isAudioEnabled()
//   ytgame.system.onAudioEnabledChange((enabled) => {})
//   ytgame.system.onPause(() => {})
//   ytgame.system.onResume(() => {})
//   ytgame.IN_PLAYABLES_ENV / ytgame.SDK_VERSION
// =====================================================================

const Platform = (function () {
  'use strict';

  let firstFrameSent = false; // firstFrameReady() must fire exactly once
  let gameReadySent = false;  // gameReady() must fire exactly once
  let loadPromise = null;     // cached loadData() promise (saveData awaits it)

  // The three game modes whose best times are persisted.
  const MODE_KEYS = ['kids-4', 'classic-9', 'hex-16'];

  // Resolves to the SDK object when available, otherwise null.
  // `typeof ytgame` is safe even in the Node sandbox (no window / no SDK).
  function getSdk() {
    try {
      if (typeof ytgame !== 'undefined' && ytgame) return ytgame;
    } catch (e) { /* ignore */ }
    try {
      if (typeof window !== 'undefined' && window.ytgame) return window.ytgame;
    } catch (e) { /* ignore */ }
    return null;
  }

  function log(msg) {
    try { console.log('[YouTubePlayables] ' + msg); } catch (e) { /* ignore */ }
  }

  function describeSdk(yt) {
    let version = '';
    try { version = yt && yt.SDK_VERSION ? ' v' + yt.SDK_VERSION : ''; } catch (e) { /* ignore */ }
    let inEnv = false;
    try { inEnv = !!(yt && yt.IN_PLAYABLES_ENV); } catch (e) { /* ignore */ }
    return 'SDK detected (' + version + ', IN_PLAYABLES_ENV=' + inEnv + ')';
  }

  // ---- Lifecycle ----------------------------------------------------

  function firstFrameReady() {
    if (firstFrameSent) return;
    firstFrameSent = true;
    const yt = getSdk();
    if (yt && yt.game && typeof yt.game.firstFrameReady === 'function') {
      try {
        yt.game.firstFrameReady();
        log('firstFrameReady()');
      } catch (e) {
        log('firstFrameReady() threw: ' + (e && e.message));
      }
    } else {
      log('firstFrameReady() skipped (SDK not available)');
    }
  }

  function gameReady() {
    if (gameReadySent) return;
    gameReadySent = true;
    const yt = getSdk();
    if (yt && yt.game && typeof yt.game.gameReady === 'function') {
      try {
        yt.game.gameReady();
        log('gameReady()');
      } catch (e) {
        log('gameReady() threw: ' + (e && e.message));
      }
    } else {
      log('gameReady() skipped (SDK not available)');
    }
  }

  // ---- Score --------------------------------------------------------

  // Sends a score as a validated integer. `Number.isFinite` rejects NaN,
  // Infinity, and non-numbers; `Math.floor` guarantees an integer. Strings,
  // undefined, and other invalid values are refused rather than forwarded.
  function sendScore(score) {
    if (!Number.isFinite(score)) {
      log('sendScore() skipped (non-finite value: ' + score + ')');
      return;
    }
    const value = Math.floor(score);
    const yt = getSdk();
    if (yt && yt.engagement && typeof yt.engagement.sendScore === 'function') {
      try {
        const result = yt.engagement.sendScore({ value: value });
        if (result && typeof result.catch === 'function') {
          result.catch((e) => log('sendScore() rejected: ' + (e && e.message)));
        }
        log('sendScore(' + value + ')');
      } catch (e) {
        log('sendScore() threw: ' + (e && e.message));
      }
    } else {
      log('sendScore(' + value + ') skipped (SDK not available)');
    }
  }

  // ---- Cloud save ---------------------------------------------------

  function rawLoad() {
    const yt = getSdk();
    if (!yt || !yt.game || typeof yt.game.loadData !== 'function') {
      return Promise.resolve(null);
    }
    try {
      const res = yt.game.loadData();
      if (res && typeof res.then === 'function') {
        return res
          .then((raw) => {
            if (!raw) return null;
            try { return JSON.parse(raw); } catch (e) { return null; }
          })
          .catch((e) => { log('loadData() rejected: ' + (e && e.message)); return null; });
      }
      // Defensive: some SDK versions return the string synchronously.
      if (!res) return Promise.resolve(null);
      try { return Promise.resolve(JSON.parse(res)); } catch (e) { return Promise.resolve(null); }
    } catch (e) {
      log('loadData() threw: ' + (e && e.message));
      return Promise.resolve(null);
    }
  }

  function loadData() {
    if (!loadPromise) loadPromise = rawLoad();
    return loadPromise;
  }

  // The SDK requires loadData() to complete before saveData() is allowed,
  // so every save is chained after the (cached) load promise.
  function saveData(state) {
    return loadData().then(() => {
      const yt = getSdk();
      if (!yt || !yt.game || typeof yt.game.saveData !== 'function') {
        return false;
      }
      try {
        let payload;
        try { payload = JSON.stringify(state); } catch (e) { payload = ''; }
        if (payload.length > 3 * 1024 * 1024) {
          log('saveData() skipped (payload exceeds 3 MiB)');
          return false;
        }
        const res = yt.game.saveData(payload);
        if (res && typeof res.catch === 'function') {
          res.catch((e) => log('saveData() rejected: ' + (e && e.message)));
        }
        log('saveData(' + payload.length + ' bytes)');
        return true;
      } catch (e) {
        log('saveData() threw: ' + (e && e.message));
        return false;
      }
    });
  }

  // Builds the cloud-save state snapshot from localStorage. Reads only
  // persisted values so it stays decoupled from the individual modules.
  function buildCloudState() {
    const state = { v: 1, best: {}, musicMuted: false, sfxMuted: false, lang: 'en' };
    try {
      for (let i = 0; i < MODE_KEYS.length; i++) {
        const raw = localStorage.getItem('best_' + MODE_KEYS[i]);
        if (raw !== null && raw !== undefined && raw !== '') {
          const n = parseInt(raw, 10);
          if (Number.isFinite(n)) state.best[MODE_KEYS[i]] = n;
        }
      }
      state.musicMuted = localStorage.getItem('tedosu_music_muted') === '1';
      state.sfxMuted = localStorage.getItem('tedosu_sfx_muted') === '1';
      const lang = localStorage.getItem('tedosu_lang');
      if (lang) state.lang = lang;
    } catch (e) { /* localStorage may be unavailable (file://) */ }
    return state;
  }

  // Merges a cloud-save snapshot back into localStorage.
  function applyCloudState(state) {
    if (!state || typeof state !== 'object') return;
    try {
      if (state.best && typeof state.best === 'object') {
        const keys = Object.keys(state.best);
        for (let i = 0; i < keys.length; i++) {
          const v = state.best[keys[i]];
          if (Number.isFinite(v)) localStorage.setItem('best_' + keys[i], String(Math.floor(v)));
        }
      }
      if (typeof state.musicMuted === 'boolean') {
        localStorage.setItem('tedosu_music_muted', state.musicMuted ? '1' : '0');
      }
      if (typeof state.sfxMuted === 'boolean') {
        localStorage.setItem('tedosu_sfx_muted', state.sfxMuted ? '1' : '0');
      }
      if (typeof state.lang === 'string' && state.lang) {
        localStorage.setItem('tedosu_lang', state.lang);
      }
    } catch (e) { /* ignore */ }
  }

  // ---- System events ------------------------------------------------

  function initSystemEvents(handlers) {
    const yt = getSdk();
    if (!yt || !yt.system) {
      log('SDK not detected — running standalone (local / GitHub Pages).');
      return;
    }
    log(describeSdk(yt));

    if (typeof yt.system.onAudioEnabledChange === 'function') {
      try {
        yt.system.onAudioEnabledChange((enabled) => {
          log('audio enabled change: ' + enabled);
          if (handlers && typeof handlers.onAudioEnabledChange === 'function') {
            handlers.onAudioEnabledChange(!!enabled);
          }
        });
      } catch (e) { log('onAudioEnabledChange() threw: ' + (e && e.message)); }
    }
    if (typeof yt.system.onPause === 'function') {
      try {
        yt.system.onPause(() => {
          log('pause');
          if (handlers && typeof handlers.onPause === 'function') handlers.onPause();
        });
      } catch (e) { log('onPause() threw: ' + (e && e.message)); }
    }
    if (typeof yt.system.onResume === 'function') {
      try {
        yt.system.onResume(() => {
          log('resume');
          if (handlers && typeof handlers.onResume === 'function') handlers.onResume();
        });
      } catch (e) { log('onResume() threw: ' + (e && e.message)); }
    }
  }

  function isAudioEnabled() {
    const yt = getSdk();
    if (yt && yt.system && typeof yt.system.isAudioEnabled === 'function') {
      try { return !!yt.system.isAudioEnabled(); } catch (e) { /* ignore */ }
    }
    return true;
  }

  // Watch body-style changes only if we haven't armed the observer yet, and
  // stop watching once the page is fully loaded (the SDK only applies its
  // body styling once at startup).
  let scrollWatchArmed = false;

  function restoreBodyScrolling() {
    if (typeof document === 'undefined' || !document.body) return;
    try {
      const s = document.body.style;
      if (s.touchAction && s.touchAction !== 'auto') s.touchAction = 'auto';
      if (s.userSelect) s.userSelect = '';
      if (s.overscrollBehavior) s.overscrollBehavior = '';
    } catch (e) { /* ignore */ }
  }

  // The YouTube Playables SDK disables native page scrolling and text selection
  // by stamping inline styles on <body>:
  //   `touch-action: none; overscroll-behavior: none; user-select: none;`
  // That is the correct full-screen layout for a real Playable, but when the very
  // same page is opened as a normal website (local file / GitHub Pages) on a phone
  // it silently breaks finger-scrolling — wheel and JS scrolling keep working, so
  // it can look like a device-only bug. This restores native scrolling whenever we
  // are NOT running inside the real Playables environment. Because the SDK applies
  // its styling around DOM-ready time (after our end-of-body code runs), we also
  // watch the body's style attribute and undo any touch-action:none it writes.
  function enableScrollingWhenStandalone() {
    if (typeof document === 'undefined' || !document.body) return;
    try {
      const yt = getSdk();
      if (yt && yt.IN_PLAYABLES_ENV) return; // real Playable: keep YouTube's full-screen layout
    } catch (e) { /* ignore */ }

    restoreBodyScrolling();

    try {
      if (typeof MutationObserver === 'undefined' || scrollWatchArmed) return;
      scrollWatchArmed = true;
      const observer = new MutationObserver(function () {
        if (!(getSdk() && getSdk().IN_PLAYABLES_ENV)) restoreBodyScrolling();
      });
      observer.observe(document.body, { attributes: true, attributeFilter: ['style'] });
      const stop = function () {
        try { observer.disconnect(); } catch (e) { /* ignore */ }
        scrollWatchArmed = false;
      };
      if (document.readyState === 'complete') stop();
      else if (typeof window !== 'undefined' && window.addEventListener) {
        window.addEventListener('load', stop, { once: true });
      }
    } catch (e) { /* ignore */ }
  }

  return {
    firstFrameReady,
    gameReady,
    sendScore,
    saveData,
    loadData,
    buildCloudState,
    applyCloudState,
    initSystemEvents,
    isAudioEnabled,
    enableScrollingWhenStandalone
  };
})();
