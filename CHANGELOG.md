# Changelog

All notable changes to `@artificesystems/remnant` are documented here.

## [Unreleased]

## [2.0.0] - 2026-10-23

### Security

- **`isSafeToAct()` fail-closed on trust** — callers must pass `publicKey` or `trustedPublicKeys`; signature verification no longer defaults to the embedded signature public key alone
- **Store binding** — when a `store` is supplied, `isSafeToAct()` requires `store.resolveCurrent(id)` to return the same Remnant bytes as the signed envelope
- **Store id integrity** — `put()` rejects reusing an existing `id` with different content (identical re-put is allowed)
- **Strict schemas** — unknown fields on Remnant and nested records fail validation; `parseRemnant()` returns strict-parsed objects only
- **Future `asOf` guard** — rejects timestamps more than `clockSkewMs` in the future (default 60s, configurable)
- **Prototype-safe store maps** — internal maps use null-prototype `Map` storage so ids like `__proto__` are safe
- **Validate-before-mutate store** — invalid `put()` does not change in-memory or on-disk state; `FileCurrentStore` writes atomically via temp file + rename
- **Extension limits** — default max depth (8), key count (64), and JSON size (16 KiB); documented in code exports
- **CLI file-root jail** — `inspect` and `verify-files` resolve real paths and refuse paths outside `--file-root` (default: cwd); one-line errors unless `DEBUG` is set
- **CI workflows** — fixed `publish.yml` conflict markers; added `test.yml` for typecheck, test, and build on PRs and `main`

### Changed

- **Semver major** — the `isSafeToAct()` trust and store-binding behavior breaks callers that relied on implicit signature trust or unsigned store drift
- **`staleAfterMs`** — deprecated alias for `maxAge` on `isSafeToAct()` / host adapter (spec name retained as alias)
- **`package.json` exports** — added `default` and `require` conditions alongside `types` / `import`

### Migrating from 1.x

1. Pass an explicit trusted key to `isSafeToAct()`: `publicKey` or `trustedPublicKeys` (the embedded signature key is honored only when listed).
2. When you pass a `store`, ensure the signed Remnant is the current store head for its `id` before expecting `safe: true`.
3. Treat unknown JSON fields as errors at validation time; re-sign envelopes after schema changes.
4. Handle `asOf` in the future beyond ~60s as not safe; tune `clockSkewMs` if your clocks skew more.
5. For CLI file inspection, stay within `--file-root` (defaults to the process working directory).

## [1.0.1] - 2026-09-13

### Changed

- **Public npm publish preparation**: Package is now published to npm as `@artificesystems/remnant@1.0.1`
- Updated LICENSE with proper Required Notice: `Copyright 2026 Artifice Systems (https://artifice.systems)`
- Updated README to include npm install instructions and remove git-only install framing
- Added repository, bugs, and homepage fields to package.json
- Added prepublishOnly script to ensure build and tests run before publishing

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
