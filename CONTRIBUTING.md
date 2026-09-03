# Contributing to CyberStage

Thank you for helping make network-defense storytelling more cinematic, understandable, and safe.

CyberStage welcomes code, design, writing, accessibility review, documentation, fictional scenes, translations, and tests.

## Before contributing

Read these documents first:

- [`docs/safety-model.md`](./docs/safety-model.md)
- [`docs/architecture.md`](./docs/architecture.md)
- [`AGENTS.md`](./AGENTS.md)

The simulation-only boundary is a project invariant, not an optional style preference. A contribution that adds live transport, scanning, command execution, real targets, or actionable attack instructions will not be accepted.

## Development setup

CyberStage has no runtime packages to install. Use Node.js 22 or newer:

```bash
git clone https://github.com/zszbyzsz/CyberStage.git
cd CyberStage
npm start
```

Before opening a pull request:

```bash
npm run check
```

This command runs the capability guard, syntax checks, scenario validation, unit tests, and static build.

## Good first contributions

- Add a fictional scene that follows the existing defensive story arc.
- Improve keyboard or screen-reader behavior.
- Reduce label collisions at narrow viewport sizes.
- Add tests for timeline boundaries or validation errors.
- Clarify a document or translate it.
- Propose a visual theme using only repository-owned static assets.
- Review colors and state indicators for accessibility.

## Adding a scene

1. Copy [`examples/minimal-scene.json`](./examples/minimal-scene.json).
2. Read [`docs/scenario-format.md`](./docs/scenario-format.md).
3. Keep all organizations, people, logs, and incidents fictional.
4. Use only the documented reserved address ranges.
5. Import the JSON locally and watch the complete timeline.
6. Run `npm run check`.
7. Include the narrative purpose and intended audience in the pull request.

A strong scene should teach or dramatize defensive observation, correlation, containment, verification, or recovery. It should not explain how to compromise a system.

## Code expectations

- Prefer small browser-native modules over dependencies.
- Keep the engine deterministic and DOM-independent.
- Validate before rendering.
- Escape every scene-provided string used in generated markup.
- Preserve the Content Security Policy.
- Add tests for behavioral changes.
- Avoid visual motion that cannot be disabled by `prefers-reduced-motion`.
- Use semantic controls and visible keyboard focus.

## Commit and pull request style

Use a concise conventional prefix where practical:

```text
feat: add scene composer node selection
fix: preserve timeline state after scene change
docs: clarify reserved identifiers
test: cover wrapped event playback
chore: update pinned workflow action
```

A pull request should explain:

- what changes visually or behaviorally;
- why it belongs in a simulation-only project;
- how it was tested;
- whether it changes the scene schema or safety model;
- screenshots or a short recording for visible changes.

## Design discussions

Open an issue before implementing a large schema change, rendering subsystem, recording pipeline, or synchronization feature. Design discussions should identify trust boundaries and preserve deterministic playback.

## Community standards

Participation is governed by [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md). Be direct about technical risks while remaining respectful toward contributors.
