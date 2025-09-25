/* Core Tetris game logic and rendering */
export interface TetrisStats { score: number; level: number; lines: number; }
export interface TetrisGameOptions {
  width: number; // columns
  height: number; // rows
  canvas: HTMLCanvasElement;
  nextCanvas?: HTMLCanvasElement; // optional (preview disabled if absent)
  onStats?: (stats: TetrisStats) => void;
  onGameOver?: () => void;
}

// Tetromino definitions in their rotation states (0,90,180,270)
const TETROMINOES: Record<string, number[][][]> = {
  I: [
    [ [0,0,0,0], [1,1,1,1], [0,0,0,0], [0,0,0,0] ],
    [ [0,0,1,0], [0,0,1,0], [0,0,1,0], [0,0,1,0] ],
    [ [0,0,0,0], [0,0,0,0], [1,1,1,1], [0,0,0,0] ],
    [ [0,1,0,0], [0,1,0,0], [0,1,0,0], [0,1,0,0] ],
  ],
  J: [
    [ [1,0,0], [1,1,1], [0,0,0] ],
    [ [0,1,1], [0,1,0], [0,1,0] ],
    [ [0,0,0], [1,1,1], [0,0,1] ],
    [ [0,1,0], [0,1,0], [1,1,0] ],
  ],
  L: [
    [ [0,0,1], [1,1,1], [0,0,0] ],
    [ [0,1,0], [0,1,0], [0,1,1] ],
    [ [0,0,0], [1,1,1], [1,0,0] ],
    [ [1,1,0], [0,1,0], [0,1,0] ],
  ],
  O: [
    [ [1,1], [1,1] ],
    [ [1,1], [1,1] ],
    [ [1,1], [1,1] ],
    [ [1,1], [1,1] ],
  ],
  S: [
    [ [0,1,1], [1,1,0], [0,0,0] ],
    [ [0,1,0], [0,1,1], [0,0,1] ],
    [ [0,0,0], [0,1,1], [1,1,0] ],
    [ [1,0,0], [1,1,0], [0,1,0] ],
  ],
  T: [
    [ [0,1,0], [1,1,1], [0,0,0] ],
    [ [0,1,0], [0,1,1], [0,1,0] ],
    [ [0,0,0], [1,1,1], [0,1,0] ],
    [ [0,1,0], [1,1,0], [0,1,0] ],
  ],
  Z: [
    [ [1,1,0], [0,1,1], [0,0,0] ],
    [ [0,0,1], [0,1,1], [0,1,0] ],
    [ [0,0,0], [1,1,0], [0,1,1] ],
    [ [0,1,0], [1,1,0], [1,0,0] ],
  ]
};
(globalThis as any).TETROMINOES = TETROMINOES;

// Modern vibrant palette (inspired by contemporary UI color systems)
const COLORS: Record<string,string> = {
  I: '#06b6d4', // cyan
  J: '#3b82f6', // blue
  L: '#f97316', // orange
  O: '#eab308', // amber
  S: '#22c55e', // green
  T: '#8b5cf6', // violet
  Z: '#ef4444'  // red
};
const SCORE_TABLE = { 1: 100, 2: 300, 3: 500, 4: 800 };
const TETRIS_BONUS = 400; // extra bonus for 4-line clear

function hexToRgb(hex: string) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return { r:0,g:0,b:0 };
  return { r: parseInt(m[1],16), g: parseInt(m[2],16), b: parseInt(m[3],16) };
}
function clamp(v:number){ return Math.min(255, Math.max(0,v)); }
function toHex(n:number){ return n.toString(16).padStart(2,'0'); }
function alter(hex:string, ratio:number){
  const {r,g,b}=hexToRgb(hex);
  // Ensure integer channels; previous version produced fractional -> invalid hex -> invisible pieces
  const nr = clamp(Math.round(r + r*ratio));
  const ng = clamp(Math.round(g + g*ratio));
  const nb = clamp(Math.round(b + b*ratio));
  return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`;
}
function lighten(hex:string, amount:number){ return alter(hex, amount); }
function darken(hex:string, amount:number){ return alter(hex, -amount); }

interface ActivePiece { type: string; rotation: number; x: number; y: number; shape: number[][]; }
interface Particle { x:number; y:number; vx:number; vy:number; life:number; ttl:number; color:string; size:number; }

// LocalStorage key for high score
const HIGH_KEY = 'tetris_high_score';

export class TetrisGame {
  private width: number;
  private height: number;
  private board: (string | null)[][]; // rows x cols
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private nextCanvas?: HTMLCanvasElement;
  private nextCtx?: CanvasRenderingContext2D;
  private current: ActivePiece | null = null;
  private nextQueue: string[] = [];
  private dropInterval = 1000; // ms
  private dropAccumulator = 0;
  private lastTime = 0;
  private running = false;
  private stats: TetrisStats = { score: 0, level: 1, lines: 0 };
  private highScore: number = 0;
  private held: string | null = null;
  private holdUsedThisTurn = false;
  private particles: Particle[] = [];
  private flashUntil = 0;

  constructor(private options: TetrisGameOptions) {
    this.width = options.width;
    this.height = options.height;
    this.board = Array.from({ length: this.height }, () => Array(this.width).fill(null));
    this.canvas = options.canvas;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context not available');
    this.ctx = ctx;
    if (options.nextCanvas) {
      this.nextCanvas = options.nextCanvas;
      const nctx = this.nextCanvas.getContext('2d');
      if (!nctx) throw new Error('Next canvas 2D context not available');
      this.nextCtx = nctx;
    }

    this.bindInput();
    this.refillQueue();
    this.loadHigh();
  }

  private bindInput() {
    document.addEventListener('keydown', (e) => {
      if (!this.running) return;
      switch (e.key) {
        case 'ArrowLeft': this.move(-1); break;
        case 'ArrowRight': this.move(1); break;
        case 'ArrowUp': this.rotate(); break;
        case 'ArrowDown': this.softDrop(); break;
        case 'Shift': this.hardDrop(); break;
        case 'c': case 'C': this.hold(); break;
      }
    });
  }

  start() {
    if (!this.running) {
      this.running = true;
      if (!this.current) this.spawn();
      this.lastTime = performance.now();
      requestAnimationFrame(this.loop);
    }
  }

  togglePause() {
    if (!this.running) { this.start(); return; }
    this.running = false;
  }

  reset() {
    this.board.forEach(row => row.fill(null));
    this.stats = { score: 0, level: 1, lines: 0 };
    this.dropInterval = 1000;
    this.current = null;
    this.nextQueue = [];
    this.held = null;
    this.holdUsedThisTurn = false;
    this.refillQueue();
    this.running = true;
    this.spawn();
  }

  private loop = (time: number) => {
    if (!this.running) return;
    const delta = time - this.lastTime;
    this.lastTime = time;
    this.dropAccumulator += delta;
    if (this.dropAccumulator >= this.dropInterval) {
      this.dropAccumulator = 0;
      // Attempt gravity step; if it can't move further, lock automatically
      const moved = this.stepDown();
      if (!moved) {
        this.lockPiece();
      }
    }
    this.updateParticles(delta);
    this.draw();
    requestAnimationFrame(this.loop);
  };

  private refillQueue() {
    const bag = Object.keys(TETROMINOES);
    // shuffle
    for (let i = bag.length -1; i>0; i--) {
      const j = Math.floor(Math.random() * (i+1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    this.nextQueue.push(...bag);
  }

  private spawn() {
    if (this.nextQueue.length < 7) this.refillQueue();
    const type = this.nextQueue.shift()!;
    const shape = TETROMINOES[type][0];
    const piece: ActivePiece = {
      type,
      rotation: 0,
      x: Math.floor(this.width /2 - shape[0].length/2),
      y: 0,
      shape
    };
    if (this.collides(piece, piece.x, piece.y)) {
      this.gameOver();
      return;
    }
    this.current = piece;
    this.holdUsedThisTurn = false;
    this.updateStats();
    this.drawNext();
  }

  private gameOver() {
    this.running = false;
    if (this.stats.score > this.highScore) {
      this.highScore = this.stats.score;
      try { localStorage.setItem(HIGH_KEY, String(this.highScore)); } catch {}
    }
    this.options.onGameOver?.();
  }

  // Public control helpers for UI buttons
  moveLeft() { this.move(-1); }
  moveRight() { this.move(1); }
  rotateCW() { this.rotate(); }
  dropSoft() { this.softDrop(); }
  dropHard() { this.hardDrop(); }

  private move(dir: number) {
    if (!this.current) return;
    const nx = this.current.x + dir;
    if (!this.collides(this.current, nx, this.current.y)) {
      this.current.x = nx;
    }
  }

  private rotate() {
    if (!this.current) return;
    const { type, rotation } = this.current;
    const nextRotation = (rotation + 1) % 4;
    const shape = TETROMINOES[type][nextRotation];
    const test: ActivePiece = { ...this.current, rotation: nextRotation, shape };
    if (!this.collides(test, test.x, test.y)) {
      this.current.rotation = nextRotation;
      this.current.shape = shape;
    } else {
      // basic wall kick attempts left/right
      for (const shift of [-1, 1, -2, 2]) {
        if (!this.collides(test, test.x + shift, test.y)) {
          this.current.x += shift;
          this.current.rotation = nextRotation;
          this.current.shape = shape;
          break;
        }
      }
    }
  }

  private softDrop() {
    if (!this.current) return;
    if (!this.stepDown()) {
      this.lockPiece();
    } else {
      this.stats.score += 1; // soft drop reward
      this.updateStats();
    }
  }

  private hardDrop() {
    if (!this.current) return;
    let distance = 0;
    while (this.stepDown()) distance++;
    this.stats.score += distance * 2; // hard drop reward
    this.lockPiece();
  }

  private stepDown(): boolean {
    if (!this.current) return false;
    const ny = this.current.y + 1;
    if (!this.collides(this.current, this.current.x, ny)) {
      this.current.y = ny;
      return true;
    }
    return false;
  }

  private lockPiece() {
    if (!this.current) return;
    const { shape, x, y, type } = this.current;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) {
          const br = y + r;
            const bc = x + c;
          if (br >= 0) this.board[br][bc] = type;
        }
      }
    }
    this.clearLines();
    this.spawn();
  }

  private hold() {
    if (!this.current || this.holdUsedThisTurn) return;
    const swapType = this.held;
    this.held = this.current.type;
    if (swapType) {
      // spawn swapped piece at top
      const shape = TETROMINOES[swapType][0];
      this.current = { type: swapType, rotation: 0, x: Math.floor(this.width/2 - shape[0].length/2), y: 0, shape };
      if (this.collides(this.current, this.current.x, this.current.y)) { this.gameOver(); return; }
    } else {
      this.spawn();
    }
    this.holdUsedThisTurn = true;
  }

  private clearLines() {
    let cleared = 0;
    const fullRows: number[] = [];
    for (let r = this.height -1; r >=0; r--) {
      if (this.board[r].every(cell => cell)) {
        fullRows.push(r);
        this.board.splice(r,1);
        this.board.unshift(Array(this.width).fill(null));
        cleared++;
        r++;
      }
    }
    if (cleared>0) {
      if (cleared === 4) this.spawnTetrisExplosion(fullRows); else this.spawnGenericLineClear(fullRows);
      this.stats.lines += cleared;
      this.stats.score += SCORE_TABLE[cleared as 1|2|3|4] * this.stats.level;
      if (cleared === 4) this.stats.score += TETRIS_BONUS * this.stats.level;
      const newLevel = Math.floor(this.stats.lines / 10) + 1;
      if (newLevel !== this.stats.level) {
        this.stats.level = newLevel;
        this.dropInterval = Math.max(100, 1000 - (this.stats.level -1)*75);
      }
      this.updateStats();
    }
  }

  private spawnGenericLineClear(rows: number[]) {
    const cellW = this.canvas.width / this.width;
    const cellH = this.canvas.height / this.height;
    rows.forEach(r => {
      for (let c=0; c<this.width; c++) {
        for (let i=0;i<4;i++) {
          this.particles.push({
            x: (c+0.5)*cellW,
            y: (r+0.5)*cellH,
            vx: (Math.random()-0.5)*80,
            vy: - (Math.random()*120 + 20),
            life:0, ttl: 600,
            color: '#ffffffaa',
            size: 2 + Math.random()*3
          });
        }
      }
    });
  }

  private spawnTetrisExplosion(rows: number[]) {
    const cellW = this.canvas.width / this.width;
    const cellH = this.canvas.height / this.height;
    this.flashUntil = performance.now() + 220;
    rows.forEach(r => {
      for (let c=0; c<this.width; c++) {
        const baseX = (c+0.5)*cellW;
        const baseY = (r+0.5)*cellH;
        for (let i=0;i<30;i++) {
          const angle = Math.random()*Math.PI*2;
          const speed = 140 + Math.random()*260;
          this.particles.push({
            x: baseX,
            y: baseY,
            vx: Math.cos(angle)*speed,
            vy: Math.sin(angle)*speed - 40,
            life:0, ttl: 900,
            color: i%3===0? '#ffe66d' : (i%3===1? '#ffae34' : '#ffffff'),
            size: 2 + Math.random()*4
          });
        }
      }
    });
  }

  private updateParticles(delta:number) {
    if (!this.particles.length) return;
    const dt = delta/1000;
    for (let i=this.particles.length-1; i>=0; i--) {
      const p = this.particles[i];
      p.life += delta;
      if (p.life > p.ttl) { this.particles.splice(i,1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 220 * dt;
    }
  }

  private collides(piece: ActivePiece, x: number, y: number): boolean {
    const { shape } = piece;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const br = y + r;
        const bc = x + c;
        if (bc < 0 || bc >= this.width || br >= this.height) return true;
        if (br >=0 && this.board[br][bc]) return true;
      }
    }
    return false;
  }

  private updateStats() { this.options.onStats?.(this.stats); }

  private loadHigh() {
    try { const v = Number(localStorage.getItem(HIGH_KEY)); if (!isNaN(v)) this.highScore = v; } catch {}
  }

  getHighScore() { return this.highScore; }
  getHeld() { return this.held; }

  private drawCell(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, type: string) {
    const base = COLORS[type];
    const grad = ctx.createLinearGradient(x, y, x, y + size);
    grad.addColorStop(0, lighten(base, 0.35));
    grad.addColorStop(0.45, base);
    grad.addColorStop(1, darken(base, 0.35));
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, size, size);
    // Bevel highlight
    ctx.strokeStyle = lighten(base, 0.55);
    ctx.beginPath();
    ctx.moveTo(x+1,y+size-1); ctx.lineTo(x+1,y+1); ctx.lineTo(x+size-1,y+1);
    ctx.stroke();
    // Bevel shadow
    ctx.strokeStyle = darken(base, 0.55);
    ctx.beginPath();
    ctx.moveTo(x+size-1,y+1); ctx.lineTo(x+size-1,y+size-1); ctx.lineTo(x+1,y+size-1);
    ctx.stroke();
    // Inner stroke
    ctx.strokeStyle = '#00000055';
    ctx.strokeRect(x+0.5, y+0.5, size-1, size-1);
  }

  private drawBoard() {
    const cw = this.canvas.width / this.width;
    const ch = this.canvas.height / this.height;
    this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    for (let r=0; r<this.height; r++) {
      for (let c=0; c<this.width; c++) {
        const cell = this.board[r][c];
        if (cell) this.drawCell(this.ctx, c*cw, r*ch, cw, cell);
        else {
          this.ctx.fillStyle = (r+c)%2===0 ? '#050505' : '#0a0a0a';
          this.ctx.fillRect(c*cw, r*ch, cw, ch);
        }
      }
    }
    if (this.current) {
      const { shape, x, y, type } = this.current;
      for (let r=0; r<shape.length; r++) {
        for (let c=0; c<shape[r].length; c++) {
          if (shape[r][c]) {
            const px = (x + c) * cw;
            const py = (y + r) * ch;
            this.drawCell(this.ctx, px, py, cw, type);
          }
        }
      }
      // ghost piece removed per user request
    }
  }

  private drawNext() {
    if (!this.nextCanvas || !this.nextCtx) return;
    this.nextCtx.clearRect(0,0,this.nextCanvas.width,this.nextCanvas.height);
    const show = this.nextQueue.slice(0,3);
    show.forEach((type, idx) => {
      const shape = TETROMINOES[type][0];
      const size = 20;
      const offsetY = idx * 40 + 10;
      const offsetX = 10;
      for (let r=0; r<shape.length; r++) {
        for (let c=0; c<shape[r].length; c++) {
          if (shape[r][c]) {
            const x = offsetX + c*size;
            const y = offsetY + r*size;
            this.drawCell(this.nextCtx as CanvasRenderingContext2D, x, y, size, type);
          }
        }
      }
    });
  }

  private drawParticles() {
    if (!this.particles.length) return;
    for (const p of this.particles) {
      const alpha = 1 - (p.life / p.ttl);
      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size * (0.6 + alpha*0.4), 0, Math.PI*2);
      this.ctx.fill();
    }
    this.ctx.globalAlpha = 1;
  }

  private draw() {
    this.drawBoard();
    this.drawParticles();
    if (this.flashUntil && performance.now() < this.flashUntil) {
      const remain = (this.flashUntil - performance.now())/220;
      this.ctx.fillStyle = `rgba(255,255,255,${0.55*remain})`;
      this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
    }
  }
}
