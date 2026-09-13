# Remnant v1.0.1 release notes

**Package:** `@artificesystems/remnant`  
**Status:** Published to npm at version 1.0.1  
**License:** PolyForm Noncommercial 1.0.0

## What's new in v1.0.1

This release prepares Remnant for public npm distribution:

- **npm publish**: Package is now available on npm as `@artificesystems/remnant@1.0.1`
- **LICENSE update**: Added proper Required Notice line per PolyForm requirements
- **README update**: Changed install instructions from git-only to npm install
- **package.json metadata**: Added repository, bugs, homepage fields and prepublishOnly script

## Honest v1 claim

Remnant v1 is a **protocol library** for durable, accountable agent work state: create and validate Remnant JSON envelopes, classify currentness and conflicts, optionally sign with Ed25519, audit file outputs, and score adversarial conformance cases. v1 adds a lightweight current store (`put` / `resolveCurrent`), a contextual machine STOP gate (`isSafeToAct`), proof fail-closed rules, and demo producers (`eng-status`, `operator-lock`) — all without shipping an agent runtime, LLM runner, PKI, second store, universal stale window, or external service integrations.

## Envelope status and authorization

Lifecycle status values are: `draft`, `partial`, `current`, `superseded`, `rejected`.

- **`status: current`** — this Remnant is the active work product for its goal; the current store resolves the latest id per goal.
- **`locked: true`** — first-class boolean: authority has authorized this artifact. This is not a lifecycle status value.

First-class fields on eng-status cards and Remnant envelopes: `authority`, `not_checked`, `lane`, `stop`, `as_of` (Remnant wire field `asOf`).

## Shipped in v1 (since v0.2.0)

| Area | API |
|---|---|
| Current store | `createCurrentStore()`, `InMemoryCurrentStore`, `FileCurrentStore`, `put`, `resolveCurrent` |
| STOP gate | `isSafeToAct(signed, { publicKey, store?, maxAge? })` |
| Proof rules | `isProofEligible`, `proofDiagnostics`, `resolveCurrentProof` |
| Demo producers | `produceEngStatus`, `writeEngStatusCard`, `engStatusToRemnant`, `produceOperatorLock` |
| Host adapter | `createHostAdapter()` — `put`, `resolveCurrent`, `isSafeToAct` |
| Existing v0.2 surface | `createRemnant`, `resolveCurrent`, signing, A2A/MCP adapters, Node audit, conformance CLI |

## Explicitly not in v1

- Agent runner or agent mesh
- PKI / certificate authority
- Graph database or second store
- Universal stale-after duration (callers supply domain policy via `maxAge` only inside `isSafeToAct`, not protocol-wide)
- HTTP client or external service wire-up
- Git tag or published package from this tree

## Tests

Full suite covers store persistence, supersession, `isSafeToAct` STOP on adversarial cases, proof fail-closed, demo producers, and all v0.2 tests.

## Upgrade from v0.2.0

1. Use this tree from source until a tag exists; do not install from the registry yet.
2. Replace any doc or code assuming “no store” — use `createCurrentStore()` when tracking current artifacts by goal.
3. Replace any assumption that `isSafeToAct` is absent — it requires a signed Remnant and returns `{ safe, stop }`.
4. Use `status: 'current'` for the store head; set `locked: true` when authority has authorized the artifact. Pass explicit `as_of` on status cards.
