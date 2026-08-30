// =====================================================================
// UI: rendering, messages, picker descriptions, and startup wiring
// =====================================================================

// Switches between the start screen and the game screen.
function showScreen(name) {
  startScreen.classList.toggle('active', name === 'start');
  gameScreen.classList.toggle('active', name === 'game');
}

// Returns to the start screen and clears the game UI.
function goToMenu() {
  if (gameState.timerInterval) {
    clearInterval(gameState.timerInterval);
    gameState.timerInterval = null;
  }
  stopPieceTimer();
  stopAutoPieceTimer();
  gameState.badLuckLeft = 0;
  pieceTimerWrapEl.hidden = true;
  pieceTimerWrapEl.classList.remove('crazy', 'urgent');
  seedBarEl.hidden = true;
  gameState.gameActive = false;
  winModal.hidden = true;
  winModal.classList.remove('active');
  boardEl.innerHTML = '';
  currentPieceDisplay.textContent = '-';
  currentPieceDisplay.classList.remove('piece-display--large');
  timerEl.textContent = '00:00';
  clearMessage();
  messageEl.textContent = '';
  messageEl.className = 'message';
  showScreen('start');
}

// Draws the board (fixed cells, filled cells, and empty clickable cells).
function renderBoard() {
  boardEl.innerHTML = '';
  const size = gameState.mode.size;
  const boxRows = gameState.mode.boxRows;
  const boxCols = gameState.mode.boxCols;

  boardEl.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
  boardEl.style.maxWidth = `${size * (gameState.mode.cellSize || 52) * BOARD_SIZE_SCALE}px`;
  boardEl.style.width = '100%';

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const cell = document.createElement('div');
      cell.className = 'cell';

      // Add box borders
      if ((col + 1) % boxCols === 0 && col < size - 1) {
        cell.classList.add('box-right');
      }
      if ((row + 1) % boxRows === 0 && row < size - 1) {
        cell.classList.add('box-bottom');
      }

      const value = gameState.board[row][col];

      if (gameState.puzzle[row][col] !== null) {
        cell.classList.add('fixed');
        // Uniform pastel "mask" for the pre-filled start numbers: all givens
        // share the same soft lavender tint so they read as one constant block
        cell.style.color = 'hsl(248, 55%, 42%)';
        cell.style.background = 'hsl(248, 50%, 92%)';
        cell.appendChild(createValueNode(value));
      } else if (value !== null) {
        cell.classList.add('filled');
        cell.appendChild(createValueNode(value));
      } else {
        cell.textContent = '';
        cell.addEventListener('click', () => handleCellClick(row, col));
      }

      boardEl.appendChild(cell);
    }
  }
}

// Game-start entrance: the board cells appear staggered with a zoom-in pop.
// Driven by requestAnimationFrame (setting inline opacity/transform), so it
// runs in every browser regardless of CSS animation quirks or reduced-motion.
function animateBoardIn() {
  const cells = Array.from(boardEl.children);
  const total = cells.length || 1;
  const perCell = 500;            // ms for each cell to pop in
  const stagger = 1600 / total;   // ms between consecutive cells
  const now = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const start = now();

  // Disable CSS transitions during the intro so every rAF step applies instantly
  cells.forEach((c) => { if (c) c.style.transition = 'none'; });

  const finish = () => {
    cells.forEach((c) => {
      if (!c) return;
      c.style.opacity = '1';
      c.style.transform = 'scale(1)';
      c.style.transition = ''; // restore the normal hover transition
    });
  };

  const step = () => {
    const elapsed = now() - start;
    let done = true;
    for (let i = 0; i < total; i++) {
      const cell = cells[i];
      if (!cell) continue;
      const t = (elapsed - i * stagger) / perCell; // 0..1 progress for this cell
      if (t >= 1) {
        cell.style.opacity = '1';
        cell.style.transform = 'scale(1)';
      } else if (t > 0) {
        // Ease-out-back: pops from 0.3 up to ~1.08 then settles at 1
        const u = Math.min(1, t);
        const c1 = 1.70158;
        const e = 1 + (c1 + 1) * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
        cell.style.opacity = String(Math.min(1, u * 1.25));
        cell.style.transform = `scale(${(0.3 + 0.7 * e).toFixed(3)})`;
        done = false;
      } else {
        cell.style.opacity = '0';
        cell.style.transform = 'scale(0.3)';
        done = false;
      }
    }
    if (done) { finish(); return; }
    requestAnimationFrame(step);
  };

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(step);
  } else {
    finish(); // no rAF (tests): show the board instantly
  }

  // Re-trigger the first piece's entrance (it was rendered while hidden)
  currentPieceDisplay.classList.remove('pop', 'zoom-in');
  void currentPieceDisplay.offsetWidth;
  const auto = isSpecialPiece(gameState.currentPiece) && gameState.currentPiece.kind === 'auto';
  currentPieceDisplay.classList.add(auto ? 'zoom-in' : 'pop');
}

// Shows the current piece (cat image for Kids/special pieces, text otherwise).
function renderCurrentPiece() {
  currentPieceDisplay.textContent = '';
  currentPieceDisplay.classList.toggle('piece-display--large', gameState.mode.type === 'icons');
  const special = isSpecialPiece(gameState.currentPiece);
  if (gameState.mode.type === 'icons' || special) {
    const img = document.createElement('img');
    img.src = special ? gameState.currentPiece.file : gameState.currentPiece;
    img.alt = 'piece';
    img.className = 'piece-icon';
    img.draggable = false;
    currentPieceDisplay.appendChild(img);
  } else {
    currentPieceDisplay.textContent = gameState.currentPiece;
  }
  // Show the special piece's name + one-line description when applicable
  if (special) {
    specialPieceInfoEl.hidden = false;
    specialPieceNameEl.textContent = gameState.currentPiece.label || '';
    specialPieceDescEl.textContent = gameState.currentPiece.desc || '';
  } else {
    specialPieceInfoEl.hidden = true;
  }
  // Restart the entrance animation: auto pieces zoom in, everything else pops
  currentPieceDisplay.classList.remove('pop', 'zoom-in');
  void currentPieceDisplay.offsetWidth;
  if (special && gameState.currentPiece.kind === 'auto') {
    currentPieceDisplay.classList.add('zoom-in');
  } else {
    currentPieceDisplay.classList.add('pop');
  }
}

// Shows a floating heart that pops out of the piece tray (Loki's extra life).
function spawnHeartPop() {
  const heart = document.createElement('span');
  heart.className = 'heart-float';
  heart.textContent = '❤️';
  currentPieceDisplay.appendChild(heart);
  setTimeout(() => {
    if (heart.parentNode) heart.parentNode.removeChild(heart);
  }, 1400);
}

// Updates the stats bar: hearts, hint pill, and timer.
function updateInfo() {
  livesEl.textContent = renderHearts(gameState.lives);
  updateHintsPill();
  if (gameState.timed) {
    updateTimer();
  }
}

// Shows/hides the "Hints: N" pill and keeps its count fresh (9x9 / 16x16 only).
function updateHintsPill() {
  const show = gameState.mode && gameState.mode.type !== 'icons' && gameState.hints > 0;
  hintsPillEl.hidden = !show;
  hintsCountEl.textContent = gameState.hints;
}

// Shows the current game's seed in the seed bar under the header.
function updateSeedDisplay() {
  if (gameState.seed) {
    seedBarEl.hidden = false;
    seedValueEl.textContent = gameState.seed;
  } else {
    seedBarEl.hidden = true;
  }
}

function updateTimer() {
  timerEl.textContent = formatTime(gameState.timer);
}

// Formats seconds as mm:ss.
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Renders the lives stat as filled (❤️) and lost (🖤) hearts.
function renderHearts(lives) {
  const max = (DIFFICULTY_RULES[gameState.difficulty] || DIFFICULTY_RULES.easy).lives;
  const full = Math.max(0, lives);
  const empty = Math.max(0, max - full);
  return '❤️'.repeat(full) + '🖤'.repeat(empty);
}

// Creates the DOM node for a cell value: an <img> for icons, text otherwise.
function createValueNode(value) {
  const display = getValueDisplay(value);
  if (gameState.mode.type === 'icons') {
    const img = document.createElement('img');
    img.src = display;
    img.alt = 'cat';
    img.className = 'cell-icon';
    img.draggable = false;
    return img;
  }
  return document.createTextNode(display);
}

// Maps an internal 1-based value to its display symbol.
function getValueDisplay(value) {
  if (gameState.mode.type === 'icons') {
    return gameState.mode.values[value - 1];
  } else if (gameState.mode.type === 'hex') {
    return gameState.mode.values[value - 1];
  } else {
    return value.toString();
  }
}

// --- Start-screen picker descriptions ----------------------------------

// Shows the description for the currently selected game mode.
function updateModeDescription() {
  const key = gameModeSelect.value;
  modeDescriptionEl.textContent = MODE_DESCRIPTIONS[key] || '';
}

// Shows a difficulty description tailored to the selected mode + difficulty.
function updateDifficultyDescription() {
  const modeKey = gameModeSelect.value;
  const difficulty = difficultySelect.value;
  const isKids = modeKey === 'kids-4';
  const rules = DIFFICULTY_RULES[difficulty] || DIFFICULTY_RULES.easy;
  const lives = `${rules.lives} ${rules.lives === 1 ? 'life' : 'lives'}`;

  let text = `${lives}. Every wrong move costs a life.`;
  if (isKids) {
    text += difficulty === 'hard' ? ' No hints.' : ' Free hints.';
  } else {
    const seconds = (rules.pieceSeconds || {})[modeKey] || 0;
    const pct = (rules.specialChance || 0) * 100;
    const pctText = Number.isInteger(pct) ? String(pct) : pct.toFixed(1).replace(/\.0$/, '');
    text += ` ${seconds}s per piece. Special pieces: ${pctText}% chance (fewer as the board fills).`;
  }

  difficultyDescriptionEl.textContent = text;
}

// Mode change handler: description, Kids difficulty options, and buttons.
function updateModeUI() {
  updateModeDescription();
  const isKids = gameModeSelect.value === 'kids-4';
  // Kids only supports Easy and Hard - hide the Medium option
  const mediumOption = Array.from(difficultySelect.options).find(o => o.value === 'medium');
  if (mediumOption) mediumOption.hidden = isKids;
  if (isKids && difficultySelect.value === 'medium') {
    difficultySelect.value = 'easy';
  }
  updateDifficultyDescription();
  updateControls();
}

// Shows/hides the Hint and Reset buttons depending on mode + difficulty.
function updateControls() {
  const modeKey = gameModeSelect.value;
  const difficulty = difficultySelect.value;
  if (modeKey === 'kids-4') {
    // Kids keeps Reset; Hint only in Easy
    resetBtn.hidden = false;
    hintBtn.hidden = difficulty === 'hard';
  } else {
    // 9x9 and 16x16: no Reset; Hint only while bonus hints are available
    resetBtn.hidden = true;
    hintBtn.hidden = gameState.hints <= 0;
  }
}

// --- Start-screen cat logo ---------------------------------------------

// Cat tooltip names. Cat 2 has two possible names (picked randomly).
const CAT_NAMES = {
  1: ['Chu-chu'],
  2: ['Ymil', 'Klusky'],
  3: ['Loki'],
  4: ['Daya']
};

// Picks a random cat (1..4) for the logo on every page load and sets its
// hover name via the native title tooltip.
function randomizeLogo() {
  const catNumber = 1 + Math.floor(Math.random() * 4);
  const names = CAT_NAMES[catNumber];
  const name = names[Math.floor(Math.random() * names.length)];
  logoEl.src = `assets/cats/${catNumber}.png`;
  logoEl.alt = name;
  logoEl.title = name;
}

// --- Transient status messages -----------------------------------------

// Cancels any pending auto-clear for the status message.
function clearMessage() {
  if (messageTimeout) {
    clearTimeout(messageTimeout);
    messageTimeout = null;
  }
}

// Shows a status message; it automatically disappears after 5 seconds.
function showMessage(text, type) {
  clearMessage();
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
  // Transient status messages disappear after 5 seconds
  messageTimeout = setTimeout(() => {
    messageEl.textContent = '';
    messageEl.className = 'message';
  }, 5000);
}

// =====================================================================
// Startup: wire up the event listeners and render the picker state.
// (This file must be loaded last - it depends on config, state, dom,
//  puzzle, game, and the functions defined above.)
// =====================================================================
startBtn.addEventListener('click', () => startNewGame());
newGameBtn.addEventListener('click', () => startNewGame());
resetBtn.addEventListener('click', () => startNewGame({ keepSeed: true })); // Reset replays the same seed/puzzle
hintBtn.addEventListener('click', showHint);
menuBtn.addEventListener('click', goToMenu);
winPlayAgainBtn.addEventListener('click', () => {
  winModal.hidden = true;
  winModal.classList.remove('active');
  startNewGame();
});
winMenuBtn.addEventListener('click', () => {
  winModal.hidden = true;
  winModal.classList.remove('active');
  goToMenu();
});
gameModeSelect.addEventListener('change', updateModeUI);
difficultySelect.addEventListener('change', () => {
  updateDifficultyDescription();
  updateControls();
});

// Show the current mode description + button availability on load
updateModeUI();

// Show a random cat as the logo (with its hover name)
randomizeLogo();

