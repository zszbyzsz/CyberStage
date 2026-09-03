import assert from 'node:assert/strict';
import test from 'node:test';
import { compileScenario, deriveFrame } from '../src/core/engine.js';
import { builtInScenarios } from '../src/data/scenarios.js';
import {
  escapeHtml,
  renderFeed,
  renderNodeInspector,
  renderScenarioBrief,
  renderTerminal,
  renderTopology,
} from '../src/ui/render.js';

test('HTML escaping neutralizes markup-sensitive characters', () => {
  assert.equal(
    escapeHtml(`<script data-x="1">'&</script>`),
    '&lt;script data-x=&quot;1&quot;&gt;&#039;&amp;&lt;/script&gt;',
  );
});

test('all text-bearing renderers escape scenario content', () => {
  const source = structuredClone(builtInScenarios[0]);
  source.title = 'Signal & Shadow';
  source.subtitle = 'Observe <without> executing';
  source.objective = 'Keep "stage" synthetic';
  source.directorNote = "Director's local cue";
  source.nodes[0].label = 'Edge <Actor>';
  source.nodes[0].description = 'Synthetic & isolated';
  source.events[0].title = 'Cue <one>';
  source.events[0].detail = 'A & B';
  source.events[0].log = { channel: 'stage', text: 'render "only"' };

  const scenario = compileScenario(source);
  const frame = deriveFrame(scenario, scenario.events[0].at);
  const output = [
    renderScenarioBrief(scenario),
    renderTopology(scenario, frame, scenario.nodes[0].id),
    renderNodeInspector(scenario, frame, scenario.nodes[0].id),
    renderFeed(frame),
    renderTerminal(frame),
  ].join('\n');

  assert.match(output, /Signal &amp; Shadow/);
  assert.match(output, /Observe &lt;without&gt; executing/);
  assert.match(output, /Edge &lt;Actor&gt;/);
  assert.match(output, /A &amp; B/);
  assert.doesNotMatch(output, /<Actor>|<without>|<one>/);
});
