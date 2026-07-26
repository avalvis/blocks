# blocks

A minimal, colorful falling-block arcade game built with React, TypeScript, Canvas, and the Web Audio API.

## Run locally

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:4173`.

## Commands

- `npm run dev` — start the Vite development server
- `npm run typecheck` — run strict TypeScript checks
- `npm test` — run deterministic engine and persistence tests
- `npm run test:e2e` — run Playwright browser flows
- `npm run build` — create the production bundle in `dist`

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | Arrow Left/Right or A/D | Buttons or horizontal swipe |
| Soft drop | Arrow Down or S | Down button or downward drag |
| Rotate clockwise | Arrow Up, W, or X | Rotate button or board tap |
| Rotate counter-clockwise | Z or Q | Counter-clockwise button |
| Hard drop | Space | Hard-drop button or upward flick |
| Hold | C or Shift | Hold button |
| Pause | P or Escape | Header pause button |

## Architecture

- `src/engine` contains the deterministic rules engine, piece definitions, seven-bag generator, SRS wall kicks, scoring, and state machine.
- `src/render` draws the visible 10×20 board at device pixel ratio while the engine retains two hidden spawn rows.
- `src/lib/audio.ts` creates the original synth loop and effects at runtime; there are no copied audio assets.
- `src/lib/storage.ts` manages a versioned, failure-tolerant local save containing the high score and preferences.
- `src/App.tsx` owns accessible UI, input repeat timing, gestures, overlays, and the animation loop.

The reference material under `prototype/` is intentionally unchanged.
