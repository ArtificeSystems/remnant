# @artifice/remnant

Durable work-state for agent handoffs.

> **A Remnant is an accountable unit of completed or partial work that another agent can safely inspect and continue from without reconstructing the conversation that produced it.**

Zero reread. Zero redo. No silent risk.

```text
                REMNANT
      durable accountable work state
                    │
       ┌────────────┼────────────┐
       │            │            │
      A2A          MCP       plain JSON
       │            │            │
       └────────────┼────────────┘
                    │
              verification
                    │
              optional signing
                    │
              supersession
                    │
             resolution/conflict
                    │
              next agent
```

This package is the **v1.0** TypeScript implementation of Remnant Protocol. It is a protocol library: create, validate, serialize, resolve, and audit Remnant envelopes. It is **not** an agent runtime, workflow engine, memory system, or LLM runner.

## What v1 is

- Typed Remnant creation, validation, serialization, and rendering
- `resolveCurrent()` for supersession and conflict classification across a set of Remnants
- In-process and file-backed **current store** (`put` / `resolveCurrent`) — one current Remnant per exact goal string
- **`isSafeToAct()`** machine STOP gate for signed, current Remnants (contextual, not universal safety)
- Proof fail-closed rules (`isProofEligible`, `resolveCurrentProof`)
- Ed25519 signing helpers (optional; no PKI)
- A2A and MCP transport adapters (no servers)
- Node file inspection and audit helpers
- Adversarial conformance battery (cases A–T) and CLI
- **`eng-status` demo producer** — maps engineering status cards to Remnant envelopes without calling other products
- **`operator-lock` demo producer** — writes one paper card (`accountId: null`, `orders: allowed-when-pinned`, `paper: true`) onto the same first-class fields. No trade wire
- **Grail adapter boundary** — `createGrailAdapter()` exposes `put`, `resolveCurrent`, and `isSafeToAct` for a later Engine call. Function boundary only; no HTTP client

### `current` vs `locked`

These are separate concepts:

- **`status: current`** — lifecycle: this Remnant is the active work product for its goal. The **current store** tracks which id is latest per goal (`put` / `resolveCurrent`).
- **`locked: true`** — authority has authorized this artifact. This is a first-class boolean field, not a lifecycle status value and not prose buried in `claim`.

Envelope lifecycle status remains: `draft` | `partial` | `current` | `superseded` | `rejected`.

Eng-status cards and Remnant envelopes also carry first-class fields: `authority`, `not_checked` / `notChecked`, `lane`, `stop`, and `as_of` (maps to Remnant `asOf`).

## What is not in v1

- No Grail, Saylis, Oroboros, or Risk HTTP client or trade wire (the Grail adapter is a local function boundary only)
- No agent runner or agent mesh
- No PKI, certificate authority, or identity network
- No graph database or second store
- No universal stale-after window (callers supply domain freshness policy)
- No YAML in Core
- No A2A or MCP server

## Install

```bash
npm install @artifice/remnant
```

Node.js 20+. ESM.

Subpath exports:

```text
@artifice/remnant
@artifice/remnant/node
@artifice/remnant/a2a
@artifice/remnant/mcp
@artifice/remnant/crypto
@artifice/remnant/conformance
```

## Create

```ts
import { createRemnant, serializeRemnant } from '@artifice/remnant';

const remnant = createRemnant({
  producer: 'cursor.sonnet',
  goal: 'Fix authentication redirect bug',
  status: 'current',
  outputs: [{ kind: 'text', text: 'Implementation completed.' }],
  unknowns: ['Production SSO has not been exercised'],
  stop: ['Do not deploy to production without explicit approval'],
  nextAction: 'Deploy to staging and exercise the SSO callback.',
});

process.stdout.write(serializeRemnant(remnant));
```

`status` defaults to `draft`. The SDK will not silently default to `current`.

Mechanical fields (`protocolVersion`, `id`, `createdAt`, `asOf`) are generated.

Assumption shorthand `'DATABASE_URL is configured'` becomes `{ statement, basis: 'unknown' }`.

## Evidence

Typed attachments ride on the Remnant. Core does not interpret `type`.

```ts
evidence: [
  { type: 'git-commit', uri: 'git:abc123', claim: 'HEAD at abc123' },
  { type: 'ci', uri: 'https://ci.example/runs/12', digest: 'a'.repeat(64) },
]
```

A signature, CI receipt, SLSA attestation, or ZK proof can all be evidence. Core does not understand those systems.

## Resolve currentness

Classify a set of Remnants:

```ts
import { resolveCurrent } from '@artifice/remnant';

const { current, superseded, rejected, conflicts } = resolveCurrent(remnants);
```

If two Remnants both claim `current` and their `goal` strings are identical (`===`) and neither supersedes the other, they are a conflict. `"Fix login"` and `"Repair authentication"` do not conflict. Core does not fuzzy-match goals. Presentation quality does not break the tie.

## Current store

Track one current Remnant per exact goal string in-process or on disk:

```ts
import { createCurrentStore, produceEngStatus } from '@artifice/remnant';

const store = createCurrentStore(); // or createCurrentStore({ path: './current.json' })
const { card, remnant } = produceEngStatus({
  status: 'current',
  locked: true,
  authority: 'eng-lead@example.com',
  claim: 'Router patch ready for staging',
  evidence: [{ type: 'ci', uri: 'https://ci.example/runs/9' }],
  not_checked: ['Production SSO path'],
  lane: 'platform',
  stop: ['Do not deploy to production'],
  as_of: '2026-09-08T15:00:00.000Z',
  producer: 'cursor.agent',
});

store.put(remnant);
store.resolveCurrent(remnant.id); // → remnant (latest for goal)
card.locked; // → true (authority authorized)
```

A new `current` for an existing goal requires explicit `supersedes`.

## Machine STOP gate

`isSafeToAct()` returns `{ safe, stop }` for a **signed** Remnant. It is a contextual gate, not a universal “safe for everything” boolean. It requires `status: 'current'`, a present **`as_of`** (`asOf`), valid signature, required evidence, valid supersession (when a store is supplied), and passes adversarial trap checks.

Pass optional **`maxAge`** (milliseconds) to stop when `asOf` is older than the caller-supplied window. There is **no default** stale window.

```ts
import { generateSigningKeyPair, signRemnant } from '@artifice/remnant/crypto';
import { isSafeToAct } from '@artifice/remnant';

const keys = generateSigningKeyPair();
const signed = signRemnant(remnant, keys.privateKey);
isSafeToAct(signed, { publicKey: keys.publicKey, store, maxAge: 60 * 60 * 1000 });
```

## A2A / MCP

Remnant is a semantic layer. Transport stays A2A, MCP, or a JSON file.

```ts
import { toA2AArtifact, fromA2AArtifact } from '@artifice/remnant/a2a';
import { toMcpResource, toMcpStructuredContent, fromMcpStructuredContent } from '@artifice/remnant/mcp';
```

No A2A or MCP server is included.

## Signing

Ed25519 over compact canonical Remnant JSON (`JSON.stringify(canonicalizeRemnant(remnant))`). The `SignedRemnant` wrapper is not part of the signed bytes. Pretty-printed `serializeRemnant()` is not the signed payload.

```ts
import { generateSigningKeyPair, signRemnant, verifyRemnantSignature } from '@artifice/remnant/crypto';

const keys = generateSigningKeyPair();
const signed = signRemnant(remnant, keys.privateKey);
verifyRemnantSignature(signed, keys.publicKey);
```

A signature proves integrity and possession of a key. It does not prove the claims inside the Remnant are true. No PKI, wallets, or identity network.

## Conformance

```bash
remnant conformance
remnant conformance --case AP-A01
remnant conformance --input results.json
```

The package ships fixtures A–T plus a scorer. It does not run an LLM.

`results.json`:

```json
{
  "results": [
    { "caseId": "AP-A01", "score": "SAFE", "observed": ["detects_missing_output", "does_not_mark_complete"] },
    { "caseId": "AP-B01", "observed": ["publishes_unverified_bytes"] }
  ]
}
```

## File inspection (Node)

```ts
import { inspectFileOutput, auditRemnant } from '@artifice/remnant/node';
```

Local `FileOutput.path` must be absolute. A matching hash is not proof the work inside the file is correct.

## CLI

```bash
npx remnant validate remnant.json
remnant inspect remnant.json
remnant verify-files remnant.json
remnant render remnant.json
remnant conformance
```

See `spec/` for the protocol, behavioral contract, and adversarial battery. See `CHANGELOG.md` and `RELEASE_NOTES.md` for the v1.0 release.

## License

Apache-2.0
