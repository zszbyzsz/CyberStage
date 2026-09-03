# Changelog

All notable changes to CyberStage will be documented in this file.

The project follows [Semantic Versioning](https://semver.org/) for published releases.

## [Unreleased]

### Added

- Cinematic Command Wall with a phase rail, pressure/defense lanes, protected-system deck, detailed telemetry, captions, and previous/current/next cue framing.
- Five synchronized camera treatments: Auto, Overview, Contest, Containment, and Recovery.
- Dedicated large-screen treatments for Control Plane Eclipse, Cipher Furnace, and Blackout Ledger, with a generic wall available to every built-in scene.
- Deep-linkable wall and shot state plus `W` and `V` director shortcuts.
- Realistic Computer Scene Pack with six defensive incident stories: Cipher Furnace, Control Plane Eclipse, Blackout Ledger, Phantom Inbox, Traffic Avalanche, and Glass Supply Chain.
- Narrative-safety validation that rejects structured operational fields such as commands, executable payloads, live targets, credentials, and ports.
- A scene catalogue documenting each built-in story, its visual arc, and its safety boundary.

### Planned

- Visual Scene Composer.
- Local scene export and undo/redo.
- Deterministic capture workflow.

## [0.1.0] — 2026-09-03

### Added

- Dependency-free browser application and static build.
- Deterministic `StageClock`, scenario compiler, and frame derivation engine.
- Three cinematic scenes: Ghost Relay, Aurora Lockdown, and Midnight Switchboard.
- Animated SVG topology, synthetic telemetry, incident feed, event console, and node inspector.
- Director controls, keyboard shortcuts, Broadcast Mode, fullscreen, URL state, and local sound cues.
- Local JSON scene import and published scenario schema.
- Simulation-only validator, reserved-address policy, strict CSP, and source capability guard.
- Automated engine and safety tests.
- Contributor documentation, issue templates, and GitHub Pages workflow.
