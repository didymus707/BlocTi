# BlocTi in mixed reality

A small, hands-first version of BlocTi for a headset. You sit at your desk, put
the block on it, pick a plan, and work through its steps as cards within arm's
reach. When the block ends, the conformance report appears above the desk: the
score, the verdict and every deviation, in the same words as the web app. The
verdicts of your last sessions are kept, so you can see whether you follow your
own plans.

It runs the BlocTi engine from `frontend/src/sei` unchanged. Only the spatial
layer is new.

## Use it

1. Open the page on a Quest and enter mixed reality.
2. The block appears in front of you. Pinch it and drag it onto your desk; it
   drops onto the surface and turns to face you. Next session it is back on
   the same spot.
3. Pinch a plan: a 10-minute reset, 25 minutes of deep work, or a release
   checklist (order enforced, one critical step).
4. On each card, pinch Start, Done or Skip. The timer above the block shows the
   step in focus. Pause and End block are on the timer.
5. When the last step is done (or you end the block), read the report.

Everything is pinch along the hand's ray; controllers work too. Nothing needs
typing, standing or walking. Without a headset the page still shows the panels
and you can click them.

## Run it

```bash
cd vr
npm install
npm run dev        # dev server + emulated Quest 3 at https://localhost:8092
npm test           # the pure glue in src/bloc
npm run typecheck
npm run build      # static site in dist/
```

The dev server uses a self-signed certificate (WebXR needs https). To try it on
a headset on the same network, open the `Network` URL it prints and accept the
certificate warning.

## Layout

```
src/bloc/    pure TypeScript, tested with Vitest; no 3D code
  engine.ts      the one import of the BlocTi engine from ../frontend
  templates.ts   the three plans
  controls.ts    what a pinch means: control -> engine commands
  run.ts         plan + events, applied, projected, saved to localStorage
  view.ts        what each panel says
  history.ts     one line per finished block, and the trend
  placement.ts   spawn, drop onto a surface, saved pose
  layout.ts      where each panel sits around the block
src/xr/      the spatial layer (Immersive Web SDK systems)
  placement-system.ts   the block, the anchor, dropping onto the desk
  bloc-system.ts        panels <-> engine
public/ui/   the four panels, as UIKitML
```

Data stays in the browser (localStorage). There is no backend.

## Deploy

`.github/workflows/vr-pages.yml` builds and publishes `vr/dist` to GitHub Pages
on pushes to `development`. Turn Pages on first: Settings, Pages, Source:
GitHub Actions.
