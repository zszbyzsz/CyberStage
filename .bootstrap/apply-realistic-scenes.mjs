import { readFile, rm, writeFile } from 'node:fs/promises';

async function update(path, transform) {
  const before = await readFile(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`${path}: patch produced no change`);
  await writeFile(path, after);
  console.log(`patched ${path}`);
}

function replaceOnce(source, needle, replacement, path) {
  const first = source.indexOf(needle);
  if (first < 0) throw new Error(`${path}: expected marker not found`);
  if (source.indexOf(needle, first + needle.length) >= 0) {
    throw new Error(`${path}: expected marker is not unique`);
  }
  return source.replace(needle, replacement);
}

await update('src/data/scenarios.js', (source) => {
  let next = replaceOnce(
    source,
    " */\n\nexport const builtInScenarios = [",
    " */\n\nimport { computerScenarios } from './computer-scenes.js';\n\nexport const builtInScenarios = [",
    'src/data/scenarios.js',
  );
  const end = next.lastIndexOf('\n];');
  if (end < 0) throw new Error('src/data/scenarios.js: array terminator not found');
  next = `${next.slice(0, end)}\n  ...computerScenarios,${next.slice(end)}`;
  return next;
});

await update('src/core/safety.js', (source) => {
  let next = replaceOnce(
    source,
    'const IPV4_PATTERN =',
    `const PROHIBITED_OPERATIONAL_KEYS = new Set([\n  'command',\n  'commands',\n  'shell',\n  'script',\n  'scripts',\n  'payload',\n  'payloads',\n  'exploit',\n  'exploits',\n  'target',\n  'targets',\n  'password',\n  'passwords',\n  'credential',\n  'credentials',\n  'secret',\n  'secrets',\n  'token',\n  'tokens',\n  'port',\n  'ports',\n]);\n\nconst IPV4_PATTERN =`,
    'src/core/safety.js',
  );

  next = replaceOnce(
    next,
    '/** @param {unknown} value */\nfunction isPlainObject(value) {',
    `/**\n * @param {unknown} value\n * @param {string} path\n * @param {{path: string, key: string}[]} output\n */\nfunction collectObjectKeys(value, path, output) {\n  if (Array.isArray(value)) {\n    value.forEach((item, index) => collectObjectKeys(item, \`${'${path}'}[${'${index}'}]\`, output));\n    return;\n  }\n\n  if (value && typeof value === 'object') {\n    Object.entries(value).forEach(([key, item]) => {\n      const keyPath = \`${'${path}'}.${'${key}'}\`;\n      output.push({ path: keyPath, key });\n      collectObjectKeys(item, keyPath, output);\n    });\n  }\n}\n\n/** @param {unknown} value */\nfunction isPlainObject(value) {`,
    'src/core/safety.js',
  );

  next = replaceOnce(
    next,
    "  const strings = [];\n  collectStrings(scenario, '$', strings);",
    `  const operationalKeys = [];\n  collectObjectKeys(scenario, '$', operationalKeys);\n  for (const entry of operationalKeys) {\n    if (PROHIBITED_OPERATIONAL_KEYS.has(entry.key.toLowerCase())) {\n      errors.push(\`${'${entry.path}'} uses prohibited operational field "${'${entry.key}'}".\`);\n    }\n  }\n\n  const strings = [];\n  collectStrings(scenario, '$', strings);`,
    'src/core/safety.js',
  );

  next = replaceOnce(
    next,
    '  nodeTypes: Object.freeze([...ALLOWED_NODE_TYPES]),\n});',
    '  nodeTypes: Object.freeze([...ALLOWED_NODE_TYPES]),\n  prohibitedOperationalKeys: Object.freeze([...PROHIBITED_OPERATIONAL_KEYS]),\n});',
    'src/core/safety.js',
  );
  return next;
});

await update('README.md', (source) => {
  let next = replaceOnce(
    source,
    '  <a href="./docs/scenario-format.md">Create a scene</a>',
    '  <a href="./docs/scenario-format.md">Create a scene</a>\n  ·\n  <a href="./docs/scene-catalogue.md">Scene catalogue</a>',
    'README.md',
  );
  next = replaceOnce(
    next,
    '- Cut between three built-in story worlds: **Ghost Relay**, **Aurora Lockdown**, and **Midnight Switchboard**.',
    '- Cut between [nine built-in story worlds](./docs/scene-catalogue.md), including password auditing, server-control contention, ransomware recovery, phishing response, availability defense, and software-integrity incidents.',
    'README.md',
  );
  return next;
});

await update('README.zh-CN.md', (source) => {
  let next = replaceOnce(
    source,
    '  <a href="./docs/scenario-format.md">编写新场景</a>',
    '  <a href="./docs/scenario-format.md">编写新场景</a>\n  ·\n  <a href="./docs/scene-catalogue.md">场景目录</a>',
    'README.zh-CN.md',
  );
  next = replaceOnce(
    next,
    '- **三套完整剧情**：Ghost Relay、Aurora Lockdown、Midnight Switchboard。',
    '- **九套完整剧情**：除三套原创世界外，新增密码审计、服务器后台控制权争夺、勒索事件恢复、钓鱼会话劫持、流量洪峰和软件供应链篡改；详见[场景目录](./docs/scene-catalogue.md)。',
    'README.zh-CN.md',
  );
  return next;
});

await update('CHANGELOG.md', (source) =>
  replaceOnce(
    source,
    '## [Unreleased]\n\n### Planned',
    `## [Unreleased]\n\n### Added\n\n- Realistic Computer Scene Pack with six defensive incident stories: Cipher Furnace, Control Plane Eclipse, Blackout Ledger, Phantom Inbox, Traffic Avalanche, and Glass Supply Chain.\n- Narrative-safety validation that rejects structured operational fields such as commands, executable payloads, live targets, credentials, and ports.\n- A scene catalogue documenting each built-in story, its visual arc, and its safety boundary.\n\n### Planned`,
    'CHANGELOG.md',
  ),
);

await update('docs/safety-model.md', (source) =>
  replaceOnce(
    source,
    '- non-documentation email domains.',
    '- non-documentation email domains;\n- structured operational fields such as commands, scripts, payloads, live targets, credentials, secrets, tokens, and ports.',
    'docs/safety-model.md',
  ),
);

await rm('.bootstrap', { recursive: true, force: true });
console.log('integration patch complete');
