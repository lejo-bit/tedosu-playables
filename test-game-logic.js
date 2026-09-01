// Minimal DOM/global stubs so the real game JS (js/*.js) can be loaded in Node.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

function makeEl(id) {
  const el = {
    id,
    _children: [],
    classList: {
      _set: new Set(),
      add(...classes) { for (const c of classes) this._set.add(c); },
      remove(...classes) { for (const c of classes) this._set.delete(c); },
      toggle(c, force) {
        if (force === undefined) { this._set.has(c) ? this._set.delete(c) : this._set.add(c); }
        else if (force) this._set.add(c); else this._set.delete(c);
      },
      contains(c) { return this._set.has(c); }
    },
    style: {},
    textContent: '',
    className: '',
    value: '',
    checked: false,
    selectedIndex: 0,
    options: [],
    offsetWidth: 0,
    _handlers: {},
    addEventListener(type, fn) { this._handlers[type] = fn; },
    appendChild(child) { this._children.push(child); child.parent = this; return child; },
    get children() { return this._children; },
    set innerHTML(v) { this._children = []; },
    get innerHTML() { return ''; }
  };
  return el;
}

const els = {};
function getEl(id) { if (!els[id]) els[id] = makeEl(id); return els[id]; }
getEl('gameMode').options = [
  { value: 'kids-4', text: 'Kids 4x4 (Cats)' },
  { value: 'classic-9', text: 'Classic 9x9' },
  { value: 'hex-16', text: 'Hex 16x16' }
];
getEl('gameMode').selectedIndex = 0;
getEl('difficulty').value = 'medium';

const sandbox = {
  console, Math, Set, Array, Object, String, Number, Boolean,
  parseInt, parseFloat, JSON,
  setInterval: () => 0, clearInterval: () => {},
  setTimeout: (fn, ms) => { sandbox.__timers.push({ fn, ms }); return sandbox.__timers.length; },
  clearTimeout: () => {},
  __timers: [],
  __frames: [],           // captured requestAnimationFrame callbacks
  __clock: 0,             // controllable clock for performance.now()
  performance: { now: () => sandbox.__clock },
  requestAnimationFrame: (fn) => { sandbox.__frames.push(fn); return sandbox.__frames.length; },
  localStorage: (() => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; })(),
  document: {
    getElementById: getEl,
    createElement: (tag) => makeEl('<' + tag + '>'),
    createTextNode: (text) => ({ nodeType: 3, textContent: String(text) })
  },
  __results: { optimalUnplaceable: 0, optimalGames: 0, optimalCompleted: 0, freeStuck: 0, freeCompleted: 0, freeWon: 0, freeGames: 0, winNoCredit: false }
};
vm.createContext(sandbox);
// Load the split source files in the same order as index.html.
const scriptFiles = ['translations.js', 'i18n.js', 'config.js', 'state.js', 'dom.js', 'seeded.js', 'puzzle.js', 'game.js', 'audio.js', 'ui.js'];
const code = scriptFiles
  .map(f => fs.readFileSync(path.join(__dirname, 'js', f), 'utf8'))
  .join('\n');

const testCode = `
;(function () {
  function isBoardFull() {
    const size = gameState.mode.size;
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++)
        if (gameState.board[r][c] === null) return false;
    return true;
  }
  function legalSpotsForPiece(piece) {
    const v = gameState.mode.values.indexOf(piece) + 1;
    const size = gameState.mode.size;
    let count = 0;
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++)
        if (gameState.board[r][c] === null && gameState.solution[r][c] === v) count++;
    return count;
  }
  function setup(modeKey, difficulty) {
    gameState.mode = GAME_MODES[modeKey];
    const generated = generateSeededGame(randomSeed(), gameState.mode.size, gameState.mode.boxRows, gameState.mode.boxCols, difficulty);
    gameState.solution = generated.solution;
    gameState.puzzle = generated.puzzle;
    gameState.board = generated.puzzle.map(row => [...row]);
    gameState.gameActive = true;
  }

  // TEST A/B simulate placing only normal pieces, so disable special-piece
  // rolls there (they are exercised directly in TEST M).
  const origSpecialChance = {
    easy: DIFFICULTY_RULES.easy.specialChance,
    medium: DIFFICULTY_RULES.medium.specialChance,
    hard: DIFFICULTY_RULES.hard.specialChance
  };
  DIFFICULTY_RULES.easy.specialChance = 0;
  DIFFICULTY_RULES.medium.specialChance = 0;
  DIFFICULTY_RULES.hard.specialChance = 0;

  // TEST A: optimal play (place handed piece in a matching-solution cell).
  const modes = ['kids-4', 'classic-9'];
  const diffs = ['easy', 'medium', 'hard'];
  for (const mk of modes) for (const df of diffs) for (let g = 0; g < 30; g++) {
    setup(mk, df);
    __results.optimalGames++;
    let guard = 0;
    while (gameState.gameActive && guard++ < gameState.mode.size * gameState.mode.size) {
      nextPiece();
      const piece = gameState.currentPiece;
      if (legalSpotsForPiece(piece) === 0) { __results.optimalUnplaceable++; break; }
      const v = gameState.mode.values.indexOf(piece) + 1;
      let placed = false;
      const size = gameState.mode.size;
      for (let r = 0; r < size && !placed; r++)
        for (let c = 0; c < size && !placed; c++)
          if (gameState.board[r][c] === null && gameState.solution[r][c] === v) {
            gameState.board[r][c] = v; placed = true;
          }
      if (!placed) { __results.optimalUnplaceable++; break; }
      if (isBoardFull()) { __results.optimalCompleted++; gameState.gameActive = false; }
    }
  }

  // TEST B: a wrong (non-solution) placement is rejected - the board is never
  // corrupted, and every wrong move costs exactly one life.
  setup('classic-9', 'easy');
  gameState.difficulty = 'easy';
  gameState.solution = Array.from({ length: 9 }, () => Array(9).fill(0)); // 0 != value 1 -> every cell is wrong
  gameState.puzzle = Array.from({ length: 9 }, () => Array(9).fill(null));
  gameState.board = gameState.puzzle.map(r => [...r]);
  gameState.currentPiece = 1; // value 1
  gameState.gameActive = true;
  gameState.lives = 3;
  gameState.errors = 0;
  renderBoard();
  handleCellClick(0, 0); // wrong -> rejected + 1 life lost
  __results.wrongRejected = gameState.board[0][0] === null; // expect true
  __results.wrongLives = gameState.lives; // expect 2 (every wrong move costs a life)
  __results.wrongErrors = gameState.errors; // expect 1
  __results.wrongNoWarn =
    !boardEl.children[0].classList.contains('cell-warn-yellow') &&
    !boardEl.children[0].classList.contains('cell-warn-orange') &&
    !boardEl.children[0].classList.contains('cell-warn-red'); // expect true (no colored marks)

  // Restore the real special-piece chances for the remaining tests.
  DIFFICULTY_RULES.easy.specialChance = origSpecialChance.easy;
  DIFFICULTY_RULES.medium.specialChance = origSpecialChance.medium;
  DIFFICULTY_RULES.hard.specialChance = origSpecialChance.hard;

  // TEST C: validate solution generation & start-move availability for ALL modes.
  __results.allModeValid = 0;
  __results.allModeStartMoves = 0;
  __results.allModeCount = 0;
  for (const mk of ['kids-4', 'classic-9', 'hex-16']) {
    const reps = mk === 'hex-16' ? 2 : 1; // stress the slower 16x16 generator
    for (let rep = 0; rep < reps; rep++) {
      __results.allModeCount++;
      gameState.mode = GAME_MODES[mk];
      const generated = generateSeededGame(randomSeed(), gameState.mode.size, gameState.mode.boxRows, gameState.mode.boxCols, 'medium');
      gameState.solution = generated.solution;
      gameState.board = gameState.solution.map(row => [...row]);
      if (isBoardValid()) __results.allModeValid++;
      gameState.puzzle = generated.puzzle;
      gameState.board = generated.puzzle.map(row => [...row]);
      if (getPlayablePieces().length > 0) __results.allModeStartMoves++;
    }
  }

  // TEST D: win summary modal shows + populates on endGame(true).
  gameState.mode = GAME_MODES['kids-4'];
  gameState.solution = generateSolution(4, 2, 2);
  gameState.board = gameState.solution.map(row => [...row]);
  gameState.puzzle = gameState.solution.map(row => [...row]);
  gameState.difficulty = 'easy';
  gameState.lives = 2;
  gameState.timer = 95;
  gameState.errors = 2;
  gameState.timed = true;
  endGame(true);
  __results.modalShown = winModal.classList.contains('active');
  __results.modalTime = winTimeEl.textContent;
  __results.modalLives = winLivesEl.textContent;
  __results.modalErrors = winErrorsEl.textContent;
  __results.modalTitle = winTitleEl.textContent;

  // TEST E: game-over (out of lives) shows a Game Over modal.
  gameState.difficulty = 'hard';
  gameState.lives = 0;
  gameState.timer = 60;
  gameState.errors = 5;
  endGame(false);
  __results.loseShown = winModal.classList.contains('active');
  __results.loseTitle = winTitleEl.textContent;

  // TEST F: every wrong move loses one life (any difficulty) -> game over at 0.
  gameState.mode = GAME_MODES['kids-4'];
  gameState.difficulty = 'hard';
  gameState.board = Array.from({ length: 4 }, () => Array(4).fill(null));
  gameState.board[0][1] = 1; // conflict in row 0 for value 1
  gameState.puzzle = Array.from({ length: 4 }, () => Array(4).fill(null));
  gameState.solution = Array.from({ length: 4 }, () => Array(4).fill(0)); // force every cell wrong for value 1
  gameState.currentPiece = 'assets/cats/1.png'; // value 1
  gameState.gameActive = true;
  gameState.lives = 3;
  gameState.errors = 0;
  renderBoard();
  handleCellClick(0, 0);
  __results.hardLivesAfter1 = gameState.lives; // expect 2
  handleCellClick(0, 0);
  handleCellClick(0, 0);
  __results.hardLivesAfter3 = gameState.lives; // expect 0
  __results.hardGameOver = !gameState.gameActive; // expect true

  // TEST G: wrong clicks leave NO colored marks on the board.
  gameState.mode = GAME_MODES['kids-4'];
  gameState.difficulty = 'easy';
  gameState.board = Array.from({ length: 4 }, () => Array(4).fill(null));
  gameState.board[0][1] = 1; // conflict in row 0 for value 1
  gameState.puzzle = Array.from({ length: 4 }, () => Array(4).fill(null));
  gameState.solution = Array.from({ length: 4 }, () => Array(4).fill(0)); // force every cell wrong for value 1
  gameState.currentPiece = 'assets/cats/1.png'; // value 1
  gameState.gameActive = true;
  gameState.lives = 3;
  gameState.errors = 0;
  renderBoard();
  handleCellClick(0, 0); // wrong -> 1 life lost, no mark
  const warnAfterClick =
    boardEl.children[0].classList.contains('cell-warn-yellow') ||
    boardEl.children[0].classList.contains('cell-warn-orange') ||
    boardEl.children[0].classList.contains('cell-warn-red');
  __results.warnAfterClick = warnAfterClick; // expect false
  renderBoard(); // re-render must not add a mark either
  __results.warnAfterRender =
    boardEl.children[0].classList.contains('cell-warn-yellow') ||
    boardEl.children[0].classList.contains('cell-warn-orange') ||
    boardEl.children[0].classList.contains('cell-warn-red'); // expect false
  __results.warnLives = gameState.lives; // expect 2

  // TEST I: per-piece timer - 9x9/16x16 only; expiry loses a life; kids has no timer.
  setup('classic-9', 'easy');
  gameState.difficulty = 'easy';
  gameState.lives = 3;
  const origRandomI = Math.random;
  Math.random = () => 0.99; // avoid special pieces for a deterministic timer test
  nextPiece();
  __results.pieceSecondsClassic = gameState.pieceSeconds; // expect 90 (9x9 easy)
  __results.pieceTimeLeftClassic = gameState.pieceTimeLeft; // expect 90
  __results.pieceTimerShownClassic = !pieceTimerWrapEl.hidden; // expect true
  onPieceTimerExpired(); // time-up -> lose a life, new piece + fresh timer
  Math.random = origRandomI;
  __results.livesAfterTimeUp = gameState.lives; // expect 2
  __results.pieceTimeLeftAfter = gameState.pieceTimeLeft; // expect 90 (restarted)
  __results.gameActiveAfter = gameState.gameActive; // expect true

  setup('kids-4', 'easy');
  gameState.difficulty = 'easy';
  gameState.lives = 3;
  nextPiece();
  __results.pieceSecondsKids = gameState.pieceSeconds; // expect 0 (no timer for kids)
  __results.pieceTimerShownKids = !pieceTimerWrapEl.hidden; // expect false

  // TEST J: transient messages auto-clear after 5 seconds.
  showMessage('Invalid move! Try again.', 'error');
  __results.msgShown = messageEl.textContent;
  const lastTimer = __timers[__timers.length - 1];
  lastTimer.fn();
  __results.msgCleared = (messageEl.textContent === '' && messageEl.className === 'message');

  // TEST K: difficulty description reflects mode + difficulty.
  gameModeSelect.value = 'classic-9';
  difficultySelect.value = 'medium';
  updateDifficultyDescription();
  __results.descClassicMedium = difficultyDescriptionEl.textContent;
  difficultySelect.value = 'easy';
  updateDifficultyDescription();
  __results.descClassicEasy = difficultyDescriptionEl.textContent;
  gameModeSelect.value = 'kids-4';
  difficultySelect.value = 'hard';
  updateDifficultyDescription();
  __results.descKidsHard = difficultyDescriptionEl.textContent;
  __results.descChecksOk =
    __results.descClassicMedium.includes('3 lives') && __results.descClassicMedium.includes('60s per piece') && __results.descClassicMedium.includes('costs a life') && __results.descClassicMedium.includes('7.5%') &&
    __results.descClassicEasy.includes('3 lives') && __results.descClassicEasy.includes('90s per piece') && __results.descClassicEasy.includes('15%') &&
    __results.descKidsHard.toLowerCase().includes('no hints') && !__results.descKidsHard.includes('per piece');

  // TEST L: random cat logo - valid cat file + matching tooltip name.
  const allowedNames = {
    1: ['Chu-chu'],
    2: ['Ymil', 'Klusky'],
    3: ['Loki'],
    4: ['Daya']
  };
  let logoOk = true;
  for (let i = 0; i < 30; i++) {
    randomizeLogo();
    const m = logoEl.src.match(/cats\\/([1-4])\\.png$/);
    const cat = m ? Number(m[1]) : 0;
    if (!m || !allowedNames[cat] || !allowedNames[cat].includes(logoEl.title)) logoOk = false;
  }
  __results.logoOk = logoOk;

  // TEST M: special cat pieces.
  // M1: pickSpecialPiece always returns a valid configured type + description.
  let specialPickOk = true;
  for (let i = 0; i < 50; i++) {
    const s = pickSpecialPiece();
    if (!SPECIAL_PIECES[s.key] || SPECIAL_PIECES[s.key].file !== s.file || SPECIAL_PIECES[s.key].desc !== s.desc) specialPickOk = false;
  }
  __results.specialPickOk = specialPickOk;

  // M2: forcing Math.random to 0 rolls a special piece (joker) in 9x9.
  setup('classic-9', 'easy');
  gameState.difficulty = 'easy';
  gameState.lives = 3;
  gameState.hints = 0;
  const origRandom = Math.random;
  Math.random = () => 0; // 0 < specialChance(0.1) -> special; weighted pick -> joker
  nextPiece();
  Math.random = origRandom;
  __results.specialRolled = isSpecialPiece(gameState.currentPiece);
  __results.specialKey = gameState.currentPiece && gameState.currentPiece.key;

  // M3: joker fills the clicked cell with its correct solution value.
  gameState.mode = GAME_MODES['classic-9'];
  gameState.difficulty = 'easy';
  gameState.solution = generateSolution(9, 3, 3);
  gameState.puzzle = gameState.solution.map(r => r.map(() => null));
  gameState.board = gameState.puzzle.map(r => [...r]);
  gameState.currentPiece = { key: 'joker', file: 'assets/cats/1.png', label: 'Joker', kind: 'click' };
  gameState.gameActive = true;
  gameState.lives = 3;
  gameState.errors = 0;
  gameState.hints = 0;
  renderBoard();
  handleCellClick(2, 3);
  __results.jokerFilled = gameState.board[2][3] === gameState.solution[2][3];

  // M4: reveal shows the clicked cell + every cell within 2 fields in a warm
  // orange tint, holds 1s, fades out over the next 4s (5s total), then cleans up.
  gameState.mode = GAME_MODES['classic-9'];
  gameState.solution = generateSolution(9, 3, 3);
  gameState.puzzle = gameState.solution.map(r => r.map(() => null));
  gameState.board = gameState.puzzle.map(r => [...r]);
  gameState.gameActive = true;
  gameState.lives = 3;
  gameState.errors = 0;
  renderBoard();
  __clock = 0;
  revealNeighbors(4, 4);
  const revIdx = (r, c) => r * 9 + c;
  __results.revealClass = boardEl.children[revIdx(3, 3)].classList.contains('reveal'); // expect true
  __results.revealClass2 = boardEl.children[revIdx(2, 2)].classList.contains('reveal'); // radius-2 cell - expect true
  __results.revealTint = boardEl.children[revIdx(3, 3)].style.background.startsWith('rgba(241, 153, 76'); // expect true (warm orange fill)
  __results.revealText = boardEl.children[revIdx(3, 3)].textContent === String(gameState.solution[3][3]);
  // First fade step at t=0 -> fully visible (opaque orange fill + opaque number);
  // mid-fade at ~3s -> fill blended toward white, number alpha fading out.
  __timers[__timers.length - 1].fn();
  __results.revealFullOpacity = boardEl.children[revIdx(3, 3)].style.color === 'hsla(25, 78%, 28%, 1)'; // expect true
  __clock = 3000;
  __timers[__timers.length - 1].fn();
  const midBg = boardEl.children[revIdx(3, 3)].style.background;
  const midColor = boardEl.children[revIdx(3, 3)].style.color;
  __results.revealMidFade =
    midBg !== 'rgba(241, 153, 76, 1)' &&
    midBg !== 'rgba(255, 255, 255, 0.72)' &&
    midColor.startsWith('hsla(25, 78%, 28%, ') &&
    midColor !== 'hsla(25, 78%, 28%, 1)' &&
    midColor !== 'hsla(25, 78%, 28%, 0)'; // expect true
  // Near the very end the fill must still be near-white and opaque (alpha >= 0.7):
  // the reveal blends into the board instead of flashing transparent.
  __clock = 4900;
  __timers[__timers.length - 1].fn();
  const nearBg = boardEl.children[revIdx(3, 3)].style.background.slice(5, -1).split(', ');
  __results.revealStaysOpaque =
    nearBg.length === 4 &&
    parseInt(nearBg[0]) >= 240 &&
    parseInt(nearBg[1]) >= 240 &&
    parseInt(nearBg[2]) >= 240 &&
    parseFloat(nearBg[3]) >= 0.7; // expect true
  // Drive the fade to completion
  let revealGuard = 0;
  while (gameState.revealTimeout !== null && revealGuard++ < 300) {
    __clock += 60;
    __timers[__timers.length - 1].fn();
  }
  __results.revealFaded = revealGuard > 1; // expect true
  __results.revealReverted = boardEl.children[revIdx(3, 3)].textContent === '';
  __results.revealCleared = !boardEl.children[revIdx(3, 3)].style.background; // expect true (unset/cleared)
  __results.revealOpacityCleared =
    !boardEl.children[revIdx(3, 3)].style.background &&
    !boardEl.children[revIdx(3, 3)].style.color; // expect true (unset/cleared)
  __results.revealClassesCleared = !boardEl.children[revIdx(3, 3)].classList.contains('reveal'); // expect true
  __results.revealTimeoutCleared = gameState.revealTimeout === null; // expect true

  // A re-render mid-reveal (e.g. placing the next tile) must NOT cancel the
  // fade: the reveal is re-applied to the fresh cells and keeps running for
  // the full 5 seconds.
  gameState.mode = GAME_MODES['classic-9'];
  gameState.solution = generateSolution(9, 3, 3);
  gameState.puzzle = gameState.solution.map(r => r.map(() => null));
  gameState.board = gameState.puzzle.map(r => [...r]);
  gameState.gameActive = true;
  gameState.lives = 3;
  gameState.errors = 0;
  gameState.hints = 0;
  renderBoard();
  __clock = 0;
  revealNeighbors(4, 4);
  __results.revealTimerScheduled = gameState.revealTimeout !== null; // expect true
  renderBoard(); // re-render mid-reveal -> the reveal keeps running
  __results.revealKeepsRunningOnRender = gameState.revealTimeout !== null; // expect true
  __results.revealReapplied =
    boardEl.children[4 * 9 + 4].classList.contains('reveal') &&
    !!boardEl.children[4 * 9 + 4].style.background &&
    boardEl.children[4 * 9 + 4].textContent === String(gameState.solution[4][4]) &&
    boardEl.children[4 * 9 + 4].style.color === 'hsla(25, 78%, 28%, 1)'; // expect true

  // Filling a revealed cell mid-reveal keeps its normal filled look, while
  // the still-empty revealed cells keep the reveal until the 5 seconds end.
  gameState.board[3][3] = gameState.solution[3][3];
  renderBoard();
  __results.revealSkipsFilled =
    boardEl.children[revIdx(3, 3)].classList.contains('filled') &&
    !boardEl.children[revIdx(3, 3)].classList.contains('reveal') &&
    boardEl.children[revIdx(4, 4)].classList.contains('reveal'); // expect true

  // The reveal still finishes and cleans up after the full 5 seconds.
  __clock = 5000;
  let finishGuard = 0;
  while (gameState.revealTimeout !== null && finishGuard++ < 500) {
    __clock += 60;
    __timers[__timers.length - 1].fn();
  }
  __results.revealFinishedAfterRender =
    gameState.revealTimeout === null &&
    !boardEl.children[revIdx(4, 4)].style.background &&
    boardEl.children[revIdx(4, 4)].textContent === '' &&
    !boardEl.children[revIdx(4, 4)].classList.contains('reveal'); // expect true

  // M5: Loki (3.png) is an auto piece - clicks are ignored, and 3 seconds
  // later it auto-grants one extra life.
  gameState.mode = GAME_MODES['classic-9'];
  gameState.difficulty = 'hard';
  gameState.solution = generateSolution(9, 3, 3);
  gameState.board = Array.from({ length: 9 }, () => Array(9).fill(null));
  gameState.puzzle = gameState.board.map(r => [...r]);
  gameState.currentPiece = { key: 'shield', file: 'assets/cats/3.png', label: 'Loki', desc: 'Extra life!', kind: 'auto' };
  gameState.gameActive = true;
  gameState.lives = 3;
  gameState.errors = 0;
  gameState.hints = 0;
  renderBoard();
  handleCellClick(0, 0); // ignored for auto pieces
  __results.autoClickIgnored = gameState.lives === 3 && gameState.board[0][0] === null; // expect true
  startAutoPieceTimer(gameState.currentPiece);
  const lokiTimer = __timers[__timers.length - 1]; // 3s auto-resolve timeout
  lokiTimer.fn();
  __results.shieldLives = gameState.lives; // expect 4 (extra life)

  // M6: Daya (4.png) is an auto piece - clicks are ignored, and 3 seconds
  // later it activates 4x-faster timers for 60 seconds (bad luck).
  gameState.mode = GAME_MODES['classic-9'];
  gameState.difficulty = 'easy';
  gameState.solution = generateSolution(9, 3, 3); // real solution so nextPiece works
  gameState.board = Array.from({ length: 9 }, () => Array(9).fill(null));
  gameState.puzzle = gameState.board.map(r => [...r]);
  gameState.currentPiece = { key: 'hints', file: 'assets/cats/4.png', label: 'Daya', desc: 'Bad luck!', kind: 'auto' };
  gameState.gameActive = true;
  gameState.lives = 3;
  gameState.errors = 0;
  gameState.hints = 0;
  renderBoard();
  handleCellClick(1, 1); // ignored for auto pieces
  __results.dayaClickIgnored = gameState.board[1][1] === null; // expect true
  startAutoPieceTimer(gameState.currentPiece);
  const dayaTimer = __timers[__timers.length - 1]; // 3s auto-resolve timeout
  dayaTimer.fn();
  __results.badLuckLeft = gameState.badLuckLeft; // expect 30

  // M7: bad luck makes the piece timer tick 4x faster; normal otherwise.
  gameState.badLuckLeft = 60;
  gameState.pieceTimeLeft = 100;
  pieceTimerTick();
  __results.badLuckTick = gameState.pieceTimeLeft; // expect 96
  __results.badLuckRemaining = gameState.badLuckLeft; // expect 59
  gameState.badLuckLeft = 0;
  gameState.pieceTimeLeft = 100;
  pieceTimerTick();
  __results.normalTick = gameState.pieceTimeLeft; // expect 99

  // TEST N: the same seed always generates the same puzzle; seeds are stored and shown.
  const genA = generateSeededGame('0xCAFEBABE', 9, 3, 3, 'medium');
  const genB = generateSeededGame('0xCAFEBABE', 9, 3, 3, 'medium');
  let seedSame = genA.solution.length === genB.solution.length && genA.puzzle.length === genB.puzzle.length;
  for (let r = 0; r < 9 && seedSame; r++) {
    for (let c = 0; c < 9 && seedSame; c++) {
      if (genA.solution[r][c] !== genB.solution[r][c]) seedSame = false;
      if (genA.puzzle[r][c] !== genB.puzzle[r][c]) seedSame = false;
    }
  }
  __results.seedDeterminism = seedSame;
  __results.seedDiffers = JSON.stringify(genA.puzzle) !== JSON.stringify(generateSeededGame('0x123456789', 9, 3, 3, 'medium').puzzle);

  gameModeSelect.value = 'classic-9';
  difficultySelect.value = 'medium';
  seedInputEl.value = '0xDEADBEEF';
  startNewGame();
  __results.seedStored = gameState.seed === '0xDEADBEEF';
  __results.seedShown = !seedBarEl.hidden && seedValueEl.textContent === '0xDEADBEEF';
  __results.seedPuzzleMatches = JSON.stringify(gameState.puzzle) === JSON.stringify(generateSeededGame('0xDEADBEEF', 9, 3, 3, 'medium').puzzle);
  // Uniform pastel mask for the start numbers: a fixed (given) cell carries an hsl() tint
  const fixedGiven = Array.from(boardEl.children).find(c => c.classList.contains('fixed'));
  __results.fixedRainbow = !!fixedGiven && fixedGiven.style.background.startsWith('hsl('); // expect true

  // TEST O: special-piece pity - guaranteed special within N pieces.
  // O1: at the pity cap (19 non-specials for medium/20) the next piece is guaranteed special.
  setup('classic-9', 'medium');
  gameState.difficulty = 'medium';
  gameState.lives = 3;
  gameState.hints = 0;
  gameState.sinceSpecial = 19;
  nextPiece();
  __results.pityGuaranteed = isSpecialPiece(gameState.currentPiece); // expect true
  __results.pityReset = gameState.sinceSpecial === 0; // expect true

  // O2: over many easy draws the gap between specials never exceeds pity-1 (9).
  gameState.mode = GAME_MODES['classic-9'];
  gameState.difficulty = 'easy';
  gameState.board = gameState.puzzle.map(r => [...r]);
  gameState.sinceSpecial = 0;
  let maxGap = 0;
  let gap = 0;
  for (let i = 0; i < 500; i++) {
    nextPiece();
    if (isSpecialPiece(gameState.currentPiece)) {
      maxGap = Math.max(maxGap, gap);
      gap = 0;
    } else {
      gap++;
    }
  }
  __results.maxGapEasy = maxGap; // expect <= 9

  // TEST P: a special piece shows its name + description in the piece tray.
  gameState.mode = GAME_MODES['classic-9'];
  gameState.difficulty = 'easy';
  const pickedSpecial = pickSpecialPiece();
  gameState.currentPiece = pickedSpecial;
  renderCurrentPiece();
  __results.specialInfoShown = !specialPieceInfoEl.hidden;
  __results.specialInfoName = specialPieceNameEl.textContent;
  __results.specialInfoDesc = specialPieceDescEl.textContent;
  __results.specialInfoOk =
    __results.specialInfoShown &&
    __results.specialInfoName === SPECIAL_PIECES[pickedSpecial.key].label &&
    __results.specialInfoDesc === T(SPECIAL_PIECES[pickedSpecial.key].desc);

  // TEST Q: the board intro animation staggers cells in via requestAnimationFrame.
  gameState.mode = GAME_MODES['classic-9'];
  gameState.solution = generateSolution(9, 3, 3);
  gameState.puzzle = gameState.solution.map(r => r.map(() => null));
  gameState.board = gameState.puzzle.map(r => [...r]);
  gameState.gameActive = true;
  gameState.lives = 3;
  gameState.errors = 0;
  gameState.hints = 0;
  renderBoard();
  __frames.length = 0;
  __clock = 0;
  animateBoardIn();
  __results.introFramesScheduled = __frames.length; // expect 1
  const introFirst = boardEl.children[0];
  const introLast = boardEl.children[boardEl.children.length - 1];
  // Run the first frame at t=0: every cell is hidden (stagger has not started)
  __frames.shift()();
  __results.introCellHiddenAtStart = introFirst.style.opacity === '0'; // expect true
  __clock = 900; // mid-wave: first cell should be visible, last cell still hidden
  __frames.shift()();
  __results.introFirstVisibleMidWave = introFirst.style.opacity !== '0'; // expect true
  __results.introLastHiddenMidWave = introLast.style.opacity === '0'; // expect true (staggered)
  let introGuard = 0;
  while (__frames.length && introGuard++ < 500) {
    __clock += 100;
    __frames.shift()();
  }
  __results.introAllVisible =
    introFirst.style.opacity === '1' && introLast.style.opacity === '1' && introGuard > 0; // expect true

  // TEST R: language switching (EN / DE / PL) + fallback.
  setLanguage('en');
  __results.i18nEn =
    T('startGame') === '▶ Start Game' &&
    T('livesCount', { n: 1 }) === '1 life' &&
    T('livesCount', { n: 3 }) === '3 lives';
  __results.i18nModeDesc =
    T('mode.classic9') === 'Classic 9x9' &&
    T('modeDesc.classic9').includes('9×9') &&
    T('modeDesc.kids4').includes('4×4');
  // The language buttons cycle through all nine: en -> de -> pl -> es -> ru -> tr -> fr -> no -> zh -> en
  cycleLanguage();
  __results.i18nCycle1 = currentLang === 'de';
  cycleLanguage();
  __results.i18nCycle2 = currentLang === 'pl';
  cycleLanguage();
  __results.i18nCycle3 = currentLang === 'es';
  cycleLanguage();
  __results.i18nCycle4 = currentLang === 'ru';
  cycleLanguage();
  __results.i18nCycle5 = currentLang === 'tr';
  cycleLanguage();
  __results.i18nCycle6 = currentLang === 'fr';
  cycleLanguage();
  __results.i18nCycle7 = currentLang === 'no';
  cycleLanguage();
  __results.i18nCycle8 = currentLang === 'zh';
  cycleLanguage();
  __results.i18nCycle9 = currentLang === 'en';
  setLanguage('de');
  __results.i18nDe =
    T('startGame') === '▶ Spiel starten' &&
    T('livesCount', { n: 3 }) === '3 Leben' &&
    T('diff.medium') === 'Mittel';
  setLanguage('pl');
  __results.i18nPl =
    T('startGame') === '▶ Rozpocznij grę' &&
    T('livesCount', { n: 1 }) === '1 życie' &&
    T('livesCount', { n: 2 }) === '2 życia' &&
    T('livesCount', { n: 5 }) === '5 żyć';
  setLanguage('es');
  __results.i18nEs =
    T('startGame') === '▶ Iniciar juego' &&
    T('livesCount', { n: 1 }) === '1 vida' &&
    T('livesCount', { n: 3 }) === '3 vidas';
  setLanguage('ru');
  __results.i18nRu =
    T('startGame') === '▶ Начать игру' &&
    T('livesCount', { n: 1 }) === '1 жизнь' &&
    T('livesCount', { n: 5 }) === '5 жизней';
  setLanguage('tr');
  __results.i18nTr =
    T('startGame') === '▶ Oyunu Başlat' &&
    T('livesCount', { n: 3 }) === '3 can';
  setLanguage('fr');
  __results.i18nFr =
    T('startGame') === '▶ Commencer la partie' &&
    T('livesCount', { n: 1 }) === '1 vie' &&
    T('livesCount', { n: 3 }) === '3 vies';
  setLanguage('no');
  __results.i18nNo =
    T('startGame') === '▶ Start spill' &&
    T('livesCount', { n: 3 }) === '3 liv' &&
    T('diff.medium') === 'Middels';
  setLanguage('zh');
  __results.i18nZh =
    T('startGame') === '▶ 开始游戏' &&
    T('livesCount', { n: 3 }) === '3 条命';
  __results.i18nFallback = T('no_such_key') === 'no_such_key'; // unknown -> key itself
  setLanguage('en');

  // TEST S: music + sfx mute toggles persist separately and never crash
  // without an AudioContext.
  toggleMusic();
  __results.musicPersisted = localStorage.getItem('tedosu_music_muted') === '1';
  toggleMusic();
  __results.musicUnmutedPersisted = localStorage.getItem('tedosu_music_muted') === '0';
  toggleSfx();
  __results.sfxPersisted = localStorage.getItem('tedosu_sfx_muted') === '1';
  toggleSfx();
  __results.sfxUnmutedPersisted = localStorage.getItem('tedosu_sfx_muted') === '0';
  __results.audioSafe = ensureAudio() === false; // no AudioContext in Node
  playSfx('win');
  playSfx('place');
  syncAudioButtons();
  __results.audioNoCrash = true;
})();
`;

vm.runInContext(code + '\n;' + testCode, sandbox);

const r = sandbox.__results;
console.log('TEST A (optimal play) - reported unplaceable-piece bug:');
console.log('  games played: ' + r.optimalGames);
console.log('  # games where handed piece had NO legal spot: ' + r.optimalUnplaceable);
console.log('  # games completed to full board: ' + r.optimalCompleted);
console.log('');
console.log('TEST B (wrong placement rejected):');
console.log('  rejected: ' + r.wrongRejected + ', lives: ' + r.wrongLives + ', errors: ' + r.wrongErrors + ', no colored mark: ' + r.wrongNoWarn);
console.log('');
console.log('TEST C (all modes) - solution validity + a starting move available:');
console.log('  generations checked: ' + r.allModeCount + ', valid solutions: ' + r.allModeValid + ', with a starting move: ' + r.allModeStartMoves);
console.log('');
console.log('TEST D (win modal):');
console.log('  modal shown: ' + r.modalShown + ', time: ' + r.modalTime + ', lives: ' + r.modalLives + ', errors: ' + r.modalErrors + ', title: ' + r.modalTitle);
console.log('TEST E (game-over modal):');
console.log('  modal shown: ' + r.loseShown + ', title: ' + r.loseTitle);
console.log('TEST F (every wrong move costs a life):');
console.log('  lives after 1 wrong: ' + r.hardLivesAfter1 + ', after 3 wrong: ' + r.hardLivesAfter3 + ', game over: ' + r.hardGameOver);
console.log('TEST G (no colored marks on wrong moves):');
console.log('  mark after click: ' + r.warnAfterClick + ', after re-render: ' + r.warnAfterRender + ', lives: ' + r.warnLives);
console.log('TEST I (per-piece timer):');
console.log('  classic pieceSeconds: ' + r.pieceSecondsClassic + ', shown: ' + r.pieceTimerShownClassic + ', lives after time-up: ' + r.livesAfterTimeUp + ', timer restarted: ' + r.pieceTimeLeftAfter + ', gameActive: ' + r.gameActiveAfter);
console.log('  kids pieceSeconds: ' + r.pieceSecondsKids + ', shown: ' + r.pieceTimerShownKids);
console.log('TEST J (message auto-clear):');
console.log('  shown: ' + r.msgShown + ', cleared after timeout: ' + r.msgCleared);
console.log('TEST K (difficulty descriptions):');
console.log('  classic medium: ' + r.descClassicMedium);
console.log('  classic easy: ' + r.descClassicEasy);
console.log('  kids hard: ' + r.descKidsHard);
console.log('  checks ok: ' + r.descChecksOk);
console.log('TEST L (random cat logo):');
console.log('  invariants ok (valid cat + matching name over 30 runs): ' + r.logoOk);
console.log('TEST M (special pieces):');
console.log('  pick ok: ' + r.specialPickOk + ', special rolled (forced): ' + r.specialRolled + ', key: ' + r.specialKey);
console.log('  joker fills correct: ' + r.jokerFilled + ', reveal class: ' + r.revealClass + ', radius-2 class: ' + r.revealClass2 + ', tint: ' + r.revealTint + ', full opacity: ' + r.revealFullOpacity + ', mid-fade: ' + r.revealMidFade + ', stays opaque at end: ' + r.revealStaysOpaque + ', reverted: ' + r.revealReverted + ', style cleared: ' + r.revealCleared + ', opacity cleared: ' + r.revealOpacityCleared + ', classes cleared: ' + r.revealClassesCleared);
console.log('  reveal timer scheduled: ' + r.revealTimerScheduled + ', keeps running on re-render: ' + r.revealKeepsRunningOnRender + ', re-applied to fresh cells: ' + r.revealReapplied + ', skips filled cells: ' + r.revealSkipsFilled + ', cleaned after 5s: ' + r.revealFinishedAfterRender);
console.log('  loki lives after auto-resolve: ' + r.shieldLives + ', auto click ignored: ' + r.autoClickIgnored);
console.log('  daya bad-luck seconds: ' + r.badLuckLeft + ', click ignored: ' + r.dayaClickIgnored);
console.log('  bad-luck tick: ' + r.badLuckTick + ' (expect 96), normal tick: ' + r.normalTick + ' (expect 99), bad-luck left: ' + r.badLuckRemaining);
console.log('TEST N (seeds):');
console.log('  determinism (same seed -> same puzzle): ' + r.seedDeterminism + ', different seed differs: ' + r.seedDiffers);
console.log('  seed stored: ' + r.seedStored + ', shown: ' + r.seedShown + ', puzzle matches seed: ' + r.seedPuzzleMatches);
console.log('  fixed start numbers pastel mask: ' + r.fixedRainbow);
console.log('TEST O (special pity):');
console.log('  guaranteed at cap: ' + r.pityGuaranteed + ', counter reset: ' + r.pityReset + ', max gap (easy, 500 pieces): ' + r.maxGapEasy);
console.log('TEST P (special piece info):');
console.log('  shown: ' + r.specialInfoShown + ', name: ' + r.specialInfoName + ', desc: ' + r.specialInfoDesc + ', ok: ' + r.specialInfoOk);
console.log('TEST Q (board intro animation):');
console.log('  frames scheduled: ' + r.introFramesScheduled + ', hidden at start: ' + r.introCellHiddenAtStart + ', first visible mid-wave: ' + r.introFirstVisibleMidWave + ', last hidden mid-wave: ' + r.introLastHiddenMidWave + ', all visible at end: ' + r.introAllVisible);
console.log('TEST R (language switching):');
console.log('  en: ' + r.i18nEn + ', de: ' + r.i18nDe + ', pl: ' + r.i18nPl + ', es: ' + r.i18nEs + ', ru: ' + r.i18nRu + ', tr: ' + r.i18nTr + ', fr: ' + r.i18nFr + ', no: ' + r.i18nNo + ', zh: ' + r.i18nZh + ', mode descriptions resolve: ' + r.i18nModeDesc + ', flag cycles all 9: ' + (r.i18nCycle1 && r.i18nCycle2 && r.i18nCycle3 && r.i18nCycle4 && r.i18nCycle5 && r.i18nCycle6 && r.i18nCycle7 && r.i18nCycle8 && r.i18nCycle9) + ', unknown-key fallback: ' + r.i18nFallback);
console.log('TEST S (audio toggles):');
console.log('  music persisted: ' + r.musicPersisted + ', unmuted persisted: ' + r.musicUnmutedPersisted + ', sfx persisted: ' + r.sfxPersisted + ', unmuted persisted: ' + r.sfxUnmutedPersisted + ', safe without audio: ' + r.audioSafe + ', no crash: ' + r.audioNoCrash);