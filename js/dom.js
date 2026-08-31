// =====================================================================
// DOM: cached references to every element the game touches
// =====================================================================

// Board, current piece, stats, and status message
const boardEl = document.getElementById('board');
const currentPieceDisplay = document.getElementById('currentPieceDisplay');
const timerEl = document.getElementById('timer');
const livesEl = document.getElementById('lives');
const pieceTimerWrapEl = document.getElementById('pieceTimerWrap');
const pieceTimerValueEl = document.getElementById('pieceTimerValue');
const specialPieceInfoEl = document.getElementById('specialPieceInfo');
const specialPieceNameEl = document.getElementById('specialPieceName');
const specialPieceDescEl = document.getElementById('specialPieceDesc');
const hintsPillEl = document.getElementById('hintsPill');
const hintsCountEl = document.getElementById('hintsCount');
const messageEl = document.getElementById('message');

// Start-screen controls and settings
const startBtn = document.getElementById('startBtn');
const hintBtn = document.getElementById('hintBtn');
const resetBtn = document.getElementById('resetBtn');
const menuBtn = document.getElementById('menuBtn');
const newGameBtn = document.getElementById('newGameBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const langEnBtn = document.getElementById('langEn');
const langDeBtn = document.getElementById('langDe');
const langPlBtn = document.getElementById('langPl');
const langEsBtn = document.getElementById('langEs');
const langRuBtn = document.getElementById('langRu');
const langTrBtn = document.getElementById('langTr');
const langFrBtn = document.getElementById('langFr');
const langNoBtn = document.getElementById('langNo');
const langZhBtn = document.getElementById('langZh');
const musicToggle = document.getElementById('musicToggle');
const sfxToggle = document.getElementById('sfxToggle');
const gameModeTitleEl = document.getElementById('gameModeTitle');
const gameBadgeEl = document.getElementById('gameBadge');
const gameModeSelect = document.getElementById('gameMode');
const difficultySelect = document.getElementById('difficulty');
const modeDescriptionEl = document.getElementById('modeDescription');
const difficultyDescriptionEl = document.getElementById('difficultyDescription');
const seedInputEl = document.getElementById('seedInput');
const seedBarEl = document.getElementById('seedBar');
const seedValueEl = document.getElementById('seedValue');
const startScreen = document.getElementById('startScreen');
const gameScreen = document.getElementById('gameScreen');
const logoEl = document.getElementById('logo');

// Result modal (used for both win and game over)
const winModal = document.getElementById('winModal');
const winTimeEl = document.getElementById('winTime');
const winLivesEl = document.getElementById('winLives');
const winErrorsEl = document.getElementById('winErrors');
const winTitleEl = document.getElementById('winTitle');
const winMessageEl = document.getElementById('winMessage');
const winPlayAgainBtn = document.getElementById('winPlayAgainBtn');
const winMenuBtn = document.getElementById('winMenuBtn');
