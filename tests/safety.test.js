import assert from 'node:assert/strict';
import test from 'node:test';
import { compileScenario, ScenarioValidationError } from '../src/core/engine.js';
import { isDocumentationIPv4, validateScenario } from '../src/core/safety.js';
import { builtInScenarios } from '../src/data/scenarios.js';

const clone = (value) => structuredClone(value);

test('documentation IPv4 ranges are accepted', () => {
  assert.equal(isDocumentationIPv4('192.0.2.1'), true);
  assert.equal(isDocumentationIPv4('198.51.100.255'), true);
  assert.equal(isDocumentationIPv4('203.0.113.80'), true);
  assert.equal(isDocumentationIPv4('8.8.8.8'), false);
});

test('a real-world IPv4 address is rejected anywhere in scene data', () => {
  const scene = clone(builtInScenarios[0]);
  scene.nodes[0].address = '8.8.8.8';
  const report = validateScenario(scene);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((error) => error.includes('non-documentation IPv4')));
});

test('URLs are rejected from imported scene content', () => {
  const scene = clone(builtInScenarios[0]);
  scene.objective = 'Contact https://example.invalid for instructions.';
  assert.throws(() => compileScenario(scene), ScenarioValidationError);
});

test('invalid graph references are rejected', () => {
  const scene = clone(builtInScenarios[0]);
  scene.events[1].flow.to = 'missing-node';
  const report = validateScenario(scene);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((error) => error.includes('flow must reference')));
});

test('simulation-only declaration is mandatory', () => {
  const scene = clone(builtInScenarios[0]);
  scene.safety = 'live';
  assert.throws(() => compileScenario(scene), /simulation-only/);
});
