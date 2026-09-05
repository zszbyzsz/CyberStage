# Scene Composer architecture

The first Scene Composer slice is deliberately split into three boundaries:

1. **Scenario document** — canonical, JSON-only scene data that can be handed to the rest of CyberStage.
2. **Composer state** — scenario document plus selection, interaction mode, deterministic counters, and explicit undo/redo history.
3. **View state** — pointer coordinates and drag previews that exist only while an interaction is active and are never serialized into a scenario.

## Deterministic document contract

`composer-document.js` canonicalizes object keys and topology ordering, normalizes finite geometry, and validates identifiers and link references. Scenario export always uses the canonical form and ends with one newline. Import canonicalizes and validates before a new composer state is created.

The browser export command performs:

```text
current document
  -> safety boundary
  -> canonical JSON A
  -> import
  -> safety boundary
  -> canonical JSON B
  -> require A === B
  -> download
```

This makes an export that cannot survive its own importer impossible to download from the Composer UI.

## Transaction contract

Every persistent edit is a transaction with:

- deterministic `tx-####` identity;
- a human-readable label;
- one or more explicit `insert`, `remove`, `update`, or document-field `replace` steps;
- selection and interaction state before and after the edit.

Undo applies the steps in reverse order. Redo reapplies them in forward order. A new transaction clears the redo stack. Drag previews do not create transactions; pointer release commits all moved nodes as one transaction.

Node deletion records incident-link removals and node removals in one transaction. This means validation never observes a committed state with dangling links, and undo can restore the topology in dependency-safe order.

## Safety boundary

The Composer validates plain JSON shape, finite numbers, depth and size limits, unique identifiers, valid link endpoints, reserved object keys, and active-content strings. `composer-safety.js` also uses a recognized validator exported by the existing `src/scenario.js` surface when present. The repository `guard` remains mandatory because `npm run check` executes it before tests and build.

Imported labels are written with DOM text nodes and element properties. The editor does not insert imported strings through HTML parsing APIs.

## Extension rule for later #3 slices

Timeline authoring, groups, palette templates, bulk properties, and playback handoff must add commands that produce the same transaction steps. They must not mutate `state.document` from a view component. New transient gestures belong beside drag preview state, not in the exported scenario document.

## Verification

Run:

```bash
npm run check
```

The command executes the existing repository guard, Node tests, the original static build, and the Scene Composer build copy. The resulting editor entry is `dist/composer.html`.
