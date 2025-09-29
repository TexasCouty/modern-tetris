import { TetrisGame } from './tetris/TetrisGame';
import './uiEnhancements'; // ensure UI side-effects are bundled

if (location.search.includes('debug=1')) {
  console.debug('[tetris] main.ts module loaded');
}

// Provide optional logo override early (safe before DOM ready)
try {
  // @ts-ignore
  const envLogo = (import.meta as any).env?.VITE_LOGO_URL;
  if (envLogo && typeof window !== 'undefined') {
    (window as any).__TETRIS_LOGO_URL__ = envLogo;
  }
} catch {}

let initialized = false;

function boot() {
  if (initialized) return;
  initialized = true;
  if (location.search.includes('debug=1')) console.debug('[tetris] boot() running; readyState=', document.readyState);

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
  const progressBar = document.getElementById('levelProgress') as HTMLDivElement | null;

  if (!canvas || !scoreEl || !levelEl || !linesEl || !highEl || !startBtn || !overlay) {
    console.error('[tetris] Critical DOM elements missing; aborting init');
    return;
  }

  const nextCanvas = undefined as any; // preview disabled
  let gameOverFlag = false;

  const nf = new Intl.NumberFormat('en-US');
  let lastScore = 0;
  let lastLines = 0;
  const scoreCard = document.getElementById('score');
  const linesCard = document.getElementById('lines');

  const highBadge = document.querySelector('.high-badge');
  const scoreCardEl = document.getElementById('score');
  // Prepare CAP high score badge overlay (lazy create)
  let capHighBadge: HTMLDivElement | null = null;
  function showCapHighBadge() {
    if (!capHighBadge) {
      capHighBadge = document.createElement('div');
      capHighBadge.className = 'cap-high-score-badge';
      capHighBadge.innerHTML = `\n        <div class="cap-hs-inner">\n          <img src="/public/cap-badge.png" alt="New CAP High Score" decoding="async"/>\n        </div>`;
      document.body.appendChild(capHighBadge);
      requestAnimationFrame(()=> capHighBadge?.classList.add('visible'));
    } else {
      capHighBadge.classList.add('visible');
    }
    // Persistent: no auto-hide. Could add manual dismissal later if desired.
  }
  const game = new TetrisGame({
    width: 10,
    height: 20,
    canvas,
    nextCanvas,
    onStats: ({ score, level, lines }) => {
      // Debug stats logging (only if query contains debug)
      if (location.search.includes('debug=1')) {
        console.debug('[tetris][stats]', { score, level, lines });
      }
      scoreEl.textContent = nf.format(score);
      levelEl.textContent = nf.format(level);
      linesEl.textContent = nf.format(lines);
      highEl.textContent = nf.format(game.getHighScore());
      if (progressBar) {
        const into = lines % 10;
        progressBar.style.width = ((into/10)*100).toFixed(1)+'%';
      }
      const gained = score - lastScore;
      // Only animate score on meaningful events: line clears (lines increased) or sizeable gain (>=50)
      if (scoreCard && (lines > lastLines || gained >= 50)) {
        scoreCard.classList.remove('score-pop');
        void (scoreCard as HTMLElement).offsetWidth; // restart animation
        scoreCard.classList.add('score-pop');
      }
      if (lines > lastLines && linesCard) {
        linesCard.classList.remove('lines-flash');
        void (linesCard as HTMLElement).offsetWidth;
        linesCard.classList.add('lines-flash');
      }
      lastScore = score;
      lastLines = lines;
    },
    onGameOver: () => {
      startBtn.textContent = 'Game Over - Restart (Space)';
      overlay.textContent = 'GAME OVER';
      overlay.classList.add('visible');
      gameOverFlag = true;
      if (location.search.includes('debug=1')) console.debug('[tetris] game over');
    }
    ,onHighScore: (val:number) => {
      if (highEl) highEl.textContent = nf.format(val);
      if (highBadge) {
        highBadge.classList.remove('badge-pop');
        void (highBadge as HTMLElement).offsetWidth;
        highBadge.classList.add('badge-pop');
      }
      showCapHighBadge();
    }
  });

  // Expose for console-driven debugging
  (window as any).__GAME__ = game;
  if (location.search.includes('debug=1')) console.debug('[tetris] game instance created');

  startBtn.textContent = 'Start';

  // After guard above, these elements are guaranteed non-null; assert for TS
  const _startBtn = startBtn!;
  const _overlay = overlay!;

  function gameRunning(): boolean { return _startBtn.textContent === 'Pause'; }

  let countingDown = false;

  function runCountdownAndStart() {
    if (countingDown) return; // prevent overlapping
    countingDown = true;
    _overlay.classList.remove('ready-pulse');
    _overlay.classList.add('visible','counting');
    const seq = ['3','2','1','GO'];
    let idx = 0;
    function step(){
      const label = seq[idx];
      _overlay.innerHTML = `<span class="count-num ${label==='GO'?'go':''}">${label}</span>`;
      idx++;
      if (idx < seq.length) {
        setTimeout(step, 750);
      } else {
        // final delay, then start
        setTimeout(()=>{
          _overlay.classList.remove('visible','counting');
          _overlay.innerHTML='';
          _startBtn.textContent = 'Pause';
          _startBtn.classList.add('running');
          scoreCardEl?.classList.add('score-active');
          game.start();
          gameOverFlag = false;
          countingDown = false;
        }, 600);
      }
    }
    step();
  }

  function togglePauseUi() {
    if (!gameRunning()) {
      // If overlay currently shows READY, run countdown first
      if (_overlay.textContent === 'READY') {
        runCountdownAndStart();
        return;
      }
      _overlay.classList.remove('visible','ready-pulse');
      _startBtn.textContent = 'Pause';
      _startBtn.classList.add('running');
      scoreCardEl?.classList.add('score-active');
      if (location.search.includes('debug=1')) console.debug('[tetris] starting / resuming game');
      game.start();
      gameOverFlag = false;
      if (location.search.includes('debug=1')) console.debug('[tetris] game.start() invoked, current piece?', game._debugHasCurrent?.());
      return;
    }
    game.togglePause();
    if (location.search.includes('debug=1')) console.debug('[tetris] toggling pause, now running?', gameRunning());
    if (_overlay.classList.contains('visible')) {
      _overlay.classList.remove('visible');
    } else {
      _overlay.textContent = 'PAUSED';
      _overlay.classList.add('visible');
    }
    if (!gameRunning()) _startBtn.classList.remove('running');
    if (!gameRunning()) scoreCardEl?.classList.remove('score-active');
  }

  function restartGame() {
    game.reset(true); // full restart & auto-start
  _overlay.classList.remove('visible');
  _overlay.classList.remove('ready-pulse');
    _overlay.textContent = '';
  _startBtn.textContent = 'Pause';
  _startBtn.classList.add('running');
  scoreCardEl?.classList.add('score-active');
    gameOverFlag = false;
  }

  function resetToReadyState() {
    game.reset(false); // reset but do NOT start
    // Manually zero visible stats (reset doesn't emit onStats without a piece)
  (scoreEl as HTMLElement).textContent = '0';
  (levelEl as HTMLElement).textContent = '1';
  (linesEl as HTMLElement).textContent = '0';
    if (progressBar) progressBar.style.width = '0%';
  _overlay.textContent = 'READY';
    _overlay.classList.add('visible');
  _overlay.classList.add('ready-pulse');
  _startBtn.textContent = 'Start';
  _startBtn.classList.remove('running');
  scoreCardEl?.classList.remove('score-active');
    gameOverFlag = false;
  }

  startBtn.addEventListener('click', () => { if (gameOverFlag) restartGame(); else togglePauseUi(); });
  if (location.search.includes('debug=1')) console.debug('[tetris] start button listener attached');
  resetBtn?.addEventListener('click', () => { resetToReadyState(); });
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
  if (e.key === 'r' || e.key === 'R') { resetToReadyState(); }
  });

  // Mobile custom event wiring
  window.addEventListener('tetris-btn-left', ()=> game.moveLeft());
  window.addEventListener('tetris-btn-right', ()=> game.moveRight());
  window.addEventListener('tetris-btn-down', ()=> game.dropSoft());

  // Not auto-starting: waits for user interaction.
}

// Fallback: if document already loaded, run immediately; else wait for DOMContentLoaded
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

// Watchdog: warn if not initialized within 2s
setTimeout(() => { if (!initialized) console.error('[tetris] initialization watchdog: boot() never ran'); }, 2000);

// Removed scaling logic to prevent clipping; Electron window resized instead.
