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
  gameState.strikes = 0;
  gameState.sinceSpecial = 0;
  gameState.warns = gameState.board.map(row => row.map(() => null));
  gameState.errors = 0;
  gameState.timer = 0;
  gameState.gameActive = true;

  // Update header
  const modeLabel = gameModeSelect.options[gameModeSelect.selectedIndex].text;
  gameModeTitleEl.textContent = modeLabel;
  gameBadgeEl.textContent = gameState.difficulty.charAt(0).toUpperCase() + gameState.difficulty.slice(1);

  // Update UI
  renderBoard();
  updateTimer();
  updateInfo();
  updateControls();
  updateSeedDisplay();
  nextPiece();
  showMessage('Game started! Place the current piece.', 'info');
  showScreen('game');

  // Start the overall game timer
  if (gameState.timed) {
    gameState.timerInterval = setInterval(() => {
      gameState.timer++;
      updateTimer();
    }, 1000);
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
  showMessage('No valid moves left - press Reset to try again.', 'error');
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
    if (roll <= 0) return { key, file: piece.file, label: piece.label, desc: piece.desc };
  }
  const last = entries[entries.length - 1];
  return { key: last[0], file: last[1].file, label: last[1].label, desc: last[1].desc };
}

// Deals the next piece (a special cat, or a normal always-placeable value)
// and (re)starts its timer.
function nextPiece() {
  const rules = DIFFICULTY_RULES[gameState.difficulty] || DIFFICULTY_RULES.easy;
  const isKids = gameState.mode.type === 'icons';

  // Special cat pieces (9x9 / 16x16 only) use a pity system: the chance rises
  // after every non-special piece and is guaranteed at the pity cap.
  const baseChance = rules.specialChance || 0;
  if (!isKids && baseChance > 0) {
    const pity = rules.specialPity || 1;
    const pityStep = Math.max(1, pity - 1);
    const chance = Math.min(1, baseChance + (1 - baseChance) * (gameState.sinceSpecial / pityStep));
    if (Math.random() < chance) {
      gameState.sinceSpecial = 0;
      gameState.currentPiece = pickSpecialPiece();
      renderCurrentPiece();
      startPieceTimer();
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
    applySpecialPiece(currentPiece, row, col);
    return;
  }

  const index = gameState.mode.values.indexOf(currentPiece);
  const value = index + 1; // Internal value (1-based)

  if (gameState.solution[row][col] === value) {
    // Correct placement (matches the puzzle's solution). The board is always
    // a subset of the solution, so the game can never dead-end.
    gameState.board[row][col] = value;
    gameState.strikes = 0; // reset mistake escalation after a correct move
    if (gameState.warns[row]) gameState.warns[row][col] = null; // correct fill clears the mark
    renderBoard();
    updateInfo();

    // Check win
    if (checkWin()) {
      endGame(true);
    } else {
      nextPiece();
    }
  } else {
    // Wrong cell for this piece
    if (gameState.shieldActive) {
      // Shield active: mistakes are free - no punishment
      showMessage('Shield active - mistakes are not punished!', 'info');
      return;
    }
    gameState.errors++;
    const rules = DIFFICULTY_RULES[gameState.difficulty] || DIFFICULTY_RULES.easy;
    gameState.strikes++;
    updateInfo();

    // Persist the escalation color on the clicked cell (cleared on fill, life loss, or new game)
    const tierIndex = Math.min(gameState.strikes - 1, rules.warnKeys.length - 1);
    const warnKey = rules.warnKeys[tierIndex] || 'red';
    if (gameState.warns[row]) gameState.warns[row][col] = warnKey;
    const cellIndex = row * gameState.mode.size + col;
    const cell = boardEl.children[cellIndex];
    cell.classList.remove('cell-warn-yellow', 'cell-warn-orange', 'cell-warn-red');
    cell.classList.add(`cell-warn-${warnKey}`);

    if (gameState.strikes >= rules.lifeLostAt) {
      if (loseLife('Mistake!')) return; // game over - out of lives
    } else {
      showMessage('Invalid move! Try again.', 'error');
    }
  }
}

// Applies a special cat piece effect at the clicked cell, then deals a new piece.
function applySpecialPiece(piece, row, col) {
  switch (piece.key) {
    case 'joker':
      // Joker fills the cell with its correct value (acts as any number).
      gameState.board[row][col] = gameState.solution[row][col];
      gameState.strikes = 0;
      if (gameState.warns[row]) gameState.warns[row][col] = null;
      renderBoard();
      updateInfo();
      if (checkWin()) {
        endGame(true);
        return;
      }
      showMessage('Joker: Placed the correct number.', 'success');
      break;

    case 'reveal':
      revealNeighbors(row, col);
      showMessage('Spy: Numbers shown for 1 second.', 'info');
      break;

    case 'shield':
      gameState.shieldActive = true;
      showMessage('Shield active: no mistakes on this field for the rest of the game!', 'success');
      break;

    case 'hints':
      gameState.hints += 2;
      updateHintsPill();
      updateControls();
      showMessage('You gained 2 hints!', 'success');
      break;
  }
  nextPiece();
}

// Flashes the correct values of the 8 cells surrounding (row, col) for 1 second.
function revealNeighbors(row, col) {
  const size = gameState.mode.size;
  const revealed = [];
  for (let r = row - 1; r <= row + 1; r++) {
    for (let c = col - 1; c <= col + 1; c++) {
      if (r === row && c === col) continue; // skip the anchor cell
      if (r < 0 || r >= size || c < 0 || c >= size) continue;
      if (gameState.board[r][c] !== null) continue; // already filled
      const cell = boardEl.children[r * size + c];
      if (!cell) continue;
      cell.textContent = getValueDisplay(gameState.solution[r][c]);
      cell.classList.add('reveal');
      revealed.push({ cell, row: r, col: c });
    }
  }
  // Revert the reveal after 1 second
  setTimeout(() => {
    for (const { cell, row: rr, col: cc } of revealed) {
      cell.classList.remove('reveal');
      if (gameState.board[rr][cc] === null) cell.textContent = '';
    }
  }, 1000);
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

  winTimeEl.textContent = formatTime(gameState.timer);
  winLivesEl.textContent = renderHearts(gameState.lives);
  winErrorsEl.textContent = gameState.errors;

  if (won) {
    winTitleEl.textContent = '🎉 You Win!';
    winMessageEl.classList.remove('danger');
    let bestNote = '';
    if (gameState.timed) {
      const key = `best_${gameModeSelect.value}`;
      const best = localStorage.getItem(key);
      if (!best || gameState.timer < parseInt(best)) {
        localStorage.setItem(key, gameState.timer.toString());
        bestNote = 'New best time!';
      } else {
        bestNote = `Best: ${formatTime(parseInt(best))}`;
      }
    }
    winMessageEl.textContent = bestNote;
    showMessage(bestNote ? `Congratulations! ${bestNote}` : 'Congratulations!', 'success');
  } else {
    winTitleEl.textContent = '💔 Game Over';
    winMessageEl.classList.add('danger');
    winMessageEl.textContent = 'You ran out of lives!';
    showMessage('Game over - better luck next time!', 'error');
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
    showMessage('Hint shown!', 'info');
  }
}

// Loses one heart. Clears all warning marks (board goes white again) and
// ends the game when the last heart is gone. Returns true if game over.
function loseLife(reason) {
  gameState.strikes = 0;
  gameState.lives--;
  // Clear all warning marks so the board goes back to white
  for (let r = 0; r < gameState.mode.size; r++) {
    for (let c = 0; c < gameState.mode.size; c++) {
      if (gameState.warns[r]) gameState.warns[r][c] = null;
    }
  }
  renderBoard();
  updateInfo();
  if (gameState.lives <= 0) {
    endGame(false); // Game over - out of lives
    return true;
  }
  showMessage(`${reason} ${gameState.lives} ${gameState.lives === 1 ? 'life' : 'lives'} left`, 'error');
  return false;
}

// --- Per-piece countdown timer (9x9 / 16x16 only) ---------------------

// Refreshes the countdown pill; hides it when there is no per-piece timer.
function updatePieceTimer() {
  const active = gameState.mode && gameState.mode.type !== 'icons' && gameState.gameActive && gameState.pieceSeconds > 0;
  if (active) {
    pieceTimerWrapEl.hidden = false;
    pieceTimerValueEl.textContent = formatTime(gameState.pieceTimeLeft);
    pieceTimerWrapEl.classList.toggle('urgent', gameState.pieceTimeLeft <= 10);
  } else {
    pieceTimerWrapEl.hidden = true;
  }
}

// Starts a fresh countdown for the current piece.
function startPieceTimer() {
  stopPieceTimer();
  const rules = DIFFICULTY_RULES[gameState.difficulty] || DIFFICULTY_RULES.easy;
  // Kids mode has no per-piece timer - only 9x9 and 16x16
  const hasTimer = gameState.mode && gameState.mode.type !== 'icons';
  gameState.pieceSeconds = hasTimer ? (rules.pieceSeconds || 0) : 0;
  gameState.pieceTimeLeft = gameState.pieceSeconds;
  updatePieceTimer();
  if (gameState.pieceSeconds <= 0) return;
  gameState.pieceTimerInterval = setInterval(() => {
    gameState.pieceTimeLeft--;
    updatePieceTimer();
    if (gameState.pieceTimeLeft <= 0) {
      stopPieceTimer();
      onPieceTimerExpired();
    }
  }, 1000);
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
  if (loseLife("Time's up!")) return; // game over - out of lives
  nextPiece(); // a fresh piece restarts the timer
}

