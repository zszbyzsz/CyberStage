import {
  createStarterScenario,
  exportScenario,
  getNodePosition,
} from './composer-document.js';
import {
  cancelConnection,
  clearSelection,
  createComposerState,
  redo,
  selectLink,
  selectNode,
  serializeComposerState,
  setInteractionMode,
  undo,
} from './composer-state.js';
import {
  addNode,
  chooseConnectionNode,
  deleteSelection,
  moveNodes,
  updateDocumentField,
  updateLink,
  updateNode,
} from './composer-commands.js';
import {
  downloadText,
  exportComposerStateText,
  importComposerStateText,
  importScenarioText,
  readTextFile,
  verifyScenarioRoundTrip,
} from './composer-io.js';
import { CANVAS_HEIGHT, CANVAS_WIDTH, createComposerView } from './composer-view.js';

const GRID = 10;
const NODE_WIDTH = 156;
const NODE_HEIGHT = 74;

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function snap(value, enabled) {
  return enabled ? Math.round(value / GRID) * GRID : Math.round(value * 1000) / 1000;
}

function safeFilename(value) {
  const name = String(value ?? 'scenario')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return name || 'scenario';
}

function inputLike(target) {
  return target instanceof HTMLElement && (target.matches('input, textarea, select') || target.isContentEditable);
}

export function mountSceneComposer(root, initialDocument = createStarterScenario()) {
  if (!(root instanceof HTMLElement)) throw new TypeError('Scene Composer requires a root element.');

  let state = createComposerState(initialDocument);
  let previewPositions = null;
  let status = '';
  let statusTone = 'neutral';
  let disposed = false;
  let view;

  function render() {
    if (disposed) return;
    view.render(state, { previewPositions, status, statusTone });
  }

  function announce(message, tone = 'neutral') {
    status = message;
    statusTone = tone;
    render();
  }

  function apply(operation, successMessage = '') {
    try {
      state = operation(state);
      previewPositions = null;
      status = successMessage;
      statusTone = 'neutral';
      render();
      return true;
    } catch (error) {
      announce(error?.message ?? String(error), 'error');
      return false;
    }
  }

  function canvasPosition(event) {
    const rect = view.canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    return {
      x: clamp((event.clientX - rect.left) * scaleX - NODE_WIDTH / 2, 0, CANVAS_WIDTH - NODE_WIDTH),
      y: clamp((event.clientY - rect.top) * scaleY - NODE_HEIGHT / 2, 0, CANVAS_HEIGHT - NODE_HEIGHT),
    };
  }

  function addNodeAt(position) {
    apply((current) => addNode(current, {
      x: snap(position.x, true),
      y: snap(position.y, true),
    }), 'Node added as one transaction');
  }

  function nodePointerDown(event, nodeId) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    if (state.interaction.mode === 'connect') {
      apply((current) => chooseConnectionNode(current, nodeId), state.interaction.connectFrom ? 'Link committed' : 'Choose a target node');
      return;
    }

    if (!state.selection.nodeIds.includes(nodeId) || event.shiftKey) {
      apply((current) => selectNode(current, nodeId, { additive: event.shiftKey }));
    }
    if (!state.selection.nodeIds.includes(nodeId)) return;

    const startClient = { x: event.clientX, y: event.clientY };
    const startPositions = new Map(state.selection.nodeIds.map((id) => {
      const node = state.document.nodes.find((entry) => entry.id === id);
      return [id, getNodePosition(node)];
    }));
    const dragState = state;
    const rect = view.canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    let moved = false;

    function onMove(moveEvent) {
      const dx = (moveEvent.clientX - startClient.x) * scaleX;
      const dy = (moveEvent.clientY - startClient.y) * scaleY;
      if (Math.hypot(dx, dy) < 2 && !moved) return;
      moved = true;
      previewPositions = new Map();
      for (const [id, origin] of startPositions) {
        previewPositions.set(id, {
          x: clamp(snap(origin.x + dx, !moveEvent.altKey), 0, CANVAS_WIDTH - NODE_WIDTH),
          y: clamp(snap(origin.y + dy, !moveEvent.altKey), 0, CANVAS_HEIGHT - NODE_HEIGHT),
        });
      }
      render();
    }

    function finish() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', cancel);
      if (!moved || !previewPositions) {
        previewPositions = null;
        render();
        return;
      }
      const committedPositions = previewPositions;
      previewPositions = null;
      state = dragState;
      apply((current) => moveNodes(current, committedPositions), `Moved ${committedPositions.size} node${committedPositions.size === 1 ? '' : 's'} in one transaction`);
    }

    function cancel() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', cancel);
      previewPositions = null;
      render();
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', finish, { once: true });
    window.addEventListener('pointercancel', cancel, { once: true });
  }

  const handlers = {
    addNode() {
      const offset = (state.document.nodes.length % 7) * 24;
      addNodeAt({ x: CANVAS_WIDTH / 2 - NODE_WIDTH / 2 + offset, y: CANVAS_HEIGHT / 2 - NODE_HEIGHT / 2 + offset });
    },
    addNodeAtEvent(event) {
      if (event.target.closest?.('.composer-node')) return;
      addNodeAt(canvasPosition(event));
    },
    clearSelectionFromCanvas(event) {
      if (event.target.closest?.('.composer-node, .composer-link-hit')) return;
      apply((current) => current.interaction.mode === 'connect' ? cancelConnection(current) : clearSelection(current));
    },
    nodePointerDown,
    selectLink(id) {
      apply((current) => selectLink(current, id));
    },
    toggleConnect() {
      apply((current) => current.interaction.mode === 'connect'
        ? cancelConnection(current)
        : setInteractionMode(current, 'connect'),
      state.interaction.mode === 'connect' ? 'Connection cancelled' : 'Choose a source node');
    },
    deleteSelection() {
      if (state.selection.nodeIds.length === 0 && !state.selection.linkId) return;
      apply((current) => deleteSelection(current), 'Selection deleted as one transaction');
    },
    undo() {
      apply((current) => undo(current), 'Transaction undone');
    },
    redo() {
      apply((current) => redo(current), 'Transaction redone');
    },
    updateNode(id, patch) {
      apply((current) => updateNode(current, id, patch), `${id} updated`);
    },
    updateLink(id, patch) {
      apply((current) => updateLink(current, id, patch), `${id} updated`);
    },
    moveSingleNode(id, position) {
      apply((current) => moveNodes(current, new Map([[id, position]])), `${id} moved`);
    },
    updateDocumentTitle(value) {
      const key = Object.hasOwn(state.document, 'name') && !Object.hasOwn(state.document, 'title') ? 'name' : 'title';
      apply((current) => updateDocumentField(current, key, value), 'Scenario title updated');
    },
    async exportScenario() {
      try {
        announce('Validating and verifying round-trip…');
        const result = await verifyScenarioRoundTrip(state);
        if (!result.ok) throw new Error('Export round-trip changed canonical bytes.');
        const name = safeFilename(state.document.id ?? state.document.title ?? state.document.name);
        downloadText(`${name}.json`, result.first);
        announce('Validated · export/import bytes are identical', 'success');
      } catch (error) {
        announce(error?.message ?? String(error), 'error');
      }
    },
    exportState() {
      try {
        const name = safeFilename(state.document.id ?? 'scene-composer');
        downloadText(`${name}.composer-state.json`, exportComposerStateText(state));
        announce('Serializable composer state exported', 'success');
      } catch (error) {
        announce(error?.message ?? String(error), 'error');
      }
    },
    async importScenario(file) {
      if (!file) return;
      try {
        announce('Validating imported scenario…');
        state = await importScenarioText(await readTextFile(file));
        previewPositions = null;
        announce('Scenario imported and canonicalized', 'success');
      } catch (error) {
        announce(error?.message ?? String(error), 'error');
      } finally {
        view.resetScenarioInput();
      }
    },
    async importState(file) {
      if (!file) return;
      try {
        announce('Validating serialized composer state…');
        state = await importComposerStateText(await readTextFile(file));
        previewPositions = null;
        announce('Composer state restored with transaction history', 'success');
      } catch (error) {
        announce(error?.message ?? String(error), 'error');
      } finally {
        view.resetStateInput();
      }
    },
  };

  function onKeyDown(event) {
    if (inputLike(event.target)) return;
    const modifier = event.metaKey || event.ctrlKey;
    if (modifier && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) handlers.redo();
      else handlers.undo();
    } else if (modifier && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      handlers.redo();
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      handlers.deleteSelection();
    } else if (event.key === 'Escape' && state.interaction.mode === 'connect') {
      handlers.toggleConnect();
    }
  }

  view = createComposerView(root, handlers);
  document.addEventListener('keydown', onKeyDown);
  status = `${state.document.nodes.length} nodes · ${state.document.links.length} links`;
  render();

  return {
    getState: () => state,
    getScenarioText: () => exportScenario(state.document),
    getStateText: () => serializeComposerState(state),
    replaceState(nextState) {
      state = nextState;
      previewPositions = null;
      render();
    },
    destroy() {
      disposed = true;
      document.removeEventListener('keydown', onKeyDown);
      root.replaceChildren();
      root.classList.remove('scene-composer');
    },
  };
}
