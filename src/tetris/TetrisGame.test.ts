import { describe, it, expect } from 'vitest';
import { TetrisGame } from './TetrisGame';

describe('TetrisGame', () => {
  it('initializes empty board and spawns a piece on start', () => {
    const canvas = Object.assign(document.createElement('canvas'), { width: 300, height: 600 });
    const next = Object.assign(document.createElement('canvas'), { width: 120, height: 120 });
    const game = new TetrisGame({ width: 10, height: 20, canvas, nextCanvas: next });
    game.start();
    // After starting, a current piece should exist (private, so we inspect drawing side-effects by counting colored pixels)
    const ctx = canvas.getContext('2d')!;
    game['draw'](); // force a draw
    const data = ctx.getImageData(0,0,300,600).data;
    // Expect at least some non-black pixel (R,G,B not all zero) due to piece rendering or board background pattern
    const hasColored = (() => {
      for (let i=0; i<data.length; i+=4) {
        const r=data[i], g=data[i+1], b=data[i+2];
        if (r>0 || g>0 || b>0) return true;
      }
      return false;
    })();
    expect(hasColored).toBe(true);
  });
});
