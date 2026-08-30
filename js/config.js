// =====================================================================
// CONFIG: game modes, picker descriptions, and difficulty rules
// =====================================================================

// Global board scale: multiplies the per-mode cell size.
const BOARD_SIZE_SCALE = 1.12;

// Available game modes shown in the start-screen dropdown.
//   size      -> grid dimensions (size x size)
//   boxRows   -> rows per sub-box
//   boxCols   -> columns per sub-box
//   type      -> 'icons' (Kids cats), 'numbers' (Classic), 'hex' (Hex 16)
//   values    -> display symbols for pieces; index + 1 is the internal value
//   cellSize  -> optional board cell size override (Kids board is larger)
const GAME_MODES = {
  'kids-4': { size: 4, boxRows: 2, boxCols: 2, type: 'icons', values: ['assets/cats/1.png', 'assets/cats/2.png', 'assets/cats/3.png', 'assets/cats/4.png'], cellSize: 110 },
  'classic-9': { size: 9, boxRows: 3, boxCols: 3, type: 'numbers', values: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  'hex-16': { size: 16, boxRows: 4, boxCols: 4, type: 'hex', values: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'] }
};

// Short descriptions shown under the Game Mode dropdown on the start screen.
const MODE_DESCRIPTIONS = {
  'kids-4': 'Kids 4x4 (Cats): a gentle 4×4 grid with 2×2 boxes. Place every cat in each row, column and box - the friendliest way to learn Sudoku.',
  'classic-9': 'Classic 9x9: the standard Sudoku challenge on a 9×9 grid with 3×3 boxes. Fill it so every row, column and box contains 1-9 exactly once.',
  'hex-16': 'Hex 16x16: for advanced players. A 16×16 grid with 4×4 boxes using hexadecimal digits 0-9 and A-F, so each row, column and box holds all 16 symbols.'
};

// Per-difficulty rules.
//   lives          -> hearts the player starts with
//   lifeLostAt     -> at which wrong-click strike a heart is lost
//   warnKeys       -> escalating pastel colors for wrong clicks (in order)
//   pieceSeconds   -> per-piece countdown for 9x9 / 16x16 (Kids has no timer)
//   specialChance  -> probability (0..1) that a current piece is a special cat
//   specialPity    -> guaranteed special piece within this many pieces
const DIFFICULTY_RULES = {
  easy:   { lives: 3, lifeLostAt: 4, warnKeys: ['yellow', 'orange', 'red'], pieceSeconds: 120, specialChance: 0.1, specialPity: 10 },
  medium: { lives: 3, lifeLostAt: 3, warnKeys: ['orange', 'red'], pieceSeconds: 90, specialChance: 0.05, specialPity: 20 },
  hard:   { lives: 3, lifeLostAt: 1, warnKeys: ['red'], pieceSeconds: 60, specialChance: 0.02, specialPity: 30 }
};

// Special cat power-ups that can appear as the current piece in 9x9 / 16x16.
// Each entry holds the cat image file, its relative weight used when a
// special piece is rolled (Joker 35%, Spy 35%, Shield 15%, Hints 15%), a
// short label, and a one-line description shown under the piece tray.
// The effects themselves are implemented in js/game.js.
const SPECIAL_PIECES = {
  joker:  { file: 'assets/cats/1.png', weight: 35, label: 'Joker', desc: 'Use it anywhere' },
  reveal: { file: 'assets/cats/2.png', weight: 35, label: 'Spy', desc: 'Shows numbers for 1 second' },
  shield: { file: 'assets/cats/3.png', weight: 15, label: 'Shield', desc: 'Mistakes are free' },
  hints:  { file: 'assets/cats/4.png', weight: 15, label: 'Bonus Hints', desc: 'Gives you 2 hints' }
};
