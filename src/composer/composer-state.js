import {
  COMPOSER_HISTORY_LIMIT,
  COMPOSER_STATE_VERSION,
  ComposerCommandError,
  ComposerValidationError,
  STEP_TYPES,
  canonicalizeScenario,
  clone,
  createStarterScenario,
  pad,
  plain,
  stableStringify,
  validateDocument,
} from './composer-document.js';

function nextOrdinal(entries, prefix) {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  let next = 1;
  for (const entry of entries) {
    const match = pattern.exec(String(entry.id ?? ''));
    if (match) next = Math.max(next, Number(match[1]) + 1);
  }
  return next;
}

function normalizeSelection(document, selection = {}) {
  const order = new Map(document.nodes.map((node, index) => [node.id, index]));
  const nodeIds = [...new Set(selection.nodeIds ?? [])]
    .filter((id) => order.has(id))
    .sort((left, right) => order.get(left) - order.get(right));
  const linkId = nodeIds.length === 0 && document.links.some((link) => link.id === selection.linkId)
    ? selection.linkId
    : null;
  return { nodeIds, linkId };
}

export function createComposerState(source = createStarterScenario()) {
  const document = canonicalizeScenario(source);
  const report = validateDocument(document);
  if (!report.ok) throw new ComposerValidationError(report.errors);
  return {
    version: COMPOSER_STATE_VERSION,
    document,
    selection: { nodeIds: [], linkId: null },
    interaction: { mode: 'select', connectFrom: null },
    history: { undo: [], redo: [] },
    sequence: {
      transaction: 1,
      node: nextOrdinal(document.nodes, 'node'),
      link: nextOrdinal(document.links, 'link'),
    },
  };
}

export function assertState(state) {
  if (!plain(state) || state.version !== COMPOSER_STATE_VERSION) {
    throw new ComposerCommandError(`Unsupported composer state version; expected ${COMPOSER_STATE_VERSION}.`);
  }
  if (!plain(state.document) || !plain(state.selection) || !Array.isArray(state.selection.nodeIds)) {
    throw new ComposerCommandError('Composer state is missing a valid document or selection.');
  }
  if (!plain(state.interaction) || !['select', 'connect'].includes(state.interaction.mode)) {
    throw new ComposerCommandError('Composer state has an invalid interaction mode.');
  }
  if (!plain(state.history) || !Array.isArray(state.history.undo) || !Array.isArray(state.history.redo)) {
    throw new ComposerCommandError('Composer state has an invalid transaction history.');
  }
  if (!plain(state.sequence) || !['transaction', 'node', 'link'].every((key) => Number.isInteger(state.sequence[key]) && state.sequence[key] > 0)) {
    throw new ComposerCommandError('Composer state has invalid deterministic counters.');
  }
}

function assertTransaction(transaction) {
  const valid = plain(transaction)
    && typeof transaction.id === 'string'
    && typeof transaction.label === 'string'
    && Array.isArray(transaction.steps)
    && transaction.steps.every((step) => plain(step) && STEP_TYPES.has(step.type));
  if (!valid) throw new ComposerCommandError('Transaction data is invalid.');
}

export function serializeComposerState(state) {
  assertState(state);
  return stableStringify(state);
}

export function deserializeComposerState(serialized) {
  let parsed;
  try {
    parsed = JSON.parse(serialized);
  } catch (error) {
    throw new ComposerCommandError(`Composer state is not valid JSON: ${error.message}`);
  }
  assertState(parsed);
  parsed.history.undo.forEach(assertTransaction);
  parsed.history.redo.forEach(assertTransaction);
  const document = canonicalizeScenario(parsed.document);
  const report = validateDocument(document);
  if (!report.ok) throw new ComposerValidationError(report.errors);
  return {
    ...clone(parsed),
    document,
    selection: normalizeSelection(document, parsed.selection),
  };
}

function collection(document, name) {
  if (!['nodes', 'links'].includes(name) || !Array.isArray(document[name])) {
    throw new ComposerCommandError(`Unsupported transaction collection: ${name}.`);
  }
  return document[name];
}

function applyStep(document, step, direction) {
  const next = clone(document);
  if (step.type === 'replace') {
    if (!Object.hasOwn(step, 'key') || ['nodes', 'links'].includes(step.key)) {
      throw new ComposerCommandError('replace steps must target a non-topology document field.');
    }
    if (direction === 'do') {
      if (step.after === undefined) delete next[step.key];
      else next[step.key] = clone(step.after);
    } else if (step.before === undefined) delete next[step.key];
    else next[step.key] = clone(step.before);
    return next;
  }

  const list = [...collection(next, step.collection)];
  if (step.type === 'insert') {
    if (direction === 'do') list.splice(step.index, 0, clone(step.value));
    else {
      const [removed] = list.splice(step.index, 1);
      if (removed?.id !== step.value.id) throw new ComposerCommandError(`Transaction expected ${step.value.id}.`);
    }
  } else if (step.type === 'remove') {
    if (direction === 'do') {
      const [removed] = list.splice(step.index, 1);
      if (removed?.id !== step.value.id) throw new ComposerCommandError(`Transaction expected ${step.value.id}.`);
    } else list.splice(step.index, 0, clone(step.value));
  } else if (step.type === 'update') {
    const replacement = direction === 'do' ? step.after : step.before;
    const expected = direction === 'do' ? step.before : step.after;
    const index = list.findIndex((item) => item.id === replacement.id);
    if (index < 0 || list[index]?.id !== expected.id) {
      throw new ComposerCommandError(`Transaction could not find ${replacement.id}.`);
    }
    list[index] = clone(replacement);
  }
  next[step.collection] = list;
  return next;
}

function applySteps(document, steps, direction) {
  const ordered = direction === 'do' ? steps : [...steps].reverse();
  return ordered.reduce((current, step) => applyStep(current, step, direction), document);
}

function validateApplied(document) {
  const canonical = canonicalizeScenario(document);
  const report = validateDocument(canonical);
  if (!report.ok) throw new ComposerValidationError(report.errors);
  return canonical;
}

export function commit(state, label, steps, options = {}) {
  assertState(state);
  if (!Array.isArray(steps) || steps.length === 0) return state;
  const transaction = {
    id: `tx-${pad(state.sequence.transaction, 4)}`,
    label,
    steps: clone(steps),
    selectionBefore: clone(state.selection),
    selectionAfter: clone(options.selectionAfter ?? state.selection),
    interactionBefore: clone(state.interaction),
    interactionAfter: clone(options.interactionAfter ?? state.interaction),
  };
  assertTransaction(transaction);
  const document = validateApplied(applySteps(state.document, transaction.steps, 'do'));
  return {
    ...state,
    document,
    selection: normalizeSelection(document, transaction.selectionAfter),
    interaction: clone(transaction.interactionAfter),
    history: {
      undo: [...state.history.undo, transaction].slice(-COMPOSER_HISTORY_LIMIT),
      redo: [],
    },
    sequence: {
      ...state.sequence,
      ...(options.sequenceAfter ?? {}),
      transaction: state.sequence.transaction + 1,
    },
  };
}

export function undo(state) {
  assertState(state);
  const transaction = state.history.undo.at(-1);
  if (!transaction) return state;
  assertTransaction(transaction);
  const document = validateApplied(applySteps(state.document, transaction.steps, 'undo'));
  return {
    ...state,
    document,
    selection: normalizeSelection(document, transaction.selectionBefore),
    interaction: clone(transaction.interactionBefore),
    history: {
      undo: state.history.undo.slice(0, -1),
      redo: [...state.history.redo, transaction],
    },
  };
}

export function redo(state) {
  assertState(state);
  const transaction = state.history.redo.at(-1);
  if (!transaction) return state;
  assertTransaction(transaction);
  const document = validateApplied(applySteps(state.document, transaction.steps, 'do'));
  return {
    ...state,
    document,
    selection: normalizeSelection(document, transaction.selectionAfter),
    interaction: clone(transaction.interactionAfter),
    history: {
      undo: [...state.history.undo, transaction],
      redo: state.history.redo.slice(0, -1),
    },
  };
}

export function selectNode(state, id, options = {}) {
  assertState(state);
  if (!state.document.nodes.some((node) => node.id === id)) throw new ComposerCommandError(`Unknown node: ${id}.`);
  let nodeIds = [id];
  if (options.additive) {
    const selected = new Set(state.selection.nodeIds);
    if (options.toggle !== false && selected.has(id)) selected.delete(id);
    else selected.add(id);
    nodeIds = [...selected];
  }
  return { ...state, selection: normalizeSelection(state.document, { nodeIds, linkId: null }) };
}

export function selectLink(state, id) {
  assertState(state);
  if (!state.document.links.some((link) => link.id === id)) throw new ComposerCommandError(`Unknown link: ${id}.`);
  return { ...state, selection: { nodeIds: [], linkId: id } };
}

export function clearSelection(state) {
  assertState(state);
  return { ...state, selection: { nodeIds: [], linkId: null } };
}

export function setInteractionMode(state, mode) {
  assertState(state);
  if (!['select', 'connect'].includes(mode)) throw new ComposerCommandError(`Unknown interaction mode: ${mode}.`);
  return {
    ...state,
    interaction: { mode, connectFrom: mode === 'connect' ? state.interaction.connectFrom : null },
  };
}

export function beginConnection(state, nodeId) {
  assertState(state);
  if (!state.document.nodes.some((node) => node.id === nodeId)) throw new ComposerCommandError(`Unknown node: ${nodeId}.`);
  return {
    ...state,
    selection: { nodeIds: [nodeId], linkId: null },
    interaction: { mode: 'connect', connectFrom: nodeId },
  };
}

export function cancelConnection(state) {
  assertState(state);
  return { ...state, interaction: { mode: 'select', connectFrom: null } };
}

export function allocate(state, kind) {
  assertState(state);
  if (!['node', 'link'].includes(kind)) throw new ComposerCommandError(`Unknown sequence kind: ${kind}.`);
  const entries = kind === 'node' ? state.document.nodes : state.document.links;
  const used = new Set(entries.map((item) => item.id));
  let ordinal = state.sequence[kind];
  let id = `${kind}-${pad(ordinal)}`;
  while (used.has(id)) {
    ordinal += 1;
    id = `${kind}-${pad(ordinal)}`;
  }
  return { id, ordinal, next: ordinal + 1 };
}
