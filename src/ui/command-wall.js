import { formatClock } from '../core/engine.js';
import { escapeHtml, statusLabel } from './render.js';

export const WALL_SHOTS = Object.freeze(['auto', 'overview', 'contest', 'containment', 'recovery']);

const STATUS_WEIGHT = Object.freeze({
  alert: 8,
  suspect: 7,
  contained: 6,
  watch: 5,
  offline: 4,
  restored: 3,
  trusted: 2,
  idle: 1,
});

const PROFILES = Object.freeze({
  'control-plane-eclipse': {
    code: 'CONTROL-PLANE',
    title: 'AUTHORITY CONTEST',
    pressureLabel: 'CONTESTED SESSION',
    defenseLabel: 'TRUSTED CONTROL',
    protectedLabel: 'PROTECTED SERVICES',
    detail: 'Configuration authority is recalculated against a signed baseline while defensive write fences protect continuity.',
    visual: 'control',
  },
  'cipher-furnace': {
    code: 'IDENTITY-AUDIT',
    title: 'CREDENTIAL PRESSURE',
    pressureLabel: 'OFFLINE AUDIT PRESSURE',
    defenseLabel: 'IDENTITY DEFENSE',
    protectedLabel: 'ACCESS BOUNDARIES',
    detail: 'Candidate pressure rises inside an inert audit lane. Secret material is permanently redacted and no authentication request is sent.',
    visual: 'cipher',
  },
  'blackout-ledger': {
    code: 'FILE-RECOVERY',
    title: 'RECOVERY GRID',
    pressureLabel: 'CHANGE WAVE',
    defenseLabel: 'RESTORE CONTROL',
    protectedLabel: 'BUSINESS CONTINUITY',
    detail: 'Synthetic file-change pressure is segmented while immutable recovery checkpoints restore trusted state.',
    visual: 'recovery',
  },
});

const GENERIC_PROFILE = Object.freeze({
  code: 'OPERATIONS',
  title: 'CINEMATIC COMMAND WALL',
  pressureLabel: 'SIGNAL PRESSURE',
  defenseLabel: 'DEFENSIVE CONTROL',
  protectedLabel: 'PROTECTED SYSTEMS',
  detail: 'The current scene is reconstructed as a large-screen operational story: pressure, decision, containment, and recovery.',
  visual: 'generic',
});

/** @param {string} phase */
function phaseShot(phase) {
  const value = String(phase ?? '').toUpperCase();
  if (/RECOVER|RESTORE|VERIFY|RESOLVE|REBUILD|CLOSE/.test(value)) return 'recovery';
  if (/CONTAIN|ISOLAT|BLOCK|QUARANT|LOCK|FENCE|FREEZE/.test(value)) return 'containment';
  if (/CORRELAT|CHALLENGE|CONTEST|ESCALAT|IMPACT|AUDIT|PRESSURE|MATCH|DETECT/.test(value)) return 'contest';
  return 'overview';
}

/**
 * Resolve a manual or automatic camera shot.
 * @param {string} requested
 * @param {string} phase
 */
export function resolveWallShot(requested, phase) {
  const normalized = WALL_SHOTS.includes(requested) ? requested : 'auto';
  return normalized === 'auto' ? phaseShot(phase) : normalized;
}

/** @param {Record<string, any>} scenario */
function profileFor(scenario) {
  return PROFILES[scenario.id] ?? GENERIC_PROFILE;
}

/** @param {string} value */
function safeClass(value) {
  return String(value ?? 'idle').toLowerCase().replace(/[^a-z0-9-]/g, '');
}

/** @param {number} value */
function percent(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

/** @param {Record<string, any>} node @param {Record<string, any>} frame */
function nodeState(node, frame) {
  return frame.nodeStates[node.id] ?? { status: node.status ?? 'idle', signal: 0, note: node.description ?? '' };
}

/** @param {Record<string, any>} node @param {Record<string, any>} frame */
function nodeScore(node, frame) {
  const state = nodeState(node, frame);
  return (STATUS_WEIGHT[state.status] ?? 0) * 100 + percent(state.signal);
}

/** @param {Record<string, any>} scenario @param {Record<string, any>} frame */
function classifyNodes(scenario, frame) {
  const pressureTypes = new Set(['external', 'gateway']);
  const defenseTypes = new Set(['soc', 'identity', 'archive']);
  const pressure = [];
  const defense = [];
  const protectedNodes = [];

  for (const node of scenario.nodes) {
    const state = nodeState(node, frame);
    const stressed = state.status === 'alert' || state.status === 'suspect';
    if (pressureTypes.has(node.type) || (stressed && !defenseTypes.has(node.type))) pressure.push(node);
    else if (defenseTypes.has(node.type)) defense.push(node);
    else protectedNodes.push(node);
  }

  const sorter = (left, right) => nodeScore(right, frame) - nodeScore(left, frame);
  pressure.sort(sorter);
  defense.sort(sorter);
  protectedNodes.sort(sorter);

  const fallback = [...scenario.nodes].sort(sorter);
  return {
    pressure: (pressure.length ? pressure : fallback.slice(0, 3)).slice(0, 4),
    defense: (defense.length ? defense : fallback.slice(-3)).slice(0, 4),
    protectedNodes: (protectedNodes.length ? protectedNodes : fallback.slice(1, 5)).slice(0, 5),
  };
}

/** @param {Record<string, any>} scenario @param {number} timeMs */
function cueWindow(scenario, timeMs) {
  let index = scenario.events.findLastIndex((event) => event.at <= timeMs);
  if (index < 0) index = 0;
  return {
    previous: scenario.events[index - 1] ?? null,
    current: scenario.events[index] ?? null,
    next: scenario.events[index + 1] ?? null,
  };
}

/** @param {Record<string, any>} scenario @param {Record<string, any>} frame */
function phaseRail(scenario, frame) {
  const phases = [];
  const seen = new Set();
  const initial = String(scenario.initialPhase ?? 'STANDBY');
  phases.push({ phase: initial, at: 0 });
  seen.add(initial);
  for (const event of scenario.events) {
    if (!event.phase || seen.has(event.phase)) continue;
    phases.push({ phase: event.phase, at: event.at });
    seen.add(event.phase);
  }

  return phases
    .map((entry, index) => {
      const nextAt = phases[index + 1]?.at ?? scenario.durationMs + 1;
      const active = frame.timeMs >= entry.at && frame.timeMs < nextAt;
      const complete = frame.timeMs >= nextAt;
      return `<button class="cw-phase${active ? ' is-active' : ''}${complete ? ' is-complete' : ''}" data-wall-seek="${entry.at}" type="button">
        <span>${String(index + 1).padStart(2, '0')}</span>
        <strong>${escapeHtml(entry.phase)}</strong>
        <small>${formatClock(entry.at)}</small>
      </button>`;
    })
    .join('');
}

/** @param {Record<string, any>[]} nodes @param {Record<string, any>} frame */
function nodeLane(nodes, frame) {
  return nodes
    .map((node) => {
      const state = nodeState(node, frame);
      const signal = percent(state.signal);
      return `<button class="cw-node status-${safeClass(state.status)}" data-wall-node="${escapeHtml(node.id)}" type="button">
        <span class="cw-node-code">${escapeHtml(node.short ?? node.type.slice(0, 2).toUpperCase())}</span>
        <span class="cw-node-copy">
          <strong>${escapeHtml(node.label)}</strong>
          <small>${escapeHtml(node.zone)} · ${escapeHtml(node.address ?? 'LOCAL')}</small>
        </span>
        <span class="cw-node-state">${escapeHtml(statusLabel(state.status))}</span>
        <span class="cw-node-signal"><i style="--cw-level:${signal}%"></i></span>
      </button>`;
    })
    .join('');
}

/** @param {Record<string, any>[]} nodes @param {Record<string, any>} frame */
function protectedStrip(nodes, frame) {
  return nodes
    .map((node) => {
      const state = nodeState(node, frame);
      return `<button class="cw-protected status-${safeClass(state.status)}" data-wall-node="${escapeHtml(node.id)}" type="button">
        <span>${escapeHtml(node.short ?? node.type.slice(0, 2).toUpperCase())}</span>
        <strong>${escapeHtml(node.label)}</strong>
        <small>${escapeHtml(statusLabel(state.status))}</small>
      </button>`;
    })
    .join('');
}

/** @param {Record<string, any>} frame */
function authorityVisual(frame) {
  const pressure = percent(frame.metrics.threat);
  const trust = percent(frame.metrics.trust);
  const containment = percent(frame.metrics.containment);
  const drift = Math.max(0, Math.round((pressure - containment * 0.58) / 8));
  const tiles = Array.from({ length: 18 }, (_, index) => {
    const state = index < drift ? 'is-drift' : index < drift + Math.round(containment / 12) ? 'is-locked' : '';
    return `<span class="${state}">${String(index + 1).padStart(2, '0')}</span>`;
  }).join('');
  return `<div class="cw-special cw-authority">
    <div class="cw-authority-head"><span>CONTESTED AUTHORITY</span><strong>${pressure}</strong><i>VS</i><strong>${trust}</strong><span>TRUSTED AUTHORITY</span></div>
    <div class="cw-balance"><span style="--cw-pressure:${pressure}%"></span><i style="left:${trust}%"></i></div>
    <div class="cw-control-core"><span>CONTROL PLANE</span><strong>${containment >= 80 ? 'SIGNED BASELINE' : containment >= 35 ? 'WRITE FENCE ACTIVE' : pressure >= 55 ? 'AUTHORITY CONTESTED' : 'OBSERVING'}</strong><small>CONFIGURATION DRIFT CELLS · ${drift}</small></div>
    <div class="cw-drift-grid">${tiles}</div>
  </div>`;
}

/** @param {Record<string, any>} frame */
function cipherVisual(frame) {
  const pressure = percent(frame.metrics.threat);
  const trust = percent(frame.metrics.trust);
  const containment = percent(frame.metrics.containment);
  const scanned = Math.round((frame.progress ?? 0) * 54);
  const cells = Array.from({ length: 54 }, (_, index) => {
    let state = index < scanned ? 'is-tested' : '';
    if (pressure > 64 && index === Math.min(53, Math.max(0, scanned - 1))) state = 'is-match';
    if (containment > 58 && index < scanned) state += ' is-contained';
    return `<span class="${state}">${String((index * 37 + 11) % 100).padStart(2, '0')}</span>`;
  }).join('');
  return `<div class="cw-special cw-cipher">
    <div class="cw-cipher-head"><span>OFFLINE CANDIDATE PRESSURE</span><strong>${pressure}%</strong><small>SECRET OUTPUT DISABLED</small></div>
    <div class="cw-candidate-grid">${cells}</div>
    <div class="cw-redaction-card">
      <span>AUDIT RESULT</span>
      <strong>${pressure > 64 ? 'MATCH MATERIAL · REDACTED' : 'NO MATCH MATERIAL DISPLAYED'}</strong>
      <small>${trust > 72 ? 'IDENTITY TRUST STABLE' : containment > 45 ? 'SESSION REVOKED · STEP-UP HELD' : 'STEP-UP BOUNDARY WATCHING'}</small>
    </div>
  </div>`;
}

/** @param {Record<string, any>} frame */
function recoveryVisual(frame) {
  const pressure = percent(frame.metrics.threat);
  const containment = percent(frame.metrics.containment);
  const trust = percent(frame.metrics.trust);
  const affected = Math.round((pressure / 100) * 64);
  const restored = Math.round((containment / 100) * affected);
  const cells = Array.from({ length: 64 }, (_, index) => {
    const state = index < restored ? 'is-restored' : index < affected ? 'is-affected' : '';
    return `<span class="${state}"></span>`;
  }).join('');
  return `<div class="cw-special cw-recovery">
    <div class="cw-recovery-head"><span>SYNTHETIC FILE STATE</span><strong>${affected - restored} UNTRUSTED</strong><small>${restored} RESTORED</small></div>
    <div class="cw-file-grid">${cells}</div>
    <div class="cw-restore-wave" style="--cw-restore:${containment}%"><i></i></div>
    <div class="cw-recovery-status"><span>CANARY ${pressure > 42 ? 'TRIGGERED' : 'WATCHING'}</span><span>SNAPSHOT ${containment > 20 ? 'VERIFIED' : 'STANDBY'}</span><span>CONTINUITY ${trust > 76 ? 'HEALTHY' : 'PROTECTED'}</span></div>
  </div>`;
}

/** @param {Record<string, any>} frame */
function genericVisual(frame) {
  const threat = percent(frame.metrics.threat);
  const trust = percent(frame.metrics.trust);
  const containment = percent(frame.metrics.containment);
  const bars = Array.from({ length: 28 }, (_, index) => {
    const height = 12 + ((index * 19 + threat + trust) % 72);
    return `<span style="--cw-height:${height}%"></span>`;
  }).join('');
  return `<div class="cw-special cw-generic">
    <div class="cw-radar-ring"><span>${escapeHtml(frame.phase)}</span><strong>${threat}</strong><small>THREAT INDEX</small></div>
    <div class="cw-signal-bars">${bars}</div>
    <div class="cw-generic-states"><span>TRUST ${trust}</span><span>CONTAINMENT ${containment}</span><span>LOCAL REPLAY</span></div>
  </div>`;
}

/** @param {string} visual @param {Record<string, any>} frame */
function specialVisual(visual, frame) {
  if (visual === 'control') return authorityVisual(frame);
  if (visual === 'cipher') return cipherVisual(frame);
  if (visual === 'recovery') return recoveryVisual(frame);
  return genericVisual(frame);
}

/** @param {Record<string, any>} frame */
function metricDeck(frame) {
  const entries = [
    ['threat', 'THREAT'],
    ['trust', 'TRUST'],
    ['load', 'LOAD'],
    ['containment', 'CONTAIN'],
  ];
  return entries
    .map(([key, label]) => {
      const value = percent(frame.metrics[key]);
      return `<div class="cw-metric cw-metric-${key}"><span>${label}</span><strong>${String(value).padStart(2, '0')}</strong><i><b style="--cw-level:${value}%"></b></i></div>`;
    })
    .join('');
}

/** @param {Record<string, any> | null} cue @param {string} role */
function cueCard(cue, role) {
  if (!cue) return `<div class="cw-cue is-${role.toLowerCase()} is-empty"><span>${role}</span><strong>NO CUE</strong></div>`;
  return `<button class="cw-cue is-${role.toLowerCase()} severity-${safeClass(cue.severity ?? 'info')}" data-wall-seek="${cue.at}" type="button">
    <span>${role} · ${formatClock(cue.at)}</span>
    <strong>${escapeHtml(cue.title ?? 'Untitled cue')}</strong>
    <small>${escapeHtml(cue.detail ?? '')}</small>
  </button>`;
}

/** @param {Record<string, any>} frame */
function logDeck(frame) {
  const logs = frame.logs.slice(-6).reverse();
  if (!logs.length) return '<p class="cw-log-empty">AWAITING SYNTHETIC TELEMETRY</p>';
  return logs
    .map((log) => `<div class="cw-log severity-${safeClass(log.severity)}"><span>${formatClock(log.at)}</span><strong>${escapeHtml(log.channel)}</strong><p>${escapeHtml(log.text)}</p></div>`)
    .join('');
}

/**
 * Render a large-screen, display-only operational story from a compiled scene.
 * @param {Record<string, any>} scenario
 * @param {Record<string, any>} frame
 * @param {{shot?: string, selectedNodeId?: string}} [options]
 */
export function renderCommandWall(scenario, frame, options = {}) {
  const requestedShot = WALL_SHOTS.includes(options.shot) ? options.shot : 'auto';
  const shot = resolveWallShot(requestedShot, frame.phase);
  const profile = profileFor(scenario);
  const lanes = classifyNodes(scenario, frame);
  const cues = cueWindow(scenario, frame.timeMs);
  const activeTitle = frame.activeEvent?.title ?? 'Stage armed';
  const activeDetail = frame.activeEvent?.detail ?? scenario.synopsis ?? scenario.subtitle;

  return `<section class="cw-wall cw-shot-${shot} cw-visual-${profile.visual}" data-command-shot="${shot}" data-scene-id="${escapeHtml(scenario.id)}">
    <header class="cw-hero">
      <div><span class="cw-kicker">${escapeHtml(profile.code)} · LOCAL SIMULATION</span><h2>${escapeHtml(profile.title)}</h2><p>${escapeHtml(profile.detail)}</p></div>
      <div class="cw-clock"><span>${escapeHtml(frame.phase)}</span><strong>${formatClock(frame.timeMs)}</strong><small>${Math.round((frame.progress ?? 0) * 100)}% COMPLETE</small></div>
    </header>

    <nav class="cw-phase-rail" aria-label="Scene phases">${phaseRail(scenario, frame)}</nav>

    <div class="cw-main-grid">
      <section class="cw-lane cw-pressure-lane"><header><span>01</span><strong>${escapeHtml(profile.pressureLabel)}</strong></header>${nodeLane(lanes.pressure, frame)}</section>
      <section class="cw-center-stage">
        <div class="cw-current-cue severity-${safeClass(frame.activeEvent?.severity ?? 'info')}">
          <span>NOW · ${formatClock(frame.activeEvent?.at ?? 0)}</span><h3>${escapeHtml(activeTitle)}</h3><p>${escapeHtml(activeDetail)}</p>
        </div>
        ${specialVisual(profile.visual, frame)}
        <section class="cw-protected-deck"><header><span>PROTECTED LANE</span><strong>${escapeHtml(profile.protectedLabel)}</strong></header><div>${protectedStrip(lanes.protectedNodes, frame)}</div></section>
      </section>
      <section class="cw-lane cw-defense-lane"><header><span>02</span><strong>${escapeHtml(profile.defenseLabel)}</strong></header>${nodeLane(lanes.defense, frame)}<div class="cw-metric-deck">${metricDeck(frame)}</div></section>
    </div>

    <section class="cw-caption"><span>DIRECTOR CAPTION</span><strong>${escapeHtml(frame.caption)}</strong></section>

    <div class="cw-lower-grid">
      <section class="cw-cue-deck">${cueCard(cues.previous, 'PREVIOUS')}${cueCard(cues.current, 'CURRENT')}${cueCard(cues.next, 'NEXT')}</section>
      <section class="cw-log-deck"><header><span>READ-ONLY TELEMETRY</span><strong>DETAIL CHANNEL</strong></header>${logDeck(frame)}</section>
    </div>

    <footer class="cw-footer"><span>CAMERA · ${escapeHtml(requestedShot.toUpperCase())} → ${escapeHtml(shot.toUpperCase())}</span><strong>SIMULATION ONLY · NO NETWORK TRANSPORT · NO COMMAND EXECUTION</strong><span>${escapeHtml(scenario.title)}</span></footer>
  </section>`;
}
