# Changelog

All notable changes to `@artifice/remnant` are documented here.

## [Unreleased]

## [1.0.1] - 2026-09-09

Package version bump for PolyForm Noncommercial tagged release. Source/GitHub only.

## [1.0.0] — 2026-09-09

First stable protocol-library release after the gap-close work merged.

### Added

- **Current store** — `InMemoryCurrentStore`, `FileCurrentStore`, and `createCurrentStore()` with `put()` and `resolveCurrent(id)`; one current Remnant per exact goal string; supersession required to replace an existing current
- **`isSafeToAct()`** — machine STOP gate for signed Remnants: requires `status: 'current'`, valid Ed25519 signature, required evidence, valid supersession when a store is supplied, and passes adversarial trap checks
- **Proof fail-closed** — `isProofEligible()`, `proofDiagnostics()`, and `resolveCurrentProof()` reject proof-marked claims without payload
- **`eng-status` demo producer** — `produceEngStatus()`, `writeEngStatusCard()`, and `engStatusToRemnant()` map status cards to Remnant envelopes
- Gap-close test suite (`test/gap-close.test.ts`) covering store, STOP gate, proof rules, and eng-status producer

### Changed

- Package version from `0.2.1` to `1.0.0`
- README and spec audit: docs now match shipped APIs; removed stale claims that store and `isSafeToAct()` were absent
- Documented envelope lifecycle status (`draft` | `partial` | `current` | `superseded` | `rejected`) and first-class **`locked`** boolean (authority authorized; distinct from `status: current`)
- First-class eng-status / Remnant fields: `authority`, `not_checked`/`notChecked`, `lane`, `stop`, `as_of`/`asOf`
- `isSafeToAct()` requires present `as_of`; optional caller-supplied `maxAge` replaces any default stale window

### Not in this release

- No agent runner, PKI, graph store, or universal stale window
- No git tag or GitHub release (PR-only v1 preparation)

## [0.2.1] — unreleased on tag

Post-`v0.2.0` patch version on main before v1 bump.

## [0.2.0] — 2026-09-08 (`dc0ab9f`)

Initial public release: Remnant creation/validation/serialization, Node file inspection, Ed25519 signing helpers, A2A/MCP adapters, adversarial conformance battery (cases A–T), and CLI.
