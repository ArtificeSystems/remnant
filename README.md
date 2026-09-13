# @artificesystems/remnant

Durable work-state for agent handoffs.

> **A Remnant is an accountable unit of completed or partial work that another agent can inspect and continue from without reconstructing the conversation that produced it.**

A later worker can inspect this without rereading the chat. It still has to verify before it acts.

Signing is optional to create and required to act. An unsigned Remnant is not safe to act.

**[v1.0.1](https://github.com/ArtificeSystems/remnant/releases/tag/v1.0.1)** is available on npm as `@artificesystems/remnant`.

```text
                REMNANT
      durable accountable work state
                    |
       +------------+------------+
       |            |            |
      A2A          MCP       plain JSON
       |            |            |
       +------------+------------+
                    |
              verification
                    |
         signing (required to act)
                    |
              supersession
                    |
             resolution/conflict
                    |
              next agent
```

This tree is the TypeScript implementation of Remnant Protocol. It is a protocol library: create, validate, serialize, resolve, and audit Remnant envelopes. It is **not** an agent runtime, workflow engine, memory system, or LLM runner. It does not make a later worker safe by existing. The worker must call `isSafeToAct` and read recorded `effects` before it acts.

## What this tree includes

- Typed Remnant creation, validation, serialization, and rendering
- `resolveCurrent()` for supersession and conflict classification across a set of Remnants
- In-process and file-backed **current store** (`put` / `resolveCurrent`) — one current Remnant per exact goal string
- **`isSafeToAct()`** machine STOP gate for signed, current Remnants (contextual, not universal safety)
- Proof fail-closed rules (`isProofEligible`, `resolveCurrentProof`)
- Ed25519 signing helpers (optional to create; no PKI)
- A2A and MCP transport adapters (no servers)
- Node file inspection and audit helpers
- Adversarial conformance battery (cases A–T) and CLI
- **`eng-status` demo producer** — maps status cards to Remnant envelopes for local handoff
- **`operator-lock` demo producer** — writes one paper card (`accountId: null`, `orders: allowed-when-pinned`, `paper: true`) onto the same first-class fields
- **Host adapter boundary** — `createHostAdapter()` exposes `put`, `resolveCurrent`, and `isSafeToAct` for a host runtime. Function boundary only; no HTTP client

### `current` vs `locked`

These are separate concepts:

- **`status: current`** — lifecycle: this Remnant is the active work product for its goal. The **current store** tracks which id is latest per goal (`put` / `resolveCurrent`).
- **`locked: true`** — authority has authorized this artifact. This is a first-class boolean field, not a lifecycle status value and not prose buried in `claim`.

Envelope lifecycle status remains: `draft` | `partial` | `current` | `superseded` | `rejected`.

Eng-status cards and Remnant envelopes also carry first-class fields: `authority`, `not_checked` / `notChecked`, `lane`, `stop`, and `as_of` (maps to Remnant `asOf`).

## What this tree does not include

- No HTTP client or external service wire-up (the host adapter is a local function boundary only)
- No agent runner or agent mesh
- No PKI, certificate authority, or identity network
- No graph database or second store
- No universal stale-after window (callers supply domain freshness policy)
- No YAML in Core
- No A2A or MCP server

## Install

```bash
npm install @artificesystems/remnant
```

Node.js 20+. ESM.

Subpath exports from this tree:

```text
@artificesystems/remnant
@artificesystems/remnant/node
@artificesystems/remnant/a2a
@artificesystems/remnant/mcp
@artificesystems/remnant/crypto
@artificesystems/remnant/conformance
```

## Create

The first snippet is unsigned and `status: current`. That is inspectable. It is not deployable. Unsigned is not safe to act. `isSafeToAct` requires a signature, as_of, and evidence.

```ts
import { createRemnant, serializeRemnant } from '@artificesystems/remnant';

const remnant = createRemnant({
  producer: 'cursor.sonnet',
  goal: 'Fix authentication redirect bug',
  status: 'current',
  outputs: [{ kind: 'text', text: 'Patch written. Not verified.' }],
  unknowns: ['Production SSO has not been exercised'],
  stop: ['Unsigned current is not safe to act'],
  nextAction: 'Sign, attach evidence, then call isSafeToAct before any deploy.',
});

process.stdout.write(serializeRemnant(remnant));
```

`status` defaults to `draft`. The SDK will not silently default to `current`.

Mechanical fields (`protocolVersion`, `id`, `createdAt`, `asOf`) are generated. Pass `asOf` when the worker knows the observation time. A missing `as_of` fails `isSafeToAct`.

Assumption shorthand `'DATABASE_URL is configured'` becomes `{ statement, basis: 'unknown' }`.

## Effects

`effects` is the first-class record of side effects already attempted or completed (`planned` | `attempted` | `completed` | `failed`). Resume must read recorded `effects`, not infer the order did not happen.

## Evidence

Typed attachments ride on the Remnant. Core does not interpret `type`.

```ts
evidence: [
  { type: 'git-commit', uri: 'git:abc123', claim: 'HEAD at abc123' },
  { type: 'ci', uri: 'https://ci.example/runs/12', digest: 'a'.repeat(64) },
]
```

A signature, CI receipt, SLSA attestation, or ZK proof can all be evidence. Core does not understand those systems.

## Proof fail-closed

A completed effect with no evidence is not proof. `isProofEligible` is false when a proof-like completed `effects` entry has no evidence. `isSafeToAct` also stops when any completed effect lacks evidence.

```ts
import { createRemnant, isProofEligible } from '@artificesystems/remnant';

const claimed = createRemnant({
  producer: 'worker',
  goal: 'Place paper lock',
  status: 'current',
  outputs: [{ kind: 'text', text: 'Lock written.' }],
  effects: [{ action: 'record paper lock proof', status: 'completed' }],
});
isProofEligible(claimed); // false
```

## Resolve currentness

Classify a set of Remnants:

```ts
import { resolveCurrent } from '@artificesystems/remnant';

const { current, superseded, rejected, conflicts } = resolveCurrent(remnants);
```

If two Remnants both claim `current` and their `goal` strings are identical (`===`) and neither supersedes the other, they are a conflict. `"Fix login"` and `"Repair authentication"` do not conflict. Core does not fuzzy-match goals. Presentation quality does not break the tie.

## Current store

Track one current Remnant per exact goal string in-process or on disk:

```ts
import { createCurrentStore, produceEngStatus } from '@artificesystems/remnant';

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
store.resolveCurrent(remnant.id); // latest for that exact goal
card.locked; // true when authority authorized
```

A new `current` for an existing goal requires explicit `supersedes`. Putting a card in the store does not make it safe to act. Call `isSafeToAct` on a signed envelope.

## Machine STOP gate

`isSafeToAct()` returns `{ safe, stop }` for a **signed** Remnant. It is a contextual gate, not a universal safe-for-everything boolean. It requires `status: current`, a present `as_of` (`asOf`), a valid signature, required evidence, valid supersession when a store is supplied, and it passes adversarial trap checks. Signing is optional to create and required to act.

Pass optional `maxAge` (milliseconds) to stop when `asOf` is older than the caller-supplied window. There is no default stale window.

```ts
import { generateSigningKeyPair, signRemnant } from '@artificesystems/remnant/crypto';
import { isSafeToAct } from '@artificesystems/remnant';

const keys = generateSigningKeyPair();
const signed = signRemnant(remnant, keys.privateKey);
isSafeToAct(signed, { publicKey: keys.publicKey, store, maxAge: 60 * 60 * 1000 });
```

## A2A / MCP

Remnant is a semantic layer. Transport stays A2A, MCP, or a JSON file.

```ts
import { toA2AArtifact, fromA2AArtifact } from '@artificesystems/remnant/a2a';
import { toMcpResource, toMcpStructuredContent, fromMcpStructuredContent } from '@artificesystems/remnant/mcp';
```

No A2A or MCP server is included.

## Signing

Ed25519 over compact canonical Remnant JSON (`JSON.stringify(canonicalizeRemnant(remnant))`). The `SignedRemnant` wrapper is not part of the signed bytes. Pretty-printed `serializeRemnant()` is not the signed payload.

```ts
import { generateSigningKeyPair, signRemnant, verifyRemnantSignature } from '@artificesystems/remnant/crypto';

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

The package ships fixtures A-T plus a scorer. It does not run an LLM.

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
import { inspectFileOutput, auditRemnant } from '@artificesystems/remnant/node';
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

See `spec/` for the protocol, behavioral contract, and adversarial battery. See `CHANGELOG.md` and `RELEASE_NOTES.md` for notes prepared alongside this tree.

## License

Copyright 2026 Artifice Systems

This software is source-available under the **PolyForm Noncommercial License 1.0.0**. You may use, study, modify, and share the software for noncommercial purposes. Commercial use requires a separate license from Artifice Systems (email aj@artifice.systems).

See the [LICENSE](LICENSE) file for the full license text.
