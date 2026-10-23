# Remnant v2.0.0 release notes

**Package:** `@artificesystems/remnant`  
**Status:** Published to npm via the `v2.0.0` tag (CI publish workflow)  
**License:** PolyForm Noncommercial 1.0.0

## Summary

v2.0.0 is a **security-focused major release**. It hardens `isSafeToAct()`, the current store, schema validation, CLI file inspection, and CI workflows. The breaking change is intentional: **callers must supply trusted signing keys**, and **store-backed STOP checks require the signed Remnant to match the store head**.

## Security fixes

| Area | Behavior |
|---|---|
| `isSafeToAct()` | Requires `publicKey` or `trustedPublicKeys`; fails closed when missing |
| Store + STOP | With `store`, resolved current must match signed Remnant bytes |
| `put()` | Rejects id reuse with different content |
| Schemas | Strict parsing; unknown fields fail validation |
| `asOf` | Rejects future timestamps beyond `clockSkewMs` (default 60s) |
| Store internals | Null-prototype `Map` storage (prototype pollution safe) |
| `FileCurrentStore` | Validate before mutate; atomic file writes |
| `extensions` | Default depth/key/size limits (`DEFAULT_EXTENSION_*` exports) |
| CLI | File-root jail for `inspect` / `verify-files`; clean one-line errors |
| CI | Valid tag publish workflow; PR/main test workflow |

## Migrating from 1.x

1. **Trusted keys** — Always pass `publicKey` or `trustedPublicKeys` to `isSafeToAct()` (and host adapter). Listing the embedded signature public key in `trustedPublicKeys` is the usual pattern.
2. **Store binding** — If you pass `store`, put the Remnant first and expect STOP when an attacker presents a signed copy that is not the store’s current head.
3. **Strict JSON** — Strip or reject unknown fields before signing; validation no longer preserves attacker-controlled extra properties.
4. **Clock skew** — Future `asOf` beyond ~60s is not safe; set `clockSkewMs` if needed.
5. **CLI paths** — Use `--file-root` to confine file inspection; defaults to the current working directory.
6. **`staleAfterMs`** — Still accepted as a deprecated alias for `maxAge`.

## Shipped API (unchanged surface, stricter semantics)

| Area | API |
|---|---|
| Current store | `createCurrentStore()`, `InMemoryCurrentStore`, `FileCurrentStore`, `put`, `resolveCurrent` |
| STOP gate | `isSafeToAct(signed, { publicKey \| trustedPublicKeys, store?, maxAge?, clockSkewMs? })` |
| Proof rules | `isProofEligible`, `proofDiagnostics`, `resolveCurrentProof` |
| Demo producers | `produceEngStatus`, `produceOperatorLock`, host adapter |
| Package exports | `types`, `import`, `require`, `default` per subpath |

## Tests

`test/security-audit.test.ts` adds coverage for each security fix. The full suite must pass before publish.

## Explicitly not in this release

- No agent runner, PKI, or universal stale window beyond caller-supplied `maxAge`
