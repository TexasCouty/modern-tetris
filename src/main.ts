import { TetrisGame } from './tetris/TetrisGame';
import './uiEnhancements'; // ensure UI side-effects are bundled

// Provide optional logo override early (safe before DOM ready)
try {
  // @ts-ignore
  const envLogo = (import.meta as any).env?.VITE_LOGO_URL;
  if (envLogo && typeof window !== 'undefined') {
    (window as any).__TETRIS_LOGO_URL__ = envLogo;
  }
} catch {}

let initialized = false;

window.addEventListener('DOMContentLoaded', () => {
  if (initialized) return; // guard against double fire (e.g. module HMR in dev)
  initialized = true;

  const canvas = document.getElementById('game') as HTMLCanvasElement | null;
  const scoreEl = document.getElementById('scoreVal');
  const levelEl = document.getElementById('levelVal');
  const linesEl = document.getElementById('linesVal');
  const highEl = document.getElementById('highVal');
  const btnUp = document.getElementById('btnUp') as HTMLButtonElement | null;
  const btnDown = document.getElementById('btnDown') as HTMLButtonElement | null;
  const btnLeft = document.getElementById('btnLeft') as HTMLButtonElement | null;
  const btnRight = document.getElementById('btnRight') as HTMLButtonElement | null;
  const btnHard = document.getElementById('btnHard') as HTMLButtonElement | null;
  const startBtn = document.getElementById('startBtn') as HTMLButtonElement | null;
  const resetBtn = document.getElementById('resetBtn') as HTMLButtonElement | null;
  const overlay = document.getElementById('overlay') as HTMLDivElement | null;

  if (!canvas || !scoreEl || !levelEl || !linesEl || !highEl || !startBtn || !overlay) {
    console.error('[tetris] Critical DOM elements missing; aborting init');
    return;
  }

  const nextCanvas = undefined as any; // preview disabled
  let gameOverFlag = false;

  const game = new TetrisGame({
    width: 10,
    height: 20,
    canvas,
    nextCanvas,
    onStats: ({ score, level, lines }) => {
      scoreEl.textContent = String(score);
      levelEl.textContent = String(level);
      linesEl.textContent = String(lines);
      highEl.textContent = String(game.getHighScore());
    },
    onGameOver: () => {
      startBtn.textContent = 'Game Over - Restart (Space)';
      overlay.textContent = 'GAME OVER';
      overlay.classList.add('visible');
      gameOverFlag = true;
    }
  });

  startBtn.textContent = 'Start';

  // After guard above, these elements are guaranteed non-null; assert for TS
  const _startBtn = startBtn!;
  const _overlay = overlay!;

  function gameRunning(): boolean { return _startBtn.textContent === 'Pause'; }

  function togglePauseUi() {
    if (!gameRunning()) {
  _overlay.classList.remove('visible');
  _startBtn.textContent = 'Pause';
      game.start();
      gameOverFlag = false;
      return;
    }
    game.togglePause();
    if (_overlay.classList.contains('visible')) {
      _overlay.classList.remove('visible');
    } else {
      _overlay.textContent = 'PAUSED';
      _overlay.classList.add('visible');
    }
  }

  function restartGame() {
    game.reset();
  _overlay.classList.remove('visible');
  _overlay.textContent = '';
  _startBtn.textContent = 'Pause';
    gameOverFlag = false;
  }

  startBtn.addEventListener('click', () => { if (gameOverFlag) restartGame(); else togglePauseUi(); });
  resetBtn?.addEventListener('click', () => { restartGame(); });
  btnUp?.addEventListener('click', () => game.rotateCW());
  btnLeft?.addEventListener('click', () => game.moveLeft());
  btnRight?.addEventListener('click', () => game.moveRight());
  btnDown?.addEventListener('click', () => game.dropSoft());
  btnHard?.addEventListener('click', () => game.dropHard());

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      if (gameOverFlag) restartGame(); else togglePauseUi();
    }
    if (e.key === 'r' || e.key === 'R') { restartGame(); }
  });

  // Mobile custom event wiring
  window.addEventListener('tetris-btn-left', ()=> game.moveLeft());
  window.addEventListener('tetris-btn-right', ()=> game.moveRight());
  window.addEventListener('tetris-btn-down', ()=> game.dropSoft());

  // Not auto-starting: waits for user interaction.
});

// Removed scaling logic to prevent clipping; Electron window resized instead.
