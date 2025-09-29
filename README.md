# Modern Tetris (Cloud + Desktop)

Always give me shell/terminal commands using the allow button so I can run them directly in VS Code, and you can monitor the terminal output. Never ask me to paste commands manually.

This repository contains a modern-styled falling-blocks game (Tetris-like) built with TypeScript + Vite (web) and an optional Electron wrapper (desktop). The goal now: deploy a cloud version (Netlify) your friends can open instantly, then optionally produce desktop installers.

We will proceed step-by-step. After completing each step, report back so we advance.

---
## Table of Contents
1. Feature Snapshot (current)
2. Technology Stack & Architecture
3. Game Mechanics & Scoring Model
4. Rendering & Visual Style Details
5. Input Model (Keyboard + Touch / Mobile Buttons)
6. Build & Run (Web + Electron)
7. Environment Variables & Logo Injection
8. Testing & QA Strategy (and current gaps)
9. Deployment (Netlify) Details
10. Electron Packaging (future outline)
11. Troubleshooting Matrix (extended)
12. Performance Notes
13. Security / Trademark Notice
14. Roadmap / Backlog Ideas

---

## Feature Snapshot
* Canvas rendering with beveled gradient tiles
* Line clear + Tetris explosion particles + bonus scoring
* Soft / hard drop scoring
* Level speed progression (every 10 lines)
* High score persistence (localStorage)
* Remote logo injection via `?logo=` or `VITE_LOGO_URL`
* 7‑bag randomized piece sequence (fair distribution)
* Event-driven UI updates (`tetris-line-clear`, `tetris-level-up`)
* Minimalistic modern scoreboard with progress bar for next level
* Toast notifications for line clears & level ups
* Deterministic headless test mode (injectable RNG)
* Mobile / touch-friendly on-screen controls (repeat fire for hold)
* Production build hardened (removed problematic inline scripts)

---
## 2. Technology Stack & Architecture
| Layer | Tech | Notes |
|-------|------|-------|
| Core Game Logic | TypeScript (module in `src/tetris/TetrisGame.ts`) | Pure logic + rendering separation opportunities. |
| Renderer | HTML5 Canvas 2D | Single canvas for board; optional future next/hold canvases. |
| Bundler / Dev Server | Vite | Fast HMR, ESM build, tree-shaking. |
| Desktop Shell (optional) | Electron (main: `electron-main.cjs`) | Loads dev server or built `dist/index.html`. |
| Test Runner | Vitest + jsdom/headless stubs | Logic-level deterministic tests. |
| Deployment | Netlify | Static site: serve `dist/` output. |

Project Layout (key files):
```
src/
	main.ts               # DOM boot + game wiring (DOMContentLoaded guarded)
	uiEnhancements.ts     # Scoreboard formatting, toasts, logo recolor, mobile buttons
	tetris/TetrisGame.ts  # Core engine, rendering, scoring, FX
electron-main.cjs       # Electron entry (prod/dev auto URL logic)
scripts/dev-electron.cjs# Dynamic port finder + Vite + Electron spawn
```

---
## 3. Game Mechanics & Scoring Model
| Action | Base Points (x Level) | Extra |
|--------|-----------------------|-------|
| 1 line | 100 | – |
| 2 lines | 300 | – |
| 3 lines | 500 | – |
| 4 lines (Tetris) | 800 | +400 Tetris bonus (also x Level) |
| Soft drop (step) | +1 per successful soft drop cell | Continuous hold accelerates every 50ms |
| Hard drop | +2 per cell descended instantly | Locks immediately |

Level increases every 10 cumulative cleared lines. Gravity interval reduces by 75ms per level until a minimum threshold (100ms). High score saved to `localStorage` key `tetris_high_score`.

Randomization uses a classic 7‑bag shuffle: each bag has the 7 distinct tetrominoes, Fisher–Yates shuffled, appended to a queue.

---
## 4. Rendering & Visual Style
Modern beveled “machined” tiles:
* Per-piece palette with base / highlight / mid / shadow / edge / gloss shades.
* Dual‑pass shading: dark core radial gradient + directional bevel wedges.
* Board background uses alternating dark squares for subtle grid.
* Special FX: localized row puffs & sparks on line clears (reduced from earlier heavy lightning for clarity & performance).

---
## 5. Input Model
Keyboard:
* Left / Right: horizontal move
* Up: rotate clockwise
* Down: soft drop (continuous acceleration if held)
* Shift: hard drop
* Space: Start / Pause toggle (on Game Over = restart)
* R: Reset / new game

Touch / Mobile Buttons:
* Repeat logic (accelerating delay) for held directional input.
* Buttons dispatch custom events consumed by main game instance.

---
## 6. Build & Run
Install dependencies and run dev server:
```
npm install
npm run dev
```
Electron development (auto-resolving a free port):
```
npm run electron:dev
```
Web production build:
```
npm run build
npm run preview   # optional local serve of dist
```
Electron production (after build):
```
npm run desktop
```

---
## 7. Environment Variables & Logo Injection
Order of logo resolution at runtime:
1. Query string `?logo=...`
2. Global `window.__TETRIS_LOGO_URL__` (injected from `VITE_LOGO_URL` env)
3. `/logo.png` (place in `public/`)
4. Inline fallback SVG gradient wordmark

Set in Netlify (or `.env` for local):
```
VITE_LOGO_URL=https://example.com/mylogo.png
```

The logo post-processor darkens white outlines by sampling average interior color and recoloring near‑white pixels for a cohesive dark theme.

---
## 8. Testing & QA Strategy
Current tests (Vitest) cover:
* 7‑bag determinism and queue refill
* Line clear scoring & Tetris bonus correctness
* Soft & hard drop scoring accumulation
* Level progression after cumulative lines
* Headless mode board operations

Known Gap: No integration test ensures DOM boot and Start button functionality (a recent issue where initialization ran before DOM caused “dead” Start button). Future enhancement: add jsdom integration test to import `main.ts`, simulate `DOMContentLoaded`, click Start, and assert a piece spawns (`window.__GAME__._debugHasCurrent()` or canvas change).

Planned additional tests:
* Piece lock + spawn sequence invariants
* Game over detection on blocked spawn
* Hold functionality (when re-enabled)
* FPS / performance budget (optional bench harness)

To run tests:
```
npm test
```

Headless Determinism: Pass a custom RNG to `TetrisGame` for reproducible scenarios in tests.

---
## 9. Deployment (Netlify)
Essential settings:
| Setting | Value |
|---------|-------|
| Build command | `npm run build` |
| Publish directory | `dist` |
| Node version | (Netlify default or specify 18+) |

No `requirements.txt` must exist (removal prevents unintended Python build). Inline scripts were extracted to modules to avoid parse5 HTML parse errors encountered earlier.

Cache busting: push a commit or change asset query strings.

Post-deploy checklist:
1. Page loads without raw CSS text (verified by proper `<style>` wrapper).
2. Start button spawns piece & “READY” overlay hides.
3. Score updates & progress bar animates.
4. LocalStorage high score updates after a game over.

---
## 10. Electron Packaging (Future Outline)
Not yet included (no builder dependency). Suggested path:
1. Add `electron-builder` or `electron-forge`.
2. Create build script: `"app:dist": "vite build"` and `"app:pack": "electron-builder"`.
3. Configure `electron-builder.yml` (appId, productName, win/nsis, dmg, linux targets).
4. Automate release: GitHub Actions workflow on tag push to build & upload artifacts.

---
## 11. Troubleshooting Matrix (Extended)
| Issue | Likely Cause | Fix |
|-------|--------------|-----|
| Start button does nothing | Script executed before DOM (pre-fix) | Use DOMContentLoaded guard (implemented) / ensure bundle updated |
| Blank screen, CSS printed as text | Missing `<style>` tag around CSS | Fixed by restructuring `index.html` |
| No pieces spawn after pause | Game never started | Click Start or Space; confirm console clear |
| High score not saved | Private / blocked storage | Test outside incognito; inspect localStorage key |
| Tetris bonus seems off | Level multiplier confusion | Points = (base + bonus if 4 lines) * current level |
| Netlify parse5 error `unexpected-question-mark` | XML prolog inside inline SVG | Removed XML prolog from fallback SVG |
| Netlify parse error `unexpected-character-in-attribute-name` | Large inline JS in HTML | Externalized to `uiEnhancements.ts` |
| Logo washed-out halo | White outline replaced & darkened automatically | Provide higher-res transparent PNG if needed |
| Lag on low-power devices | Canvas bevel cost | Lower board size or simplify `drawCell` (future toggle) |

---
## 12. Performance Notes
* Rendering: Board redraw each frame; optimization headroom: retain dirty region tracking or offscreen caching of piece shapes.
* Particle limits intentionally low; row Tetris FX localized (no full-screen arcs).
* Minimum gravity interval clamped (100ms) to prevent overdraw at high levels.

---
## 13. Security / Trademark Notice
No server code: purely static distribution. Avoid storing PII. "Tetris" trademark usage limited to personal demonstration—rename for any public/commercial distribution.

---
## 14. Roadmap / Backlog Ideas
| Category | Idea |
|----------|------|
| Gameplay | Hold feature UI re-enable, next-piece preview column, configurable DAS/ARR |
| Visual | Theme selector (classic / neon / grayscale), accessibility high-contrast mode |
| Audio | Soft synth SFX, music toggle, volume slider |
| UX | Settings modal, local key rebinding, mobile vibration feedback |
| PWA | Offline caching, install prompt, cloud high score sync (future backend) |
| DevOps | Electron packaging CI, release tags auto-changelog |
| QA | Integration tests for Start/pause, piece spawn, DOM event dispatch |

---
## Quick Start (Condensed)
```
npm install
npm run dev          # browser dev
npm run electron:dev  # desktop dev mode
npm run build        # production build
npm run preview      # serve dist locally
```

Then open the page, click Start, play.

---
## Changelog (Key Milestones)
| Date / Tag | Change |
|------------|--------|
| Initial | Core gameplay, bevel rendering |
| Scoring Enhancements | Added soft/hard drop scoring, Tetris bonus |
| UI Modernization | Professional scoreboard, toasts, progress bar |
| FX Simplification | Removed heavy lightning; localized row puffs |
| Build Hardening | Removed inline scripts → external modules; fixed parse5 errors |
| UI Layout Update | Uniform stat cards; centered control grid; larger logo |

---
## Known Gaps
* No integration test for DOM boot (planned addition).
* No persistent settings yet.
* Accessibility (aria labels, focus ring) minimal.

---
Feel free to start a fresh chat referencing any section heading above for focused follow-up.

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
