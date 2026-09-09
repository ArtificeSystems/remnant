# Behavioral semantics

A parser that accepts the JSON shape is not sufficient for conformance.

A compliant receiver must not:

- trust `status` over direct contradictory evidence
- use a wrong hash without detecting it when exact-byte identity matters
- treat stale live state as current without revalidation
- repeat known completed side effects
- treat inferred assumptions as explicit user authority
- resurrect rejected or superseded decisions as current
- execute `nextAction` outside the Remnant goal or receiver authority
- treat unscoped “tests pass” prose as complete verification
- collapse guesses and measurements into equivalent facts
- invent unavailable tool results

## Precedence for action selection

```text
reality
  > explicit user/system authority
  > stop
  > action-relevant unknowns
  > verification scope
  > nextAction
  > producer confidence/tone
```

`nextAction` never confers authority.

## Freshness

`createdAt` is when the Remnant object was produced.

`asOf` is the freshness boundary for represented world state.

The protocol does not define a universal stale-after duration. Consumers apply domain policy.

## Files

Inspection establishes properties of the file, not correctness of the work inside it.

If a hash is present and a downstream action depends on those exact bytes, recompute it.

Symlinks: Node helpers hash the target. Relative local paths are invalid in canonical serialization.

## Evidence

Optional `evidence` attachments (`type`, optional `claim` / `uri` / `digest` / `data`) are uninterpreted by Core. A digest is not a truth claim. A signature on the envelope is not a claim about the work.

## Signing

`signRemnant()` signs the Remnant, not the signature container.

The signed payload is the UTF-8 encoding of compact `JSON.stringify(canonicalizeRemnant(remnant))`:

- Core canonical object (fixed field order, sorted object/extension keys, omitted `undefined`)
- no pretty-print whitespace
- never includes `signature`, `publicKey`, or the `SignedRemnant` wrapper

Pretty-printed `serializeRemnant()` is for humans. It is not the signed payload.

The same Remnant value MUST produce identical canonical bytes on every runtime that implements this algorithm. A signature proves those bytes were signed by a holder of the key. It does not prove the claims inside are true.

## Envelope status

Lifecycle status is one of: `draft`, `partial`, `current`, `superseded`, `rejected`. There is no `locked` status. Use **`current`** when a Remnant is the active work product for its goal.

## Resolution

`resolveCurrent(remnants)` classifies a set by explicit `supersedes` and `rejected`. Two `current` remnants conflict only when their `goal` strings are identical (`===`) and neither supersedes the other.

`"Fix login"` and `"Repair authentication"` do not conflict. Core does not trim, case-fold, or semantically match goals.

Do not break ties by filename, polish, or producer tone.

## Interop

A2A and MCP helpers transport a Remnant. They must not upgrade trust.

Round-tripping through `toA2AArtifact` / `fromA2AArtifact` (when Remnant metadata is present) or `toMcpResource` / `fromMcpResource` MUST preserve `status`, `verification`, `stop`, `evidence`, `unknowns`, `assumptions`, and `effects`. `draft` must not become `current`. Empty verification must stay empty. `stop` must not be dropped.

Reconstructing from A2A parts when Remnant metadata is absent is a new draft Remnant, not an upgrade of the original.

## Secrets

`redactRemnant()` is best-effort. Do not put plaintext secrets in Remnants. It is not a DLP engine.
