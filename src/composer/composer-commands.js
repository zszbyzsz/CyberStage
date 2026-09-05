import {
  ComposerCommandError, clone, getLinkEndpoints, plain,
  stableStringify, withNodePosition,
} from './composer-document.js';
import { allocate, assertState, beginConnection, commit } from './composer-state.js';

const NODE_FIELDS = new Set(['label', 'short', 'type', 'zone', 'address', 'description', 'status']);
const LINK_FIELDS = new Set(['label', 'from', 'to', 'status']);
const DOCUMENT_FIELDS = new Set(['title', 'subtitle', 'synopsis', 'objective', 'directorNote', 'theme', 'initialPhase']);
const compareId = (a, b) => String(a).localeCompare(String(b), 'en');
const equal = (a, b) => stableStringify(a) === stableStringify(b);

function findEntry(state, collection, id) {
  assertState(state);
  const entry = state.document[collection].find((item) => item.id === id);
  if (!entry) throw new ComposerCommandError(`Unknown ${collection} id: ${id}.`);
  return entry;
}

function checkedPatch(patch, fields) {
  if (!plain(patch)) throw new ComposerCommandError('An edit must be a plain object.');
  for (const key of Object.keys(patch)) {
    if (!fields.has(key)) throw new ComposerCommandError(`Field ${key} is not editable here.`);
  }
  return clone(patch);
}

function position(value) {
  if (!plain(value) || !Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new ComposerCommandError('Node coordinates must be finite numbers.');
  }
  return {
    x: Math.min(970, Math.max(30, value.x)),
    y: Math.min(590, Math.max(30, value.y)),
  };
}

function insertIndex(entries, id) {
  const index = entries.findIndex((item) => compareId(item.id, id) > 0);
  return index === -1 ? entries.length : index;
}

/** Create a schema-compatible node with deterministic identity and defaults. */
export function addNode(state, coordinates = { x: 500, y: 310 }, attributes = {}) {
  const allocation = allocate(state, 'node');
  const normalized = { ...attributes };
  if (Object.hasOwn(normalized, 'kind')) {
    normalized.type = normalized.kind;
    delete normalized.kind;
  }
  const value = withNodePosition({
    id: allocation.id, label: `Node ${allocation.ordinal}`, type: 'service',
    short: 'ND', zone: 'STAGE', address: `${allocation.id}.example`,
    description: 'A fictional system for a local simulation.', status: 'idle', x: 500, y: 310,
    ...checkedPatch(normalized, NODE_FIELDS),
  }, position(coordinates));
  return commit(state, 'Create node', [{
    type: 'insert', collection: 'nodes', index: insertIndex(state.document.nodes, value.id), value,
  }], {
    selectionAfter: { nodeIds: [value.id], linkId: null },
    interactionAfter: { mode: 'select', connectFrom: null },
    sequenceAfter: { node: allocation.next },
  });
}

export function updateNode(state, id, patch) {
  const before = findEntry(state, 'nodes', id);
  const after = { ...before, ...checkedPatch(patch, NODE_FIELDS) };
  if (equal(before, after)) return state;
  return commit(state, 'Edit node', [{ type: 'update', collection: 'nodes', before, after }]);
}

/** All positions in a gesture form one reversible transaction. */
export function moveNodes(state, positions) {
  assertState(state);
  if (!(positions instanceof Map)) throw new ComposerCommandError('Movement requires a Map of node positions.');
  const steps = [...positions].sort(([a], [b]) => compareId(a, b)).flatMap(([id, coordinates]) => {
    const before = findEntry(state, 'nodes', id);
    const after = withNodePosition(before, position(coordinates));
    return equal(before, after) ? [] : [{ type: 'update', collection: 'nodes', before, after }];
  });
  return commit(state, `Move ${steps.length} node${steps.length === 1 ? '' : 's'}`, steps);
}

export function connectNodes(state, from, to) {
  findEntry(state, 'nodes', from);
  findEntry(state, 'nodes', to);
  if (from === to) throw new ComposerCommandError('A node cannot connect to itself.');
  if (state.document.links.some((link) => link.from === from && link.to === to)) {
    throw new ComposerCommandError('This connection already exists.');
  }
  const allocation = allocate(state, 'link');
  const value = { id: allocation.id, from, to, label: 'SIGNAL', status: 'idle' };
  return commit(state, 'Connect nodes', [{
    type: 'insert', collection: 'links', index: insertIndex(state.document.links, value.id), value,
  }], {
    selectionAfter: { nodeIds: [], linkId: value.id },
    interactionAfter: { mode: 'select', connectFrom: null },
    sequenceAfter: { link: allocation.next },
  });
}

export function chooseConnectionNode(state, id) {
  return state.interaction.connectFrom
    ? connectNodes(state, state.interaction.connectFrom, id)
    : beginConnection(state, id);
}

export function updateLink(state, id, patch) {
  const before = findEntry(state, 'links', id);
  const after = { ...before, ...checkedPatch(patch, LINK_FIELDS) };
  if (equal(before, after)) return state;
  return commit(state, 'Edit link', [{ type: 'update', collection: 'links', before, after }]);
}

export function updateDocumentField(state, key, value) {
  assertState(state);
  if (!DOCUMENT_FIELDS.has(key)) throw new ComposerCommandError(`Document field ${key} is not editable here.`);
  if (state.document[key] === value) return state;
  const step = { type: 'replace', key, after: clone(value) };
  if (Object.hasOwn(state.document, key)) step.before = clone(state.document[key]);
  return commit(state, 'Edit document', [step]);
}

/** Incident edges AND timeline references are removed atomically with nodes. */
export function deleteSelection(state) {
  assertState(state);
  const nodeIds = new Set(state.selection.nodeIds);
  const linkIds = new Set(state.document.links.filter((link) => {
    const { from, to } = getLinkEndpoints(link);
    return link.id === state.selection.linkId || nodeIds.has(from) || nodeIds.has(to);
  }).map((link) => link.id));
  const steps = [];
  for (const [collection, ids] of [['links', linkIds], ['nodes', nodeIds]]) {
    for (let index = state.document[collection].length - 1; index >= 0; index -= 1) {
      const value = state.document[collection][index];
      if (ids.has(value.id)) steps.push({ type: 'remove', collection, index, value });
    }
  }
  if (Array.isArray(state.document.events)) {
    const before = state.document.events;
    const after = before.map((event) => {
      const next = clone(event);
      if (Array.isArray(next.nodes)) next.nodes = next.nodes.filter((entry) => !nodeIds.has(entry.id));
      if (Array.isArray(next.links)) next.links = next.links.filter((entry) => !linkIds.has(entry.id));
      if (next.flow && (nodeIds.has(next.flow.from) || nodeIds.has(next.flow.to))) delete next.flow;
      return next;
    });
    if (!equal(before, after)) steps.push({ type: 'replace', key: 'events', before, after });
  }
  return commit(state, 'Delete selection', steps, {
    selectionAfter: { nodeIds: [], linkId: null },
    interactionAfter: { mode: 'select', connectFrom: null },
  });
}
