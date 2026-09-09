# Remnant v1.0.0 release notes

**Package:** `@artifice/remnant`  
**Commit range:** `618b6be538400f813b8691920cd1c76b38fff1b6` (remnant #1 merge) → this PR  
**Previous public tag:** `v0.2.0` at `dc0ab9f`

## Honest v1 claim

Remnant v1 is a **protocol library** for durable, accountable agent work state: create and validate Remnant JSON envelopes, classify currentness and conflicts, optionally sign with Ed25519, audit file outputs, and score adversarial conformance cases. v1 adds a lightweight current store (`put` / `resolveCurrent`), a contextual machine STOP gate (`isSafeToAct`), proof fail-closed rules, and a demo `eng-status` producer — all without shipping an agent runtime, LLM runner, PKI, second store, universal stale window, or integrations with Grail, Saylis, Oroboros, or Risk.

## Envelope status and authorization

Lifecycle status values are: `draft`, `partial`, `current`, `superseded`, `rejected`.

- **`status: current`** — this Remnant is the active work product for its goal; the current store resolves the latest id per goal.
- **`locked: true`** — first-class boolean: authority has authorized this artifact. This is not a lifecycle status value.

First-class fields on eng-status cards and Remnant envelopes: `authority`, `not_checked`, `lane`, `stop`, `as_of` (Remnant wire field `asOf`).

## Shipped in v1 (since v0.2.0)

| Area | API |
|---|---|
| Current store | `createCurrentStore()`, `InMemoryCurrentStore`, `FileCurrentStore`, `put`, `resolveCurrent` |
| STOP gate | `isSafeToAct(signed, { publicKey, store?, staleAfterMs? })` |
| Proof rules | `isProofEligible`, `proofDiagnostics`, `resolveCurrentProof` |
| Demo producer | `produceEngStatus`, `writeEngStatusCard`, `engStatusToRemnant` |
| Existing v0.2 surface | `createRemnant`, `resolveCurrent`, signing, A2A/MCP adapters, Node audit, conformance CLI |

## Explicitly not in v1

- Grail, Saylis, Oroboros, or Risk wire-up
- Agent runner or agent mesh
- PKI / certificate authority
- Graph database or second store
- Universal stale-after duration (callers supply domain policy via `staleAfterMs` only inside `isSafeToAct`, not protocol-wide)
- Git tag or GitHub release from this PR

## Tests

Full suite: **77 passed**, **0 failed** (18 suites).

Covers store persistence, supersession, `isSafeToAct` STOP on 14 adversarial cases, proof fail-closed, eng-status producer, and all v0.2 tests.

## Upgrade from v0.2.0

1. Bump dependency to `@artifice/remnant@1.0.0` when published.
2. Replace any doc or code assuming “no store” — use `createCurrentStore()` when tracking current artifacts by goal.
3. Replace any assumption that `isSafeToAct` is absent — it requires a signed Remnant and returns `{ safe, stop }`.
4. Use `status: 'current'` for the store head; set `locked: true` when authority has authorized the artifact. Pass explicit `as_of` on eng-status cards.
