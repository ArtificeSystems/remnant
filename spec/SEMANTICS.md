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

## Secrets

`redactRemnant()` is best-effort. Do not put plaintext secrets in Remnants. It is not a DLP engine.
