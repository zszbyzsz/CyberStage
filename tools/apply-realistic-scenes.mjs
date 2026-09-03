import { readFile, rm, writeFile } from 'node:fs/promises';

async function update(path, transform) {
  const before = await readFile(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(path + ': patch produced no change');
  await writeFile(path, after);
  console.log('patched ' + path);
}

function replaceRequired(source, needle, replacement, path) {
  const index = source.indexOf(needle);
  if (index < 0) throw new Error(path + ': expected marker not found');
  return source.slice(0, index) + replacement + source.slice(index + needle.length);
}

await update('src/data/scenarios.js', (source) => {
  let next = replaceRequired(
    source,
    " */\n\nexport const builtInScenarios = [",
    " */\n\nimport { computerScenarios } from './computer-scenes.js';\n\nexport const builtInScenarios = [",
    'src/data/scenarios.js',
  );
  const end = next.lastIndexOf('\n];');
  if (end < 0) throw new Error('src/data/scenarios.js: array terminator not found');
  return next.slice(0, end) + '\n  ...computerScenarios,' + next.slice(end);
});

await update('src/core/safety.js', (source) => {
  const prohibitedBlock = [
    'const PROHIBITED_OPERATIONAL_KEYS = new Set([',
    "  'command',",
    "  'commands',",
    "  'shell',",
    "  'script',",
    "  'scripts',",
    "  'payload',",
    "  'payloads',",
    "  'exploit',",
    "  'exploits',",
    "  'target',",
    "  'targets',",
    "  'password',",
    "  'passwords',",
    "  'credential',",
    "  'credentials',",
    "  'secret',",
    "  'secrets',",
    "  'token',",
    "  'tokens',",
    "  'port',",
    "  'ports',",
    ']);',
    '',
    'const IPV4_PATTERN =',
  ].join('\n');

  const keyCollector = [
    '/**',
    ' * @param {unknown} value',
    ' * @param {string} path',
    ' * @param {{path: string, key: string}[]} output',
    ' */',
    'function collectObjectKeys(value, path, output) {',
    '  if (Array.isArray(value)) {',
    "    value.forEach((item, index) => collectObjectKeys(item, path + '[' + index + ']', output));",
    '    return;',
    '  }',
    '',
    "  if (value && typeof value === 'object') {",
    '    Object.entries(value).forEach(([key, item]) => {',
    "      const keyPath = path + '.' + key;",
    '      output.push({ path: keyPath, key });',
    '      collectObjectKeys(item, keyPath, output);',
    '    });',
    '  }',
    '}',
    '',
    '/** @param {unknown} value */',
    'function isPlainObject(value) {',
  ].join('\n');

  const operationalValidation = [
    '  const operationalKeys = [];',
    "  collectObjectKeys(scenario, '$', operationalKeys);",
    '  for (const entry of operationalKeys) {',
    '    if (PROHIBITED_OPERATIONAL_KEYS.has(entry.key.toLowerCase())) {',
    "      errors.push(entry.path + ' uses prohibited operational field \\"' + entry.key + '\\".');",
    '    }',
    '  }',
    '',
    '  const strings = [];',
    "  collectStrings(scenario, '$', strings);",
  ].join('\n');

  let next = replaceRequired(source, 'const IPV4_PATTERN =', prohibitedBlock, 'src/core/safety.js');
  next = replaceRequired(
    next,
    '/** @param {unknown} value */\nfunction isPlainObject(value) {',
    keyCollector,
    'src/core/safety.js',
  );
  next = replaceRequired(
    next,
    "  const strings = [];\n  collectStrings(scenario, '$', strings);",
    operationalValidation,
    'src/core/safety.js',
  );
  next = replaceRequired(
    next,
    '  nodeTypes: Object.freeze([...ALLOWED_NODE_TYPES]),\n});',
    '  nodeTypes: Object.freeze([...ALLOWED_NODE_TYPES]),\n  prohibitedOperationalKeys: Object.freeze([...PROHIBITED_OPERATIONAL_KEYS]),\n});',
    'src/core/safety.js',
  );
  return next;
});

await update('README.md', (source) => {
  let next = replaceRequired(
    source,
    '  <a href="./docs/scenario-format.md">Create a scene</a>',
    '  <a href="./docs/scenario-format.md">Create a scene</a>\n  ·\n  <a href="./docs/scene-catalogue.md">Scene catalogue</a>',
    'README.md',
  );
  next = replaceRequired(
    next,
    '- Cut between three built-in story worlds: **Ghost Relay**, **Aurora Lockdown**, and **Midnight Switchboard**.',
    '- Cut between [nine built-in story worlds](./docs/scene-catalogue.md), including password auditing, server-control contention, ransomware recovery, phishing response, availability defense, and software-integrity incidents.',
    'README.md',
  );
  return next;
});

await update('README.zh-CN.md', (source) => {
  let next = replaceRequired(
    source,
    '  <a href="./docs/scenario-format.md">编写新场景</a>',
    '  <a href="./docs/scenario-format.md">编写新场景</a>\n  ·\n  <a href="./docs/scene-catalogue.md">场景目录</a>',
    'README.zh-CN.md',
  );
  next = replaceRequired(
    next,
    '- **三套完整剧情**：Ghost Relay、Aurora Lockdown、Midnight Switchboard。',
    '- **九套完整剧情**：除三套原创世界外，新增密码审计、服务器后台控制权争夺、勒索事件恢复、钓鱼会话劫持、流量洪峰和软件供应链篡改；详见[场景目录](./docs/scene-catalogue.md)。',
    'README.zh-CN.md',
  );
  return next;
});

await update('CHANGELOG.md', (source) =>
  replaceRequired(
    source,
    '## [Unreleased]\n\n### Planned',
    [
      '## [Unreleased]',
      '',
      '### Added',
      '',
      '- Realistic Computer Scene Pack with six defensive incident stories: Cipher Furnace, Control Plane Eclipse, Blackout Ledger, Phantom Inbox, Traffic Avalanche, and Glass Supply Chain.',
      '- Narrative-safety validation that rejects structured operational fields such as commands, executable payloads, live targets, credentials, and ports.',
      '- A scene catalogue documenting each built-in story, its visual arc, and its safety boundary.',
      '',
      '### Planned',
    ].join('\n'),
    'CHANGELOG.md',
  ),
);

await update('docs/safety-model.md', (source) =>
  replaceRequired(
    source,
    '- non-documentation email domains.',
    '- non-documentation email domains;\n- structured operational fields such as commands, scripts, payloads, live targets, credentials, secrets, tokens, and ports.',
    'docs/safety-model.md',
  ),
);

await rm('.bootstrap', { recursive: true, force: true });
await rm('tools/apply-realistic-scenes.mjs', { force: true });
console.log('integration patch complete');
