import { cubicPoint, formatClock, linkCurve } from '../core/engine.js';

/** @param {unknown} value */
export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/** @param {string} status */
export function statusLabel(status) {
  const labels = {
    idle: 'IDLE',
    watch: 'WATCH',
    suspect: 'SUSPECT',
    alert: 'ALERT',
    contained: 'CONTAINED',
    trusted: 'TRUSTED',
    offline: 'OFFLINE',
    restored: 'RESTORED',
  };
  return labels[status] ?? String(status).toUpperCase();
}

/** @param {string} type */
function glyphFor(type) {
  const glyphs = {
    external: 'EX',
    gateway: 'GW',
    identity: 'ID',
    service: 'SV',
    database: 'DB',
    soc: 'SC',
    sensor: 'SN',
    archive: 'AR',
    broadcast: 'BR',
  };
  return glyphs[type] ?? 'ND';
}

/**
 * @param {Record<string, any>} scenario
 * @param {Record<string, any>} frame
 * @param {string} selectedNodeId
 */
export function renderTopology(scenario, frame, selectedNodeId) {
  const nodeMap = new Map(scenario.nodes.map((node) => [node.id, node]));

  const links = scenario.links
    .map((link) => {
      const start = nodeMap.get(link.from);
      const end = nodeMap.get(link.to);
      const curve = linkCurve(start, end);
      const middle = cubicPoint(curve.start, curve.controlA, curve.controlB, curve.end, 0.5);
      const state = frame.linkStates[link.id] ?? { status: 'idle' };
      const d = `M ${curve.start.x} ${curve.start.y} C ${curve.controlA.x} ${curve.controlA.y}, ${curve.controlB.x} ${curve.controlB.y}, ${curve.end.x} ${curve.end.y}`;
      return `
        <g class="map-link-group status-${escapeHtml(state.status)}">
          <path class="map-link-shadow" d="${d}"></path>
          <path class="map-link" d="${d}"></path>
          <text class="map-link-label" x="${middle.x}" y="${middle.y - 8}" text-anchor="middle">${escapeHtml(link.label ?? '')}</text>
        </g>`;
    })
    .join('');

  const pulses = frame.pulses
    .map((pulse, index) => {
      const start = nodeMap.get(pulse.from);
      const end = nodeMap.get(pulse.to);
      if (!start || !end) return '';
      const curve = linkCurve(start, end);
      const head = cubicPoint(curve.start, curve.controlA, curve.controlB, curve.end, pulse.progress);
      const tail = cubicPoint(curve.start, curve.controlA, curve.controlB, curve.end, Math.max(0, pulse.progress - 0.055));
      return `
        <g class="signal-pulse severity-${escapeHtml(pulse.severity)}" aria-hidden="true">
          <circle class="signal-tail" cx="${tail.x}" cy="${tail.y}" r="5"></circle>
          <circle class="signal-head" cx="${head.x}" cy="${head.y}" r="7"></circle>
          <circle class="signal-core" cx="${head.x}" cy="${head.y}" r="2.5"></circle>
          <text class="signal-index" x="${head.x + 12}" y="${head.y - 10}">${String(index + 1).padStart(2, '0')}</text>
        </g>`;
    })
    .join('');

  const nodes = scenario.nodes
    .map((node) => {
      const state = frame.nodeStates[node.id] ?? { status: 'idle', signal: 0 };
      const selected = node.id === selectedNodeId;
      const signalOpacity = Math.max(0.08, Math.min(0.86, (state.signal ?? 0) / 100));
      return `
        <g
          class="map-node status-${escapeHtml(state.status)}${selected ? ' is-selected' : ''}"
          transform="translate(${node.x} ${node.y})"
          data-node-id="${escapeHtml(node.id)}"
          role="button"
          tabindex="0"
          aria-label="Inspect ${escapeHtml(node.label)}, status ${escapeHtml(statusLabel(state.status))}"
        >
          <circle class="node-signal" r="43" opacity="${signalOpacity}"></circle>
          <circle class="node-selector" r="49"></circle>
          <polygon class="node-shell" points="0,-29 25,-14 25,14 0,29 -25,14 -25,-14"></polygon>
          <polygon class="node-core" points="0,-20 17,-10 17,10 0,20 -17,10 -17,-10"></polygon>
          <text class="node-glyph" x="0" y="5" text-anchor="middle">${escapeHtml(node.short ?? glyphFor(node.type))}</text>
          <g class="node-label-block" transform="translate(-58 41)">
            <rect class="node-label-bg" width="116" height="39" rx="4"></rect>
            <text class="node-label" x="58" y="15" text-anchor="middle">${escapeHtml(node.label)}</text>
            <text class="node-address" x="58" y="30" text-anchor="middle">${escapeHtml(node.address ?? node.zone)}</text>
          </g>
          <text class="node-status" x="0" y="94" text-anchor="middle">${escapeHtml(statusLabel(state.status))}</text>
        </g>`;
    })
    .join('');

  return `
    <svg class="topology-svg" viewBox="0 0 1000 620" role="img" aria-label="Synthetic network topology for ${escapeHtml(scenario.title)}">
      <defs>
        <pattern id="micro-grid" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M 28 0 L 0 0 0 28" class="micro-grid-line"></path>
        </pattern>
        <radialGradient id="stage-glow" cx="50%" cy="50%" r="55%">
          <stop offset="0%" class="glow-center"></stop>
          <stop offset="100%" class="glow-edge"></stop>
        </radialGradient>
        <filter id="soft-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="4" result="blur"></feGaussianBlur>
          <feMerge><feMergeNode in="blur"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge>
        </filter>
      </defs>
      <rect class="stage-glow" x="0" y="0" width="1000" height="620" fill="url(#stage-glow)"></rect>
      <rect class="micro-grid" x="0" y="0" width="1000" height="620" fill="url(#micro-grid)"></rect>
      <g class="range-rings" aria-hidden="true">
        <circle cx="500" cy="310" r="94"></circle>
        <circle cx="500" cy="310" r="184"></circle>
        <circle cx="500" cy="310" r="274"></circle>
        <line x1="500" y1="0" x2="500" y2="620"></line>
        <line x1="0" y1="310" x2="1000" y2="310"></line>
      </g>
      <g class="map-links">${links}</g>
      <g class="map-pulses" filter="url(#soft-glow)">${pulses}</g>
      <g class="map-nodes">${nodes}</g>
      <g class="frame-coordinates" aria-hidden="true">
        <text x="18" y="24">GRID 00-A</text>
        <text x="982" y="24" text-anchor="end">LOCAL SIMULATION</text>
        <text x="18" y="602">NO OUTBOUND TRANSPORT</text>
        <text x="982" y="602" text-anchor="end">1000 × 620</text>
      </g>
    </svg>`;
}

/**
 * @param {{at: number, value: number}[]} history
 * @param {number} now
 */
function sparkline(history, now) {
  const entries = history.length === 1 ? [history[0], { at: Math.max(now, 1), value: history[0].value }] : history;
  const maxTime = Math.max(1, now);
  const points = entries
    .map((entry) => {
      const x = 4 + (entry.at / maxTime) * 112;
      const y = 28 - (entry.value / 100) * 23;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return `<svg class="metric-spark" viewBox="0 0 120 32" aria-hidden="true"><polyline points="${points}"></polyline></svg>`;
}

/** @param {Record<string, any>} frame */
export function renderMetrics(frame) {
  const definitions = [
    ['threat', 'THREAT INDEX'],
    ['trust', 'TRUST SCORE'],
    ['load', 'STAGE LOAD'],
    ['containment', 'CONTAINMENT'],
  ];

  return definitions
    .map(([key, label]) => {
      const value = Math.round(frame.metrics[key] ?? 0);
      return `
        <article class="metric-card metric-${key}">
          <div class="metric-card-head">
            <span>${label}</span>
            <strong>${String(value).padStart(2, '0')}</strong>
          </div>
          <progress class="metric-progress" max="100" value="${value}" aria-label="${label}: ${value} percent"></progress>
          ${sparkline(frame.metricHistory[key] ?? [{ at: 0, value }], frame.timeMs)}
        </article>`;
    })
    .join('');
}

/** @param {Record<string, any>} frame */
export function renderFeed(frame) {
  if (frame.feed.length === 0) {
    return '<p class="empty-state">Timeline waiting for the first cue.</p>';
  }

  return frame.feed
    .map(
      (item, index) => `
        <button class="feed-item severity-${escapeHtml(item.severity)}${index === 0 ? ' is-current' : ''}" data-seek-ms="${item.at}">
          <span class="feed-time">${formatClock(item.at)}</span>
          <span class="feed-copy">
            <strong>${escapeHtml(item.title)}</strong>
            <small>${escapeHtml(item.detail)}</small>
          </span>
        </button>`,
    )
    .join('');
}

/** @param {Record<string, any>} frame */
export function renderTerminal(frame) {
  const lines = frame.logs.length
    ? frame.logs
    : [
        { at: 0, channel: 'stage', severity: 'info', text: 'awaiting director cue' },
        { at: 0, channel: 'safety', severity: 'success', text: 'connect-src=none · simulation boundary healthy' },
      ];

  return lines
    .map(
      (line) => `
        <div class="terminal-line severity-${escapeHtml(line.severity ?? 'info')}">
          <span class="terminal-time">${formatClock(line.at)}</span>
          <span class="terminal-channel">${escapeHtml(String(line.channel ?? 'stage').toUpperCase())}</span>
          <span class="terminal-text">${escapeHtml(line.text)}</span>
        </div>`,
    )
    .join('');
}

/**
 * @param {Record<string, any>} scenario
 * @param {Record<string, any>} frame
 */
export function renderTimelineMarkers(scenario, frame) {
  const markers = scenario.events
    .filter((event) => event.title)
    .map((event) => {
      const x = (event.at / scenario.durationMs) * 1000;
      const passed = event.at <= frame.timeMs ? ' is-passed' : '';
      return `<circle class="timeline-marker severity-${escapeHtml(event.severity ?? 'info')}${passed}" cx="${x}" cy="12" r="5"><title>${escapeHtml(event.title)} at ${formatClock(event.at)}</title></circle>`;
    })
    .join('');
  const playheadX = frame.progress * 1000;

  return `
    <svg class="timeline-marker-svg" viewBox="0 0 1000 24" preserveAspectRatio="none" aria-hidden="true">
      <line class="timeline-rail" x1="0" y1="12" x2="1000" y2="12"></line>
      ${markers}
      <line class="timeline-playhead" x1="${playheadX}" y1="1" x2="${playheadX}" y2="23"></line>
    </svg>`;
}

/**
 * @param {Record<string, any>} scenario
 * @param {Record<string, any>} frame
 * @param {string} selectedNodeId
 */
export function renderNodeInspector(scenario, frame, selectedNodeId) {
  const node = scenario.nodes.find((item) => item.id === selectedNodeId) ?? scenario.nodes[0];
  const state = frame.nodeStates[node.id] ?? { status: 'idle', signal: 0 };
  const connections = scenario.links.filter((link) => link.from === node.id || link.to === node.id).length;

  return `
    <div class="inspector-head">
      <span class="eyebrow">SELECTED NODE</span>
      <span class="status-chip status-${escapeHtml(state.status)}">${escapeHtml(statusLabel(state.status))}</span>
    </div>
    <h3>${escapeHtml(node.label)}</h3>
    <p>${escapeHtml(node.description)}</p>
    <dl class="node-facts">
      <div><dt>ZONE</dt><dd>${escapeHtml(node.zone)}</dd></div>
      <div><dt>ADDRESS</dt><dd>${escapeHtml(node.address)}</dd></div>
      <div><dt>TYPE</dt><dd>${escapeHtml(node.type.toUpperCase())}</dd></div>
      <div><dt>LINKS</dt><dd>${connections}</dd></div>
      <div><dt>SIGNAL</dt><dd>${Math.round(state.signal ?? 0)}%</dd></div>
    </dl>`;
}

/** @param {Record<string, any>} scenario */
export function renderScenarioBrief(scenario) {
  return `
    <span class="eyebrow">SCENE BRIEF</span>
    <h2>${escapeHtml(scenario.title)}</h2>
    <p class="scene-subtitle">${escapeHtml(scenario.subtitle)}</p>
    <div class="brief-block">
      <span>OBJECTIVE</span>
      <p>${escapeHtml(scenario.objective)}</p>
    </div>
    <div class="brief-block">
      <span>DIRECTOR NOTE</span>
      <p>${escapeHtml(scenario.directorNote)}</p>
    </div>`;
}
