# YouTube Playables — Technical Specification

## 1. Project Goal

Create an HTML5 game (pure JavaScript + HTML) published as a **YouTube Playable** — an interactive game that runs directly in the YouTube app and website without installation.

---

## 2. Platform Requirements

### 2.1. Technologies

- **HTML5** (standard Web APIs) [web:2][web:7]
- **JavaScript** (ES6+)
- **Canvas API** or DOM-based rendering
- **CSS3** (responsiveness, media queries)

### 2.2. Root File Structure

- The `index.html` file **must be in the root directory** of the ZIP archive [web:5].
- The YouTube Playables SDK must be imported **before** your game code [web:5][web:9].

Example:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Game</title>
  <link rel="stylesheet" href="./styles/main.css">
</head>
<body>
  <canvas id="game"></canvas>

  <!-- YouTube Playables SDK -->
  <script src="https://www.youtube.com/game_api/v1"></script>

  <!-- Game Code -->
  <script src="./js/game.js"></script>
  <script src="./js/main.js"></script>
</body>
</html>
```

### 2.3. SDK Requirements

- **`firstFrameReady()`** — call when the first screen (splash / menu) is ready to display [web:9].
- **`gameReady()`** — call when the game is fully loaded and ready for interaction [web:9].

Example:

```js
// game.js
window.onload = () => {
  // Initialize Canvas, context, assets
  initGame();

  // First frame ready
  ytgame.firstFrameReady();

  // After all assets are loaded
  loadAssets().then(() => {
    ytgame.gameReady();
  });
};
```

### 2.4. Technical Limits

| Parameter | Limit | Source |
|---|---|---|
| **Initial bundle size** (before `gameReady()`) | < 30 MB | [web:17] |
| **Total bundle size** (entire ZIP) | < 250 MB | [web:17] |
| **Single file size** | < 30 MB | [web:17] |
| **JavaScript heap** (peak) | < 512 MB | [web:7] |
| **Format** | ZIP with `index.html` in root | [web:5][web:24] |

### 2.5. UX / Certification Requirements

- **Responsiveness** — game must work on desktop, Android, and iOS [web:19].
- **Input** — support both **touch** and **mouse** [web:19].
- **Resize** — proper scaling on window resize [web:19].
- **Stability** — no repeatable crashes, hangs, or black screens [web:17].
- **Asset paths** — relative paths only (e.g., `./assets/sprite.png`) [web:17].

---

## 3. Project Structure

```
my-youtube-game/
├── index.html                 # Main file (in ZIP root)
├── styles/
│   └── main.css               # CSS styles
├── js/
│   ├── game.js                # Game logic
│   ├── main.js                # Initialization, input, loop
│   └── sdk-integration.js     # ytgame.* wrapper
├── assets/
│   ├── images/                # Sprites, backgrounds, UI
│   ├── sounds/                # SFX, music
│   └── fonts/                 # Fonts (optional)
├── README.md                  # Description, build instructions
└── build/                     # (optional) build scripts
```

### 3.1. `index.html` File

- Minimal HTML5.
- Meta viewport for mobile.
- Link to CSS.
- SDK script before game scripts.
- Game scripts in order: `game.js` → `main.js`.

### 3.2. JavaScript Files

- **`game.js`** — game logic: states, entities, collisions, rendering.
- **`main.js`** — game loop (`requestAnimationFrame`), input, SDK integration.
- **`sdk-integration.js`** — helpers: `notifyFirstFrame()`, `notifyGameReady()`, `showAd()`, `saveProgress()`.

### 3.3. CSS Files

- CSS reset (optional).
- Canvas styles (full viewport).
- Media queries for responsiveness.
- UI styles (menu, buttons, HUD).

---

## 4. YouTube Playables SDK Integration

### 4.1. Core API

- `ytgame.firstFrameReady()` — notifies YT that the first frame is ready [web:9].
- `ytgame.gameReady()` — notifies YT that the game is fully ready [web:9].
- `ytgame.showAd()` — displays an ad (optional, for monetization).
- `ytgame.saveProgress(data)` / `ytgame.loadProgress()` — save/load progress (optional).

### 4.2. Integration Example

```js
// sdk-integration.js
const YTSDK = {
  firstFrameReady() {
    if (window.ytgame) {
      window.ytgame.firstFrameReady();
    }
  },

  gameReady() {
    if (window.ytgame) {
      window.ytgame.gameReady();
    }
  },

  showAd() {
    if (window.ytgame) {
      window.ytgame.showAd();
    }
  },

  saveProgress(data) {
    if (window.ytgame) {
      window.ytgame.saveProgress(JSON.stringify(data));
    }
  },

  loadProgress() {
    if (window.ytgame) {
      const raw = window.ytgame.loadProgress();
      return raw ? JSON.parse(raw) : null;
    }
    return null;
  }
};
```

---

## 5. Asset Requirements

### 5.1. Images

- Format: **WebP** (recommended) or PNG.
- Relative paths: `./assets/images/sprite.png`.
- Optimization: compression, sprite atlas (optional).

### 5.2. Audio

- Format: **MP3** or **OGG**.
- Relative paths: `./assets/sounds/jump.mp3`.
- Size: avoid long files > 5 MB.

### 5.3. Fonts

- Format: **WOFF2** (recommended).
- Relative paths: `./assets/fonts/font.woff2`.
- `@font-face` in CSS.

---

## 6. Build and Packaging

### 6.1. Preparing the ZIP

1. Ensure `index.html` is in the root directory.
2. Verify all paths are relative.
3. Zip the entire folder:

```bash
zip -r my-game.zip index.html styles/ js/ assets/
```

### 6.2. Size Check

- Unzip and check the total size.
- Ensure **initial payload** (files loaded before `gameReady()`) is < 30 MB [web:17].

---

## 7. Testing

### 7.1. Local Tests

- Open `index.html` in a browser (Chrome, Firefox).
- Check responsiveness (F12 → Device Toolbar).
- Test touch (DevTools → Touch emulation).

### 7.2. Device Tests

- **Desktop** — Chrome, Firefox, Edge.
- **Android** — Chrome in the YouTube app (after onboarding).
- **iOS** — Safari in the YouTube app (after onboarding).

### 7.3. Pre-Publish Checklist

- [ ] `index.html` in ZIP root [web:5].
- [ ] YouTube SDK imported before game code [web:5].
- [ ] `firstFrameReady()` and `gameReady()` called [web:9].
- [ ] Responsiveness (mobile + desktop) [web:19].
- [ ] Touch + mouse input [web:19].
- [ ] Relative asset paths [web:17].
- [ ] Initial bundle < 30 MB [web:17].
- [ ] No crashes in typical scenarios [web:17].

---

## 8. Publishing Process

1. **Onboarding** — fill out the Playables interest form [web:2][web:6].
2. **Portal access** — after approval, log in to the Playables Developer Portal [page:2].
3. **Add game** — click "Add a new game", fill in metadata (title, description, category) [web:1][page:2].
4. **Upload ZIP** — upload your packaged game [page:2].
5. **Thumbnails** — add required images (16:9, 1:1) [web:19].
6. **Testing** — use the built-in tester (desktop, mobile web, Android, iOS) [page:2].
7. **Certification** — click "Submit for Certification" [page:2].
8. **Publication** — after approval, the game goes live on YouTube [page:2].

---

## 9. Monetization (Optional)

- **Ads** — `ytgame.showAd()` at natural breaks (game over, level complete) [web:9].
- **No in-app purchases** — Playables does not currently support IAP [web:18].

---

## 10. Risks and Limitations

- **Early access** — not everyone can publish immediately; onboarding required [web:2].
- **No backend** — all data must be bundled; no external APIs [web:18].
- **Limited monetization** — ads only, no IAP [web:18].

---

## 11. References

- YouTube Playables — Developer Portal [web:1][page:2]
- YouTube Playables — Overview [web:2][page:1]
- YouTube Playables SDK — Getting Started [web:5]
- YouTube Playables SDK — Reference [web:9]
- Stability and performance requirements [web:17]
- Design requirements [web:19]
- Certification FAQ [web:18]

---

## 12. Next Steps

1. Prepare project structure as per section **3**.
2. Integrate SDK as per section **4**.
3. Optimize assets (section **5**).
4. Package and test locally (sections **6–7**).
5. Submit interest form and wait for onboarding (section **8**).