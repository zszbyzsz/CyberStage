import assert from 'node:assert/strict';
import test from 'node:test';
import { compileScenario, deriveFrame } from '../src/core/engine.js';
import { builtInScenarios } from '../src/data/scenarios.js';
import { renderCommandWall, resolveWallShot, WALL_SHOTS } from '../src/ui/command-wall.js';

const compiled = builtInScenarios.map(compileScenario);
const byId = new Map(compiled.map((scene) => [scene.id, scene]));

function frameAt(scene, ratio) {
  return deriveFrame(scene, scene.durationMs * ratio);
}

test('command wall exposes five deterministic camera choices', () => {
  assert.deepEqual(WALL_SHOTS, ['auto', 'overview', 'contest', 'containment', 'recovery']);
  assert.equal(resolveWallShot('auto', 'OBSERVE'), 'overview');
  assert.equal(resolveWallShot('auto', 'CHALLENGE'), 'contest');
  assert.equal(resolveWallShot('auto', 'CONTAIN'), 'containment');
  assert.equal(resolveWallShot('auto', 'RECOVER'), 'recovery');
  assert.equal(resolveWallShot('contest', 'RECOVER'), 'contest');
});

test('control-plane scene receives a dedicated authority contest wall', () => {
  const scene = byId.get('control-plane-eclipse');
  assert.ok(scene);
  const html = renderCommandWall(scene, frameAt(scene, 0.58), { shot: 'contest' });
  assert.match(html, /AUTHORITY CONTEST/);
  assert.match(html, /CONTROL PLANE/);
  assert.match(html, /WRITE FENCE|SIGNED BASELINE|AUTHORITY CONTESTED/);
});

test('password audit wall permanently redacts match material', () => {
  const scene = byId.get('cipher-furnace');
  assert.ok(scene);
  const html = renderCommandWall(scene, frameAt(scene, 0.72), { shot: 'contest' });
  assert.match(html, /CREDENTIAL PRESSURE/);
  assert.match(html, /REDACTED/);
  assert.doesNotMatch(html, /candidate secret|plaintext value/i);
});

test('ransomware recovery scene receives a restoration grid', () => {
  const scene = byId.get('blackout-ledger');
  assert.ok(scene);
  const html = renderCommandWall(scene, frameAt(scene, 0.78), { shot: 'recovery' });
  assert.match(html, /RECOVERY GRID/);
  assert.match(html, /SNAPSHOT|RESTORED/);
});

test('every built-in scene renders a safe generic or dedicated wall', () => {
  for (const scene of compiled) {
    const html = renderCommandWall(scene, frameAt(scene, 0.5), { shot: 'auto' });
    assert.match(html, /SIMULATION ONLY/);
    assert.match(html, new RegExp(scene.id));
    assert.doesNotMatch(html, /undefined/);
    assert.doesNotMatch(html, /<script/i);
  }
});
