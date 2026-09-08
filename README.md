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

This package is the v0.2 TypeScript implementation. It is not an agent runtime, workflow engine, or memory system.

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

```ts
import { resolveCurrent } from '@artifice/remnant';

const { current, superseded, rejected, conflicts } = resolveCurrent(remnants);
```

If two Remnants both claim `current` and their `goal` strings are identical (`===`) and neither supersedes the other, they are a conflict. `"Fix login"` and `"Repair authentication"` do not conflict. Core does not fuzzy-match goals. Presentation quality does not break the tie.

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

## What this package is not

No YAML. No store. No graph database. No LLM runner. No `isSafeToAct()`. No certificate authority. No workflow engine.

See `spec/` for the protocol, behavioral contract, and adversarial battery.

## License

Apache-2.0
