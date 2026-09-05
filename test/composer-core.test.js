import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ComposerValidationError,
  canonicalizeScenario,
  createStarterScenario,
  exportScenario,
  getLinkEndpoints,
  getNodePosition,
  importScenario,
  stableStringify,
  validateDocument,
} from '../src/composer/composer-document.js';
import {
  createComposerState,
  deserializeComposerState,
  redo,
  selectLink,
  selectNode,
  serializeComposerState,
  undo,
} from '../src/composer/composer-state.js';
import {
  addNode,
  connectNodes,
  deleteSelection,
  moveNodes,
  updateNode,
} from '../src/composer/composer-commands.js';
import { validateScenarioBoundary } from '../src/composer/composer-safety.js';

function topology(state) {
  return {
    nodes: state.document.nodes,
    links: state.document.links,
  };
}

test('canonicalization produces stable key and topology order', () => {
  const source = {
    links: [
      { to: 'b', id: 'link-002', from: 'a' },
      { from: 'b', to: 'a', id: 'link-001' },
    ],
    nodes: [
      { position: { y: 20, x: 40 }, label: 'B', id: 'b' },
      { label: 'A', id: 'a', position: { x: 10, y: 30 } },
    ],
    title: 'Stable',
    id: 'stable',
  };
  const canonical = canonicalizeScenario(source);
  assert.deepEqual(canonical.nodes.map((node) => node.id), ['a', 'b']);
  assert.deepEqual(canonical.links.map((link) => link.id), ['link-001', 'link-002']);
  assert.equal(stableStringify(canonical), stableStringify(canonicalizeScenario(JSON.parse(stableStringify(canonical)))));
});

test('composer state is serializable and restores byte-for-byte', () => {
  const state = createComposerState();
  const serialized = serializeComposerState(state);
  const restored = deserializeComposerState(serialized);
  assert.deepEqual(restored, state);
  assert.equal(serializeComposerState(restored), serialized);
});

test('node allocation is deterministic and committed as an explicit transaction', () => {
  const initial = createComposerState();
  const next = addNode(initial, { x: 330, y: 410 });
  const added = next.document.nodes.find((node) => node.id === 'node-004');
  assert.ok(added);
  assert.deepEqual(getNodePosition(added), { x: 330, y: 410 });
  assert.equal(next.history.undo.length, 1);
  assert.equal(next.history.undo[0].id, 'tx-0001');
  assert.equal(next.history.undo[0].steps[0].type, 'insert');
  assert.equal(next.sequence.node, 5);
});

test('a multi-node drag is one transaction and undo/redo is exact', () => {
  let state = createComposerState();
  state = selectNode(state, 'node-001');
  state = selectNode(state, 'node-002', { additive: true, toggle: false });
  const before = topology(state);
  state = moveNodes(state, new Map([
    ['node-001', { x: 210, y: 250 }],
    ['node-002', { x: 500, y: 360 }],
  ]));
  const moved = topology(state);
  assert.equal(state.history.undo.at(-1).steps.length, 2);
  assert.match(state.history.undo.at(-1).label, /^Move 2 nodes$/);
  state = undo(state);
  assert.deepEqual(topology(state), before);
  state = redo(state);
  assert.deepEqual(topology(state), moved);
});

test('connecting nodes is reversible and uses deterministic ids', () => {
  const initial = createComposerState();
  const connected = connectNodes(initial, 'node-001', 'node-003');
  const link = connected.document.links.find((entry) => entry.id === 'link-003');
  assert.deepEqual(getLinkEndpoints(link), { from: 'node-001', to: 'node-003' });
  assert.equal(connected.history.undo.at(-1).id, 'tx-0001');
  assert.equal(connected.history.undo.at(-1).steps[0].type, 'insert');
  assert.deepEqual(topology(redo(undo(connected))), topology(connected));
});

test('deleting a node and incident links is one reversible transaction', () => {
  let state = createComposerState();
  const original = topology(state);
  state = selectNode(state, 'node-002');
  state = deleteSelection(state);
  assert.equal(state.document.nodes.some((node) => node.id === 'node-002'), false);
  assert.equal(state.document.links.length, 0);
  const transaction = state.history.undo.at(-1);
  assert.equal(transaction.id, 'tx-0001');
  assert.deepEqual(transaction.steps.map((step) => step.type), ['remove', 'remove', 'remove']);
  state = undo(state);
  assert.deepEqual(topology(state), original);
  state = redo(state);
  assert.equal(state.document.nodes.some((node) => node.id === 'node-002'), false);
  assert.equal(state.document.links.length, 0);
});

test('deleting one selected link leaves nodes untouched', () => {
  let state = createComposerState();
  state = selectLink(state, 'link-001');
  state = deleteSelection(state);
  assert.equal(state.document.nodes.length, 3);
  assert.deepEqual(state.document.links.map((link) => link.id), ['link-002']);
  assert.equal(state.history.undo.at(-1).steps.length, 1);
  assert.equal(undo(state).document.links.length, 2);
});

test('a divergent edit clears redo while retaining monotonic transaction ids', () => {
  let state = addNode(createComposerState(), { x: 300, y: 300 });
  state = undo(state);
  assert.equal(state.history.redo.length, 1);
  state = updateNode(state, 'node-001', { label: 'Renamed' });
  assert.equal(state.history.redo.length, 0);
  assert.equal(state.history.undo.at(-1).id, 'tx-0002');
});

test('scenario export re-import is byte-identical', () => {
  let state = createComposerState();
  state = addNode(state, { x: 390, y: 440 }, { label: 'Observer', kind: 'sensor' });
  state = connectNodes(state, 'node-003', 'node-004');
  const first = exportScenario(state.document);
  const imported = importScenario(first);
  const second = exportScenario(imported);
  assert.equal(second, first);
  assert.deepEqual(imported, state.document);
});

test('full composer state including history survives serialization', () => {
  let state = createComposerState();
  state = addNode(state, { x: 390, y: 440 });
  state = updateNode(state, 'node-004', { label: 'Serializable' });
  state = undo(state);
  const serialized = serializeComposerState(state);
  const restored = deserializeComposerState(serialized);
  assert.equal(serializeComposerState(restored), serialized);
  assert.equal(restored.history.undo.length, 1);
  assert.equal(restored.history.redo.length, 1);
  assert.deepEqual(redo(restored).document.nodes.find((node) => node.id === 'node-004').label, 'Serializable');
});

test('shape validation rejects duplicate ids and dangling links', () => {
  const invalid = createStarterScenario();
  invalid.nodes[1].id = invalid.nodes[0].id;
  invalid.links[0].to = 'missing-node';
  const report = validateDocument(invalid);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((error) => error.includes('Duplicate node id')));
  assert.ok(report.errors.some((error) => error.includes('missing target node')));
  assert.throws(() => exportScenario(invalid), ComposerValidationError);
});

test('active content is rejected before repository safety validation', async () => {
  const unsafe = createStarterScenario();
  unsafe.nodes[0].label = 'javascript:alert(1)';
  const report = await validateScenarioBoundary(unsafe);
  assert.equal(report.ok, false);
  assert.deepEqual(report.checkedBy, ['composer-document']);
  assert.ok(report.errors.some((error) => error.includes('active content')));
});

test('repository safety boundary is part of every import/export decision', async () => {
  const report = await validateScenarioBoundary(createStarterScenario());
  assert.ok(Array.isArray(report.checkedBy));
  assert.ok(report.checkedBy.includes('composer-document'));
  assert.ok(report.checkedBy.includes('repository-guard'));
  if (!report.ok) assert.ok(report.errors.length > 0);
});
