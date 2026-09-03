import { validateScenario } from './safety.js';

/** @param {number} value @param {number} min @param {number} max */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** @param {number} milliseconds */
export function formatClock(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((Math.max(0, milliseconds) % 1000) / 100);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
}

export class ScenarioValidationError extends Error {
  /** @param {string[]} errors */
  constructor(errors) {
    super(`Scenario validation failed:\n- ${errors.join('\n- ')}`);
    this.name = 'ScenarioValidationError';
    this.errors = errors;
  }
}

/**
 * Normalize, validate, and freeze scenario data.
 *
 * @param {Record<string, any>} source
 */
export function compileScenario(source) {
  const report = validateScenario(source);
  if (!report.ok) {
    throw new ScenarioValidationError(report.errors);
  }

  const scenario = structuredClone(source);
  scenario.events = [...scenario.events].sort((left, right) => left.at - right.at);
  scenario.initialMetrics = {
    threat: 4,
    trust: 96,
    load: 24,
    containment: 0,
    ...(scenario.initialMetrics ?? {}),
  };
  scenario.__compiled = true;
  scenario.__warnings = report.warnings;

  return deepFreeze(scenario);
}

/** @param {any} value */
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

/**
 * Deterministic playback clock. It has no dependency on requestAnimationFrame,
 * which keeps timeline behavior testable and portable.
 */
export class StageClock {
  /**
   * @param {number} durationMs
   * @param {{loop?: boolean}} [options]
   */
  constructor(durationMs, options = {}) {
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      throw new TypeError('StageClock duration must be a positive number.');
    }
    this.durationMs = durationMs;
    this.loop = options.loop ?? true;
    this.timeMs = 0;
    this.speed = 1;
    this.playing = false;
  }

  play() {
    this.playing = true;
  }

  pause() {
    this.playing = false;
  }

  toggle() {
    this.playing = !this.playing;
    return this.playing;
  }

  /** @param {number} speed */
  setSpeed(speed) {
    if (![0.5, 1, 1.5, 2].includes(speed)) {
      throw new RangeError('Supported playback speeds are 0.5, 1, 1.5, and 2.');
    }
    this.speed = speed;
  }

  /** @param {number} timeMs */
  seek(timeMs) {
    this.timeMs = clamp(Number(timeMs) || 0, 0, this.durationMs);
    return this.timeMs;
  }

  reset() {
    this.timeMs = 0;
    this.playing = false;
  }

  /**
   * @param {number} deltaMs
   * @returns {{previousTimeMs: number, timeMs: number, wrapped: boolean, ended: boolean}}
   */
  step(deltaMs) {
    const previousTimeMs = this.timeMs;
    let wrapped = false;
    let ended = false;

    if (!this.playing || !Number.isFinite(deltaMs) || deltaMs <= 0) {
      return { previousTimeMs, timeMs: this.timeMs, wrapped, ended };
    }

    this.timeMs += deltaMs * this.speed;
    if (this.timeMs >= this.durationMs) {
      if (this.loop) {
        this.timeMs %= this.durationMs;
        wrapped = true;
      } else {
        this.timeMs = this.durationMs;
        this.playing = false;
        ended = true;
      }
    }

    return { previousTimeMs, timeMs: this.timeMs, wrapped, ended };
  }
}

/**
 * @param {Record<string, any>} scenario
 * @param {number} timeMs
 */
export function deriveFrame(scenario, timeMs) {
  if (!scenario?.__compiled) {
    throw new TypeError('deriveFrame expects a compiled scenario.');
  }

  const now = clamp(Number(timeMs) || 0, 0, scenario.durationMs);
  const nodeStates = Object.fromEntries(
    scenario.nodes.map((node) => [
      node.id,
      {
        status: node.status ?? 'idle',
        signal: 0,
        note: node.description ?? '',
      },
    ]),
  );
  const linkStates = Object.fromEntries(
    scenario.links.map((link) => [link.id, { status: link.status ?? 'idle' }]),
  );
  const metrics = { ...scenario.initialMetrics };
  const logs = [];
  const feed = [];
  const metricHistory = Object.fromEntries(
    Object.entries(metrics).map(([key, value]) => [key, [{ at: 0, value }]]),
  );

  let phase = scenario.initialPhase ?? 'STANDBY';
  let caption = scenario.synopsis ?? scenario.subtitle;
  let activeEvent = null;

  for (const event of scenario.events) {
    if (event.at > now) {
      break;
    }

    activeEvent = event;
    if (event.phase) phase = event.phase;
    if (event.caption) caption = event.caption;

    if (event.metrics) {
      for (const [key, value] of Object.entries(event.metrics)) {
        metrics[key] = value;
        metricHistory[key] ??= [];
        metricHistory[key].push({ at: event.at, value });
      }
    }

    for (const mutation of event.nodes ?? []) {
      nodeStates[mutation.id] = {
        ...nodeStates[mutation.id],
        ...mutation,
        signal: Math.max(nodeStates[mutation.id]?.signal ?? 0, mutation.signal ?? 0),
      };
    }

    for (const mutation of event.links ?? []) {
      linkStates[mutation.id] = { ...linkStates[mutation.id], ...mutation };
    }

    for (const log of event.logs ?? []) {
      logs.push({ at: event.at, severity: event.severity ?? 'info', ...log });
    }

    if (event.title) {
      feed.push({
        at: event.at,
        title: event.title,
        detail: event.detail ?? '',
        severity: event.severity ?? 'info',
      });
    }
  }

  const pulses = scenario.events
    .filter((event) => event.flow && event.at <= now && event.at + event.flow.durationMs >= now)
    .map((event) => ({
      ...event.flow,
      progress: clamp((now - event.at) / event.flow.durationMs, 0, 1),
      severity: event.severity ?? 'info',
      eventAt: event.at,
    }));

  return {
    timeMs: now,
    progress: now / scenario.durationMs,
    phase,
    caption,
    metrics,
    metricHistory,
    nodeStates,
    linkStates,
    logs: logs.slice(-14),
    feed: feed.slice(-8).reverse(),
    pulses,
    activeEvent,
  };
}

/**
 * Return events crossed during forward playback. Wrapped timelines are handled
 * by combining the tail and head ranges.
 *
 * @param {Record<string, any>} scenario
 * @param {number} previousTimeMs
 * @param {number} timeMs
 * @param {boolean} wrapped
 */
export function getCrossedEvents(scenario, previousTimeMs, timeMs, wrapped = false) {
  if (wrapped) {
    return scenario.events.filter((event) => event.at > previousTimeMs || event.at <= timeMs);
  }
  if (timeMs < previousTimeMs) {
    return [];
  }
  return scenario.events.filter((event) => event.at > previousTimeMs && event.at <= timeMs);
}

/**
 * Cubic Bézier point used to position animated signal particles.
 *
 * @param {{x: number, y: number}} start
 * @param {{x: number, y: number}} controlA
 * @param {{x: number, y: number}} controlB
 * @param {{x: number, y: number}} end
 * @param {number} progress
 */
export function cubicPoint(start, controlA, controlB, end, progress) {
  const t = clamp(progress, 0, 1);
  const inverse = 1 - t;
  return {
    x:
      inverse ** 3 * start.x +
      3 * inverse ** 2 * t * controlA.x +
      3 * inverse * t ** 2 * controlB.x +
      t ** 3 * end.x,
    y:
      inverse ** 3 * start.y +
      3 * inverse ** 2 * t * controlA.y +
      3 * inverse * t ** 2 * controlB.y +
      t ** 3 * end.y,
  };
}

/** @param {{x: number, y: number}} start @param {{x: number, y: number}} end */
export function linkCurve(start, end) {
  const bend = Math.max(46, Math.abs(end.x - start.x) * 0.34);
  const direction = end.x >= start.x ? 1 : -1;
  return {
    start,
    controlA: { x: start.x + bend * direction, y: start.y },
    controlB: { x: end.x - bend * direction, y: end.y },
    end,
  };
}
