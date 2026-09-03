// =====================================================================
// AUDIO: background music (mp3 file) + sound effects (Web Audio).
// Music: "Moonsea" by Jelsonic (CC BY 4.0) - see the page credits.
// Two independent mute toggles: music and sound effects.
// =====================================================================

let audioCtx = null;
let sfxGain = null;
let musicEl = null;
let musicMuted = false;
let sfxMuted = false;

const MUSIC_SRC = 'assets/music/Jelsonic - Moonsea.mp3';
const MUSIC_VOLUME = 0.2;

function loadAudioPrefs() {
  try {
    musicMuted = localStorage.getItem('tedosu_music_muted') === '1';
    sfxMuted = localStorage.getItem('tedosu_sfx_muted') === '1';
  } catch (e) { /* ignore */ }
}

function persistAudioPrefs() {
  try {
    localStorage.setItem('tedosu_music_muted', musicMuted ? '1' : '0');
    localStorage.setItem('tedosu_sfx_muted', sfxMuted ? '1' : '0');
  } catch (e) { /* ignore */ }
}

// Creates (or resumes) the AudioContext. Must be called from a user gesture.
// Returns true if audio is available.
function ensureAudio() {
  if (audioCtx) {
    if (audioCtx.state === 'suspended' && audioCtx.resume) audioCtx.resume();
    return true;
  }
  const AC = (typeof AudioContext !== 'undefined' && AudioContext) ||
             (typeof webkitAudioContext !== 'undefined' && webkitAudioContext);
  if (!AC) return false;
  try {
    audioCtx = new AC();
    sfxGain = audioCtx.createGain();
    sfxGain.gain.value = 0.22;
    // A gentle compressor glues the layered SFX and tames harsh peaks.
    if (typeof audioCtx.createDynamicsCompressor === 'function') {
      const sfxComp = audioCtx.createDynamicsCompressor();
      sfxComp.threshold.value = -18;
      sfxComp.knee.value = 30;
      sfxComp.ratio.value = 2;
      sfxComp.attack.value = 0.008;
      sfxComp.release.value = 0.25;
      sfxGain.connect(sfxComp);
      sfxComp.connect(audioCtx.destination);
    } else {
      sfxGain.connect(audioCtx.destination);
    }
  } catch (e) {
    audioCtx = null;
    return false;
  }
  return true;
}

// --- Music -----------------------------------------------------------

// Lazily creates the <audio> element for the background track. Returns
// null when the media API is unavailable (e.g. in the Node test sandbox).
function ensureMusicElement() {
  if (musicEl) return musicEl;
  if (typeof Audio === 'undefined') return null;
  try {
    const el = new Audio(MUSIC_SRC);
    el.loop = true;
    el.preload = 'auto';
    el.volume = MUSIC_VOLUME;
    musicEl = el;
  } catch (e) {
    musicEl = null;
  }
  return musicEl;
}

// Starts the background track. Idempotent: if the song is already playing
// (e.g. after New / Reset / Play Again) it continues instead of restarting.
function startMusic() {
  const el = ensureMusicElement();
  if (!el || musicMuted || !el.paused) return;
  const p = el.play();
  if (p && typeof p.catch === 'function') p.catch(function () { /* autoplay blocked */ });
}

// Pauses the background track; startMusic() resumes from the same spot.
function stopMusic() {
  if (musicEl && !musicEl.paused) musicEl.pause();
}

// --- Mute toggles ----------------------------------------------------

function toggleMusic() {
  musicMuted = !musicMuted;
  persistAudioPrefs();
  if (musicMuted) stopMusic();
  else startMusic();
  syncAudioButtons();
}

function toggleSfx() {
  sfxMuted = !sfxMuted;
  persistAudioPrefs();
  syncAudioButtons();
}

// Keeps the two mute toggle switches in sync with the current state.
function syncAudioButtons() {
  if (typeof document === 'undefined') return;
  const mt = document.getElementById('musicToggle');
  const st = document.getElementById('sfxToggle');
  if (mt) {
    mt.checked = !musicMuted;
    if (mt.setAttribute) mt.setAttribute('aria-checked', String(!musicMuted));
  }
  if (st) {
    st.checked = !sfxMuted;
    if (st.setAttribute) st.setAttribute('aria-checked', String(!sfxMuted));
  }
}

// --- Sound effects ---------------------------------------------------

// Routes a node through an optional stereo panner (falls back to mono).
function stereo(node, panValue) {
  if (!panValue || !audioCtx.createStereoPanner) return node;
  const p = audioCtx.createStereoPanner();
  p.pan.value = panValue;
  node.connect(p);
  return p;
}

// A rich, voiced note: pitch glide + fast attack + punchy decay, with an
// optional lowpass sweep for extra body. Each call layers into the SFX mix.
function note(opts) {
  if (!audioCtx || !sfxGain) return;
  const o = opts || {};
  const t = audioCtx.currentTime + (o.when || 0);
  const dur = o.dur || 0.2;
  const osc = audioCtx.createOscillator();
  osc.type = o.type || 'triangle';
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.endFreq && o.endFreq !== o.freq) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.endFreq), t + dur);
  }
  if (o.detune) osc.detune.setValueAtTime(o.detune, t);
  let head = osc;
  if (o.filter) {
    const f = audioCtx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(o.filter, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(60, o.filter * 0.25), t + dur);
    f.Q.value = 1;
    head.connect(f);
    head = f;
  }
  const g = audioCtx.createGain();
  const peak = o.vol || 0.25;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t + (o.attack || 0.012));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  head.connect(g);
  stereo(g, o.pan).connect(sfxGain);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

// White-noise buffer reused for transient ticks, pops and rumbles.
let noiseBuffer = null;
let noiseRate = 0;
function getNoiseBuffer() {
  if (!audioCtx) return null;
  if (noiseBuffer && noiseRate === audioCtx.sampleRate) return noiseBuffer;
  const len = Math.floor(audioCtx.sampleRate * 0.6);
  noiseBuffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  noiseRate = audioCtx.sampleRate;
  return noiseBuffer;
}

// A filtered noise burst: the "click/thump" transient behind the notes.
function noise(opts) {
  if (!audioCtx || !sfxGain) return;
  const o = opts || {};
  const t = audioCtx.currentTime + (o.when || 0);
  const dur = o.dur || 0.1;
  const buf = getNoiseBuffer();
  if (!buf) return;
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  let head = src;
  if (o.filter) {
    const f = audioCtx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(o.filter, t);
    f.Q.value = 0.8;
    src.connect(f);
    head = f;
  }
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, o.vol || 0.15), t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  head.connect(g);
  stereo(g, o.pan).connect(sfxGain);
  src.start(t);
  src.stop(t + dur + 0.05);
}

function playSfx(name) {
  if (!audioCtx || sfxMuted) return;
  switch (name) {
    case 'click':
      noise({ dur: 0.03, vol: 0.05, filter: 10000 });
      note({ freq: 1400, endFreq: 1700, dur: 0.05, type: 'sine', vol: 0.07 });
      break;

    case 'place':
      noise({ dur: 0.04, vol: 0.05, filter: 8000 });
      note({ freq: 320, endFreq: 280, dur: 0.12, type: 'sine', vol: 0.22 });
      note({ freq: 640, endFreq: 560, dur: 0.14, type: 'triangle', vol: 0.1, when: 0.015 });
      note({ freq: 1280, dur: 0.07, type: 'sine', vol: 0.04, when: 0.015 });
      break;

    case 'mistake':
      noise({ dur: 0.14, vol: 0.07, filter: 3000 });
      note({ freq: 220, endFreq: 180, dur: 0.22, type: 'triangle', vol: 0.1 });
      note({ freq: 165, endFreq: 130, dur: 0.24, type: 'sine', vol: 0.09, when: 0.02 });
      break;

    case 'lose':
      noise({ dur: 0.2, vol: 0.06, filter: 2000 });
      note({ freq: 330, endFreq: 310, dur: 0.2, type: 'triangle', vol: 0.14 });
      note({ freq: 247, endFreq: 230, dur: 0.22, type: 'triangle', vol: 0.12, when: 0.16 });
      note({ freq: 165, endFreq: 110, dur: 0.55, type: 'sine', vol: 0.11, when: 0.32 });
      break;

    case 'win': {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        note({ freq: f, dur: 0.24, type: 'sine', vol: 0.16, when: i * 0.1, pan: i % 2 ? 0.2 : -0.2 });
        note({ freq: f * 2, dur: 0.14, type: 'sine', vol: 0.05, when: i * 0.1 });
      });
      note({ freq: 1046.5, dur: 0.7, type: 'sine', vol: 0.11, when: 0.4 });
      note({ freq: 1318.5, dur: 0.7, type: 'sine', vol: 0.06, when: 0.4 });
      break;
    }

    case 'gameover': {
      [392, 329.63, 261.63, 196].forEach((f, i) => {
        note({ freq: f, dur: 0.34, type: 'triangle', vol: 0.1, when: i * 0.17 });
        note({ freq: f / 2, dur: 0.44, type: 'sine', vol: 0.08, when: i * 0.17 });
      });
      break;
    }

    case 'special': {
      [1200, 1500, 1800, 2400].forEach((f, i) => {
        note({ freq: f, endFreq: f * 1.3, dur: 0.16, type: 'sine', vol: 0.09, when: i * 0.06 });
        note({ freq: f / 2, dur: 0.12, type: 'triangle', vol: 0.04, when: i * 0.06 });
      });
      break;
    }

    case 'heart':
      note({ freq: 523.25, dur: 0.18, type: 'sine', vol: 0.16 });
      note({ freq: 659.25, dur: 0.3, type: 'sine', vol: 0.14, when: 0.1 });
      note({ freq: 1046.5, dur: 0.22, type: 'sine', vol: 0.07, when: 0.1 });
      break;

    case 'badluck':
      noise({ dur: 0.3, vol: 0.06, filter: 1000 });
      note({ freq: 220, endFreq: 140, dur: 0.44, type: 'triangle', vol: 0.1 });
      note({ freq: 110, dur: 0.48, type: 'sine', vol: 0.09 });
      break;

    case 'urgent':
      note({ freq: 1000, dur: 0.1, type: 'triangle', vol: 0.1 });
      note({ freq: 1000, dur: 0.1, type: 'triangle', vol: 0.1, when: 0.14 });
      break;

    case 'hint':
      note({ freq: 880, endFreq: 950, dur: 0.14, type: 'sine', vol: 0.12 });
      note({ freq: 1320, dur: 0.22, type: 'sine', vol: 0.09, when: 0.09 });
      note({ freq: 1760, dur: 0.18, type: 'sine', vol: 0.06, when: 0.09 });
      break;
  }
}
