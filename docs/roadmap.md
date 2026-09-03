# Roadmap

CyberStage will remain a **cinematic simulation and authoring project**. The roadmap improves visual composition, reproducibility, accessibility, and output quality—not offensive capability.

## v0.1 — Interactive stage

Status: **implemented**

- dependency-free browser runtime;
- deterministic timeline engine;
- SVG topology and signal particles;
- node, link, metric, caption, feed, and console cues;
- three built-in fictional scenarios;
- director transport controls and keyboard shortcuts;
- Broadcast Mode and fullscreen;
- locally synthesized optional sound cues;
- timestamped scene links;
- local JSON import;
- safety validator, CSP, capability guard, and tests;
- static build and GitHub Pages workflow.

## v0.2 — Scene Composer

The next release should make authoring visual rather than JSON-first.

### Canvas

- drag, align, group, duplicate, and delete nodes;
- link creation with route previews;
- safe-area and camera-frame guides;
- node label collision hints;
- keyboard-accessible selection and movement.

### Timeline

- multi-track event editor;
- drag-to-retime cues;
- metric curves and state lanes;
- caption and console preview;
- overlapping flow visualization;
- snapping, markers, and named beats.

### Project editing

- undo/redo transaction history;
- autosave to local browser storage;
- import and export JSON;
- schema-aware property inspector;
- human-readable validation diagnostics;
- reusable node and scene presets.

## v0.3 — Cinematic output

- fixed-frame deterministic render mode;
- local still-image export;
- browser-native recording flow where supported;
- transparent topology overlay mode;
- title cards and lower thirds;
- safe-area presets for 16:9, 9:16, 1:1, and ultrawide screens;
- subtitle and caption export;
- color-contrast presets for projection and camera capture.

No cloud render service is planned for the core project.

## v0.4 — Scene packs and visual systems

- declarative theme packs;
- fictional environment packs such as newsroom, orbital station, research lab, and emergency operations center;
- icon and node-shape packs using reviewed static SVG;
- localized narratives;
- versioned scene-pack manifest;
- gallery generated from repository-owned, safety-reviewed data.

Scene packs remain data and static assets. Arbitrary JavaScript plugins are not planned.

## v0.5 — Education and production workflow

- presenter notes attached to cues;
- optional learning prompts explaining defensive reasoning;
- scene annotations for actors and editors;
- shot-list export;
- synchronized secondary display using an explicit local-only design that preserves the safety model;
- accessibility narration and non-color state encoding.

The synchronization design requires a separate threat-model review before implementation.

## Long-term quality goals

- stable scenario schema with migration tooling;
- deterministic visual regression fixtures;
- WCAG 2.2 AA interaction and contrast coverage;
- performance budgets for low-power devices;
- browser support policy;
- release signing and provenance for static artifacts;
- a contributor-maintained library of high-quality fictional scenes.

## Explicit non-goals

The following do not belong on the roadmap:

- vulnerability exploitation;
- credential capture or testing;
- network discovery or scanning;
- packet crafting or replay against interfaces;
- command execution;
- remote agents;
- live target import;
- evasion or persistence behavior;
- integrations that turn a visual scene into an operational playbook.

Requests in these categories should be declined or reframed as inert visual cues.
