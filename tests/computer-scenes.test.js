import assert from 'node:assert/strict';
import test from 'node:test';
import { compileScenario } from '../src/core/engine.js';
import { validateScenario } from '../src/core/safety.js';
import { computerScenarios } from '../src/data/computer-scenes.js';

const expectedIds = [
  'cipher-furnace',
  'control-plane-eclipse',
  'blackout-ledger',
  'phantom-inbox',
  'traffic-avalanche',
  'glass-supply-chain',
];

test('realistic computer pack contains six distinct requested story families', () => {
  assert.deepEqual(
    computerScenarios.map((scene) => scene.id),
    expectedIds,
  );
  assert.equal(new Set(expectedIds).size, expectedIds.length);
});

test('every realistic computer scene compiles as a deterministic simulation-only scene', () => {
  for (const source of computerScenarios) {
    const compiled = compileScenario(source);
    assert.equal(compiled.safety, 'simulation-only');
    assert.ok(compiled.events.length >= 8, `${source.id} should provide a complete incident arc`);
    assert.ok(compiled.events.some((event) => event.phase === 'CONTAIN'));
    assert.ok(compiled.events.some((event) => event.phase === 'RECOVER' || event.phase === 'VERIFY'));
  }
});

test('password audit scene never publishes a candidate secret', () => {
  const scene = computerScenarios.find((item) => item.id === 'cipher-furnace');
  const text = JSON.stringify(scene);
  assert.match(text, /value=REDACTED/);
  assert.doesNotMatch(text, /plaintext value/i);
  assert.doesNotMatch(text, /password\s*[=:]\s*(?!REDACTED)/i);
});

test('structured operational fields are rejected from scene data', () => {
  const scene = structuredClone(computerScenarios[0]);
  scene.events[0].command = 'not allowed';
  scene.events[0].password = 'not allowed';
  const report = validateScenario(scene);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((error) => error.includes('prohibited operational field')));
});

test('scene pack uses only fictional documentation addresses', () => {
  for (const scene of computerScenarios) {
    const report = validateScenario(scene);
    assert.equal(report.ok, true, `${scene.id}: ${report.errors.join('; ')}`);
  }
});
