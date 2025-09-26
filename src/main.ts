import { TetrisGame } from './tetris/TetrisGame';

// Expose optional environment-driven logo URL for Netlify/cloud builds
// Set VITE_LOGO_URL in Netlify (or .env) to override logo without query param.
try {
  // @ts-ignore
  const envLogo = (import.meta as any).env?.VITE_LOGO_URL;
  if (envLogo && typeof window !== 'undefined') {
    (window as any).__TETRIS_LOGO_URL__ = envLogo;
  }
} catch {}

const canvas = document.getElementById('game') as HTMLCanvasElement;
const nextCanvas = undefined as any; // preview disabled
const holdCanvas = null;
const scoreEl = document.getElementById('scoreVal')!;
const levelEl = document.getElementById('levelVal')!;
const linesEl = document.getElementById('linesVal')!;
const highEl = document.getElementById('highVal')!;
const btnUp = document.getElementById('btnUp') as HTMLButtonElement;
const btnDown = document.getElementById('btnDown') as HTMLButtonElement;
const btnLeft = document.getElementById('btnLeft') as HTMLButtonElement;
const btnRight = document.getElementById('btnRight') as HTMLButtonElement;
const btnHard = document.getElementById('btnHard') as HTMLButtonElement;
const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
const resetBtn = document.getElementById('resetBtn') as HTMLButtonElement;

const overlay = document.getElementById('overlay') as HTMLDivElement;

let gameOverFlag = false;

const game = new TetrisGame({
  width: 10,
  height: 20,
  canvas,
  nextCanvas,
  onStats: ({ score, level, lines }) => {
  scoreEl.textContent = `${score}`;
  levelEl.textContent = `${level}`;
  linesEl.textContent = `${lines}`;
  highEl.textContent = `${game.getHighScore()}`;
  },
  onGameOver: () => {
    startBtn.textContent = 'Game Over - Restart (Space)';
    overlay.textContent = 'GAME OVER';
    overlay.classList.add('visible');
    gameOverFlag = true;
  }
});

startBtn.textContent = 'Start';
startBtn.addEventListener('click', () => {
  if (gameOverFlag) restartGame(); else togglePauseUi();
});
resetBtn.addEventListener('click', () => { restartGame(); });
btnUp.addEventListener('click', () => game.rotateCW());
btnLeft.addEventListener('click', () => game.moveLeft());
btnRight.addEventListener('click', () => game.moveRight());
btnDown.addEventListener('click', () => game.dropSoft());
btnHard.addEventListener('click', () => game.dropHard());

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    if (gameOverFlag) restartGame(); else togglePauseUi();
  }
  if (e.key === 'r' || e.key === 'R') { restartGame(); }
});

// Mobile custom event wiring (added for touch repeat without altering desktop logic)
window.addEventListener('tetris-btn-left', ()=> game.moveLeft());
window.addEventListener('tetris-btn-right', ()=> game.moveRight());
window.addEventListener('tetris-btn-down', ()=> game.dropSoft());

// Do not auto-start; wait for user to press Start

// Simple hold canvas draw loop (poll game state). Could be optimized with events.
// Hold is disabled in this simplified UI

function togglePauseUi() {
  if (!gameRunning()) {
    overlay.classList.remove('visible');
    startBtn.textContent = 'Pause';
    game.start();
    gameOverFlag = false;
    return;
  }
  game.togglePause();
  if (overlay.classList.contains('visible')) {
    overlay.classList.remove('visible');
  } else {
    overlay.textContent = 'PAUSED';
    overlay.classList.add('visible');
  }
}

function restartGame() {
  game.reset();
  overlay.classList.remove('visible');
  overlay.textContent = '';
  startBtn.textContent = 'Pause';
  gameOverFlag = false;
}

function gameRunning(): boolean {
  // crude: when start button says Pause we consider running
  return startBtn.textContent === 'Pause';
}

// Removed scaling logic to prevent clipping; Electron window resized instead.
