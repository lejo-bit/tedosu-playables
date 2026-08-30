// =====================================================================
// PUZZLE: seeded Sudoku generation (solution + playable puzzle)
// =====================================================================

// Fraction of cells kept as clues per difficulty (the rest are removed).
function cluesForDifficulty(size, difficulty) {
  const total = size * size;
  const fraction = { easy: 0.7, medium: 0.55, hard: 0.4 }[difficulty] || 0.55;
  return Math.max(4, Math.round(total * fraction));
}

// Builds a complete solution and a playable puzzle from a given seed.
//   - 4x4 and 9x9 use uniqueness-checked removal (proper sudoku puzzles).
//   - 16x16 uses plain seeded removal (uniqueness checking is too slow).
// Returns { solution, puzzle } where empty puzzle cells are null.
function generateSeededGame(seed, size, boxRows, boxCols, difficulty) {
  const generator = new SeededSudokuGenerator(seed, size, boxRows, boxCols);
  const solution = generator.buildSolution();
  const clueCount = cluesForDifficulty(size, difficulty);
  const useUnique = size <= 9;
  const puzzleGrid = generator.buildPuzzle(clueCount, useUnique);
  // Convert the generator's 0 (empty) to the game's null (empty).
  const puzzle = puzzleGrid.map(row => row.map(v => (v === 0 ? null : v)));
  return { solution, puzzle };
}

// Wrapper used by utilities/tests: generates a solution from a random seed.
function generateSolution(size, boxRows, boxCols) {
  const generator = new SeededSudokuGenerator(randomSeed(), size, boxRows, boxCols);
  return generator.buildSolution();
}
