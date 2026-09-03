# Scenario format

A CyberStage scenario is a self-contained JSON object describing a fictional topology and a deterministic event timeline. It contains data only: no JavaScript, commands, URLs, templates, or remote assets.

The canonical machine-readable definition is [`schema/scenario.schema.json`](../schema/scenario.schema.json). Runtime validation adds graph-reference and reserved-address checks that JSON Schema alone cannot express.

## Start with the minimal scene

Copy [`examples/minimal-scene.json`](../examples/minimal-scene.json), change its narrative content, and import it with **IMPORT JSON** in the director console.

```json
{
  "id": "signal-rehearsal",
  "title": "Signal Rehearsal",
  "subtitle": "A minimal two-node scene.",
  "safety": "simulation-only",
  "theme": "cyan",
  "durationMs": 20000,
  "nodes": [],
  "links": [],
  "events": []
}
```

## Top-level fields

| Field | Required | Description |
| --- | --- | --- |
| `id` | yes | Lowercase slug, 2–48 characters |
| `title` | yes | Human-readable scene name |
| `subtitle` | yes | One-sentence premise |
| `safety` | yes | Must be exactly `simulation-only` |
| `theme` | yes | `cyan`, `amber`, or `violet` |
| `durationMs` | yes | Timeline length, 10 seconds to 10 minutes |
| `initialPhase` | no | Initial phase label such as `STANDBY` |
| `initialMetrics` | no | Initial threat, trust, load, and containment values |
| `synopsis` | recommended | Opening narrative shown before the first cue |
| `objective` | recommended | Defensive goal shown in the scene brief |
| `directorNote` | recommended | Intended mood or filming use |
| `nodes` | yes | Two to 24 topology nodes |
| `links` | yes | One to 40 visual links |
| `events` | yes | Two to 240 timeline events |

## Nodes

```json
{
  "id": "defense-desk",
  "label": "DEFENSE DESK",
  "short": "DD",
  "type": "soc",
  "zone": "DEFENSE",
  "x": 770,
  "y": 310,
  "address": "203.0.113.10",
  "description": "A fictional monitoring desk."
}
```

### Node types

`external`, `gateway`, `identity`, `service`, `database`, `soc`, `sensor`, `archive`, and `broadcast` are currently supported. Types select a compact glyph and provide semantic context; they do not grant capabilities.

### Coordinates

The map uses a fixed `1000 × 620` stage. Keep nodes inside the safe area:

```text
30 ≤ x ≤ 970
30 ≤ y ≤ 590
```

Leave room around a node for its label. A practical spacing target is at least 135 units horizontally and 105 units vertically.

### Addresses

Only documentation-only IPv4 ranges are accepted:

- `192.0.2.0/24`
- `198.51.100.0/24`
- `203.0.113.0/24`

Use them as visual props, never as instructions. Email-like identifiers must end in `.test`, `.example`, or `.invalid`.

## Links

```json
{
  "id": "source-desk",
  "from": "signal-source",
  "to": "defense-desk",
  "label": "SIGNAL"
}
```

`from` and `to` must reference node IDs in the same scene. Links are visual relationships; CyberStage never opens a connection between them.

## Events

Events are reduced in ascending `at` order. `at` is a timestamp in milliseconds from the beginning of the scene.

```json
{
  "at": 10000,
  "phase": "VERIFY",
  "title": "Signal verified",
  "detail": "The generated cue reaches the defense desk.",
  "severity": "success",
  "caption": "The scene resolves without external contact.",
  "metrics": {
    "threat": 2,
    "trust": 99,
    "load": 24,
    "containment": 100
  },
  "nodes": [
    { "id": "defense-desk", "status": "trusted", "signal": 60 }
  ],
  "links": [
    { "id": "source-desk", "status": "trusted" }
  ],
  "flow": {
    "from": "signal-source",
    "to": "defense-desk",
    "durationMs": 3000
  },
  "logs": [
    { "channel": "defense", "text": "signal verified · impact=none" }
  ]
}
```

Every field except `at` is optional, but titled events make the incident feed useful.

### Severities

| Value | Visual intent |
| --- | --- |
| `info` | Neutral setup or observation |
| `low` | Weak anomaly or early clue |
| `medium` | Correlated concern |
| `high` | Active defensive attention |
| `critical` | Narrative peak |
| `success` | Verification or recovery |

Severity affects color and optional synthesized sound. It has no operational meaning.

### States

Nodes and links support:

`idle`, `watch`, `suspect`, `alert`, `contained`, `trusted`, `offline`, and `restored`.

A state persists until a later event changes it because each frame replays all prior mutations.

### Metrics

Each metric ranges from 0 to 100:

- `threat` — narrative tension;
- `trust` — confidence in the fictional system;
- `load` — visual operational intensity;
- `containment` — defensive resolution progress.

Metrics are storytelling instruments, not security measurements.

### Flows

An event may animate one signal between any two nodes. A direct link is recommended but not required. Duration must be between 400 ms and 20 seconds.

For overlapping flows, create several events with nearby timestamps. Keep the screen readable: one to three simultaneous particles usually works better than a crowded map.

### Logs

Logs should sound plausible without becoming instructions. Prefer observations and outcomes:

```text
confidence reduced 0.91 → 0.76 · correlation pending
questionable stream redirected · destination=digital-twin
case M-12 resolved · simulated impact=none
```

Do not include shell commands, exploit payloads, credentials, real organizations, live hostnames, or actionable intrusion steps.

## Writing a strong scene

A useful 60–90 second scene commonly follows five phases:

1. **Observe** — establish a quiet baseline.
2. **Correlate** — introduce a clue that becomes meaningful only when combined with another signal.
3. **Escalate** — illuminate several nodes and raise visual tension.
4. **Contain** — show a precise defensive decision rather than indiscriminate shutdown.
5. **Recover** — restore trust and leave an inert evidence trail.

This arc gives editors clear moments for reaction shots and allows educators to discuss defensive reasoning without demonstrating an attack.

## Validation

Run all built-in validation and tests:

```bash
npm run check
```

Imported files are validated again inside the browser. A scene that fails validation is never sent to the renderer.
