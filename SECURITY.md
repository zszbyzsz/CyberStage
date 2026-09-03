# Security policy

CyberStage is intentionally simulation-only. A weakness that allows scene data or runtime code to contact live systems, execute code, bypass output escaping, or weaken the declared capability boundary is a security issue.

## Supported versions

| Version | Supported |
| --- | --- |
| `main` | yes |
| latest tagged release | yes |
| older releases | best effort |

## Report privately

Use GitHub private vulnerability reporting from the repository **Security** tab when it is available. Include:

- the affected commit or release;
- the violated safety invariant;
- a minimal inert reproduction;
- the impact within the browser runtime;
- a suggested mitigation, if known.

Do not include live targets, credentials, destructive payloads, or operational intrusion instructions. If private reporting is unavailable, open a public issue containing no sensitive reproduction details and ask the maintainer to establish a private channel.

## Security-relevant invariants

Reports are especially valuable when they concern:

- a bypass of `connect-src 'none'`;
- introduction of network transport in `src/`;
- execution or interpretation of imported scene content;
- HTML or SVG injection;
- acceptance of live IP addresses or URLs;
- path traversal in the local development server;
- dependency or workflow supply-chain risk;
- a build artifact that includes unapproved files.

## Not security vulnerabilities

These are generally feature or quality issues rather than vulnerabilities:

- fictional telemetry being technically simplified;
- an animation or layout defect;
- someone modifying their own local copy to remove safeguards;
- a scene that is dramatic but non-operational;
- lack of confidentiality for a JSON file the user explicitly imports locally.

The complete threat model is documented in [`docs/safety-model.md`](./docs/safety-model.md).
