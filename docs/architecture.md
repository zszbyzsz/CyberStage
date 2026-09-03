# Architecture

CyberStage is deliberately small: a static browser application, a deterministic scene engine, and a strict safety validator. There is no application server and no runtime dependency installation.

## Design goals

1. **Cinematic clarity** — the interface should read immediately on a screen, projector, stream, or camera.
2. **Deterministic playback** — the same scene and timestamp must produce the same visual state.
3. **Simulation-only capability** — visual authenticity must not require live transport or command execution.
4. **Low contribution barrier** — contributors can add a scene with JSON and validate it using Node.js alone.
5. **Portable deployment** — the production artifact is a directory of static files.

## Module map

```text
index.html
  └── src/app.js                 browser orchestration and input handling
       ├── src/core/engine.js    clock, compilation, frame derivation, geometry
       ├── src/core/safety.js    scenario validation and reserved-identifier policy
       ├── src/data/scenarios.js built-in scenes
       └── src/ui/render.js      escaped HTML/SVG render functions

scripts/check.mjs                capability guard + syntax + scene validation
scripts/build.mjs                dependency-free static build
scripts/serve.mjs                local development server with security headers
```

## Event-sourced scene engine

The application never incrementally mutates a shared incident object. Instead, `deriveFrame(scene, timeMs)` starts from scene defaults and reduces every event up to `timeMs` into a fresh frame:

```text
(scene, 45_000 ms)
       │
       ▼
initial metrics + node state + link state
       │
       ▼
apply event 0
apply event 1
...
apply event N
       │
       ▼
Frame {
  phase,
  caption,
  metrics,
  nodeStates,
  linkStates,
  pulses,
  logs,
  feed
}
```

For the current scene sizes—fewer than 240 events—this full reduction is inexpensive and has useful properties:

- seeking backward needs no rollback logic;
- replay and URL timestamps are reproducible;
- unit tests can assert a frame at any point in time;
- imported scenes cannot retain hidden mutable runtime state;
- future recording can request exact frames on a fixed time step.

A later version may add compiled checkpoints for very long scenes while preserving the same pure API.

## Playback clock

`StageClock` owns only four pieces of mutable state:

- current time;
- playing or paused state;
- speed;
- loop behavior.

It does not call browser timing APIs itself. The application supplies elapsed time from `requestAnimationFrame`, while unit tests supply exact deltas. This keeps timing logic independent from the UI.

## Rendering

`src/ui/render.js` produces small HTML or SVG fragments from a validated frame. User-provided scene strings are escaped before interpolation. The renderer does not load images, query external services, or evaluate scene code.

The topology uses a fixed `1000 × 620` coordinate system. This makes scene coordinates stable across display sizes. CSS scales the SVG responsively, and cubic Bézier functions place signal particles along links.

## Runtime boundaries

The production runtime contains:

- static HTML;
- one local stylesheet;
- browser-native ES modules;
- local SVG assets;
- optional browser-generated audio.

It intentionally does not contain:

- a backend;
- a package manager runtime;
- socket or peer connections;
- remote fonts, images, scripts, analytics, or telemetry;
- shell, process, filesystem, or native-code bridges;
- executable content inside scene files.

## Build and deployment

`npm run build` copies the approved runtime files to `dist/` and adds `.nojekyll`. GitHub Pages deploys only that directory. Tests, examples, governance documents, and scripts remain in the repository but are not shipped as runtime application files.

## Extension direction

New features should enter through one of four explicit seams:

1. **Scene schema** — new declarative visual cues.
2. **Pure engine state** — additional deterministic frame data.
3. **Renderer** — new visual representations of frame data.
4. **Director UI** — local authoring and playback controls.

A proposed feature that requires arbitrary scene code, live network access, or command execution does not fit the CyberStage architecture.
