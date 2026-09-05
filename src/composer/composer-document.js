export const COMPOSER_STATE_VERSION = 1;
export const COMPOSER_HISTORY_LIMIT = 100;
export const STEP_TYPES = new Set(['insert', 'remove', 'update', 'replace']);

const ACTIVE_CONTENT = /(?:<\s*script\b|javascript\s*:|data\s*:\s*text\/html|vbscript\s*:)/i;
const RESERVED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const MAX_DEPTH = 32;
const MAX_NODES = 500;
const MAX_LINKS = 2000;
const MAX_STRING = 20_000;

export class ComposerValidationError extends Error {
  constructor(errors) {
    const list = Array.isArray(errors) ? errors : [String(errors)];
    super(`Scenario validation failed:\n- ${list.join('\n- ')}`);
    this.name = 'ComposerValidationError';
    this.errors = list;
  }
}

export class ComposerCommandError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ComposerCommandError';
  }
}

export function plain(value) {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function clone(value) {
  return structuredClone(value);
}

export function pad(value, width = 3) {
  return String(value).padStart(width, '0');
}

function stableValue(value, depth = 0) {
  if (depth > MAX_DEPTH) throw new ComposerValidationError([`Document nesting exceeds ${MAX_DEPTH} levels.`]);
  if (Array.isArray(value)) return value.map((item) => stableValue(item, depth + 1));
  if (!plain(value)) return value;
  const output = {};
  for (const key of Object.keys(value).sort()) {
    if (value[key] !== undefined) output[key] = stableValue(value[key], depth + 1);
  }
  return output;
}

export function stableStringify(value) {
  return `${JSON.stringify(stableValue(value), null, 2)}\n`;
}

function compareId(left, right) {
  return String(left.id ?? '').localeCompare(String(right.id ?? ''), 'en');
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function getNodePosition(node) {
  if (plain(node.position)) {
    return { x: finite(node.position.x), y: finite(node.position.y) };
  }
  return { x: finite(node.x), y: finite(node.y) };
}

export function withNodePosition(node, position) {
  const x = Math.round(finite(position.x) * 1000) / 1000;
  const y = Math.round(finite(position.y) * 1000) / 1000;
  if (plain(node.position) || (!Object.hasOwn(node, 'x') && !Object.hasOwn(node, 'y'))) {
    return { ...node, position: { ...(plain(node.position) ? node.position : {}), x, y } };
  }
  return { ...node, x, y };
}

export function getLinkEndpoints(link) {
  return {
    from: String(link.from ?? link.source ?? ''),
    to: String(link.to ?? link.target ?? ''),
  };
}

export function withLinkEndpoints(link, from, to) {
  if (Object.hasOwn(link, 'source') || Object.hasOwn(link, 'target')) {
    return { ...link, source: from, target: to };
  }
  return { ...link, from, to };
}

export function canonicalizeScenario(source) {
  if (!plain(source)) throw new ComposerValidationError(['Scenario root must be a JSON object.']);
  const document = clone(source);
  document.nodes = Array.isArray(document.nodes) ? document.nodes.map((node) => {
    if (!plain(node)) return node;
    const normalized = { ...node, id: String(node.id ?? '').trim() };
    if (plain(node.position)) normalized.position = {
      ...node.position,
      x: finite(node.position.x),
      y: finite(node.position.y),
    };
    if (Object.hasOwn(node, 'x')) normalized.x = finite(node.x);
    if (Object.hasOwn(node, 'y')) normalized.y = finite(node.y);
    return normalized;
  }).sort(compareId) : [];
  document.links = Array.isArray(document.links) ? document.links.map((link) => plain(link)
    ? { ...link, id: String(link.id ?? '').trim() }
    : link).sort(compareId) : [];
  if (Array.isArray(document.timeline)) {
    document.timeline = [...document.timeline].sort((left, right) => {
      const leftAt = finite(left?.at ?? left?.time ?? left?.start, 0);
      const rightAt = finite(right?.at ?? right?.time ?? right?.start, 0);
      return leftAt - rightAt || compareId(left ?? {}, right ?? {});
    });
  }
  return stableValue(document);
}

function inspectJson(value, path, errors, depth = 0) {
  if (depth > MAX_DEPTH) {
    errors.push(`${path} exceeds the maximum nesting depth.`);
    return;
  }
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) errors.push(`${path} must contain only finite numbers.`);
    return;
  }
  if (typeof value === 'string') {
    if (value.length > MAX_STRING) errors.push(`${path} exceeds ${MAX_STRING} characters.`);
    if (ACTIVE_CONTENT.test(value)) errors.push(`${path} contains active content that cannot be stored in a simulation scenario.`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectJson(item, `${path}[${index}]`, errors, depth + 1));
    return;
  }
  if (!plain(value)) {
    errors.push(`${path} is not serializable JSON data.`);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (RESERVED_KEYS.has(key)) errors.push(`${path}.${key} is not an allowed document key.`);
    inspectJson(child, `${path}.${key}`, errors, depth + 1);
  }
}

export function validateDocument(source) {
  const errors = [];
  if (!plain(source)) return { ok: false, errors: ['Scenario root must be a JSON object.'] };
  inspectJson(source, '$', errors);
  if (!Array.isArray(source.nodes)) errors.push('nodes must be an array.');
  if (!Array.isArray(source.links)) errors.push('links must be an array.');
  if (errors.length > 0) return { ok: false, errors };
  if (source.nodes.length > MAX_NODES) errors.push(`nodes exceeds the ${MAX_NODES}-item composer limit.`);
  if (source.links.length > MAX_LINKS) errors.push(`links exceeds the ${MAX_LINKS}-item composer limit.`);

  const nodeIds = new Set();
  source.nodes.forEach((node, index) => {
    if (!plain(node)) {
      errors.push(`nodes[${index}] must be an object.`);
      return;
    }
    if (typeof node.id !== 'string' || node.id.trim() === '') errors.push(`nodes[${index}].id must be a non-empty string.`);
    else if (nodeIds.has(node.id)) errors.push(`Duplicate node id: ${node.id}.`);
    else nodeIds.add(node.id);
    const position = getNodePosition(node);
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) errors.push(`Node ${node.id || index} has an invalid position.`);
  });

  const linkIds = new Set();
  source.links.forEach((link, index) => {
    if (!plain(link)) {
      errors.push(`links[${index}] must be an object.`);
      return;
    }
    if (typeof link.id !== 'string' || link.id.trim() === '') errors.push(`links[${index}].id must be a non-empty string.`);
    else if (linkIds.has(link.id)) errors.push(`Duplicate link id: ${link.id}.`);
    else linkIds.add(link.id);
    const { from, to } = getLinkEndpoints(link);
    if (!nodeIds.has(from)) errors.push(`Link ${link.id || index} references missing source node ${from || '(empty)'}.`);
    if (!nodeIds.has(to)) errors.push(`Link ${link.id || index} references missing target node ${to || '(empty)'}.`);
    if (from && from === to) errors.push(`Link ${link.id || index} cannot connect a node to itself.`);
  });
  return { ok: errors.length === 0, errors };
}

export function assertValidDocument(source) {
  const report = validateDocument(source);
  if (!report.ok) throw new ComposerValidationError(report.errors);
  return source;
}

export function exportScenario(source) {
  const canonical = canonicalizeScenario(source);
  assertValidDocument(canonical);
  return stableStringify(canonical);
}

export function importScenario(serialized) {
  let parsed;
  try {
    parsed = JSON.parse(serialized);
  } catch (error) {
    throw new ComposerValidationError([`Scenario is not valid JSON: ${error.message}`]);
  }
  const canonical = canonicalizeScenario(parsed);
  assertValidDocument(canonical);
  return canonical;
}

export function createStarterScenario() {
  return canonicalizeScenario({
    id: 'scene-composer-draft',
    title: 'Scene Composer Draft',
    description: 'A simulation-only topology draft.',
    duration: 12000,
    nodes: [
      { id: 'node-001', label: 'Origin', kind: 'workstation', position: { x: 180, y: 220 } },
      { id: 'node-002', label: 'Relay', kind: 'service', position: { x: 470, y: 330 } },
      { id: 'node-003', label: 'Target', kind: 'server', position: { x: 760, y: 210 } },
    ],
    links: [
      { id: 'link-001', from: 'node-001', to: 'node-002', kind: 'signal' },
      { id: 'link-002', from: 'node-002', to: 'node-003', kind: 'signal' },
    ],
    timeline: [],
  });
}
