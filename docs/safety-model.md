# Safety model

CyberStage aims for visual authenticity while maintaining a hard boundary between **depicting** network operations and **performing** them.

## Security objective

Given an untrusted local scene file, the CyberStage runtime should be able to display its validated text, graph, state changes, and timing without:

- contacting a remote host;
- scanning or discovering a network;
- executing commands or code from the scene;
- accessing credentials;
- controlling physical or virtual infrastructure;
- interpreting scene data as HTML, JavaScript, a URL, or a shell program.

This model protects against accidental capability creep and malicious scene files. It is not a browser sandbox replacement; the project relies on browser security as an additional layer.

## Layer 1: capability absence

The runtime has no implementation for network transport, command execution, or remote asset loading. It uses only:

- DOM and SVG rendering;
- local URL state;
- local file selection;
- clipboard write initiated by the user;
- fullscreen initiated by the user;
- optional locally synthesized audio;
- animation timing.

The CI guard rejects common browser transport primitives inside `src/`.

## Layer 2: Content Security Policy

`index.html` and the local development server enforce a policy containing:

```text
connect-src 'none'
object-src 'none'
frame-src 'none'
worker-src 'none'
base-uri 'none'
form-action 'none'
```

Scripts, styles, fonts, and images are restricted to local project resources. The page does not depend on a CDN, analytics provider, remote font, or API.

The CSP is defense in depth. New code must still avoid adding forbidden capabilities even if a browser would block them at runtime.

## Layer 3: declarative scenes

Scenes are JSON data and cannot supply executable callbacks. Runtime validation checks:

- required metadata and `simulation-only` declaration;
- duration and collection limits;
- unique node and link IDs;
- graph references;
- allowed node types, statuses, severities, and themes;
- bounded coordinates and percentages;
- flow duration;
- prohibited markup;
- URLs;
- non-documentation IPv4 values;
- non-documentation email domains;
- structured operational fields such as commands, scripts, payloads, live targets, credentials, secrets, tokens, and ports.

The compiler clones, normalizes, and deeply freezes validated scene data before use.

## Layer 4: output encoding

Custom scene strings are escaped before entering generated HTML or SVG. Numeric values are accepted only after validation and are used in SVG attributes or form values.

Contributors should prefer `textContent` when updating a single DOM string. Any renderer that returns markup must call the shared escaping helper for every scene-supplied string.

## Layer 5: deterministic reduction

A scene cannot persist code or hidden state between frames. `deriveFrame` reconstructs the complete visual state from the frozen scene and timestamp. This reduces opportunities for imported content to affect application control flow.

## Reserved identifiers

Built-in and imported scenes may visually contain only documentation-only IPv4 addresses:

```text
192.0.2.0/24
198.51.100.0/24
203.0.113.0/24
```

Email-like identifiers must use `.test`, `.example`, or `.invalid`. Scene URLs are prohibited entirely.

Reserved values matter even when a field is “just text.” A screenshot, script, or copied prop should never encourage a user to contact an unrelated live host.

## Trust boundaries

| Boundary | Trusted | Untrusted | Control |
| --- | --- | --- | --- |
| Repository source | Reviewed project code | Proposed changes | Review, CI guard, tests |
| Scene import | Compiler and renderer | Local JSON file | Size cap, parser, validator, escaping |
| Browser | Same-origin static files | External network | CSP and capability absence |
| Playback | Frozen compiled scene | Current timestamp | Pure deterministic reduction |

## Out of scope

CyberStage does not claim to secure a browser with malicious extensions, a compromised operating system, or a modified local build. It also does not provide isolation for third-party JavaScript because third-party JavaScript is not an accepted extension mechanism.

## Invariant review checklist

A runtime change must answer “no” to all of these questions:

1. Does it create or accept a network destination?
2. Does it interpret scene text as code, markup, a selector, or a URL?
3. Does it execute a process, command, script, macro, or native module?
4. Does it weaken `connect-src 'none'` or add a remote resource?
5. Does it allow real addresses or identifiers into built-in scenes?
6. Does it make an offensive action more operationally useful rather than merely more legible on screen?

When the answer is uncertain, open a design issue before implementation.
