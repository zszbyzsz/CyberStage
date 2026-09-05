import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Scene Composer has a static entrypoint and build integration', async () => {
  const [html, packageJson, buildScript] = await Promise.all([
    read('composer.html'),
    read('package.json'),
    read('scripts/build-composer.mjs'),
  ]);
  assert.match(html, /data-scene-composer/);
  assert.match(html, /src\/composer\/composer-entry\.js/);
  assert.match(html, /src\/composer\/composer\.css/);
  assert.match(packageJson, /build-composer\.mjs/);
  assert.match(buildScript, /dist\/composer\.html/);
});

test('view construction keeps imported labels out of HTML parsing sinks', async () => {
  const files = await Promise.all([
    read('src/composer/composer-dom.js'),
    read('src/composer/composer-view.js'),
    read('src/composer/composer-inspector.js'),
    read('src/composer/composer-app.js'),
  ]);
  const source = files.join('\n');
  assert.doesNotMatch(source, /\.innerHTML\s*=/);
  assert.doesNotMatch(source, /\.outerHTML\s*=/);
  assert.doesNotMatch(source, /insertAdjacentHTML\s*\(/);
  assert.doesNotMatch(source, /\beval\s*\(/);
  assert.doesNotMatch(source, /new\s+Function\s*\(/);
});

test('topology mutations are routed through the transaction state module', async () => {
  const [commands, app] = await Promise.all([
    read('src/composer/composer-commands.js'),
    read('src/composer/composer-app.js'),
  ]);
  assert.match(commands, /commit\(state,/);
  assert.match(commands, /type: 'insert'/);
  assert.match(commands, /type: 'remove'/);
  assert.match(commands, /type: 'update'/);
  assert.match(app, /moveNodes\(current, committedPositions\)/);
  assert.doesNotMatch(app, /state\.document\.(nodes|links)\s*=/);
});
