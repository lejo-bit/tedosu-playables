// =====================================================================
// STATE: the single mutable object shared by the whole game
// =====================================================================
let gameState = {
  board: [],           // current board (internal 1-based values, or null)
  solution: [],        // the completed, valid Sudoku being recreated
  puzzle: [],          // fixed starting cells (givens), null where empty
  currentPiece: null,  // the piece the player must place next
  mode: null,          // the active GAME_MODES entry
  difficulty: 'medium',
  seed: null,          // the seed used to generate the current puzzle
  timed: true,         // overall game timer (always on)
  timer: 0,            // elapsed seconds
  timerInterval: null,
  lives: 3,            // hearts remaining
  strikes: 0,          // consecutive wrong-click warning level
  warns: [],           // persistent wrong-click marks per cell (tier key or null)
  pieceSeconds: 0,     // per-piece timer limit (0 = no timer, e.g. Kids)
  pieceTimeLeft: 0,    // seconds left for the current piece
  pieceTimerInterval: null,
  hints: 0,            // hint uses granted by the bonus-hints cat (4.png)
  shieldActive: false, // true = mistakes are not punished (3.png shield)
  sinceSpecial: 0,     // consecutive non-special pieces dealt (special-piece pity)
  errors: 0,           // total wrong clicks
  gameActive: false
};

// Timeout handle for auto-clearing transient status messages (see ui.js).
let messageTimeout = null;
