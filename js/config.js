// =====================================================================
// CONFIG: game modes, picker descriptions, and difficulty rules
// =====================================================================

// Global board scale: multiplies the per-mode cell size.
const BOARD_SIZE_SCALE = 1.0;

// Available game modes shown in the start-screen dropdown.
//   size      -> grid dimensions (size x size)
//   boxRows   -> rows per sub-box
//   boxCols   -> columns per sub-box
//   type      -> 'icons' (Kids cats), 'numbers' (Classic), 'hex' (Hex 16)
//   values    -> display symbols for pieces; index + 1 is the internal value
//   cellSize  -> optional board cell size override (Kids board is larger)
const GAME_MODES = {
  'kids-4': { key: 'kids-4', size: 4, boxRows: 2, boxCols: 2, type: 'icons', values: ['assets/cats/1.png', 'assets/cats/2.png', 'assets/cats/3.png', 'assets/cats/4.png'], cellSize: 110 },
  'classic-9': { key: 'classic-9', size: 9, boxRows: 3, boxCols: 3, type: 'numbers', values: [1, 2, 3, 4, 5, 6, 7, 8, 9], cellSize: 46 },
  'hex-16': { key: 'hex-16', size: 16, boxRows: 4, boxCols: 4, type: 'hex', values: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'], cellSize: 32 }
};

// Per-difficulty rules.
//   lives          -> hearts the player starts with (every wrong move costs one)
//   pieceSeconds   -> per-piece countdown, per mode (Kids has no timer)
//   specialChance  -> probability (0..1) of a special piece at game start; the
//                     odds shrink as the board fills up and hit 0% at 10 gaps
//   specialPity    -> pity guarantee within this many pieces (early game)
const DIFFICULTY_RULES = {
  easy:   { lives: 3, pieceSeconds: { 'classic-9': 90, 'hex-16': 120 }, specialChance: 0.15, specialPity: 10 },
  medium: { lives: 3, pieceSeconds: { 'classic-9': 60, 'hex-16': 90 }, specialChance: 0.075, specialPity: 20 },
  hard:   { lives: 3, pieceSeconds: { 'classic-9': 45, 'hex-16': 60 }, specialChance: 0.05, specialPity: 30 }
};

// Special cat power-ups that can appear as the current piece in 9x9 / 16x16.
// Each entry holds the cat image file, its relative weight used when a
// special piece is rolled (Joker 35%, Spy 35%, Loki 15%, Daya 15%), a
// short label, a translation key for the one-line description shown under
// the piece tray, and a `kind`: 'click' = the player clicks a cell to use
// it, 'auto' = it resolves on its own 3 seconds after being dealt.
// The effects themselves are implemented in js/game.js.
const SPECIAL_PIECES = {
  joker:  { file: 'assets/cats/1.png', weight: 35, kind: 'click', label: 'Chu-Chu', desc: 'piece.joker' },
  reveal: { file: 'assets/cats/2.png', weight: 35, kind: 'click', label: 'Ymil', desc: 'piece.reveal' },
  shield: { file: 'assets/cats/3.png', weight: 15, kind: 'auto', label: 'Loki', desc: 'piece.loki' },
  hints:  { file: 'assets/cats/4.png', weight: 15, kind: 'auto', label: 'Daya', desc: 'piece.daya' }
};
