import { getLinkEndpoints, getNodePosition } from './composer-document.js';
import { element, replace, svgElement } from './composer-dom.js';
import { renderInspector } from './composer-inspector.js';

export const CANVAS_WIDTH = 1100;
export const CANVAS_HEIGHT = 680;
const NODE_WIDTH = 156;
const NODE_HEIGHT = 74;

function nodeLabel(node) {
  return String(node.label ?? node.name ?? node.id);
}

function nodeKind(node) {
  return String(node.kind ?? node.type ?? 'system');
}

function positionFor(node, previewPositions) {
  return previewPositions?.get(node.id) ?? getNodePosition(node);
}

function linkPath(from, to) {
  const startX = from.x + NODE_WIDTH / 2;
  const startY = from.y + NODE_HEIGHT / 2;
  const endX = to.x + NODE_WIDTH / 2;
  const endY = to.y + NODE_HEIGHT / 2;
  const bend = Math.max(70, Math.abs(endX - startX) * 0.45);
  return `M ${startX} ${startY} C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`;
}

function toolbarButton(label, title, onClick, className = '') {
  return element('button', {
    type: 'button',
    className: `composer-button ${className}`.trim(),
    title,
    onClick,
  }, label);
}

export function createComposerView(root, handlers) {
  root.classList.add('scene-composer');

  const title = element('strong', { className: 'composer-title' }, 'Scene Composer');
  const documentName = element('span', { className: 'composer-document-name' });
  const status = element('span', { className: 'composer-status', role: 'status', ariaLive: 'polite' });
  const undoButton = toolbarButton('Undo', 'Undo the last transaction', handlers.undo);
  const redoButton = toolbarButton('Redo', 'Redo the last transaction', handlers.redo);
  const connectButton = toolbarButton('Connect', 'Connect two nodes', handlers.toggleConnect);
  const deleteButton = toolbarButton('Delete', 'Delete the current selection', handlers.deleteSelection, 'danger subtle');
  const scenarioInput = element('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  const stateInput = element('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  scenarioInput.addEventListener('change', () => handlers.importScenario(scenarioInput.files?.[0]));
  stateInput.addEventListener('change', () => handlers.importState(stateInput.files?.[0]));

  const header = element('header', { className: 'composer-header' },
    element('div', { className: 'composer-brand' },
      element('span', { className: 'composer-mark', ariaHidden: true }, 'CS'),
      element('div', {}, title, documentName),
    ),
    element('nav', { className: 'composer-toolbar', ariaLabel: 'Scene editing tools' },
      toolbarButton('Add node', 'Add a node to the center of the canvas', handlers.addNode, 'primary'),
      connectButton,
      deleteButton,
      element('span', { className: 'composer-divider', ariaHidden: true }),
      undoButton,
      redoButton,
      element('span', { className: 'composer-divider', ariaHidden: true }),
      toolbarButton('Import', 'Import a scenario JSON file', () => scenarioInput.click()),
      toolbarButton('Export', 'Validate, round-trip, and export scenario JSON', handlers.exportScenario),
      toolbarButton('State', 'Export the complete serializable composer state', handlers.exportState),
      scenarioInput,
      stateInput,
    ),
    status,
  );

  const linksLayer = svgElement('svg', {
    class: 'composer-links',
    viewBox: `0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    ariaHidden: true,
  });
  const nodesLayer = element('div', { className: 'composer-nodes' });
  const emptyHint = element('div', { className: 'composer-empty' }, 'Double-click to add the first node');
  const canvas = element('div', {
    className: 'composer-canvas',
    tabIndex: 0,
    style: { width: `${CANVAS_WIDTH}px`, height: `${CANVAS_HEIGHT}px` },
    onDoubleClick: handlers.addNodeAtEvent,
    onPointerDown: handlers.clearSelectionFromCanvas,
  }, linksLayer, nodesLayer, emptyHint);
  const viewport = element('div', { className: 'composer-viewport' }, canvas);

  const inspector = element('aside', { className: 'composer-inspector', ariaLabel: 'Selection inspector' });
  const history = element('ol', { className: 'composer-history' });
  const historyPanel = element('section', { className: 'composer-history-panel' },
    element('div', { className: 'composer-history-title' },
      element('span', {}, 'TRANSACTION LOG'),
      toolbarButton('Import state', 'Restore a serialized composer state', () => stateInput.click(), 'tiny'),
    ),
    history,
  );
  const side = element('div', { className: 'composer-side' }, inspector, historyPanel);
  const body = element('main', { className: 'composer-body' }, viewport, side);
  const footer = element('footer', { className: 'composer-footer' },
    element('span', {}, 'Simulation-only visual authoring'),
    element('span', {}, 'Drag • Shift-select • Delete • ⌘/Ctrl-Z'),
  );
  replace(root, header, body, footer);

  function renderLinks(state, previewPositions) {
    const nodes = new Map(state.document.nodes.map((node) => [node.id, positionFor(node, previewPositions)]));
    const fragments = [];
    for (const link of state.document.links) {
      const endpoints = getLinkEndpoints(link);
      const from = nodes.get(endpoints.from);
      const to = nodes.get(endpoints.to);
      if (!from || !to) continue;
      const selected = state.selection.linkId === link.id;
      const path = linkPath(from, to);
      const group = svgElement('g', {
        class: selected ? 'composer-link selected' : 'composer-link',
        dataset: { linkId: link.id },
      });
      const visible = svgElement('path', { d: path, class: 'composer-link-line' });
      const hit = svgElement('path', { d: path, class: 'composer-link-hit' });
      hit.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        handlers.selectLink(link.id);
      });
      group.append(visible, hit);
      fragments.push(group);
    }
    replace(linksLayer, ...fragments);
  }

  function renderNodes(state, previewPositions) {
    const nodes = state.document.nodes.map((node) => {
      const position = positionFor(node, previewPositions);
      const selected = state.selection.nodeIds.includes(node.id);
      const connectionSource = state.interaction.connectFrom === node.id;
      const button = element('button', {
        type: 'button',
        className: [
          'composer-node',
          selected ? 'selected' : '',
          connectionSource ? 'connection-source' : '',
        ].filter(Boolean).join(' '),
        dataset: { nodeId: node.id },
        style: {
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
          width: `${NODE_WIDTH}px`,
          height: `${NODE_HEIGHT}px`,
        },
        onPointerDown: (event) => handlers.nodePointerDown(event, node.id),
      },
      element('span', { className: 'composer-node-kind' }, nodeKind(node)),
      element('strong', {}, nodeLabel(node)),
      element('small', {}, node.id),
      );
      return button;
    });
    replace(nodesLayer, ...nodes);
    emptyHint.hidden = state.document.nodes.length > 0;
  }

  function renderHistory(state) {
    const transactions = state.history.undo.slice(-8).reverse();
    if (transactions.length === 0) {
      replace(history, element('li', { className: 'composer-history-empty' }, 'No committed edits yet'));
      return;
    }
    replace(history, ...transactions.map((transaction, index) => element('li', {
      className: index === 0 ? 'current' : '',
    },
    element('code', {}, transaction.id),
    element('span', {}, transaction.label),
    element('small', {}, `${transaction.steps.length} step${transaction.steps.length === 1 ? '' : 's'}`),
    )));
  }

  return {
    canvas,
    render(state, options = {}) {
      documentName.textContent = String(state.document.title ?? state.document.name ?? state.document.id ?? 'Untitled');
      status.textContent = options.status ?? `${state.document.nodes.length} nodes · ${state.document.links.length} links`;
      status.dataset.tone = options.statusTone ?? 'neutral';
      undoButton.disabled = state.history.undo.length === 0;
      redoButton.disabled = state.history.redo.length === 0;
      deleteButton.disabled = state.selection.nodeIds.length === 0 && !state.selection.linkId;
      connectButton.classList.toggle('active', state.interaction.mode === 'connect');
      connectButton.textContent = state.interaction.connectFrom ? 'Choose target' : 'Connect';
      canvas.dataset.mode = state.interaction.mode;
      renderLinks(state, options.previewPositions);
      renderNodes(state, options.previewPositions);
      renderInspector(inspector, state, handlers);
      renderHistory(state);
    },
    resetScenarioInput() { scenarioInput.value = ''; },
    resetStateInput() { stateInput.value = ''; },
  };
}
