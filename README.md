# Tedosu

> **One piece at a time. Fill the grid. Beat the clock.**

Tedosu is a browser puzzle game that mixes classic Sudoku with a Tetris-inspired mechanic: instead of picking any value you like, the game **deals you one piece at a time** and you must decide where to put it. Place it correctly and the board fills up; make too many mistakes and you run out of lives.

No build step, no dependencies, no server required — just open `index.html` and play.

![Version](https://img.shields.io/badge/version-1.3-important)

---

## Features

- 🐱 **Three game modes** — Kids 4×4 (cat icons), Classic 9×9, and Hex 16×16 (digits `0`–`F`)
- 🎚️ **Three difficulty levels** — each with its own lives, warning colors, per-piece timers, and special-piece odds
- 🎲 **Seeded puzzles** — every game is generated deterministically from a seed, so puzzles can be shared and replayed
- 🧩 **Fair dealing** — you are only ever handed a piece that has at least one legal spot on the board, so the game never dead-ends
- ⭐ **Special cat power-ups** — Chu-chu, Ymil, Loki, and Daya appear as surprise pieces in 9×9 and 16×16 games (two need a click, two auto-resolve)
- ⏱️ **Per-piece countdown timers** — each piece must be placed before time runs out
- ❤️ **Lives** — every wrong move costs a heart, and so does letting a piece time out
- 🏆 **Best-time tracking** — your fastest completion per mode is saved in `localStorage`
- 🖼️ **Themed visuals** — animated background blobs, gradient typography, a random cat logo on every load, and **uniform pastel start numbers** (a soft color mask over the givens)

---

## Game Modes

| Mode | Grid | Boxes | Symbols | Notes |
|------|------|-------|---------|-------|
| **Kids 4×4** | 4×4 | 2×2 | 4 cat icons | No per-piece timer; hint button on Easy |
| **Classic 9×9** | 9×9 | 3×3 | Numbers 1–9 | The classic Sudoku challenge |
| **Hex 16×16** | 16×16 | 4×4 | Hex digits `0`–`F` | Advanced mode for experienced players |

Every mode follows the same rule: each row, each column, and each box must contain every symbol exactly once.

---

## How to Play

1. **The game deals a piece** — a number, hex digit, or cat icon — one at a time.
2. **Click an empty cell** to place the current piece. It only fits where its value belongs in the puzzle's solution.
3. **Wrong moves cost a heart.** Click the wrong cell and you lose one life instantly — there are no warning colors.
4. **Beat the per-piece timer** (Classic and Hex modes). Let a piece time out and you lose a life.
5. **Fill every cell correctly** before your hearts run out to win. Your best completion time per mode is remembered.

A **Hint** button flashes one legal spot for the current piece. In Kids mode hints are free on Easy; in Classic and Hex modes you spend Bonus-Hint pieces to use it.

---

## Special Cat Power-Ups

In Classic 9×9 and Hex 16×16 games, a dealt piece can occasionally be one of four special cats (weights: 35% / 35% / 15% / 15%):

| Piece | Weight | Effect |
|-------|--------|--------|
| **Chu-Chu — Joker** 😼 (`1.png`) | 35% | Click a cell: fills it with its correct value, sending a ripple **wave** across the board |
| **Ymil — Spy** 🕵️ (`2.png`) | 35% | Click a cell: it and every cell within 2 fields light up in **pastel-rainbow colors** for 1 second, then slowly fade out over the next 4 seconds |
| **Loki — Extra life!** ❤️ (`3.png`) | 15% | Auto piece: no click needed — after 3 seconds it grants **+1 life** with a floating-heart pop (it can push you past 3 hearts) |
| **Daya — Bad luck!** ☠️ (`4.png`) | 15% | Auto piece: after 3 seconds the piece timer runs **4× faster for 60 seconds** — the timer pill shakes and shows ×4 while it lasts |

A **pity system** keeps things fair: after every non-special piece the odds of a special piece rise, and one is guaranteed within the difficulty's pity cap.

---

## Difficulty Levels

| | Easy | Medium | Hard |
|---|---|---|---|
| **Lives** | 3 | 3 | 3 |
| **Wrong move** | −1 life | −1 life | −1 life |
| **Per-piece timer (9×9)** | 90 s | 60 s | 45 s |
| **Per-piece timer (16×16)** | 120 s | 90 s | 60 s |
| **Special-piece chance** | 15% | 7.5% | 5% |
| **Pity guarantee** | within 10 pieces | within 20 pieces | within 30 pieces |

Special-piece odds start at the percentages above (at game start) and **fall linearly as you fill the board**, reaching **0% when only 10 empty cells remain**. The pity system keeps the early game fair: after every non-special piece the odds rise, but the whole roll is scaled by how full the board is.

Kids 4×4 offers **Easy** and **Hard** only (no Medium), has no per-piece timer, and keeps the hint button only on Easy.

---

## Seeded Puzzles

Every puzzle is generated deterministically from a **seed** using a 64-bit SplitMix random engine implemented with `BigInt`:

- **Hex seeds** — `0x1A2B3C4D5E6F...` (up to 64-bit)
- **Plain text** — any string is hashed into the 64-bit seed space
- **Numbers / BigInt** — accepted directly

The **same seed always produces the same puzzle**, so you can share seeds with friends and race, or replay a favorite. Leave the seed field empty for a fresh random seed, and press **Reset** to replay the current game's seed. The active seed is shown in the game screen's seed bar.

For puzzle quality, 4×4 and 9×9 use uniqueness-checked clue removal (proper single-solution puzzles), while 16×16 uses plain seeded removal because uniqueness checking is too slow at that size. Clue density per difficulty: **Easy 70%**, **Medium 55%**, **Hard 40%**.

---

## Running Locally

No install or build step — the game is plain HTML/CSS/JS.

**Option 1 — direct:** open `index.html` in any modern browser.

**Option 2 — local server** (recommended for cache-busting and testing):

```bash
# Python
python -m http.server 8000

# Node
npx serve .
```

Then visit `http://localhost:8000`.

---

## Running the Tests

The repo ships a Node-based test harness (`test-game-logic.js`) that stubs the DOM and loads the real game modules to simulate gameplay:

```bash
node test-game-logic.js
```

It runs 17 test suites (A–Q) covering optimal play, wrong-move rejection, all modes, win/game-over modals, lives, warning marks, per-piece timers, message auto-clear, difficulty descriptions, random logos, special pieces, seed determinism, the pity system, and the board intro animation.

---

## Project Structure

```
tedoku/
├── index.html              # Game UI and structure
├── style.css               # Visual styling and responsive design
├── docs/
│   └── project.md          # Original project plan
├── assets/
│   └── cats/               # Cat icon images (1.png – 4.png)
├── js/
│   ├── config.js           # Game modes, difficulty rules, special-piece definitions
│   ├── state.js            # Shared mutable game state
│   ├── dom.js              # Cached DOM element references
│   ├── seeded.js           # 64-bit deterministic RNG + seeded Sudoku generator
│   ├── puzzle.js           # Seeded puzzle generation (solution + playable puzzle)
│   ├── game.js             # Core game logic (moves, lives, timers, specials, seeds)
│   └── ui.js               # Rendering, messages, picker descriptions, startup wiring
└── test-game-logic.js      # Node test harness with DOM stubs
```

Scripts are loaded in the order above by `index.html` and share a single global scope.

---

## Tech Stack

- **Vanilla JavaScript (ES6+)** — no frameworks, no build step
- **`BigInt`** — 64-bit seeded RNG (SplitMix hash)
- **CSS Grid** — responsive board rendering
- **Google Fonts** — Outfit typeface
- **`localStorage`** — best-time persistence

---

## License

No license file is included in the repository yet — all rights reserved by default. If you'd like this project released under a specific license (e.g. MIT), let me know and I can add it.
