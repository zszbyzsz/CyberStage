import { getLinkEndpoints, getNodePosition } from './composer-document.js';
import { element, labeledInput, replace } from './composer-dom.js';

function textInput(value, onCommit, options = {}) {
  const input = element('input', {
    type: options.type ?? 'text',
    value: value ?? '',
    step: options.step,
    className: 'composer-input',
  });
  input.addEventListener('change', () => onCommit(options.type === 'number' ? Number(input.value) : input.value));
  return input;
}

function emptyInspector(state, handlers) {
  const title = String(state.document.title ?? state.document.name ?? 'Untitled scenario');
  return [
    element('div', { className: 'composer-inspector-heading' },
      element('p', { className: 'composer-kicker' }, 'SCENARIO'),
      element('h2', {}, 'Document'),
    ),
    labeledInput('Title', textInput(title, (value) => handlers.updateDocumentTitle(value))),
    element('dl', { className: 'composer-facts' },
      element('div', {}, element('dt', {}, 'Nodes'), element('dd', {}, state.document.nodes.length)),
      element('div', {}, element('dt', {}, 'Links'), element('dd', {}, state.document.links.length)),
      element('div', {}, element('dt', {}, 'Transactions'), element('dd', {}, state.history.undo.length)),
    ),
    element('p', { className: 'composer-help' }, 'Select a node or link to edit it. Double-click the canvas to create a node.'),
  ];
}

function nodeInspector(node, handlers) {
  const position = getNodePosition(node);
  const labelKey = Object.hasOwn(node, 'name') && !Object.hasOwn(node, 'label') ? 'name' : 'label';
  const kindKey = Object.hasOwn(node, 'type') && !Object.hasOwn(node, 'kind') ? 'type' : 'kind';
  return [
    element('div', { className: 'composer-inspector-heading' },
      element('p', { className: 'composer-kicker' }, 'NODE'),
      element('h2', {}, node.id),
    ),
    labeledInput('Label', textInput(node[labelKey] ?? node.id, (value) => handlers.updateNode(node.id, { [labelKey]: value }))),
    labeledInput('Kind', textInput(node[kindKey] ?? 'system', (value) => handlers.updateNode(node.id, { [kindKey]: value }))),
    element('div', { className: 'composer-field-grid' },
      labeledInput('X', textInput(position.x, (value) => handlers.moveSingleNode(node.id, { x: value, y: position.y }), { type: 'number', step: '1' })),
      labeledInput('Y', textInput(position.y, (value) => handlers.moveSingleNode(node.id, { x: position.x, y: value }), { type: 'number', step: '1' })),
    ),
    element('button', { className: 'composer-button danger', type: 'button', onClick: handlers.deleteSelection }, 'Delete node'),
  ];
}

function linkInspector(link, handlers) {
  const endpoints = getLinkEndpoints(link);
  const labelKey = Object.hasOwn(link, 'name') && !Object.hasOwn(link, 'label') ? 'name' : 'label';
  const kindKey = Object.hasOwn(link, 'type') && !Object.hasOwn(link, 'kind') ? 'type' : 'kind';
  return [
    element('div', { className: 'composer-inspector-heading' },
      element('p', { className: 'composer-kicker' }, 'LINK'),
      element('h2', {}, link.id),
    ),
    element('dl', { className: 'composer-facts' },
      element('div', {}, element('dt', {}, 'From'), element('dd', {}, endpoints.from)),
      element('div', {}, element('dt', {}, 'To'), element('dd', {}, endpoints.to)),
    ),
    labeledInput('Label', textInput(link[labelKey] ?? '', (value) => handlers.updateLink(link.id, { [labelKey]: value }))),
    labeledInput('Kind', textInput(link[kindKey] ?? 'signal', (value) => handlers.updateLink(link.id, { [kindKey]: value }))),
    element('button', { className: 'composer-button danger', type: 'button', onClick: handlers.deleteSelection }, 'Delete link'),
  ];
}

export function renderInspector(container, state, handlers) {
  const selectedNode = state.selection.nodeIds.length === 1
    ? state.document.nodes.find((node) => node.id === state.selection.nodeIds[0])
    : null;
  const selectedLink = state.selection.linkId
    ? state.document.links.find((link) => link.id === state.selection.linkId)
    : null;
  let children;
  if (selectedNode) children = nodeInspector(selectedNode, handlers);
  else if (selectedLink) children = linkInspector(selectedLink, handlers);
  else if (state.selection.nodeIds.length > 1) {
    children = [
      element('div', { className: 'composer-inspector-heading' },
        element('p', { className: 'composer-kicker' }, 'SELECTION'),
        element('h2', {}, `${state.selection.nodeIds.length} nodes`),
      ),
      element('p', { className: 'composer-help' }, 'Drag any selected node to move the group in one transaction.'),
      element('button', { className: 'composer-button danger', type: 'button', onClick: handlers.deleteSelection }, 'Delete selection'),
    ];
  } else children = emptyInspector(state, handlers);
  replace(container, ...children);
}
