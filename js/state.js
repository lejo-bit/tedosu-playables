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
  pieceSeconds: 0,     // per-piece timer limit (0 = no timer, e.g. Kids)
  pieceTimeLeft: 0,    // seconds left for the current piece
  pieceTimerInterval: null,
  hints: 0,            // hint uses (Kids Easy hints are free; no piece grants hints anymore)
  urgentPlayed: false, // the piece timer's low-time warning sound has played
  badLuckLeft: 0,      // real seconds left of the 4x-faster piece timer (Daya)
  autoPieceTimeout: null, // handle for auto-resolving special pieces (Loki / Daya)
  revealTimeout: null,    // handle for the Spy reveal fade loop
  activeRevealCells: [],  // cells currently shown by the Spy reveal
  sinceSpecial: 0,     // consecutive non-special pieces dealt (special-piece pity)
  errors: 0,           // total wrong clicks
  gameActive: false
};

// Timeout handle for auto-clearing transient status messages (see ui.js).
let messageTimeout = null;
