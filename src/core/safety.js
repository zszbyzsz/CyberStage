/**
 * CyberStage scenario safety validation.
 *
 * The runtime is intentionally presentation-only. Scenario data may describe
 * synthetic telemetry, but identifiers must remain inside documentation-only
 * namespaces so a scene cannot accidentally point at a real system.
 */

const ID_PATTERN = /^[a-z][a-z0-9-]{1,47}$/;
const ALLOWED_STATUSES = new Set([
  'idle',
  'watch',
  'suspect',
  'alert',
  'contained',
  'trusted',
  'offline',
  'restored',
]);
const ALLOWED_SEVERITIES = new Set(['info', 'low', 'medium', 'high', 'critical', 'success']);
const ALLOWED_THEMES = new Set(['cyan', 'amber', 'violet']);
const ALLOWED_NODE_TYPES = new Set([
  'external',
  'gateway',
  'identity',
  'service',
  'database',
  'soc',
  'sensor',
  'archive',
  'broadcast',
]);

const IPV4_PATTERN = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const URL_PATTERN = /\b(?:https?|wss?):\/\/[^\s<>'"]+/gi;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

/** @param {string} value */
export function isDocumentationIPv4(value) {
  const parts = value.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  return (
    (parts[0] === 192 && parts[1] === 0 && parts[2] === 2) ||
    (parts[0] === 198 && parts[1] === 51 && parts[2] === 100) ||
    (parts[0] === 203 && parts[1] === 0 && parts[2] === 113)
  );
}

/** @param {string} value */
export function isDocumentationEmail(value) {
  const domain = value.toLowerCase().split('@')[1] ?? '';
  return domain.endsWith('.test') || domain.endsWith('.example') || domain.endsWith('.invalid');
}

/**
 * @param {unknown} value
 * @param {string} path
 * @param {{path: string, value: string}[]} output
 */
function collectStrings(value, path, output) {
  if (typeof value === 'string') {
    output.push({ path, value });
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => collectStrings(item, `${path}[${index}]`, output));
    return;
  }

  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => collectStrings(item, `${path}.${key}`, output));
  }
}

/** @param {unknown} value */
function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @typedef {{ok: boolean, errors: string[], warnings: string[]}} ValidationReport
 */

/**
 * Validate a scene before it reaches the renderer.
 *
 * @param {unknown} candidate
 * @returns {ValidationReport}
 */
export function validateScenario(candidate) {
  const errors = [];
  const warnings = [];

  if (!isPlainObject(candidate)) {
    return { ok: false, errors: ['Scenario must be a JSON object.'], warnings };
  }

  const scenario = /** @type {Record<string, any>} */ (candidate);

  if (!ID_PATTERN.test(String(scenario.id ?? ''))) {
    errors.push('Scenario id must be a lowercase slug between 2 and 48 characters.');
  }
  if (typeof scenario.title !== 'string' || scenario.title.trim().length < 3 || scenario.title.length > 80) {
    errors.push('Scenario title must contain 3–80 characters.');
  }
  if (typeof scenario.subtitle !== 'string' || scenario.subtitle.trim().length < 3 || scenario.subtitle.length > 140) {
    errors.push('Scenario subtitle must contain 3–140 characters.');
  }
  if (scenario.safety !== 'simulation-only') {
    errors.push('Scenario safety must be exactly "simulation-only".');
  }
  if (!ALLOWED_THEMES.has(scenario.theme)) {
    errors.push(`Scenario theme must be one of: ${[...ALLOWED_THEMES].join(', ')}.`);
  }
  if (!Number.isFinite(scenario.durationMs) || scenario.durationMs < 10_000 || scenario.durationMs > 600_000) {
    errors.push('Scenario durationMs must be between 10,000 and 600,000 milliseconds.');
  }

  const nodes = Array.isArray(scenario.nodes) ? scenario.nodes : [];
  if (nodes.length < 2 || nodes.length > 24) {
    errors.push('Scenario must contain between 2 and 24 nodes.');
  }

  const nodeIds = new Set();
  nodes.forEach((node, index) => {
    const prefix = `nodes[${index}]`;
    if (!isPlainObject(node)) {
      errors.push(`${prefix} must be an object.`);
      return;
    }
    if (!ID_PATTERN.test(String(node.id ?? ''))) {
      errors.push(`${prefix}.id must be a lowercase slug.`);
    } else if (nodeIds.has(node.id)) {
      errors.push(`${prefix}.id duplicates "${node.id}".`);
    } else {
      nodeIds.add(node.id);
    }
    if (typeof node.label !== 'string' || node.label.trim().length < 2 || node.label.length > 48) {
      errors.push(`${prefix}.label must contain 2–48 characters.`);
    }
    if (!ALLOWED_NODE_TYPES.has(node.type)) {
      errors.push(`${prefix}.type is not supported.`);
    }
    if (!Number.isFinite(node.x) || node.x < 30 || node.x > 970 || !Number.isFinite(node.y) || node.y < 30 || node.y > 590) {
      errors.push(`${prefix} coordinates must remain inside the 1000×620 stage safe area.`);
    }
    if (node.status && !ALLOWED_STATUSES.has(node.status)) {
      errors.push(`${prefix}.status is not supported.`);
    }
  });

  const links = Array.isArray(scenario.links) ? scenario.links : [];
  if (links.length < 1 || links.length > 40) {
    errors.push('Scenario must contain between 1 and 40 links.');
  }

  const linkIds = new Set();
  links.forEach((link, index) => {
    const prefix = `links[${index}]`;
    if (!isPlainObject(link)) {
      errors.push(`${prefix} must be an object.`);
      return;
    }
    if (!ID_PATTERN.test(String(link.id ?? ''))) {
      errors.push(`${prefix}.id must be a lowercase slug.`);
    } else if (linkIds.has(link.id)) {
      errors.push(`${prefix}.id duplicates "${link.id}".`);
    } else {
      linkIds.add(link.id);
    }
    if (!nodeIds.has(link.from) || !nodeIds.has(link.to)) {
      errors.push(`${prefix} must reference existing from/to nodes.`);
    }
    if (link.from === link.to) {
      errors.push(`${prefix} cannot connect a node to itself.`);
    }
  });

  const events = Array.isArray(scenario.events) ? scenario.events : [];
  if (events.length < 2 || events.length > 240) {
    errors.push('Scenario must contain between 2 and 240 events.');
  }

  events.forEach((event, index) => {
    const prefix = `events[${index}]`;
    if (!isPlainObject(event)) {
      errors.push(`${prefix} must be an object.`);
      return;
    }
    if (!Number.isFinite(event.at) || event.at < 0 || event.at > scenario.durationMs) {
      errors.push(`${prefix}.at must fall inside the scenario duration.`);
    }
    if (!ALLOWED_SEVERITIES.has(event.severity ?? 'info')) {
      errors.push(`${prefix}.severity is not supported.`);
    }
    if (event.flow) {
      if (!isPlainObject(event.flow) || !nodeIds.has(event.flow.from) || !nodeIds.has(event.flow.to)) {
        errors.push(`${prefix}.flow must reference existing from/to nodes.`);
      }
      if (!Number.isFinite(event.flow?.durationMs) || event.flow.durationMs < 400 || event.flow.durationMs > 20_000) {
        errors.push(`${prefix}.flow.durationMs must be between 400 and 20,000 milliseconds.`);
      }
    }
    if (Array.isArray(event.nodes)) {
      event.nodes.forEach((mutation, mutationIndex) => {
        if (!isPlainObject(mutation) || !nodeIds.has(mutation.id) || !ALLOWED_STATUSES.has(mutation.status)) {
          errors.push(`${prefix}.nodes[${mutationIndex}] contains an invalid node mutation.`);
        }
      });
    }
    if (Array.isArray(event.links)) {
      event.links.forEach((mutation, mutationIndex) => {
        if (!isPlainObject(mutation) || !linkIds.has(mutation.id) || !ALLOWED_STATUSES.has(mutation.status)) {
          errors.push(`${prefix}.links[${mutationIndex}] contains an invalid link mutation.`);
        }
      });
    }
    if (event.metrics) {
      for (const [key, value] of Object.entries(event.metrics)) {
        if (!['threat', 'trust', 'load', 'containment'].includes(key) || !Number.isFinite(value) || value < 0 || value > 100) {
          errors.push(`${prefix}.metrics.${key} must be a number between 0 and 100.`);
        }
      }
    }
  });

  const strings = [];
  collectStrings(scenario, '$', strings);
  for (const entry of strings) {
    const urls = entry.value.match(URL_PATTERN) ?? [];
    if (urls.length > 0) {
      errors.push(`${entry.path} contains a URL. Scene data must remain self-contained.`);
    }

    const addresses = entry.value.match(IPV4_PATTERN) ?? [];
    for (const address of addresses) {
      if (!isDocumentationIPv4(address)) {
        errors.push(`${entry.path} contains non-documentation IPv4 address ${address}.`);
      }
    }

    const emails = entry.value.match(EMAIL_PATTERN) ?? [];
    for (const email of emails) {
      if (!isDocumentationEmail(email)) {
        errors.push(`${entry.path} contains non-documentation email address ${email}.`);
      }
    }

    if (/<\/?(?:script|iframe|object|embed)\b/i.test(entry.value)) {
      errors.push(`${entry.path} contains prohibited markup.`);
    }
  }

  if (events.length > 0) {
    const sorted = events.every((event, index) => index === 0 || events[index - 1].at <= event.at);
    if (!sorted) {
      warnings.push('Events are not sorted; CyberStage will normalize their order.');
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

export const scenarioSafetyConstants = Object.freeze({
  statuses: Object.freeze([...ALLOWED_STATUSES]),
  severities: Object.freeze([...ALLOWED_SEVERITIES]),
  themes: Object.freeze([...ALLOWED_THEMES]),
  nodeTypes: Object.freeze([...ALLOWED_NODE_TYPES]),
});
