/* Core Tetris game logic and rendering */
export interface TetrisStats { score: number; level: number; lines: number; }
export interface TetrisGameOptions {
  width: number; // columns
  height: number; // rows
  canvas: HTMLCanvasElement;
  nextCanvas?: HTMLCanvasElement; // optional (preview disabled if absent)
  onStats?: (stats: TetrisStats) => void;
  onGameOver?: () => void;
  /** Optional RNG injection for deterministic tests */
  rng?: () => number;
  /** If true, skips real canvas context acquisition & rendering */
  headless?: boolean;
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

// ===================== START PATCH: MODERN PALETTE + RENDER =====================

/** Per-piece style bundle so every color has coherent shades */
export type PieceStyle = {
  base: string;      // main body color
  highlight: string; // bright edge/high side
  mid: string;       // inner-face start
  shadow: string;    // dark edge/low side
  edge: string;      // rim line color (dark)
  gloss: string;     // gloss tint (for additive radial)
};

/** Modernized-classic palette (cyan, yellow, purple, orange, blue, green, red)
 * tuned to look sharp and saturated on a dark UI without cartoonish neon.
 */
// Modern saturated palette with controlled shadows (earlier favored set)
export const PIECE_STYLES: Record<'I'|'O'|'T'|'L'|'J'|'S'|'Z', PieceStyle> = {
  I: { base:'#18D0E6', highlight:'#5FEFFF', mid:'#18B8D0', shadow:'#0F6B85', edge:'#0A3C4A', gloss:'#9FF7FF' },
  O: { base:'#F7C62F', highlight:'#FFE45F', mid:'#DDAE20', shadow:'#8F6A10', edge:'#4A3905', gloss:'#FFF27A' },
  T: { base:'#7040F2', highlight:'#9A70FF', mid:'#5A2DC0', shadow:'#351A75', edge:'#220E4D', gloss:'#B699FF' },
  L: { base:'#F2922A', highlight:'#FFB366', mid:'#D6761C', shadow:'#8C4208', edge:'#4D2203', gloss:'#FFC48A' },
  J: { base:'#2E6CF3', highlight:'#5D95FF', mid:'#2052C8', shadow:'#0E2F73', edge:'#081946', gloss:'#7FB1FF' },
  S: { base:'#22B366', highlight:'#4DDB8B', mid:'#1C8F52', shadow:'#0B4D2C', edge:'#042618', gloss:'#6EFFAD' },
  Z: { base:'#E23B33', highlight:'#FF726B', mid:'#B83028', shadow:'#6A1410', edge:'#350807', gloss:'#FF9892' },
};

/** HSL helpers so shading looks natural across hues */
function clamp01(n: number) { return Math.max(0, Math.min(1, n)); }
function hexToRgb(hex: string) {
  const h = hex.replace('#', '').trim();
  const v = h.length === 3
    ? h.split('').map(c => c + c).join('')
    : h.padEnd(6, '0').slice(0, 6);
  const r = parseInt(v.slice(0,2), 16);
  const g = parseInt(v.slice(2,4), 16);
  const b = parseInt(v.slice(4,6), 16);
  return { r, g, b };
}
function rgbToHex(r: number, g: number, b: number) {
  const to2 = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}
function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h = 0, s = 0; const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = l > .5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h, s, l };
}
function hslToRgb(h: number, s: number, l: number) {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return { r: r*255, g: g*255, b: b*255 };
}
/** Lighten/Darken by percent (positive = lighten) */
export function lighten(hex: string, pct: number) {
  const { r, g, b } = hexToRgb(hex);
  const hsl = rgbToHsl(r, g, b);
  const l = clamp01(hsl.l + (pct/100));
  const rgb = hslToRgb(hsl.h, hsl.s, l);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}
export function darken(hex: string, pct: number) {
  return lighten(hex, -pct);
}

/** Draw a single cell with beveled edges, inset face, inner border and gloss.
 * Uses the passed PieceStyle for consistent, “forged” depth.
 */
// Single beveled modern draw
function drawCell(ctx:CanvasRenderingContext2D, x:number, y:number, size:number, style:PieceStyle) {
  const s = size; const bx = x; const by = y; const base = style.base;
  // 1. Base fill slightly adjusted
  ctx.fillStyle = darken(base, 4);
  ctx.fillRect(bx, by, s, s);
  // 2. Dark core (inverse of old glossy highlight) – subtle radial inward darkening
  const cx = bx + s/2, cy = by + s/2; const coreR = s*0.75;
  const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
  rg.addColorStop(0, hexToRgba(darken(base, 25), 0.85));
  rg.addColorStop(0.55, hexToRgba(darken(base, 18), 0.55));
  rg.addColorStop(1, hexToRgba(base, 0));
  ctx.fillStyle = rg; ctx.fillRect(bx, by, s, s);
  // 3. Edge bevels (directional) using only tinted variations (no white)
  const bev = Math.max(2, Math.round(s*0.18));
  // Top-left lighter wedge
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx + s, by);
  ctx.lineTo(bx + s - bev, by + bev);
  ctx.lineTo(bx + bev, by + bev);
  ctx.lineTo(bx, by + s);
  ctx.closePath();
  ctx.fillStyle = hexToRgba(lighten(base, 14), 0.35);
  ctx.fill();
  // Bottom-right darker wedge
  ctx.beginPath();
  ctx.moveTo(bx + s, by);
  ctx.lineTo(bx + s, by + s);
  ctx.lineTo(bx, by + s);
  ctx.lineTo(bx + bev, by + s - bev);
  ctx.lineTo(bx + s - bev, by + s - bev);
  ctx.lineTo(bx + s - bev, by + bev);
  ctx.closePath();
  ctx.fillStyle = hexToRgba(darken(base, 32), 0.55);
  ctx.fill();
  // 4. Razor outer frame
  ctx.strokeStyle = darken(base, 40);
  ctx.lineWidth = 1;
  ctx.strokeRect(bx + 0.5, by + 0.5, s - 1, s - 1);
  // 5. Inner luminous rim (gives machined feel)
  const inset = Math.max(1, Math.round(s*0.26));
  ctx.strokeStyle = hexToRgba(lighten(base, 10), 0.75);
  ctx.strokeRect(bx + inset + 0.5, by + inset + 0.5, s - 2*inset - 1, s - 2*inset - 1);
  // 6. Micro shadow along bottom-right to "lift" piece
  ctx.fillStyle = hexToRgba(darken(base, 45), 0.35);
  ctx.fillRect(bx + 1, by + s - 2, s - 2, 1);
  ctx.fillRect(bx + s - 2, by + 1, 1, s - 2);
}

/** Convert #rrggbb to rgba(...) string with alpha */
function hexToRgba(hex: string, a = 1) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${clamp01(a)})`;
}

// ====================== END PATCH: MODERN PALETTE + RENDER ======================
const SCORE_TABLE = { 1: 100, 2: 300, 3: 500, 4: 800 };
const TETRIS_BONUS = 400; // extra bonus for 4-line clear

// FX tuning (reduced lightning intensity)
const FX = {
  tetris: {
    flash: 220,
    shakeTime: 180,
    shakeMag: 5,
    arcsMin: 3,
    arcsMax: 4,
    arcSegMin: 6,
    arcSegMax: 8,
    particlesPerCell: 8,
    shockwaveTtl: 360,
    shockwaveRadiusFactor: 0.65
  }
};

// (legacy lighten/darken helpers removed – replaced by HSL versions in patch above)

interface ActivePiece { type: string; rotation: number; x: number; y: number; shape: number[][]; }
interface Particle { x:number; y:number; vx:number; vy:number; life:number; ttl:number; color:string; size:number; }
interface LightningArc { points: {x:number; y:number;}[]; life:number; ttl:number; }
interface Shockwave { x:number; y:number; life:number; ttl:number; maxR:number; }

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
  private lightning: LightningArc[] = [];
  private shockwaves: Shockwave[] = [];
  private shakeTime = 0; // ms remaining of camera shake
  private shakeMag = 0;  // base magnitude
  // Row puff FX (lightning/smoke bursts for Tetris clears)
  private rowPuffs: { x:number; y:number; life:number; ttl:number; r:number; maxR:number; color:string; }[] = [];
  // Interpolation progress for smoother falling render (0..1 each gravity step)
  private fallProgress = 0;
  private softDropHeld = false;
  private softDropRepeatAccum = 0;
  // Tetris special message timing
  private tetrisMsgUntil = 0;
  private tetrisMsgText = '';
  private rng: () => number;
  private headless = false;
  private simpleMode = false; // disables beveled draw for debug
  // single style palette

  constructor(private options: TetrisGameOptions) {
    this.width = options.width;
    this.height = options.height;
    this.board = Array.from({ length: this.height }, () => Array(this.width).fill(null));
    this.canvas = options.canvas;
    // Assign RNG immediately so refillQueue can use it
    this.rng = options.rng ?? Math.random;
    this.headless = !!options.headless;
    if (this.headless) {
      // Minimal no-op 2D context stub sufficient for method calls in draw()
      const noop = () => {};
      const grad: any = { addColorStop: noop };
      const dummyCtx: Partial<CanvasRenderingContext2D> = {
        fillRect: noop, clearRect: noop, beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop,
        stroke: noop, strokeRect: noop, fill: noop, arc: noop, save: noop, restore: noop,
        translate: noop, createRadialGradient: () => grad, createLinearGradient: () => grad,
        fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1,
        getImageData: () => ({ data: new Uint8ClampedArray(this.canvas.width * this.canvas.height * 4) } as any)
      };
      this.ctx = dummyCtx as CanvasRenderingContext2D;
    } else {
      const ctx = this.canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context not available');
      this.ctx = ctx;
    }
    if (options.nextCanvas) {
      this.nextCanvas = options.nextCanvas;
      if (this.headless) {
        // stub next context too
        const noop = () => {};
        const grad: any = { addColorStop: noop };
        const dummyCtx: Partial<CanvasRenderingContext2D> = {
          fillRect: noop, clearRect: noop, beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop,
          stroke: noop, strokeRect: noop, fill: noop, arc: noop, save: noop, restore: noop,
          translate: noop, createRadialGradient: () => grad, createLinearGradient: () => grad,
          fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1,
        };
        this.nextCtx = dummyCtx as CanvasRenderingContext2D;
      } else {
        const nctx = this.nextCanvas.getContext('2d');
        if (!nctx) throw new Error('Next canvas 2D context not available');
        this.nextCtx = nctx;
      }
    }

    this.bindInput();
    this.refillQueue();
    this.loadHigh();
    try { this.simpleMode = location.search.includes('simple=1'); } catch {}
  }

  private bindInput() {
    document.addEventListener('keydown', (e) => {
      if (!this.running) return;
      switch (e.key) {
        case 'ArrowLeft': this.move(-1); break;
        case 'ArrowRight': this.move(1); break;
        case 'ArrowUp': this.rotate(); break;
        case 'ArrowDown':
          if (!this.softDropHeld) { this.softDropHeld = true; this.softDrop(); }
          e.preventDefault();
          break;
        case 'Shift': this.hardDrop(); break;
        case 'c': case 'C': this.hold(); break;
      }
    });
    document.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowDown') this.softDropHeld = false;
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

  reset(startImmediately: boolean = true) {
    this.board.forEach(row => row.fill(null));
    this.stats = { score: 0, level: 1, lines: 0 };
    this.dropInterval = 1000;
    this.current = null;
    this.nextQueue = [];
    this.held = null;
    this.holdUsedThisTurn = false;
    // Fully clear visual/effect state so a restart after GAME OVER is clean
    this.particles = [];
    this.lightning = [];
    this.shockwaves = [];
    this.flashUntil = 0;
    this.shakeTime = 0;
    this.shakeMag = 0;
    this.refillQueue();
    // Force loop re-init (game over stops it). Use start() so RAF resumes.
    this.running = false;
    if (startImmediately) this.start();
  }

  // (loop moved to end with enhanced FX handling)

  private refillQueue() {
    const bag = Object.keys(TETROMINOES);
    // Fisher–Yates shuffle using injected RNG for determinism in tests
    for (let i = bag.length -1; i>0; i--) {
      const j = Math.floor(this.rng() * (i+1));
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
          this.current.shape = shape;
          break;
        }
      }
    }
  }

  // (style mode methods removed)

  private softDrop() {
    if (!this.current) return;
    if (!this.stepDown()) {
      this.lockPiece();
    } else {
      this.stats.score += 1; // soft drop reward
      this.updateStats();
      // Reset progress so interpolation restarts from new cell
      this.dropAccumulator = 0;
      this.fallProgress = 0;
    }
  }

  private hardDrop() {
    if (!this.current) return;
    let distance = 0;
    while (this.stepDown()) distance++;
    this.stats.score += distance * 2; // hard drop reward
    this.lockPiece();
    this.dropAccumulator = 0;
    this.fallProgress = 0;
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
    this.dropAccumulator = 0;
    this.fallProgress = 0;
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
      if (cleared === 4) this.spawnTetrisLightning(fullRows); else this.spawnGenericLineClear(fullRows);
      this.stats.score += SCORE_TABLE[cleared as 1|2|3|4] * this.stats.level;
      if (cleared === 4) this.stats.score += TETRIS_BONUS * this.stats.level;
      this.stats.lines += cleared; // increment total lines
      const prevLevel = this.stats.level;
      const newLevel = Math.floor(this.stats.lines / 10) + 1;
      if (newLevel !== this.stats.level) {
        this.stats.level = newLevel;
        this.dropInterval = Math.max(100, 1000 - (this.stats.level -1)*75);
        // Level up event for UI animations
        try { window.dispatchEvent(new CustomEvent('tetris-level-up', { detail: { level: this.stats.level, lines: this.stats.lines, score: this.stats.score } })); } catch {}
      }
      this.updateStats();
      // Generic line clear event (after stats update)
      try {
        window.dispatchEvent(new CustomEvent('tetris-line-clear', { detail: {
          cleared,
          lines: this.stats.lines,
          score: this.stats.score,
          level: this.stats.level,
          levelChanged: newLevel !== prevLevel
        }}));
      } catch {}
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

  private spawnTetrisLightning(rows: number[]) {
    // Localized row FX + lightweight lightning arcs + motivational message
    const cellW = this.canvas.width / this.width;
    const cellH = this.canvas.height / this.height;
    // Mild flash & shake for emphasis
    this.flashUntil = performance.now() + 200;
    this.shakeTime = 180;
    this.shakeMag = 3;
    this.lightning = [];
    this.shockwaves = [];
    rows.forEach(r => {
      const rowYMid = (r + 0.5) * cellH;
      // Puffs across the row
      const puffCount = 3;
      for (let i=0;i<puffCount;i++) {
        const x = (0.15 + (i/(puffCount-1))*0.7) * this.canvas.width + (Math.random()-0.5)*cellW*0.5;
        const ttl = 420 + Math.random()*180;
        this.rowPuffs.push({ x, y: rowYMid, life:0, ttl, r:0, maxR: cellH*0.9, color:'#9ddcff' });
      }
      // Sparks
      for (let c=0;c<this.width;c++) {
        const baseX = (c+0.5)*cellW;
        for (let s=0;s<4;s++) {
          const ang = (-Math.PI/2) + (Math.random()-0.5)*Math.PI*0.5;
          const spd = 120 + Math.random()*140;
            this.particles.push({
              x: baseX,
              y: rowYMid,
              vx: Math.cos(ang)*spd*0.35,
              vy: Math.sin(ang)*spd,
              life:0, ttl: 300 + Math.random()*200,
              color: s%2===0? '#e0f7ff' : '#8bd3ff',
              size: 1 + Math.random()*2
            });
        }
      }
    });
    // Create a few stylized lightning arcs spanning random horizontal segments
    const arcCount = 2 + Math.floor(Math.random()*2);
    for (let i=0;i<arcCount;i++) {
      const yStart = Math.random() * this.canvas.height * 0.6;
      const yEnd = yStart + (Math.random()*this.canvas.height*0.3 + 40);
      const segs = 5 + Math.floor(Math.random()*4);
      const pts: {x:number;y:number;}[] = [];
      const xBase = this.canvas.width * (0.15 + Math.random()*0.7);
      for (let s=0; s<=segs; s++) {
        const t = s / segs;
        const jitterX = (Math.random()-0.5) * 40;
        const jitterY = (Math.random()-0.5) * 20;
        pts.push({ x: xBase + jitterX, y: yStart + (yEnd - yStart)*t + jitterY });
      }
      this.lightning.push({ points: pts, life:0, ttl: 260 + Math.random()*120 });
    }
    // Motivational message overlay
    this.tetrisMsgText = 'WHATEVER IT TAKES';
    this.tetrisMsgUntil = performance.now() + 900;
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

  private updateLightning(delta:number) {
    if (!this.lightning.length) return;
    for (let i=this.lightning.length-1; i>=0; i--) {
      const arc = this.lightning[i];
      arc.life += delta;
      if (arc.life > arc.ttl) this.lightning.splice(i,1);
    }
  }

  private updateShockwaves(delta:number) {
    if (!this.shockwaves.length) return;
    for (let i=this.shockwaves.length-1; i>=0; i--) {
      const sw = this.shockwaves[i];
      sw.life += delta;
      if (sw.life > sw.ttl) this.shockwaves.splice(i,1);
    }
  }

  private updateRowPuffs(delta:number) {
    if (!this.rowPuffs.length) return;
    for (let i=this.rowPuffs.length-1;i>=0;i--) {
      const p = this.rowPuffs[i];
      p.life += delta;
      if (p.life > p.ttl) { this.rowPuffs.splice(i,1); continue; }
      const t = p.life / p.ttl;
      p.r = p.maxR * (0.15 + 0.85 * t);
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

  private loop = (time: number) => {
    if (!this.running) return;
    const delta = time - this.lastTime;
    this.lastTime = time;
    this.dropAccumulator += delta;
    if (this.dropAccumulator >= this.dropInterval) {
      this.dropAccumulator = 0;
      const moved = this.stepDown();
      if (!moved) this.lockPiece();
    }
    this.updateParticles(delta);
    this.updateLightning(delta);
    this.updateShockwaves(delta);
    this.updateRowPuffs(delta);
    // Continuous soft drop handling (every 50ms while held)
    if (this.softDropHeld && this.current) {
      this.softDropRepeatAccum += delta;
      const interval = 50; // ms per accelerated step
      while (this.softDropRepeatAccum >= interval) {
        this.softDropRepeatAccum -= interval;
        if (!this.stepDown()) { this.lockPiece(); break; }
        else {
          this.stats.score += 1;
          this.updateStats();
          this.dropAccumulator = 0; // reset gravity interpolation
          this.fallProgress = 0;
        }
      }
    } else {
      this.softDropRepeatAccum = 0;
    }
    if (this.shakeTime > 0) this.shakeTime = Math.max(0, this.shakeTime - delta);
    // Compute fall interpolation progress (0..1) if current piece can still move
    if (this.current && this.dropInterval > 0) {
      if (!this.collides(this.current, this.current.x, this.current.y + 1)) {
        this.fallProgress = Math.min(1, this.dropAccumulator / this.dropInterval);
      } else {
        this.fallProgress = 0; // don't interpolate if blocked
      }
    } else {
      this.fallProgress = 0;
    }
    this.draw();
    requestAnimationFrame(this.loop);
  };

  private loadHigh() {
    try { const v = Number(localStorage.getItem(HIGH_KEY)); if (!isNaN(v)) this.highScore = v; } catch {}
  }

  getHighScore() { return this.highScore; }
  getHeld() { return this.held; }

  private drawBoard() {
    const cw = this.canvas.width / this.width;
    const ch = this.canvas.height / this.height;
    this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    for (let r=0; r<this.height; r++) {
      for (let c=0; c<this.width; c++) {
        const cellVal = this.board[r][c];
        if (cellVal) {
          if (this.simpleMode) {
            this.ctx.fillStyle = PIECE_STYLES[cellVal as 'I'|'O'|'T'|'L'|'J'|'S'|'Z'].base;
            this.ctx.fillRect(c*cw, r*ch, cw, ch);
          } else {
            drawCell(this.ctx, c*cw, r*ch, cw, PIECE_STYLES[cellVal as 'I'|'O'|'T'|'L'|'J'|'S'|'Z']);
          }
        } else {
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
            const py = (y + r + this.fallProgress) * ch;
            if (this.simpleMode) {
              this.ctx.fillStyle = PIECE_STYLES[type as 'I'|'O'|'T'|'L'|'J'|'S'|'Z'].base;
              this.ctx.fillRect(px, py, cw, ch);
            } else {
              drawCell(this.ctx, px, py, cw, PIECE_STYLES[type as 'I'|'O'|'T'|'L'|'J'|'S'|'Z']);
            }
          }
        }
      }
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
            drawCell(this.nextCtx as CanvasRenderingContext2D, x, y, size, PIECE_STYLES[type as 'I'|'O'|'T'|'L'|'J'|'S'|'Z']);
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

  private drawLightningArcs() {
    if (!this.lightning.length) return;
    for (const arc of this.lightning) {
      const t = arc.life / arc.ttl;
      const fade = 1 - t;
      this.ctx.save();
      this.ctx.lineJoin = 'round';
      this.ctx.lineCap = 'round';
      const layers = [
        { w: 6, a: 0.08, col:'#7dd3fc' },
        { w: 4, a: 0.18, col:'#bae6fd' },
        { w: 2, a: 0.75*fade, col:'#e0f2ff' },
        { w: 1, a: 0.9*fade, col:'#ffffff' }
      ];
      for (const layer of layers) {
        this.ctx.beginPath();
        for (let i=0;i<arc.points.length;i++) {
          const pt = arc.points[i];
          if (i===0) this.ctx.moveTo(pt.x, pt.y); else this.ctx.lineTo(pt.x, pt.y);
        }
        this.ctx.strokeStyle = this.applyAlpha(layer.col, layer.a * fade);
        this.ctx.lineWidth = layer.w * (0.7 + fade*0.3);
        this.ctx.stroke();
      }
      this.ctx.restore();
    }
  }

  private applyAlpha(hex:string, a:number) {
    if (hex.length===7) {
      const alpha = Math.round(Math.min(1,Math.max(0,a))*255).toString(16).padStart(2,'0');
      return hex + alpha;
    }
    return hex;
  }

  private draw() {
    if (this.headless) return; // skip all rendering work in headless mode
    this.ctx.save();
    // Apply camera shake transform once
    if (this.shakeTime > 0) {
      const intensity = (this.shakeTime/300);
      const dx = (Math.random()*2 -1) * this.shakeMag * intensity;
      const dy = (Math.random()*2 -1) * this.shakeMag * intensity;
      this.ctx.translate(dx, dy);
    }
    // Single pass draw order
    this.drawBoard();
    this.drawParticles();
    this.drawLightningArcs();
    this.drawShockwaves();
    this.drawRowPuffs();
    // Tetris message overlay
    if (this.tetrisMsgUntil && performance.now() < this.tetrisMsgUntil) {
      const remain = this.tetrisMsgUntil - performance.now();
      const ttl = 900;
      const t = 1 - (remain / ttl); // 0 -> 1
      const fadeIn = Math.min(1, t / 0.15);
      const fadeOut = Math.min(1, remain / 180); // last 180ms fade
      const alpha = Math.min(fadeIn, fadeOut);
      const flicker = 0.85 + Math.sin(performance.now()/40)*0.15;
      const finalA = alpha * flicker;
      this.ctx.save();
      this.ctx.translate(0, -10); // slight raise to avoid overlapping bottom pieces
      this.ctx.font = '700 22px system-ui,Segoe UI,Roboto,Arial';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      const cx = this.canvas.width/2;
      const cy = this.canvas.height/2;
      // Glow layers
      this.ctx.fillStyle = `rgba(180,220,255,${finalA*0.25})`;
      for (let g=0; g<4; g++) this.ctx.fillText(this.tetrisMsgText, cx, cy);
      this.ctx.fillStyle = `rgba(235,245,255,${finalA})`;
      this.ctx.fillText(this.tetrisMsgText, cx, cy);
      this.ctx.restore();
    }
    this.ctx.restore();
    if (this.flashUntil && performance.now() < this.flashUntil) {
      const remain = (this.flashUntil - performance.now())/220;
      this.ctx.fillStyle = `rgba(255,255,255,${0.55*remain})`;
      this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
    }
  }

  private drawShockwaves() {
    if (!this.shockwaves.length) return;
    const prev = this.ctx.globalCompositeOperation;
    this.ctx.globalCompositeOperation = 'screen';
    for (const sw of this.shockwaves) {
      const t = sw.life / sw.ttl;
      const r = sw.maxR * (0.15 + 0.85 * t);
      const alpha = 1 - t;
      const g = this.ctx.createRadialGradient(sw.x, sw.y, r*0.15, sw.x, sw.y, r);
      g.addColorStop(0, `rgba(224,242,255,${0.25*alpha})`);
      g.addColorStop(0.35, `rgba(125,211,252,${0.18*alpha})`);
      g.addColorStop(0.6, `rgba(56,189,248,${0.08*alpha})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      this.ctx.beginPath();
      this.ctx.fillStyle = g;
      this.ctx.arc(sw.x, sw.y, r, 0, Math.PI*2);
      this.ctx.fill();
    }
    this.ctx.globalCompositeOperation = prev;
  }

  private drawRowPuffs() {
    if (!this.rowPuffs.length) return;
    const ctx = this.ctx;
    const prev = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'screen';
    for (const p of this.rowPuffs) {
      const t = p.life / p.ttl;
      const alpha = 0.5 * (1 - t);
      const g = ctx.createRadialGradient(p.x, p.y, p.r*0.15, p.x, p.y, p.r);
      g.addColorStop(0, `rgba(224,246,255,${alpha})`);
      g.addColorStop(0.45, `rgba(140,200,255,${alpha*0.55})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.fillStyle = g;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = prev;
  }
  
  // ================== TEST / QA SUPPORT (non-gameplay public helpers) ==================
  /** Returns a snapshot copy of the current board */
  public getBoardSnapshot(): (string|null)[][] {
    return this.board.map(r => r.slice());
  }
  /** Returns shallow stats copy */
  public getStats(): TetrisStats { return { ...this.stats }; }
  /** Peek next queue (first n upcoming types) */
  public _debugPeekQueue(n = 7): string[] { return this.nextQueue.slice(0, n); }
  /** Force-set the entire board (for tests). Size must match current dimensions. */
  public _debugSetBoard(rows: (string|null)[][]) {
    if (rows.length !== this.height || rows.some(r => r.length !== this.width)) throw new Error('Bad board size');
    this.board = rows.map(r => r.slice());
  }
  /** Force current active piece; resets rotation & shape. */
  public _debugForceCurrent(type: string, rotation = 0, x?: number, y = 0) {
    const shapes = TETROMINOES[type];
    if (!shapes) throw new Error('Unknown type');
    const shape = shapes[rotation % 4];
    const px = (x != null) ? x : Math.floor(this.width /2 - shape[0].length/2);
    this.current = { type, rotation: rotation%4, x: px, y, shape };
  }
  /** Advance gravity one step logic (stepDown + possible lock) */
  public _debugGravityTick() {
    const moved = this.stepDown();
    if (!moved) this.lockPiece();
  }
  /** Hard drop through public interface */
  public _debugHardDrop() { this.hardDrop(); }
  /** Soft drop single step (not hold loop) */
  public _debugSoftDrop() { this.softDrop(); }
  /** Directly clear lines using existing method (validate scoring) */
  public _debugInvokeClear() { this.clearLines(); }
  /** Reset without starting RAF loop (headless test use) */
  public _debugResetNoLoop() {
    this.board.forEach(r => r.fill(null));
    this.stats = { score: 0, level: 1, lines: 0 };
    this.dropInterval = 1000;
    this.current = null;
    this.nextQueue = [];
    this.refillQueue();
  }
  /** Whether there is an active current piece (for tests) */
  public _debugHasCurrent() { return !!this.current; }
}
