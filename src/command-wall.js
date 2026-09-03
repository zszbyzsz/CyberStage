import { compileScenario, deriveFrame } from './core/engine.js';
import { builtInScenarios } from './data/scenarios.js';
import { renderCommandWall, resolveWallShot, WALL_SHOTS } from './ui/command-wall.js';

const sceneSelect = document.querySelector('#scenario-select');
const timeline = document.querySelector('#timeline-input');
const stagePanel = document.querySelector('.stage-panel');
const topology = document.querySelector('#topology');
const actionHost = document.querySelector('.director-actions');
const stageToolbar = document.querySelector('.stage-toolbar');

if (!sceneSelect || !timeline || !stagePanel || !actionHost || !stageToolbar) {
  throw new Error('CyberStage Command Wall could not bind to the director interface.');
}

const compiledScenes = new Map(
  builtInScenarios.map((source) => {
    const scene = compileScenario(source);
    return [scene.id, scene];
  }),
);

const wallButton = document.createElement('button');
wallButton.id = 'command-wall-button';
wallButton.className = 'control-button command-wall-button';
wallButton.type = 'button';
wallButton.setAttribute('aria-pressed', 'false');
wallButton.textContent = 'COMMAND WALL';

actionHost.insertBefore(wallButton, document.querySelector('#broadcast-button'));

const shotControls = document.createElement('div');
shotControls.className = 'command-wall-shot-controls';
shotControls.setAttribute('aria-label', 'Command Wall camera shots');
shotControls.hidden = true;
shotControls.innerHTML = WALL_SHOTS.map(
  (shotName) => `<button type="button" data-command-shot="${shotName}" aria-pressed="${shotName === 'auto'}">${shotName.toUpperCase()}</button>`,
).join('');
stageToolbar.append(shotControls);

const surface = document.createElement('div');
surface.id = 'command-wall-surface';
surface.className = 'command-wall-surface';
surface.setAttribute('aria-live', 'off');
surface.hidden = true;
stagePanel.insertBefore(surface, topology);

let active = false;
let shot = 'auto';
let selectedNodeId = '';
let lastRenderKey = '';
let lastSceneId = '';
let animationHandle = 0;

function selectedScene() {
  const value = String(sceneSelect.value ?? '');
  if (!value.startsWith('built:')) return null;
  return compiledScenes.get(value.slice('built:'.length)) ?? null;
}

function setTimeline(timeMs) {
  const maximum = Number(timeline.max) || 0;
  timeline.value = String(Math.max(0, Math.min(maximum, Number(timeMs) || 0)));
  timeline.dispatchEvent(new Event('input', { bubbles: true }));
  timeline.dispatchEvent(new Event('change', { bubbles: true }));
  lastRenderKey = '';
}

function updateUrlState() {
  const url = new URL(window.location.href);
  if (active) url.searchParams.set('view', 'wall');
  else url.searchParams.delete('view');
  if (active && shot !== 'auto') url.searchParams.set('shot', shot);
  else url.searchParams.delete('shot');
  window.history.replaceState(null, '', url);
}

function refreshShotButtons(framePhase = '') {
  const effective = resolveWallShot(shot, framePhase);
  for (const button of shotControls.querySelectorAll('[data-command-shot]')) {
    const value = button.getAttribute('data-command-shot');
    button.setAttribute('aria-pressed', String(value === shot));
    button.classList.toggle('is-effective', value === effective && shot === 'auto');
  }
}

function setShot(nextShot, { updateUrl = true } = {}) {
  shot = WALL_SHOTS.includes(nextShot) ? nextShot : 'auto';
  lastRenderKey = '';
  refreshShotButtons();
  if (updateUrl) updateUrlState();
}

function toggleWall(force, { updateUrl = true } = {}) {
  active = typeof force === 'boolean' ? force : !active;
  document.body.classList.toggle('command-wall-mode', active);
  surface.hidden = !active;
  shotControls.hidden = !active;
  wallButton.setAttribute('aria-pressed', String(active));
  wallButton.textContent = active ? 'EXIT WALL' : 'COMMAND WALL';
  lastRenderKey = '';
  if (updateUrl) updateUrlState();
}

function cycleShot() {
  const index = WALL_SHOTS.indexOf(shot);
  setShot(WALL_SHOTS[(index + 1) % WALL_SHOTS.length]);
}

function renderUnsupported() {
  surface.innerHTML = `<section class="cw-wall cw-unsupported">
    <div><span>LOCAL SCENE</span><h2>COMMAND WALL NEEDS A BUILT-IN PROFILE</h2><p>Imported JSON remains available in the standard topology view. A future scene format revision will allow custom wall profiles without executable extensions.</p></div>
    <strong>SIMULATION ONLY</strong>
  </section>`;
}

function renderFrame() {
  if (!active) return;
  const scene = selectedScene();
  if (!scene) {
    const key = `unsupported:${sceneSelect.value}`;
    if (lastRenderKey !== key) {
      renderUnsupported();
      lastRenderKey = key;
    }
    return;
  }

  if (scene.id !== lastSceneId) {
    selectedNodeId = scene.nodes[0]?.id ?? '';
    lastSceneId = scene.id;
    lastRenderKey = '';
  }

  const timeMs = Number(timeline.value) || 0;
  const frame = deriveFrame(scene, timeMs);
  const renderKey = [scene.id, Math.floor(timeMs / 120), shot, selectedNodeId].join(':');
  if (renderKey === lastRenderKey) return;

  surface.innerHTML = renderCommandWall(scene, frame, { shot, selectedNodeId });
  surface.dataset.effectiveShot = resolveWallShot(shot, frame.phase);
  refreshShotButtons(frame.phase);
  lastRenderKey = renderKey;
}

function loop() {
  renderFrame();
  animationHandle = window.requestAnimationFrame(loop);
}

wallButton.addEventListener('click', () => toggleWall());

shotControls.addEventListener('click', (event) => {
  const button = event.target.closest('[data-command-shot]');
  if (!button) return;
  setShot(button.getAttribute('data-command-shot'));
});

surface.addEventListener('click', (event) => {
  const seekControl = event.target.closest('[data-wall-seek]');
  if (seekControl) {
    setTimeline(Number(seekControl.getAttribute('data-wall-seek')));
    return;
  }

  const nodeControl = event.target.closest('[data-wall-node]');
  if (!nodeControl) return;
  selectedNodeId = nodeControl.getAttribute('data-wall-node') ?? '';
  lastRenderKey = '';
  const matchingNode = topology.querySelector(`[data-node-id="${selectedNodeId}"]`);
  matchingNode?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});

sceneSelect.addEventListener('change', () => {
  lastSceneId = '';
  lastRenderKey = '';
});

timeline.addEventListener('input', () => {
  lastRenderKey = '';
});

document.addEventListener('keydown', (event) => {
  const eventTarget = event.target;
  if (
    eventTarget instanceof HTMLElement &&
    (eventTarget.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(eventTarget.tagName))
  ) {
    return;
  }
  if (event.key.toLowerCase() === 'w') {
    event.preventDefault();
    toggleWall();
  } else if (event.key.toLowerCase() === 'v') {
    if (!active) toggleWall(true);
    event.preventDefault();
    cycleShot();
  }
});

const initialUrl = new URL(window.location.href);
const requestedShot = initialUrl.searchParams.get('shot');
setShot(requestedShot && WALL_SHOTS.includes(requestedShot) ? requestedShot : 'auto', { updateUrl: false });
if (initialUrl.searchParams.get('view') === 'wall') toggleWall(true, { updateUrl: false });

animationHandle = window.requestAnimationFrame(loop);
window.addEventListener('pagehide', () => window.cancelAnimationFrame(animationHandle), { once: true });
