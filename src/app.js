import {
  StageClock,
  compileScenario,
  deriveFrame,
  formatClock,
  getCrossedEvents,
} from './core/engine.js';
import { builtInScenarios } from './data/scenarios.js';
import {
  renderFeed,
  renderMetrics,
  renderNodeInspector,
  renderScenarioBrief,
  renderTerminal,
  renderTimelineMarkers,
  renderTopology,
} from './ui/render.js';

const $ = (selector) => document.querySelector(selector);

const elements = {
  scenarioSelect: $('#scenario-select'),
  scenarioBrief: $('#scenario-brief'),
  nodeInspector: $('#node-inspector'),
  topology: $('#topology'),
  metrics: $('#metrics'),
  eventFeed: $('#event-feed'),
  terminal: $('#terminal-output'),
  caption: $('#scene-caption'),
  phase: $('#phase-label'),
  clock: $('#clock-readout'),
  duration: $('#duration-readout'),
  timeline: $('#timeline-input'),
  timelineMarkers: $('#timeline-markers'),
  play: $('#play-button'),
  reset: $('#reset-button'),
  back: $('#back-button'),
  forward: $('#forward-button'),
  random: $('#random-button'),
  broadcast: $('#broadcast-button'),
  sound: $('#sound-button'),
  fullscreen: $('#fullscreen-button'),
  importButton: $('#import-button'),
  importInput: $('#import-input'),
  toast: $('#toast'),
  stageState: $('#stage-state'),
  scenarioCount: $('#scenario-count'),
  liveDot: $('#live-dot'),
};

class LocalSoundscape {
  constructor() {
    this.enabled = false;
    this.context = null;
  }

  async toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) {
      const Context = window.AudioContext ?? window.webkitAudioContext;
      if (!Context) {
        this.enabled = false;
        throw new Error('Web Audio is not available in this browser.');
      }
      this.context ??= new Context();
      await this.context.resume();
      this.cue('success');
    }
    return this.enabled;
  }

  cue(severity) {
    if (!this.enabled || !this.context) return;

    const frequencies = {
      info: 360,
      low: 420,
      medium: 520,
      high: 660,
      critical: 190,
      success: 760,
    };
    const durations = { critical: 0.24, high: 0.16, success: 0.18 };
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = severity === 'critical' ? 'sawtooth' : 'sine';
    oscillator.frequency.setValueAtTime(frequencies[severity] ?? 420, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.055, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (durations[severity] ?? 0.11));
    oscillator.connect(gain);
    gain.connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + (durations[severity] ?? 0.11) + 0.02);
  }
}

const catalogue = builtInScenarios.map((source) => ({
  key: `built:${source.id}`,
  custom: false,
  scenario: compileScenario(source),
}));

let activeEntry = catalogue[0];
let clock = new StageClock(activeEntry.scenario.durationMs, { loop: true });
let selectedNodeId = activeEntry.scenario.nodes[0].id;
let broadcastMode = false;
let dirty = true;
let lastAnimationTime = performance.now();
let lastRenderTime = 0;
let toastTimer = null;
let importedCounter = 0;
const soundscape = new LocalSoundscape();

function refreshScenarioOptions() {
  elements.scenarioSelect.innerHTML = catalogue
    .map(
      (entry) =>
        `<option value="${entry.key}">${entry.custom ? 'LOCAL · ' : ''}${entry.scenario.title}</option>`,
    )
    .join('');
  elements.scenarioSelect.value = activeEntry.key;
  elements.scenarioCount.textContent = `${catalogue.length} SCENES`;
}

function findEntryBySceneId(sceneId) {
  return catalogue.find((entry) => !entry.custom && entry.scenario.id === sceneId) ?? catalogue[0];
}

function applyScenario(entry, options = {}) {
  const shouldPlay = options.autoplay ?? false;
  activeEntry = entry;
  clock = new StageClock(entry.scenario.durationMs, { loop: true });
  clock.setSpeed(1);
  selectedNodeId = entry.scenario.nodes[0].id;
  document.documentElement.dataset.theme = entry.scenario.theme;
  document.title = `${entry.scenario.title} · CyberStage`;
  elements.scenarioBrief.innerHTML = renderScenarioBrief(entry.scenario);
  elements.timeline.max = String(entry.scenario.durationMs);
  elements.duration.textContent = formatClock(entry.scenario.durationMs);
  refreshScenarioOptions();
  updateSceneQuery(entry.scenario.id);
  if (shouldPlay) clock.play();
  dirty = true;
  renderFrame(true);
}

function updateSceneQuery(sceneId) {
  const url = new URL(window.location.href);
  url.searchParams.set('scene', sceneId);
  url.searchParams.delete('t');
  url.searchParams.delete('autoplay');
  window.history.replaceState({}, '', url);
}

function renderFrame(force = false) {
  if (!force && !dirty && !clock.playing) return;

  const scenario = activeEntry.scenario;
  const frame = deriveFrame(scenario, clock.timeMs);
  elements.topology.innerHTML = renderTopology(scenario, frame, selectedNodeId);
  elements.metrics.innerHTML = renderMetrics(frame);
  elements.eventFeed.innerHTML = renderFeed(frame);
  elements.terminal.innerHTML = renderTerminal(frame);
  elements.nodeInspector.innerHTML = renderNodeInspector(scenario, frame, selectedNodeId);
  elements.timelineMarkers.innerHTML = renderTimelineMarkers(scenario, frame);
  elements.caption.textContent = frame.caption;
  elements.phase.textContent = frame.phase;
  elements.clock.textContent = formatClock(frame.timeMs);
  elements.timeline.value = String(Math.round(frame.timeMs));
  elements.play.textContent = clock.playing ? 'Ⅱ  PAUSE' : '▶  PLAY';
  elements.play.setAttribute('aria-label', clock.playing ? 'Pause scene' : 'Play scene');
  elements.liveDot.classList.toggle('is-live', clock.playing);

  document.querySelectorAll('[data-speed]').forEach((button) => {
    button.setAttribute('aria-pressed', String(Number(button.dataset.speed) === clock.speed));
  });

  const threat = frame.metrics.threat;
  const stageState = threat >= 70 ? 'CRITICAL' : threat >= 40 ? 'ELEVATED' : threat >= 15 ? 'WATCH' : 'NOMINAL';
  elements.stageState.textContent = stageState;
  elements.stageState.dataset.level = stageState.toLowerCase();

  dirty = false;
}

function animationLoop(timestamp) {
  const delta = Math.min(120, Math.max(0, timestamp - lastAnimationTime));
  lastAnimationTime = timestamp;
  const result = clock.step(delta);

  if (clock.playing) {
    const crossed = getCrossedEvents(activeEntry.scenario, result.previousTimeMs, result.timeMs, result.wrapped);
    for (const event of crossed) {
      if (event.title) soundscape.cue(event.severity ?? 'info');
    }
  }

  if (dirty || clock.playing) {
    if (timestamp - lastRenderTime >= 32 || dirty) {
      renderFrame();
      lastRenderTime = timestamp;
    }
  }

  window.requestAnimationFrame(animationLoop);
}

function togglePlayback() {
  clock.toggle();
  dirty = true;
  renderFrame(true);
}

function seekBy(deltaMs) {
  clock.seek(clock.timeMs + deltaMs);
  dirty = true;
  renderFrame(true);
}

function showToast(message, tone = 'info') {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.dataset.tone = tone;
  elements.toast.classList.add('is-visible');
  toastTimer = window.setTimeout(() => elements.toast.classList.remove('is-visible'), 2600);
}

function buildShareUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set('scene', activeEntry.scenario.id);
  url.searchParams.set('t', String(Math.round(clock.timeMs)));
  if (clock.playing) url.searchParams.set('autoplay', '1');
  else url.searchParams.delete('autoplay');
  if (broadcastMode) url.searchParams.set('broadcast', '1');
  else url.searchParams.delete('broadcast');
  return url.toString();
}

async function copySceneLink() {
  const value = buildShareUrl();
  try {
    await navigator.clipboard.writeText(value);
    showToast('Scene link copied to clipboard.', 'success');
  } catch {
    const field = document.createElement('textarea');
    field.value = value;
    field.setAttribute('readonly', '');
    document.body.append(field);
    field.select();
    document.execCommand('copy');
    field.remove();
    showToast('Scene link copied.', 'success');
  }
}

function toggleBroadcast() {
  broadcastMode = !broadcastMode;
  document.body.classList.toggle('broadcast-mode', broadcastMode);
  elements.broadcast.setAttribute('aria-pressed', String(broadcastMode));
  elements.broadcast.textContent = broadcastMode ? 'EXIT BROADCAST' : 'BROADCAST';
  showToast(broadcastMode ? 'Broadcast framing enabled.' : 'Director framing restored.');
  dirty = true;
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    showToast('Fullscreen was blocked by the browser.', 'warning');
  }
}

function selectRandomScene() {
  const builtIns = catalogue.filter((entry) => !entry.custom);
  if (builtIns.length < 2) return;
  const alternatives = builtIns.filter((entry) => entry.key !== activeEntry.key);
  const entry = alternatives[Math.floor(Math.random() * alternatives.length)];
  applyScenario(entry, { autoplay: clock.playing });
  showToast(`Loaded ${entry.scenario.title}.`);
}

async function importLocalScene(file) {
  if (!file) return;
  if (file.size > 512 * 1024) {
    showToast('Scene file exceeds the 512 KB local import limit.', 'warning');
    return;
  }

  try {
    const source = JSON.parse(await file.text());
    const scenario = compileScenario(source);
    importedCounter += 1;
    const entry = {
      key: `custom:${scenario.id}:${importedCounter}`,
      custom: true,
      scenario,
    };
    catalogue.push(entry);
    applyScenario(entry);
    showToast(`Imported local scene: ${scenario.title}.`, 'success');
  } catch (error) {
    console.error(error);
    const firstLine = String(error.message ?? error).split('\n')[0];
    showToast(firstLine, 'warning');
  } finally {
    elements.importInput.value = '';
  }
}

function isTextInput(target) {
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement;
}

function bindEvents() {
  elements.play.addEventListener('click', togglePlayback);
  elements.reset.addEventListener('click', () => {
    clock.reset();
    dirty = true;
    renderFrame(true);
  });
  elements.back.addEventListener('click', () => seekBy(-5_000));
  elements.forward.addEventListener('click', () => seekBy(5_000));
  elements.random.addEventListener('click', selectRandomScene);
  elements.broadcast.addEventListener('click', toggleBroadcast);
  elements.fullscreen.addEventListener('click', toggleFullscreen);
  $('#copy-link-button').addEventListener('click', copySceneLink);

  elements.sound.addEventListener('click', async () => {
    try {
      const enabled = await soundscape.toggle();
      elements.sound.setAttribute('aria-pressed', String(enabled));
      elements.sound.textContent = enabled ? 'SOUND ON' : 'SOUND OFF';
      showToast(enabled ? 'Local synthesized sound enabled.' : 'Sound disabled.');
    } catch (error) {
      showToast(error.message, 'warning');
    }
  });

  elements.scenarioSelect.addEventListener('change', () => {
    const entry = catalogue.find((item) => item.key === elements.scenarioSelect.value);
    if (entry) applyScenario(entry);
  });

  elements.timeline.addEventListener('input', () => {
    clock.seek(Number(elements.timeline.value));
    dirty = true;
    renderFrame(true);
  });

  document.querySelectorAll('[data-speed]').forEach((button) => {
    button.addEventListener('click', () => {
      clock.setSpeed(Number(button.dataset.speed));
      dirty = true;
      renderFrame(true);
    });
  });

  elements.topology.addEventListener('click', (event) => {
    const node = event.target.closest('[data-node-id]');
    if (!node) return;
    selectedNodeId = node.dataset.nodeId;
    dirty = true;
    renderFrame(true);
  });

  elements.topology.addEventListener('keydown', (event) => {
    if (!['Enter', ' '].includes(event.key)) return;
    const node = event.target.closest('[data-node-id]');
    if (!node) return;
    event.preventDefault();
    selectedNodeId = node.dataset.nodeId;
    dirty = true;
    renderFrame(true);
  });

  elements.eventFeed.addEventListener('click', (event) => {
    const cue = event.target.closest('[data-seek-ms]');
    if (!cue) return;
    clock.seek(Number(cue.dataset.seekMs));
    dirty = true;
    renderFrame(true);
  });

  elements.importButton.addEventListener('click', () => elements.importInput.click());
  elements.importInput.addEventListener('change', () => importLocalScene(elements.importInput.files?.[0]));

  document.addEventListener('keydown', (event) => {
    if (isTextInput(event.target)) return;
    if (event.key === ' ') {
      event.preventDefault();
      togglePlayback();
    } else if (event.key === 'ArrowLeft') {
      seekBy(-5_000);
    } else if (event.key === 'ArrowRight') {
      seekBy(5_000);
    } else if (event.key.toLowerCase() === 'r') {
      clock.reset();
      dirty = true;
      renderFrame(true);
    } else if (event.key.toLowerCase() === 'b') {
      toggleBroadcast();
    } else if (event.key.toLowerCase() === 'f') {
      toggleFullscreen();
    } else if (/^[1-9]$/.test(event.key)) {
      const entry = catalogue[Number(event.key) - 1];
      if (entry) applyScenario(entry);
    }
  });

  document.addEventListener('fullscreenchange', () => {
    elements.fullscreen.textContent = document.fullscreenElement ? 'EXIT FULLSCREEN' : 'FULLSCREEN';
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && clock.playing) {
      clock.pause();
      dirty = true;
    }
  });
}

function initialize() {
  refreshScenarioOptions();
  bindEvents();

  const params = new URLSearchParams(window.location.search);
  const entry = findEntryBySceneId(params.get('scene'));
  applyScenario(entry);

  const requestedTime = Number(params.get('t'));
  if (Number.isFinite(requestedTime) && requestedTime > 0) {
    clock.seek(requestedTime);
  }
  if (params.get('broadcast') === '1') toggleBroadcast();
  if (params.get('autoplay') === '1' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    clock.play();
  }

  dirty = true;
  renderFrame(true);
  window.requestAnimationFrame(animationLoop);
}

initialize();
