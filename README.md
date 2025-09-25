# Modern Tetris (Cloud + Desktop)

This repository contains a modern-styled falling-blocks game (Tetris-like) built with TypeScript + Vite (web) and an optional Electron wrapper (desktop). The goal now: deploy a cloud version (Netlify) your friends can open instantly, then optionally produce desktop installers.

We will proceed step-by-step. After completing each step, report back so we advance.

## Feature Snapshot
* Canvas rendering with beveled gradient tiles
* Line clear + Tetris explosion particles + bonus scoring
* Soft / hard drop scoring
* Level speed progression (every 10 lines)
* High score persistence (localStorage)
* Remote logo injection via `?logo=` or `VITE_LOGO_URL`

## Scripts
| Command | Purpose |
|---------|---------|
| `npm run dev` | Plain Vite dev server (browser) |
| `npm run electron:dev` | Desktop dev (dynamic port + Electron) |
| `npm run build` | Production web build -> `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run electron` | Run Electron against existing `dist` |
| `npm run desktop` | Build web then start Electron (prod assets) |
| `npm test` | Run unit tests (Vitest) |

## Controls
Keyboard: Arrows (move/rotate up), Shift (hard drop), Space (pause/start), R (reset).
On-screen buttons provide movement & drops.

## Deployment Plan (High Level)
1. Build locally and verify production output (Step 1)
2. Configure Netlify site & environment variable for logo (Step 2)
3. Connect GitHub repo to Netlify; auto-deploy on push (Step 3)
4. (Optional) Add custom domain / HTTPS (Step 4)
5. (Optional) PWA offline support (Step 5)
6. (Optional) Electron packaging with installers (Step 6)

---
## STEP 1 – Local Production Build Verification (DO THIS FIRST)
Goal: Ensure the app builds cleanly and the static version works without Electron.

Commands (PowerShell):
```
npm install
npm run build
```
Expected:
* `dist/` folder created with `index.html`, assets, JS chunks
* No build errors
* Open a local preview:
	```
	npx serve dist
	```
	Visit the printed URL, press Start, pieces should appear and move.

If pieces don’t show: report symptom (blank canvas, partial UI, console errors) so we adjust.

When finished: reply “Step 1 done” (include any anomalies).

---
## (Preview) STEP 2 – Netlify Environment
Don’t do yet. Will involve adding `VITE_LOGO_URL` in Netlify UI to point to a remote logo PNG.

---
## Troubleshooting Quick Reference
| Symptom | Check |
|---------|-------|
| Canvas empty | Open browser console; confirm no 404 for JS. Check `TetrisGame` errors. |
| Blocks invisible | Color gradient helper (already fixed) – rebuild. |
| High score not persisting | localStorage blocked (incognito / storage disabled). |
| Remote logo missing | Confirm env var or `?logo=` param; test image URL directly. |

---
## License / Naming
“Tetris” is a trademark of The Tetris Company. For personal/friend distribution only. Consider renaming for public release.

---
## Next Enhancements (Optional Later)
* PWA manifest + service worker for offline play
* Sound effects & volume toggle
* SRS rotation kicks
* Config menu (particle density, color themes)
* Electron auto-update (electron-builder + GitHub Releases)

---
Reply after Step 1 success and we’ll proceed.
