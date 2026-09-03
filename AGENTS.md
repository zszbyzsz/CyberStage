# AGENTS.md

Guidance for automated coding agents and contributors working in this repository.

## Mission

CyberStage is a cinematic, simulation-only network-defense visualizer. Improve storytelling, authoring, accessibility, rendering, testing, and deterministic playback. Do not add operational offensive capability.

## Non-negotiable runtime invariants

- Keep `connect-src 'none'` in the production CSP.
- Do not add network transport APIs to `src/`.
- Do not add shell, process, native, or command-execution bridges.
- Do not interpret scene data as JavaScript, HTML, CSS, selectors, URLs, or templates.
- Keep imported scenes declarative JSON and validate before rendering.
- Use only documentation-reserved identifiers in examples and built-in scenes.
- Escape every scene-provided string interpolated into HTML or SVG.
- Do not add remote fonts, analytics, scripts, images, or CDNs.

## Architecture rules

- Keep core timing and frame derivation DOM-independent.
- Prefer pure functions and deterministic state reduction.
- Put built-in scene data in `src/data/scenarios.js`.
- Put safety policy in `src/core/safety.js`.
- Put generated markup in `src/ui/render.js` and use the shared escape helper.
- Keep browser orchestration in `src/app.js`.
- Avoid dependencies unless a design issue establishes a compelling need and supply-chain review.

## Required checks

Run this after relevant changes:

```bash
npm run check
```

Add or update tests when changing timeline behavior, validation, geometry, URL state, or scene semantics.

## Review questions

Before completing a change, verify:

1. Can the same scene and timestamp still reproduce the same frame?
2. Does imported text remain inert?
3. Does the runtime remain unable to initiate network activity?
4. Are keyboard navigation, focus, reduced motion, and readable contrast preserved?
5. Does the change make scenes more expressive without making attacks more actionable?
