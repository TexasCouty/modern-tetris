import { describe, it, expect, beforeEach } from 'vitest';
import { TetrisGame } from './TetrisGame';

function makeCanvas(w=300,h=600) {
  return Object.assign(document.createElement('canvas'), { width: w, height: h });
}

// Deterministic RNG helper
function seededRng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    // xorshift32
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return (s >>> 0) / 0xFFFFFFFF;
  };
}

describe('TetrisGame Core', () => {
  let canvas: HTMLCanvasElement; let next: HTMLCanvasElement;
  beforeEach(() => {
    canvas = makeCanvas();
    next = makeCanvas(120,120);
  });

  it('spawns a current piece on start (headless)', () => {
    const game = new TetrisGame({ width:10, height:20, canvas, nextCanvas: next, rng: seededRng(42), headless:true });
    game.start();
    expect((game as any)._debugHasCurrent()).toBe(true);
  });

  it('7-bag generator gives all 7 unique pieces per bag deterministically', () => {
  const game = new TetrisGame({ width:10, height:20, canvas, rng: seededRng(10), headless:true });
    const seenBags: Set<string> = new Set();
    // Force creation of two full bags
    for (let i=0;i<14;i++) {
      if ((game as any).nextQueue.length < 7) (game as any).refillQueue();
      const bagSlice = (game as any).nextQueue.slice(0,7).sort().join('');
      if (!seenBags.has(bagSlice)) seenBags.add(bagSlice);
      // consume one piece
      (game as any).nextQueue.shift();
    }
    // Expect at least one canonical set of 7
    expect([...seenBags][0]).toBe('IJLOSTZ');
  });

  it('single line clear updates score, lines, maybe level', () => {
  const game = new TetrisGame({ width:10, height:20, canvas, rng: seededRng(2), headless:true });
    // Fill bottom row except one cell then drop a 1x1 filler using O piece forced
    const empty = Array.from({length:20},()=>Array(10).fill(null) as (string|null)[]);
    empty[19] = Array(10).fill('I');
    empty[19][9] = null; // leave gap
    game._debugSetBoard(empty);
    game._debugForceCurrent('O',0,8,18); // place so a block fills last gap when locked
    // Hard drop to lock
    game._debugHardDrop();
    const stats = game.getStats();
    expect(stats.lines).toBe(1);
    expect(stats.score).toBeGreaterThanOrEqual(100); // base * level
  });

  it('hard drop awards 2 * distance', () => {
  const game = new TetrisGame({ width:10, height:20, canvas, rng: seededRng(3), headless:true });
    game._debugForceCurrent('I',0,3,0);
    // distance until collision on empty board = piece height? For I horizontal shape row at y=0, will drop to y=1? Simulate via repeated gravity.
    let steps = 0;
    while ((game as any).stepDown()) steps++;
    // Reset for actual test
    game._debugResetNoLoop();
    game._debugForceCurrent('I',0,3,0);
    // Hard drop now
    game._debugHardDrop();
    const got = game.getStats().score;
    expect(got).toBe(steps*2);
  });

  it('soft drop holding accumulates incremental score', () => {
  const game = new TetrisGame({ width:10, height:20, canvas, rng: seededRng(4), headless:true });
    game._debugForceCurrent('I',0,3,0);
    // manually call softDrop steps
    let manual = 0;
    while ((game as any).stepDown()) { manual++; game._debugSoftDrop(); }
    // Each successful softDrop() call adds +1 (excluding final that locks)
    const stats = game.getStats();
    expect(stats.score).toBe(manual); // distance times 1
  });

  it('level progression at 10 lines increases level and speeds dropInterval', () => {
  const game = new TetrisGame({ width:10, height:20, canvas, rng: seededRng(5), headless:true });
    // Simulate clearing 10 single lines
    for (let i=0;i<10;i++) {
      const board = Array.from({length:20},()=>Array(10).fill(null) as (string|null)[]);
      board[19] = Array(10).fill('I');
      game._debugSetBoard(board);
      game._debugForceCurrent('O',0,8,18);
      game._debugHardDrop();
    }
    const stats = game.getStats();
    expect(stats.level).toBeGreaterThan(1);
  });
});
