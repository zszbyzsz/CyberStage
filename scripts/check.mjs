import { access, readdir, readFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { compileScenario } from '../src/core/engine.js';
import { builtInScenarios } from '../src/data/scenarios.js';

const root = resolve(import.meta.dirname, '..');
const runtimeRoots = [resolve(root, 'src')];
const syntaxRoots = [resolve(root, 'src'), resolve(root, 'scripts'), resolve(root, 'tests')];
const failures = [];

async function walk(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = resolve(path, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(target)));
    else files.push(target);
  }
  return files;
}

const forbiddenRuntimeTokens = [
  ['fe', 'tch', '('].join(''),
  ['Web', 'Socket'].join(''),
  ['XMLHttp', 'Request'].join(''),
  ['Event', 'Source'].join(''),
  ['send', 'Beacon'].join(''),
  ['RTCPeer', 'Connection'].join(''),
];

for (const directory of runtimeRoots) {
  for (const file of await walk(directory)) {
    if (!['.js', '.css'].includes(extname(file))) continue;
    const source = await readFile(file, 'utf8');
    for (const token of forbiddenRuntimeTokens) {
      if (source.includes(token)) failures.push(`${file} contains prohibited runtime capability: ${token}`);
    }
  }
}

const htmlPath = resolve(root, 'index.html');
const html = await readFile(htmlPath, 'utf8');
if (!html.includes("connect-src 'none'")) {
  failures.push('index.html must enforce connect-src none.');
}
if (/https?:\/\//i.test(html)) {
  failures.push('index.html must not depend on external resources.');
}

const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]);
const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
if (duplicateIds.length > 0) {
  failures.push(`index.html contains duplicate ids: ${duplicateIds.join(', ')}`);
}

const appSource = await readFile(resolve(root, 'src/app.js'), 'utf8');
const requiredIds = [...appSource.matchAll(/\$\(['"]#([^'"]+)['"]\)/g)].map((match) => match[1]);
for (const id of requiredIds) {
  if (!ids.includes(id)) failures.push(`src/app.js expects missing element #${id}.`);
}

const localReferences = [...html.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)]
  .map((match) => match[1])
  .filter((value) => !value.startsWith('#') && !value.startsWith('data:'));
for (const reference of localReferences) {
  const path = resolve(dirname(htmlPath), reference.split(/[?#]/, 1)[0]);
  try {
    await access(path, fsConstants.R_OK);
  } catch {
    failures.push(`index.html references a missing local resource: ${reference}`);
  }
}

const examplePath = resolve(root, 'examples/minimal-scene.json');
try {
  compileScenario(JSON.parse(await readFile(examplePath, 'utf8')));
} catch (error) {
  failures.push(`examples/minimal-scene.json: ${error.message}`);
}

for (const source of builtInScenarios) {
  try {
    compileScenario(source);
  } catch (error) {
    failures.push(`${source.id ?? 'unknown scene'}: ${error.message}`);
  }
}

for (const directory of syntaxRoots) {
  for (const file of await walk(directory)) {
    if (extname(file) !== '.js' && extname(file) !== '.mjs') continue;
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status !== 0) failures.push(`${file} failed syntax check:\n${result.stderr}`);
  }
}

if (failures.length > 0) {
  console.error(`CyberStage guard failed:\n- ${failures.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log(
    `CyberStage guard passed: ${builtInScenarios.length} built-in scenes, ${requiredIds.length} DOM bindings, and ${localReferences.length} local resources.`,
  );
}
