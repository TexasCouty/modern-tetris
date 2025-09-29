# Modern Tetris (Cloud + Desktop)

Always give me shell/terminal commands using the allow button so I can run them directly in VS Code, and you can monitor the terminal output. Never ask me to paste commands manually.

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
2. Netlify build (auto-detect Node) – no Python (Step 2)
3. (Optional) Add `VITE_LOGO_URL` env var OR just place `public/logo.png` (Step 3)
4. (Optional) Custom domain / HTTPS (Step 4)
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
## STEP 2 – Netlify Build (No Python)
If an earlier Python attempt left a `requirements.txt`, it would cause Netlify to install pygame and fail (SDL dev libs missing). That file has now been removed and a `netlify.toml` was added so Netlify runs exactly:

```
npm run build
```

Publish directory: `dist`

Push to `main` and Netlify should produce a successful deploy. If you ever see it trying to install pip packages again, confirm there is no `requirements.txt` or `.python-version` reintroduced.

## STEP 3 – Logo Options
You now have two simple choices:
* Static file: place `logo.png` in `public/` (served at `/logo.png`). The code automatically tries `/logo.png` before falling back to the inline SVG wordmark.
* Environment variable: set `VITE_LOGO_URL` in Netlify (or `.env`) to any HTTPS image. Runtime `?logo=` query parameter still overrides both.

Cache busting trick: append a dummy query (e.g., `/logo.png?v=2` or add `?v=2` to remote URL) when updating the image to force refresh.

---
## Troubleshooting Quick Reference
| Symptom | Check |
|---------|-------|
| Canvas empty | Open browser console; confirm no 404 for JS. Check `TetrisGame` errors. |
| Blocks invisible | Color gradient helper (already fixed) – rebuild. |
| High score not persisting | localStorage blocked (incognito / storage disabled). |
| Remote logo missing | Test direct `/logo.png` URL; if 404 ensure file is in `public/`. For env var path, confirm it starts with `/` or `https://`. |
| Netlify installs pip/pygame | A stray `requirements.txt` exists – remove & push again. |

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
