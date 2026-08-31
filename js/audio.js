// =====================================================================
// AUDIO: Web Audio engine - ambient music + sound effects (no files).
// Two independent mute toggles: music and sound effects.
// =====================================================================

let audioCtx = null;
let musicGain = null;
let sfxGain = null;
let musicTimer = null;
let musicStep = 0;
let musicMuted = false;
let sfxMuted = false;

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
    musicGain = audioCtx.createGain();
    musicGain.gain.value = 0.14;
    musicGain.connect(audioCtx.destination);
    sfxGain = audioCtx.createGain();
    sfxGain.gain.value = 0.22;
    sfxGain.connect(audioCtx.destination);
  } catch (e) {
    audioCtx = null;
    return false;
  }
  return true;
}

// --- Music -----------------------------------------------------------

const MUSIC_CHORDS = [
  [261.63, 329.63, 392.0],  // C major
  [220.0, 261.63, 329.63],  // A minor
  [174.61, 220.0, 261.63],  // F major
  [196.0, 246.94, 293.66]   // G major
];
const MUSIC_CHORD_DUR = 4.5;

function playChord(freqs, start, dur) {
  if (!audioCtx || !musicGain) return;
  for (const f of freqs) {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = f;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.14, start + 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g);
    g.connect(musicGain);
    osc.start(start);
    osc.stop(start + dur + 0.1);
  }
}

// Starts the ambient music loop (a soft chord progression).
function startMusic() {
  if (!audioCtx || musicMuted) return;
  stopMusic();
  musicStep = 0;
  musicTimer = setInterval(() => {
    if (!audioCtx || musicMuted) return;
    const start = audioCtx.currentTime + 0.1;
    const chord = MUSIC_CHORDS[musicStep % MUSIC_CHORDS.length];
    playChord(chord, start, MUSIC_CHORD_DUR);
    // soft bass note one octave down
    const bass = audioCtx.createOscillator();
    const bg = audioCtx.createGain();
    bass.type = 'sine';
    bass.frequency.value = chord[0] / 2;
    bg.gain.setValueAtTime(0.0001, start);
    bg.gain.exponentialRampToValueAtTime(0.1, start + 0.5);
    bg.gain.exponentialRampToValueAtTime(0.0001, start + MUSIC_CHORD_DUR);
    bass.connect(bg);
    bg.connect(musicGain);
    bass.start(start);
    bass.stop(start + MUSIC_CHORD_DUR + 0.1);
    musicStep++;
  }, MUSIC_CHORD_DUR * 1000);
}

function stopMusic() {
  if (musicTimer) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
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

// Keeps the two mute buttons in sync with the current state.
function syncAudioButtons() {
  if (typeof document === 'undefined') return;
  const mb = document.getElementById('musicBtn');
  const sb = document.getElementById('sfxBtn');
  if (mb) {
    mb.textContent = musicMuted ? '🔇' : '🎵';
    mb.classList.toggle('muted', musicMuted);
    mb.title = T('music');
  }
  if (sb) {
    sb.textContent = sfxMuted ? '🔇' : '🔊';
    sb.classList.toggle('muted', sfxMuted);
    sb.title = T('sfx');
  }
}

// --- Sound effects ---------------------------------------------------

function tone(freq, dur, type, vol, when) {
  if (!audioCtx || !sfxGain) return;
  const t = audioCtx.currentTime + (when || 0);
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type || 'sine';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(sfxGain);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function playSfx(name) {
  if (!audioCtx || sfxMuted) return;
  switch (name) {
    case 'click': tone(880, 0.06, 'square', 0.12); break;
    case 'place': tone(520, 0.12, 'sine', 0.3); tone(780, 0.1, 'sine', 0.2, 0.05); break;
    case 'mistake': tone(220, 0.2, 'sawtooth', 0.18); tone(180, 0.25, 'sawtooth', 0.15, 0.08); break;
    case 'lose': tone(300, 0.15, 'triangle', 0.25); tone(220, 0.2, 'triangle', 0.22, 0.1); tone(150, 0.3, 'triangle', 0.2, 0.2); break;
    case 'win': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.28, i * 0.12)); break;
    case 'gameover': [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'triangle', 0.25, i * 0.18)); break;
    case 'special': tone(1200, 0.08, 'sine', 0.2); tone(1600, 0.1, 'sine', 0.18, 0.06); tone(2000, 0.12, 'sine', 0.16, 0.12); break;
    case 'heart': tone(523, 0.15, 'sine', 0.3); tone(659, 0.25, 'sine', 0.28, 0.12); break;
    case 'badluck': tone(250, 0.4, 'sawtooth', 0.16); tone(200, 0.4, 'sawtooth', 0.14, 0.15); break;
    case 'urgent': tone(1000, 0.08, 'square', 0.12); break;
    case 'hint': tone(700, 0.12, 'sine', 0.2); tone(900, 0.14, 'sine', 0.18, 0.08); break;
  }
}
