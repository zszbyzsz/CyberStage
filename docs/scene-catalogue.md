# Scene catalogue

CyberStage ships with nine deterministic, simulation-only story worlds. Each scene is designed to communicate a recognizable computer-security incident through topology, state, timing, captions, aggregate metrics, and fictional terminal telemetry.

None of these scenes executes an action, contacts a host, reveals a credential, or contains a reusable attack procedure.

## Original cinematic scenes

| Scene | Story | Visual rhythm |
| --- | --- | --- |
| **Ghost Relay** | An impossible identity sequence moves through a service mesh before a protected vault rejects it. | Identity correlation, trust collapse, precise session containment |
| **Aurora Lockdown** | A polar habitat detects sensor readings that agree too perfectly and redirects them into a digital twin. | Slow-burn anomaly, control freeze, isolated twin recovery |
| **Midnight Switchboard** | A phantom production cue attempts to alter a fictional broadcast route. | Fast routing changes, clean-feed lock, metadata rewind |

## Realistic Computer Scene Pack

### Cipher Furnace — password audit

A local, offline rehearsal shows candidate pressure rising against fictional digest capsules. One deliberately weak test identity reaches a **match state**, but the value remains permanently redacted and a separate factor prevents privileged access.

The scene visualizes:

- audit progress and resistance scoring;
- a weak test identity moving from watch to alert;
- a privileged console refusing the compromised identity;
- session revocation, policy strengthening, and redacted evidence.

It does not include a password list, hash value, cracking command, cracking algorithm, or plaintext secret.

### Control Plane Eclipse — server administration takeover

A contested fictional administrator session crosses the management edge and appears to seize control of a server platform. Unauthorized configuration drift reaches the service layer before a defensive freeze, write fence, and signed baseline reclaim authority.

The scene visualizes:

- suspicious administrator-session telemetry;
- overlapping identity history;
- contested privileged authority;
- configuration drift and service impact;
- session revocation, rollback, data verification, and recovery.

It does not identify a vulnerability, provide an escalation sequence, execute a shell, or connect to a server.

### Blackout Ledger — ransomware containment

A generated endpoint produces an abnormal file-change wave. A canary record trips, shared storage darkens, segmentation stops the spread, and an immutable fictional snapshot restores the namespace.

The scene visualizes:

- file-change velocity;
- canary detection;
- a simulated encryption wave;
- endpoint and share isolation;
- snapshot restore and consistency checks.

It contains no malware, executable artifact, encryption routine, or real file operation.

### Phantom Inbox — phishing and session hijack response

A deceptive fictional message reaches a rehearsal inbox. A non-functional sign-in prompt is implied, an impossible cloud session appears, and mailbox state begins to change before identity defenders revoke the session and roll back the account.

The scene visualizes:

- sender and display-name similarity;
- a suspicious user-interaction marker;
- conflicting device/session confidence;
- fictional mailbox-rule changes;
- session revocation and identity restoration.

It contains no live link, form submission, credential capture, real mailbox, or deliverable lure.

### Traffic Avalanche — availability defense

An aggregate synthetic traffic storm raises edge load toward saturation. A rate shield shapes repeated demand, a cache ring absorbs pressure, and the origin remains healthy.

The scene visualizes:

- arrival-rate growth;
- request-diversity collapse;
- edge saturation;
- traffic shaping, caching, origin protection, and recovery.

It does not generate traffic, describe a flood recipe, expose a target, or transmit packets.

### Glass Supply Chain — software integrity

A fictional component update enters a local build rehearsal. Its provenance signature and generated digest diverge, so the release gate blocks promotion. A known-good component rebuilds a verified candidate.

The scene visualizes:

- update ingestion;
- provenance and signature mismatch;
- build-graph drift;
- release blocking and quarantine;
- trusted rebuild and verified promotion.

It names no real package, registry, vendor, compromise technique, or deployment target.

## Narrative structure

Every complete CyberStage scene should tell a defensive story:

```text
baseline → weak signal → correlation → visible impact → containment → restoration → verification
```

A scene may depict an attacker apparently succeeding for dramatic clarity, but the data model should describe only observable state and defensive decisions. It must not encode the procedure required to reproduce the attack.

## Adding another realistic scene

Start with [`examples/minimal-scene.json`](../examples/minimal-scene.json), then read:

- [Scenario format](./scenario-format.md)
- [Safety model](./safety-model.md)
- [Contributing guide](../CONTRIBUTING.md)

Good additions include account lockout, data-loss prevention, lost-device response, backup failure, certificate expiry, insider-risk review, industrial digital-twin isolation, or database integrity recovery. Keep all organizations and identifiers fictional, and make the defensive resolution as visually interesting as the incident.
