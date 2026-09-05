const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

function append(parent, child) {
  if (child === null || child === undefined || child === false) return;
  if (Array.isArray(child)) {
    child.forEach((entry) => append(parent, entry));
    return;
  }
  parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
}

function applyAttributes(node, attributes) {
  for (const [key, value] of Object.entries(attributes ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'className') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style') Object.assign(node.style, value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key in node && !key.includes('-')) node[key] = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  }
}

export function element(tag, attributes, ...children) {
  const node = document.createElement(tag);
  applyAttributes(node, attributes);
  children.forEach((child) => append(node, child));
  return node;
}

export function svgElement(tag, attributes, ...children) {
  const node = document.createElementNS(SVG_NAMESPACE, tag);
  applyAttributes(node, attributes);
  children.forEach((child) => append(node, child));
  return node;
}

export function replace(node, ...children) {
  const fragment = document.createDocumentFragment();
  children.forEach((child) => append(fragment, child));
  node.replaceChildren(fragment);
}

export function labeledInput(label, input) {
  return element('label', { className: 'composer-field' },
    element('span', {}, label),
    input,
  );
}
