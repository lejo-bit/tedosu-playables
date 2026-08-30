// Game Configuration
const GAME_MODES = {
  'kids-4': { size: 4, boxRows: 2, boxCols: 2, type: 'icons', values: ['assets/cats/1.png', 'assets/cats/2.png', 'assets/cats/3.png', 'assets/cats/4.png'], cellSize: 110 },
  'classic-9': { size: 9, boxRows: 3, boxCols: 3, type: 'numbers', values: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  'hex-8': { size: 8, boxRows: 2, boxCols: 4, type: 'hex', values: ['0', '1', '2', '3', '4', '5', '6', '7'] },
  'hex-12': { size: 12, boxRows: 3, boxCols: 4, type: 'hex', values: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B'] },
  'hex-16': { size: 16, boxRows: 4, boxCols: 4, type: 'hex', values: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'] }
};

// Game State
let gameState = {
  board: [],
  solution: [],
  puzzle: [],
  currentPiece: null,
  mode: null,
  difficulty: 'medium',
  timed: true,
  timer: 0,
  timerInterval: null,
  moves: 0,
  errors: 0,
  gameActive: false
};

// DOM Elements
const boardEl = document.getElementById('board');
const currentPieceDisplay = document.getElementById('currentPieceDisplay');
const timerEl = document.getElementById('timer');
const moveCountEl = document.getElementById('moveCount');
const errorCountEl = document.getElementById('errorCount');
const messageEl = document.getElementById('message');
const startBtn = document.getElementById('startBtn');
const hintBtn = document.getElementById('hintBtn');
const resetBtn = document.getElementById('resetBtn');
const menuBtn = document.getElementById('menuBtn');
const newGameBtn = document.getElementById('newGameBtn');
const gameModeTitleEl = document.getElementById('gameModeTitle');
const gameBadgeEl = document.getElementById('gameBadge');
const gameModeSelect = document.getElementById('gameMode');
const difficultySelect = document.getElementById('difficulty');
const timedModeCheckbox = document.getElementById('timedMode');
const startScreen = document.getElementById('startScreen');
const gameScreen = document.getElementById('gameScreen');

// Initialize
startBtn.addEventListener('click', startNewGame);
newGameBtn.addEventListener('click', startNewGame);
resetBtn.addEventListener('click', startNewGame); // Reset restarts the current puzzle
hintBtn.addEventListener('click', showHint);
menuBtn.addEventListener('click', goToMenu);

// Puzzle Generation - Backtracking Algorithm
function generateSolution(size, boxRows, boxCols) {
  const board = Array(size).fill(null).map(() => Array(size).fill(null));
  
  function isValid(board, row, col, num) {
    // Check row
    for (let c = 0; c < size; c++) {
      if (board[row][c] === num) return false;
    }
    
    // Check column
    for (let r = 0; r < size; r++) {
      if (board[r][col] === num) return false;
    }
    
    // Check box
    const startRow = Math.floor(row / boxRows) * boxRows;
    const startCol = Math.floor(col / boxCols) * boxCols;
    for (let r = 0; r < boxRows; r++) {
      for (let c = 0; c < boxCols; c++) {
        if (board[startRow + r][startCol + c] === num) return false;
      }
    }
    
    return true;
  }
  
  function solve(board) {
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (board[row][col] === null) {
          const values = Array.from({ length: size }, (_, i) => i + 1);
          // Shuffle for randomness
          for (let i = values.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [values[i], values[j]] = [values[j], values[i]];
          }
          
          for (const num of values) {
            if (isValid(board, row, col, num)) {
              board[row][col] = num;
              if (solve(board)) return true;
              board[row][col] = null;
            }
          }
          return false;
        }
      }
    }
    return true;
  }
  
  solve(board);
  return board;
}

// Create Puzzle by Removing Cells
function createPuzzle(solution, difficulty) {
  const size = solution.length;
  const puzzle = solution.map(row => [...row]);
  
  let cellsToRemove;
  switch (difficulty) {
    case 'easy':
      cellsToRemove = Math.floor(size * size * 0.3);
      break;
    case 'hard':
      cellsToRemove = Math.floor(size * size * 0.6);
      break;
    default: // medium
      cellsToRemove = Math.floor(size * size * 0.45);
  }
  
  let removed = 0;
  while (removed < cellsToRemove) {
    const row = Math.floor(Math.random() * size);
    const col = Math.floor(Math.random() * size);
    if (puzzle[row][col] !== null) {
      puzzle[row][col] = null;
      removed++;
    }
  }
  
  return puzzle;
}

// Game Functions
function startNewGame() {
  // Stop any existing timer
  if (gameState.timerInterval) {
    clearInterval(gameState.timerInterval);
  }
  
  // Get settings
  const modeKey = gameModeSelect.value;
  gameState.mode = GAME_MODES[modeKey];
  gameState.difficulty = difficultySelect.value;
  gameState.timed = timedModeCheckbox.checked;
  
  // Generate puzzle
  gameState.solution = generateSolution(gameState.mode.size, gameState.mode.boxRows, gameState.mode.boxCols);
  gameState.puzzle = createPuzzle(gameState.solution, gameState.difficulty);
  gameState.board = gameState.puzzle.map(row => [...row]);
  
  // Reset state
  gameState.moves = 0;
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
  nextPiece();
  showMessage('Game started! Place the current piece.', 'info');
  showScreen('game');
  
  // Start timer if enabled
  if (gameState.timed) {
    gameState.timerInterval = setInterval(() => {
      gameState.timer++;
      updateTimer();
    }, 1000);
  }
}

function nextPiece() {
  const values = gameState.mode.values;
  gameState.currentPiece = values[Math.floor(Math.random() * values.length)];
  renderCurrentPiece();
}

function handleCellClick(row, col) {
  if (!gameState.gameActive) return;
  if (gameState.puzzle[row][col] !== null) return; // Fixed cell
  
  const currentPiece = gameState.currentPiece;
  const index = gameState.mode.values.indexOf(currentPiece);
  const value = index + 1; // Internal value (1-based)
  
  if (isValidMove(gameState.board, row, col, value)) {
    // Valid move
    gameState.board[row][col] = value;
    gameState.moves++;
    renderBoard();
    updateInfo();
    
    // Check win
    if (checkWin()) {
      endGame(true);
    } else {
      nextPiece();
    }
  } else {
    // Invalid move
    gameState.errors++;
    updateInfo();
    showMessage('Invalid move! Try again.', 'error');
    
    // Highlight error
    const cellIndex = row * gameState.mode.size + col;
    const cell = boardEl.children[cellIndex];
    cell.classList.add('error');
    setTimeout(() => cell.classList.remove('error'), 500);
  }
}

function isValidMove(board, row, col, value) {
  const size = gameState.mode.size;
  const boxRows = gameState.mode.boxRows;
  const boxCols = gameState.mode.boxCols;
  
  // Check row
  for (let c = 0; c < size; c++) {
    if (board[row][c] === value) return false;
  }
  
  // Check column
  for (let r = 0; r < size; r++) {
    if (board[r][col] === value) return false;
  }
  
  // Check box
  const startRow = Math.floor(row / boxRows) * boxRows;
  const startCol = Math.floor(col / boxCols) * boxCols;
  for (let r = 0; r < boxRows; r++) {
    for (let c = 0; c < boxCols; c++) {
      if (board[startRow + r][startCol + c] === value) return false;
    }
  }
  
  return true;
}

function checkWin() {
  const size = gameState.mode.size;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (gameState.board[row][col] !== gameState.solution[row][col]) {
        return false;
      }
    }
  }
  return true;
}

function endGame(won) {
  gameState.gameActive = false;
  if (gameState.timerInterval) {
    clearInterval(gameState.timerInterval);
  }
  
  if (won) {
    const timeStr = formatTime(gameState.timer);
    showMessage(`🎉 Congratulations! You won in ${timeStr} with ${gameState.moves} moves!`, 'success');
    
    // Save best time
    if (gameState.timed) {
      const key = `best_${gameModeSelect.value}`;
      const best = localStorage.getItem(key);
      if (!best || gameState.timer < parseInt(best)) {
        localStorage.setItem(key, gameState.timer.toString());
        showMessage(`🏆 New best time for this mode!`, 'success');
      }
    }
  }
}

function showHint() {
  if (!gameState.gameActive) return;
  
  const currentPiece = gameState.currentPiece;
  const index = gameState.mode.values.indexOf(currentPiece);
  const value = index + 1;
  
  // Find all valid positions
  const validPositions = [];
  const size = gameState.mode.size;
  
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (gameState.board[row][col] === null && isValidMove(gameState.board, row, col, value)) {
        validPositions.push({ row, col });
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

// Screen navigation
function showScreen(name) {
  startScreen.classList.toggle('active', name === 'start');
  gameScreen.classList.toggle('active', name === 'game');
}

function goToMenu() {
  if (gameState.timerInterval) {
    clearInterval(gameState.timerInterval);
    gameState.timerInterval = null;
  }
  gameState.gameActive = false;
  boardEl.innerHTML = '';
  currentPieceDisplay.textContent = '-';
  currentPieceDisplay.classList.remove('piece-display--large');
  timerEl.textContent = '00:00';
  moveCountEl.textContent = '0';
  errorCountEl.textContent = '0';
  messageEl.textContent = '';
  messageEl.className = 'message';
  showScreen('start');
}

// UI Functions
function renderBoard() {
  boardEl.innerHTML = '';
  const size = gameState.mode.size;
  const boxRows = gameState.mode.boxRows;
  const boxCols = gameState.mode.boxCols;
  
  boardEl.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
  boardEl.style.maxWidth = `${size * (gameState.mode.cellSize || 52)}px`;
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

function renderCurrentPiece() {
  currentPieceDisplay.textContent = '';
  currentPieceDisplay.classList.toggle('piece-display--large', gameState.mode.type === 'icons');
  if (gameState.mode.type === 'icons') {
    const img = document.createElement('img');
    img.src = gameState.currentPiece;
    img.alt = 'cat';
    img.className = 'piece-icon';
    img.draggable = false;
    currentPieceDisplay.appendChild(img);
  } else {
    currentPieceDisplay.textContent = gameState.currentPiece;
  }
  // Restart the "pop" animation for each new piece
  currentPieceDisplay.classList.remove('pop');
  void currentPieceDisplay.offsetWidth;
  currentPieceDisplay.classList.add('pop');
}

function updateInfo() {
  moveCountEl.textContent = gameState.moves;
  errorCountEl.textContent = gameState.errors;
  if (gameState.timed) {
    updateTimer();
  }
}

function updateTimer() {
  timerEl.textContent = formatTime(gameState.timer);
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

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

function getValueDisplay(value) {
  if (gameState.mode.type === 'icons') {
    return gameState.mode.values[value - 1];
  } else if (gameState.mode.type === 'hex') {
    return gameState.mode.values[value - 1];
  } else {
    return value.toString();
  }
}

function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
}