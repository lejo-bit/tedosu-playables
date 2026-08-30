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
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
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
  localStorage: { getItem: () => null, setItem: () => {} },
  document: {
    getElementById: getEl,
    createElement: (tag) => makeEl('<' + tag + '>'),
    createTextNode: (text) => ({ nodeType: 3, textContent: String(text) })
  },
  __results: { optimalUnplaceable: 0, optimalGames: 0, optimalCompleted: 0, freeStuck: 0, freeCompleted: 0, freeWon: 0, freeGames: 0, winNoCredit: false }
};
vm.createContext(sandbox);
// Load the split source files in the same order as index.html.
const scriptFiles = ['config.js', 'state.js', 'dom.js', 'seeded.js', 'puzzle.js', 'game.js', 'ui.js'];
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
  // corrupted, and the mistake escalation still applies.
  setup('classic-9', 'easy');
  gameState.difficulty = 'easy';
  gameState.solution = Array.from({ length: 9 }, () => Array(9).fill(0)); // 0 != value 1 -> every cell is wrong
  gameState.puzzle = Array.from({ length: 9 }, () => Array(9).fill(null));
  gameState.board = gameState.puzzle.map(r => [...r]);
  gameState.warns = gameState.board.map(r => r.map(() => null));
  gameState.currentPiece = 1; // value 1
  gameState.gameActive = true;
  gameState.lives = 3;
  gameState.strikes = 0;
  gameState.errors = 0;
  renderBoard();
  handleCellClick(0, 0); // wrong -> rejected
  __results.wrongRejected = gameState.board[0][0] === null; // expect true
  __results.wrongStrikes = gameState.strikes; // expect 1
  __results.wrongLives = gameState.lives; // expect 3 (easy: 4th wrong loses a life)

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

  // TEST F: hard mode loses one life per wrong click -> game over at 0.
  gameState.mode = GAME_MODES['kids-4'];
  gameState.difficulty = 'hard';
  gameState.board = Array.from({ length: 4 }, () => Array(4).fill(null));
  gameState.board[0][1] = 1; // conflict in row 0 for value 1
  gameState.puzzle = Array.from({ length: 4 }, () => Array(4).fill(null));
  gameState.solution = Array.from({ length: 4 }, () => Array(4).fill(0)); // force every cell wrong for value 1
  gameState.currentPiece = 'assets/cats/1.png'; // value 1
  gameState.gameActive = true;
  gameState.lives = 3;
  gameState.strikes = 0;
  gameState.errors = 0;
  renderBoard();
  handleCellClick(0, 0);
  __results.hardLivesAfter1 = gameState.lives;
  handleCellClick(0, 0);
  handleCellClick(0, 0);
  __results.hardLivesAfter3 = gameState.lives;
  __results.hardGameOver = !gameState.gameActive;

  // TEST G: wrong-click warning marks persist across re-renders.
  gameState.mode = GAME_MODES['kids-4'];
  gameState.difficulty = 'easy';
  gameState.board = Array.from({ length: 4 }, () => Array(4).fill(null));
  gameState.board[0][1] = 1; // conflict in row 0 for value 1
  gameState.puzzle = Array.from({ length: 4 }, () => Array(4).fill(null));
  gameState.solution = Array.from({ length: 4 }, () => Array(4).fill(0)); // force every cell wrong for value 1
  gameState.warns = Array.from({ length: 4 }, () => Array(4).fill(null));
  gameState.currentPiece = 'assets/cats/1.png'; // value 1
  gameState.gameActive = true;
  gameState.lives = 3;
  gameState.strikes = 0;
  gameState.errors = 0;
  renderBoard();
  handleCellClick(0, 0); // easy, strike 1 -> yellow mark on (0,0)
  __results.warnStored = gameState.warns[0][0];
  __results.warnClassAfterClick = boardEl.children[0].classList.contains('cell-warn-yellow');
  renderBoard(); // re-render must keep the mark
  __results.warnAfterRender = boardEl.children[0].classList.contains('cell-warn-yellow');

  // TEST H: losing a life clears all warning marks back to white.
  gameState.mode = GAME_MODES['kids-4'];
  gameState.difficulty = 'easy';
  gameState.board = Array.from({ length: 4 }, () => Array(4).fill(null));
  gameState.board[0][1] = 1; // conflict in row 0 for value 1
  gameState.puzzle = Array.from({ length: 4 }, () => Array(4).fill(null));
  gameState.solution = Array.from({ length: 4 }, () => Array(4).fill(0)); // force every cell wrong for value 1
  gameState.warns = Array.from({ length: 4 }, () => Array(4).fill(null));
  gameState.currentPiece = 'assets/cats/1.png'; // value 1
  gameState.gameActive = true;
  gameState.lives = 3;
  gameState.strikes = 0;
  gameState.errors = 0;
  renderBoard();
  handleCellClick(0, 0); // strike 1 -> yellow
  handleCellClick(0, 0); // strike 2 -> orange
  handleCellClick(0, 0); // strike 3 -> red
  __results.warnBeforeLifeLoss = gameState.warns[0][0]; // expect 'red'
  handleCellClick(0, 0); // strike 4 -> lose a life, marks cleared
  __results.warnAfterLifeLoss = gameState.warns[0][0]; // expect null
  __results.livesAfterLifeLoss = gameState.lives; // expect 2
  __results.cellWhiteAfterLifeLoss =
    !boardEl.children[0].classList.contains('cell-warn-yellow') &&
    !boardEl.children[0].classList.contains('cell-warn-orange') &&
    !boardEl.children[0].classList.contains('cell-warn-red');

  // TEST I: per-piece timer - 9x9/16x16 only; expiry loses a life; kids has no timer.
  setup('classic-9', 'easy');
  gameState.difficulty = 'easy';
  gameState.lives = 3;
  gameState.strikes = 0;
  gameState.warns = gameState.board.map(r => r.map(() => null));
  nextPiece();
  __results.pieceSecondsClassic = gameState.pieceSeconds; // expect 120
  __results.pieceTimeLeftClassic = gameState.pieceTimeLeft; // expect 120
  __results.pieceTimerShownClassic = !pieceTimerWrapEl.hidden; // expect true
  onPieceTimerExpired(); // time-up -> lose a life, new piece + fresh timer
  __results.livesAfterTimeUp = gameState.lives; // expect 2
  __results.pieceTimeLeftAfter = gameState.pieceTimeLeft; // expect 120 (restarted)
  __results.gameActiveAfter = gameState.gameActive; // expect true

  setup('kids-4', 'easy');
  gameState.difficulty = 'easy';
  gameState.lives = 3;
  gameState.strikes = 0;
  gameState.warns = gameState.board.map(r => r.map(() => null));
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
    __results.descClassicMedium.includes('3 lives') && __results.descClassicMedium.includes('90s per piece') &&
    __results.descClassicEasy.includes('3 lives') && __results.descClassicEasy.includes('120s per piece') &&
    __results.descKidsHard.includes('no hints') && !__results.descKidsHard.includes('per piece');

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
  gameState.strikes = 0;
  gameState.hints = 0;
  gameState.shieldActive = false;
  gameState.warns = gameState.board.map(r => r.map(() => null));
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
  gameState.warns = gameState.board.map(r => r.map(() => null));
  gameState.currentPiece = { key: 'joker', file: 'assets/cats/1.png', label: 'Joker' };
  gameState.gameActive = true;
  gameState.lives = 3;
  gameState.strikes = 0;
  gameState.errors = 0;
  gameState.hints = 0;
  gameState.shieldActive = false;
  renderBoard();
  handleCellClick(2, 3);
  __results.jokerFilled = gameState.board[2][3] === gameState.solution[2][3];

  // M4: reveal flashes the 8 neighbors with their correct values, then reverts.
  gameState.mode = GAME_MODES['classic-9'];
  gameState.solution = generateSolution(9, 3, 3);
  gameState.puzzle = gameState.solution.map(r => r.map(() => null));
  gameState.board = gameState.puzzle.map(r => [...r]);
  gameState.warns = gameState.board.map(r => r.map(() => null));
  gameState.gameActive = true;
  gameState.lives = 3;
  gameState.strikes = 0;
  gameState.errors = 0;
  renderBoard();
  revealNeighbors(4, 4);
  const revIdx = (r, c) => r * 9 + c;
  __results.revealClass = boardEl.children[revIdx(3, 3)].classList.contains('reveal');
  __results.revealText = boardEl.children[revIdx(3, 3)].textContent === String(gameState.solution[3][3]);
  const revealTimer = __timers[__timers.length - 1];
  revealTimer.fn();
  __results.revealReverted = boardEl.children[revIdx(3, 3)].textContent === '';

  // M5: shield blocks life loss + error counting on wrong clicks.
  gameState.mode = GAME_MODES['classic-9'];
  gameState.difficulty = 'hard';
  gameState.board = Array.from({ length: 9 }, () => Array(9).fill(null));
  gameState.board[0][1] = 1; // conflict in row 0 for value 1
  gameState.puzzle = Array.from({ length: 9 }, () => Array(9).fill(null));
  gameState.solution = Array.from({ length: 9 }, () => Array(9).fill(0)); // force every cell wrong for value 1
  gameState.warns = gameState.board.map(r => r.map(() => null));
  gameState.currentPiece = 1; // normal value
  gameState.gameActive = true;
  gameState.lives = 3;
  gameState.strikes = 0;
  gameState.errors = 0;
  gameState.hints = 0;
  gameState.shieldActive = true;
  renderBoard();
  handleCellClick(0, 0);
  __results.shieldLives = gameState.lives; // expect 3
  __results.shieldErrors = gameState.errors; // expect 0

  // M6: bonus hints grants +2, and showHint consumes one in 9x9.
  gameState.mode = GAME_MODES['classic-9'];
  gameState.difficulty = 'easy';
  gameState.solution = generateSolution(9, 3, 3); // real solution so nextPiece works
  gameState.board = Array.from({ length: 9 }, () => Array(9).fill(null));
  gameState.puzzle = gameState.board.map(r => [...r]);
  gameState.warns = gameState.board.map(r => r.map(() => null));
  gameState.currentPiece = { key: 'hints', file: 'assets/cats/4.png', label: 'Bonus Hints' };
  gameState.gameActive = true;
  gameState.lives = 3;
  gameState.strikes = 0;
  gameState.errors = 0;
  gameState.hints = 0;
  gameState.shieldActive = false;
  renderBoard();
  handleCellClick(1, 1);
  __results.hintsAfter = gameState.hints; // expect 2
  gameState.currentPiece = 1; // normal piece
  showHint();
  __results.hintsAfterUse = gameState.hints; // expect 1

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

  // TEST O: special-piece pity - guaranteed special within N pieces.
  // O1: at the pity cap (19 non-specials for medium/20) the next piece is guaranteed special.
  setup('classic-9', 'medium');
  gameState.difficulty = 'medium';
  gameState.lives = 3;
  gameState.strikes = 0;
  gameState.hints = 0;
  gameState.shieldActive = false;
  gameState.warns = gameState.board.map(r => r.map(() => null));
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
    __results.specialInfoDesc === SPECIAL_PIECES[pickedSpecial.key].desc;
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
console.log('  rejected: ' + r.wrongRejected + ', strikes: ' + r.wrongStrikes + ', lives: ' + r.wrongLives);
console.log('');
console.log('TEST C (all modes) - solution validity + a starting move available:');
console.log('  generations checked: ' + r.allModeCount + ', valid solutions: ' + r.allModeValid + ', with a starting move: ' + r.allModeStartMoves);
console.log('');
console.log('TEST D (win modal):');
console.log('  modal shown: ' + r.modalShown + ', time: ' + r.modalTime + ', lives: ' + r.modalLives + ', errors: ' + r.modalErrors + ', title: ' + r.modalTitle);
console.log('TEST E (game-over modal):');
console.log('  modal shown: ' + r.loseShown + ', title: ' + r.loseTitle);
console.log('TEST F (hard lives):');
console.log('  lives after 1 wrong: ' + r.hardLivesAfter1 + ', after 3 wrong: ' + r.hardLivesAfter3 + ', game over: ' + r.hardGameOver);
console.log('TEST G (persistent warn marks):');
console.log('  stored: ' + r.warnStored + ', class after click: ' + r.warnClassAfterClick + ', kept after re-render: ' + r.warnAfterRender);
console.log('TEST H (marks clear on life loss):');
console.log('  warn before life loss: ' + r.warnBeforeLifeLoss + ', after: ' + r.warnAfterLifeLoss + ', lives after: ' + r.livesAfterLifeLoss + ', cell white again: ' + r.cellWhiteAfterLifeLoss);
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
console.log('  joker fills correct: ' + r.jokerFilled + ', reveal class: ' + r.revealClass + ', reveal text: ' + r.revealText + ', reverted: ' + r.revealReverted);
console.log('  shield lives: ' + r.shieldLives + ', errors: ' + r.shieldErrors + ', hints after grant: ' + r.hintsAfter + ', after use: ' + r.hintsAfterUse);
console.log('TEST N (seeds):');
console.log('  determinism (same seed -> same puzzle): ' + r.seedDeterminism + ', different seed differs: ' + r.seedDiffers);
console.log('  seed stored: ' + r.seedStored + ', shown: ' + r.seedShown + ', puzzle matches seed: ' + r.seedPuzzleMatches);
console.log('TEST O (special pity):');
console.log('  guaranteed at cap: ' + r.pityGuaranteed + ', counter reset: ' + r.pityReset + ', max gap (easy, 500 pieces): ' + r.maxGapEasy);
console.log('TEST P (special piece info):');
console.log('  shown: ' + r.specialInfoShown + ', name: ' + r.specialInfoName + ', desc: ' + r.specialInfoDesc + ', ok: ' + r.specialInfoOk);