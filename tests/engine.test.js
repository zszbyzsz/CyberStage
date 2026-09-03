import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  StageClock,
  compileScenario,
  cubicPoint,
  deriveFrame,
  formatClock,
  getCrossedEvents,
  linkCurve,
} from '../src/core/engine.js';
import { builtInScenarios } from '../src/data/scenarios.js';

const ghostRelay = compileScenario(builtInScenarios[0]);

test('formatClock renders minutes, seconds, and tenths', () => {
  assert.equal(formatClock(0), '00:00.0');
  assert.equal(formatClock(65_432), '01:05.4');
});

test('StageClock advances deterministically and loops', () => {
  const clock = new StageClock(1_000, { loop: true });
  clock.setSpeed(2);
  clock.play();
  const first = clock.step(200);
  assert.equal(first.timeMs, 400);
  const second = clock.step(400);
  assert.equal(second.timeMs, 200);
  assert.equal(second.wrapped, true);
});

test('StageClock clamps seeks and supports non-looping endings', () => {
  const clock = new StageClock(500, { loop: false });
  assert.equal(clock.seek(900), 500);
  clock.seek(400);
  clock.play();
  const result = clock.step(200);
  assert.equal(result.timeMs, 500);
  assert.equal(result.ended, true);
  assert.equal(clock.playing, false);
});

test('deriveFrame applies event-sourced mutations', () => {
  const opening = deriveFrame(ghostRelay, 1_000);
  assert.equal(opening.phase, 'OBSERVE');
  assert.equal(opening.nodeStates['soc-seven'].status, 'watch');

  const containment = deriveFrame(ghostRelay, 46_000);
  assert.equal(containment.phase, 'CONTAIN');
  assert.equal(containment.nodeStates['edge-relay'].status, 'contained');
  assert.equal(containment.metrics.containment, 42);
  assert.ok(containment.logs.some((line) => line.text.includes('simulation')));
});

test('deriveFrame returns active synthetic signal pulses', () => {
  const frame = deriveFrame(ghostRelay, 7_000);
  assert.equal(frame.pulses.length, 1);
  assert.equal(frame.pulses[0].from, 'ghost-uplink');
  assert.ok(frame.pulses[0].progress > 0 && frame.pulses[0].progress < 1);
});

test('getCrossedEvents handles a wrapped timeline', () => {
  const events = getCrossedEvents(ghostRelay, 87_000, 1_000, true);
  assert.ok(events.some((event) => event.at === 88_000));
  assert.ok(events.some((event) => event.at === 0));
});

test('cubic geometry returns exact endpoints', () => {
  const curve = linkCurve({ x: 10, y: 20 }, { x: 90, y: 70 });
  assert.deepEqual(cubicPoint(curve.start, curve.controlA, curve.controlB, curve.end, 0), { x: 10, y: 20 });
  assert.deepEqual(cubicPoint(curve.start, curve.controlA, curve.controlB, curve.end, 1), { x: 90, y: 70 });
});

test('all built-in and example scenes compile', async () => {
  for (const scene of builtInScenarios) {
    assert.doesNotThrow(() => compileScenario(scene), scene.id);
  }
  const example = JSON.parse(await readFile(new URL('../examples/minimal-scene.json', import.meta.url), 'utf8'));
  assert.doesNotThrow(() => compileScenario(example));
});
