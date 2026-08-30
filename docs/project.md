# Sudoku Tetris - Project Plan

## Overview

Sudoku Tetris is a web-based puzzle game that combines classic Sudoku rules with a "one piece at a time" mechanic inspired by Tetris. Players receive a single number/icon per turn and must place it in a valid cell on the board.

## Game Modes

### Board Sizes and Types

| Mode | Board Size | Value Range | Box Size | Notes |
|------|------------|-------------|----------|-------|
| Kids | 4x4 | 1–4 (cat icons) | 2x2 | Black-white, gray, ginger, black cats |
| Classic | 9x9 | 1–9 | 3x3 | Traditional Sudoku |
| Hex Small | 8x8 | 0–7 | 2x4 | Hexadecimal subset |
| Hex Medium | 12x12 | 0–B | 3x4 | Hexadecimal subset |
| Hex Full | 16x16 | 0–F | 4x4 | Full hexadecimal Sudoku |

### Game Options

- **Timed mode** (always active): Track completion time, save best scores
- **Difficulty levels**: Control how many cells are pre-filled (affects puzzle complexity)

## Core Mechanics

### Puzzle Generation

1. Generate a complete valid solution using backtracking algorithm
2. Remove cells to create the puzzle while ensuring unique solution
3. Store both the puzzle state and the solution for validation

### Turn-Based Placement

1. Game presents one value/icon to the player
2. Player clicks an empty cell to place the piece
3. System validates the move against Sudoku rules:
   - No duplicate in row
   - No duplicate in column
   - No duplicate in box (subgrid)
4. Valid move: piece is placed, next piece is generated
5. Invalid move: error feedback, optional life loss in timed mode

### Win Condition

Game ends when all cells are filled correctly with valid values.

## Technical Architecture

### File Structure

```
/sudoku-tetris
├── index.html      # Game UI and structure
├── style.css       # Visual styling and responsive design
├── /js             # Game logic (split into focused modules)
│   ├── config.js   # Game modes, descriptions, difficulty rules
│   ├── state.js    # Shared mutable game state
│   ├── dom.js      # DOM element references
│   ├── seeded.js   # Deterministic 64-bit RNG + seeded Sudoku generator
│   ├── puzzle.js   # Seeded puzzle generation (solution + playable puzzle)
│   ├── game.js     # Core game logic (moves, lives, timers, win/lose, seeds)
│   └── ui.js       # Rendering, messages, picker, startup wiring
├── project.md      # This documentation
└── /assets
    └── cats/       # Cat icon images (to be added)
```

### Key Functions

#### Puzzle Generation
- `generateSolution(size, boxRows, boxCols)` - Creates complete valid board
- `createPuzzle(solution, difficulty)` - Removes cells to create challenge
- `isValidMove(board, row, col, value, size, boxRows, boxCols)` - Validates placement

#### Game Flow
- `nextPiece()` - Generates next value/icon for player
- `handleCellClick(row, col)` - Processes player input
- `checkWin()` - Determines if puzzle is complete
- `startTimer()` / `stopTimer()` - Manages timed mode

#### UI Functions
- `renderBoard()` - Displays current game state
- `renderCurrentPiece()` - Shows active piece to player
- `updateTimer()` - Displays elapsed time
- `showMessage()` - Provides feedback to player

## Development Phases

### Phase 1: Core Engine
- Implement backtracking solver/generator
- Create validation logic for all board sizes
- Build basic board rendering

### Phase 2: Game Mechanics
- Implement "one piece at a time" system
- Add move validation and feedback
- Create win/loss detection

### Phase 3: UI/UX
- Design responsive layout
- Add difficulty and mode selection
- Implement timer and score display

### Phase 4: Polish
- Add cat icons for 4x4 mode
- Implement local storage for best scores
- Add sound effects and animations

## Future Enhancements

- **Themes**: Dark/light mode, custom color schemes
- **Multiplayer**: Turn-based competition with friends
- **Mobile optimization**: Touch-friendly interface
- **Accessibility**: Screen reader support, high contrast mode

## Success Criteria

- All five board sizes function correctly
- Puzzle generation produces valid, solvable puzzles
- "One piece at a time" mechanic works smoothly
- Timer and scoring systems track performance accurately
- Responsive design works on desktop and mobile browsers