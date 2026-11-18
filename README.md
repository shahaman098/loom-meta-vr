# Loom

A seated, hands-only weaving game for Meta VR, built with the
[Immersive Web SDK](https://iwsdk.dev/) (IWSDK) for the **Meta VR Start
Developer Competition 2026**.

**Play:** https://loom-meta-vr.pages.dev

Loom puts a small walnut loom on the table in front of you, strung with 25 brass
pegs. Pinch a peg, pull a glowing thread to another peg, and release. The thread
snaps into place and stays woven into the board. Each pattern card asks for a few
connected threads; finish it and the tapestry flashes with a chord, then the next
card adds a harder shape. After three cards the board opens into Free Weave.

- Hands only: no controllers, menus, locomotion, or buttons in VR
- Seated: every peg sits inside a two-foot reach
- Runs in Meta Quest Browser and Meta VR Glasses Browser (WebXR)
- Procedural art and synthesized audio: no downloaded models or textures

## Controls

| Action | Input |
|---|---|
| Pinch a peg | Hand pinch (or controller squeeze) |
| Pull a thread | Move your hand while pinched |
| Anchor a thread | Release near another peg |
| Enter VR | **Enter VR** button on the page |

## Run locally

```sh
npm install
npm run dev        # managed dev server + XR emulator (opens a browser)
npm run typecheck
npm run build
npm run preview
```

`npm run dev` starts the IWSDK managed workspace and the IWER XR emulator. Use
the emulator toolbar to switch between controllers and hands; the game is played
with hand pinch. `npm run dev:down` stops the session.

## Deploy

The production build is a static site in `dist/`:

```sh
npm run build
npx wrangler pages deploy dist --project-name loom-meta-vr --branch main
```

`wrangler.toml` sets the Pages project and output directory. The live site is
https://loom-meta-vr.pages.dev.

## How it works

- `src/scene-assets/loom.scene-asset.ts` — table, frame, warp, pegs, card, floor
- `src/loom.ts` — peg targeting, live thread, woven segments, pattern cards,
  completion, Free Weave, Web Audio plucks and chords
- `src/entry.ts` — the 2D **Enter VR** screen required by WebXR's user gesture
- `src/components.ts` — `Peg` grid coordinates and observable `LoomStatus`
- `public/scenes/main.iwsdk.scene.json` — authored composition and lighting

The fingertip is the cursor: a pinch selects the nearest peg to the hand, so the
thread starts where the player aims rather than where a grab collider happened to
land. Woven cords are lifted just in front of the peg tips so they read against
the felt. Pattern cards are painted to a `CanvasTexture` at runtime; audio is
synthesized with the Web Audio API.

## Evidence

Screenshots and verified state transitions are in the parent workspace at
`AI Meta/meta-vr-start-2026/evidence/`, and the submission copy is in
`AI Meta/meta-vr-start-2026/SUBMISSION.md`.

Built with IWSDK 1.1.0, Three.js r185, TypeScript, and Vite.
