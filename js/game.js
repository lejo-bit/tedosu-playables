// =====================================================================
// GAME: setup, piece handling, moves, win/lose, and per-piece timers
// =====================================================================

// Trims the player's seed input; empty input -> a fresh random seed.
function resolveSeed(raw) {
  const trimmed = (raw || '').trim();
  return trimmed ? trimmed : randomSeed();
}

// Starts (or restarts) a game using the current mode + difficulty settings.
// Pass { keepSeed: true } to replay the current puzzle's seed (used by Reset).
function startNewGame(opts = {}) {
  // Stop any existing timers
  if (gameState.timerInterval) {
    clearInterval(gameState.timerInterval);
  }
  stopPieceTimer();
  stopReveal();

  // Get settings
  const modeKey = gameModeSelect.value;
  gameState.mode = GAME_MODES[modeKey];
  let difficulty = difficultySelect.value;
  if (modeKey === 'kids-4' && difficulty === 'medium') difficulty = 'easy';
  gameState.difficulty = difficulty;
  gameState.timed = true;

  // Resolve the seed (replay on Reset, otherwise typed seed or random) and
  // generate the puzzle deterministically from it.
  const seed = opts.keepSeed && gameState.seed ? gameState.seed : resolveSeed(seedInputEl.value);
  gameState.seed = seed;
  const generated = generateSeededGame(seed, gameState.mode.size, gameState.mode.boxRows, gameState.mode.boxCols, gameState.difficulty);
  gameState.solution = generated.solution;
  gameState.puzzle = generated.puzzle;
  gameState.board = generated.puzzle.map(row => [...row]);

  // Reset state
  const rules = DIFFICULTY_RULES[gameState.difficulty] || DIFFICULTY_RULES.easy;
  gameState.lives = rules.lives;
  gameState.sinceSpecial = 0;
  gameState.errors = 0;
  gameState.timer = 0;
  gameState.hints = 0;
  gameState.badLuckLeft = 0;
  stopAutoPieceTimer();
  gameState.gameActive = true;

  // Audio: (re)start the music if enabled (Start/New/Reset/Play Again are gestures)
  ensureAudio();
  if (!musicMuted) startMusic();

  // Update header
  gameModeTitleEl.textContent = T('mode.' + modeKey.replace(/-/g, ''));
  gameBadgeEl.textContent = T('diff.' + difficulty);

  // Update UI
  renderBoard();
  updateTimer();
  updateInfo();
  updateControls();
  updateSeedDisplay();
  nextPiece();
  showMessage(T('gameStarted'), 'info');
  showScreen('game');
  animateBoardIn(); // board cells appear staggered (zoom-in) once visible

  // Start the overall game timer, paused while the intro animation plays so
  // the clock doesn't tick before the board appears.
  if (gameState.timed) {
    gameState.timerInterval = setTimeout(() => {
      gameState.timerInterval = setInterval(() => {
        gameState.timer++;
        updateTimer();
      }, 1000);
    }, 1600);
  }
}

// Counts the empty cells where `value` is the CORRECT (solution) placement.
// Because the board is always a subset of the solution, each of these is
// automatically a valid sudoku move too.
function legalSpotCountForValue(value) {
  const size = gameState.mode.size;
  let count = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (gameState.board[r][c] === null && gameState.solution[r][c] === value) count++;
    }
  }
  return count;
}

// Returns the pieces (values) that currently have at least one legal spot,
// so the player is never handed a piece they cannot place.
function getPlayablePieces() {
  const values = gameState.mode.values;
  return values.filter((piece) => legalSpotCountForValue(values.indexOf(piece) + 1) > 0);
}

// No piece can be placed anywhere while cells remain empty - the game is stuck.
function handleNoMoves() {
  gameState.gameActive = false;
  stopPieceTimer();
  showMessage(T('noMoves'), 'error');
}

// True when the current piece is one of the special cat power-ups.
function isSpecialPiece(piece) {
  return piece && typeof piece === 'object' && piece.file;
}

// Picks a special cat piece using the configured weights (35/35/15/15).
function pickSpecialPiece() {
  const entries = Object.entries(SPECIAL_PIECES);
  const totalWeight = entries.reduce((sum, [, p]) => sum + p.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const [key, piece] of entries) {
    roll -= piece.weight;
    if (roll <= 0) return { key, file: piece.file, label: piece.label, desc: piece.desc, kind: piece.kind };
  }
  const last = entries[entries.length - 1];
  return { key: last[0], file: last[1].file, label: last[1].label, desc: last[1].desc, kind: last[1].kind };
}

// Counts the empty (null) cells in a grid.
function countEmpty(grid) {
  return grid.reduce((sum, row) => sum + row.filter(v => v === null).length, 0);
}

// Deals the next piece (a special cat, or a normal always-placeable value)
// and (re)starts its timer.
function nextPiece() {
  const rules = DIFFICULTY_RULES[gameState.difficulty] || DIFFICULTY_RULES.easy;
  const isKids = gameState.mode.type === 'icons';

  // Special cat pieces (9x9 / 16x16 only). The odds start at the difficulty's
  // base chance and shrink as the board fills up, reaching 0% when only 10
  // empty cells remain. A pity system keeps the early game fair (the chance
  // rises after every non-special piece), but the whole roll is scaled by the
  // gap factor so the 0%-at-10-gaps rule always wins.
  const baseChance = rules.specialChance || 0;
  if (!isKids && baseChance > 0) {
    const startGaps = countEmpty(gameState.puzzle);
    const gaps = countEmpty(gameState.board);
    const gapFactor = startGaps > 10
      ? Math.max(0, Math.min(1, (gaps - 10) / (startGaps - 10)))
      : 0;
    const pity = rules.specialPity || 1;
    const pityStep = Math.max(1, pity - 1);
    const chance = gapFactor * Math.min(1, baseChance + (1 - baseChance) * (gameState.sinceSpecial / pityStep));
    if (Math.random() < chance) {
      gameState.sinceSpecial = 0;
      const piece = pickSpecialPiece();
      gameState.currentPiece = piece;
      renderCurrentPiece();
      playSfx('special');
      if (piece.kind === 'auto') {
        startAutoPieceTimer(piece);
      } else {
        startPieceTimer();
      }
      return;
    }
    gameState.sinceSpecial++;
  }

  const playable = getPlayablePieces();
  if (playable.length === 0) {
    handleNoMoves();
    return;
  }
  gameState.currentPiece = playable[Math.floor(Math.random() * playable.length)];
  renderCurrentPiece();
  startPieceTimer();
}

// Handles a click on an empty cell: applies the piece or counts a mistake.
function handleCellClick(row, col) {
  if (!gameState.gameActive) return;
  if (gameState.puzzle[row][col] !== null) return; // Fixed cell

  const currentPiece = gameState.currentPiece;

  // Special cat piece? Route to its effect.
  if (isSpecialPiece(currentPiece)) {
    // Auto pieces (Loki / Daya) resolve on their own - clicks are ignored.
    if (currentPiece.kind === 'auto') return;
    applySpecialPiece(currentPiece, row, col);
    return;
  }

  const index = gameState.mode.values.indexOf(currentPiece);
  const value = index + 1; // Internal value (1-based)

  if (gameState.solution[row][col] === value) {
    // Correct placement (matches the puzzle's solution). The board is always
    // a subset of the solution, so the game can never dead-end.
    gameState.board[row][col] = value;
    renderBoard();
    updateInfo();
    playSfx('place');

    // Check win
    if (checkWin()) {
      endGame(true);
    } else {
      nextPiece();
    }
  } else {
    // Wrong cell for this piece: every wrong move costs one life.
    gameState.errors++;
    updateInfo();
    playSfx('mistake');
    if (loseLife(T('mistake'))) return; // game over - out of lives
  }
}

// Applies a special cat piece effect at the clicked cell, then deals a new piece.
function applySpecialPiece(piece, row, col) {
  switch (piece.key) {
    case 'joker': {
      // Joker fills the cell with its correct value (acts as any number).
      gameState.board[row][col] = gameState.solution[row][col];
      renderBoard();
      updateInfo();
      // Wave ripple effect around the filled cell.
      const cellEl = boardEl.children[row * gameState.mode.size + col];
      if (cellEl) {
        cellEl.classList.add('cell-wave');
        setTimeout(() => cellEl.classList.remove('cell-wave'), 750);
      }
      if (checkWin()) {
        endGame(true);
        return;
      }
      showMessage(T('jokerPlaced'), 'success');
      playSfx('place');
      break;
    }

    case 'reveal':
      revealNeighbors(row, col);
      showMessage(T('spyReveal'), 'info');
      break;
  }
  nextPiece();
}

// Spy reveal (2.png): flashes the clicked cell and every cell within 2 fields
// of it, tinted a warm orange. They stay fully visible for 1 second, then
// slowly fade out over the next 4 seconds (5 seconds total). The reveal is
// stored as data (coordinates + start time) rather than DOM references so it
// survives board re-renders: placing the next tile must NOT cancel it - the
// effect keeps fading for its full duration. The fade is JS-driven so it
// works in every browser, including with reduced-motion preferences enabled.
const REVEAL_HOLD_MS = 1000; // fully visible for 1 second
const REVEAL_FADE_MS = 4000; // then blend out over the next 4 seconds
const REVEAL_TOTAL_MS = REVEAL_HOLD_MS + REVEAL_FADE_MS;
// Fade endpoints: the warm orange fill rgb(241, 153, 76) blends toward the
// normal empty-cell white rgba(255, 255, 255, 0.72), and the revealed number
// fades out via its text-alpha. The cells stay fully opaque, so the effect
// dissolves into the board instead of flashing transparent at the end.

const revealNow = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

function revealNeighbors(row, col) {
  stopReveal(); // cancel any previous reveal first
  const size = gameState.mode.size;
  gameState.revealCells = [];
  for (let r = row - 2; r <= row + 2; r++) {
    for (let c = col - 2; c <= col + 2; c++) {
      if (r < 0 || r >= size || c < 0 || c >= size) continue;
      if (gameState.board[r][c] !== null) continue; // already filled
      gameState.revealCells.push({ row: r, col: c });
    }
  }
  gameState.revealStart = revealNow();
  applyReveal();
  gameState.revealTimeout = setTimeout(revealStep, 50);
}

// Fade progress (0..1) of the Spy reveal: 0 while fully visible, rising to 1
// over the 4-second fade. The cells never turn transparent - the fill blends
// toward the normal cell background and the number fades out, so the effect
// dissolves into the board instead of blinking at the end.
function revealFadeProgress() {
  const elapsed = revealNow() - gameState.revealStart;
  if (elapsed <= REVEAL_HOLD_MS) return 0;
  return Math.min(1, (elapsed - REVEAL_HOLD_MS) / REVEAL_FADE_MS);
}

// Re-applies the reveal to the current board cells. Safe to call after a
// re-render (cells may have been recreated). Cells that were filled since the
// reveal started keep their normal filled look and are skipped.
function applyReveal() {
  if (!gameState.revealCells.length) return;
  const size = gameState.mode.size;
  const p = revealFadeProgress();
  // Blend the fill from warm orange rgb(241, 153, 76) to the normal
  // empty-cell white rgba(255, 255, 255, 0.72), and fade the number out.
  const r = Math.round(241 + (255 - 241) * p);
  const g = Math.round(153 + (255 - 153) * p);
  const b = Math.round(76 + (255 - 76) * p);
  const a = 1 - 0.28 * p;
  const bg = 'rgba(' + r + ', ' + g + ', ' + b + ', ' + a + ')';
  const textAlpha = 1 - p;
  for (const { row, col } of gameState.revealCells) {
    if (gameState.board[row][col] !== null) continue; // filled since reveal
    const cell = boardEl.children[row * size + col];
    if (!cell) continue;
    cell.textContent = getValueDisplay(gameState.solution[row][col]);
    cell.style.background = bg;
    cell.style.color = 'hsla(25, 78%, 28%, ' + textAlpha + ')';
    cell.classList.add('reveal');
  }
}

function revealStep() {
  if (revealNow() - gameState.revealStart < REVEAL_TOTAL_MS) {
    applyReveal();
    gameState.revealTimeout = setTimeout(revealStep, 50);
    return;
  }
  // Fade finished - clean up completely
  gameState.revealTimeout = null;
  clearRevealCells();
}

// Removes the reveal styling from every still-empty revealed cell. Cells that
// were filled during the reveal are left untouched (they keep their normal
// filled look).
function clearRevealCells() {
  const size = gameState.mode.size;
  for (const { row, col } of gameState.revealCells) {
    if (gameState.board[row][col] !== null) continue; // filled - leave alone
    const cell = boardEl.children[row * size + col];
    if (!cell) continue;
    cell.classList.remove('reveal');
    cell.style.background = '';
    cell.style.color = '';
    cell.style.opacity = '';
    cell.textContent = '';
  }
  gameState.revealCells = [];
}

// Cancels a pending Spy reveal (new game, menu, game over) and clears any
// revealed cells immediately.
function stopReveal() {
  if (gameState.revealTimeout) {
    clearTimeout(gameState.revealTimeout);
    gameState.revealTimeout = null;
  }
  if (gameState.revealCells.length) {
    clearRevealCells();
  }
}

// Checks whether the whole board is a valid Sudoku (rows, columns, boxes).
function isBoardValid() {
  const size = gameState.mode.size;
  const boxRows = gameState.mode.boxRows;
  const boxCols = gameState.mode.boxCols;
  // Each row and column must contain 1..size exactly once
  for (let i = 0; i < size; i++) {
    const rowSet = new Set();
    const colSet = new Set();
    for (let j = 0; j < size; j++) {
      const rv = gameState.board[i][j];
      const cv = gameState.board[j][i];
      if (rv == null || rv < 1 || rv > size) return false;
      if (cv == null || cv < 1 || cv > size) return false;
      if (rowSet.has(rv)) return false;
      if (colSet.has(cv)) return false;
      rowSet.add(rv);
      colSet.add(cv);
    }
  }
  // Each box must contain 1..size exactly once
  for (let br = 0; br < size; br += boxRows) {
    for (let bc = 0; bc < size; bc += boxCols) {
      const boxSet = new Set();
      for (let r = br; r < br + boxRows; r++) {
        for (let c = bc; c < bc + boxCols; c++) {
          const v = gameState.board[r][c];
          if (boxSet.has(v)) return false;
          boxSet.add(v);
        }
      }
    }
  }
  return true;
}

// True when every cell is filled and the board is a valid Sudoku.
function checkWin() {
  const size = gameState.mode.size;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (gameState.board[row][col] === null) return false;
    }
  }
  return isBoardValid();
}

// Ends the game: stops timers and shows the win or game-over modal.
function endGame(won) {
  gameState.gameActive = false;
  if (gameState.timerInterval) {
    clearInterval(gameState.timerInterval);
  }
  stopPieceTimer();
  stopAutoPieceTimer();
  stopReveal();
  gameState.badLuckLeft = 0;
  pieceTimerWrapEl.classList.remove('crazy', 'urgent');

  winTimeEl.textContent = formatTime(gameState.timer);
  winLivesEl.textContent = renderHearts(gameState.lives);
  winErrorsEl.textContent = gameState.errors;

  if (won) {
    winTitleEl.textContent = T('youWin');
    winMessageEl.classList.remove('danger');
    let bestNote = '';
    let bestTime = gameState.timer; // completion time in seconds = the score
    if (gameState.timed) {
      // Best-time tracking. localStorage may be unavailable on file:// URLs
      // (some browsers throw), so it is guarded and never breaks the modal.
      try {
        const key = `best_${gameModeSelect.value}`;
        const best = localStorage.getItem(key);
        if (!best || gameState.timer < parseInt(best)) {
          localStorage.setItem(key, gameState.timer.toString());
          bestNote = T('newBest');
          bestTime = gameState.timer;
        } else {
          bestNote = T('bestTime', { time: formatTime(parseInt(best)) });
          bestTime = parseInt(best, 10);
        }
      } catch (e) {
        bestNote = '';
        bestTime = gameState.timer;
      }
    }
    winMessageEl.textContent = bestNote;
    playSfx('win');
    showMessage(bestNote ? T('congratsBest', { note: bestNote }) : T('congrats'), 'success');

    // YouTube Playables: report the best completion time (seconds) as the
    // score and persist progress to the cloud save. Both are safe no-ops
    // outside YouTube (Platform validates + floors the value internally).
    Platform.sendScore(bestTime);
    Platform.saveData(Platform.buildCloudState());
  } else {
    winTitleEl.textContent = T('gameOver');
    winMessageEl.classList.add('danger');
    winMessageEl.textContent = T('ranOutOfLives');
    playSfx('gameover');
    showMessage(T('gameOverMsg'), 'error');
  }

  winModal.hidden = false;
  winModal.classList.add('active');
}

// Hint button: flashes one random valid cell for the current piece.
// In 9x9 / 16x16 each hint consumes one use from the bonus-hints resource.
function showHint() {
  if (!gameState.gameActive) return;

  const isKids = gameState.mode.type === 'icons';
  if (!isKids) {
    if (gameState.hints <= 0) return;
    gameState.hints--;
    updateHintsPill();
  }

  const currentPiece = gameState.currentPiece;
  const size = gameState.mode.size;
  const validPositions = [];

  if (isSpecialPiece(currentPiece)) {
    // Special pieces can be placed on any empty cell
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (gameState.board[row][col] === null) validPositions.push({ row, col });
      }
    }
  } else {
    const index = gameState.mode.values.indexOf(currentPiece);
    const value = index + 1;
    // Find the correct (solution) positions for the current value
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (gameState.board[row][col] === null && gameState.solution[row][col] === value) {
          validPositions.push({ row, col });
        }
      }
    }
  }

  if (validPositions.length > 0) {
    // Highlight one random valid position
    const hint = validPositions[Math.floor(Math.random() * validPositions.length)];
    const cellIndex = hint.row * size + hint.col;
    const cell = boardEl.children[cellIndex];
    cell.classList.add('highlight');
    setTimeout(() => cell.classList.remove('highlight'), 1500);
    showMessage(T('hintShown'), 'info');
  }
}

// Loses one heart and ends the game when the last heart is gone.
// Returns true if game over.
function loseLife(reason) {
  gameState.lives--;
  renderBoard();
  updateInfo();
  playSfx('lose');
  if (gameState.lives <= 0) {
    endGame(false); // Game over - out of lives
    return true;
  }
  showMessage(`${reason} ${T('lifeLeft', { n: gameState.lives })}`, 'error');
  return false;
}

// --- Per-piece countdown timer (9x9 / 16x16 only) ---------------------

// Refreshes the countdown pill; hides it when there is no per-piece timer.
// Under Daya's bad luck the pill shows a ×4 badge and the "crazy" shake.
function updatePieceTimer() {
  const active = gameState.mode && gameState.mode.type !== 'icons' && gameState.gameActive && gameState.pieceSeconds > 0;
  if (active) {
    pieceTimerWrapEl.hidden = false;
    const crazy = gameState.badLuckLeft > 0;
    pieceTimerValueEl.textContent = formatTime(gameState.pieceTimeLeft) + (crazy ? ' ×4' : '');
    pieceTimerWrapEl.classList.toggle('crazy', crazy);
    pieceTimerWrapEl.classList.toggle('urgent', gameState.pieceTimeLeft <= 10 && !crazy);
    // Low-time warning sound (plays once per piece)
    if (gameState.pieceTimeLeft <= 10 && !crazy && !gameState.urgentPlayed) {
      playSfx('urgent');
      gameState.urgentPlayed = true;
    }
  } else {
    pieceTimerWrapEl.hidden = true;
    pieceTimerWrapEl.classList.remove('crazy', 'urgent');
  }
}

// Starts a fresh countdown for the current piece.
function startPieceTimer() {
  stopPieceTimer();
  const rules = DIFFICULTY_RULES[gameState.difficulty] || DIFFICULTY_RULES.easy;
  // Kids mode has no per-piece timer; 9x9 and 16x16 each have their own seconds
  const hasTimer = gameState.mode && gameState.mode.type !== 'icons';
  const modeSeconds = (hasTimer && rules.pieceSeconds) ? (rules.pieceSeconds[gameState.mode.key] || 0) : 0;
  gameState.pieceSeconds = modeSeconds;
  gameState.pieceTimeLeft = gameState.pieceSeconds;
  gameState.urgentPlayed = false;
  updatePieceTimer();
  if (gameState.pieceSeconds <= 0) return;
  gameState.pieceTimerInterval = setInterval(pieceTimerTick, 1000);
}

// One second of the per-piece countdown. While Daya's bad luck is active the
// timer ticks 4x faster for 30 real seconds.
function pieceTimerTick() {
  const crazy = gameState.badLuckLeft > 0;
  gameState.pieceTimeLeft -= crazy ? 4 : 1;
  if (crazy) gameState.badLuckLeft--;
  updatePieceTimer();
  if (gameState.pieceTimeLeft <= 0) {
    stopPieceTimer();
    onPieceTimerExpired();
  }
}

// Stops the per-piece countdown (if any).
function stopPieceTimer() {
  if (gameState.pieceTimerInterval) {
    clearInterval(gameState.pieceTimerInterval);
    gameState.pieceTimerInterval = null;
  }
}

// The current piece ran out of time: lose a life, then deal a new piece.
function onPieceTimerExpired() {
  if (!gameState.gameActive) return;
  if (loseLife(T('timesUp'))) return; // game over - out of lives
  nextPiece(); // a fresh piece restarts the timer
}

// --- Auto-resolving special pieces (Loki / Daya) -----------------------

// Auto pieces resolve on their own 3 seconds after being dealt - no click.
function startAutoPieceTimer(piece) {
  stopPieceTimer(); // no normal countdown while an auto piece is showing
  gameState.pieceSeconds = 0;
  updatePieceTimer(); // hides the countdown pill
  stopAutoPieceTimer();
  gameState.autoPieceTimeout = setTimeout(() => {
    if (!gameState.gameActive) return;
    applyAutoPiece(piece);
  }, 3000);
}

// Cancels a pending auto-resolve (new game, menu, game over).
function stopAutoPieceTimer() {
  if (gameState.autoPieceTimeout) {
    clearTimeout(gameState.autoPieceTimeout);
    gameState.autoPieceTimeout = null;
  }
}

// Applies the effect of an auto piece, then deals the next piece.
function applyAutoPiece(piece) {
  if (piece.key === 'shield') {
    // Loki - Extra life!
    gameState.lives++;
    updateInfo();
    spawnHeartPop();
    livesEl.classList.add('lives-pop');
    setTimeout(() => livesEl.classList.remove('lives-pop'), 750);
    playSfx('heart');
    showMessage(T('extraLife'), 'success');
  } else if (piece.key === 'hints') {
    // Daya - Bad luck: the piece timer runs 4x faster for 30 seconds.
    gameState.badLuckLeft = 30;
    playSfx('badluck');
    showMessage(T('badLuck'), 'error');
  }
  nextPiece();
}

