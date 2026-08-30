// =====================================================================
// SEEDED: deterministic 64-bit RNG + seeded Sudoku generation
// =====================================================================

// 64-bit SplitMix Hash Engine using BigInt.
// Turns any seed (hex string, plain text, BigInt, or integer number) into a
// deterministic function that returns values in [0, 1).
function maxSeededRandom(seedInput) {
  let seed = 0n;

  // 1. Auto-detect input type (Hex String, Plain String, BigInt, or Number)
  if (typeof seedInput === 'string') {
    if (seedInput.toLowerCase().startsWith('0x')) {
      // Safely parse massive hex numbers (e.g., '0xFFFFFFFFFFFFFFFF')
      try {
        seed = BigInt(seedInput);
      } catch {
        seed = null; // invalid hex -> fall back to hashing below
      }
    } else {
      seed = null; // plain text -> hash below
    }

    if (seed === null) {
      // Hash standard text strings into a 64-bit BigInt space
      let h1 = 1779033703n, h2 = 3024734765n;
      for (let i = 0; i < seedInput.length; i++) {
        const k = BigInt(seedInput.charCodeAt(i));
        h1 = (h2 ^ ((h1 ^ k) * 597399067n)) & 0xFFFFFFFFn;
        h2 = (h1 ^ ((h2 ^ k) * 2869860233n)) & 0xFFFFFFFFn;
      }
      seed = (h1 << 32n) | h2;
    }
  } else if (typeof seedInput === 'bigint') {
    seed = seedInput;
  } else if (typeof seedInput === 'number') {
    try {
      seed = BigInt(Math.trunc(seedInput));
    } catch {
      seed = null;
    }
  }

  // Totally unusable input falls back to a fixed sentinel value.
  if (seed == null) seed = 0xDEADC0DECAFEBABEn;

  // Ensure the final seed sits strictly inside the max 64-bit unsigned bounds
  seed = seed & 0xFFFFFFFFFFFFFFFFn;
  if (seed === 0n) seed = 0xDEADC0DECAFEBABEn; // Fallback for safety

  // 2. The 64-bit State Generator Loop
  return function() {
    seed = (seed + 0x9e3779b97f4a7c15n) & 0xFFFFFFFFFFFFFFFFn;
    let z = seed;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xFFFFFFFFFFFFFFFFn;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xFFFFFFFFFFFFFFFFn;
    z = z ^ (z >> 31n);

    // Returns a high-precision decimal between 0.0 and 1.0
    return Number(z & 0x1FFFFFFFFFFFFFn) / 9007199254740991;
  };
}

// Generates a fresh random 64-bit seed as a hex string (0x + 16 hex chars).
function randomSeed() {
  const chars = '0123456789abcdef';
  let hex = '';
  for (let i = 0; i < 16; i++) {
    hex += chars[Math.floor(Math.random() * 16)];
  }
  return '0x' + hex;
}

// Seeded Sudoku generator, generalized from the reference 9x9 implementation
// to work for any grid size / box layout (e.g. 4x4/2x2 and 16x16/4x4).
class SeededSudokuGenerator {
  constructor(seedInput, size = 9, boxRows = 3, boxCols = 3) {
    this.randomFunc = maxSeededRandom(seedInput);
    this.size = size;
    this.boxRows = boxRows;
    this.boxCols = boxCols;
    this.grid = Array.from({ length: size }, () => Array(size).fill(0));
  }

  seededShuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.randomFunc() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  // Is `num` allowed at (row, col)? Checks row, column, and sub-box.
  isValid(row, col, num) {
    const size = this.size;
    const boxRows = this.boxRows;
    const boxCols = this.boxCols;
    for (let i = 0; i < size; i++) {
      if (this.grid[row][i] === num || this.grid[i][col] === num) return false;
      const boxRow = boxRows * Math.floor(row / boxRows) + Math.floor(i / boxRows);
      const boxCol = boxCols * Math.floor(col / boxCols) + (i % boxCols);
      if (this.grid[boxRow][boxCol] === num) return false;
    }
    return true;
  }

  // Recursive backtracking fill using the seeded shuffle for variety.
  fillGrid() {
    const size = this.size;
    const baseValues = Array.from({ length: size }, (_, i) => i + 1);
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (this.grid[row][col] === 0) {
          const numbers = this.seededShuffle([...baseValues]);
          for (const num of numbers) {
            if (this.isValid(row, col, num)) {
              this.grid[row][col] = num;
              if (this.fillGrid()) return true;
              this.grid[row][col] = 0;
            }
          }
          return false;
        }
      }
    }
    return true;
  }

  // Counts solutions (early exit once more than one is found).
  countSolutions(solutionsState = { count: 0 }) {
    const size = this.size;
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (this.grid[row][col] === 0) {
          for (let num = 1; num <= size; num++) {
            if (this.isValid(row, col, num)) {
              this.grid[row][col] = num;
              this.countSolutions(solutionsState);
              this.grid[row][col] = 0;
              if (solutionsState.count > 1) return 2;
            }
          }
          return solutionsState.count;
        }
      }
    }
    solutionsState.count++;
    return solutionsState.count;
  }

  // Removes cells until `difficultyClues` clues remain. With useUnique it
  // keeps the puzzle uniquely solvable (4x4 / 9x9); without it, it just does
  // seeded random removal (fast path for 16x16).
  removeClues(difficultyClues = 30, useUnique = true) {
    const size = this.size;
    const cells = Array.from({ length: size * size }, (_, i) => i);
    this.seededShuffle(cells);

    let cluesRemoved = 0;
    const targetRemoval = size * size - difficultyClues;

    for (const cell of cells) {
      if (cluesRemoved >= targetRemoval) break;

      const row = Math.floor(cell / size);
      const col = cell % size;
      const backup = this.grid[row][col];

      this.grid[row][col] = 0;

      if (useUnique) {
        const state = { count: 0 };
        if (this.countSolutions(state) !== 1) {
          this.grid[row][col] = backup;
        } else {
          cluesRemoved++;
        }
      } else {
        cluesRemoved++; // plain seeded removal (fast path for large grids)
      }
    }
  }

  // Resets and fills the grid; returns a deep copy of the complete solution.
  buildSolution() {
    for (let attempt = 0; attempt < 10; attempt++) {
      this.grid = Array.from({ length: this.size }, () => Array(this.size).fill(0));
      if (this.fillGrid() && this.isComplete()) {
        return this.grid.map(row => [...row]);
      }
    }
    // Very unlikely fallback: return whatever was produced.
    return this.grid.map(row => [...row]);
  }

  // Removes clues from the current grid; returns a deep copy.
  buildPuzzle(clueCount, useUnique = true) {
    this.removeClues(clueCount, useUnique);
    return this.grid.map(row => [...row]);
  }

  isComplete() {
    return this.grid.every(row => row.every(v => v !== 0));
  }
}
